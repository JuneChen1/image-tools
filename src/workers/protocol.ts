import type { ProbeResult } from '../utils/decode'
import type { ImageErrorCode, RenderOptions, RenderResult } from '../utils/image'

export interface RenderRequest {
  type: 'render'
  id: number
  file: File
  /** 同一張圖要輸出的多個結果（例如切圖的每一張），Worker 只解碼一次 */
  jobs: RenderOptions[]
}

/** 只取得尺寸（HEIC 另外產生預覽圖），不輸出結果 */
export interface ProbeRequest {
  type: 'probe'
  id: number
  file: File
}

export interface CancelRequest {
  type: 'cancel'
  id: number
}

/** 主執行緒 → Worker */
export type WorkerRequest = RenderRequest | ProbeRequest | CancelRequest

export type OkResponse =
  | { id: number; ok: true; results: RenderResult[] }
  | { id: number; ok: true; probe: ProbeResult }

/** Worker → 主執行緒 */
export type WorkerResponse =
  | OkResponse
  | { id: number; ok: false; code: ImageErrorCode; detail?: string | number }
  | { id: number; ok: false; cancelled: true }
  | { id: number; ok: false; message: string }
