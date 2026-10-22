import { useEffect, useState } from 'react'
import Dropzone from '../components/Dropzone'
import {
  FORMAT_EXT,
  FORMAT_LABEL,
  baseName,
  downloadBlob,
  downloadZip,
  formatSize,
  renderBlob,
  type Format,
} from '../utils/image'

type Mode = 'compress' | 'convert'
type FormatChoice = Format | 'keep'

interface Result {
  file: File
  name: string
  blob?: Blob
  url?: string
  width?: number
  height?: number
  error?: string
}

const MAX_EDGE_CHOICES = [
  { value: 0, label: '不限制' },
  { value: 4096, label: '4096 px' },
  { value: 2048, label: '2048 px' },
  { value: 1920, label: '1920 px' },
  { value: 1280, label: '1280 px' },
]

const TEXT = {
  compress: {
    dropLabel: '選擇要壓縮的圖片（可多選）',
    zipName: 'compressed.zip',
    suffix: '_compressed',
  },
  convert: {
    dropLabel: '選擇要轉檔的圖片（可多選）',
    zipName: 'converted.zip',
    suffix: '',
  },
}

function resolveFormat(file: File, choice: FormatChoice): Format {
  if (choice !== 'keep') return choice
  return file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
}

export default function BatchTab({ mode }: { mode: Mode }) {
  const [files, setFiles] = useState<File[]>([])
  const [choice, setChoice] = useState<FormatChoice>(mode === 'compress' ? 'keep' : 'image/webp')
  const [quality, setQuality] = useState(80)
  const [maxEdge, setMaxEdge] = useState(0)
  const [background, setBackground] = useState('#ffffff')
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)

  const text = TEXT[mode]

  useEffect(() => {
    if (files.length === 0) return
    let cancelled = false
    const urls: string[] = []

    const timer = setTimeout(async () => {
      setBusy(true)
      const next: Result[] = []
      for (const file of files) {
        const format = resolveFormat(file, choice)
        const name = `${baseName(file.name)}${text.suffix}.${FORMAT_EXT[format]}`
        try {
          const bitmap = await createImageBitmap(file)
          try {
            const { blob, width, height } = await renderBlob(bitmap, {
              maxEdge: maxEdge || undefined,
              format,
              quality: quality / 100,
              background,
            })
            const url = URL.createObjectURL(blob)
            urls.push(url)
            next.push({ file, name, blob, url, width, height })
          } finally {
            bitmap.close()
          }
        } catch (e) {
          next.push({
            file,
            name,
            error: e instanceof Error ? e.message : '無法讀取這張圖片',
          })
        }
        if (cancelled) return
      }
      setResults(next)
      setBusy(false)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [files, choice, quality, maxEdge, background, text.suffix])

  const done = results.filter((r) => r.blob)
  const totalBefore = done.reduce((sum, r) => sum + r.file.size, 0)
  const totalAfter = done.reduce((sum, r) => sum + (r.blob?.size ?? 0), 0)
  const isPng = choice === 'image/png'
  const showQuality = choice === 'keep' ? true : !isPng
  const showBackground = mode === 'convert' && choice === 'image/jpeg'

  return (
    <div className="panel">
      <Dropzone
        multiple
        label={text.dropLabel}
        onFiles={(added) => setFiles((old) => [...old, ...added])}
      />

      {files.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>設定</h2>
            <button
              onClick={() => {
                setFiles([])
                setResults([])
                setBusy(false)
              }}
            >
              清除全部
            </button>
          </div>
          <div className="options">
            <label>
              輸出格式
              <select value={choice} onChange={(e) => setChoice(e.target.value as FormatChoice)}>
                {mode === 'compress' && <option value="keep">維持原格式</option>}
                {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            {showQuality && (
              <label>
                品質 {quality}
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </label>
            )}
            {mode === 'compress' && (
              <label>
                最長邊上限
                <select value={maxEdge} onChange={(e) => setMaxEdge(Number(e.target.value))}>
                  {MAX_EDGE_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {showBackground && (
              <label>
                透明處填色
                <input
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
              </label>
            )}
          </div>
          {mode === 'compress' && (choice === 'image/png' || choice === 'keep') && (
            <p className="hint">
              PNG 是無損格式，品質滑桿對 PNG 無效；想大幅縮小檔案，請改輸出 WebP 或 JPEG，或限制最長邊。
            </p>
          )}
          {mode === 'convert' && choice === 'image/jpeg' && (
            <p className="hint">JPEG 不支援透明，透明區域會填上上面選的顏色。</p>
          )}
        </section>
      )}

      {results.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>
              結果 {busy && <small>處理中…</small>}
            </h2>
            {done.length > 0 && (
              <button
                className="primary"
                onClick={() =>
                  downloadZip(
                    done.map((r) => ({ name: r.name, blob: r.blob! })),
                    text.zipName,
                  )
                }
              >
                下載全部 (ZIP)
              </button>
            )}
          </div>

          {mode === 'compress' && done.length > 0 && (
            <p className="summary">
              共 {formatSize(totalBefore)} → {formatSize(totalAfter)}
              {totalBefore > 0 && (
                <strong className={totalAfter <= totalBefore ? 'good' : 'bad'}>
                  {' '}
                  ({totalAfter <= totalBefore ? '省下' : '增加'}{' '}
                  {Math.abs(Math.round((1 - totalAfter / totalBefore) * 100))}%)
                </strong>
              )}
            </p>
          )}

          <ul className="result-list">
            {results.map((r, i) => {
              const delta = r.blob ? Math.round((1 - r.blob.size / r.file.size) * 100) : 0
              return (
                <li key={`${r.file.name}-${i}`}>
                  {r.url ? <img src={r.url} alt="" /> : <div className="thumb-fail">!</div>}
                  <div className="result-info">
                    <strong>{r.name}</strong>
                    {r.blob ? (
                      <span>
                        {r.width} × {r.height}・{formatSize(r.file.size)} → {formatSize(r.blob.size)}
                        {mode === 'compress' && (
                          <em className={delta >= 0 ? 'good' : 'bad'}>
                            {' '}
                            {delta >= 0 ? `-${delta}%` : `+${-delta}%`}
                          </em>
                        )}
                      </span>
                    ) : (
                      <span className="error">{r.error}</span>
                    )}
                  </div>
                  {r.blob && <button onClick={() => downloadBlob(r.blob!, r.name)}>下載</button>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
