/**
 * Extra HTML sources adapted from a shared Legado (阅读) book-source export.
 *
 * The export carries 65 sources; these four are the ones that still answer a
 * plain GET, expose a complete catalog, and serve full chapter text without a
 * browser or a signed app API. Each definition is deliberately small and
 * declarative: a search template, a handful of CSS selectors, and one URL
 * shape, so a broken site fails loudly instead of silently scraping garbage.
 *
 * All network access still goes through `fetcher.ts`, which keeps the SSRF,
 * timeout, size, and charset policy in one place.
 */
import { JSDOM } from 'jsdom'
import { pinyin } from 'pinyin-pro'
import { FetchError } from './errors.ts'
import { fetchPageWithRetry } from './fetcher.ts'
import { canonicalUrl, chapterId } from './parser.ts'
import type { ChapterRef } from './types.ts'

const ATTRIBUTES = new Set(['href', 'src', 'content', 'title', 'alt', 'value'])

const SKIP_TOC_TEXT = /^(?:最新章节|目录|展开|收起|上一页|下一页|首页|尾页|返回目录|加入书签)$/

/** One parsed selector: a CSS query plus an optional attribute to read. */
interface Selector {
  readonly css: string
  readonly attribute?: string
}

/** Split `css@attr` without breaking attribute selectors like `[href*="@"]`. */
function parseSelector(raw: string): Selector {
  const at = raw.lastIndexOf('@')
  if (at > 0) {
    const attribute = raw.slice(at + 1)
    if (ATTRIBUTES.has(attribute)) return { css: raw.slice(0, at), attribute }
  }
  return { css: raw }
}

/** Collapse the whitespace novel pages sprinkle through every text node. */
export function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Strip promo lines that templates append to the synopsis. */
export function cleanDescription(value: string): string {
  return cleanText(value)
    .replace(/^简\s*介\s*[:：]\s*/, '')
    .replace(/作者[:：].{0,40}所写的[^。]{0,80}(?:转载作品|章节由网友发布)[。.]?/g, '')
    .replace(/无弹窗推荐地址[:：]?\s*\S*/g, '')
    .replace(/^136书屋为您提供[\s\S]*?版权属于作者[:：][^,，。]*[，,。]?(?:您也可以[^。]*[。.]?)?/u, '')
    .trim()
}

/** Strip the `作者：` prefix and the `作品集` suffix some templates use. */
export function cleanAuthor(value: string): string {
  return cleanText(value)
    .replace(/^作\s*者\s*[:：]\s*/, '')
    .replace(/作品集$/, '')
    .trim()
}

/** Read one selector from a root, falling back to an empty string. */
function read(root: ParentNode, raw: string): string {
  const { css, attribute } = parseSelector(raw)
  let element: Element | null = null
  try {
    element = root.querySelector(css)
  } catch {
    return ''
  }
  if (element === null) return ''
  if (attribute === undefined) return cleanText(element.textContent ?? '')
  return cleanText(element.getAttribute(attribute) ?? '')
}

/** Resolve a possibly relative URL and reject non-HTTP schemes. */
function resolveUrl(base: string, raw: string): string | undefined {
  const value = raw.trim()
  if (value === '' || value.startsWith('#') || /^javascript:/i.test(value)) return undefined
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.href
  } catch {
    return undefined
  }
}

/** Join block-level text into paragraphs, keeping `<br>` and `<p>` breaks. */
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION',
  'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI',
  'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
])

function collectText(node: Node, out: string[]): void {
  if (node.nodeType === 3) {
    out.push(node.nodeValue ?? '')
    return
  }
  if (node.nodeType !== 1) return
  const element = node as Element
  const tag = element.tagName.toUpperCase()
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME') return
  if (tag === 'BR') {
    out.push('\n')
    return
  }
  const block = BLOCK_TAGS.has(tag)
  if (block) out.push('\n')
  for (const child of element.childNodes) collectText(child, out)
  if (block) out.push('\n')
}

