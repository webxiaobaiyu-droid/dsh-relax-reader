/**
 * Generic, site-agnostic parser for static Chinese novel pages.
 *
 * The parser deliberately works from a small set of structural signals rather
 * than a hard-coded site list: metadata tags, heading hierarchy, link clusters,
 * and text density. Site-specific rules can later be layered on top without
 * changing the page model.
 */
import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { FetchError } from './errors.ts'
import type { ChapterContent, ChapterRef, ParsePreview } from './types.ts'

const TOC_SELECTORS = [
  '#list a',
  '.listmain a',
  '.chapter-list a',
  '.chapterlist a',
  '.chapterList a',
  '.book-chapter a',
  '.directory a',
  'ul.chapter a',
  '#chapterlist a',
  '.read-list a',
  '.section-list a',
  '.booklist a',
  '.volume a',
  '.catalog a',
]

const CONTENT_SELECTORS = [
  '#content',
  '#chaptercontent',
  '#chapterContent',
  '.read-content',
  '.chapter-content',
  '.chapterContent',
  '.article-content',
  '.txt',
  '.content',
  'article',
]

const BOOK_TITLE_SELECTORS = [
  'h1',
  '.bookname h1',
  '.book-name h1',
  '.book-title',
  '.bookinfo h1',
  '#info h1',
  '.info h1',
]

const CHAPTER_TITLE_SELECTORS = [
  '.chapter-title',
  '.chapterTitle',
  '.bookname h1',
  '#chaptercontent h1',
  '.read-content h1',
  '.article-content h1',
  'h1',
  '.title',
]

const AUTHOR_SELECTORS = [
  '.author',
  '.book-author',
  '.bookinfo .author',
  '#info p',
  '.book-info .author',
  '.info .author',
]

const COVER_SELECTORS = [
  '.book-cover img',
  '#fmimg img',
  '.cover img',
  'img.cover',
  '.book-img img',
  '.bookimg img',
]

const DESCRIPTION_SELECTORS = [
  '#intro',
  '.intro',
  '.book-intro',
  '.book-intro p',
  '.desc',
  '.description',
  '.book-desc',
  '#bookIntro',
]

const TOC_LINK_TEXT = /(?:目录|章节列表|章节目录|全部章节|查看目录|返回目录|回目录|目录页|章节目录页)/
const CHAPTER_TITLE_PATTERN = /(?:第\s*[零一二三四五六七八九十百千万两0-9０-９]+\s*[章节回卷篇]|^\s*(?:序章|楔子|尾声|后记|番外))/i
const SKIP_LINK_TEXT = /^(?:上一页|下一页|首页|尾页|目录|加入书签|推荐|排行|登录|注册|返回|展开|收起|查看更多|上一章|下一章|开始阅读|点击阅读|更多)$/
const BOILERPLATE = /(?:本章未完|请记住本站|最快更新|加入书签|返回目录|章节错误|求月票|推荐票|手机阅读|笔趣阁|顶点小说|新笔阁|一秒记住|免费阅读|无弹窗|www\.|https?:\/\/|请收藏本站)/i
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION',
  'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR',
  'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
])

/** One parsed page. */
export interface ParsedPage {
  kind: 'book' | 'chapter'
  preview?: ParsePreview
  chapter?: ChapterContent
}

/** A chapter page plus the context needed to turn it into a book. */
export interface ParsedChapterPage {
  chapter: ChapterContent
  tocUrl?: string | undefined
  title: string
  author: string
  coverUrl?: string | undefined
  description?: string | undefined
  sourceHost: string
}

/** Stable chapter id derived from its canonical URL. */
export function chapterId(url: string): string {
  return createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 16)
}

/** Book id derived from its canonical detail URL. */
export function bookId(url: string): string {
  return createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 16)
}

