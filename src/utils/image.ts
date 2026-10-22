export type Format = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'

export const FORMAT_LABEL: Record<Format, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
}

export const FORMAT_EXT: Record<Format, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export type ImageErrorCode =
  | 'canvasTooLarge'
  | 'encodeFailed'
  | 'formatUnsupported'
  | 'readFailed'
  | 'tooNarrow'

/** 錯誤只帶代碼與參數，顯示文字交給 i18n，這樣切換語言時訊息會跟著變 */
export class ImageError extends Error {
  code: ImageErrorCode
  detail?: string | number

  constructor(code: ImageErrorCode, detail?: string | number) {
    super(code)
    this.code = code
    this.detail = detail
  }
}

export interface Crop {
  x: number
  y: number
  w: number
  h: number
}

export interface RenderOptions {
  crop?: Crop
  maxEdge?: number
  format: Format
  /** 0–1，PNG 會忽略 */
  quality: number
  /** 輸出 JPEG 時用來填滿透明區域 */
  background: string
}

export interface RenderResult {
  blob: Blob
  width: number
  height: number
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

interface Surface {
  ctx: Context2D | null
  toBlob: (type: string, quality: number) => Promise<Blob | null>
}

/** 優先用 OffscreenCanvas（Worker 裡只能用它），不支援時退回一般 canvas */
function createSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(width, height)
      return {
        ctx: canvas.getContext('2d'),
        toBlob: (type, quality) => canvas.convertToBlob({ type, quality }),
      }
    } catch {
      return { ctx: null, toBlob: async () => null }
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return {
    ctx: canvas.getContext('2d'),
    toBlob: (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
  }
}

/** 這個函式不使用 document，主執行緒與 Web Worker 都能呼叫 */
export async function renderBlob(
  bitmap: ImageBitmap,
  options: RenderOptions,
): Promise<RenderResult> {
  const crop = options.crop ?? { x: 0, y: 0, w: bitmap.width, h: bitmap.height }
  const longEdge = Math.max(crop.w, crop.h)
  const scale =
    options.maxEdge && longEdge > options.maxEdge ? options.maxEdge / longEdge : 1
  const width = Math.max(1, Math.round(crop.w * scale))
  const height = Math.max(1, Math.round(crop.h * scale))

  const { ctx, toBlob } = createSurface(width, height)
  if (!ctx) throw new ImageError('canvasTooLarge')

  if (options.format === 'image/jpeg') {
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)

  // Canvas 不能輸出 AVIF，改走 WebAssembly 編碼器（保留透明）
  if (options.format === 'image/avif') {
    try {
      const { encodeAvif } = await import('./avif')
      const image = ctx.getImageData(0, 0, width, height)
      const blob = await encodeAvif(image, Math.round(options.quality * 100))
      return { blob, width, height }
    } catch (e) {
      console.error('AVIF encode failed', e)
      throw new ImageError('encodeFailed')
    }
  }

  const blob = await toBlob(options.format, options.quality).catch(() => null)
  if (!blob) throw new ImageError('encodeFailed')
  // 不支援的格式會被瀏覽器悄悄換成 PNG，這裡要擋下來
  if (blob.type !== options.format) {
    throw new ImageError('formatUnsupported', options.format)
  }
  return { blob, width, height }
}

/** 把寬度切成 n 等份的邊界，餘數像素自然分攤，不會有縫隙 */
export function splitBounds(width: number, parts: number): number[] {
  return Array.from({ length: parts + 1 }, (_, i) => Math.round((i * width) / parts))
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

/** 同名檔案加上 (2)、(3)，避免 ZIP 內互相覆蓋 */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    if (count === 1) return name
    const dot = name.lastIndexOf('.')
    return dot > 0
      ? `${name.slice(0, dot)} (${count})${name.slice(dot)}`
      : `${name} (${count})`
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadZip(
  files: { name: string; blob: Blob }[],
  zipName: string,
) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const names = uniqueNames(files.map((f) => f.name))
  files.forEach((f, i) => zip.file(names[i], f.blob))
  downloadBlob(await zip.generateAsync({ type: 'blob' }), zipName)
}
