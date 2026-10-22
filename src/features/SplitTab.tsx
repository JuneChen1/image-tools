import { useEffect, useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import {
  FORMAT_EXT,
  FORMAT_LABEL,
  baseName,
  downloadBlob,
  downloadZip,
  formatSize,
  renderBlob,
  splitBounds,
  type Format,
} from '../utils/image'

/** X 一則貼文最多 4 張圖 */
const COUNT_CHOICES = [2, 3, 4]

interface Source {
  file: File
  bitmap: ImageBitmap
  url: string
}

interface Part {
  name: string
  blob: Blob
  url: string
  width: number
  height: number
}

export default function SplitTab() {
  const [source, setSource] = useState<Source | null>(null)
  const [count, setCount] = useState(3)
  const [format, setFormat] = useState<Format>('image/png')
  const [quality, setQuality] = useState(92)
  const [parts, setParts] = useState<Part[]>([])
  const [error, setError] = useState('')
  const sourceRef = useRef<Source | null>(null)

  function release(s: Source | null) {
    if (!s) return
    s.bitmap.close()
    URL.revokeObjectURL(s.url)
  }

  async function handleFiles(files: File[]) {
    try {
      const bitmap = await createImageBitmap(files[0])
      const next = { file: files[0], bitmap, url: URL.createObjectURL(files[0]) }
      release(sourceRef.current)
      sourceRef.current = next
      setSource(next)
      setError('')
    } catch {
      setError('無法讀取這張圖片，請確認格式（支援 JPEG、PNG、WebP 等瀏覽器可開啟的格式）')
    }
  }

  useEffect(() => () => release(sourceRef.current), [])

  useEffect(() => {
    if (!source) return
    const { file, bitmap } = source
    let cancelled = false
    const urls: string[] = []

    ;(async () => {
      try {
        if (bitmap.width < count) throw new Error(`圖片寬度太小，無法切成 ${count} 張`)
        const bounds = splitBounds(bitmap.width, count)
        const base = baseName(file.name)
        const next: Part[] = []
        for (let i = 0; i < count; i++) {
          const { blob, width, height } = await renderBlob(bitmap, {
            crop: { x: bounds[i], y: 0, w: bounds[i + 1] - bounds[i], h: bitmap.height },
            format,
            quality: quality / 100,
            background: '#ffffff',
          })
          const url = URL.createObjectURL(blob)
          urls.push(url)
          next.push({
            name: `${base}_${i + 1}.${FORMAT_EXT[format]}`,
            blob,
            url,
            width,
            height,
          })
        }
        if (!cancelled) {
          setParts(next)
          setError('')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '處理失敗')
      }
    })()

    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [source, count, format, quality])

  return (
    <div className="panel">
      <Dropzone label="選擇要切開的圖片" onFiles={handleFiles} />
      {error && <p className="error">{error}</p>}

      {source && (
        <>
          <section className="card">
            <h2>切割預覽</h2>
            <div className="split-preview">
              <img src={source.url} alt="原圖" />
              {Array.from({ length: count - 1 }, (_, i) => (
                <i
                  key={i}
                  className="split-line"
                  style={{ left: `${((i + 1) / count) * 100}%` }}
                />
              ))}
            </div>
            <p className="hint">
              {source.file.name}・{source.bitmap.width} × {source.bitmap.height}・
              {formatSize(source.file.size)}
            </p>
          </section>

          <section className="card">
            <h2>切割設定</h2>
            <div className="options">
              <div className="field">
                切成幾張
                <div className="segmented">
                  {COUNT_CHOICES.map((n) => (
                    <button
                      key={n}
                      className={n === count ? 'active' : ''}
                      onClick={() => setCount(n)}
                    >
                      {n} 張
                    </button>
                  ))}
                </div>
              </div>
              <label>
                輸出格式
                <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                  {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABEL[f]}
                      {f === 'image/png' ? '（無損，建議）' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {format !== 'image/png' && (
                <label>
                  品質 {quality}
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </label>
              )}
            </div>
          </section>

          {parts.length === count && (
            <section className="card">
              <div className="card-head">
                <h2>切割結果</h2>
                <button
                  className="primary"
                  onClick={() =>
                    downloadZip(
                      parts.map((p) => ({ name: p.name, blob: p.blob })),
                      `${baseName(source.file.name)}_split.zip`,
                    )
                  }
                >
                  下載全部 (ZIP)
                </button>
              </div>
              <div
                className="parts-row"
                style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}
              >
                {parts.map((p) => (
                  <figure key={p.name}>
                    <img src={p.url} alt={p.name} />
                    <figcaption>
                      <span>
                        {p.width} × {p.height}・{formatSize(p.blob.size)}
                      </span>
                      <button onClick={() => downloadBlob(p.blob, p.name)}>下載</button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="hint">由左到右依序編號為 1 ～ {count}，上傳時請照這個順序。</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
