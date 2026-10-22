/** 單一檔案大小上限。在加入檔案時就檢查，不用等到處理 */
export const MAX_FILE_MB = 50
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

/**
 * 像素上限（單位：百萬像素）。約 8000×8000，涵蓋手機 48–50MP 與相機 61MP。
 * 失敗的主因是解碼後的像素數而不是檔案大小：一張 20000×20000 的純色 PNG 只有 0.4 MB，
 * 解碼成 RGBA 卻要約 1.6 GB，輸出時一定失敗
 */
export const MAX_MEGAPIXELS = 64
export const MAX_PIXELS = MAX_MEGAPIXELS * 1_000_000
