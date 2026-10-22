import { describe, expect, it } from 'vitest'
import { LANG_CODES, isLang, langFromBrowser } from './lang'

describe('isLang', () => {
  it.each(LANG_CODES)('%s 是支援的語言', (code) => {
    expect(isLang(code)).toBe(true)
  })

  it.each(['', 'fr', 'ZH', 'zh-Hant', 'ja-JP', null, undefined, 3])('%s 不是支援的語言', (value) => {
    expect(isLang(value)).toBe(false)
  })
})

describe('langFromBrowser：依瀏覽器語言挑介面語言', () => {
  it.each([
    ['zh-TW', 'zh'],
    ['zh-Hant-TW', 'zh'],
    ['zh', 'zh'],
    ['ZH-cn', 'zh'],
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    ['JA-jp', 'ja'],
    ['en-US', 'en'],
    ['en', 'en'],
  ])('%s → %s', (tag, expected) => {
    expect(langFromBrowser(tag)).toBe(expected)
  })

  it.each(['fr-FR', 'ko-KR', 'jar', 'zhx', ''])('沒有對應的語言（%s）用英文', (tag) => {
    expect(langFromBrowser(tag)).toBe('en')
  })
})
