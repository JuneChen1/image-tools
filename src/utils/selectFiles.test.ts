import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES, MAX_FILE_MB } from './limits'
import { ACCEPT_ATTR, ACCEPTED_TYPES, isAccepted, selectFiles } from './selectFiles'

const f = (name: string, type = 'image/png', size = 1000) => ({ name, type, size })
const names = (list: { name: string }[]) => list.map((x) => x.name)

describe('單檔大小上限', () => {
  it('上限是 50 MB', () => {
    expect(MAX_FILE_MB).toBe(50)
    expect(MAX_FILE_BYTES).toBe(50 * 1024 * 1024)
  })
})

describe('isAccepted / 支援的格式', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])('收 %s', (type) => {
    expect(isAccepted(f('x', type))).toBe(true)
  })

  it.each([
    ['anim.gif', 'image/gif'],
    ['logo.svg', 'image/svg+xml'],
    ['scan.tiff', 'image/tiff'],
    ['old.bmp', 'image/bmp'],
    ['clip.mp4', 'video/mp4'],
    ['doc.pdf', 'application/pdf'],
    ['noextension', ''],
  ])('不收 %s（%j）', (name, type) => {
    expect(isAccepted(f(name, type))).toBe(false)
  })

  it.each([
    ['photo.heic', ''],
    ['PHOTO.HEIC', ''],
    ['photo.heif', ''],
    ['photo.heic', 'image/heic'],
  ])('收 HEIC：%s（type %j）', (name, type) => {
    expect(isAccepted(f(name, type))).toBe(true)
  })

  it('檔案選擇視窗的 accept 含四種格式與 HEIC 副檔名', () => {
    for (const type of ACCEPTED_TYPES) expect(ACCEPT_ATTR).toContain(type)
    expect(ACCEPT_ATTR).toContain('.heic')
    expect(ACCEPT_ATTR).toContain('.heif')
  })
})

describe('selectFiles：一般篩選', () => {
  it('空清單什麼都不收', () => {
    expect(selectFiles([], { multiple: true })).toEqual({
      taken: [],
      unsupported: [],
      oversized: [],
      tooMany: false,
      skipped: 0,
    })
  })

  it('格式不支援的略過並列出檔名，其餘照收且維持順序', () => {
    const result = selectFiles([f('a.png'), f('b.gif', 'image/gif'), f('c.png')], { multiple: true })
    expect(names(result.taken)).toEqual(['a.png', 'c.png'])
    expect(result.unsupported).toEqual(['b.gif'])
  })

  it('HEIC（type 為空）照收', () => {
    const result = selectFiles([f('iphone.heic', '')], { multiple: true })
    expect(names(result.taken)).toEqual(['iphone.heic'])
    expect(result.unsupported).toEqual([])
  })
})

describe('selectFiles：單檔大小', () => {
  it('剛好 50 MB 可以', () => {
    const result = selectFiles([f('edge.png', 'image/png', MAX_FILE_BYTES)], { multiple: true })
    expect(names(result.taken)).toEqual(['edge.png'])
    expect(result.oversized).toEqual([])
  })

  it('多 1 byte 就略過並列出檔名', () => {
    const result = selectFiles([f('big.png', 'image/png', MAX_FILE_BYTES + 1)], { multiple: true })
    expect(result.taken).toEqual([])
    expect(result.oversized).toEqual(['big.png'])
  })

  it('大小與格式的問題分開統計：格式不支援的超大檔只算「不支援」', () => {
    const result = selectFiles([f('movie.mp4', 'video/mp4', MAX_FILE_BYTES * 2)], { multiple: true })
    expect(result.unsupported).toEqual(['movie.mp4'])
    expect(result.oversized).toEqual([])
  })

  it('過大的檔案不佔用張數名額', () => {
    const list = [f('big.png', 'image/png', MAX_FILE_BYTES + 1), f('a.png'), f('b.png')]
    const result = selectFiles(list, { multiple: true, maxFiles: 2 })
    expect(names(result.taken)).toEqual(['a.png', 'b.png'])
    expect(result.skipped).toBe(0)
  })
})

