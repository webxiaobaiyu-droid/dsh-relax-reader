import { describe, expect, it } from 'vitest'
import { bookId, canonicalUrl } from '../src/parser.ts'
import {
  bqgApiIdFromHtml,
  bqgBookUrl,
  bqgChapterRefs,
  bqgChapterUrl,
  bqgCoverUrl,
  cleanBqgChapter,
  cleanBqgText,
  createBqgToken,
  parseBqgTarget,
} from '../src/bqg.ts'

describe('bqg adapter', () => {
  it('matches the site token for a known chapter request', () => {
    expect(createBqgToken({ id: 2530, chapterid: 1 }))
      .toBe('b%2BvXnT3wjuXQsxBmZh033ZjqwezLEinKfOakcVaiDx0%3D')
  })

  it('recognizes bq555 details, chapters, and backend virtual URLs', () => {
    expect(parseBqgTarget('https://www.bq555.cc/xs/10753/')).toMatchObject({
      kind: 'html', dirId: '10753', chapterNo: undefined,
    })
    expect(parseBqgTarget('https://www.bq555.cc/xs/10753/12.html')).toMatchObject({
      kind: 'html', dirId: '10753', chapterNo: 12,
    })
    expect(parseBqgTarget('https://www.bqg539.xyz/#/book/2530/12.html')).toMatchObject({
      kind: 'virtual', apiId: '2530', chapterNo: 12,
    })
    expect(parseBqgTarget('https://www.bqg539.xyz/book/2530/')).toMatchObject({
      kind: 'virtual', apiId: '2530',
    })
  })

  it('builds stable virtual URLs and covers', () => {
    expect(bqgBookUrl('2530')).toMatch(/#\/book\/2530\/$/)
    expect(bqgChapterUrl('2530', 2)).toMatch(/#\/book\/2530\/2\.html$/)
    expect(canonicalUrl(bqgBookUrl('2530'))).toContain('#/book/2530/')
    expect(bookId(bqgBookUrl('2530'))).not.toBe(bookId(bqgBookUrl('1000')))
    expect(bqgCoverUrl('2530')).toBe('https://www.bq555.cc/bookimg/2/2530.jpg')
    expect(bqgChapterRefs('2530', ['第一章', '第二章']).map(item => item.index)).toEqual([0, 1])
  })

  it('extracts the API id from a detail page', () => {
    expect(bqgApiIdFromHtml("<a href=\"javascript:book_error('2530','万相之王','1')\">报错</a>")).toBe('2530')
  })

  it('cleans API text into paragraphs', () => {
    const text = cleanBqgText('第一段。<br><br>第二段。\n请收藏本站：https://example.com\n第三段。')
    expect(text).toBe('第一段。\n\n第二段。\n\n第三段。')
  })

  it('removes a duplicated chapter heading line', () => {
    const text = cleanBqgChapter('第76章 灯谜\n\n正文开始。\n\n第二段。', '第76章 灯谜')
    expect(text).toBe('正文开始。\n\n第二段。')
  })
})
