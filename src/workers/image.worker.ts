import { decodeImage, probeImageFile } from '../utils/decode'
import { ImageError, renderBlob, type RenderResult } from '../utils/image'
import type { RenderRequest, WorkerRequest, WorkerResponse } from './protocol'

// 不引入 WebWorker 型別庫（會與 DOM 型別衝突），只宣告用得到的部分
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

const scope = self as unknown as WorkerScope
const cancelled = new Set<number>()

/** 讓出事件迴圈，這樣處理中也能收到取消訊息 */
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function render({ id, file, jobs }: RenderRequest): Promise<WorkerResponse> {
  let bitmap: ImageBitmap
  try {
    bitmap = await decodeImage(file)
  } catch {
    throw new ImageError('readFailed')
  }

  try {
    const results: RenderResult[] = []
    for (const job of jobs) {
      if (cancelled.has(id)) return { id, ok: false, cancelled: true }
      results.push(await renderBlob(bitmap, job))
      await yieldToEventLoop()
    }
    if (cancelled.has(id)) return { id, ok: false, cancelled: true }
    return { id, ok: true, results }
  } finally {
    bitmap.close()
  }
}

scope.onmessage = async (event) => {
  const request = event.data

  if (request.type === 'cancel') {
    cancelled.add(request.id)
    return
  }

  const { id } = request
  try {
    if (request.type === 'probe') {
      let probe
      try {
        probe = await probeImageFile(request.file)
      } catch (error) {
        if (error instanceof ImageError) throw error
        throw new ImageError('readFailed')
      }
      scope.postMessage(
        cancelled.has(id) ? { id, ok: false, cancelled: true } : { id, ok: true, probe },
      )
    } else {
      scope.postMessage(await render(request))
    }
  } catch (error) {
    if (error instanceof ImageError) {
      scope.postMessage({ id, ok: false, code: error.code, detail: error.detail })
    } else {
      scope.postMessage({
        id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } finally {
    cancelled.delete(id)
  }
}