/** Normalize a URL before hashing so trailing slashes and fragments do not fork identities. */
export function canonicalUrl(raw: string): string {
  const url = new URL(raw)
  const hashRoute = (url.hostname === 'www.bqg539.xyz' || url.hostname === 'bqg539.xyz')
    && url.hash.startsWith('#/book/')
  if (!hashRoute) url.hash = ''
  url.username = ''
  url.password = ''
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
  return url.href
}

/** Collapse normal whitespace without touching paragraph structure. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Read the first non-empty text of the first matching selector. */
function pickText(doc: Document, selectors: readonly string[]): string {
  for (const selector of selectors) {
    for (const element of doc.querySelectorAll(selector)) {
      const text = oneLine(element.textContent ?? '')
      if (text !== '') return text
    }
  }
  return ''
}

/** Escape a value used inside a quoted attribute selector. */
function attributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Read a meta tag by property, name, or itemprop. */
function meta(doc: Document, keys: readonly string[]): string {
  for (const key of keys) {
    const escaped = attributeValue(key)
    for (const element of doc.querySelectorAll(
      `meta[property="${escaped}"], meta[name="${escaped}"], meta[itemprop="${escaped}"]`,
    )) {
      const content = oneLine(element.getAttribute('content') ?? element.getAttribute('value') ?? '')
      if (content !== '') return content
    }
  }
  return ''
}

/** Read the first non-empty attribute of the first matching selector. */
function pickAttr(doc: Document, selectors: readonly string[], attribute: string): string {
  for (const selector of selectors) {
    for (const element of doc.querySelectorAll(selector)) {
      const value = oneLine(element.getAttribute(attribute) ?? '')
      if (value !== '') return value
    }
  }
  return ''
}

/** Resolve a relative URL, refusing executable and non-web schemes. */
function absolute(href: string | null | undefined, base: string): string | undefined {
  if (href === null || href === undefined) return undefined
  const value = href.trim()
  if (value === '' || value.startsWith('javascript:') || value.startsWith('data:')) return undefined
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return canonicalUrl(url.href)
  } catch {
    return undefined
  }
}

/** Remove common site/chapter suffixes from a document title. */
function cleanDocumentTitle(raw: string): string {
  const cleaned = oneLine(raw)
    .replace(/[（(]?(?:最新章节|全文阅读|无弹窗|免费阅读|txt下载|TXT下载)[）)]?/g, '')
    .replace(/\s*[-_|—–]\s*(?:最新章节|全文阅读|无弹窗|免费阅读|笔趣阁|顶点小说|新笔阁|小说阅读网|小说吧).*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = cleaned.split(/\s*[_|—–]\s*|\s+-\s+/).map(oneLine).filter(Boolean)
  if (parts.length > 1) {
    const meaningful = parts.find(part => !/^(?:最新章节|全文阅读|无弹窗|免费阅读|txt下载)$/i.test(part)
      && !/小说网|小说阅读|书城|中文网|网$/.test(part))
    if (meaningful !== undefined) return meaningful
  }
  return cleaned
}

/** Derive a plausible book title from a chapter-page document title. */
function bookTitleFromChapterTitle(raw: string): string {
  const cleaned = oneLine(raw)
  const parts = cleaned.split(/\s*[_|—–]\s*|\s+-\s+/).map(oneLine).filter(Boolean)
  const candidate = parts.find((part, index) => index > 0 || !CHAPTER_TITLE_PATTERN.test(part))
  return candidate === undefined ? '' : cleanDocumentTitle(candidate)
}

/** Clean an author string. */
function cleanAuthor(raw: string): string {
  return oneLine(raw)
    .replace(/^作\s*者[：:]\s*/, '')
    .replace(/^作者\s+/, '')
    .slice(0, 80)
}

/** Clean a synopsis. */
function cleanDescription(raw: string): string {
  return oneLine(raw).replace(/^简\s*介[：:]\s*/, '')
    .replace(/\s*[0-9a-z]{2,}-\d+\s*$/i, '').slice(0, 1200)
}

/** Title for a chapter, preferring the article heading over the site title. */
function chapterTitle(doc: Document): string {
  const heading = pickText(doc, CHAPTER_TITLE_SELECTORS)
  const title = heading !== '' ? heading : cleanDocumentTitle(doc.title)
  return (title !== '' ? title : '未命名章节').slice(0, 160)
}

/** Build a chapter list from whichever link cluster looks most like a TOC. */
function extractChapters(doc: Document, baseUrl: string): ChapterRef[] {
  const page = canonicalUrl(baseUrl)
  let best: ChapterRef[] = []
  let bestScore = -1
  for (const selector of TOC_SELECTORS) {
    const seen = new Set<string>()
    const chapters: ChapterRef[] = []
    let sameOrigin = 0
    for (const anchor of doc.querySelectorAll<HTMLAnchorElement>(selector)) {
      const title = oneLine(anchor.textContent ?? '')
      if (title === '' || title.length > 160 || SKIP_LINK_TEXT.test(title)) continue
      const url = absolute(anchor.getAttribute('href'), baseUrl)
      if (url === undefined || url === page || seen.has(url)) continue
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) sameOrigin += 1
      } catch {
        continue
      }
      seen.add(url)
      chapters.push({ id: chapterId(url), title, url, index: chapters.length })
      if (chapters.length >= 5000) break
    }
    if (chapters.length === 0) continue
    const score = chapters.length + Math.floor((sameOrigin / chapters.length) * 4)
    if (score > bestScore) {
      best = chapters
      bestScore = score
    }
  }
  return best
}

