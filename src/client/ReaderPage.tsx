/** Full-page shelf, URL intake, preview, table of contents, and reader. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from 'dsh-relax-reader/remote'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { Book, ChapterContent, ChapterRef, EditionsResponse, ParsePreview, SearchResponse, SearchResult, SettingsResponse, SourceEdition } from '../types.ts'
import { EDITIONS_PATH, SEARCH_PATH, SETTINGS_PATH, SOURCE_CATALOG } from '../types.ts'
import { STYLE_ID, styles } from './styles.ts'

type View = 'shelf' | 'add' | 'search' | 'reader' | 'settings'
type Theme = 'auto' | 'light' | 'sepia' | 'dark'
type LineHeight = 1.75 | 1.9 | 2.05

const FONT_MIN = 14
const FONT_MAX = 24
const ERROR_TEXT: Record<string, string> = {
  'invalid-url': '地址不合法，请粘贴 http 或 https 链接',
  'blocked-host': '不支持内网或本机地址',
  'fetch-failed': '没能抓到页面，请检查网络或稍后重试',
  'unsupported-page': '这个页面不像书籍详情、目录或章节页',
  'no-chapters': '没有找到章节目录；从章节页添加时需要页面带有“目录”入口',
  'no-content': '这一页没有找到正文',
  'store-failed': '本地保存失败，请检查 DSH 日志',
}

const SPINES = ['#55766c', '#8d6b56', '#62758e', '#8b744f', '#766583', '#507d7d', '#8a5f66']

/** Book names that make the empty search form immediately usable. */
const SEARCH_SUGGESTIONS = ['剑来', '光阴之外', '凡人修仙传'] as const


/** Call a generated Remote method and unwrap the result branch. */
async function invoke<T>(call: (signal: AbortSignal) => Promise<RemoteResult<T>>): Promise<T> {
  const controller = new AbortController()
  const result = await call(controller.signal)
  if (!result.ok) throw result.error
  return result.value
}

/** Turn a stable Remote sub-code into copy a reader can act on. */
function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; details?: unknown; message?: unknown }
    const details = typeof record.details === 'object' && record.details !== null
      ? record.details as { code?: unknown }
      : undefined
    const code = typeof details?.code === 'string'
      ? details.code
      : typeof record.code === 'string' ? record.code : undefined
    if (code !== undefined && ERROR_TEXT[code] !== undefined) return ERROR_TEXT[code]
    if (typeof record.message === 'string' && record.message.trim() !== '') return record.message
  }
  return '操作没有完成，请重试'
}

/** Decode the small entity subset the public search endpoint returns. */
function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim()
}

/** Direct CORS search fallback for a desktop shell that has not loaded the Host route yet. */
async function publicSearch(query: string): Promise<SearchResult[]> {
  const response = await fetch(`https://www.bqg539.xyz/api/search?q=${encodeURIComponent(query)}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('搜索服务暂时不可用')
  const raw = await response.text()
  let parsed: { data?: unknown }
  try {
    parsed = JSON.parse(raw) as { data?: unknown }
  } catch {
    throw new Error('搜索服务暂时不可用')
  }
  if (!Array.isArray(parsed.data)) return []
  return parsed.data.flatMap((item): SearchResult[] => {
    if (typeof item !== 'object' || item === null) return []
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' && typeof record.id !== 'number') return []
    if (typeof record.title !== 'string' || typeof record.author !== 'string') return []
    const id = String(record.id)
    const numeric = Number(id)
    const cover = Number.isSafeInteger(numeric) && numeric > 0
      ? `https://www.bq555.cc/bookimg/${Math.floor(numeric / 1000)}/${id}.jpg`
      : undefined
    return [{
      id,
      title: plainText(record.title),
      author: plainText(record.author) || '佚名',
      intro: typeof record.intro === 'string' ? plainText(record.intro) : '',
      url: `https://www.bqg539.xyz/#/book/${encodeURIComponent(id)}/`,
      ...cover === undefined ? {} : { coverUrl: cover },
    }]
  }).slice(0, 50)
}

/** Remove trailing source-site calls to action from a synopsis. */
function readableDescription(value: string): string {
  return value
    .replace(/[\u4e00-\u9fa5A-Za-z0-9]{0,24}(?:最新)?章节地址[：:].*$/s, '')
    .replace(/\s*(?:请收藏本站|手机版|一秒记住)[：:].*$/s, '')
    .replace(/\s*各位书友要是觉得.*$/s, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Deterministic book-spine color, stable across restarts. */
function spineColor(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }
  return SPINES[Math.abs(hash) % SPINES.length] ?? SPINES[0] ?? '#55766c'
}

/** Preference keys owned by this plugin, plus the 0.1.0 legacy prefix. */
const PREF_PREFIX = 'dsh-relax-reader'
const LEGACY_PREF_PREFIX = 'novel-reader'

/** Read one preference, falling back to the pre-rename key on first launch. */
function readPreference(name: string): string | null {
  try {
    return localStorage.getItem(`${PREF_PREFIX}.${name}`)
      ?? localStorage.getItem(`${LEGACY_PREF_PREFIX}.${name}`)
  } catch {
    return null
  }
}

/** Read a clamped numeric preference. */
function storedNumber(name: string, fallback: number, min: number, max: number): number {
  try {
    const raw = readPreference(name)
    if (raw === null || raw.trim() === '') return fallback
    const value = Number(raw)
    if (!Number.isFinite(value)) return fallback
    return Math.min(max, Math.max(min, Math.round(value)))
  } catch {
    return fallback
  }
}

/** Read a stored theme, falling back to automatic. */
function storedTheme(): Theme {
  try {
    const value = readPreference('theme')
    return value === 'light' || value === 'sepia' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

/** Read a stored line height. */
function storedLineHeight(): LineHeight {
  try {
    const value = Number(readPreference('lineHeight'))
    return value === 1.75 || value === 2.05 ? value : 1.9
  } catch {
    return 1.9
  }
}

/** Persist a preference without letting storage failures break reading. */
function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Preferences are a convenience, not a reason to fail a reading session.
  }
}

/** Inject the plugin stylesheet once; the owner removes it when unmounted. */
function useStyles(): void {
  useEffect(() => {
    const selector = `style[data-plugin-css="${STYLE_ID}"]`
    const existing = document.querySelector<HTMLStyleElement>(selector)
    if (existing !== null) return
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-relax-reader'
    tag.dataset.pluginCss = STYLE_ID
    tag.textContent = styles
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, [])
}

/** A small inline icon set with no icon dependency. */
function Icon({ name }: {
  name: 'plus' | 'back' | 'list' | 'trash' | 'left' | 'right' | 'settings' | 'search' | 'close' | 'book'
}): ReactNode {
  const paths: Record<typeof name, ReactNode> = {
    plus: <path d="M10 4v12M4 10h12" />,
    back: <path d="M12.5 4.5 7 10l5.5 5.5" />,
    list: <path d="M4 5.5h12M4 10h12M4 14.5h8" />,
    trash: <path d="M4 6h12M8 6V4h4v2M6.2 6l.6 10h6.4l.6-10M8.5 9v4.5M11.5 9v4.5" />,
    left: <path d="M12 4 6 10l6 6" />,
    right: <path d="m8 4 6 6-6 6" />,
    settings: <path d="M4 6h12M4 14h12M7.5 3.8v4.4M13 11.8v4.4" />,
    search: <path d="m13.5 13.5 3 3M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12Z" />,
    close: <path d="m5 5 10 10M15 5 5 15" />,
    book: <path d="M4 4h4.3A2.7 2.7 0 0 1 11 6.7V17a2.7 2.7 0 0 0-2.7-2.7H4zM16 4h-4.3A2.7 2.7 0 0 0 9 6.7V17a2.7 2.7 0 0 1 2.7-2.7H16z" />,
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="nr-icon">
      {paths[name]}
    </svg>
  )
}

/** Cover image with a typographic fallback that survives hotlink failures. */
function Cover({ title, url, eager = false, className = '' }: {
  title: string
  url?: string | undefined
  eager?: boolean
  className?: string | undefined
}): ReactNode {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])
  return (
    <span className={`nr-cover ${className}`.trim()}>
      <span className="nr-cover-glyph" aria-hidden="true">{title.trim().charAt(0) || '书'}</span>
      {url !== undefined && !failed && (
        <img src={url} alt="" loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
      )}
    </span>
  )
}

