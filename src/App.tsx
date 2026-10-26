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

function App() {
  const { lang, m, setLang } = useI18n()
  const [tab, setTab] = useState<TabId>('split')

  return (
    <main className="app">
      <header className="app-head">
        <h1>{m.siteTitle}</h1>
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
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {m.tabs[id]}
          </button>
        ))}
      </nav>

      {/* 四個分頁都保持掛載，切換時不會丟失已上傳的圖片 */}
      <div hidden={tab !== 'split'}>
        <SplitTab />
      </div>
      <div hidden={tab !== 'combine'}>
        <CombineTab />
      </div>
      <div hidden={tab !== 'compress'}>
        <BatchTab mode="compress" />
      </div>
      <div hidden={tab !== 'convert'}>
        <BatchTab mode="convert" />
      </div>

      <AnalyticsConsent />
    </main>
  )
}

export default App
