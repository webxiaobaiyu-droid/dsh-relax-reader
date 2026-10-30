/**
 * JSON-backed bookshelf and chapter cache.
 *
 * One materialized snapshot lives in memory; every mutation is persisted with a
 * temp-file + rename pair, and writes are serialized so a slow earlier write can
 * never overwrite a newer one. Chapter bodies stay out of session events and
 * model-visible context by construction: this is the only place they are kept.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { FetchError } from './errors.ts'
import type { Book, ChapterContent, ChapterRef, ReaderSettings } from './types.ts'

interface StoreData {
  version: 1
  books: Book[]
  toc: Record<string, ChapterRef[]>
  chapters: Record<string, Record<string, ChapterContent>>
  settings?: ReaderSettings | undefined
}

/** Resolve DSH's per-user data root. */
export function resolveDataRoot(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const configured = env.DSH_HOME?.trim()
  return configured === undefined || configured === '' ? join(home, '.dsh') : configured
}

function emptyData(): StoreData {
  return { version: 1, books: [], toc: {}, chapters: {}, settings: { disabledSources: [] } }
}

/** Keep only stable source ids from a hand-edited settings block. */
function sanitizeSettings(value: unknown): ReaderSettings {
  if (typeof value !== 'object' || value === null) return { disabledSources: [] }
  const disabled = (value as { disabledSources?: unknown }).disabledSources
  if (!Array.isArray(disabled)) return { disabledSources: [] }
  return {
    disabledSources: [...new Set(disabled.filter((id): id is string => typeof id === 'string' && id.trim() !== ''))],
  }
}

/** Validate a full snapshot before it reaches memory or disk. */
function parseStore(raw: string): StoreData {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || (parsed as { version?: unknown }).version !== 1) {
    return emptyData()
  }
  const record = parsed as Partial<StoreData>
  return {
    version: 1,
    books: sanitizeBooks(record.books),
    toc: sanitizeToc(record.toc),
    chapters: sanitizeChapters(record.chapters),
    settings: sanitizeSettings(record.settings),
  }
}

/** Keep only records whose required fields survive a hand-edited file. */
function sanitizeBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) return []
  const books: Book[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const book = item as Partial<Book>
    if (
      typeof book.id !== 'string' || typeof book.title !== 'string'
      || typeof book.author !== 'string' || typeof book.detailUrl !== 'string'
      || typeof book.sourceHost !== 'string' || typeof book.chapterCount !== 'number'
      || typeof book.createdAt !== 'number' || typeof book.updatedAt !== 'number'
    ) continue
    books.push({
      id: book.id,
      title: book.title,
      author: book.author,
      ...typeof book.coverUrl === 'string' ? { coverUrl: book.coverUrl } : {},
      ...typeof book.description === 'string' ? { description: book.description } : {},
      detailUrl: book.detailUrl,
      ...typeof book.tocUrl === 'string' ? { tocUrl: book.tocUrl } : {},
      sourceHost: book.sourceHost,
      chapterCount: book.chapterCount,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      ...typeof book.lastChapterId === 'string' ? { lastChapterId: book.lastChapterId } : {},
      ...typeof book.lastOffset === 'number' ? { lastOffset: book.lastOffset } : {},
    })
  }
  return books
}

function sanitizeToc(value: unknown): Record<string, ChapterRef[]> {
  if (typeof value !== 'object' || value === null) return {}
  const toc: Record<string, ChapterRef[]> = {}
  for (const [key, list] of Object.entries(value)) {
    if (!Array.isArray(list)) continue
    toc[key] = list.filter((item): item is ChapterRef => {
      if (typeof item !== 'object' || item === null) return false
      const chapter = item as Partial<ChapterRef>
      return typeof chapter.id === 'string' && typeof chapter.title === 'string'
        && typeof chapter.url === 'string' && typeof chapter.index === 'number'
    })
  }
  return toc
}

function sanitizeChapters(value: unknown): Record<string, Record<string, ChapterContent>> {
  if (typeof value !== 'object' || value === null) return {}
  const chapters: Record<string, Record<string, ChapterContent>> = {}
  for (const [bookId, bucket] of Object.entries(value)) {
    if (typeof bucket !== 'object' || bucket === null) continue
    const clean: Record<string, ChapterContent> = {}
    for (const [chapterId, item] of Object.entries(bucket)) {
      if (typeof item !== 'object' || item === null) continue
      const chapter = item as Partial<ChapterContent>
      if (typeof chapter.id !== 'string' || typeof chapter.title !== 'string' || typeof chapter.content !== 'string') continue
      clean[chapterId] = {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        ...typeof chapter.prevId === 'string' ? { prevId: chapter.prevId } : {},
        ...typeof chapter.nextId === 'string' ? { nextId: chapter.nextId } : {},
      }
    }
    chapters[bookId] = clean
  }
  return chapters
}

/** Deep clone a JSON-shaped record. */
function clone<T>(value: T): T {
  return structuredClone(value)
}

/** Persistent bookshelf scoped to the current DSH home. */
export class ReaderStore {
  readonly path: string
  private readonly legacyPath: string | undefined
  private data: StoreData | undefined
  private loading: Promise<StoreData> | undefined
  private writeChain: Promise<void> = Promise.resolve()

