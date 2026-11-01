/** Types shared by the Host parser and the Client reader. */

/** Same-origin route that searches the supported novel site. */
export const SEARCH_PATH = '/api/dsh-relax-reader/search'
export const EDITIONS_PATH = '/api/dsh-relax-reader/editions'
export const SETTINGS_PATH = '/api/dsh-relax-reader/settings'
export interface Book {
  id: string
  title: string
  author: string
  coverUrl?: string | undefined
  description?: string | undefined
  detailUrl: string
  tocUrl?: string | undefined
  sourceHost: string
  chapterCount: number
  createdAt: number
  updatedAt: number
  lastChapterId?: string | undefined
  lastChapterIndex?: number | undefined
  lastOffset?: number
}

export interface ChapterRef {
  id: string
  title: string
  url: string
  index: number
}

export interface ChapterContent {
  id: string
  title: string
  content: string
  prevId?: string | undefined
  nextId?: string | undefined
}

export interface ParsePreview {
  title: string
  author: string
  coverUrl?: string | undefined
  description?: string | undefined
  detailUrl: string
  tocUrl?: string | undefined
  sourceHost: string
  chapters: ChapterRef[]
  chapterCount: number
  sample: string
  confidence: 'high' | 'medium' | 'low'
}

/** Request to parse a user-supplied page URL. */
export interface ParseUrlRequest {
  url: string
}

/** Request to save a parsed preview to the bookshelf. */
export interface SaveBookRequest {
  preview: ParsePreview
}

/** Request addressed to one book. */
export interface BookIdRequest {
  bookId: string
}

/** Request addressed to one chapter. */
export interface ChapterRequest {
  bookId: string
  chapterId: string
}

/** Reading progress update. */
export interface ProgressRequest {
  bookId: string
  chapterId: string
  offset: number
}


/** One remote-site search hit shown before the user chooses a book. */
export interface SearchResult {
  id: string
  title: string
  author: string
  intro: string
  url: string
  coverUrl?: string | undefined
  /** Human-readable source label, e.g. `蚂蚁阅读` or `蚂蚁阅读 等 3 站`. */
  sourceName?: string | undefined
  /** Other book URLs that carry the same title and author. */
  alternates?: { url: string; sourceName?: string | undefined }[] | undefined
}

/** Search route response. */
export interface SearchResponse {
  query: string
  results: SearchResult[]
}

/** One source's update status for a book selected from search. */
export interface SourceEdition {
  sourceName: string
  url: string
  chapterCount?: number | undefined
  latestChapter?: string | undefined
  error?: string | undefined
}

/** Source aggregation route response. */
export interface EditionsResponse {
  editions: SourceEdition[]
}


/** One book source exposed by the settings page. */
export interface SourceOption {
  id: string
  name: string
  detail: string
}

/** Source preferences persisted by the Host. */
export interface ReaderSettings {
  disabledSources: string[]
}

/** Settings route response. */
export interface SettingsResponse {
  sources: (SourceOption & { enabled: boolean })[]
  disabledSources: string[]
}

/** The fixed source catalog shown in settings and used to validate writes. */
export const SOURCE_CATALOG: readonly SourceOption[] = [
  { id: 'bqg', name: '笔趣阁', detail: '主书库 · 目录与正文' },
  { id: 'mayitxt', name: '蚂蚁阅读', detail: '静态书库 · 搜索与完整目录' },
  { id: 'jiuai', name: '就爱文学', detail: '静态书库 · 搜索与完整目录' },
  { id: 'ruoyu', name: '若雨中文', detail: '静态书库 · 搜索与完整目录' },
  { id: 'tangsan', name: '唐三中文', detail: '静态书库 · 搜索与完整目录' },
  { id: '136book', name: '136书屋', detail: '静态书库 · 目录与正文' },
] as const