describe('selectFiles：只收一張的上傳區（切圖）', () => {
  it('一張照收', () => {
    const result = selectFiles([f('a.png')], { multiple: false })
    expect(names(result.taken)).toEqual(['a.png'])
    expect(result.tooMany).toBe(false)
  })

  it('兩張以上整批不處理並標記 tooMany，不悄悄只挑第一張', () => {
    const result = selectFiles([f('a.png'), f('b.png')], { multiple: false })
    expect(result.taken).toEqual([])
    expect(result.tooMany).toBe(true)
  })

  it('一張有效 + 一張不支援：照常處理有效的那張', () => {
    const result = selectFiles([f('a.png'), f('b.gif', 'image/gif')], { multiple: false })
    expect(names(result.taken)).toEqual(['a.png'])
    expect(result.unsupported).toEqual(['b.gif'])
    expect(result.tooMany).toBe(false)
  })

  it('一張有效 + 一張過大：照常處理有效的那張', () => {
    const result = selectFiles([f('a.png'), f('big.png', 'image/png', MAX_FILE_BYTES + 1)], {
      multiple: false,
    })
    expect(names(result.taken)).toEqual(['a.png'])
    expect(result.oversized).toEqual(['big.png'])
    expect(result.tooMany).toBe(false)
  })

  it('單張模式不受 maxFiles 影響', () => {
    const result = selectFiles([f('a.png')], { multiple: false, maxFiles: 0 })
    expect(names(result.taken)).toEqual(['a.png'])
  })
})

describe('selectFiles：多選的張數上限（壓縮、轉檔是 10 張）', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => f(`img${i + 1}.png`))

  it('沒設上限就不限制', () => {
    const result = selectFiles(many(40), { multiple: true })
    expect(result.taken).toHaveLength(40)
    expect(result.skipped).toBe(0)
  })

  it('未超過上限全收', () => {
    const result = selectFiles(many(8), { multiple: true, maxFiles: 10 })
    expect(result.taken).toHaveLength(8)
    expect(result.skipped).toBe(0)
  })

  it('剛好到上限全收', () => {
    const result = selectFiles(many(10), { multiple: true, maxFiles: 10 })
    expect(result.taken).toHaveLength(10)
    expect(result.skipped).toBe(0)
  })

  it('超過上限時依選取順序收到上限為止，其餘略過並計數', () => {
    const result = selectFiles(many(15), { multiple: true, maxFiles: 10 })
    expect(names(result.taken)).toEqual(many(10).map((x) => x.name))
    expect(result.skipped).toBe(5)
  })

  it('清單已有 8 張時只剩 2 個名額', () => {
    const result = selectFiles(many(5), { multiple: true, maxFiles: 10, currentCount: 8 })
    expect(names(result.taken)).toEqual(['img1.png', 'img2.png'])
    expect(result.skipped).toBe(3)
  })

  it('清單已滿時一張都不收，全部計入略過', () => {
    const result = selectFiles(many(3), { multiple: true, maxFiles: 10, currentCount: 10 })
    expect(result.taken).toEqual([])
    expect(result.skipped).toBe(3)
  })

  it('清單數量已超過上限（異常情況）也不會出現負數名額', () => {
    // 檔案數要比超出的數量多，否則 slice(0, 負數) 的結果會碰巧也是空的，測不出差別
    const result = selectFiles(many(5), { multiple: true, maxFiles: 10, currentCount: 12 })
    expect(result.taken).toEqual([])
    expect(result.skipped).toBe(5)
  })

  it('不支援的格式不算進略過的張數', () => {
    const list = [...many(10), f('x.gif', 'image/gif')]
    const result = selectFiles(list, { multiple: true, maxFiles: 10 })
    expect(result.taken).toHaveLength(10)
    expect(result.skipped).toBe(0)
    expect(result.unsupported).toEqual(['x.gif'])
  })
})
