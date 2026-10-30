import { describe, expect, it } from 'vitest'
import { rankResults } from '../src/search.ts'
import type { SearchResult } from '../src/types.ts'

const hit = (title: string, author: string, sourceName: string, url = `https://${sourceName}.example/${title}`): SearchResult => ({
  id: url,
  title,
  author,
  intro: '',
  url,
  sourceName,
})

describe('rankResults', () => {
  it('puts exact title matches first, then prefix and substring matches', () => {
    const ranked = rankResults('剑来', [
      hit('心念剑来', '入梦之笔', '乙'),
      hit('剑来', '烽火戏诸侯', '甲'),
      hit('剑来杂谈', '浮生半日不得闲', '丙'),
      hit('雪中悍刀行', '烽火戏诸侯', '丁'),
    ])
    expect(ranked.map(item => item.title)).toEqual(['剑来', '剑来杂谈', '心念剑来', '雪中悍刀行'])
  })

  it('folds the same title and author across mirrors into one hit', () => {
    const [merged] = rankResults('剑来', [
      hit('剑来', '烽火戏诸侯', '蚂蚁阅读', 'https://a.example/1'),
      hit('剑来', '烽火戏诸侯', '就爱文学', 'https://b.example/1'),
      hit('剑来', '烽火戏诸侯', '若雨中文', 'https://c.example/1'),
    ])
    expect(merged).toMatchObject({ title: '剑来', url: 'https://a.example/1', sourceName: '蚂蚁阅读 等 3 站' })
    expect(merged?.alternates?.map(item => item.url)).toEqual(['https://b.example/1', 'https://c.example/1'])
  })

  it('counts distinct sites, not duplicate rows on one site', () => {
    const [merged] = rankResults('剑来', [
      hit('剑来', '烽火戏诸侯', '蚂蚁阅读', 'https://a.example/1'),
      hit('剑来', '烽火戏诸侯', '蚂蚁阅读', 'https://a.example/2'),
      hit('剑来', '烽火戏诸侯', '若雨中文', 'https://c.example/1'),
    ])
    expect(merged?.sourceName).toBe('蚂蚁阅读 等 2 站')
    expect(merged?.alternates).toHaveLength(2)
  })

  it('keeps books that only share a title when the author differs', () => {
    const ranked = rankResults('剑来', [
      hit('剑来', '烽火戏诸侯', '甲'),
      hit('剑来', '另一位作者', '乙'),
    ])
    expect(ranked).toHaveLength(2)
  })

  it('caps the merged list at 40 entries', () => {
    const many = Array.from({ length: 60 }, (_, index) => hit(`书${index}`, '作者', '甲'))
    expect(rankResults('书', many)).toHaveLength(40)
  })
})
