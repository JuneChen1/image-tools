import { useRef, useState } from 'react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const ACCEPT_ATTR = ACCEPTED_TYPES.join(',')

interface Props {
  multiple?: boolean
  label: string
  onFiles: (files: File[]) => void
}

export default function Dropzone({ multiple = false, label, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])

  function pick(list: FileList | null) {
    const all = Array.from(list ?? [])
    const files = all.filter((f) => ACCEPTED_TYPES.includes(f.type))
    setRejected(all.filter((f) => !ACCEPTED_TYPES.includes(f.type)).map((f) => f.name))
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
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
        <p>{label}</p>
        <span>拖放圖片到這裡，或點擊選擇檔案（支援 JPEG、PNG、WebP、AVIF）</span>
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
      {rejected.length > 0 && (
        <p className="error rejected">
          已略過 {rejected.length} 個不支援的檔案：{rejected.join('、')}
        </p>
      )}
    </div>
  )
}
