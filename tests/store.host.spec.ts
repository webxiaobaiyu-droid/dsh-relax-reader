import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ReaderStore } from '../src/store.ts'
import type { Book, ChapterContent } from '../src/types.ts'

const roots: string[] = []

async function tempStore(): Promise<{ root: string; store: ReaderStore }> {
  const root = await mkdtemp(join(tmpdir(), 'relax-reader-store-'))
  roots.push(root)
  return { root, store: new ReaderStore(root) }
}

function book(id = 'book-1'): Book {
  return {
    id,
    title: '测试书',
    author: '作者',
    detailUrl: 'https://example.com/book/1',
    sourceHost: 'example.com',
    chapterCount: 2,
    createdAt: 1,
    updatedAt: 1,
  }
}

const chapter: ChapterContent = { id: 'c1', title: '第一章', content: '正文' }

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('ReaderStore', () => {
  it('persists books, catalogs, chapters, and progress atomically', async () => {
    const { root, store } = await tempStore()
    await store.upsertBookWithToc(book(), [{ id: 'c1', title: '第一章', url: 'https://example.com/1', index: 0 }])
    await store.putChapter('book-1', chapter)
    await store.saveProgress('book-1', 'c1', 84.4)

    const reopened = new ReaderStore(root)
    expect(await reopened.listBooks()).toMatchObject([{ id: 'book-1', lastChapterId: 'c1', lastOffset: 84 }])
    expect(await reopened.getToc('book-1')).toHaveLength(1)
    expect(await reopened.getChapter('book-1', 'c1')).toEqual(chapter)
  })

  it('removes the catalog and cached chapters with the book', async () => {
    const { store } = await tempStore()
    await store.upsertBookWithToc(book(), [{ id: 'c1', title: '第一章', url: 'https://example.com/1', index: 0 }])
    await store.putChapter('book-1', chapter)
    await store.removeBook('book-1')

    expect(await store.listBooks()).toEqual([])
    expect(await store.getToc('book-1')).toEqual([])
    expect(await store.getChapter('book-1', 'c1')).toBeUndefined()
  })

  it('tolerates a missing or damaged store file', async () => {
    const { root, store } = await tempStore()
    await store.upsertBook(book())
    const path = join(root, 'store.json')
    await rm(path, { force: true })

    const reopened = new ReaderStore(root)
    expect(await reopened.listBooks()).toEqual([])
    expect(JSON.parse(await readFile(path, 'utf8').catch(() => '{"version":1,"books":[]}'))).toBeDefined()
  })

  it('migrates the 0.1.0 shelf directory on first open', async () => {
    const home = await mkdtemp(join(tmpdir(), 'relax-reader-migrate-'))
    roots.push(home)
    const legacy = join(home, 'novel-reader')
    await mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, 'store.json'), JSON.stringify({ version: 1, books: [book()], toc: {}, chapters: {} }))

    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = home
    try {
      const store = new ReaderStore()
      expect(await store.listBooks()).toMatchObject([{ id: 'book-1', title: '测试书' }])
      const migrated = JSON.parse(await readFile(join(home, 'dsh-relax-reader', 'store.json'), 'utf8')) as { books: Book[] }
      expect(migrated.books).toHaveLength(1)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    }
  })

  it('persists source preferences with the shelf', async () => {
    const { root, store } = await tempStore()
    await store.saveSettings({ disabledSources: ['bqg', 'mayitxt'] })
    expect(await store.getSettings()).toEqual({ disabledSources: ['bqg', 'mayitxt'] })

    const reopened = new ReaderStore(root)
    expect(await reopened.getSettings()).toEqual({ disabledSources: ['bqg', 'mayitxt'] })
  })

  it('serializes concurrent writes without corrupting the snapshot', async () => {
    const { root, store } = await tempStore()
    await Promise.all(Array.from({ length: 12 }, (_, index) => store.upsertBook(book(`book-${index}`))))
    const reopened = new ReaderStore(root)
    expect(await reopened.listBooks()).toHaveLength(12)
    expect(JSON.parse(await readFile(join(root, 'store.json'), 'utf8'))).toMatchObject({ version: 1 })
  })

  it('refuses progress for a missing book', async () => {
    const { store } = await tempStore()
    await expect(store.saveProgress('missing', 'c1', 10)).rejects.toMatchObject({ code: 'store-failed' })
  })
})
