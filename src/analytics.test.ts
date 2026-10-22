import { describe, expect, it, vi } from 'vitest'
import { createAnalytics, isAnalyticsEnabled, type AnalyticsDeps } from './analytics'

const ID = 'G-EJQ7YWC4GN'

function setup(overrides: Partial<AnalyticsDeps> = {}) {
  const appended: { async: boolean; src: string }[] = []
  const clearCookies = vi.fn()
  const deps: AnalyticsDeps = {
    id: ID,
    production: true,
    doNotTrack: null,
    win: {},
    doc: {
      head: {
        appendChild: (node) => appended.push(node as unknown as { async: boolean; src: string }),
      },
      createElement: () => ({ async: false, src: '' }),
    },
    clearCookies,
    ...overrides,
  }
  return { deps, appended, clearCookies, analytics: createAnalytics(deps) }
}

const entries = (deps: AnalyticsDeps) =>
  (deps.win.dataLayer ?? []).map((e) => Array.from(e as ArrayLike<unknown>))

describe('isAnalyticsEnabled', () => {
  it('正式版 + 有效的衡量 ID + 沒開「不要追蹤」才可用', () => {
    expect(isAnalyticsEnabled({ id: ID, production: true, doNotTrack: null })).toBe(true)
    expect(isAnalyticsEnabled({ id: ID, production: true, doNotTrack: '0' })).toBe(true)
    expect(isAnalyticsEnabled({ id: ID, production: true })).toBe(true)
  })

  it('開發或測試環境不可用', () => {
    expect(isAnalyticsEnabled({ id: ID, production: false })).toBe(false)
  })

  it('沒有 ID 不可用', () => {
    expect(isAnalyticsEnabled({ production: true })).toBe(false)
    expect(isAnalyticsEnabled({ id: '', production: true })).toBe(false)
  })

  it.each(['', 'UA-12345-1', 'g-lowercase', 'G-', 'G-ABC DEF', 'G-ABC<script>', 'https://x'])(
    '格式不對的 ID %j 不可用',
    (id) => {
      expect(isAnalyticsEnabled({ id, production: true })).toBe(false)
    },
  )

  it('使用者開啟瀏覽器的「不要追蹤」時不可用', () => {
    expect(isAnalyticsEnabled({ id: ID, production: true, doNotTrack: '1' })).toBe(false)
  })
})

describe('available：決定要不要顯示同意橫幅', () => {
  it('可用時是 true，但還沒載入任何東西（要等使用者同意）', () => {
    const { analytics, appended, deps } = setup()
    expect(analytics.available()).toBe(true)
    expect(appended).toHaveLength(0)
    expect(deps.win.dataLayer).toBeUndefined()
  })

  it.each([
    ['開發環境', { production: false }],
    ['沒有 ID', { id: undefined }],
    ['開啟不要追蹤', { doNotTrack: '1' }],
  ])('%s：是 false（不需要顯示橫幅）', (_name, overrides) => {
    expect(setup(overrides).analytics.available()).toBe(false)
  })
})

describe('init（使用者同意之後）', () => {
  it('載入 gtag.js 並設定，回傳 true', () => {
    const { analytics, appended, deps } = setup()
    expect(analytics.init()).toBe(true)
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    expect(appended[0].async).toBe(true)
    expect(deps.win.dataLayer).toHaveLength(2) // js、config
    expect(deps.win[`ga-disable-${ID}`]).toBe(false)
  })

  it('config 關閉廣告相關功能', () => {
    const { analytics, deps } = setup()
    analytics.init()
    const config = entries(deps)[1]
    expect(config[0]).toBe('config')
    expect(config[1]).toBe(ID)
    expect(config[2]).toMatchObject({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
  })

  it('推進 dataLayer 的是 arguments 物件，不是一般陣列（gtag.js 只認前者）', () => {
    const { analytics, deps } = setup()
    analytics.init()
    for (const entry of deps.win.dataLayer!) {
      expect(Array.isArray(entry)).toBe(false)
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
    }
  })

  it('重複呼叫只會載入一次', () => {
    const { analytics, appended } = setup()
    analytics.init()
    expect(analytics.init()).toBe(true)
    expect(appended).toHaveLength(1)
  })

  it.each([
    ['開發環境', { production: false }],
    ['沒有 ID', { id: undefined }],
    ['開啟不要追蹤', { doNotTrack: '1' }],
  ])('%s：即使呼叫也不載入任何東西，回傳 false', (_name, overrides) => {
    const { analytics, appended, deps } = setup(overrides)
    expect(analytics.init()).toBe(false)
    expect(appended).toHaveLength(0)
    expect(deps.win.dataLayer).toBeUndefined()
  })
})

describe('disable 與再次同意（撤回同意）', () => {
  it('撤回：打開停用開關、清掉 GA 的 cookie、之後不再送事件', () => {
    const { analytics, deps, clearCookies } = setup()
    analytics.init()
    analytics.disable()
    expect(deps.win[`ga-disable-${ID}`]).toBe(true)
    expect(clearCookies).toHaveBeenCalledWith(['_ga', '_ga_EJQ7YWC4GN'])
    const before = deps.win.dataLayer!.length
    analytics.track('download_zip', { tool: 'split' })
    expect(deps.win.dataLayer).toHaveLength(before)
  })

  it('撤回後再同意：不會重複載入 gtag.js，只重新設定並解除停用', () => {
    const { analytics, appended, deps } = setup()
    analytics.init()
    analytics.disable()
    expect(analytics.init()).toBe(true)
    expect(appended).toHaveLength(1)
    expect(deps.win[`ga-disable-${ID}`]).toBe(false)
    analytics.track('download_zip', { tool: 'split' })
    expect(entries(deps).at(-1)).toEqual(['event', 'download_zip', { tool: 'split' }])
  })

  it('從沒同意過就撤回，也能安全呼叫', () => {
    const { analytics, deps } = setup()
    expect(() => analytics.disable()).not.toThrow()
    expect(deps.win[`ga-disable-${ID}`]).toBe(true)
  })

  it('沒有 ID 時撤回不做任何事', () => {
    const { analytics, clearCookies } = setup({ id: undefined })
    analytics.disable()
    expect(clearCookies).not.toHaveBeenCalled()
  })
})

describe('track', () => {
  it('沒有同意（還沒 init）就不會送出', () => {
    const { analytics, deps } = setup()
    analytics.track('download_zip', { tool: 'split' })
    expect(deps.win.dataLayer).toBeUndefined()
  })

  it('環境不可用時什麼都不做，可以放心在任何地方呼叫', () => {
    const { analytics, deps } = setup({ production: false })
    analytics.init()
    analytics.track('download_zip', { tool: 'split' })
    expect(deps.win.dataLayer).toBeUndefined()
  })

  it('同意後送出事件名稱與參數', () => {
    const { analytics, deps } = setup()
    analytics.init()
    analytics.track('download_zip', { tool: 'split', file_count: 3 })
    expect(entries(deps).at(-1)).toEqual(['event', 'download_zip', { tool: 'split', file_count: 3 }])
  })

  it('沒有參數時送出空物件', () => {
    const { analytics, deps } = setup()
    analytics.init()
    analytics.track('tool_open')
    expect(entries(deps).at(-1)).toEqual(['event', 'tool_open', {}])
  })
})

describe('隱私：事件參數的型別', () => {
  it('參數只允許字串與數字（編譯期檢查），不能把檔案物件丟進去', () => {
    const { analytics } = setup()
    analytics.init()
    // @ts-expect-error 參數值不能是 File / Blob 這類物件
    analytics.track('bad', { file: new Blob(['x']) })
  })
})
