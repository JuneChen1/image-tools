import { describe, expect, it } from 'vitest'
import { ImageError, type ImageErrorCode } from '../utils/image'
import { en } from './en'
import { ja } from './ja'
import { describeError } from './useI18n'
import { zh } from './zh'

type Tree = { [key: string]: unknown }

/** 把字典攤平成「路徑 → 值」，函式與字串都是葉子 */
function leaves(tree: Tree, prefix = ''): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? leaves(value as Tree, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  )
}

describe('中、英、日字典', () => {
  it.each([
    ['en', en],
    ['ja', ja],
  ])('%s 與中文的欄位完全一致（沒有漏翻、沒有多出來的）', (_name, messages) => {
    expect(leaves(messages).map(([path]) => path)).toEqual(leaves(zh).map(([path]) => path))
  })

  it.each([
    ['en', en],
    ['ja', ja],
  ])('%s 的每個欄位型態與中文相同，函式的參數個數也相同', (_name, messages) => {
    const shape = (value: unknown) => (typeof value === 'function' ? `fn(${value.length})` : typeof value)
    expect(leaves(messages).map(([path, value]) => [path, shape(value)])).toEqual(
      leaves(zh).map(([path, value]) => [path, shape(value)]),
    )
  })

  it.each([
    ['zh', zh],
    ['en', en],
    ['ja', ja],
  ])('%s：每個字串都不是空的，每個函式都回傳非空字串', (_name, messages) => {
    for (const [path, value] of leaves(messages)) {
      if (typeof value === 'function') {
        const result = (value as (...args: unknown[]) => unknown)(...Array(value.length).fill(3))
        expect(typeof result, path).toBe('string')
        expect(result as string, path).not.toBe('')
      } else {
        expect(typeof value, path).toBe('string')
        expect((value as string).length, path).toBeGreaterThan(0)
      }
    }
  })

  it('語言標記', () => {
    expect(zh.htmlLang).toBe('zh-Hant')
    expect(en.htmlLang).toBe('en')
    expect(ja.htmlLang).toBe('ja')
  })
})

describe('日文（使用者指定的文字）', () => {
  it('分頁名稱：圖片分割用「画像分割」', () => {
    expect(ja.tabs.split).toBe('画像分割')
    expect(ja.tabs.combine).toBe('画像結合')
    expect(ja.tabs.compress).toBe('画像圧縮')
    expect(ja.tabs.convert).toBe('画像変換')
  })

  it('中文的分頁名稱', () => {
    expect(zh.tabs.split).toBe('圖片分割')
  })

  it('合併分頁的名稱', () => {
    expect(zh.tabs.combine).toBe('圖片合併')
    expect(en.tabs.combine).toBe('Combine')
  })

  it('用頓號分隔檔名，上限提示帶著數字', () => {
    expect(ja.listSep).toBe('、')
    expect(ja.dropzone.limit(10, 3)).toBe('一度に処理できるのは最大 10 枚です。3 枚をスキップしました。')
  })
})

describe('使用者指定的文字（改動前要先確認）', () => {
  it('切圖順序提示', () => {
    expect(zh.split.numbering(3)).toBe('由左到右依序編號為 1 ～ 3，如要發文到 X 形成大圖，請照這個順序上傳。')
    expect(zh.split.numbering(4)).toContain('1 ～ 4')
  })

  it('JPEG 背景填色', () => {
    expect(zh.batch.backgroundLabel).toBe('背景填色')
    expect(zh.batch.convertJpegNote).toBe(
      'JPEG 不支援透明背景。若圖片包含去背（透明）區域，將會用這個顏色填滿（一般照片不受影響）。',
    )
  })

  it('上限與略過的提示', () => {
    expect(zh.dropzone.limit(10, 3)).toBe('一次最多處理 10 張，已略過 3 張。')
    expect(zh.dropzone.singleOnly).toBe('一次只能處理一張圖片，請只選擇一張。')
    expect(zh.dropzone.tooBig(1, 50, 'a.png')).toBe('已略過 1 個過大的檔案（單檔上限 50 MB）：a.png')
    expect(zh.dropzone.rejected(2, 'a.gif、b.svg')).toBe('已略過 2 個不支援的檔案：a.gif、b.svg')
  })

  it('中文用頓號、英文用逗號分隔檔名', () => {
    expect(zh.listSep).toBe('、')
    expect(en.listSep).toBe(', ')
  })
})

describe('英文的單複數', () => {
  it('張數上限提示', () => {
    expect(en.dropzone.limit(10, 1)).toBe('Up to 10 images at a time. Skipped 1 image.')
    expect(en.dropzone.limit(10, 3)).toBe('Up to 10 images at a time. Skipped 3 images.')
  })

  it('檔案過大提示', () => {
    expect(en.dropzone.tooBig(1, 50, 'a.png')).toContain('1 oversized file ')
    expect(en.dropzone.tooBig(2, 50, 'a.png, b.png')).toContain('2 oversized files ')
  })

  it('不支援格式提示', () => {
    expect(en.dropzone.rejected(1, 'a.gif')).toContain('1 unsupported file:')
    expect(en.dropzone.rejected(2, 'a.gif, b.svg')).toContain('2 unsupported files:')
  })
})

describe('describeError', () => {
  // 用 Record 讓 TypeScript 檢查「每一種錯誤代碼都有測到」，新增代碼卻沒補測試時會編譯失敗
  const samples: Record<ImageErrorCode, ImageError> = {
    canvasTooLarge: new ImageError('canvasTooLarge'),
    encodeFailed: new ImageError('encodeFailed'),
    formatUnsupported: new ImageError('formatUnsupported', 'image/avif'),
    readFailed: new ImageError('readFailed'),
    tooNarrow: new ImageError('tooNarrow', 3),
    tooLarge: new ImageError('tooLarge', 64),
  }

  it.each(Object.entries(samples))('%s：中、英、日都有訊息，且不是通用的失敗訊息', (_code, error) => {
    for (const messages of [zh, en, ja]) {
      const text = describeError(error, messages)
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toBe(messages.errors.generic)
    }
  })

  it('像素過多：訊息帶著上限（中文用「萬像素」，日文用「万画素」，英文用 megapixels）', () => {
    expect(describeError(samples.tooLarge, zh)).toBe('圖片像素過多（上限 6400 萬像素），已略過')
    expect(describeError(samples.tooLarge, ja)).toBe('画像の画素数が多すぎるため（上限 6400 万画素）、スキップしました')
    expect(describeError(samples.tooLarge, en)).toBe(
      'This image has too many pixels (limit 64 megapixels). Skipped.',
    )
  })

  it('格式不支援：訊息帶著格式名稱，不是 MIME type', () => {
    expect(describeError(samples.formatUnsupported, zh)).toContain('AVIF')
    expect(describeError(samples.formatUnsupported, en)).toContain('AVIF')
    expect(describeError(samples.formatUnsupported, ja)).toContain('AVIF')
    expect(describeError(samples.formatUnsupported, zh)).not.toContain('image/')
    expect(describeError(samples.formatUnsupported, ja)).not.toContain('image/')
  })

  it('寬度太小：訊息帶著張數', () => {
    expect(describeError(samples.tooNarrow, zh)).toContain('3')
    expect(describeError(samples.tooNarrow, en)).toContain('3')
  })

  it('不是 ImageError 的錯誤用通用訊息', () => {
    expect(describeError(new Error('boom'), zh)).toBe(zh.errors.generic)
    expect(describeError('string error', en)).toBe(en.errors.generic)
    expect(describeError(null, en)).toBe(en.errors.generic)
  })
})
