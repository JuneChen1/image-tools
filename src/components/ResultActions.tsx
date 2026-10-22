import { useState } from 'react'
import { useI18n } from '../i18n'
import { downloadZip } from '../utils/image'
import { canShareFiles, shareFiles, toFiles, type NamedBlob } from '../utils/share'

interface Props {
  items: NamedBlob[]
  zipName: string
}

/**
 * 結果區右上角的按鈕：「分享 / 儲存到相簿」（支援時才顯示）與「下載全部 (ZIP)」。
 * 手機（尤其是 iPhone）下載的檔案只會進「檔案 App」，要用分享選單的「儲存影像」才進得了相簿
 */
export default function ResultActions({ items, zipName }: Props) {
  const { m } = useI18n()
  const [failed, setFailed] = useState(false)

  const files = toFiles(items)
  const shareable = canShareFiles(files)

  async function onShare() {
    setFailed(false)
    try {
      await shareFiles(files)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="card-actions">
      <div className="card-actions-row">
        {shareable && <button onClick={onShare}>{m.common.share}</button>}
        <button className="primary" onClick={() => downloadZip(items, zipName)}>
          {m.common.downloadAll}
        </button>
      </div>
      {failed && <p className="error">{m.common.shareFailed}</p>}
    </div>
  )
}
