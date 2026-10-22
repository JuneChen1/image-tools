import { useState } from 'react'
import { trackSaveResult, trackShareFailure, type Tool } from '../analyticsEvents'
import { useI18n } from '../i18n'
import { downloadZip } from '../utils/image'
import { canShareFiles, shareFiles, toFiles, type NamedBlob } from '../utils/share'

interface Props {
  tool: Tool
  items: NamedBlob[]
  zipName: string
  /** 切圖才有：切成幾張，回報統計用 */
  splitParts?: number
}

/**
 * 結果區右上角的按鈕：「分享 / 儲存到相簿」（支援時才顯示）與「下載全部 (ZIP)」。
 * 手機（尤其是 iPhone）下載的檔案只會進「檔案 App」，要用分享選單的「儲存影像」才進得了相簿
 */
export default function ResultActions({ tool, items, zipName, splitParts }: Props) {
  const { m } = useI18n()
  const [failed, setFailed] = useState(false)

  const files = toFiles(items)
  const shareable = canShareFiles(files)

  const blobs = items.map((item) => item.blob)

  async function onShare() {
    setFailed(false)
    try {
      // 使用者自己關掉分享選單（cancelled）不算「存下結果」
      if ((await shareFiles(files)) === 'shared') {
        trackSaveResult({ tool, method: 'share', blobs, splitParts })
      }
    } catch {
      setFailed(true)
      trackShareFailure(tool, blobs)
    }
  }

  return (
    <div className="card-actions">
      <div className="card-actions-row">
        {shareable && <button onClick={onShare}>{m.common.share}</button>}
        <button
          className="primary"
          onClick={() => {
            trackSaveResult({ tool, method: 'zip', blobs, splitParts })
            downloadZip(items, zipName)
          }}
        >
          {m.common.downloadAll}
        </button>
      </div>
      {failed && <p className="error">{m.common.shareFailed}</p>}
    </div>
  )
}