/** Extract a chapter element as one paragraph per line. */
export function elementText(element: Element): string {
  const parts: string[] = []
  collectText(element, parts)
  return parts.join('')
}

/** Site chrome that appears inside chapter bodies and never in the story. */
const NOISE_LINE = /(?:最新网址|一秒记住|请记住本站|手机阅读|加入书签|返回目录|本章未完|章节错误|求月票|推荐票|下载|看全文|https?:\/\/|www\.|笔趣阁)/i
const SITE_LINE = /(?:蚂蚁阅读|就爱文学|若雨中文|唐三中文|女生文学|文桑小说|蚂蚁文学)/

/** Turn raw chapter text into the reader's paragraph contract. */
export function cleanChapterText(raw: string, extraNoise: readonly RegExp[] = []): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(line => line !== '')
    .filter(line => !/^[\s\-—_=*·•~]+$/.test(line))
    .filter(line => !/^([\u4e00-\u9fa5])\1{2,}[。！？!?]?$/.test(line))
    .filter(line => !NOISE_LINE.test(line))
    .filter(line => !(SITE_LINE.test(line) && line.length <= 60))
    .filter(line => !extraNoise.some(pattern => pattern.test(line)))
    .join('\n')
    .trim()
}

/** Search side of a source: one URL template plus the result-row selectors. */
export interface SourceSearchSpec {
  readonly url: (query: string) => string
  readonly item: string
  readonly title: string
  readonly author: string
  /** Selector for the result's detail-page link. */
  readonly link: string
  readonly intro?: string
  readonly cover?: string
}

/** Detail-page selectors. */
export interface SourceBookSpec {
  readonly title: string
  readonly author: string
  readonly intro?: string
  readonly cover?: string
  readonly tocUrl?: string
}

/** Catalog selectors. */
export interface SourceTocSpec {
  readonly list: string
  readonly title?: string
  readonly url: string
}

/** Chapter-body selectors. */
export interface SourceChapterSpec {
  readonly content: string
  readonly title?: string
  readonly remove?: readonly string[]
}

/** Where a pasted source URL points. */
export interface SourceTarget {
  readonly kind: 'book' | 'chapter'
  /** Canonical detail-page URL. */
  readonly bookUrl: string
  /** Canonical chapter URL when a chapter page was pasted. */
  readonly chapterUrl?: string
}

/** One supported HTML site. */
export interface HtmlSource {
  readonly id: string
  readonly name: string
  readonly hosts: readonly string[]
  readonly search: SourceSearchSpec
  readonly book: SourceBookSpec
  readonly toc: SourceTocSpec
  readonly chapter: SourceChapterSpec
  readonly resolve: (url: URL) => SourceTarget | undefined
  readonly coverFor?: (bookUrl: string) => string | undefined
  /** Derive the catalog URL when the detail page does not link to it. */
  readonly tocFor?: (bookUrl: string) => string | undefined
  readonly noise?: readonly RegExp[]
}

/** Book metadata plus its complete catalog. */
export interface SourceBookPage {
  readonly title: string
  readonly author: string
  readonly description?: string | undefined
  readonly coverUrl?: string | undefined
  readonly tocUrl: string
  readonly detailUrl: string
  readonly detailHtml: string
  readonly chapters: ChapterRef[]
}

/** One search hit, already normalized and labeled with its source. */
export interface SourceSearchHit {
  readonly id: string
  readonly title: string
  readonly author: string
  readonly intro: string
  readonly url: string
  readonly coverUrl?: string | undefined
  readonly sourceId: string
  readonly sourceName: string
}

/** Numeric id used by three of the templates (`/book/5193.html`). */
function numericId(bookUrl: string): string | undefined {
  const match = /(\d+)(?:\.html?)?(?:\/)?$/.exec(new URL(bookUrl).pathname)
  return match?.[1]
}

