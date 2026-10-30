import { describe, expect, it } from 'vitest'
import {
  cleanAuthor,
  cleanChapterText,
  findSource,
  parseChapterPage,
  parseSearchPage,
  parseTocPage,
  sourceTarget,
  SOURCES,
} from '../src/sources.ts'

const source = (id: string) => {
  const found = SOURCES.find(item => item.id === id)
  if (found === undefined) throw new Error(`missing source ${id}`)
  return found
}

describe('source registry', () => {
  it('recognizes every supported host, including old domains', () => {
    expect(findSource('http://www.mayitxt.info/book/5193.html')?.id).toBe('mayitxt')
    expect(findSource('http://www.mayitxt.org/book/5193.html')?.id).toBe('mayitxt')
    expect(findSource('http://www.92xs.info/book/1505.html')?.id).toBe('jiuai')
    expect(findSource('http://www.3yt.la/Book/53328/index.html')?.id).toBe('ruoyu')
    expect(findSource('http://www.xtangsanshu.com/jianlai/')?.id).toBe('tangsan')
    expect(findSource('https://example.com/book/1')).toBeUndefined()
    expect(findSource('not a url')).toBeUndefined()
  })

  it('normalizes book and chapter URLs onto the current origin', () => {
    expect(sourceTarget(source('mayitxt'), 'http://www.mayitxt.org/book/5193.html')).toEqual({
      kind: 'book', bookUrl: 'http://www.mayitxt.info/book/5193.html',
    })
    expect(sourceTarget(source('mayitxt'), 'http://www.mayitxt.info/chapter/5193/2987750.html')).toEqual({
      kind: 'chapter',
      bookUrl: 'http://www.mayitxt.info/book/5193.html',
      chapterUrl: 'http://www.mayitxt.info/chapter/5193/2987750.html',
    })
    expect(sourceTarget(source('jiuai'), 'http://www.92xs.info/html/1505/776960.html')).toEqual({
      kind: 'chapter',
      bookUrl: 'http://www.92xs.info/book/1505.html',
      chapterUrl: 'http://www.92xs.info/html/1505/776960.html',
    })
    expect(sourceTarget(source('ruoyu'), 'http://www.3yt.info/Html/Book/53/53328/16388992.shtml')).toEqual({
      kind: 'chapter',
      bookUrl: 'http://www.3yt.info/Book/53328/index.html',
      chapterUrl: 'http://www.3yt.info/Html/Book/53/53328/16388992.shtml',
    })
    expect(sourceTarget(source('tangsan'), 'http://www.xtangsanshu.info/jianlai/51663364.html')).toEqual({
      kind: 'chapter',
      bookUrl: 'http://www.xtangsanshu.info/jianlai/',
      chapterUrl: 'http://www.xtangsanshu.info/jianlai/51663364.html',
    })
  })
})

describe('parseSearchPage', () => {
  it('reads table rows and skips the header row', () => {
    const html = `<table id="author"><tbody>
      <tr><th>文章名称</th><th>最新章节</th><th>作者</th></tr>
      <tr><td class="odd"><a href="/book/1505.html">剑来</a></td><td class="even"><a href="/html/1505/1.html">第一章</a></td><td class="odd">烽火戏诸侯</td></tr>
      <tr><td class="odd"><a href="/book/11260.html">剑来杂谈</a></td><td class="even"><a href="/html/11260/1.html">第一章</a></td><td class="odd">浮生半日不得闲</td></tr>
    </tbody></table>`
    const hits = parseSearchPage(source('jiuai'), html, 'http://www.92xs.info/modules/article/search.php')
    expect(hits.map(hit => [hit.title, hit.author, hit.url, hit.sourceName])).toEqual([
      ['剑来', '烽火戏诸侯', 'http://www.92xs.info/book/1505.html', '就爱文学'],
      ['剑来杂谈', '浮生半日不得闲', 'http://www.92xs.info/book/11260.html', '就爱文学'],
    ])
  })

  it('reads book-box cards with author prefixes and covers', () => {
    const html = `<div class="bookbox">
      <div class="bookimg"><a href="/jianlai/"><img src="/files/article/image/1/1234/1234s.jpg"></a></div>
      <h4 class="bookname"><a href="/jianlai/">剑来</a></h4>
      <div class="author">作者：烽火戏诸侯</div>
    </div>`
    const [hit] = parseSearchPage(source('tangsan'), html, 'http://www.xtangsanshu.info/s.php')
    expect(hit).toMatchObject({
      title: '剑来',
      author: '烽火戏诸侯',
      url: 'http://www.xtangsanshu.info/jianlai/',
      coverUrl: 'http://www.xtangsanshu.info/files/article/image/1/1234/1234s.jpg',
    })
  })
})

