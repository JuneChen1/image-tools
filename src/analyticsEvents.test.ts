import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent } from './analytics'
import {
  createOnce,
  errorEventOf,
  filesAddedParams,
  formatLabel,
  inputFormatOf,
  rejectionsOf,
  saveResultParams,
  trackError,
  trackFilesAdded,
  trackRejections,
  trackSaveResult,
  trackShareFailure,
} from './analyticsEvents'
import { ImageError } from './utils/image'

vi.mock('./analytics', () => ({ trackEvent: vi.fn() }))

const file = (name: string, type = 'image/png') => ({ name, type })
const blob = (type: string) => ({ type })

/** 所有參數值都必須是字串或數字（GA 的型別限制，也是不會夾帶檔案物件的保證） */
const onlyStringsOrNumbers = (params: Record<string, unknown>) =>
  Object.values(params).every((v) => typeof v === 'string' || typeof v === 'number')

beforeEach(() => {
  vi.mocked(trackEvent).mockClear()
})

describe('formatLabel', () => {
  it.each([
    [['image/jpeg'], 'jpeg'],
    [['image/png', 'image/png'], 'png'],
    [['image/webp'], 'webp'],
    [['image/avif'], 'avif'],
    [['image/heic'], 'heic'],
    [['image/heif'], 'heic'],
    [['image/gif'], 'other'],
    [[''], 'other'],
  ])('%j → %s', (types, expected) => {
    expect(formatLabel(types)).toBe(expected)
  })

  it('不同格式混在一起是 mixed', () => {
    expect(formatLabel(['image/png', 'image/jpeg'])).toBe('mixed')
    expect(formatLabel(['image/heic', 'image/heif', 'image/png'])).toBe('mixed')
  })

  it('HEIC 與 HEIF 算同一種', () => {
    expect(formatLabel(['image/heic', 'image/heif'])).toBe('heic')
  })

  it('沒有東西是 none', () => {
    expect(formatLabel([])).toBe('none')
  })
})

