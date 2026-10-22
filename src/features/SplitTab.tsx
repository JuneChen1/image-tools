import { useEffect, useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import { describeError, useI18n } from '../i18n'
import {
  FORMAT_EXT,
  FORMAT_LABEL,
  ImageError,
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
  const { m } = useI18n()
  const [source, setSource] = useState<Source | null>(null)
  const [count, setCount] = useState(3)
  const [format, setFormat] = useState<Format>('image/png')
  const [quality, setQuality] = useState(92)
  const [parts, setParts] = useState<Part[]>([])
  const [error, setError] = useState<unknown>(null)
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
      setError(null)
    } catch {
      setError(new ImageError('readFailed'))
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
        if (bitmap.width < count) throw new ImageError('tooNarrow', count)
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
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e)
      }
    })()

    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [source, count, format, quality])

  return (
    <div className="panel">
      <Dropzone label={m.split.dropLabel} onFiles={handleFiles} />
      {error != null && <p className="error">{describeError(error, m)}</p>}

      {source && (
        <>
          <section className="card">
            <h2>{m.split.previewTitle}</h2>
            <div className="split-preview">
              <img src={source.url} alt={m.split.originalAlt} />
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
            <h2>{m.split.settingsTitle}</h2>
            <div className="options">
              <div className="field">
                {m.split.countLabel}
                <div className="segmented">
                  {COUNT_CHOICES.map((n) => (
                    <button
                      key={n}
                      className={n === count ? 'active' : ''}
                      onClick={() => setCount(n)}
                    >
                      {m.split.countOption(n)}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                {m.common.outputFormat}
                <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                  {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABEL[f]}
                      {f === 'image/png' ? m.split.pngRecommended : ''}
                    </option>
                  ))}
                </select>
              </label>
              {format !== 'image/png' && (
                <label>
                  {m.common.quality} {quality}
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
                <h2>{m.split.resultTitle}</h2>
                <button
                  className="primary"
                  onClick={() =>
                    downloadZip(
                      parts.map((p) => ({ name: p.name, blob: p.blob })),
                      `${baseName(source.file.name)}_split.zip`,
                    )
                  }
                >
                  {m.common.downloadAll}
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
                      <button onClick={() => downloadBlob(p.blob, p.name)}>
                        {m.common.download}
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="hint">{m.split.numbering(count)}</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
