import type { WorkerRequest, WorkerResponse } from '../workers/protocol'
import { ImageError, renderBlob, type RenderOptions, type RenderResult } from './image'

/** 呼叫端中途取消（例如使用者又改了設定），結果不需要了 */
export class AbortedError extends Error {
  constructor() {
    super('aborted')
  }
}

interface Pending {
  resolve: (results: RenderResult[]) => void
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

    if (response.ok) entry.resolve(response.results)
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

function runInWorker(
  file: File,
  jobs: RenderOptions[],
  signal?: AbortSignal,
): Promise<RenderResult[]> {
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
      resolve: (results) => {
        signal?.removeEventListener('abort', onAbort)
        resolve(results)
      },
      reject: (error) => {
        signal?.removeEventListener('abort', onAbort)
        reject(error)
      },
    })
    signal?.addEventListener('abort', onAbort, { once: true })
    target.postMessage({ type: 'render', id, file, jobs } satisfies WorkerRequest)
  })
}

/** Worker 不能用時的備案：在主執行緒處理，功能一樣但處理期間畫面會卡住 */
async function runOnMainThread(
  file: File,
  jobs: RenderOptions[],
  signal?: AbortSignal,
): Promise<RenderResult[]> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
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

/**
 * 處理一張圖，輸出 jobs 指定的多個結果（順序與 jobs 相同）。
 * 預設在 Web Worker 內處理，畫面不會被大圖或 AVIF 編碼卡住。
 */
export async function processImage(
  file: File,
  jobs: RenderOptions[],
  signal?: AbortSignal,
): Promise<RenderResult[]> {
  if (workerSupported()) {
    try {
      return await runInWorker(file, jobs, signal)
    } catch (error) {
      if (error instanceof ImageError || error instanceof AbortedError) throw error
      // Worker 本身出問題：之後都改用主執行緒，並重做這一次
      console.warn('Image worker failed, falling back to main thread', error)
      workerBroken = true
    }
  }
  return runOnMainThread(file, jobs, signal)
}
