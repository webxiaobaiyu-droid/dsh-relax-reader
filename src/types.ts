/** Types shared by the Host parser and the Client reader. */

/** Same-origin route that searches the supported novel site. */
export const SEARCH_PATH = '/api/dsh-relax-reader/search'
export const EDITIONS_PATH = '/api/dsh-relax-reader/editions'
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