/** Find the table-of-contents link on a detail or chapter page. */
function findTocUrl(doc: Document, baseUrl: string): string | undefined {
  const page = canonicalUrl(baseUrl)
  const anchors = [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')]
  const candidates: Array<{ url: string; rank: number }> = []
  for (const anchor of anchors) {
    const url = absolute(anchor.getAttribute('href'), baseUrl)
    if (url === undefined || url === page) continue
    const text = oneLine(anchor.textContent ?? '')
    const href = anchor.getAttribute('href') ?? ''
    let rank = 0
    if (TOC_LINK_TEXT.test(text)) rank += 10
    if (/目录|chapterlist|catalog/i.test(href)) rank += 5
    if (/\/(?:list|index|chapters?)\b/i.test(href)) rank += 3
    if (rank > 0) candidates.push({ url, rank })
  }
  candidates.sort((left, right) => right.rank - left.rank)
  return candidates[0]?.url
}

/** Find a previous/next chapter link by structural hint or link text. */
function findNavLink(doc: Document, baseUrl: string, direction: 'prev' | 'next'): string | undefined {
  const selectors = direction === 'prev'
    ? ['a[rel="prev"]', '#prev_url', '#prevUrl', '.prev', '.prev-chapter', '.prevChapter', 'a[href*="prev"]']
    : ['a[rel="next"]', '#next_url', '#nextUrl', '.next', '.next-chapter', '.nextChapter', 'a[href*="next"]']
  const textPattern = direction === 'prev' ? /上一[章节页篇回]/ : /下一[章节页篇回]/
  for (const selector of selectors) {
    for (const anchor of doc.querySelectorAll<HTMLAnchorElement>(selector)) {
      const url = absolute(anchor.getAttribute('href'), baseUrl)
      if (url !== undefined) return url
    }
  }
  for (const anchor of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const text = oneLine(anchor.textContent ?? '')
    if (!textPattern.test(text)) continue
    const url = absolute(anchor.getAttribute('href'), baseUrl)
    if (url !== undefined) return url
  }
  return undefined
}

/** Convert a DOM subtree into readable paragraphs, preserving block boundaries. */
function normalizeContent(element: Element): string {
  const clone = element.cloneNode(true) as Element
  for (const node of clone.querySelectorAll(
    'script, style, noscript, iframe, ins, nav, header, footer, aside, form, button, select, textarea, h1, '
    + '.ads, .ad, .advert, .advertisement, [id*="ad-"], [class*="advert"]',
  )) {
    node.remove()
  }
  const pieces: string[] = []
  const appendBreak = (count = 1): void => {
    pieces.push('\n'.repeat(count))
  }
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      pieces.push((node.textContent ?? '').replace(/\u00a0/g, ' '))
      return
    }
    if (node.nodeType !== 1) return
    const tag = (node as Element).tagName
    if (tag === 'BR') {
      appendBreak()
      return
    }
    const block = BLOCK_TAGS.has(tag)
    if (block) appendBreak(1)
    for (const child of node.childNodes) walk(child)
    if (block) appendBreak(2)
  }
  walk(clone)

  return pieces.join('')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .filter(line => !(line.length <= 180 && BOILERPLATE.test(line)))
    .filter(line => !/^(?:www\.[^\s]+|https?:\/\/\S+|[^\s@]+@[^\s@]+\.[^\s@]+)$/i.test(line))
    .join('\n\n')
    .trim()
}

