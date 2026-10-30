/** Host service: fetch a page, parse it, and own the bookshelf. */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { FetchError } from './errors.ts'
import { fetchPageWithRetry } from './fetcher.ts'
import {
  bqgApiIdFromHtml,
  bqgBook,
  bqgBookList,
  bqgBookUrl,
  bqgChapter,
  bqgChapterRefs,
  bqgCoverUrl,
  bqgSearch,
  cleanBqgChapter,
  decodeBqgEntities,
  parseBqgTarget,
  type BqgTarget,
} from './bqg.ts'
import {
  bookId,
  canonicalUrl,
  chapterId,
  parseChapterPage,
  parsePage,
  parseTocPage,
} from './parser.ts'
import {
  findSource,
  loadSourceBook,
  loadSourceChapter,
  loadSourcePreview,
  searchAllSources,
  sourceTarget,
  type HtmlSource,
  type SourceTarget,
} from './sources.ts'
import { rankResults } from './search.ts'
import { ReaderStore } from './store.ts'
import { EDITIONS_PATH, SEARCH_PATH } from './types.ts'
import type {
  Book,
  BookIdRequest,
  ChapterContent,
  ChapterRef,
  ChapterRequest,
  ParsePreview,
  ParseUrlRequest,
  ProgressRequest,
  SaveBookRequest,
  SearchResult,
  SearchResponse,
  SourceEdition,
} from './types.ts'

/** Loader plugin name. */
export const name = 'dsh-relax-reader'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** A parser, fetch, or storage failure with a stable sub-code. */
    'dsh-relax-reader/failed': { readonly code: string; readonly url?: string | undefined }
  }
}

/** Convert a domain failure into the single Remote failure code. */
function fail(error: unknown): never {
  if (error instanceof FetchError) {
    throw new RemoteError('dsh-relax-reader/failed', error.message, { code: error.code, url: error.url })
  }
  throw error
}

/** Caller cancellation must cross the Remote layer unchanged. */
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || error instanceof Error && error.name === 'AbortError'
}

/** Final confidence uses chapter text, not a synopsis standing in for it. */
function confidenceOf(preview: ParsePreview, chapterSample: boolean): ParsePreview['confidence'] {
  if (
    preview.title !== '未命名书籍' && preview.author !== '佚名'
    && preview.chapters.length >= 3 && chapterSample && preview.sample.length >= 100
  ) return 'high'
  if (preview.title !== '未命名书籍' && preview.chapters.length >= 1) return 'medium'
  return 'low'
}

/** Validate and normalize URLs that arrived from the browser. */
function webUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return canonicalUrl(url.href)
  } catch {
    return undefined
  }
}

/** Build a unique, ordered catalog from untrusted preview data. */
function sanitizeChapters(chapters: ParsePreview['chapters']): ChapterRef[] {
  const seen = new Set<string>()
  const result: ChapterRef[] = []
  for (const item of chapters) {
    if (result.length >= 5000) break
    const url = webUrl(item.url)
    if (url === undefined || seen.has(url)) continue
    const title = item.title.replace(/\s+/g, ' ').trim().slice(0, 160)
    if (title === '') continue
    seen.add(url)
    result.push({ id: chapterId(url), title, url, index: result.length })
  }
  return result
}

/** The route-registration face of DSH's same-origin fetch carrier. */
interface ReaderConnection {
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
      readonly requestBody: 'buffered' | 'streaming'
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
  }
}

/** JSON response for a same-origin route. */
function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

/** Label a source URL without fetching it. */
function sourceLabel(url: string): string {
  try {
    if (parseBqgTarget(url) !== undefined) return '笔趣阁'
    const source = findSource(url)
    if (source !== undefined) return source.name
    return new URL(url).host
  } catch {
    return '未知来源'
  }
}

/** Read a source's catalog and return its current update point. */
async function editionSummary(url: string, signal: AbortSignal): Promise<SourceEdition> {
  const bqg = parseBqgTarget(url)
  if (bqg?.kind === 'virtual' && bqg.apiId !== undefined) {
    const names = await bqgBookList(bqg.apiId, signal)
    return {
      sourceName: '笔趣阁',
      url,
      chapterCount: names.length,
      latestChapter: names[names.length - 1],
    }
  }
  const source = findSource(url)
  if (source === undefined) throw new FetchError('unsupported-page', '不支持这个来源', url)
  const target = sourceTarget(source, url)
  if (target === undefined) throw new FetchError('unsupported-page', '无法识别这个来源的书籍地址', url)
  const booked = await loadSourceBook(source, target.bookUrl, signal)
  const latest = booked.chapters[booked.chapters.length - 1]
  return {
    sourceName: source.name,
    url: target.bookUrl,
    chapterCount: booked.chapters.length,
    ...latest === undefined ? {} : { latestChapter: latest.title },
  }
}