/** Shared detail-page parser. */
function parseBook(source: HtmlSource, html: string, pageUrl: string): Omit<SourceBookPage, 'chapters'> {
  const document = new JSDOM(html).window.document
  const body = document.body ?? document.documentElement
  const title = read(body, source.book.title)
  const author = cleanAuthor(read(body, source.book.author)) || '佚名'
  const description = source.book.intro === undefined ? '' : cleanDescription(read(body, source.book.intro))
  const coverRaw = source.book.cover === undefined ? '' : read(body, source.book.cover)
  const coverUrl = resolveUrl(pageUrl, coverRaw) ?? source.coverFor?.(pageUrl)
  const tocRaw = source.book.tocUrl === undefined ? '' : read(body, source.book.tocUrl)
  const tocUrl = resolveUrl(pageUrl, tocRaw) ?? source.tocFor?.(pageUrl) ?? pageUrl
  return {
    title: title || '未命名书籍',
    author,
    ...description === '' ? {} : { description },
    ...coverUrl === undefined ? {} : { coverUrl },
    tocUrl,
    detailUrl: pageUrl,
    detailHtml: html,
  }
}

/** Parse the search page into labeled hits. */
export function parseSearchPage(source: HtmlSource, html: string, pageUrl: string): SourceSearchHit[] {
  const document = new JSDOM(html).window.document
  const body = document.body ?? document.documentElement
  let items: Element[] = []
  try {
    items = [...body.querySelectorAll(source.search.item)]
  } catch {
    return []
  }
  const hits: SourceSearchHit[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const title = read(item, source.search.title)
    const url = resolveUrl(pageUrl, read(item, source.search.link))
    if (title === '' || url === undefined || seen.has(url)) continue
    seen.add(url)
    const intro = source.search.intro === undefined ? '' : read(item, source.search.intro)
    const coverRaw = source.search.cover === undefined ? '' : read(item, source.search.cover)
    const coverUrl = resolveUrl(pageUrl, coverRaw) ?? source.coverFor?.(url)
    hits.push({
      id: url,
      title,
      author: cleanAuthor(read(item, source.search.author)) || '佚名',
      intro,
      url,
      ...coverUrl === undefined ? {} : { coverUrl },
      sourceId: source.id,
      sourceName: source.name,
    })
    if (hits.length >= 12) break
  }
  return hits
}

/** Parse a catalog page into stable chapter references, dropping repeats. */
export function parseTocPage(source: HtmlSource, html: string, pageUrl: string): ChapterRef[] {
  const document = new JSDOM(html).window.document
  const body = document.body ?? document.documentElement
  let links: Element[] = []
  try {
    if (source.id === '136book') {
      // The page puts the latest block before the first-chapter block.
      // Read the first block first, then the latest block, so previews start
      // at chapter one instead of the final chapter.
      const blocks = [...body.querySelectorAll('#book_detail ol')]
      links = blocks.length > 1
        ? [...blocks[blocks.length - 1]!.querySelectorAll('a'), ...blocks[0]!.querySelectorAll('a')]
        : [...body.querySelectorAll(source.toc.list)]
    } else {
      links = [...body.querySelectorAll(source.toc.list)]
    }
  } catch {
    return []
  }
  const parsed = links.map((link) => {
    const title = cleanText(source.toc.title === undefined ? link.textContent ?? '' : read(link, source.toc.title))
    const url = resolveUrl(pageUrl, source.toc.url === 'href' ? link.getAttribute('href') ?? '' : read(link, source.toc.url))
    if (title === '' || url === undefined || SKIP_TOC_TEXT.test(title)) return undefined
    // 136book mixes another title's bonus chapters into its first block.
    if (source.id === '136book' && !/^(?:第|序|引子|楔子|前言|后记|番外|正文)/u.test(title)) return undefined
    return { title, url }
  })
  // Templates often repeat the newest dozen chapters above the full catalog.
  // Keeping the last occurrence restores the true reading order.
  const lastIndex = new Map<string, number>()
  parsed.forEach((item, index) => {
    if (item !== undefined) lastIndex.set(item.url, index)
  })
  const chapters: ChapterRef[] = []
  parsed.forEach((item, index) => {
    if (item === undefined || lastIndex.get(item.url) !== index) return
    const url = canonicalUrl(item.url)
    chapters.push({ id: chapterId(url), title: item.title.slice(0, 160), url, index: chapters.length })
  })
  return chapters
}