describe('inputFormatOf', () => {
  it('HEIC 的 type 是空字串時靠副檔名判斷', () => {
    expect(inputFormatOf([file('IMG_001.HEIC', '')])).toBe('heic')
    expect(inputFormatOf([file('a.heif', '')])).toBe('heic')
  })

  it('一般格式看 type', () => {
    expect(inputFormatOf([file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg')])).toBe('jpeg')
  })

  it('混合', () => {
    expect(inputFormatOf([file('a.heic', ''), file('b.png')])).toBe('mixed')
  })
})

describe('filesAddedParams', () => {
  it('包含工具、張數、輸入格式', () => {
    expect(filesAddedParams('compress', [file('a.png'), file('b.png')])).toEqual({
      tool: 'compress',
      file_count: 2,
      input_format: 'png',
    })
  })

  it('不會夾帶檔名', () => {
    const params = filesAddedParams('split', [file('my-secret-photo.heic', '')])
    expect(JSON.stringify(params)).not.toContain('secret')
    expect(JSON.stringify(params)).not.toContain('my-')
    expect(onlyStringsOrNumbers(params)).toBe(true)
  })
})

describe('saveResultParams', () => {
  it('ZIP：工具、方式、輸出格式、張數', () => {
    expect(
      saveResultParams({
        tool: 'convert',
        method: 'zip',
        blobs: [blob('image/jpeg'), blob('image/jpeg'), blob('image/jpeg')],
      }),
    ).toEqual({ tool: 'convert', method: 'zip', output_format: 'jpeg', file_count: 3 })
  })

  it('切圖才帶 split_parts', () => {
    const split = saveResultParams({
      tool: 'split',
      method: 'share',
      blobs: [blob('image/png'), blob('image/png'), blob('image/png')],
      splitParts: 3,
    })
    expect(split).toMatchObject({ tool: 'split', method: 'share', split_parts: 3, file_count: 3 })
    const compress = saveResultParams({ tool: 'compress', method: 'single', blobs: [blob('image/webp')] })
    expect('split_parts' in compress).toBe(false)
  })

  it('維持原格式時輸出可能混合', () => {
    const params = saveResultParams({
      tool: 'compress',
      method: 'zip',
      blobs: [blob('image/png'), blob('image/jpeg')],
    })
    expect(params.output_format).toBe('mixed')
  })

  it('所有值都是字串或數字', () => {
    expect(
      onlyStringsOrNumbers(
        saveResultParams({ tool: 'split', method: 'zip', blobs: [blob('image/avif')], splitParts: 4 }),
      ),
    ).toBe(true)
  })
})

describe('rejectionsOf', () => {
  const none = { unsupported: [], oversized: [], tooMany: false, skipped: 0 }

  it('沒有擋掉任何東西時是空陣列（不送事件）', () => {
    expect(rejectionsOf(none, 3)).toEqual([])
  })

  it('各種原因分開計算', () => {
    expect(rejectionsOf({ ...none, unsupported: ['a.gif', 'b.svg'] }, 5)).toEqual([
      { reason: 'unsupported', count: 2 },
    ])
    expect(rejectionsOf({ ...none, oversized: ['big.png'] }, 1)).toEqual([
      { reason: 'oversized', count: 1 },
    ])
    expect(rejectionsOf({ ...none, skipped: 3 }, 13)).toEqual([{ reason: 'over_limit', count: 3 }])
  })

  it('切圖一次拖入多張：count 是拖入的張數', () => {
    expect(rejectionsOf({ ...none, tooMany: true }, 4)).toEqual([{ reason: 'too_many_files', count: 4 }])
  })

  it('同時有多種原因時各送一筆', () => {
    const list = rejectionsOf({ unsupported: ['a.gif'], oversized: ['b.png'], tooMany: false, skipped: 2 }, 6)
    expect(list.map((r) => r.reason)).toEqual(['unsupported', 'oversized', 'over_limit'])
  })

  it('不會把檔名放進結果', () => {
    const list = rejectionsOf({ ...none, unsupported: ['private-name.gif'] }, 1)
    expect(JSON.stringify(list)).not.toContain('private')
  })
})

describe('errorEventOf', () => {
  it('像素太多算 upload_rejected', () => {
    expect(errorEventOf('compress', 'tooLarge', 'jpeg')).toEqual({
      name: 'upload_rejected',
      params: { tool: 'compress', reason: 'too_many_pixels', count: 1 },
    })
  })

  it('切圖寬度太小算 upload_rejected', () => {
    expect(errorEventOf('split', 'tooNarrow', 'png')).toEqual({
      name: 'upload_rejected',
      params: { tool: 'split', reason: 'too_narrow', count: 1 },
    })
  })

  it.each(['canvasTooLarge', 'encodeFailed', 'formatUnsupported', 'readFailed', 'shareFailed'])(
    '%s 算 processing_error，並帶輸出格式',
    (code) => {
      expect(errorEventOf('convert', code, 'webp')).toEqual({
        name: 'processing_error',
        params: { tool: 'convert', code, output_format: 'webp' },
      })
    },
  )

  it('不認得的錯誤代碼一律寫成 unknown，不會把任意文字送出去', () => {
    const event = errorEventOf('split', 'Error: could not read C:\\Users\\me\\secret.png', 'png')
    expect(event.params.code).toBe('unknown')
    expect(JSON.stringify(event)).not.toContain('secret')
  })
})

describe('createOnce', () => {
  it('同一個 key 只有第一次是 true', () => {
    const once = createOnce()
    expect(once('a')).toBe(true)
    expect(once('a')).toBe(false)
    expect(once('b')).toBe(true)
    expect(once('a')).toBe(false)
  })

  it('各自獨立的實例互不影響', () => {
    expect(createOnce()('a')).toBe(true)
    expect(createOnce()('a')).toBe(true)
  })
})

describe('trackXxx 真正送出的事件', () => {
  it('files_added', () => {
    trackFilesAdded('split', [file('a.png')])
    expect(trackEvent).toHaveBeenCalledWith('files_added', { tool: 'split', file_count: 1, input_format: 'png' })
  })

  it('save_result', () => {
    trackSaveResult({ tool: 'split', method: 'zip', blobs: [blob('image/png')], splitParts: 3 })
    expect(trackEvent).toHaveBeenCalledWith('save_result', {
      tool: 'split',
      method: 'zip',
      output_format: 'png',
      file_count: 1,
      split_parts: 3,
    })
  })

  it('upload_rejected：每種原因各送一筆，沒有被擋就不送', () => {
    trackRejections('compress', { unsupported: [], oversized: [], tooMany: false, skipped: 0 }, 2)
    expect(trackEvent).not.toHaveBeenCalled()
    trackRejections('compress', { unsupported: ['a.gif'], oversized: [], tooMany: false, skipped: 2 }, 5)
    expect(trackEvent).toHaveBeenCalledTimes(2)
    expect(trackEvent).toHaveBeenCalledWith('upload_rejected', { tool: 'compress', reason: 'unsupported', count: 1 })
    expect(trackEvent).toHaveBeenCalledWith('upload_rejected', { tool: 'compress', reason: 'over_limit', count: 2 })
  })

  it('processing_error：ImageError 用它的代碼，其他錯誤是 unknown', () => {
    trackError('convert', new ImageError('encodeFailed'), 'image/avif')
    expect(trackEvent).toHaveBeenLastCalledWith('processing_error', {
      tool: 'convert',
      code: 'encodeFailed',
      output_format: 'avif',
    })
    trackError('convert', new Error('secret message'), 'image/jpeg')
    expect(trackEvent).toHaveBeenLastCalledWith('processing_error', {
      tool: 'convert',
      code: 'unknown',
      output_format: 'jpeg',
    })
  })

  it('processing_error：像素太多改送 upload_rejected', () => {
    trackError('split', new ImageError('tooLarge', 64), 'image/png')
    expect(trackEvent).toHaveBeenLastCalledWith('upload_rejected', {
      tool: 'split',
      reason: 'too_many_pixels',
      count: 1,
    })
  })

  it('輸出格式不知道（空字串）時是 none', () => {
    trackError('split', new ImageError('readFailed'), '')
    expect(trackEvent).toHaveBeenLastCalledWith('processing_error', {
      tool: 'split',
      code: 'readFailed',
      output_format: 'none',
    })
  })

  it('分享失敗', () => {
    trackShareFailure('split', [blob('image/png')])
    expect(trackEvent).toHaveBeenCalledWith('processing_error', {
      tool: 'split',
      code: 'shareFailed',
      output_format: 'png',
    })
  })
})