/** Resolve a bq555/bqg virtual target into a complete preview. */
async function parseBqgPreview(target: BqgTarget, signal: AbortSignal): Promise<ParsePreview> {
  if (target.kind === 'html') {
    if (target.dirId === undefined) throw new FetchError('unsupported-page', '没有识别到书籍编号')
    const detailUrl = `https://www.bq555.cc/xs/${target.dirId}/`
    const page = await fetchPageWithRetry(detailUrl, signal)
    const parsed = parsePage(page.html, page.finalUrl)
    if (parsed.kind !== 'book' || parsed.preview === undefined) {
      throw new FetchError('unsupported-page', '没有识别到书籍结构', detailUrl)
    }
    const apiId = bqgApiIdFromHtml(page.html)
    if (apiId === undefined) throw new FetchError('unsupported-page', '没有识别到该站的阅读接口', detailUrl)
    const chapters = bqgChapterRefs(apiId, parsed.preview.chapters.map(chapter => chapter.title))
    let sample = parsed.preview.description ?? parsed.preview.sample
    let sampleFromChapter = false
    try {
      const payload = await bqgChapter(apiId, target.chapterNo ?? 1, signal)
      const text = cleanBqgChapter(payload.txt, payload.chaptername)
      if (text !== '') {
        sample = text.slice(0, 300)
        sampleFromChapter = true
      }
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      // A chapter endpoint hiccup should not discard a valid catalog.
    }
    const preview: ParsePreview = {
      title: parsed.preview.title,
      author: parsed.preview.author,
      coverUrl: parsed.preview.coverUrl,
      description: parsed.preview.description,
      detailUrl: bqgBookUrl(apiId),
      sourceHost: 'www.bq555.cc',
      chapters,
      chapterCount: chapters.length,
      sample: sample.slice(0, 300),
      confidence: 'medium',
    }
    preview.confidence = confidenceOf(preview, sampleFromChapter)
    return preview
  }

  if (target.apiId === undefined) throw new FetchError('unsupported-page', '没有识别到书籍编号')
  const book = await bqgBook(target.apiId, signal)
  const names = await bqgBookList(target.apiId, signal)
  const chapters = bqgChapterRefs(target.apiId, names)
  let sample = book.intro
  let sampleFromChapter = false
  try {
    const payload = await bqgChapter(target.apiId, target.chapterNo ?? 1, signal)
    const text = cleanBqgChapter(payload.txt, payload.chaptername)
    if (text !== '') {
      sample = text.slice(0, 300)
      sampleFromChapter = true
    }
  } catch (error: unknown) {
    if (signal.aborted || isAbort(error)) throw error
  }
  const preview: ParsePreview = {
    title: book.title,
    author: book.author,
    coverUrl: bqgCoverUrl(target.apiId),
    description: book.intro,
    detailUrl: bqgBookUrl(target.apiId),
    sourceHost: 'www.bq555.cc',
    chapters,
    chapterCount: chapters.length,
    sample: sample.slice(0, 300),
    confidence: 'medium',
  }
  preview.confidence = confidenceOf(preview, sampleFromChapter)
  return preview
}

/** Resolve a supported HTML source into a complete preview. */
async function parseSourcePreview(
  source: HtmlSource,
  target: SourceTarget,
  signal: AbortSignal,
): Promise<ParsePreview> {
  signal.throwIfAborted()
  const page = await loadSourcePreview(source, target, signal)
  const preview: ParsePreview = {
    title: page.title,
    author: page.author,
    ...page.coverUrl === undefined ? {} : { coverUrl: page.coverUrl },
    ...page.description === undefined ? {} : { description: page.description },
    detailUrl: page.detailUrl,
    tocUrl: page.tocUrl,
    sourceHost: new URL(page.detailUrl).host,
    chapters: page.chapters,
    chapterCount: page.chapters.length,
    sample: page.sample,
    confidence: 'medium',
  }
  preview.confidence = confidenceOf(preview, page.sampleFromChapter)
  return preview
}