/** Parse one chapter page into plain paragraphs. */
export function parseChapterPage(
  source: HtmlSource,
  html: string,
  pageUrl: string,
  fallbackTitle: string,
): { title: string; content: string } {
  const document = new JSDOM(html).window.document
  const body = document.body ?? document.documentElement
  let content: Element | null = null
  try {
    content = body.querySelector(source.chapter.content)
  } catch {
    content = null
  }
  if (content === null) throw new FetchError('no-content', '这一页没有找到正文', pageUrl)
  for (const selector of source.chapter.remove ?? []) {
    try {
      content.querySelectorAll(selector).forEach(node => node.remove())
    } catch {
      // A stale cleanup selector must not hide an otherwise readable chapter.
    }
  }
  const text = cleanChapterText(elementText(content), source.noise ?? [])
  if (text === '') throw new FetchError('no-content', '这一页的正文是空的', pageUrl)
  const titleElement = source.chapter.title === undefined ? null : content.querySelector(source.chapter.title)
  const title = cleanText(titleElement?.textContent ?? '') || fallbackTitle
  return { title, content: text }
}

const MAYITXT_ORIGIN = 'http://www.mayitxt.info'
const JIUAI_ORIGIN = 'http://www.92xs.info'
const RUOYU_ORIGIN = 'http://www.3yt.info'
const TANGSAN_ORIGIN = 'http://www.xtangsanshu.info'

