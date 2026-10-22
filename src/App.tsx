import { useState } from 'react'
import BatchTab from './features/BatchTab'
import SplitTab from './features/SplitTab'
import './App.css'

const TABS = [
  { id: 'split', label: '切圖' },
  { id: 'compress', label: '圖片壓縮' },
  { id: 'convert', label: '圖片轉檔' },
] as const

type TabId = (typeof TABS)[number]['id']

function App() {
  const [tab, setTab] = useState<TabId>('split')

  return (
    <main className="app">
      <header>
        <h1>圖片工具箱</h1>
        <p>所有處理都在你的瀏覽器內完成，圖片不會上傳到任何伺服器。</p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
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
    </main>
  )
}

export default App
