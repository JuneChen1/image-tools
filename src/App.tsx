import { useState } from 'react'
import AnalyticsConsent from './components/AnalyticsConsent'
import BatchTab from './features/BatchTab'
import SplitTab from './features/SplitTab'
import { useI18n, type Lang } from './i18n'
import './App.css'

const TAB_IDS = ['split', 'compress', 'convert'] as const
type TabId = (typeof TAB_IDS)[number]

// 語言名稱固定用該語言自己的寫法，不隨介面語言變動
const LANGS: { id: Lang; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
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
          {LANGS.map((l) => (
            <option key={l.id} value={l.id} lang={l.id === 'zh' ? 'zh-Hant' : 'en'}>
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

      {/* 三個分頁都保持掛載，切換時不會丟失已上傳的圖片 */}
      <div hidden={tab !== 'split'}>
        <SplitTab />
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
