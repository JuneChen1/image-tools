import { describe, expect, it, vi } from 'vitest'
import { readConsent, saveConsent } from './consent'

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [['image-tools-consent', initial]])
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

describe('readConsent', () => {
  it('沒選過是 null（等於還沒同意）', () => {
    expect(readConsent(memory())).toBeNull()
  })

  it.each(['granted', 'denied'] as const)('讀得到之前存的 %s', (value) => {
    expect(readConsent(memory(value))).toBe(value)
  })

  it.each(['yes', 'true', '1', 'GRANTED', ''])('不認得的值 %j 當作沒選過', (value) => {
    expect(readConsent(memory(value))).toBeNull()
  })

  it('讀取丟出例外（無痕模式、封鎖網站資料）時是 null，不會讓程式壞掉', () => {
    const broken = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    }
    expect(readConsent(broken)).toBeNull()
  })

  it('沒有 localStorage 時是 null', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readConsent()).toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('saveConsent', () => {
  it('存了之後讀得回來', () => {
    const storage = memory()
    saveConsent('granted', storage)
    expect(readConsent(storage)).toBe('granted')
    saveConsent('denied', storage)
    expect(readConsent(storage)).toBe('denied')
  })

  it('寫入丟出例外時不會讓程式壞掉', () => {
    const broken = {
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
    }
    expect(() => saveConsent('granted', broken)).not.toThrow()
  })
})