/** The four verified sources, in display priority order. */
export const SOURCES: readonly HtmlSource[] = [
  {
    id: 'mayitxt',
    name: '蚂蚁阅读',
    hosts: ['www.mayitxt.info', 'mayitxt.info', 'www.mayitxt.org', 'mayitxt.org'],
    search: {
      // The site's own search form posts this fixed salt along with the query.
      url: query => `${MAYITXT_ORIGIN}/modules/article/search.php?q=${encodeURIComponent(query)}&searchtype=all&s=17333194950446968473`,
      item: 'table tr',
      title: 'a.red',
      author: 'td:nth-child(6) span',
      link: 'a.red@href',
    },
    book: {
      title: '#main_title h1',
      author: '.book_name .author',
      intro: '.breviary',
      cover: 'img[src*="/files/article/image/"]@src',
      tocUrl: 'a[href*="/showclist/"]@href',
    },
    toc: { list: '.float-list li a', url: 'href' },
    chapter: { content: '#ChapterContents' },
    coverFor: (bookUrl) => {
      const id = numericId(bookUrl)
      return id === undefined ? undefined : `${MAYITXT_ORIGIN}/files/article/image/${id[0]}/${id}/${id}s.jpg`
    },
    tocFor: (bookUrl) => {
      const id = numericId(bookUrl)
      return id === undefined ? undefined : `${MAYITXT_ORIGIN}/showclist/${id}.html`
    },
    resolve: (url) => {
      const chapter = /^\/chapter\/(\d+)\/(\d+)\.html$/.exec(url.pathname)
      if (chapter?.[1] !== undefined) {
        return {
          kind: 'chapter',
          bookUrl: `${MAYITXT_ORIGIN}/book/${chapter[1]}.html`,
          chapterUrl: `${MAYITXT_ORIGIN}${url.pathname}`,
        }
      }
      const book = /^\/(?:book|showclist)\/(\d+)\.html$/.exec(url.pathname)
      if (book?.[1] !== undefined) return { kind: 'book', bookUrl: `${MAYITXT_ORIGIN}/book/${book[1]}.html` }
      return undefined
    },
  },
  {
    id: 'jiuai',
    name: '就爱文学',
    hosts: ['www.92xs.info', '92xs.info'],
    search: {
      url: query => `${JIUAI_ORIGIN}/modules/article/search.php?searchkey=${encodeURIComponent(query)}&searchtype=articlename`,
      item: '#author tr',
      title: 'td:nth-child(1) a',
      author: 'td:nth-child(3)',
      link: 'td:nth-child(1) a@href',
    },
    book: {
      title: '.d_title h1',
      author: '.p_author',
      intro: '#bookintro > p',
      cover: 'meta[property="og:image"]@content',
    },
    toc: { list: '.ccss a', url: 'href' },
    chapter: { content: '#ccontent' },
    coverFor: (bookUrl) => {
      const id = numericId(bookUrl)
      return id === undefined ? undefined : `${JIUAI_ORIGIN}/files/article/image/${id[0]}/${id}/${id}s.jpg`
    },
    tocFor: (bookUrl) => {
      const id = numericId(bookUrl)
      return id === undefined ? undefined : `${JIUAI_ORIGIN}/html/${id}/`
    },
    resolve: (url) => {
      const chapter = /^\/html\/(\d+)\/\d+\.html$/.exec(url.pathname)
      if (chapter?.[1] !== undefined) {
        return {
          kind: 'chapter',
          bookUrl: `${JIUAI_ORIGIN}/book/${chapter[1]}.html`,
          chapterUrl: `${JIUAI_ORIGIN}${url.pathname}`,
        }
      }
      const book = /^\/book\/(\d+)\.html$/.exec(url.pathname)
      if (book?.[1] !== undefined) return { kind: 'book', bookUrl: `${JIUAI_ORIGIN}/book/${book[1]}.html` }
      return undefined
    },
  },
  {
    id: 'ruoyu',
    name: '若雨中文',
    hosts: ['www.3yt.info', '3yt.info', 'www.3yt.la', '3yt.la'],
    search: {
      url: query => `${RUOYU_ORIGIN}/book/search.aspx?searchkey=${encodeURIComponent(query)}&SeaButton=`,
      item: 'table tr',
      title: 'td:nth-child(2) a',
      author: 'td:nth-child(5) a',
      link: 'td:nth-child(2) a@href',
    },
    book: {
      title: '.w_530 em.f30',
      author: '.w_530 em.blue a',
      intro: '.h_260 p.mt10',
      cover: 'img[src*="BookCover"]@src',
      tocUrl: 'a[href*="/Html/Book/"]@href',
    },
    toc: { list: '#BookText li a', url: 'href' },
    chapter: { content: '#BookText', remove: ['#content_tip'] },
    coverFor: (bookUrl) => {
      const id = /\/Book\/(\d+)\/index\.html$/.exec(new URL(bookUrl).pathname)?.[1]
      return id === undefined ? undefined : `${RUOYU_ORIGIN}/DownFiles/Book/BookCover/${id}.gif`
    },
    resolve: (url) => {
      const chapter = /^\/Html\/Book\/(\d+)\/(\d+)\/[^/]+\.shtml$/.exec(url.pathname)
      if (chapter?.[1] !== undefined) {
        return {
          kind: 'chapter',
          bookUrl: `${RUOYU_ORIGIN}/Book/${chapter[2]}/index.html`,
          chapterUrl: `${RUOYU_ORIGIN}${url.pathname}`,
        }
      }
      const book = /^\/Book\/(\d+)\/(?:index\.html)?$/.exec(url.pathname)
      if (book?.[1] !== undefined) return { kind: 'book', bookUrl: `${RUOYU_ORIGIN}/Book/${book[1]}/index.html` }
      return undefined
    },
  },
  {
    id: 'tangsan',
    name: '唐三中文',
    hosts: ['www.xtangsanshu.info', 'xtangsanshu.info', 'www.xtangsanshu.com', 'xtangsanshu.com'],
    search: {
      url: query => `${TANGSAN_ORIGIN}/s.php?ie=utf-8&s=&q=${encodeURIComponent(query)}`,
      item: '.bookbox',
      title: '.bookname a',
      author: '.author',
      link: '.bookname a@href',
      intro: 'p',
      cover: 'img@src',
    },
    book: {
      title: '.info h2',
      author: '.small span',
      intro: '.intro',
      cover: 'img[src*="/files/article/image/"]@src',
    },
    toc: { list: '.listmain dl dd a', url: 'href' },
    chapter: { content: '#content' },
    resolve: (url) => {
      const chapter = /^\/([a-z0-9-]+)\/(\d+)\.html$/i.exec(url.pathname)
      if (chapter?.[1] !== undefined) {
        return {
          kind: 'chapter',
          bookUrl: `${TANGSAN_ORIGIN}/${chapter[1]}/`,
          chapterUrl: `${TANGSAN_ORIGIN}${url.pathname}`,
        }
      }
      const book = /^\/([a-z0-9-]+)\/?$/i.exec(url.pathname)
      if (book?.[1] !== undefined) return { kind: 'book', bookUrl: `${TANGSAN_ORIGIN}/${book[1]}/` }
      return undefined
    },
  },
  {
    id: '136book',
    name: '136书屋',
    hosts: ['www.136book.com', '136book.com'],
    search: {
      // 136book exposes an author-only form; title lookup is handled below by
      // its pinyin URL slug (e.g. /douluodalu/).
      url: query => `https://www.136book.com/search.php?searchtype=author&keyword=${encodeURIComponent(query)}`,
      item: 'table[width="95%"]',
      title: 'p strong a',
      author: 'p',
      link: 'p strong a@href',
      intro: 'td:last-child p:last-child',
      cover: 'img.pic1@src',
    },
    book: {
      title: 'h1',
      author: '.entry-title a',
      intro: '.entry-content',
      cover: 'img.book_thumb@src',
      tocUrl: '',
    },
    toc: { list: '#book_detail ol a', url: 'href' },
    chapter: { content: '#content', remove: ['#content a'] },
    tocFor: bookUrl => bookUrl,
    resolve: (url) => {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length === 1) {
        return { kind: 'book', bookUrl: `https://www.136book.com/${parts[0]}/` }
      }
      if (parts.length === 2) {
        return {
          kind: 'chapter',
          bookUrl: `https://www.136book.com/${parts[0]}/`,
          chapterUrl: `https://www.136book.com/${parts[0]}/${parts[1]}/`,
        }
      }
      return undefined
    },
    noise: [/一秒记住|最新网址|请记住本站|加入书签|推荐阅读|136书屋提示/],
  },
]