  constructor(root?: string) {
    const target = root ?? join(resolveDataRoot(), 'dsh-relax-reader')
    this.path = join(target, 'store.json')
    this.legacyPath = root === undefined ? join(resolveDataRoot(), 'novel-reader', 'store.json') : undefined
  }

  private async load(): Promise<StoreData> {
    if (this.data !== undefined) return this.data
    if (this.loading === undefined) {
      this.loading = (async (): Promise<StoreData> => {
        try {
          return parseStore(await readFile(this.path, 'utf8'))
        } catch {
          if (this.legacyPath === undefined) return emptyData()
          // Pre-rename builds stored the shelf under `novel-reader`; move it once.
          try {
            const data = parseStore(await readFile(this.legacyPath, 'utf8'))
            try {
              await this.writeSnapshot(data)
            } catch {
              // Reading still works if the migrated copy cannot be written.
            }
            return data
          } catch {
            return emptyData()
          }
        }
      })()
    }
    const pending = this.loading
    const data = await pending
    this.data = data
    if (this.loading === pending) this.loading = undefined
    return data
  }

  /** Write one materialized snapshot with a temp-file + rename pair. */
  private async writeSnapshot(data: StoreData): Promise<void> {
    const body = JSON.stringify(data)
    try {
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await writeFile(temporary, body, { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.path)
    } catch (error) {
      throw new FetchError('store-failed', '保存书架失败', this.path, { cause: error })
    }
  }

  /** Queue one atomic snapshot write. */
  private persist(): Promise<void> {
    const write = async (): Promise<void> => {
      const data = await this.load()
      await this.writeSnapshot(data)
    }
    const next = this.writeChain.then(write, write)
    this.writeChain = next.catch(() => {})
    return next
  }

  /** Persisted search-source preferences. */
  async getSettings(): Promise<ReaderSettings> {
    const data = await this.load()
    return clone(data.settings ?? { disabledSources: [] })
  }

  /** Replace search-source preferences in the same durable snapshot. */
  async saveSettings(settings: ReaderSettings): Promise<void> {
    const data = await this.load()
    data.settings = sanitizeSettings(settings)
    await this.persist()
  }

  /** All books, most recently updated first. */
  async listBooks(): Promise<Book[]> {
    const data = await this.load()
    return clone([...data.books].sort((left, right) => right.updatedAt - left.updatedAt))
  }

  /** Read one book. */
  async getBook(id: string): Promise<Book | undefined> {
    const data = await this.load()
    const book = data.books.find(item => item.id === id)
    return book === undefined ? undefined : clone(book)
  }

  /** Insert or replace a book. */
  async upsertBook(book: Book): Promise<void> {
    const data = await this.load()
    const index = data.books.findIndex(item => item.id === book.id)
    if (index === -1) data.books.push(clone(book))
    else data.books[index] = clone(book)
    await this.persist()
  }

  /** Insert or replace a book and its catalog in one atomic snapshot. */
  async upsertBookWithToc(book: Book, chapters: ChapterRef[]): Promise<void> {
    const data = await this.load()
    const index = data.books.findIndex(item => item.id === book.id)
    if (index === -1) data.books.push(clone(book))
    else data.books[index] = clone(book)
    data.toc[book.id] = clone(chapters)
    await this.persist()
  }

  /** Remove a book and every cached artifact belonging to it. */
  async removeBook(id: string): Promise<void> {
    const data = await this.load()
    data.books = data.books.filter(book => book.id !== id)
    delete data.toc[id]
    delete data.chapters[id]
    await this.persist()
  }

  /** Cached table of contents. */
  async getToc(id: string): Promise<ChapterRef[]> {
    const data = await this.load()
    return clone(data.toc[id] ?? [])
  }

  /** Replace the table of contents for a book. */
  async setToc(id: string, chapters: ChapterRef[]): Promise<void> {
    const data = await this.load()
    data.toc[id] = clone(chapters)
    await this.persist()
  }

  /** Cached chapter body. */
  async getChapter(bookId: string, id: string): Promise<ChapterContent | undefined> {
    const data = await this.load()
    const chapter = data.chapters[bookId]?.[id]
    return chapter === undefined ? undefined : clone(chapter)
  }

  /** Cache a chapter body. */
  async putChapter(bookId: string, chapter: ChapterContent): Promise<void> {
    const data = await this.load()
    const bucket = data.chapters[bookId] ?? {}
    bucket[chapter.id] = clone(chapter)
    data.chapters[bookId] = bucket
    await this.persist()
  }

  /** Persist reading progress (chapter and pixel offset). */
  async saveProgress(bookId: string, chapterIdValue: string, offset: number): Promise<void> {
    const data = await this.load()
    const book = data.books.find(item => item.id === bookId)
    if (book === undefined) throw new FetchError('store-failed', '书架里没有这本书', bookId)
    book.lastChapterId = chapterIdValue
    book.lastOffset = Math.max(0, Math.round(Number.isFinite(offset) ? offset : 0))
    book.updatedAt = Date.now()
    await this.persist()
  }
}
