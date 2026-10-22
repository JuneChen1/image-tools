import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeImage, isHeicFile } from './decode'
import { ImageError } from './image'
import { MAX_MEGAPIXELS, MAX_PIXELS } from './limits'

const file = (name: string, type = '') => ({ name, type }) as File

describe('isHeicFile', () => {
  it.each(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])(
    'type 是 %s',
    (type) => {
      expect(isHeicFile(file('x', type))).toBe(true)
    },
  )

  // Chrome 常把 .heic 的 type 回報成空字串，所以要看副檔名
  it.each(['a.heic', 'A.HEIC', 'b.heif', 'x.HeIf'])('type 為空但檔名是 %s', (name) => {
    expect(isHeicFile(file(name, ''))).toBe(true)
  })

  it.each([
    ['a.png', 'image/png'],
    ['a.jpg', 'image/jpeg'],
    ['heic.png', 'image/png'],
    ['photo.heic.jpg', 'image/jpeg'],
    ['noextension', ''],
  ])('%s（%j）不是 HEIC', (name, type) => {
    expect(isHeicFile(file(name, type))).toBe(false)
  })
})

describe('decodeImage 的像素上限', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const stubDecoder = (width: number, height: number) => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }))
    return close
  }

  it('上限是 64 百萬像素', () => {
    expect(MAX_MEGAPIXELS).toBe(64)
    expect(MAX_PIXELS).toBe(64_000_000)
  })

  it('48 MP（手機高畫素）通過', async () => {
    const close = stubDecoder(8000, 6000)
    const bitmap = await decodeImage(file('a.png', 'image/png'))
    expect(bitmap.width).toBe(8000)
    expect(close).not.toHaveBeenCalled()
  })

  it('剛好 64 MP 通過（不大於上限）', async () => {
    stubDecoder(8000, 8000)
    await expect(decodeImage(file('a.png', 'image/png'))).resolves.toBeDefined()
  })

  it('比上限多 1 個像素就被擋', async () => {
    stubDecoder(MAX_PIXELS + 1, 1)
    await expect(decodeImage(file('a.png', 'image/png'))).rejects.toMatchObject({
      code: 'tooLarge',
    })
  })

  it('72 MP 被擋，錯誤帶著上限數字，並釋放已解碼的圖', async () => {
    const close = stubDecoder(9000, 8000)
    const error = await decodeImage(file('a.png', 'image/png')).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ImageError)
    expect((error as ImageError).code).toBe('tooLarge')
    expect((error as ImageError).detail).toBe(64)
    expect(close).toHaveBeenCalledOnce()
  })

  it('20000×20000 的超大圖被擋', async () => {
    stubDecoder(20000, 20000)
    await expect(decodeImage(file('huge.png', 'image/png'))).rejects.toMatchObject({
      code: 'tooLarge',
    })
  })
})

describe('decodeImage 的解碼失敗', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('不是 HEIC 的檔案解碼失敗，原樣丟出原本的錯誤（不退回 HEIC 解碼器）', async () => {
    const original = new Error('decode failed')
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(original))
    await expect(decodeImage(file('broken.png', 'image/png'))).rejects.toBe(original)
  })
})