/** Score a candidate body by text volume discounted for link-heavy navigation. */
function contentScore(element: Element): number {
  const text = normalizeContent(element)
  if (text.length < 40) return -1
  let linkText = 0
  for (const link of element.querySelectorAll('a')) linkText += oneLine(link.textContent ?? '').length
  return text.length - linkText * 1.5
}

/** Extract the most plausible body, recording whether a known body selector matched. */
function extractContent(doc: Document): { text: string; matched: boolean } {
  let best = ''
  let bestScore = -1
  let matched = false
  for (const selector of CONTENT_SELECTORS) {
    for (const element of doc.querySelectorAll(selector)) {
      matched = true
      const score = contentScore(element)
      if (score > bestScore) {
        best = normalizeContent(element)
        bestScore = score
      }
    }
  }
  if (best.length >= 40) return { text: best, matched }

  // No known container: strip chrome from the body and take the remaining text.
  const body = doc.body
  if (body !== null) {
    const fallback = normalizeContent(body)
    if (fallback.length >= 80) return { text: fallback, matched: false }
  }
  return { text: '', matched: false }
}

/** Read common book metadata from any page that may be a chapter. */
function bookMeta(doc: Document, pageUrl: string): {
  title: string
  author: string
  coverUrl?: string | undefined
  description?: string | undefined
  sourceHost: string
} {
  const metaTitle = meta(doc, ['og:novel:book_name', 'book:title', 'novel:book_name'])
  const heading = pickText(doc, BOOK_TITLE_SELECTORS)
  const documentTitle = cleanDocumentTitle(doc.title)
  const fallbackTitle = heading !== '' && !CHAPTER_TITLE_PATTERN.test(heading)
    ? heading
    : documentTitle !== '' ? bookTitleFromChapterTitle(doc.title) : ''
  const title = (metaTitle || fallbackTitle || documentTitle || '未命名书籍').slice(0, 160)
  const author = cleanAuthor(
    meta(doc, ['og:novel:author', 'book:author', 'author', 'novel:author']) || pickText(doc, AUTHOR_SELECTORS),
  ) || (() => {
    const match = /作\s*者[：:]\s*([^\s|/]{1,40})/.exec(doc.body?.textContent?.slice(0, 4000) ?? '')
    return match?.[1] ?? ''
  })()
  const description = cleanDescription(
    meta(doc, ['og:description', 'description', 'twitter:description']) || pickText(doc, DESCRIPTION_SELECTORS),
  )
  const coverUrl = absolute(
    meta(doc, ['og:image', 'twitter:image']) || pickAttr(doc, COVER_SELECTORS, 'src')
      || pickAttr(doc, COVER_SELECTORS, 'data-src'),
    pageUrl,
  )
  return {
    title,
    author: author || '佚名',
    coverUrl,
    description: description || undefined,
    sourceHost: new URL(pageUrl).host,
  }
}

