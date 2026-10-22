export const LANG_CODES = ['zh', 'en', 'ja'] as const
export type Lang = (typeof LANG_CODES)[number]

export function isLang(value: unknown): value is Lang {
  return LANG_CODES.includes(value as Lang)
}

/** 依瀏覽器語言（navigator.language，例如 ja-JP、zh-TW）挑介面語言，沒有對應的就用英文 */
export function langFromBrowser(tag: string): Lang {
  const primary = tag.toLowerCase().split('-')[0]
  return primary === 'zh' || primary === 'ja' ? primary : 'en'
}
