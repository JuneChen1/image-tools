import { ImageError, renderBlob } from './image'
import { MAX_MEGAPIXELS, MAX_PIXELS } from './limits'

/** 預覽圖的最長邊上限；預覽只是給人看，不需要原尺寸 */
const PREVIEW_MAX_EDGE = 1600

export interface ProbeResult {
  width: number
  height: number
  /** 瀏覽器無法直接顯示的格式（HEIC）才有，是轉好的預覽圖 */
  preview?: Blob
}

/** 瀏覽器常把 .heic 的 type 回報成空字串，所以副檔名也要看 */
export function isHeicFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /^image\/hei[cf]/.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

/** 用 WebAssembly 解 HEIC。解碼器約 2 MB，只有遇到 HEIC 才動態載入 */
async function decodeHeic(file: File): Promise<ImageBitmap> {
  const { default: createLibheif } = await import('libheif-js/libheif-wasm/libheif-bundle.mjs')
  const libheif = await createLibheif()

  const images = new libheif.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()))
  const image = images[0]
  if (!image) throw new Error('HEIC contains no image')

  const width = image.get_width()
  const height = image.get_height()
  const target = { data: new Uint8ClampedArray(width * height * 4), width, height }
  await new Promise<void>((resolve, reject) => {
    image.display(target, (result) =>
      result ? resolve() : reject(new Error('HEIF processing error')),
    )
  })
  return createImageBitmap(new ImageData(target.data, width, height))
}

/**
 * 把檔案解碼成 ImageBitmap（會依 EXIF 轉正）。
 * 先交給瀏覽器原生解碼；HEIC 在多數瀏覽器不支援，原生失敗才改用 WebAssembly。
 */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (error) {
    if (!isHeicFile(file)) throw error
    bitmap = await decodeHeic(file)
  }

  // 像素太多的圖後面一定會失敗（記憶體、Canvas 上限），在這裡就擋下並說清楚原因
  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close()
    throw new ImageError('tooLarge', MAX_MEGAPIXELS)
  }
  return bitmap
}

/** 取得尺寸；HEIC 另外產生瀏覽器能顯示的預覽圖。主執行緒與 Worker 共用 */
export async function probeImageFile(file: File): Promise<ProbeResult> {
  const bitmap = await decodeImage(file)
  try {
    const result: ProbeResult = { width: bitmap.width, height: bitmap.height }
    if (isHeicFile(file)) {
      // 用 PNG：每個瀏覽器都能編碼，且保留透明
      const { blob } = await renderBlob(bitmap, {
        maxEdge: PREVIEW_MAX_EDGE,
        format: 'image/png',
        quality: 1,
        background: '#ffffff',
      })
      result.preview = blob
    }
    return result
  } finally {
    bitmap.close()
  }
}
