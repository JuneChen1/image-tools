import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en } from './en'
import { ja } from './ja'
import { isLang, langFromBrowser, type Lang } from './lang'
import { I18nContext } from './useI18n'
import { zh } from './zh'

const BASE = import.meta.env.BASE_URL
const STORAGE_KEY = 'image-tools-lang'

const DICTIONARIES = { zh, en, ja }

/** 從網址取語言：/image-tools/en/ → 'en'，沒有則回傳 null */
function langFromPath(): Lang | null {
  const rest = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : ''
  const segment = rest.split('/')[0]
  return isLang(segment) ? segment : null
}

/** 沒有指定語言時：先看使用者上次手動選的，再看瀏覽器語言 */
function preferredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // localStorage 不可用時忽略
  }
  return langFromBrowser(navigator.language)
}

const pathFor = (lang: Lang) => `${BASE}${lang}/`

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => langFromPath() ?? preferredLang())
  const m = DICTIONARIES[lang]

  // 網址沒有語言（例如首頁、404）時，補上語言路徑
  useEffect(() => {
    if (langFromPath() !== lang) history.replaceState(null, '', pathFor(lang))
  }, [lang])

  useEffect(() => {
    document.documentElement.lang = m.htmlLang
    document.title = m.siteTitle
  }, [m])

  // 瀏覽器上一頁 / 下一頁
  useEffect(() => {
    const onPopState = () => setLangState(langFromPath() ?? preferredLang())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage 不可用時忽略
    }
    history.pushState(null, '', pathFor(next))
  }, [])

  const value = useMemo(() => ({ lang, m, setLang }), [lang, m, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
