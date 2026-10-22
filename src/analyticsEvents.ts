/**
 * 要送給 GA 的自訂事件。所有參數都在這裡產生，原則：
 * - 只放「固定的枚舉值」（工具名、格式縮寫、原因代碼）與張數，**絕不放檔名、檔案大小、圖片內容或錯誤訊息文字**
 * - 參數產生器都是純函式，方便測試；真正送出的 trackXxx 只是薄薄一層包裝
 */
import { trackEvent, type EventParams } from './analytics'
import { isHeicFile } from './utils/decode'
import { ImageError } from './utils/image'

export type Tool = 'split' | 'compress' | 'convert'
export type SaveMethod = 'zip' | 'single' | 'share'
export type RejectReason =
  | 'unsupported'
  | 'oversized'
  | 'too_many_files'
  | 'over_limit'
  | 'too_many_pixels'
  | 'too_narrow'

const SHORT_FORMAT: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heic',
}

/** 把一組檔案類型整理成 jpeg / png / webp / avif / heic / other，混合的是 mixed，沒有東西是 none */
export function formatLabel(types: string[]): string {
  if (types.length === 0) return 'none'
  const labels = new Set(types.map((type) => SHORT_FORMAT[type] ?? 'other'))
  return labels.size === 1 ? [...labels][0] : 'mixed'
}

/** 輸入檔案的格式。HEIC 的 type 常是空字串，所以要另外看副檔名 */
export function inputFormatOf(files: Pick<File, 'name' | 'type'>[]): string {
  return formatLabel(files.map((file) => (isHeicFile(file) ? 'image/heic' : file.type)))
}

export function filesAddedParams(tool: Tool, files: Pick<File, 'name' | 'type'>[]): EventParams {
  return { tool, file_count: files.length, input_format: inputFormatOf(files) }
}

export function saveResultParams(input: {
  tool: Tool
  method: SaveMethod
  blobs: Pick<Blob, 'type'>[]
  /** 切圖才有：切成幾張 */
  splitParts?: number
}): EventParams {
  return {
    tool: input.tool,
    method: input.method,
    output_format: formatLabel(input.blobs.map((blob) => blob.type)),
    file_count: input.blobs.length,
    ...(input.splitParts ? { split_parts: input.splitParts } : {}),
  }
}

export interface Rejection {
  reason: RejectReason
  count: number
}

/** 上傳區挑檔後，哪些原因擋掉了多少檔案（沒有被擋的就回傳空陣列） */
export function rejectionsOf(
  selection: { unsupported: string[]; oversized: string[]; tooMany: boolean; skipped: number },
  droppedCount: number,
): Rejection[] {
  const list: Rejection[] = []
  if (selection.unsupported.length > 0) list.push({ reason: 'unsupported', count: selection.unsupported.length })
  if (selection.oversized.length > 0) list.push({ reason: 'oversized', count: selection.oversized.length })
  if (selection.tooMany) list.push({ reason: 'too_many_files', count: droppedCount })
  if (selection.skipped > 0) list.push({ reason: 'over_limit', count: selection.skipped })
  return list
}

const KNOWN_ERROR_CODES = new Set([
  'canvasTooLarge',
  'encodeFailed',
  'formatUnsupported',
  'readFailed',
  'shareFailed',
])

/**
 * 處理失敗要回報成哪個事件：
 * 「圖片本身不合規格」（像素太多、寬度太小）算 upload_rejected，其餘是 processing_error。
 * 錯誤代碼只收已知的幾個，其他一律寫成 unknown，避免把任意文字送出去
 */
export function errorEventOf(
  tool: Tool,
  code: string,
  outputFormat: string,
): { name: 'upload_rejected' | 'processing_error'; params: EventParams } {
  if (code === 'tooLarge') {
    return { name: 'upload_rejected', params: { tool, reason: 'too_many_pixels', count: 1 } }
  }
  if (code === 'tooNarrow') {
    return { name: 'upload_rejected', params: { tool, reason: 'too_narrow', count: 1 } }
  }
  return {
    name: 'processing_error',
    params: { tool, code: KNOWN_ERROR_CODES.has(code) ? code : 'unknown', output_format: outputFormat },
  }
}

/** 回傳一個函式：同一個 key 只有第一次回傳 true，用來避免同一個錯誤重複回報 */
export function createOnce(): (key: string) => boolean {
  const seen = new Set<string>()
  return (key) => {
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
}

export const trackFilesAdded = (tool: Tool, files: Pick<File, 'name' | 'type'>[]) =>
  trackEvent('files_added', filesAddedParams(tool, files))

export const trackSaveResult = (input: Parameters<typeof saveResultParams>[0]) =>
  trackEvent('save_result', saveResultParams(input))

export function trackRejections(
  tool: Tool,
  selection: Parameters<typeof rejectionsOf>[0],
  droppedCount: number,
) {
  for (const rejection of rejectionsOf(selection, droppedCount)) {
    trackEvent('upload_rejected', { tool, ...rejection })
  }
}

/** 處理失敗。outputFormat 是這次要輸出的格式（MIME type），不知道就給空字串 */
export function trackError(tool: Tool, error: unknown, outputFormat: string) {
  const code = error instanceof ImageError ? error.code : 'unknown'
  const event = errorEventOf(tool, code, formatLabel(outputFormat ? [outputFormat] : []))
  trackEvent(event.name, event.params)
}

export const trackShareFailure = (tool: Tool, blobs: Pick<Blob, 'type'>[]) =>
  trackEvent('processing_error', {
    tool,
    code: 'shareFailed',
    output_format: formatLabel(blobs.map((blob) => blob.type)),
  })
