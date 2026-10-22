import { isHeicFile } from './decode'
import { MAX_FILE_BYTES } from './limits'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/** 檔案選擇視窗的 accept 屬性；HEIC 的 type 常被回報成空字串，所以另外用副檔名放行 */
export const ACCEPT_ATTR = [...ACCEPTED_TYPES, 'image/heic', 'image/heif', '.heic', '.heif'].join(
  ',',
)

type FileLike = Pick<File, 'name' | 'type' | 'size'>

export const isAccepted = (file: FileLike) =>
  ACCEPTED_TYPES.includes(file.type) || isHeicFile(file)

export interface SelectOptions {
  /** 是否允許多張；false 是只收一張的上傳區（切圖） */
  multiple: boolean
  /** 多選時的總張數上限（含已加入的），不設就不限制 */
  maxFiles?: number
  /** 目前已加入幾張，用來算還剩多少名額 */
  currentCount?: number
}

export interface Selection<T extends FileLike> {
  /** 要交給處理的檔案，維持選取順序 */
  taken: T[]
  /** 格式不支援而略過的檔名 */
  unsupported: string[]
  /** 單檔超過大小上限而略過的檔名 */
  oversized: string[]
  /** 只收一張的上傳區卻選了多張：整批不處理（不悄悄只挑第一張） */
  tooMany: boolean
  /** 因為超過張數上限而略過的張數 */
  skipped: number
}

/**
 * 決定使用者選的（或拖進來的）檔案哪些要收、哪些略過以及為什麼。
 * 像素太多的圖要解碼後才知道，不在這裡檢查（見 decodeImage）。
 */
export function selectFiles<T extends FileLike>(
  all: T[],
  { multiple, maxFiles, currentCount = 0 }: SelectOptions,
): Selection<T> {
  const accepted = all.filter(isAccepted)
  const files = accepted.filter((f) => f.size <= MAX_FILE_BYTES)
  const unsupported = all.filter((f) => !isAccepted(f)).map((f) => f.name)
  const oversized = accepted.filter((f) => f.size > MAX_FILE_BYTES).map((f) => f.name)

  if (!multiple && files.length > 1) {
    return { taken: [], unsupported, oversized, tooMany: true, skipped: 0 }
  }

  // 多選的上傳區：依選取順序收到上限為止，超過的略過
  const room = multiple && maxFiles !== undefined ? Math.max(0, maxFiles - currentCount) : files.length
  const taken = files.slice(0, room)
  return { taken, unsupported, oversized, tooMany: false, skipped: files.length - taken.length }
}
