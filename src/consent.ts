export type Consent = 'granted' | 'denied'

const KEY = 'image-tools-consent'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined // 無痕模式或封鎖網站資料時，存取 localStorage 可能丟出例外
  }
}

/** 使用者之前的選擇；沒選過、或讀不到（無痕模式）都回傳 null，等於還沒同意 */
export function readConsent(storage: ReadableStorage | undefined = defaultStorage()): Consent | null {
  try {
    const value = storage?.getItem(KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

export function saveConsent(
  value: Consent,
  storage: WritableStorage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(KEY, value)
  } catch {
    // 存不了就算了，下次開啟會再問一次
  }
}
