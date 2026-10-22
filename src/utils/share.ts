export interface NamedBlob {
  name: string
  blob: Blob
}

/** 把處理結果包成 File（分享選單需要有檔名與類型的 File），順序維持不變 */
export function toFiles(items: NamedBlob[]): File[] {
  return items.map((item) => new File([item.blob], item.name, { type: item.blob.type }))
}

/**
 * 這個瀏覽器（與這些檔案）能不能叫出系統的分享選單。
 * 手機上選單裡有「儲存影像」，可以直接存進相簿，也能分享給 X 等 App；
 * 不支援的環境回傳 false，畫面上就不顯示這個按鈕
 */
export function canShareFiles(files: File[]): boolean {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return false
  }
  try {
    return files.length > 0 && navigator.canShare({ files })
  } catch {
    return false
  }
}

/** 主要輸入方式是手指（手機、平板）。桌機用滑鼠，不需要「手機請點這個」的說明 */
export function isTouchDevice(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
}

export type ShareResult = 'shared' | 'cancelled'

/**
 * 叫出分享選單。必須在使用者點擊的當下呼叫（前面不能有 await），否則瀏覽器會拒絕。
 * 使用者自己關掉選單算「cancelled」，不是錯誤；其他失敗會把錯誤丟出去
 */
export async function shareFiles(files: File[]): Promise<ShareResult> {
  try {
    await navigator.share({ files })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  }
}