/** Classify strong chapter evidence before trusting an incidental link cluster. */
function looksLikeChapter(doc: Document, content: string, matched: boolean, prevUrl?: string, nextUrl?: string): boolean {
  if (content.length < 40) return false
  const heading = pickText(doc, CHAPTER_TITLE_SELECTORS)
  const titled = CHAPTER_TITLE_PATTERN.test(heading) || CHAPTER_TITLE_PATTERN.test(cleanDocumentTitle(doc.title))
  const navigable = prevUrl !== undefined || nextUrl !== undefined
  if (navigable && (matched || titled)) return true
  return matched && titled
}

/**
 * Parse a book detail page, catalog page, or chapter page.
 */
export function parsePage(html: string, pageUrl: string, sample?: string): ParsedPage {
  const dom = new JSDOM(html, { url: pageUrl })
  const doc = dom.window.document
  const chapters = extractChapters(doc, pageUrl)
  const { text: content, matched } = extractContent(doc)
  const prevUrl = findNavLink(doc, pageUrl, 'prev')
  const nextUrl = findNavLink(doc, pageUrl, 'next')

  if (looksLikeChapter(doc, content, matched, prevUrl, nextUrl)) {
    return {
      kind: 'chapter',
      chapter: {
        id: chapterId(pageUrl),
        title: chapterTitle(doc),
        content,
        prevId: prevUrl === undefined ? undefined : chapterId(prevUrl),
        nextId: nextUrl === undefined ? undefined : chapterId(nextUrl),
      },
    }
  }

  if (chapters.length >= 1) {
    const metadata = bookMeta(doc, pageUrl)
    const description = metadata.description
    const preview: ParsePreview = {
      title: metadata.title,
      author: metadata.author,
      coverUrl: metadata.coverUrl,
      description,
      detailUrl: canonicalUrl(pageUrl),
      tocUrl: findTocUrl(doc, pageUrl),
      sourceHost: metadata.sourceHost,
      chapters,
      chapterCount: chapters.length,
      sample: (sample ?? description ?? content).slice(0, 300),
      confidence: chapters.length >= 3 ? 'medium' : 'low',
    }
    return { kind: 'book', preview }
  }

  throw new FetchError('unsupported-page', '没有识别到书籍或章节结构', pageUrl)
}

/** Extract a table of contents from a dedicated catalog page. */
export function parseTocPage(html: string, pageUrl: string): ChapterRef[] {
  const dom = new JSDOM(html, { url: pageUrl })
  const chapters = extractChapters(dom.window.document, pageUrl)
  if (chapters.length === 0) throw new FetchError('no-chapters', '没有找到章节目录', pageUrl)
  return chapters
}

/** Parse a chapter page and return its catalog link plus book-level metadata. */
export function parseChapterPage(html: string, pageUrl: string): ParsedChapterPage {
  const dom = new JSDOM(html, { url: pageUrl })
  const doc = dom.window.document
  const { text: content } = extractContent(doc)
  if (content.length < 40) throw new FetchError('no-content', '没有找到正文内容', pageUrl)
  const metadata = bookMeta(doc, pageUrl)
  const tocUrl = findTocUrl(doc, pageUrl)
  const previous = findNavLink(doc, pageUrl, 'prev')
  const following = findNavLink(doc, pageUrl, 'next')
  return {
    chapter: {
      id: chapterId(pageUrl),
      title: chapterTitle(doc),
      content,
      prevId: previous === undefined ? undefined : chapterId(previous),
      nextId: following === undefined ? undefined : chapterId(following),
    },
    tocUrl,
    title: metadata.title,
    author: metadata.author,
    coverUrl: metadata.coverUrl,
    description: metadata.description,
    sourceHost: metadata.sourceHost,
  }
}