/** Find the adapter that owns a pasted URL. */
export function findSource(raw: string): HtmlSource | undefined {
  let host: string
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return undefined
  }
  return SOURCES.find(source => source.hosts.includes(host))
}

/** Resolve a pasted URL into the source's canonical book and chapter URLs. */
export function sourceTarget(source: HtmlSource, raw: string): SourceTarget | undefined {
  try {
    return source.resolve(new URL(raw))
  } catch {
    return undefined
  }
}

/** Fetch and parse the detail page plus the complete catalog. */
export async function loadSourceBook(
  source: HtmlSource,
  bookUrl: string,
  signal: AbortSignal,
): Promise<SourceBookPage> {
  const page = await fetchPageWithRetry(bookUrl, signal)
  const meta = parseBook(source, page.html, page.finalUrl)
  let tocHtml = page.html
  let tocBase = page.finalUrl
  if (meta.tocUrl !== page.finalUrl) {
    const tocPage = await fetchPageWithRetry(meta.tocUrl, signal)
    tocHtml = tocPage.html
    tocBase = tocPage.finalUrl
  }
  const chapters = parseTocPage(source, tocHtml, tocBase)
  if (chapters.length === 0) throw new FetchError('no-chapters', '这个站点没有返回目录', tocBase)
  return { ...meta, chapters }
}

/** Fetch and parse one chapter. */
export async function loadSourceChapter(
  source: HtmlSource,
  chapterUrl: string,
  signal: AbortSignal,
  fallbackTitle: string,
): Promise<{ title: string; content: string }> {
  const page = await fetchPageWithRetry(chapterUrl, signal)
  return parseChapterPage(source, page.html, page.finalUrl, fallbackTitle)
}

