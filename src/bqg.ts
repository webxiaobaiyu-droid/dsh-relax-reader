/**
 * Site adapter for bq555 (笔趣阁) and its current reader backend.
 *
 * bq555 detail pages are static, but chapter requests are redirected to a
 * hash-routed reader backed by a signed JSON API. The API token is AES-CBC over
 * the request payload; recreating it here keeps chapter reads on the Host and
 * avoids executing the site's obfuscated browser script.
 */
import { createCipheriv, createHash } from 'node:crypto'
import { FetchError } from './errors.ts'
import { fetchPageWithRetry } from './fetcher.ts'
import { canonicalUrl, chapterId } from './parser.ts'
import type { ChapterRef } from './types.ts'

/** Public SPA origin used for stable virtual book/chapter addresses. */
const BQG_ORIGIN = 'https://www.bqg539.xyz'

/** API host used for search, catalog, metadata, and full chapter text. */
const BQG_API_ORIGIN = BQG_ORIGIN

/** Fixed key material from the site's reader script (`book@token.html`). */
const TOKEN_SECRET = 'book@token.html'

/** One search hit returned by the backend. */
export interface BqgSearchHit {
  readonly id: string
  readonly title: string
  readonly author: string
  readonly intro: string
}

/** One chapter from the backend. */
export interface BqgChapterPayload {
  readonly id: number
  readonly chapterid: number
  readonly dirid: number
  readonly title: string
  readonly author: string
  readonly chaptername: string
  readonly cs: number
  readonly ck: string | null
  readonly txt: string
}

/** Metadata from the backend's `/api/book`. */
export interface BqgBookPayload {
  readonly id: string
  readonly title: string
  readonly sortname: string
  readonly author: string
  readonly full: string
  readonly intro: string
  readonly lastchapterid: string
  readonly lastchapter: string
  readonly lastupdate: string
  readonly dirid: number
}

/** A user URL recognized as a bq555 page or a backend virtual address. */
export interface BqgTarget {
  /** `html` needs the bq555 detail page; `virtual` can go straight to the API. */
  readonly kind: 'html' | 'virtual'
  /** Original host for display and identity. */
  readonly host: string
  /** bq555 directory id, present for `html` targets. */
  readonly dirId?: string | undefined
  /** Backend book id, present for `virtual` targets. */
  readonly apiId?: string | undefined
  /** Chapter number, present when a chapter URL was pasted. */
  readonly chapterNo?: number | undefined
}

/** Decode the small HTML-entity subset novel sites use in plain JSON fields. */
export function decodeBqgEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
}

/** Build the signed token exactly as the site's `enaes()` helper does. */
export function createBqgToken(payload: object): string {
  const code = createHash('md5').update(TOKEN_SECRET).digest('hex')
  const iv = Buffer.from(code.slice(0, 16), 'utf8')
  const key = Buffer.from(code.slice(16, 32), 'utf8')
  const cipher = createCipheriv('aes-128-cbc', key, iv)
  const plaintext = JSON.stringify(payload)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return encodeURIComponent(encrypted.toString('base64'))
}

/** Build one signed API URL. */
export function bqgApiUrl(endpoint: string, payload: object): string {
  return `${BQG_API_ORIGIN}/api/${endpoint}?token=${createBqgToken(payload)}`
}

/** Stable virtual book URL used in the bookshelf and chapter references. */
export function bqgBookUrl(apiId: string): string {
  return canonicalUrl(`${BQG_ORIGIN}/#/book/${encodeURIComponent(apiId)}/`)
}

/** Stable virtual chapter URL used in the catalog. */
export function bqgChapterUrl(apiId: string, chapterNo: number): string {
  return canonicalUrl(`${BQG_ORIGIN}/#/book/${encodeURIComponent(apiId)}/${String(chapterNo)}.html`)
}

/** The cover path follows the site's `Math.floor(id / 1000)` convention. */
export function bqgCoverUrl(apiId: string): string | undefined {
  const numeric = Number(apiId)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return undefined
  return `https://www.bq555.cc/bookimg/${Math.floor(numeric / 1000)}/${String(numeric)}.jpg`
}

/** Recognize bq555 HTML pages and bq539 virtual addresses. */
export function parseBqgTarget(raw: string): BqgTarget | undefined {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  const host = url.hostname.toLowerCase()

  if (host === 'bq555.cc' || host === 'www.bq555.cc' || host === 'm.bq555.cc') {
    const match = /^\/xs\/(\d+)\/(?:(\d+)\.html)?\/?$/.exec(url.pathname)
    if (match?.[1] === undefined) return undefined
    return {
      kind: 'html',
      host,
      dirId: match[1],
      chapterNo: match[2] === undefined ? undefined : Number(match[2]),
    }
  }

  if (host === 'bqg539.xyz' || host === 'www.bqg539.xyz') {
    // Both the SPA hash (`#/book/2530/1.html`) and the stable virtual path
    // (`/book/2530/1.html`) are accepted.
    const source = `${url.pathname}${url.hash}`
    const match = /\/book\/(\d+)(?:\/(\d+)\.html)?\/?/.exec(source)
    if (match?.[1] === undefined) return undefined
    return {
      kind: 'virtual',
      host,
      apiId: match[1],
      chapterNo: match[2] === undefined ? undefined : Number(match[2]),
    }
  }
  return undefined
}

