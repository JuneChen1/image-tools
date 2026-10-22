import type { OkResponse, WorkerRequest, WorkerResponse } from '../workers/protocol'
import { decodeImage, probeImageFile, type ProbeResult } from './decode'
import { ImageError, renderBlob, type RenderOptions, type RenderResult } from './image'

export type { ProbeResult }

/** 呼叫端中途取消（例如使用者又改了設定），結果不需要了 */
export class AbortedError extends Error {
  constructor() {
    super('aborted')
  }
}

interface Pending {
  resolve: (response: OkResponse) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let workerBroken = false
let nextId = 0
const pending = new Map<number, Pending>()

function workerSupported(): boolean {
  return (
    !workerBroken &&
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function'
  )
}

function failAll(error: Error) {
  for (const entry of pending.values()) entry.reject(error)
  pending.clear()
}

function getWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('../workers/image.worker.ts', import.meta.url), {
    type: 'module',
  })

  created.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const entry = pending.get(response.id)
    if (!entry) return // 已被取消的工作，結果直接丟掉
    pending.delete(response.id)

    if (response.ok) entry.resolve(response)
    else if ('cancelled' in response) entry.reject(new AbortedError())
    else if ('code' in response) entry.reject(new ImageError(response.code, response.detail))
    else entry.reject(new Error(response.message))
  }

  // Worker 本身載入或執行失敗：通知所有等待中的工作，並丟掉這個 Worker
  created.onerror = (event) => {
    event.preventDefault()
    created.terminate()
    if (worker === created) worker = null
    failAll(new Error('worker crashed'))
  }

  worker = created
  return created
}

/** 送一個工作給 Worker，等它回覆；signal 被取消時會通知 Worker 並丟掉結果 */
function dispatch(
  build: (id: number) => WorkerRequest,
  signal?: AbortSignal,
): Promise<OkResponse> {
  if (signal?.aborted) return Promise.reject(new AbortedError())

  const target = getWorker()
  const id = nextId++

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      if (!pending.delete(id)) return
      target.postMessage({ type: 'cancel', id } satisfies WorkerRequest)
      reject(new AbortedError())
    }

    pending.set(id, {
      resolve: (response) => {
        signal?.removeEventListener('abort', onAbort)
        resolve(response)
      },
      reject: (error) => {
        signal?.removeEventListener('abort', onAbort)
        reject(error)
      },
    })
    signal?.addEventListener('abort', onAbort, { once: true })
    target.postMessage(build(id))
  })
}

/** Worker 不能用時的備案：在主執行緒處理，功能一樣但處理期間畫面會卡住 */
async function renderOnMainThread(
  file: File,
  jobs: RenderOptions[],
  signal?: AbortSignal,
): Promise<RenderResult[]> {
  let bitmap: ImageBitmap
  try {
    bitmap = await decodeImage(file)
  } catch {
    throw new ImageError('readFailed')
  }
  try {
    const results: RenderResult[] = []
    for (const job of jobs) {
      if (signal?.aborted) throw new AbortedError()
      results.push(await renderBlob(bitmap, job))
    }
    return results
  } finally {
    bitmap.close()
  }
}

async function probeOnMainThread(file: File): Promise<ProbeResult> {
  try {
    return await probeImageFile(file)
  } catch (error) {
    throw error instanceof ImageError ? error : new ImageError('readFailed')
  }
}

/** 先試 Worker；Worker 本身出問題（不是圖片的問題）就改用主執行緒，之後也都走主執行緒 */
async function withFallback<T>(inWorker: () => Promise<T>, onMainThread: () => Promise<T>): Promise<T> {
  if (workerSupported()) {
    try {
      return await inWorker()
    } catch (error) {
      if (error instanceof ImageError || error instanceof AbortedError) throw error
      console.warn('Image worker failed, falling back to main thread', error)
      workerBroken = true
    }
  }
  return onMainThread()
}

/**
 * 處理一張圖，輸出 jobs 指定的多個結果（順序與 jobs 相同）。
 * 預設在 Web Worker 內處理，畫面不會被大圖或 AVIF 編碼卡住。
 */
export function processImage(
  file: File,
  jobs: RenderOptions[],
  signal?: AbortSignal,
): Promise<RenderResult[]> {
  return withFallback(
    async () => {
      const response = await dispatch((id) => ({ type: 'render', id, file, jobs }), signal)
      if (!('results' in response)) throw new Error('unexpected worker response')
      return response.results
    },
    () => renderOnMainThread(file, jobs, signal),
  )
}

/** 取得圖片尺寸；HEIC 等瀏覽器無法直接顯示的格式另外附上預覽圖 */
export function probeImage(file: File, signal?: AbortSignal): Promise<ProbeResult> {
  return withFallback(
    async () => {
      const response = await dispatch((id) => ({ type: 'probe', id, file }), signal)
      if (!('probe' in response)) throw new Error('unexpected worker response')
      return response.probe
    },
    () => probeOnMainThread(file),
  )
}
