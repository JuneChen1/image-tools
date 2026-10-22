import { useEffect, useState } from 'react'
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
  error?: ImageError
}

/** 0 代表不限制 */
const MAX_EDGE_CHOICES = [0, 4096, 2048, 1920, 1280]

// 檔名與 ZIP 名稱固定用英文，不隨介面語言變動
const OUTPUT = {
  compress: { zipName: 'compressed.zip', suffix: '_compressed' },
  convert: { zipName: 'converted.zip', suffix: '' },
}

function resolveFormat(file: File, choice: FormatChoice): Format {
  if (choice !== 'keep') return choice
  return file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
}

export default function BatchTab({ mode }: { mode: Mode }) {
  const { m } = useI18n()
  const [files, setFiles] = useState<File[]>([])
  const [choice, setChoice] = useState<FormatChoice>(mode === 'compress' ? 'keep' : 'image/webp')
  const [quality, setQuality] = useState(80)
  const [maxEdge, setMaxEdge] = useState(0)
  const [background, setBackground] = useState('#ffffff')
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)

  const { zipName, suffix } = OUTPUT[mode]

  useEffect(() => {
    if (files.length === 0) return
    let cancelled = false
    const urls: string[] = []

    const timer = setTimeout(async () => {
      setBusy(true)
      const next: Result[] = []
      for (const file of files) {
        const format = resolveFormat(file, choice)
        const name = `${baseName(file.name)}${suffix}.${FORMAT_EXT[format]}`
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
            error: e instanceof ImageError ? e : new ImageError('readFailed'),
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
  }, [files, choice, quality, maxEdge, background, suffix])

  const done = results.filter((r) => r.blob)
  const totalBefore = done.reduce((sum, r) => sum + r.file.size, 0)
  const totalAfter = done.reduce((sum, r) => sum + (r.blob?.size ?? 0), 0)
  const isPng = choice === 'image/png'
  const showQuality = choice === 'keep' ? true : !isPng
  const showBackground = mode === 'convert' && choice === 'image/jpeg'
  const totalPercent = totalBefore > 0 ? Math.abs(Math.round((1 - totalAfter / totalBefore) * 100)) : 0

  return (
    <div className="panel">
      <Dropzone
        multiple
        label={mode === 'compress' ? m.batch.compressDropLabel : m.batch.convertDropLabel}
        onFiles={(added) => setFiles((old) => [...old, ...added])}
      />

      {files.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>{m.batch.settingsTitle}</h2>
            <button
              onClick={() => {
                setFiles([])
                setResults([])
                setBusy(false)
              }}
            >
              {m.common.clearAll}
            </button>
          </div>
          <div className="options">
            <label>
              {m.common.outputFormat}
              <select value={choice} onChange={(e) => setChoice(e.target.value as FormatChoice)}>
                {mode === 'compress' && <option value="keep">{m.batch.keepFormat}</option>}
                {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            {showQuality && (
              <label>
                {m.common.quality} <span className="num">{quality}</span>
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
                {m.batch.maxEdgeLabel}
                <select value={maxEdge} onChange={(e) => setMaxEdge(Number(e.target.value))}>
                  {MAX_EDGE_CHOICES.map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? m.batch.unlimited : `${value} px`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {showBackground && (
              <label>
                {m.batch.backgroundLabel}
                <input
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
              </label>
            )}
          </div>
          {mode === 'compress' && (choice === 'image/png' || choice === 'keep') && (
            <p className="hint">{m.batch.compressPngNote}</p>
          )}
          {mode === 'convert' && choice === 'image/jpeg' && (
            <p className="hint">{m.batch.convertJpegNote}</p>
          )}
        </section>
      )}

      {results.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>
              {m.batch.resultsTitle} {busy && <small>{m.batch.processing}</small>}
            </h2>
            {done.length > 0 && (
              <button
                className="primary"
                onClick={() =>
                  downloadZip(
                    done.map((r) => ({ name: r.name, blob: r.blob! })),
                    zipName,
                  )
                }
              >
                {m.common.downloadAll}
              </button>
            )}
          </div>

          {mode === 'compress' && done.length > 0 && (
            <p className="summary">
              {m.batch.total(formatSize(totalBefore), formatSize(totalAfter))}
              {totalBefore > 0 && (
                <strong className={totalAfter <= totalBefore ? 'good' : 'bad'}>
                  {' '}
                  ({totalAfter <= totalBefore ? m.batch.saved(totalPercent) : m.batch.grew(totalPercent)})
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
                      <span className="error">{describeError(r.error, m)}</span>
                    )}
                  </div>
                  {r.blob && (
                    <button onClick={() => downloadBlob(r.blob!, r.name)}>
                      {m.common.download}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