/** Inline error banner used by shelf and add flows. */
function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }): ReactNode {
  return (
    <div className="nr-error" role="alert">
      <span className="nr-error-text">{message}</span>
      <button className="nr-error-close" onClick={onClose} aria-label="关闭提示">×</button>
    </div>
  )
}

/** Build the panel component with the browser context captured. */
export function createReaderPage(ctx: Context): () => ReactNode {
  return function ReaderPage(): ReactNode {
    const remote = ctx.remote.relaxReader
    const [view, setView] = useState<View>('shelf')
    const [books, setBooks] = useState<Book[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [url, setUrl] = useState('')
    const [preview, setPreview] = useState<ParsePreview | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [searchBusy, setSearchBusy] = useState(false)
    const [searchDone, setSearchDone] = useState(false)
    const [editions, setEditions] = useState<SourceEdition[]>([])
    const [editionsBusy, setEditionsBusy] = useState(false)
    const [activeEditionUrl, setActiveEditionUrl] = useState<string | null>(null)
    const [currentBook, setCurrentBook] = useState<Book | null>(null)
    const [toc, setToc] = useState<ChapterRef[]>([])
    const [chapter, setChapter] = useState<ChapterContent | null>(null)
    const [chapterError, setChapterError] = useState<string | null>(null)
    const [failedChapterId, setFailedChapterId] = useState<string | null>(null)
    const [showToc, setShowToc] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [settingsData, setSettingsData] = useState<SettingsResponse | null>(null)
    const [settingsBusy, setSettingsBusy] = useState(false)
    const [settingsError, setSettingsError] = useState<string | null>(null)
    const [settingsTab, setSettingsTab] = useState<'sources' | 'reading' | 'data'>('sources')
    const sourceSettings = settingsData?.sources ?? SOURCE_CATALOG.map(source => ({ ...source, enabled: true }))
    const enabledSourceNames = sourceSettings.filter(source => source.enabled).map(source => source.name)
    const [tocSearch, setTocSearch] = useState('')
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)
    const [justAdded, setJustAdded] = useState<string | null>(null)
    const [fontSize, setFontSize] = useState(() => storedNumber('fontSize', 17, FONT_MIN, FONT_MAX))
    const [theme, setTheme] = useState<Theme>(storedTheme)
    const [lineHeight, setLineHeight] = useState<LineHeight>(storedLineHeight)
    const scrollRef = useRef<HTMLDivElement>(null)
    const tocListRef = useRef<HTMLOListElement>(null)
    const saveTimer = useRef<number | undefined>(undefined)
    const highlightTimer = useRef<number | undefined>(undefined)
    const pendingOffset = useRef(0)
    const lastOffset = useRef(0)
    const liveReading = useRef<{ bookId?: string; chapterId?: string }>({})
    const operation = useRef(0)

    useStyles()

    const refresh = useCallback(async (): Promise<void> => {
      try {
        setBooks(await invoke(signal => remote.listBooks(signal)))
      } catch (cause: unknown) {
        setError(errorMessage(cause))
      }
    }, [remote])

    useEffect(() => { void refresh() }, [refresh])
    useEffect(() => { void loadSettings() }, [])
    useEffect(() => { store('dsh-relax-reader.fontSize', String(fontSize)) }, [fontSize])
    useEffect(() => { store('dsh-relax-reader.theme', theme) }, [theme])
    useEffect(() => { store('dsh-relax-reader.lineHeight', String(lineHeight)) }, [lineHeight])

    useEffect(() => {
      liveReading.current = {
        ...currentBook === null ? {} : { bookId: currentBook.id },
        ...chapter === null ? {} : { chapterId: chapter.id },
      }
    }, [currentBook, chapter])

    useEffect(() => {
      return () => {
        window.clearTimeout(saveTimer.current)
        window.clearTimeout(highlightTimer.current)
        const reading = liveReading.current
        if (reading.bookId !== undefined && reading.chapterId !== undefined) {
          void invoke(signal => remote.saveProgress({
            bookId: reading.bookId as string,
            chapterId: reading.chapterId as string,
            offset: lastOffset.current,
          }, signal)).catch(() => {})
        }
      }
    }, [remote])

    useLayoutEffect(() => {
      if (chapter === null) return
      const node = scrollRef.current
      if (node !== null) {
        node.scrollTop = pendingOffset.current
        lastOffset.current = pendingOffset.current
        pendingOffset.current = 0
      }
    }, [chapter])

    useEffect(() => {
      if (!showToc) return
      const list = tocListRef.current
      if (list === null) return
      const active = list.querySelector<HTMLElement>('[data-active="true"]')
      active?.scrollIntoView({ block: 'center' })
    }, [showToc])

    useEffect(() => {
      if (!showToc && !settingsOpen) return
      const onKey = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return
        setShowToc(false)
        setSettingsOpen(false)
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }, [showToc, settingsOpen])

    /** Save the current pixel offset and reflect it in the local shelf. */
    function saveNow(): Promise<void> {
      if (currentBook === null || chapter === null) return Promise.resolve()
      const offset = scrollRef.current?.scrollTop ?? lastOffset.current
      lastOffset.current = offset
      const bookId = currentBook.id
      const chapterId = chapter.id
      const updatedAt = Date.now()
      setCurrentBook(value => value !== null && value.id === bookId
        ? { ...value, lastChapterId: chapterId, lastOffset: offset, updatedAt }
        : value)
      setBooks(previous => previous.map(item => item.id === bookId
        ? { ...item, lastChapterId: chapterId, lastOffset: offset, updatedAt }
        : item))
      return invoke(signal => remote.saveProgress({ bookId, chapterId, offset }, signal))
        .then(() => {})
        .catch(() => {})
    }

    useEffect(() => {
      const onVisibility = (): void => {
        if (document.visibilityState === 'hidden') void saveNow()
      }
      document.addEventListener('visibilitychange', onVisibility)
      return () => document.removeEventListener('visibilitychange', onVisibility)
    }, [currentBook, chapter])

    useEffect(() => {
      if (!settingsOpen) return
      const onPointerDown = (event: PointerEvent): void => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (target.closest('.nr-settings') !== null) return
        if (target.closest('button[aria-label="阅读设置"]') !== null) return
        setSettingsOpen(false)
      }
      document.addEventListener('pointerdown', onPointerDown)
      return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [settingsOpen])

    async function loadEditions(entries: Array<{ url: string; sourceName?: string | undefined }>): Promise<void> {
      const unique = [...new Map(entries.filter(entry => entry.url !== '').map(entry => [entry.url, entry])).values()].slice(0, 8)
      if (unique.length === 0) return
      setEditionsBusy(true)
      setEditions([])
      try {
        const response = await fetch(EDITIONS_PATH, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ urls: unique.map(entry => entry.url) }),
        })
        const raw = await response.text()
        const body = JSON.parse(raw) as EditionsResponse & { error?: unknown }
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '来源汇总失败')
        setEditions(Array.isArray(body.editions) ? body.editions : [])
      } catch {
        // The Host route may not be present in an older desktop shell. The
        // existing parseUrl Remote can still summarize each edition.
        const settled = await Promise.allSettled(unique.map(async (entry): Promise<SourceEdition> => {
          const next = await invoke(signal => remote.parseUrl({ url: entry.url }, signal))
          const latest = next.chapters[next.chapters.length - 1]
          return {
            sourceName: entry.sourceName ?? '来源',
            url: entry.url,
            chapterCount: next.chapterCount,
            ...latest === undefined ? {} : { latestChapter: latest.title },
          }
        }))
        setEditions(settled.flatMap((item): SourceEdition[] => item.status === 'fulfilled' ? [item.value] : []))
      } finally {
        setEditionsBusy(false)
      }
    }

    async function loadSettings(): Promise<void> {
      try {
        const response = await fetch(SETTINGS_PATH, { headers: { accept: 'application/json' }, cache: 'no-store' })
        const body = await response.json() as SettingsResponse & { error?: unknown }
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '读取设置失败')
        setSettingsData(body)
        setSettingsError(null)
      } catch (cause: unknown) {
        setSettingsError(cause instanceof Error ? cause.message : '读取设置失败')
      }
    }

    async function toggleSource(id: string, enabled: boolean): Promise<void> {
      if (settingsData === null || settingsBusy) return
      const previous = settingsData
      const disabledSources = enabled
        ? settingsData.disabledSources.filter(item => item !== id)
        : [...settingsData.disabledSources, id]
      setSettingsData({
        ...settingsData,
        disabledSources,
        sources: settingsData.sources.map(source => source.id === id ? { ...source, enabled } : source),
      })
      setSettingsBusy(true)
      setSettingsError(null)
      try {
        const response = await fetch(SETTINGS_PATH, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ disabledSources }),
        })
        const body = await response.json() as SettingsResponse & { error?: unknown }
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '保存设置失败')
        setSettingsData(body)
      } catch (cause: unknown) {
        setSettingsData(previous)
        setSettingsError(cause instanceof Error ? cause.message : '保存设置失败')
      } finally {
        setSettingsBusy(false)
      }
    }

    function openSettings(): void {
      setSettingsOpen(false)
      setSettingsTab('sources')
      setView('settings')
      setError(null)
      void loadSettings()
    }

    function openSearch(): void {
      setSettingsOpen(false)
      setView('search')
      setError(null)
      setSearchResults([])
      setSearchDone(false)
      setPreview(null)
      setEditions([])
      setEditionsBusy(false)
      setActiveEditionUrl(null)
    }

    async function search(queryOverride?: string): Promise<void> {
      const query = (queryOverride ?? searchQuery).trim()
      if (query === '' || searchBusy) return
      setSearchBusy(true)
      setError(null)
      setSearchDone(false)
      setSearchResults([])
      try {
        let response: Response | undefined
        let raw = ''
        for (let attempt = 0; attempt < 2; attempt += 1) {
          response = await fetch(`${SEARCH_PATH}?q=${encodeURIComponent(query)}`, {
            headers: { accept: 'application/json' },
            cache: 'no-store',
          })
          raw = await response.text()
          if (response.status !== 404 || attempt === 1) break
          // A freshly restarted Host can finish mounting the tab before its
          // same-origin route table has settled.
          await new Promise(resolve => window.setTimeout(resolve, 350))
        }
        if (response === undefined) throw new Error('搜索失败，请稍后重试')
        let body: SearchResponse & { error?: unknown }
        try {
          body = JSON.parse(raw) as SearchResponse & { error?: unknown }
        } catch {
          throw new Error(response.status === 404
            ? '搜索服务还没准备好，请刷新页面后再试'
            : '搜索服务返回了异常响应，请稍后重试')
        }
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '搜索失败，请稍后重试')
        setSearchResults(Array.isArray(body.results) ? body.results : [])
        setSearchDone(true)
      } catch (cause: unknown) {
        try {
          // The desktop shell can briefly serve the client half before its
          // same-origin Host route is registered. The public search endpoint
          // is CORS-enabled, so let this one read-only request recover itself.
          const fallback = await publicSearch(query)
          setSearchResults(fallback)
          setSearchDone(true)
        } catch {
          setError(errorMessage(cause))
        }
      } finally {
        setSearchBusy(false)
      }
    }

    function openSearchResult(result: SearchResult): void {
      setView('add')
      setError(null)
      setPreview(null)
      setActiveEditionUrl(result.url)
      void loadEditions([
        { url: result.url, sourceName: result.sourceName },
        ...(result.alternates ?? []),
      ])
      void parse(result.url, (result.alternates ?? []).map(item => item.url))
    }

    function returnToShelf(): void {
      window.clearTimeout(saveTimer.current)
      const pendingSave = saveNow()
      operation.current += 1
      setBusy(false)
      setView('shelf')
      setError(null)
      setPreview(null)
      setShowToc(false)
      setSettingsOpen(false)
      setChapterError(null)
      setFailedChapterId(null)
      setChapter(null)
      setCurrentBook(null)
      setToc([])
      void pendingSave.finally(() => refresh())
    }

    async function parse(targetInput?: string, alternateUrls: readonly string[] = []): Promise<void> {
      const target = (targetInput ?? url).trim()
      if (target === '' || busy) return
      if (targetInput !== undefined) setUrl(targetInput)
      if (targetInput === undefined) {
        setEditions([])
        setEditionsBusy(false)
        setActiveEditionUrl(null)
      }
      const token = ++operation.current
      setBusy(true)
      setError(null)
      setPreview(null)
      try {
        // A merged search hit may come from several mirror sites; if the first
        // one lost its book, try the next before telling the reader it failed.
        let lastError: unknown
        for (const candidate of [target, ...alternateUrls.filter(item => item !== target)]) {
          try {
            const next = await invoke(signal => remote.parseUrl({ url: candidate }, signal))
            if (token !== operation.current) return
            setActiveEditionUrl(candidate)
            setPreview(next)
            return
          } catch (cause: unknown) {
            lastError = cause
          }
        }
        if (token === operation.current && lastError !== undefined) setError(errorMessage(lastError))
      } finally {
        if (token === operation.current) setBusy(false)
      }
    }

    async function save(): Promise<void> {
      if (preview === null || busy) return
      setBusy(true)
      setError(null)
      try {
        const book = await invoke(signal => remote.saveBook({ preview }, signal))
        setBooks(previous => [book, ...previous.filter(item => item.id !== book.id)])
        setJustAdded(book.id)
        window.clearTimeout(highlightTimer.current)
        highlightTimer.current = window.setTimeout(() => setJustAdded(null), 1400)
        setPreview(null)
        setUrl('')
        setView('shelf')
      } catch (cause: unknown) {
        setError(errorMessage(cause))
      } finally {
        setBusy(false)
      }
    }

    async function remove(book: Book): Promise<void> {
      if (busy) return
      setBusy(true)
      setError(null)
      try {
        await invoke(signal => remote.removeBook({ bookId: book.id }, signal))
        setBooks(previous => previous.filter(item => item.id !== book.id))
        setPendingDelete(null)
      } catch (cause: unknown) {
        setError(errorMessage(cause))
      } finally {
        setBusy(false)
      }
    }

    async function openBook(book: Book): Promise<void> {
      if (busy) return
      const token = ++operation.current
      setBusy(true)
      setError(null)
      setChapterError(null)
      setFailedChapterId(null)
      setCurrentBook(book)
      setChapter(null)
      setToc([])
      setView('reader')
      try {
        const chapters = await invoke(signal => remote.getToc({ bookId: book.id }, signal))
        if (token !== operation.current) return
        const target = chapters.find(item => item.id === book.lastChapterId) ?? chapters[0]
        if (target === undefined) throw new Error('目录为空')
        pendingOffset.current = target.id === book.lastChapterId ? book.lastOffset ?? 0 : 0
        setToc(chapters)
        const next = await invoke(signal => remote.getChapter({ bookId: book.id, chapterId: target.id }, signal))
        if (token !== operation.current) return
        setChapter(next)
      } catch (cause: unknown) {
        if (token !== operation.current) return
        setError(errorMessage(cause))
        setView('shelf')
        setCurrentBook(null)
      } finally {
        if (token === operation.current) setBusy(false)
      }
    }

    async function loadChapter(book: Book, chapterId: string, offset = 0): Promise<void> {
      window.clearTimeout(saveTimer.current)
      void saveNow()
      const token = ++operation.current
      setBusy(true)
      setError(null)
      setChapterError(null)
      setFailedChapterId(null)
      pendingOffset.current = offset
      setChapter(null)
      setShowToc(false)
      setSettingsOpen(false)
      try {
        const next = await invoke(signal => remote.getChapter({ bookId: book.id, chapterId }, signal))
        if (token !== operation.current) return
        setChapter(next)
        setCurrentBook(previous => previous !== null && previous.id === book.id
          ? { ...previous, lastChapterId: next.id, lastOffset: 0, updatedAt: Date.now() }
          : previous)
        setBooks(previous => previous.map(item => item.id === book.id
          ? { ...item, lastChapterId: next.id, lastOffset: 0, updatedAt: Date.now() }
          : item))
        void invoke(signal => remote.saveProgress({ bookId: book.id, chapterId: next.id, offset: 0 }, signal)).catch(() => {})
      } catch (cause: unknown) {
        if (token !== operation.current) return
        setChapterError(errorMessage(cause))
        setFailedChapterId(chapterId)
      } finally {
        if (token === operation.current) setBusy(false)
      }
    }

    function onScroll(): void {
      if (currentBook === null || chapter === null) return
      lastOffset.current = scrollRef.current?.scrollTop ?? 0
      window.clearTimeout(saveTimer.current)
      const bookId = currentBook.id
      const chapterId = chapter.id
      saveTimer.current = window.setTimeout(() => {
        const offset = scrollRef.current?.scrollTop ?? lastOffset.current
        lastOffset.current = offset
        void invoke(signal => remote.saveProgress({ bookId, chapterId, offset }, signal)).catch(() => {})
      }, 550)
    }

    const activeIndex = chapter === null ? -1 : toc.findIndex(item => item.id === chapter.id)
    const progress = toc.length === 0 || activeIndex < 0 ? 0 : ((activeIndex + 1) / toc.length) * 100
    const themeClass = theme === 'light' ? 'nr-theme-light'
      : theme === 'sepia' ? 'nr-theme-sepia'
        : theme === 'dark' ? 'nr-theme-dark'
          : 'nr-theme-auto'
    const chapterIndexById = useMemo(() => new Map(toc.map((item, index) => [item.id, index])), [toc])
    const filteredToc = useMemo(() => {
      const query = tocSearch.trim().toLowerCase()
      return query === '' ? toc : toc.filter(item => item.title.toLowerCase().includes(query))
    }, [toc, tocSearch])
    const previewConfidence = preview?.confidence === 'high' ? '解析完整'
      : preview?.confidence === 'medium' ? '解析可用' : '解析较弱'
    const primaryBook = books[0]
    const otherBooks = books.slice(1)

    return (
      <div className={`nr-root ${themeClass}`}>
        {view === 'shelf' && (
          <header className="nr-topbar nr-shelf-head" aria-label="书架工具栏">
            <h1 className="nr-sr-only">书架</h1>
            <div className="nr-header-actions">
              <button className="nr-icon-button" onClick={openSearch} title="搜索小说" aria-label="搜索小说">
                <Icon name="search" />
              </button>
              <button
                className="nr-icon-button"
                onClick={() => { setSettingsOpen(false); setView('add'); setError(null) }}
                title="添加小说"
                aria-label="添加小说"
              >
                <Icon name="plus" />
              </button>
              <button
                className="nr-icon-button"
                onClick={openSettings}
                title="设置"
                aria-label="设置"
              >
                <Icon name="settings" />
              </button>
            </div>
          </header>
        )}

        {view === 'search' && (
          <header className="nr-topbar nr-searchbar">
            <button className="nr-icon-button" onClick={() => { setView('shelf'); setError(null) }} title="返回书架" aria-label="返回书架">
              <Icon name="back" />
            </button>
            <div className="nr-searchbar-heading">
              <h1 className="nr-searchbar-title">书库搜索</h1>
              <span className="nr-searchbar-sub">{enabledSourceNames.length} 个书库</span>
            </div>
            <form className="nr-topbar-search" onSubmit={(event) => { event.preventDefault(); void search() }}>
              <Icon name="search" />
              <input
                id="dsh-relax-reader-search"
                className="nr-field-input"
                type="search"
                value={searchQuery}
                onChange={event => { setSearchQuery(event.target.value); if (searchDone) { setSearchDone(false); setSearchResults([]) } }}
                placeholder="输入书名，例如：剑来"
                spellCheck={false}
                autoFocus
              />
              <button className="nr-primary" type="submit" disabled={searchBusy || searchQuery.trim() === ''}>
                {searchBusy ? <><span className="nr-spinner" /> 搜索中</> : '搜索'}
              </button>
            </form>
          </header>
        )}

        {view === 'add' && (
          <header className="nr-topbar nr-searchbar">
            <button className="nr-icon-button" disabled={busy} onClick={() => {
              operation.current += 1
              setBusy(false)
              setView('shelf')
              setError(null)
              setPreview(null)
            }} title="返回书架" aria-label="返回书架">
              <Icon name="back" />
            </button>
            <div className="nr-searchbar-heading">
              <h1 className="nr-searchbar-title">添加小说</h1>
              <span className="nr-searchbar-sub">支持 5 个站点</span>
            </div>
            <form className="nr-topbar-search" onSubmit={(event) => { event.preventDefault(); void parse() }}>
              <Icon name="book" />
              <input
                id="dsh-relax-reader-url"
                className="nr-field-input"
                type="text"
                inputMode="url"
                value={url}
                onChange={event => setUrl(event.target.value)}
                placeholder="https://example.com/book/123"
                spellCheck={false}
                autoComplete="url"
                autoFocus
              />
              <button className="nr-primary" type="submit" disabled={busy || url.trim() === ''}>
                {busy ? <><span className="nr-spinner" /> 解析中</> : '解析'}
              </button>
            </form>
          </header>
        )}

        {view === 'settings' && (
          <header className="nr-topbar nr-searchbar">
            <button className="nr-icon-button" onClick={() => { setView('shelf'); setSettingsError(null) }} title="返回书架" aria-label="返回书架">
              <Icon name="back" />
            </button>
            <div className="nr-searchbar-heading">
              <h1 className="nr-searchbar-title">设置</h1>
              <span className="nr-searchbar-sub">书源、阅读与数据</span>
            </div>
          </header>
        )}

        {view !== 'reader' && error !== null && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {view === 'shelf' && (
          <div className="nr-body nr-scroll">
            {books.length === 0
              ? (
                  <div className="nr-empty">
                    <h2 className="nr-empty-title">书架空着</h2>
                    <p className="nr-empty-copy">搜一本书，或者粘贴一页地址；确认书名与目录后，就在这里安静地读下去。</p>
                    <div className="nr-empty-actions">
                      <button className="nr-primary" onClick={openSearch}>
                        <Icon name="search" /> 搜索书库
                      </button>
                      <button className="nr-secondary" onClick={() => { setView('add'); setError(null) }}>
                        <Icon name="plus" /> 粘贴地址
                      </button>
                    </div>
                  </div>
                )
              : (
                  <div className="nr-shelf-stage">
                    <header className="nr-shelf-titlebar">
                      <h1 className="nr-shelf-title">书架</h1>
                      <span>{books.length} 本</span>
                    </header>
                    {primaryBook !== undefined && (
                      <section className={`nr-featured${justAdded === primaryBook.id ? ' just-added' : ''}`}>
                        <button className="nr-featured-open" onClick={() => { void openBook(primaryBook) }} disabled={busy}>
                          <Cover title={primaryBook.title} url={primaryBook.coverUrl} className="nr-cover-featured" eager />
                          <span className="nr-featured-body">
                            <span className="nr-featured-kicker">继续阅读</span>
                            <span className="nr-featured-title" title={primaryBook.title}>{primaryBook.title}</span>
                            <span className="nr-featured-author">{primaryBook.author}</span>
                            {primaryBook.description !== undefined && primaryBook.description !== '' && (
                              <span className="nr-featured-desc">{readableDescription(primaryBook.description)}</span>
                            )}
                            <span className="nr-featured-footer">
                              <span className="nr-featured-cta">继续阅读 <Icon name="right" /></span>
                              <span className="nr-featured-meta">
                                <span>{primaryBook.chapterCount} 章</span>
                                <span className="nr-status-sep" />
                                <span>{primaryBook.sourceHost}</span>
                              </span>
                            </span>
                          </span>
                          <span className="nr-featured-aside">
                            <span className="nr-featured-stat"><strong>{primaryBook.chapterCount}</strong><small>章</small></span>
                            <span className="nr-featured-aside-note">{primaryBook.lastChapterId === undefined ? '尚未开始' : '上次阅读'}</span>
                          </span>
                        </button>
                        <button
                          className="nr-icon-button nr-featured-delete"
                          onClick={() => setPendingDelete(primaryBook.id)}
                          title="从书架删除"
                          aria-label={`删除《${primaryBook.title}》`}
                        >
                          <Icon name="trash" />
                        </button>
                        {pendingDelete === primaryBook.id && (
                          <div className="nr-featured-confirm">
                            <span>删除《{primaryBook.title}》？</span>
                            <div>
                              <button className="nr-mini-button" onClick={() => setPendingDelete(null)}>取消</button>
                              <button className="nr-mini-button danger" onClick={() => { void remove(primaryBook) }} disabled={busy}>删除</button>
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    {otherBooks.length > 0 && (
                      <section className="nr-other-books">
                        <div className="nr-shelf-section-head">
                          <h2>全部书架</h2>
                          <span>{books.length} 本</span>
                        </div>
                        <ul className="nr-shelf-grid">
                          {otherBooks.map(book => (
                            <li
                              key={book.id}
                              className={`nr-shelf-card${justAdded === book.id ? ' just-added' : ''}`}
                              style={{ '--nr-spine': spineColor(book.title) } as CSSProperties}
                            >
                              <button className="nr-shelf-card-open" onClick={() => { void openBook(book) }} disabled={busy}>
                                <span className="nr-shelf-cover">
                                  <Cover title={book.title} url={book.coverUrl} className="nr-cover-card" />
                                  <span className="nr-card-badge">{book.lastChapterId === undefined ? '未读' : '续读'}</span>
                                </span>
                                <span className="nr-shelf-card-copy">
                                  <span className="nr-shelf-card-title" title={book.title}>{book.title}</span>
                                  <span className="nr-shelf-card-author">{book.author}</span>
                                  <span className="nr-shelf-card-meta" title={book.sourceHost}>
                                    <span>{book.chapterCount} 章</span>
                                    <span className="nr-status-sep" />
                                    <span>{book.sourceHost}</span>
                                  </span>
                                </span>
                              </button>
                              <button
                                className="nr-row-action nr-card-delete"
                                onClick={() => setPendingDelete(book.id)}
                                title="从书架删除"
                                aria-label={`删除《${book.title}》`}
                              >
                                <Icon name="trash" />
                              </button>
                              {pendingDelete === book.id && (
                                <div className="nr-card-confirm">
                                  <span>删除《{book.title}》？</span>
                                  <div>
                                    <button className="nr-mini-button" onClick={() => setPendingDelete(null)}>取消</button>
                                    <button className="nr-mini-button danger" onClick={() => { void remove(book) }} disabled={busy}>删除</button>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                )}
          </div>
        )}

        {view === 'settings' && (
          <div className="nr-page nr-page-settings nr-scroll">
            <div className="nr-page-inner">
              <div className="nr-settings-layout">
                <nav className="nr-settings-nav" aria-label="设置分类">
                  <button
                    type="button"
                    className={settingsTab === 'sources' ? 'active' : ''}
                    aria-current={settingsTab === 'sources' ? 'page' : undefined}
                    onClick={() => setSettingsTab('sources')}
                  >
                    书源
                  </button>
                  <button
                    type="button"
                    className={settingsTab === 'reading' ? 'active' : ''}
                    aria-current={settingsTab === 'reading' ? 'page' : undefined}
                    onClick={() => setSettingsTab('reading')}
                  >
                    阅读
                  </button>
                  <button
                    type="button"
                    className={settingsTab === 'data' ? 'active' : ''}
                    aria-current={settingsTab === 'data' ? 'page' : undefined}
                    onClick={() => setSettingsTab('data')}
                  >
                    数据
                  </button>
                </nav>

                <div className="nr-settings-main">
                  {settingsTab === 'sources' && (
                    <section className="nr-settings-panel" aria-label="书源设置">
                      <header className="nr-settings-panel-head">
                        <div>
                          <h1 className="nr-settings-title">书源</h1>
                          <p className="nr-settings-deck">选择参与聚合搜索的书源。关闭后不再出现在搜索结果里，已收藏的书仍可正常阅读。</p>
                        </div>
                        <span className="nr-settings-count">
                          {sourceSettings.filter(source => source.enabled).length} / {sourceSettings.length}
                        </span>
                      </header>
                      <ul className="nr-settings-source-list">
                        {sourceSettings.map(source => (
                          <li key={source.id} className="nr-settings-source">
                            <div className="nr-settings-source-copy">
                              <strong>{source.name}</strong>
                              <span>{source.detail}</span>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={source.enabled}
                              aria-label={`${source.name}书源`}
                              className={`nr-switch${source.enabled ? ' on' : ''}`}
                              disabled={settingsBusy || settingsData === null}
                              onClick={() => { void toggleSource(source.id, !source.enabled) }}
                            >
                              <span className="nr-switch-thumb" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      {settingsData === null && settingsError === null && <p className="nr-settings-note">正在读取书源设置…</p>}
                      {settingsError !== null && <p className="nr-settings-error" role="alert">{settingsError}</p>}
                    </section>
                  )}

                  {settingsTab === 'reading' && (
                    <section className="nr-settings-panel" aria-label="阅读设置说明">
                      <header className="nr-settings-panel-head">
                        <div>
                          <h1 className="nr-settings-title">阅读</h1>
                          <p className="nr-settings-deck">当前阅读偏好。字号、行距和主题可以在阅读页右上角的设置里继续调整。</p>
                        </div>
                      </header>
                      <dl className="nr-settings-values">
                        <div><dt>字号</dt><dd>{fontSize} px</dd></div>
                        <div><dt>行距</dt><dd>{lineHeight}</dd></div>
                        <div><dt>主题</dt><dd>{theme === 'auto' ? '跟随系统' : theme === 'light' ? '浅色' : theme === 'sepia' ? '护眼' : '深色'}</dd></div>
                      </dl>
                    </section>
                  )}

                  {settingsTab === 'data' && (
                    <section className="nr-settings-panel" aria-label="数据说明">
                      <header className="nr-settings-panel-head">
                        <div>
                          <h1 className="nr-settings-title">数据</h1>
                          <p className="nr-settings-deck">书架、目录、章节缓存和书源设置都保存在本机，不进入会话或模型上下文。</p>
                        </div>
                      </header>
                      <div className="nr-settings-path">
                        <span>存储位置</span>
                        <code>$DSH_HOME/dsh-relax-reader/store.json</code>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'add' && (
          <div className={`nr-page nr-page-add nr-scroll${preview === null && !busy ? ' nr-page-idle' : ''}`}>
            <div className="nr-page-inner">
              {preview === null && !busy && (
                <section className="nr-add-landing" aria-label="添加小说说明">
                  <h2 className="nr-landing-title">粘贴一页，接着读</h2>
                  <p className="nr-landing-deck">从书籍详情页、目录页或章节页开始。解析出书名和目录后，再决定是否收藏。</p>
                  <ol className="nr-add-steps">
                    <li className="nr-add-step">
                      <span className="nr-add-step-index">1</span>
                      <div>
                        <strong>粘贴地址</strong>
                        <span>详情页、目录页、章节页都可以。</span>
                      </div>
                    </li>
                    <li className="nr-add-step">
                      <span className="nr-add-step-index">2</span>
                      <div>
                        <strong>确认目录</strong>
                        <span>核对书名、作者和章节数。</span>
                      </div>
                    </li>
                    <li className="nr-add-step">
                      <span className="nr-add-step-index">3</span>
                      <div>
                        <strong>收藏开读</strong>
                        <span>目录和正文缓存到本地书架。</span>
                      </div>
                    </li>
                  </ol>
                </section>
              )}

              {busy && preview === null && (
                <div className="nr-parse-status"><span className="nr-spinner" /> 正在解析页面，确认书名和目录…</div>
              )}

              {preview !== null && (
                <section className="nr-preview" aria-label="解析预览">
                  <div className="nr-preview-head">
                    <Cover title={preview.title} url={preview.coverUrl} eager />
                    <div className="nr-preview-meta">
                      <span className="nr-preview-title">{preview.title}</span>
                      <span className="nr-preview-author">{preview.author} · {preview.sourceHost}</span>
                      <span className={`nr-confidence${preview.confidence === 'low' ? ' low' : ''}`}>
                        {previewConfidence} · {preview.chapterCount} 章
                      </span>
                    </div>
                  </div>
                  {preview.description !== undefined && preview.description !== '' && (
                    <p className="nr-description">{readableDescription(preview.description)}</p>
                  )}
                  {preview.sample !== '' && (
                    <blockquote className="nr-sample">{preview.sample}</blockquote>
                  )}
                  <div className="nr-preview-actions">
                    <button className="nr-primary" onClick={() => { void save() }} disabled={busy}>
                      {busy ? <><span className="nr-spinner" /> 收藏中</> : '收藏到书架'}
                    </button>
                  </div>
                  {preview.confidence === 'low' && (
                    <p className="nr-note">解析结果可能不完整。仍可收藏，打开后到目录里确认。</p>
                  )}
                </section>
              )}

              {(editionsBusy || editions.length > 0) && (
                <section className="nr-editions" aria-label="各来源更新">
                  <div className="nr-editions-head">
                    <h2>来源与更新</h2>
                    <span>{editionsBusy ? '正在核对目录…' : `${editions.length} 个来源`}</span>
                  </div>
                  {editionsBusy && (
                    <div className="nr-editions-loading"><span className="nr-spinner" /> 正在读取各来源的最新章节…</div>
                  )}
                  {editions.length > 0 && (
                    <ul className="nr-edition-list">
                      {editions.map(edition => (
                        <li key={`${edition.sourceName}-${edition.url}`} className={`nr-edition${activeEditionUrl === edition.url ? ' active' : ''}`}>
                          <div className="nr-edition-main">
                            <span className="nr-edition-source">{edition.sourceName}</span>
                            <span className={`nr-edition-update${edition.error === undefined ? '' : ' error'}`}>
                              {edition.error ?? (edition.latestChapter === undefined ? '目录不可用' : `更新至 ${edition.latestChapter}`)}
                            </span>
                          </div>
                          <div className="nr-edition-side">
                            {edition.chapterCount !== undefined && <span className="nr-edition-count">{edition.chapterCount} 章</span>}
                            {edition.error === undefined && activeEditionUrl !== edition.url && (
                              <button className="nr-edition-use" onClick={() => { setActiveEditionUrl(edition.url); void parse(edition.url) }}>
                                使用
                              </button>
                            )}
                            {activeEditionUrl === edition.url && <span className="nr-edition-current">当前</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </div>
        )}

        {view === 'search' && (
          <div className={`nr-page nr-page-search nr-scroll${!searchBusy && !searchDone && searchResults.length === 0 ? ' nr-page-idle' : ''}`}>
            <div className="nr-page-inner">
              {!searchBusy && !searchDone && searchResults.length === 0 && (
                <section className={`nr-search-landing${books.length === 0 ? ' no-recent' : ''}`} aria-label="书库搜索说明">
                  <div className="nr-search-main-top">
                      <h2 className="nr-landing-title">
                        {enabledSourceNames.length === 0 ? '没有启用的书库' : `${enabledSourceNames.length} 个书库，一起找`}
                      </h2>
                      <p className="nr-landing-deck">按书名同时搜索已启用的书库。同一本书的不同来源会合并成一条结果，先看目录，再决定收藏。</p>
                      <div className="nr-suggestions">
                        <span>试试</span>
                        {SEARCH_SUGGESTIONS.map(name => (
                          <button
                            key={name}
                            type="button"
                            className="nr-suggestion"
                            disabled={searchBusy}
                            onClick={() => { setSearchQuery(name); void search(name) }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {books.length > 0 && (
                      <section className="nr-search-recent" aria-label="继续阅读">
                        <div className="nr-recent-head">
                          <h2>继续阅读</h2>
                          <button type="button" className="nr-recent-all" onClick={() => setView('shelf')}>全部书架</button>
                        </div>
                        <div className="nr-recent-list">
                          {books.slice(0, 4).map(book => (
                            <button
                              key={book.id}
                              type="button"
                              className="nr-recent-book"
                              onClick={() => { void openBook(book) }}
                              disabled={busy}
                            >
                              <Cover title={book.title} url={book.coverUrl} />
                              <span className="nr-recent-copy">
                                <span className="nr-recent-title">{book.title}</span>
                                <span className="nr-recent-author">{book.author}</span>
                                <span className="nr-recent-progress">{book.lastChapterId === undefined ? '未开始' : '继续上次阅读'}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                  <aside className="nr-catalog">
                    <div className="nr-catalog-head">
                      <span>已接入</span>
                      <span>{enabledSourceNames.length} 个书库</span>
                    </div>
                    <ul className="nr-source-list">
                      {enabledSourceNames.length === 0
                        ? <li className="nr-source-empty">所有书源已关闭</li>
                        : sourceSettings.filter(source => source.enabled).map(source => (
                            <li key={source.id}>{source.name}</li>
                          ))}
                    </ul>
                    <p className="nr-catalog-note">同一本书会在多个书库之间合并；解析失败会自动换下一个来源。</p>
                  </aside>
                </section>
              )}

              {searchBusy && (
                <div className="nr-search-status"><span className="nr-spinner" /> 正在五个书库里查找…</div>
              )}
              {!searchBusy && searchDone && searchResults.length === 0 && (
                <div className="nr-search-empty">
                  <strong>没有找到“{searchQuery.trim()}”</strong>
                  <span>换个书名，或者直接粘贴书籍地址。</span>
                  <button
                    type="button"
                    className="nr-secondary"
                    onClick={() => { setSearchQuery(''); setSearchDone(false); setSearchResults([]) }}
                  >
                    换个书名
                  </button>
                </div>
              )}
              {searchResults.length > 0 && (
                <section className="nr-search-section" aria-label="搜索结果">
                  <p className="nr-search-count">找到 {searchResults.length} 本</p>
                  <div className="nr-search-results">
                    {searchResults.map(result => (
                      <button key={result.id} className="nr-search-card" onClick={() => openSearchResult(result)} disabled={busy || searchBusy}>
                        <Cover title={result.title} url={result.coverUrl} eager />
                        <span className="nr-search-copy">
                          <span className="nr-search-title">{result.title}</span>
                          <span className="nr-search-meta">
                            <span className="nr-search-author">{result.author}</span>
                            {result.sourceName !== undefined && result.sourceName !== '' && (
                              <span className="nr-search-source">{result.sourceName}</span>
                            )}
                          </span>
                          {result.intro !== '' && <span className="nr-search-intro">{readableDescription(result.intro)}</span>}
                        </span>
                        <span className="nr-search-go"><Icon name="right" /></span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {view === 'reader' && currentBook !== null && (
          <div className="nr-reader">
            <header className="nr-reader-topbar">
              <button className="nr-icon-button" onClick={returnToShelf} title="返回书架" aria-label="返回书架">
                <Icon name="back" />
              </button>
              <div className="nr-reader-heading">
                <div className="nr-reader-book" title={currentBook.title}>{currentBook.title}</div>
                <div className="nr-reader-progress-label">
                  {activeIndex >= 0 ? `第 ${activeIndex + 1} 章 / 共 ${toc.length} 章` : '阅读'}
                </div>
              </div>
              <div className="nr-header-actions">
                <button
                  className="nr-icon-button"
                  onClick={() => { setShowToc(value => !value); setSettingsOpen(false); setTocSearch('') }}
                  title="目录"
                  aria-label="目录"
                  aria-pressed={showToc}
                >
                  <Icon name="list" />
                </button>
                <button
                  className="nr-icon-button"
                  onClick={() => { setSettingsOpen(value => !value); setShowToc(false) }}
                  title="阅读设置"
                  aria-label="阅读设置"
                  aria-pressed={settingsOpen}
                >
                  <Icon name="settings" />
                </button>
              </div>
              <span className="nr-progress-track" aria-hidden="true">
                <span className="nr-progress-fill" style={{ width: `${progress}%` }} />
              </span>
            </header>


            <div
              ref={scrollRef}
              className="nr-reader-scroll nr-scroll"
              style={{ fontSize: `${fontSize}px`, '--nr-leading': String(lineHeight) } as CSSProperties}
              onScroll={onScroll}
            >
              {chapterError !== null
                ? (
                    <div className="nr-reader-error" role="alert">
                      <p>{chapterError}</p>
                      <button
                        className="nr-primary"
                        onClick={() => {
                          if (currentBook !== null && failedChapterId !== null) {
                            void loadChapter(currentBook, failedChapterId, 0)
                          }
                        }}
                      >重试</button>
                    </div>
                  )
                : chapter === null
                  ? (
                      <div className="nr-loading">
                        <span className="nr-spinner" />
                        <span>正在翻开这一章…</span>
                      </div>
                    )
                  : (
                      <article className="nr-article">
                        <p className="nr-chapter-position">
                          {activeIndex >= 0 ? `第 ${activeIndex + 1} 章` : ''}
                        </p>
                        <h1 className="nr-chapter-title">{chapter.title}</h1>
                        <div className="nr-prose">
                          {chapter.content.split(/\n{2,}|\n/).filter(paragraph => paragraph.trim() !== '').map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                          ))}
                        </div>
                      </article>
                    )}
            </div>

            <nav className="nr-reader-nav" aria-label="章节导航">
              <button
                className="nr-nav-button"
                disabled={busy || chapter?.prevId === undefined}
                onClick={() => {
                  if (currentBook !== null && chapter?.prevId !== undefined) void loadChapter(currentBook, chapter.prevId)
                }}
              >
                <Icon name="left" /> 上一章
              </button>
              <button
                className="nr-nav-button"
                disabled={busy || chapter?.nextId === undefined}
                onClick={() => {
                  if (currentBook !== null && chapter?.nextId !== undefined) void loadChapter(currentBook, chapter.nextId)
                }}
              >
                下一章 <Icon name="right" />
              </button>
            </nav>

            {showToc && (
              <div className="nr-toc" role="dialog" aria-modal="true" aria-label="章节目录">
                <header className="nr-toc-head">
                  <div className="nr-toc-heading">
                    <strong>目录</strong>
                    <span>{toc.length} 章 · {currentBook.title}</span>
                  </div>
                  <button className="nr-icon-button" onClick={() => setShowToc(false)} title="关闭目录" aria-label="关闭目录" autoFocus={toc.length <= 8}>
                    <Icon name="close" />
                  </button>
                </header>
                {toc.length > 8 && (
                  <div className="nr-toc-search">
                    <div className="nr-search-wrap">
                      <Icon name="search" />
                      <input
                        className="nr-input"
                        value={tocSearch}
                        onChange={event => setTocSearch(event.target.value)}
                        placeholder="查找章节"
                        autoFocus
                        spellCheck={false}
                      />
                    </div>
                  </div>
                )}
                <ol className="nr-toc-list nr-scroll" ref={tocListRef}>
                  {filteredToc.map(item => {
                    const index = chapterIndexById.get(item.id) ?? 0
                    return (
                      <li key={item.id}>
                        <button
                          className={`nr-toc-row${item.id === chapter?.id ? ' active' : ''}`}
                          data-active={item.id === chapter?.id}
                          onClick={() => {
                            if (currentBook !== null) void loadChapter(currentBook, item.id)
                          }}
                        >
                          <span className="nr-toc-index">{String(index + 1).padStart(2, '0')}</span>
                          <span className="nr-toc-name">{item.title}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
                {filteredToc.length === 0 && <p className="nr-toc-empty">没有匹配的章节</p>}
              </div>
            )}
          </div>
        )}
            {settingsOpen && (
              <div className="nr-settings" role="dialog" aria-label="阅读设置">
                <header className="nr-settings-head">
                  <div>
                    <strong>阅读设置</strong>
                    <span>字与纸的舒适度</span>
                  </div>
                  <button className="nr-icon-button" onClick={() => setSettingsOpen(false)} aria-label="关闭阅读设置" title="关闭">
                    <Icon name="close" />
                  </button>
                </header>

                <div
                  className="nr-settings-preview"
                  style={{ fontSize: `${fontSize}px`, '--nr-leading': String(lineHeight) } as CSSProperties}
                  aria-hidden="true"
                >
                  字里行间，留一点空白。
                </div>

                <div className="nr-settings-section">
                  <div className="nr-settings-label"><span>字号</span><span className="nr-settings-value">{fontSize} px</span></div>
                  <div className="nr-font-control">
                    <span className="nr-font-a" aria-hidden="true">A</span>
                    <input
                      className="nr-range"
                      type="range"
                      min={FONT_MIN}
                      max={FONT_MAX}
                      step="1"
                      value={fontSize}
                      onChange={event => setFontSize(Number(event.target.value))}
                      aria-label="字号"
                    />
                    <span className="nr-font-a large" aria-hidden="true">A</span>
                  </div>
                </div>

                <div className="nr-settings-section">
                  <div className="nr-settings-label"><span>行距</span></div>
                  <div className="nr-line-options">
                    {([1.75, 1.9, 2.05] as const).map(value => (
                      <button
                        key={value}
                        className="nr-line-option"
                        aria-pressed={lineHeight === value}
                        onClick={() => setLineHeight(value)}
                      >
                        {value === 1.75 ? '紧凑' : value === 1.9 ? '标准' : '舒展'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="nr-settings-section">
                  <div className="nr-settings-label"><span>主题</span></div>
                  <div className="nr-theme-grid">
                    {([
                      ['auto', '自动', '跟随 DSH'],
                      ['light', '浅色', '白纸'],
                      ['sepia', '护眼', '米黄'],
                      ['dark', '深色', '夜读'],
                    ] as const).map(([value, label, note]) => (
                      <button
                        key={value}
                        className="nr-theme-choice"
                        aria-pressed={theme === value}
                        onClick={() => setTheme(value)}
                      >
                        <span className={`nr-swatch nr-swatch-${value}`} aria-hidden="true" />
                        <span className="nr-theme-copy">
                          <span>{label}</span>
                          <small>{note}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <footer className="nr-settings-foot">
                  <button
                    className="nr-reset"
                    onClick={() => {
                      setFontSize(17)
                      setLineHeight(1.9)
                      setTheme('auto')
                    }}
                  >恢复默认</button>
                  <span>设置会自动保存</span>
                </footer>
              </div>
            )}

      </div>
    )
  }
}
