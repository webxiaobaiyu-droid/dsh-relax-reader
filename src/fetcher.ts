/**
 * HTTP access for the novel reader.
 *
 * Every request passes through one narrow pipe: public-address validation on
 * every redirect hop, a hard body-size cap, declared-charset decoding, a total
 * deadline, and a per-host serial gate. Keeping that policy here means the
 * parser and service never touch the network directly.
 */
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { FetchError } from './errors.ts'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 15_000
const HOST_INTERVAL_MS = 500
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Ranges that can never be reached by a user-pasted public page URL. */
const BLOCKED = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv6')
}

/** One fetched page after redirects. */
export interface FetchedPage {
  /** Decoded HTML. */
  html: string
  /** Final URL after redirects. */
  finalUrl: string
  /** Response content type. */
  contentType: string
}

/** Whether an IP literal belongs to a loopback, private, link-local, or reserved range. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  return BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

/** Strip IPv6 brackets and the root label's trailing dot before address checks. */
function bareHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
}

/** Wait for a delay while still honoring the caller's cancellation. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Wait for one promise while making cancellation win immediately. */
function raceAbort(promise: Promise<void>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    void promise.then(
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

const hostTails = new Map<string, Promise<void>>()
const hostNextAt = new Map<string, number>()

/**
 * Serialize requests per host and leave a small gap between them, as etiquette
 * toward the small static sites this reader targets.
 */
async function acquireHost(host: string, signal: AbortSignal): Promise<() => void> {
  const previous = hostTails.get(host) ?? Promise.resolve()
  let releaseGate: () => void = () => {}
  const gate = new Promise<void>((resolve) => { releaseGate = resolve })
  hostTails.set(host, previous.then(() => gate))
  await raceAbort(previous, signal)
  const wait = (hostNextAt.get(host) ?? 0) - Date.now()
  if (wait > 0) await sleep(wait, signal)
  let released = false
  return () => {
    if (released) return
    released = true
    hostNextAt.set(host, Date.now() + HOST_INTERVAL_MS)
    releaseGate()
  }
}

/**
 * Validate a user URL and reject schemes, credentials, and non-public hosts.
 * DNS is resolved here and again by the HTTP client; all answers must be public.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new FetchError('invalid-url', '地址不合法', raw)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchError('invalid-url', '只支持 http/https 地址', raw)
  }
  if (url.username !== '' || url.password !== '') {
    throw new FetchError('invalid-url', '地址里不能包含账号密码', raw)
  }
  const host = bareHost(url.hostname)
  if (host === '' || host === 'localhost' || host.endsWith('.localhost')) {
    throw new FetchError('blocked-host', '不支持内网地址', raw)
  }
  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) throw new FetchError('blocked-host', '不支持内网地址', raw)
    return url
  }
  let addresses: Array<{ address: string }>
  try {
    addresses = await lookup(host, { all: true, verbatim: true })
  } catch {
    throw new FetchError('fetch-failed', '域名解析失败', raw)
  }
  if (addresses.length === 0 || addresses.some(item => isPrivateAddress(item.address))) {
    throw new FetchError('blocked-host', '不支持内网地址', raw)
  }
  return url
}

/** Read a response body while enforcing the size cap. */
async function readLimited(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    await response.body?.cancel()
    throw new FetchError('fetch-failed', '页面过大', response.url)
  }
  if (response.body === null) return new Uint8Array(await response.arrayBuffer())
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) throw new FetchError('fetch-failed', '页面过大', response.url)
      chunks.push(value)
    }
  } finally {
    if (total > MAX_BYTES) await reader.cancel().catch(() => {})
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

/** Read a declared charset, normalizing the Chinese aliases. */
function charsetOf(contentType: string, bytes: Uint8Array): string {
  const header = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(contentType)?.[1]
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 8192))
  const meta = /<meta[^>]+charset\s*=\s*["']?([^"'\s/>]+)/i.exec(head)?.[1]
    ?? /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^"'\s;]+)/i.exec(head)?.[1]
  const raw = (header ?? meta ?? 'utf-8').toLowerCase()
  if (raw === 'gb2312' || raw === 'gbk') return 'gb18030'
  if (raw === 'utf8') return 'utf-8'
  return raw
}

/** Decode response bytes with the page's declared charset. */
export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const charset = charsetOf(contentType, bytes)
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
}

/** Reject binary payloads early so the parser never receives an image or PDF. */
function assertDocumentType(contentType: string, url: string): void {
  if (contentType === '') return
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (
    mediaType.startsWith('image/')
    || mediaType.startsWith('audio/')
    || mediaType.startsWith('video/')
    || mediaType === 'application/pdf'
    || mediaType === 'application/octet-stream'
    || mediaType === 'application/zip'
  ) {
    throw new FetchError('unsupported-page', '这个地址不是网页', url)
  }
}

/**
 * Fetch one page with manual redirects, SSRF validation, encoding detection,
 * a total deadline, and polite per-host pacing.
 */
export async function fetchPage(rawUrl: string, signal: AbortSignal): Promise<FetchedPage> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = AbortSignal.any([signal, timeout])
  let current = await assertPublicUrl(rawUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const release = await acquireHost(bareHost(current.hostname), combined)
    try {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: combined,
        headers: {
          'user-agent': USER_AGENT,
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.6',
          'cache-control': 'no-cache',
        },
      }).catch((error: unknown) => {
        if (signal.aborted) throw error
        if (timeout.aborted) throw new FetchError('fetch-failed', '请求超时', rawUrl)
        throw new FetchError('fetch-failed', '网络请求失败', rawUrl, { cause: error })
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel().catch(() => {})
        if (location === null) throw new FetchError('fetch-failed', '重定向缺少地址', current.href)
        if (hop === MAX_REDIRECTS) throw new FetchError('fetch-failed', '重定向次数过多', rawUrl)
        current = await assertPublicUrl(new URL(location, current).href)
        continue
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {})
        throw new FetchError('fetch-failed', `页面返回 HTTP ${response.status}`, current.href)
      }
      const contentType = response.headers.get('content-type') ?? ''
      assertDocumentType(contentType, current.href)
      const bytes = await readLimited(response)
      return { html: decodeHtml(bytes, contentType), finalUrl: current.href, contentType }
    } finally {
      release()
    }
  }
  throw new FetchError('fetch-failed', '重定向次数过多', rawUrl)
}


/**
 * One retry for transient connect/DNS failures.
 *
 * Some consumer networks answer the first request to a Cloudflare-fronted host
 * with a failed IPv6 attempt before the fallback route is warm. A single quiet
 * retry turns that into a normal page without retrying a real HTTP 404.
 */
export async function fetchPageWithRetry(
  rawUrl: string,
  signal: AbortSignal,
  attempts = 2,
): Promise<FetchedPage> {
  let lastError: unknown
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    try {
      return await fetchPage(rawUrl, signal)
    } catch (error: unknown) {
      lastError = error
      const transient = error instanceof FetchError
        && error.code === 'fetch-failed'
        && (error.message === '网络请求失败' || error.message === '域名解析失败')
      if (!transient || attempt >= attempts - 1 || signal.aborted) throw error
      await sleep(300, signal)
    }
  }
  throw lastError
}
