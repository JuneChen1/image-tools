import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { isHeicFile } from '../utils/decode'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
// HEIC 的 type 常被回報成空字串，所以另外用副檔名放行
const ACCEPT_ATTR = [...ACCEPTED_TYPES, 'image/heic', 'image/heif', '.heic', '.heif'].join(',')

const isAccepted = (file: File) => ACCEPTED_TYPES.includes(file.type) || isHeicFile(file)

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
  const [tooMany, setTooMany] = useState(false)
  const [skipped, setSkipped] = useState(0)

  function pick(list: FileList | null) {
    const all = Array.from(list ?? [])
    const files = all.filter(isAccepted)
    setRejected(all.filter((f) => !isAccepted(f)).map((f) => f.name))

    // 只收一張的上傳區（切圖）：選了多張就整批不處理並提示，不要悄悄只挑第一張
    const exceeds = !multiple && files.length > 1
    setTooMany(exceeds)
    if (exceeds) return

    // 多選的上傳區：依選取順序收到上限為止，超過的略過並提示
    const room = multiple && maxFiles !== undefined ? Math.max(0, maxFiles - currentCount) : files.length
    const taken = files.slice(0, room)
    setSkipped(files.length - taken.length)
    if (taken.length > 0) onFiles(taken)
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
      {rejected.length > 0 && (
        <p className="error rejected">
          {m.dropzone.rejected(rejected.length, rejected.join(m.listSep))}
        </p>
      )}
    </div>
  )
}
