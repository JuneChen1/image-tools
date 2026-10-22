import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { MAX_FILE_MB } from '../utils/limits'
import { ACCEPT_ATTR, selectFiles } from '../utils/selectFiles'

interface Props {
  multiple?: boolean
  /** 多選時的總張數上限（含已加入的），不設就不限制 */
  maxFiles?: number
  /** 目前已加入幾張，用來算還剩多少名額 */
  currentCount?: number
  label: string
  onFiles: (files: File[]) => void
}

export default function Dropzone({
  multiple = false,
  maxFiles,
  currentCount = 0,
  label,
  onFiles,
}: Props) {
  const { m } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])
  const [oversized, setOversized] = useState<string[]>([])
  const [tooMany, setTooMany] = useState(false)
  const [skipped, setSkipped] = useState(0)

  function pick(list: FileList | null) {
    const result = selectFiles(Array.from(list ?? []), { multiple, maxFiles, currentCount })
    setRejected(result.unsupported)
    setOversized(result.oversized)
    setTooMany(result.tooMany)
    setSkipped(result.skipped)
    if (result.taken.length > 0) onFiles(result.taken)
  }

  return (
    <div>
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          pick(e.dataTransfer.files)
        }}
      >
        <svg
          className="dropzone-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <p>{label}</p>
        <span>{m.dropzone.hint}</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple={multiple}
          hidden
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {tooMany && <p className="error rejected">{m.dropzone.singleOnly}</p>}
      {/* 清單清空後（名額又有了），過期的超量提示就不再顯示 */}
      {maxFiles !== undefined && skipped > 0 && currentCount >= maxFiles && (
        <p className="error rejected">{m.dropzone.limit(maxFiles, skipped)}</p>
      )}
      {oversized.length > 0 && (
        <p className="error rejected">
          {m.dropzone.tooBig(oversized.length, MAX_FILE_MB, oversized.join(m.listSep))}
        </p>
      )}
      {rejected.length > 0 && (
        <p className="error rejected">
          {m.dropzone.rejected(rejected.length, rejected.join(m.listSep))}
        </p>
      )}
    </div>
  )
}
