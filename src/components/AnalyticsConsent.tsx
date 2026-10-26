import { useState } from 'react'
import { disableAnalytics, initAnalytics, isAnalyticsAvailable } from '../analytics'
import { readConsent, saveConsent, type Consent } from '../consent'
import { useI18n } from '../i18n'

/**
 * 統計（Google Analytics）的同意橫幅與頁尾的「隱私設定」連結。
 * 這個環境用不了 GA（開發環境、沒有衡量 ID、使用者開了「不要追蹤」）時什麼都不顯示。
 * 沒表態或拒絕都不會載入 GA；之後隨時可以從頁尾重新選擇
 */
export default function AnalyticsConsent() {
  const { m } = useI18n()
  // 還沒表態過才自動顯示橫幅
  const [open, setOpen] = useState(() => readConsent() === null)

  if (!isAnalyticsAvailable()) return null

  function choose(value: Consent) {
    saveConsent(value)
    setOpen(false)
    if (value === 'granted') initAnalytics()
    else disableAnalytics()
  }

  return (
    <>
      <footer className="app-foot">
        <button onClick={() => setOpen(true)}>{m.consent.settings}</button>
      </footer>

      {open && (
        <div className="consent" role="dialog" aria-label={m.consent.title}>
          <div className="consent-inner">
            <p>{m.consent.text}</p>
            <div className="consent-actions">
              <button onClick={() => choose('denied')}>{m.consent.deny}</button>
              <button className="primary" onClick={() => choose('granted')}>
                {m.consent.accept}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
