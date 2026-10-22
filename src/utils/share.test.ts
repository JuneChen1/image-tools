import { afterEach, describe, expect, it, vi } from 'vitest'
import { canShareFiles, isTouchDevice, shareFiles, toFiles } from './share'

const file = (name: string) => new File(['x'], name, { type: 'image/png' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toFiles', () => {
  it('保留檔名、類型與順序', () => {
    const files = toFiles([
      { name: 'a_1.png', blob: new Blob(['1'], { type: 'image/png' }) },
      { name: 'a_2.avif', blob: new Blob(['22'], { type: 'image/avif' }) },
      { name: 'a_3.jpg', blob: new Blob(['333'], { type: 'image/jpeg' }) },
    ])
    expect(files.map((f) => f.name)).toEqual(['a_1.png', 'a_2.avif', 'a_3.jpg'])
    expect(files.map((f) => f.type)).toEqual(['image/png', 'image/avif', 'image/jpeg'])
    expect(files.map((f) => f.size)).toEqual([1, 2, 3])
  })

  it('空清單回傳空陣列', () => {
    expect(toFiles([])).toEqual([])
  })
})

describe('canShareFiles', () => {
  it('沒有 navigator（非瀏覽器環境）時是 false', () => {
    vi.stubGlobal('navigator', undefined)
    expect(canShareFiles([file('a.png')])).toBe(false)
  })

  it('瀏覽器沒有 share 或 canShare 時是 false', () => {
    vi.stubGlobal('navigator', { canShare: () => true })
    expect(canShareFiles([file('a.png')])).toBe(false)
    vi.stubGlobal('navigator', { share: vi.fn() })
    expect(canShareFiles([file('a.png')])).toBe(false)
  })

  it('瀏覽器說這些檔案不能分享時是 false', () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => false })
    expect(canShareFiles([file('a.png')])).toBe(false)
  })

  it('沒有任何檔案時是 false（不顯示按鈕）', () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => true })
    expect(canShareFiles([])).toBe(false)
  })

  it('支援時是 true，並且把檔案交給 canShare 檢查', () => {
    const canShare = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { share: vi.fn(), canShare })
    const files = [file('a.png'), file('b.png')]
    expect(canShareFiles(files)).toBe(true)
    expect(canShare).toHaveBeenCalledWith({ files })
  })

  it('canShare 丟出例外時當作不支援', () => {
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: () => {
        throw new TypeError('bad')
      },
    })
    expect(canShareFiles([file('a.png')])).toBe(false)
  })
})

describe('isTouchDevice', () => {
  it('沒有 matchMedia（非瀏覽器環境）時是 false', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(isTouchDevice()).toBe(false)
  })

  it('主要輸入是手指（pointer: coarse）時是 true，並且問的是這個條件', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMedia)
    expect(isTouchDevice()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)')
  })

  it('用滑鼠的桌機是 false', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    expect(isTouchDevice()).toBe(false)
  })
})

describe('shareFiles', () => {
  it('成功時把檔案（依順序）交給 navigator.share，回傳 shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    const files = [file('1.png'), file('2.png'), file('3.png')]
    await expect(shareFiles(files)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledOnce()
    expect(share).toHaveBeenCalledWith({ files })
  })

  it('使用者自己關掉選單（AbortError）算取消，不是錯誤', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    vi.stubGlobal('navigator', { share, canShare: () => true })
    await expect(shareFiles([file('a.png')])).resolves.toBe('cancelled')
  })

  it('其他失敗（例如沒有使用者操作、類型不支援）會把錯誤丟出去', async () => {
    const error = new DOMException('no user activation', 'NotAllowedError')
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(error), canShare: () => true })
    await expect(shareFiles([file('a.png')])).rejects.toBe(error)
  })

  it('不是 DOMException 的錯誤也會丟出去', async () => {
    const error = new Error('boom')
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(error), canShare: () => true })
    await expect(shareFiles([file('a.png')])).rejects.toBe(error)
  })
})
