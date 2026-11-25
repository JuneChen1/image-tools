import { useState } from 'react'
import AnalyticsConsent from './components/AnalyticsConsent'
import BatchTab from './features/BatchTab'
import CombineTab from './features/CombineTab'
import SplitTab from './features/SplitTab'
import { useI18n, type Lang } from './i18n'
import './App.css'

const TAB_IDS = ['split', 'combine', 'compress', 'convert'] as const
type TabId = (typeof TAB_IDS)[number]

// 語言名稱固定用該語言自己的寫法，不隨介面語言變動
const LANGS: { id: Lang; label: string; htmlLang: string }[] = [
  { id: 'zh', label: '中文', htmlLang: 'zh-Hant' },
  { id: 'en', label: 'English', htmlLang: 'en' },
  { id: 'ja', label: '日本語', htmlLang: 'ja' },
]

/** 方向鍵、Home、End 在分頁間移動（WAI-ARIA tabs 的慣例），回傳要切到的分頁；不是這些鍵就回傳 null */
function nextTab(current: TabId, key: string): TabId | null {
  const index = TAB_IDS.indexOf(current)
  switch (key) {
    case 'ArrowRight':
      return TAB_IDS[(index + 1) % TAB_IDS.length]
    case 'ArrowLeft':
      return TAB_IDS[(index - 1 + TAB_IDS.length) % TAB_IDS.length]
    case 'Home':
      return TAB_IDS[0]
    case 'End':
      return TAB_IDS[TAB_IDS.length - 1]
    default:
      return null
  }
}

function App() {
  const { lang, m, setLang } = useI18n()
  const [tab, setTab] = useState<TabId>('split')

  // 四個分頁都保持掛載，切換時不會丟失已上傳的圖片，所以只用 hidden 藏起來
  const panelProps = (id: TabId) =>
    ({ role: 'tabpanel', id: `panel-${id}`, 'aria-labelledby': `tab-${id}`, hidden: tab !== id }) as const

  return (
    <main className="app">
      <header className="app-head">
        <div className="head-title">
          <h1>{m.siteTitle}</h1>
          {/* 姊妹站：影片工具箱，放在標題右側，開新分頁，不會丟失已選的檔案 */}
          <a className="other-tool" href="https://videotools.junenaga.com/" target="_blank" rel="noopener">
            {m.otherTool} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <select
          className="lang-select"
          value={lang}
          aria-label={m.langSwitchLabel}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          {/* 目前的語言只在收合時顯示，展開的清單只列其他語言 */}
          {LANGS.map((l) => (
            <option key={l.id} value={l.id} lang={l.htmlLang} hidden={l.id === lang}>
              {l.label}
            </option>
          ))}
        </select>
      </header>

      <nav className="tabs" role="tablist">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            // 只有目前的分頁在 Tab 鍵順序裡，其他分頁用方向鍵切換
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              const next = nextTab(id, e.key)
              if (!next) return
              e.preventDefault()
              setTab(next)
              document.getElementById(`tab-${next}`)?.focus()
            }}
          >
            {m.tabs[id]}
          </button>
        ))}
      </nav>

      <div {...panelProps('split')}>
        <SplitTab />
      </div>
      <div {...panelProps('combine')}>
        <CombineTab />
      </div>
      <div {...panelProps('compress')}>
        <BatchTab mode="compress" />
      </div>
      <div {...panelProps('convert')}>
        <BatchTab mode="convert" />
      </div>

      <AnalyticsConsent />
    </main>
  )
}

export default App