describe('parseTocPage', () => {
  it('drops the duplicated latest-chapter block and keeps reading order', () => {
    const html = `<div class="listmain"><dl>
      <dt>最新章节</dt>
      <dd><a href="/jianlai/3.html">第三章 结束</a></dd>
      <dd><a href="/jianlai/2.html">第二章 继续</a></dd>
      <dd><a href="/jianlai/3.html">第三章 结束</a></dd>
      <dd><a href="/jianlai/1.html">第一章 开始</a></dd>
      <dd><a href="/jianlai/2.html">第二章 继续</a></dd>
      <dd><a href="/jianlai/3.html">第三章 结束</a></dd>
    </dl></div>`
    const chapters = parseTocPage(source('tangsan'), html, 'http://www.xtangsanshu.info/jianlai/')
    expect(chapters.map(chapter => chapter.title)).toEqual(['第一章 开始', '第二章 继续', '第三章 结束'])
    expect(chapters.map(chapter => chapter.index)).toEqual([0, 1, 2])
    expect(chapters[1]?.url).toBe('http://www.xtangsanshu.info/jianlai/2.html')
  })

  it('ignores navigation links that are not chapters', () => {
    const html = `<div id="BookText"><ul>
      <li><a href="/Html/Book/53/53328/1.shtml">第一卷 第一章 惊蛰</a></li>
      <li><a href="/Html/Book/53/53328/Index.shtml">目录</a></li>
      <li><a href="javascript:void(0)">下一页</a></li>
    </ul></div>`
    const chapters = parseTocPage(source('ruoyu'), html, 'http://www.3yt.info/Html/Book/53/53328/Index.shtml')
    expect(chapters).toHaveLength(1)
    expect(chapters[0]?.url).toBe('http://www.3yt.info/Html/Book/53/53328/1.shtml')
  })
})

describe('parseChapterPage', () => {
  it('keeps paragraphs and removes site chrome', () => {
    const html = `<div id="BookText">
      <div id="content_tip"><b>最新网址：www.3yt.info</b></div>
      第一段。<br><br>第二段。<br>下下下<br>下载<br>第三段。
    </div>`
    const chapter = parseChapterPage(source('ruoyu'), html, 'http://www.3yt.info/Html/Book/53/53328/1.shtml', '第一章 惊蛰')
    expect(chapter.title).toBe('第一章 惊蛰')
    expect(chapter.content).toBe('第一段。\n第二段。\n第三段。')
  })

  it('fails with no-content when the container is missing', () => {
    expect(() => parseChapterPage(source('jiuai'), '<html><body></body></html>', 'http://www.92xs.info/html/1505/1.html', '第一章'))
      .toThrowError(/没有找到正文/)
  })
})

describe('text cleanup', () => {
  it('strips author prefixes and suffixes', () => {
    expect(cleanAuthor('作者：烽火戏诸侯')).toBe('烽火戏诸侯')
    expect(cleanAuthor('烽火戏诸侯作品集')).toBe('烽火戏诸侯')
    expect(cleanAuthor(' 作 者 :  天蚕土豆 ')).toBe('天蚕土豆')
  })

  it('drops ads, repeated single-character lines, and punctuation rules', () => {
    const text = cleanChapterText([
      '最新网址：www.mayitxt.info',
      '一秒记住♂，更新快，免费读！',
      '下下下',
      '真实正文第一段。',
      '-------------',
      '第二段。',
      '本站域名 www.example.com',
    ].join('\n'))
    expect(text).toBe('真实正文第一段。\n第二段。')
  })
})
