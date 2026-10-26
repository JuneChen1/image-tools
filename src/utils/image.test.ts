import { describe, expect, it } from 'vitest'
import {
  FORMAT_EXT,
  FORMAT_LABEL,
  ImageError,
  baseName,
  combineLayout,
  formatSize,
  resolveOutputFormat,
  splitBounds,
  uniqueNames,
  type Format,
} from './image'

const FORMATS: Format[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

describe('combineLayout', () => {
  it('同樣寬度、沒有分隔線：直接上下相接，外圍沒有留白', () => {
    expect(combineLayout([{ width: 100, height: 50 }, { width: 100, height: 70 }], false)).toEqual({
      width: 100,
      height: 120,
      tiles: [{ x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 50, w: 100, h: 70 }],
      gap: 0,
    })
  })

  it('有分隔線：圖與圖之間與外圍都留間隔（內容寬 1000 時 8 px）', () => {
    const layout = combineLayout(
      [{ width: 1000, height: 100 }, { width: 1000, height: 100 }, { width: 1000, height: 100 }],
      true,
    )
    expect(layout.gap).toBe(8)
    expect(layout.width).toBe(1016)
    expect(layout.tiles.map((t) => [t.x, t.y])).toEqual([[8, 8], [8, 116], [8, 224]])
    expect(layout.height).toBe(332)
  })

  it('分隔線最少 2 px', () => {
    expect(combineLayout([{ width: 100, height: 10 }, { width: 100, height: 10 }], true).gap).toBe(2)
  })

  it('寬度不同：以最寬的為準，較窄的等比例放大', () => {
    const layout = combineLayout([{ width: 200, height: 100 }, { width: 100, height: 100 }], false)
    expect(layout.width).toBe(200)
    expect(layout.tiles.map((t) => [t.w, t.h])).toEqual([[200, 100], [200, 200]])
    expect(layout.height).toBe(300)
  })
})

describe('splitBounds', () => {
  it('把 1001 px 切成 3 張：334 / 333 / 334', () => {
    expect(splitBounds(1001, 3)).toEqual([0, 334, 667, 1001])
  })

  it('把 1001 px 切成 4 張：250 / 251 / 250 / 250', () => {
    expect(splitBounds(1001, 4)).toEqual([0, 250, 501, 751, 1001])
  })

  it('整除時每張一樣寬', () => {
    expect(splitBounds(900, 3)).toEqual([0, 300, 600, 900])
  })

  // 切圖拼回去要和原圖一致：不漏像素、不重疊、每張寬度最多差 1
  it.each([3, 4, 5, 100, 1001, 4032, 8000])('寬度 %i：邊界連續、涵蓋全寬、各張寬度差不超過 1', (width) => {
    for (const parts of [2, 3, 4]) {
      // 寬度比張數還小時不可能每張都有像素；切圖頁本來就會拒絕這種圖（「圖片寬度太小」）
      if (parts > width) continue
      const bounds = splitBounds(width, parts)
      expect(bounds).toHaveLength(parts + 1)
      expect(bounds[0]).toBe(0)
      expect(bounds[parts]).toBe(width)
      const widths = bounds.slice(1).map((b, i) => b - bounds[i])
      expect(widths.every((w) => w > 0)).toBe(true)
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
      expect(widths.reduce((a, b) => a + b, 0)).toBe(width)
    }
  })
})

describe('formatSize', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.00 MB'],
    [1.5 * 1024 * 1024, '1.50 MB'],
    [50 * 1024 * 1024, '50.00 MB'],
  ])('%i bytes → %s', (bytes, text) => {
    expect(formatSize(bytes)).toBe(text)
  })
})

describe('baseName', () => {
  it.each([
    ['photo.png', 'photo'],
    ['a.b.c.jpg', 'a.b.c'],
    ['IMG_001.HEIC', 'IMG_001'],
    ['noextension', 'noextension'],
    ['.hidden', '.hidden'],
  ])('%s → %s', (input, expected) => {
    expect(baseName(input)).toBe(expected)
  })
})

describe('uniqueNames', () => {
  it('同名檔案加上 (2)、(3)，避免 ZIP 內互相覆蓋', () => {
    expect(uniqueNames(['a.png', 'a.png', 'b.png', 'a.png'])).toEqual([
      'a.png',
      'a (2).png',
      'b.png',
      'a (3).png',
    ])
  })

  it('沒有副檔名也能處理', () => {
    expect(uniqueNames(['x', 'x'])).toEqual(['x', 'x (2)'])
  })

  it('沒有重複時原樣回傳', () => {
    expect(uniqueNames(['a.png', 'b.png'])).toEqual(['a.png', 'b.png'])
  })
})

describe('輸出格式的對照表', () => {
  it('每種格式都有標籤與副檔名', () => {
    expect(Object.keys(FORMAT_LABEL).sort()).toEqual([...FORMATS].sort())
    expect(Object.keys(FORMAT_EXT).sort()).toEqual([...FORMATS].sort())
  })

  it('標籤與副檔名正確', () => {
    expect(FORMAT_LABEL).toEqual({
      'image/jpeg': 'JPEG',
      'image/png': 'PNG',
      'image/webp': 'WebP',
      'image/avif': 'AVIF',
    })
    expect(FORMAT_EXT).toEqual({
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
    })
  })
})

describe('resolveOutputFormat', () => {
  describe('維持原格式', () => {
    it.each(['image/png', 'image/webp', 'image/avif'])('%s 維持原格式', (type) => {
      expect(resolveOutputFormat(type, 'keep')).toBe(type)
    })

    it.each(['image/jpeg', 'image/heic', 'image/heif', '', 'image/gif'])(
      '%j 輸出 JPEG',
      (type) => {
        expect(resolveOutputFormat(type, 'keep')).toBe('image/jpeg')
      },
    )
  })

  it('指定格式時不管原格式是什麼都照指定', () => {
    expect(resolveOutputFormat('image/png', 'image/avif')).toBe('image/avif')
    expect(resolveOutputFormat('', 'image/webp')).toBe('image/webp')
    expect(resolveOutputFormat('image/jpeg', 'image/png')).toBe('image/png')
  })
})

describe('ImageError', () => {
  it('帶代碼與參數，並且是 Error', () => {
    const error = new ImageError('tooNarrow', 3)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ImageError)
    expect(error.code).toBe('tooNarrow')
    expect(error.detail).toBe(3)
  })

  it('沒有參數時 detail 是 undefined', () => {
    expect(new ImageError('readFailed').detail).toBeUndefined()
  })
})
