import type { ImageErrorCode, RenderOptions, RenderResult } from '../utils/image'

/** 主執行緒 → Worker */
export type WorkerRequest =
  | {
      type: 'render'
      id: number
      file: File
      /** 同一張圖要輸出的多個結果（例如切圖的每一張），Worker 只解碼一次 */
      jobs: RenderOptions[]
    }
  | { type: 'cancel'; id: number }

/** Worker → 主執行緒 */
export type WorkerResponse =
  | { id: number; ok: true; results: RenderResult[] }
  | { id: number; ok: false; code: ImageErrorCode; detail?: string | number }
  | { id: number; ok: false; cancelled: true }
  | { id: number; ok: false; message: string }
