/** AVIF 編碼：瀏覽器的 Canvas 無法輸出 AVIF，改用 WebAssembly 編碼器 */
const AVIF_SPEED = 7 // 0（最慢、檔案最小）～ 10（最快）

export async function encodeAvif(image: ImageData, quality: number): Promise<Blob> {
  // 動態載入：編碼器約 3.5 MB，只有使用者選 AVIF 時才下載。
  // 直接指定 encode.js，避免連解碼器（用不到）一起打包
  const { default: encode } = await import('@jsquash/avif/encode.js')
  const buffer = await encode(image, { quality, speed: AVIF_SPEED })
  return new Blob([buffer], { type: 'image/avif' })
}
