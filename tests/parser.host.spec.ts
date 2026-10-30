import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  bookId,
  canonicalUrl,
  chapterId,
  parseChapterPage,
  parsePage,
  parseTocPage,
} from '../src/parser.ts'

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

describe('parsePage', () => {
  it('extracts book metadata, cover, and an ordered catalog', () => {
    const parsed = parsePage(fixture('book.html'), 'https://example.com/book/1/')

    expect(parsed.kind).toBe('book')
    expect(parsed.preview).toMatchObject({
      title: '测试小说',
      author: '测试作者',
      chapterCount: 3,
      sourceHost: 'example.com',
      confidence: 'medium',
    })
    expect(parsed.preview?.chapters.map(chapter => chapter.title)).toEqual([
      '第一章 开始',
      '第二章 继续',
      '第三章 结束',
    ])
    expect(parsed.preview?.chapters[1]?.url).toBe('https://example.com/book/1/2.html')
    expect(parsed.preview?.coverUrl).toBe('https://example.com/cover.jpg')
  })

  it('extracts clean chapter text and adjacent ids', () => {
    const parsed = parsePage(fixture('chapter.html'), 'https://example.com/book/1/1.html')

    expect(parsed.kind).toBe('chapter')
    expect(parsed.chapter?.title).toBe('第一章 开始')
    expect(parsed.chapter?.content).toContain('第一段内容')
    expect(parsed.chapter?.content).toContain('第三段内容')
    expect(parsed.chapter?.content).not.toContain('请记住本站')
    expect(parsed.chapter?.prevId).toBe(chapterId('https://example.com/book/1/0.html'))
    expect(parsed.chapter?.nextId).toBe(chapterId('https://example.com/book/1/2.html'))
  })

  it('preserves paragraph boundaries inside p and div blocks', () => {
    const parsed = parsePage(fixture('chapter-paragraphs.html'), 'https://example.com/book/1/7.html')
    const content = parsed.chapter?.content ?? ''

    expect(content.split('\n\n')).toHaveLength(5)
    expect(content).toContain('第一段有完整的一句话。\n\n第二段紧跟着第一段')
    expect(content).toContain('第三段藏在 div 里。\n\n换行之后还是第三段。')
    expect(content).not.toContain('请记住本站')
  })

  it('does not mistake a recommendation list for the catalog of a chapter', () => {
    const parsed = parsePage(fixture('noisy-chapter.html'), 'https://example.com/book/2/3.html')

    expect(parsed.kind).toBe('chapter')
    expect(parsed.chapter?.title).toBe('第3章 夜航')
    expect(parsed.chapter?.content).toContain('船在雾里走')
  })

  it('accepts a clearly titled short chapter without navigation', () => {
    const html = '<html><body><h1>第9章 短页</h1><div id="content"><p>这一段虽然短，但标题和正文容器都很明确，应该被识别成章节。</p><p>第二段补足长度，让正文提取不会落到导航区域。</p></div></body></html>'
    const parsed = parsePage(html, 'https://example.com/book/3/9.html')
    expect(parsed.kind).toBe('chapter')
    expect(parsed.chapter?.content).toContain('标题和正文容器都很明确')
  })

  it('rejects pages without a book or chapter structure', () => {
    expect(() => parsePage('<html><body><p>hello</p></body></html>', 'https://example.com/')).toThrowError(/没有识别到/)
  })
})

describe('parseTocPage', () => {
  it('reads an ordered catalog from a dedicated page', () => {
    const chapters = parseTocPage(fixture('book.html'), 'https://example.com/book/1/')
    expect(chapters).toHaveLength(3)
    expect(chapters.map(chapter => chapter.index)).toEqual([0, 1, 2])
    expect(chapters[1]?.url).toBe('https://example.com/book/1/2.html')
  })
})

describe('parseChapterPage', () => {
  it('finds the catalog entry and book metadata on a chapter page', () => {
    const parsed = parseChapterPage(
      fixture('chapter-with-toc.html'),
      'https://example.com/book/9/12.html',
    )

    expect(parsed.chapter.title).toBe('第12章 雨停之后')
    expect(parsed.chapter.content).toContain('雨停在凌晨四点。')
    expect(parsed.tocUrl).toBe('https://example.com/book/9')
    expect(parsed.title).toBe('测试长篇小说')
    expect(parsed.author).toBe('林某')
    expect(parsed.coverUrl).toBe('https://example.com/cover-long.jpg')
  })
})

describe('stable identities', () => {
  it('normalizes trailing slashes and fragments before hashing', () => {
    expect(canonicalUrl('https://EXAMPLE.com/book/1/#top')).toBe('https://example.com/book/1')
    expect(bookId('https://example.com/book/1')).toBe(bookId('https://example.com/book/1/#catalog'))
    expect(chapterId('https://example.com/b/2.html#read')).toBe(chapterId('https://example.com/b/2.html'))
  })
})
