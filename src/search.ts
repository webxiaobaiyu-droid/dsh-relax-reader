import type { SearchResult } from './types.ts'

/**
 * Rank merged search hits and fold the same book on mirror sites together.
 *
 * Exact title matches come first, then prefix/substring matches, then author
 * matches. Every duplicate keeps its own URL as an `alternates` entry so the
 * client can retry another site when the first preview fails.
 */
export function rankResults(query: string, results: readonly SearchResult[]): SearchResult[] {
  const needle = query.toLowerCase().replace(/\s+/g, '')
  const score = (result: SearchResult): number => {
    const title = result.title.toLowerCase().replace(/\s+/g, '')
    if (title === needle) return 0
    if (title.startsWith(needle)) return 1
    if (title.includes(needle)) return 2
    if (result.author.toLowerCase().includes(query.toLowerCase())) return 3
    return 4
  }
  const ranked = results
    .map((result, order) => ({ result, order, value: score(result) }))
    .sort((left, right) => left.value - right.value || left.order - right.order)
  const merged: SearchResult[] = []
  const positions = new Map<string, number>()
  const groupSources = new Map<string, Set<string>>()
  for (const entry of ranked) {
    const key = `${entry.result.title.replace(/\s+/g, '').toLowerCase()}|${entry.result.author.toLowerCase()}`
    const position = positions.get(key)
    if (position === undefined) {
      positions.set(key, merged.length)
      merged.push({ ...entry.result })
      groupSources.set(key, new Set(entry.result.sourceName === undefined ? [] : [entry.result.sourceName]))
      continue
    }
    const primary = merged[position]
    if (primary === undefined) continue
    const sources = groupSources.get(key) ?? new Set<string>()
    if (entry.result.sourceName !== undefined) sources.add(entry.result.sourceName)
    groupSources.set(key, sources)
    const names = [...sources]
    if (names.length > 1) primary.sourceName = `${names[0] ?? ''} 等 ${names.length} 站`
    const alternates = primary.alternates ?? []
    alternates.push({
      url: entry.result.url,
      ...entry.result.sourceName === undefined ? {} : { sourceName: entry.result.sourceName },
    })
    primary.alternates = alternates
  }
  return merged.slice(0, 40)
}

