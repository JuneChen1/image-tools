import { useEffect, useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import ResultActions from '../components/ResultActions'
import ShareHint from '../components/ShareHint'
import { describeError, useI18n } from '../i18n'
import {
  FORMAT_EXT,
  FORMAT_LABEL,
  ImageError,
  baseName,
  downloadBlob,
  formatSize,
  splitBounds,
  type Format,
} from '../utils/image'
import { probeImage, processImage } from '../utils/processImage'
import { createOnce, trackError, trackFilesAdded, trackSaveResult } from '../analyticsEvents'

/** X 一則貼文最多 4 張圖 */
const COUNT_CHOICES = [2, 3, 4]

interface Source {
  file: File
  width: number
  height: number
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
  const [busy, setBusy] = useState(false)
  const sourceRef = useRef<Source | null>(null)
  // 目前畫面上顯示的結果縮圖網址；新結果出來後才釋放，處理期間舊縮圖不會變成破圖
  const partUrlsRef = useRef<string[]>([])
  // 連續選檔時，只採用最後一次選的結果
  const probeTicketRef = useRef(0)
  const reportOnce = useRef(createOnce())

  async function handleFiles(files: File[]) {
    const ticket = ++probeTicketRef.current
    trackFilesAdded('split', files)
    try {
      // 取得寬高；HEIC 等瀏覽器無法直接顯示的格式會另外附上預覽圖。解碼在 Worker 內進行
      const info = await probeImage(files[0])
      if (ticket !== probeTicketRef.current) return
      const next = {
        file: files[0],
        width: info.width,
        height: info.height,
        url: URL.createObjectURL(info.preview ?? files[0]),
      }
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url)
      sourceRef.current = next
      setSource(next)
      setError(null)
    } catch (e) {
      if (ticket !== probeTicketRef.current) return
      const failure = e instanceof ImageError ? e : new ImageError('readFailed')
      setError(failure)
      trackError('split', failure, '')
    }
  }

  useEffect(
    () => () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url)
      partUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  useEffect(() => {
    if (!source) return
    const { file, width, height } = source
    const controller = new AbortController()
    const urls: string[] = []

    ;(async () => {
      setBusy(true)
      try {
        if (width < count) throw new ImageError('tooNarrow', count)
        const bounds = splitBounds(width, count)
        const results = await processImage(
          file,
          Array.from({ length: count }, (_, i) => ({
            crop: { x: bounds[i], y: 0, w: bounds[i + 1] - bounds[i], h: height },
            format,
            quality: quality / 100,
            background: '#ffffff',
          })),
          controller.signal,
        )
        const base = baseName(file.name)
        const next: Part[] = results.map((r, i) => {
          const url = URL.createObjectURL(r.blob)
          urls.push(url)
          return {
            name: `${base}_${i + 1}.${FORMAT_EXT[format]}`,
            blob: r.blob,
            url,
            width: r.width,
            height: r.height,
          }
        })
        // 新結果接手顯示後，才釋放舊的縮圖網址
        const previous = partUrlsRef.current
        partUrlsRef.current = [...urls]
        urls.length = 0
        previous.forEach((u) => URL.revokeObjectURL(u))
        setParts(next)
        setError(null)
        setBusy(false)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e)
        setBusy(false)
        // 改設定會重新處理，同一個檔案的同一個錯誤只回報一次
        const code = e instanceof ImageError ? e.code : 'unknown'
        if (reportOnce.current(`${file.name}|${file.size}|${file.lastModified}|${code}|${format}|${count}`)) {
          trackError('split', e, format)
        }
      }
    })()

    return () => {
      controller.abort()
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [source, count, format, quality])

  const partItems = parts.map((p) => ({ name: p.name, blob: p.blob }))

  return (
    <div className="panel">
      <Dropzone tool="split" label={m.split.dropLabel} onFiles={handleFiles} />
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
            <p className="hint num">
              {source.file.name}・{source.width} × {source.height}・
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
                  {m.common.quality} <span className="num">{quality}</span>
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
            {format === 'image/avif' && <p className="hint">{m.common.avifSlowNote}</p>}
            {busy && <p className="hint">{m.common.processing}</p>}
          </section>

          {parts.length === count && (
            <section className="card">
              <div className="card-head">
                <div className="card-head-text">
                  <h2>{m.split.resultTitle}</h2>
                  <ShareHint items={partItems} />
                </div>
                <ResultActions
                  tool="split"
                  splitParts={count}
                  items={partItems}
                  zipName={`${baseName(source.file.name)}_split.zip`}
                />
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
                      <button
                        onClick={() => {
                          trackSaveResult({ tool: 'split', method: 'single', blobs: [p.blob], splitParts: count })
                          downloadBlob(p.blob, p.name)
                        }}
                      >
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