/** A source preview, before the Host adds its confidence rating. */
export interface SourcePreview {
  readonly title: string
  readonly author: string
  readonly description?: string | undefined
  readonly coverUrl?: string | undefined
  readonly detailUrl: string
  readonly tocUrl: string
  readonly chapters: ChapterRef[]
  readonly sample: string
  /** Whether the sample came from a real chapter rather than the synopsis. */
  readonly sampleFromChapter: boolean
}

/** Load detail, catalog, and a first-chapter sample in one pass. */
export async function loadSourcePreview(
  source: HtmlSource,
  target: SourceTarget,
  signal: AbortSignal,
): Promise<SourcePreview> {
  const page = await loadSourceBook(source, target.bookUrl, signal)
  let sample = page.description ?? ''
  let sampleFromChapter = false
  const first = target.chapterUrl ?? page.chapters[0]?.url
  if (first !== undefined) {
    const fallbackTitle = page.chapters.find(chapter => chapter.url === first)?.title ?? ''
    try {
      const chapter = await loadSourceChapter(source, first, signal, fallbackTitle)
      sample = chapter.content.slice(0, 300)
      sampleFromChapter = sample !== ''
    } catch (error: unknown) {
      if (signal.aborted) throw error
      // A missing first chapter should not throw away a complete catalog.
    }
  }
  return {
    title: page.title,
    author: page.author,
    ...page.description === undefined ? {} : { description: page.description },
    ...page.coverUrl === undefined ? {} : { coverUrl: page.coverUrl },
    detailUrl: page.detailUrl,
    tocUrl: page.tocUrl,
    chapters: page.chapters,
    sample: sample.slice(0, 300),
    sampleFromChapter,
  }
}

/** Resolve a 136book title to the site's pinyin URL slug. */
function bookSlug(query: string): string {
  return pinyin(query, { toneType: 'none', type: 'array' })
    .join('')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

/** 136book has no working title-search endpoint; probe its pinyin slug. */
async function search136book(
  source: HtmlSource,
  query: string,
  signal: AbortSignal,
): Promise<SourceSearchHit[]> {
  const slug = bookSlug(query)
  if (slug === '') return []
  const url = `https://www.136book.com/${slug}/`
  try {
    const page = await fetchPageWithRetry(url, signal)
    if (!page.html.includes('id="book_detail"')) return []
    const meta = parseBook(source, page.html, page.finalUrl)
    if (meta.title === '未命名书籍') return []
    return [{
      id: url,
      title: meta.title,
      author: meta.author,
      intro: meta.description ?? '',
      url,
      ...meta.coverUrl === undefined ? {} : { coverUrl: meta.coverUrl },
      sourceId: source.id,
      sourceName: source.name,
    }]
  } catch (error: unknown) {
    if (signal.aborted) throw error
    return []
  }
}

/** Fetch one source's search page and normalize its rows. */
export async function searchSource(
  source: HtmlSource,
  query: string,
  signal: AbortSignal,
): Promise<SourceSearchHit[]> {
  if (source.id === '136book') return search136book(source, query, signal)
  const page = await fetchPageWithRetry(source.search.url(query), signal)
  return parseSearchPage(source, page.html, page.finalUrl)
}

/** Search every source in parallel; a dead site never fails the whole search. */
export async function searchAllSources(
  query: string,
  signal: AbortSignal,
  disabled: ReadonlySet<string> = new Set(),
): Promise<SourceSearchHit[]> {
  const active = SOURCES.filter(source => !disabled.has(source.id))
  if (active.length === 0) return []
  const settled = await Promise.allSettled(active.map(async (source) => {
    const budget = AbortSignal.any([signal, AbortSignal.timeout(8_000)])
    return await searchSource(source, query, budget)
  }))
  if (signal.aborted) throw signal.reason
  return settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])
}
