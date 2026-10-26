import { useEffect, useRef, useState } from 'react'
import Dropzone from '../components/Dropzone'
import ResultActions from '../components/ResultActions'
import ShareHint from '../components/ShareHint'
import { describeError, useI18n } from '../i18n'
import {
  FORMAT_EXT,
  FORMAT_LABEL,
  ImageError,
  formatSize,
  type Format,
} from '../utils/image'
import { combineImages, probeImage } from '../utils/processImage'
import { createOnce, trackError, trackFilesAdded } from '../analyticsEvents'

/** 可合併的張數：2 或 3 張 */
const MIN_IMAGES = 2
const MAX_IMAGES = 3

interface Item {
  id: number
  file: File
  width: number
  height: number
  url: string
}

interface Combined {
  blob: Blob
  url: string
  width: number
  height: number
}

export default function CombineTab() {
  const { m } = useI18n()
  const [items, setItems] = useState<Item[]>([])
  const [divider, setDivider] = useState(true)
  const [dividerColor, setDividerColor] = useState('#ffffff')
  const [format, setFormat] = useState<Format>('image/png')
  const [quality, setQuality] = useState(92)
  const [result, setResult] = useState<Combined | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const nextIdRef = useRef(0)
  // 目前畫面上的縮圖網址；移除或離開頁面時才釋放
  const itemUrlsRef = useRef(new Set<string>())
  // 目前畫面上的結果網址；新結果出來後才釋放，處理期間舊結果不會變成破圖
  const resultUrlRef = useRef<string | null>(null)
  const reportOnce = useRef(createOnce())

  async function handleFiles(files: File[]) {
    trackFilesAdded('combine', files)
    // 一次選多張時各自讀尺寸；失敗的略過並顯示原因，成功的照選取順序加入
    const settled = await Promise.allSettled(files.map((file) => probeImage(file)))
    const added: Item[] = []
    let failure: ImageError | null = null
    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        const url = URL.createObjectURL(outcome.value.preview ?? files[i])
        itemUrlsRef.current.add(url)
        added.push({
          id: nextIdRef.current++,
          file: files[i],
          width: outcome.value.width,
          height: outcome.value.height,
          url,
        })
      } else if (!failure) {
        failure = outcome.reason instanceof ImageError ? outcome.reason : new ImageError('readFailed')
        trackError('combine', failure, '')
      }
    })
    setError(failure)
    setItems((old) => {
      // 讀取尺寸期間使用者可能又加了圖，超出上限的丟掉並釋放網址
      const next = [...old, ...added]
      next.slice(MAX_IMAGES).forEach((item) => {
        URL.revokeObjectURL(item.url)
        itemUrlsRef.current.delete(item.url)
      })
      return next.slice(0, MAX_IMAGES)
    })
  }

  function removeItem(id: number) {
    const target = items.find((item) => item.id === id)
    if (target) {
      URL.revokeObjectURL(target.url)
      itemUrlsRef.current.delete(target.url)
    }
    const next = items.filter((item) => item.id !== id)
    setItems(next)
    if (next.length < MIN_IMAGES) {
      // 不足 2 張就沒有結果了，立刻釋放，也清掉上一輪合併的錯誤
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
      setResult(null)
      setError(null)
      setBusy(false)
    }
  }

  function moveItem(index: number, offset: -1 | 1) {
    const target = index + offset
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
  }

  useEffect(() => {
    const urls = itemUrlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (items.length < MIN_IMAGES) return
    const controller = new AbortController()
    const { signal } = controller

    const timer = setTimeout(async () => {
      setBusy(true)
      try {
        const combined = await combineImages(
          items.map((item) => item.file),
          { format, quality: quality / 100, divider, dividerColor },
          signal,
        )
        const url = URL.createObjectURL(combined.blob)
        // 新結果接手顯示後，才釋放舊的結果網址
        const previous = resultUrlRef.current
        resultUrlRef.current = url
        if (previous) URL.revokeObjectURL(previous)
        setResult({ blob: combined.blob, url, width: combined.width, height: combined.height })
        setError(null)
        setBusy(false)
      } catch (e) {
        if (signal.aborted) return
        setError(e)
        setBusy(false)
        // 改設定會重新處理，同一組圖片的同一個錯誤只回報一次
        const code = e instanceof ImageError ? e.code : 'unknown'
        const key = items.map((i) => `${i.file.name}|${i.file.size}|${i.file.lastModified}`).join(',')
        if (reportOnce.current(`${key}|${code}|${format}|${divider}|${dividerColor}`)) {
          trackError('combine', e, format)
        }
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [items, divider, dividerColor, format, quality])

  const ready = items.length >= MIN_IMAGES
  const shown = ready ? result : null
  const resultItems = shown ? [{ name: `combined.${FORMAT_EXT[format]}`, blob: shown.blob }] : []

  return (
    <div className="panel">
      <Dropzone
        tool="combine"
        multiple
        maxFiles={MAX_IMAGES}
        currentCount={items.length}
        label={m.combine.dropLabel(MAX_IMAGES)}
        onFiles={handleFiles}
      />
      {error != null && <p className="error">{describeError(error, m)}</p>}

      {items.length > 0 && (
        <section className="card">
          <h2>{m.combine.listTitle}</h2>
          <ul className="result-list">
            {items.map((item, i) => (
              <li key={item.id}>
                <img src={item.url} alt="" />
                <div className="result-info">
                  <strong>{item.file.name}</strong>
                  <span>
                    {item.width} × {item.height}・{formatSize(item.file.size)}
                  </span>
                </div>
                <div className="row-actions">
                  <button onClick={() => moveItem(i, -1)} disabled={i === 0}>
                    {m.combine.moveUp}
                  </button>
                  <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>
                    {m.combine.moveDown}
                  </button>
                  <button onClick={() => removeItem(item.id)}>{m.combine.remove}</button>
                </div>
              </li>
            ))}
          </ul>
          {!ready && <p className="hint">{m.combine.needMore}</p>}
        </section>
      )}

      {ready && (
        <section className="card">
          <h2>{m.combine.settingsTitle}</h2>
          <div className="options">
            <div className="field">
              {m.combine.dividerLabel}
              <div className="segmented">
                <button className={divider ? 'active' : ''} onClick={() => setDivider(true)}>
                  {m.combine.dividerOn}
                </button>
                <button className={divider ? '' : 'active'} onClick={() => setDivider(false)}>
                  {m.combine.dividerOff}
                </button>
              </div>
            </div>
            {divider && (
              <label>
                {m.combine.dividerColor}
                <input
                  type="color"
                  value={dividerColor}
                  onChange={(e) => setDividerColor(e.target.value)}
                />
              </label>
            )}
            <label>
              {m.common.outputFormat}
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                    {f === 'image/png' ? m.combine.pngRecommended : ''}
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
          <p className="hint">{m.combine.orderNote}</p>
          {format === 'image/avif' && <p className="hint">{m.common.avifSlowNote}</p>}
          {busy && <p className="hint">{m.common.processing}</p>}
        </section>
      )}

      {shown && (
        <section className="card">
          <div className="card-head">
            <div className="card-head-text">
              <h2>{m.combine.resultTitle}</h2>
              <ShareHint items={resultItems} />
            </div>
            <ResultActions tool="combine" items={resultItems} />
          </div>
          <div className="combine-result">
            <img src={shown.url} alt={m.combine.resultAlt} />
            <p className="hint num">
              {shown.width} × {shown.height}・{formatSize(shown.blob.size)}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