/** Read one JSON API response through the same SSRF, size, and timeout policy. */
async function apiJson<T>(endpoint: string, payload: object, signal: AbortSignal): Promise<T> {
  const url = bqgApiUrl(endpoint, payload)
  const page = await fetchPageWithRetry(url, signal)
  try {
    return JSON.parse(page.html.trim()) as T
  } catch (error) {
    throw new FetchError('fetch-failed', '小说接口返回格式异常', url, { cause: error })
  }
}

/** Search the backend for titles or authors. */
export async function bqgSearch(query: string, signal: AbortSignal): Promise<BqgSearchHit[]> {
  // The site's search endpoint takes the query in the URL, not the signed
  // request payload (the browser helper still calls it through `get_api`).
  const page = await fetchPageWithRetry(`${BQG_API_ORIGIN}/api/search?q=${encodeURIComponent(query)}`, signal)
  let result: { data?: unknown }
  try {
    result = JSON.parse(page.html.trim()) as { data?: unknown }
  } catch (error) {
    throw new FetchError('fetch-failed', '搜索接口返回格式异常', page.finalUrl, { cause: error })
  }
  if (!Array.isArray(result.data)) return []
  return result.data.flatMap((item): BqgSearchHit[] => {
    if (typeof item !== 'object' || item === null) return []
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' && typeof record.id !== 'number') return []
    if (typeof record.title !== 'string' || typeof record.author !== 'string') return []
    return [{
      id: String(record.id),
      title: decodeBqgEntities(record.title).replace(/\s+/g, ' ').trim(),
      author: decodeBqgEntities(record.author).replace(/\s+/g, ' ').trim() || '佚名',
      intro: typeof record.intro === 'string'
        ? decodeBqgEntities(record.intro).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        : '',
    }]
  }).slice(0, 50)
}

/** Read book metadata from the backend. */
export async function bqgBook(apiId: string, signal: AbortSignal): Promise<BqgBookPayload> {
  return apiJson<BqgBookPayload>('book', { id: Number(apiId) }, signal)
}

/** Read the complete ordered chapter-name list. */
export async function bqgBookList(apiId: string, signal: AbortSignal): Promise<string[]> {
  const result = await apiJson<{ list?: unknown }>('booklist', { id: Number(apiId) }, signal)
  if (!Array.isArray(result.list)) throw new FetchError('no-chapters', '目录接口没有返回章节', BQG_API_ORIGIN)
  return result.list
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(item => decodeBqgEntities(item).replace(/\s+/g, ' ').trim())
}

/** Read one complete chapter body. */
export async function bqgChapter(apiId: string, chapterNo: number, signal: AbortSignal): Promise<BqgChapterPayload> {
  const result = await apiJson<BqgChapterPayload>('chapter', { id: Number(apiId), chapterid: chapterNo }, signal)
  if (typeof result.txt !== 'string' || result.txt.trim() === '') {
    throw new FetchError('no-content', '章节接口没有返回正文', bqgChapterUrl(apiId, chapterNo))
  }
  return result
}

/** Build the catalog with stable ids and virtual URLs. */
export function bqgChapterRefs(apiId: string, names: readonly string[]): ChapterRef[] {
  return names.map((title, index) => {
    const url = bqgChapterUrl(apiId, index + 1)
    return {
      id: chapterId(url),
      title: decodeBqgEntities(title).replace(/\s+/g, ' ').trim(),
      url,
      index,
    }
  })
}

/** Turn API newlines and stray markup into the reader's paragraph contract. */
export function cleanBqgText(raw: string): string {
  return decodeBqgEntities(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(line => line !== '')
    .filter(line => !(line.length <= 220 && /请收藏本站|手机版|点此报错|加入书签|笔趣阁|bqg\d+\.(?:com|xyz|cc)|https?:\/\//i.test(line)))
    .join('\n\n')
    .trim()
}

/** Remove a leading chapter-name line that some API records embed in `txt`. */
export function cleanBqgChapter(raw: string, chapterName: string): string {
  const text = cleanBqgText(raw)
  const [first] = text.split('\n\n', 1)
  if (first === undefined) return text
  const compact = (value: string): string => value.replace(/\s+/g, '')
  if (compact(first) === compact(decodeBqgEntities(chapterName))) return text.slice(first.length).trimStart()
  return text
}

/** Extract the backend id embedded in a bq555 detail page. */
export function bqgApiIdFromHtml(html: string): string | undefined {
  const bookError = /(?:book_error|addBookCase)\(\s*['"](\d+)['"]/.exec(html)
  if (bookError?.[1] !== undefined) return bookError[1]
  const cover = /\/bookimg\/\d+\/(\d+)\.jpg/.exec(html)
  return cover?.[1]
}
