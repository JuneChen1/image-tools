import { useMemo, useState } from 'react'
import { trackSaveResult, trackShareFailure, type Tool } from '../analyticsEvents'
import { useI18n } from '../i18n'
import { downloadBlob, downloadZip } from '../utils/image'
import { canShareFiles, shareFiles, toFiles, type NamedBlob } from '../utils/share'

interface Props {
  tool: Tool
  items: NamedBlob[]
  /** 不給就是單一檔案：主按鈕直接下載第一個檔案，不打包 ZIP */
  zipName?: string
  /** 切圖才有：切成幾張，回報統計用 */
  splitParts?: number
}

/**
 * 結果區右上角的按鈕：「分享 / 儲存到相簿」（支援時才顯示）與「下載全部 (ZIP)」。
 * 手機（尤其是 iPhone）下載的檔案只會進「檔案 App」，要用分享選單的「儲存影像」才進得了相簿
 */
export default function ResultActions({ tool, items, zipName, splitParts }: Props) {
  const { m } = useI18n()
  const [failed, setFailed] = useState<'share' | 'zip' | null>(null)

  // items 沒變就不重建 File 與重問瀏覽器能不能分享
  const files = useMemo(() => toFiles(items), [items])
  const shareable = useMemo(() => canShareFiles(files), [files])
  const blobs = useMemo(() => items.map((item) => item.blob), [items])

  async function onShare() {
    setFailed(null)
    try {
      // 使用者自己關掉分享選單（cancelled）不算「存下結果」
      if ((await shareFiles(files)) === 'shared') {
        trackSaveResult({ tool, method: 'share', blobs, splitParts })
      }
    } catch {
      setFailed('share')
      trackShareFailure(tool, blobs)
    }
  }

  async function onZip(name: string) {
    setFailed(null)
    try {
      await downloadZip(items, name)
      // 打包成功、下載開始後才算「存下結果」
      trackSaveResult({ tool, method: 'zip', blobs, splitParts })
    } catch (error) {
      console.error('ZIP failed', error)
      setFailed('zip')
    }
  }

  return (
    <div className="card-actions">
      <div className="card-actions-row">
        {shareable && <button onClick={onShare}>{m.common.share}</button>}
        <button
          className="primary"
          onClick={() => {
            if (zipName) {
              void onZip(zipName)
            } else {
              trackSaveResult({ tool, method: 'single', blobs })
              downloadBlob(items[0].blob, items[0].name)
            }
          }}
        >
          {zipName ? m.common.downloadAll : m.common.download}
        </button>
      </div>
      {failed && <p className="error">{failed === 'zip' ? m.common.zipFailed : m.common.shareFailed}</p>}
    </div>
  )
}