/** Bookshelf and parser service exposed to the browser as `relaxReader`. */
export default class RelaxReaderService extends TypertRemoteService {
  static inject = ['typert', 'connection']

  private readonly store = new ReaderStore()

  constructor(ctx: Context) {
    super(ctx, 'relaxReader', { namespace: 'relaxReader' })
    const connection = ctx.get('connection') as ReaderConnection | undefined
    if (connection !== undefined) {
      ctx.effect(() => connection.fetch.register({
        path: SEARCH_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
          if (query === '') return jsonResponse({ query, results: [] } satisfies SearchResponse)
          if (query.length > 80) return jsonResponse({ error: '搜索词太长了' }, 400)
          try {
            const [bqg, extra] = await Promise.allSettled([
              bqgSearch(query, request.signal),
              searchAllSources(query, request.signal),
            ])
            if (request.signal.aborted) return jsonResponse({ error: '搜索已取消' }, 499)
            const results: SearchResult[] = []
            if (bqg.status === 'fulfilled') {
              results.push(...bqg.value.map(hit => ({
                id: hit.id,
                title: hit.title,
                author: hit.author,
                intro: hit.intro,
                url: bqgBookUrl(hit.id),
                coverUrl: bqgCoverUrl(hit.id),
                sourceName: '笔趣阁',
              })))
            }
            if (extra.status === 'fulfilled') {
              results.push(...extra.value.map(hit => ({
                id: hit.id,
                title: hit.title,
                author: hit.author,
                intro: hit.intro,
                url: hit.url,
                ...hit.coverUrl === undefined ? {} : { coverUrl: hit.coverUrl },
                sourceName: hit.sourceName,
              })))
            }
            if (results.length === 0 && bqg.status === 'rejected' && extra.status === 'rejected') {
              throw new Error('所有书库都没有响应')
            }
            return jsonResponse({ query, results: rankResults(query, results) } satisfies SearchResponse)
          } catch (error: unknown) {
            if (request.signal.aborted || isAbort(error)) return jsonResponse({ error: '搜索已取消' }, 499)
            const code = error instanceof FetchError ? error.code : 'fetch-failed'
            return jsonResponse({ error: error instanceof Error ? error.message : '搜索失败', code }, 502)
          }
        },
      }), 'dsh-relax-reader: site search route')

      ctx.effect(() => connection.fetch.register({
        path: EDITIONS_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let urls: unknown
          try {
            const body = await request.json() as { urls?: unknown }
            urls = body.urls
          } catch {
            return jsonResponse({ error: '请求格式不正确' }, 400)
          }
          if (!Array.isArray(urls) || urls.some(item => typeof item !== 'string')) {
            return jsonResponse({ error: 'urls 必须是字符串数组' }, 400)
          }
          const unique = [...new Set(urls as string[])].slice(0, 8)
          const editions = await Promise.all(unique.map(async (url): Promise<SourceEdition> => {
            try {
              return await editionSummary(url, request.signal)
            } catch (error: unknown) {
              return {
                sourceName: sourceLabel(url),
                url,
                error: error instanceof Error ? error.message : '目录不可用',
              }
            }
          }))
          return jsonResponse({ editions } satisfies { editions: SourceEdition[] })
        },
      }), 'dsh-relax-reader: source editions route')
    }
  }

  /**
   * Fetch and parse a book detail, catalog, or chapter page.
   *
   * A chapter URL is not a dead end: its catalog link is followed and the
   * chapter itself becomes the preview's sample, so pasting any page in the
   * reading flow produces a usable book.
   */
  @Remote
  async parseUrl(request: ParseUrlRequest, signal: AbortSignal): Promise<ParsePreview> {
    signal.throwIfAborted()
    try {
      const raw = typeof request.url === 'string' ? request.url.trim() : ''
      if (raw === '') throw new FetchError('invalid-url', '请输入页面地址')
      const bqg = parseBqgTarget(raw)
      if (bqg !== undefined) return await parseBqgPreview(bqg, signal)
      const source = findSource(raw)
      if (source !== undefined) {
        const target = sourceTarget(source, raw)
        if (target !== undefined) return await parseSourcePreview(source, target, signal)
      }
      const page = await fetchPageWithRetry(raw, signal)
      const parsed = parsePage(page.html, page.finalUrl)

      if (parsed.kind === 'chapter') {
        const chapterPage = parseChapterPage(page.html, page.finalUrl)
        if (chapterPage.tocUrl === undefined) {
          throw new FetchError('no-chapters', '这个章节页没有找到目录入口', page.finalUrl)
        }
        const tocPage = await fetchPageWithRetry(chapterPage.tocUrl, signal)
        const chapters = parseTocPage(tocPage.html, tocPage.finalUrl)
        const preview: ParsePreview = {
          title: chapterPage.title,
          author: chapterPage.author,
          coverUrl: chapterPage.coverUrl,
          description: chapterPage.description,
          detailUrl: tocPage.finalUrl,
          tocUrl: tocPage.finalUrl,
          sourceHost: new URL(tocPage.finalUrl).host,
          chapters,
          chapterCount: chapters.length,
          sample: chapterPage.chapter.content.slice(0, 300),
          confidence: 'medium',
        }
        preview.confidence = confidenceOf(preview, true)
        return preview
      }

      const preview = parsed.preview
      if (preview === undefined) {
        throw new FetchError('unsupported-page', '请粘贴书籍详情页、目录页或章节页地址', page.finalUrl)
      }

      let chapterSample = false
      const first = preview.chapters[0]
      if (first !== undefined && canonicalUrl(first.url) !== canonicalUrl(page.finalUrl)) {
        try {
          const firstPage = await fetchPageWithRetry(first.url, signal)
          const parsedFirst = parsePage(firstPage.html, firstPage.finalUrl)
          if (parsedFirst.chapter !== undefined) {
            preview.sample = parsedFirst.chapter.content.slice(0, 300)
            chapterSample = true
          }
        } catch (error: unknown) {
          if (signal.aborted || isAbort(error)) throw error
          // A missing sample must not hide a perfectly good catalog.
        }
      }
      preview.confidence = confidenceOf(preview, chapterSample)
      return preview
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      return fail(error)
    }
  }

  /**
   * Save a confirmed preview as a book plus catalog in one atomic write.
   */
  @Remote
  async saveBook(request: SaveBookRequest, signal: AbortSignal): Promise<Book> {
    signal.throwIfAborted()
    try {
      const preview = request.preview
      const detailUrl = webUrl(preview.detailUrl)
      if (detailUrl === undefined) throw new FetchError('invalid-url', '书籍地址不合法')
      const chapters = sanitizeChapters(preview.chapters)
      if (chapters.length === 0) throw new FetchError('no-chapters', '没有章节目录，无法收藏', detailUrl)

      const id = bookId(detailUrl)
      const existing = await this.store.getBook(id)
      const now = Date.now()
      const tocUrl = preview.tocUrl === undefined ? undefined : webUrl(preview.tocUrl)
      const coverUrl = preview.coverUrl === undefined ? undefined : webUrl(preview.coverUrl)
      const lastChapterExists = chapters.some(item => item.id === existing?.lastChapterId)
      const book: Book = {
        id,
        title: preview.title.replace(/\s+/g, ' ').trim().slice(0, 160) || '未命名书籍',
        author: preview.author.replace(/\s+/g, ' ').trim().slice(0, 80) || '佚名',
        ...coverUrl === undefined ? {} : { coverUrl },
        ...preview.description === undefined
          ? {}
          : { description: preview.description.replace(/\s+/g, ' ').trim().slice(0, 1200) },
        detailUrl,
        ...tocUrl === undefined ? {} : { tocUrl },
        sourceHost: /^[a-z0-9.-]+(?::\d+)?$/i.test(preview.sourceHost.trim())
          ? preview.sourceHost.trim()
          : new URL(detailUrl).host,
        chapterCount: chapters.length,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastChapterId: lastChapterExists ? existing?.lastChapterId : chapters[0]?.id,
        lastOffset: lastChapterExists ? existing?.lastOffset ?? 0 : 0,
      }
      await this.store.upsertBookWithToc(book, chapters)
      return book
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      return fail(error)
    }
  }

  /** List every saved book, most recently updated first. */
  @Remote
  async listBooks(signal: AbortSignal): Promise<Book[]> {
    signal.throwIfAborted()
    try {
      return await this.store.listBooks()
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      return fail(error)
    }
  }

  /** Return a book's catalog, fetching it lazily if the saved cache is absent. */
  @Remote
  async getToc(request: BookIdRequest, signal: AbortSignal): Promise<ChapterRef[]> {
    signal.throwIfAborted()
    try {
      const cached = await this.store.getToc(request.bookId)
      if (cached.length > 0) return cached
      const book = await this.store.getBook(request.bookId)
      if (book === undefined) throw new FetchError('no-chapters', '书架里没有这本书', request.bookId)
      const site = parseBqgTarget(book.detailUrl)
      if (site?.kind === 'virtual' && site.apiId !== undefined) {
        const names = await bqgBookList(site.apiId, signal)
        const chapters = bqgChapterRefs(site.apiId, names)
        book.chapterCount = chapters.length
        book.updatedAt = Date.now()
        await this.store.upsertBookWithToc(book, chapters)
        return chapters
      }
      const source = findSource(book.detailUrl)
      if (source !== undefined) {
        const page = await loadSourceBook(source, book.detailUrl, signal)
        book.chapterCount = page.chapters.length
        book.tocUrl = page.tocUrl
        book.updatedAt = Date.now()
        await this.store.upsertBookWithToc(book, page.chapters)
        return page.chapters
      }
      if (book.tocUrl === undefined) throw new FetchError('no-chapters', '这本书没有目录地址', book.detailUrl)
      const page = await fetchPageWithRetry(book.tocUrl, signal)
      const chapters = parseTocPage(page.html, page.finalUrl)
      book.chapterCount = chapters.length
      book.updatedAt = Date.now()
      await this.store.upsertBookWithToc(book, chapters)
      return chapters
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      return fail(error)
    }
  }

  /** Return one chapter body, fetching and caching it on demand. */
  @Remote
  async getChapter(request: ChapterRequest, signal: AbortSignal): Promise<ChapterContent> {
    signal.throwIfAborted()
    try {
      const cached = await this.store.getChapter(request.bookId, request.chapterId)
      if (cached !== undefined) return cached
      const toc = await this.store.getToc(request.bookId)
      const index = toc.findIndex(item => item.id === request.chapterId)
      const ref = index === -1 ? undefined : toc[index]
      if (ref === undefined) throw new FetchError('no-content', '目录里没有这一章', request.chapterId)
      const site = parseBqgTarget(ref.url)
      const source = findSource(ref.url)
      let chapter: ChapterContent
      if (source !== undefined) {
        const text = await loadSourceChapter(source, ref.url, signal, ref.title)
        chapter = { id: request.chapterId, title: text.title === '' ? ref.title : text.title, content: text.content }
      } else if (site?.kind === 'virtual' && site.apiId !== undefined) {
        const payload = await bqgChapter(site.apiId, site.chapterNo ?? index + 1, signal)
        const content = cleanBqgChapter(payload.txt, payload.chaptername)
        if (content === '') throw new FetchError('no-content', '章节接口没有返回正文', ref.url)
        chapter = { id: request.chapterId, title: decodeBqgEntities(payload.chaptername) || ref.title, content }
      } else {
        const page = await fetchPageWithRetry(ref.url, signal)
        const parsed = parseChapterPage(page.html, page.finalUrl)
        chapter = parsed.chapter
        // A redirect may produce a different final URL; the catalog id is the
        // stable identity the client asked for and the key this cache uses.
        chapter.id = request.chapterId
        if (chapter.title === '未命名章节') chapter.title = ref.title
      }
      const previous = toc[index - 1]
      const next = toc[index + 1]
      if (chapter.prevId === undefined && previous !== undefined) chapter.prevId = previous.id
      if (chapter.nextId === undefined && next !== undefined) chapter.nextId = next.id
      await this.store.putChapter(request.bookId, chapter)
      return chapter
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      return fail(error)
    }
  }

  /** Persist reading progress. */
  @Remote
  async saveProgress(request: ProgressRequest, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    try {
      await this.store.saveProgress(request.bookId, request.chapterId, request.offset)
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      return fail(error)
    }
  }

  /** Remove a book and every cached chapter body. */
  @Remote
  async removeBook(request: BookIdRequest, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    try {
      await this.store.removeBook(request.bookId)
    } catch (error: unknown) {
      if (signal.aborted || isAbort(error)) throw error
      return fail(error)
    }
  }
}
