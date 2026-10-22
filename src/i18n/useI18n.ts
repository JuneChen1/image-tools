import { createContext, useContext } from 'react'
import { FORMAT_LABEL, ImageError } from '../utils/image'
import type { Messages } from './zh'

export type Lang = 'zh' | 'en'

export interface I18n {
  lang: Lang
  m: Messages
  setLang: (lang: Lang) => void
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

/** 把錯誤轉成目前語言的訊息；錯誤本身不存文字，切換語言時才會跟著更新 */
export function describeError(error: unknown, m: Messages): string {
  if (!(error instanceof ImageError)) return m.errors.generic
  switch (error.code) {
    case 'canvasTooLarge':
      return m.errors.canvasTooLarge
    case 'encodeFailed':
      return m.errors.encodeFailed
    case 'readFailed':
      return m.errors.readFailed
    case 'formatUnsupported':
      return m.errors.formatUnsupported(FORMAT_LABEL[error.detail as keyof typeof FORMAT_LABEL])
    case 'tooNarrow':
      return m.errors.tooNarrow(Number(error.detail))
    case 'tooLarge':
      return m.errors.tooLarge(Number(error.detail))
  }
}
