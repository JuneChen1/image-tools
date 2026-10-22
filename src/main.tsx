import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { initAnalytics } from './analytics'
import { readConsent } from './consent'

// 只有使用者之前按過「同意」才載入 GA；其餘情況由頁面上的同意橫幅處理
if (readConsent() === 'granted') initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
