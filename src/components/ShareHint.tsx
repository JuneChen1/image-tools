import { useI18n } from '../i18n'
import { canShareFiles, isTouchDevice, toFiles, type NamedBlob } from '../utils/share'

/**
 * 放在結果下方的說明：手機請點「分享 / 儲存到相簿」才會進相簿。
 * 只在觸控裝置且支援分享（也就是真的有那個按鈕）時顯示，桌機不顯示
 */
export default function ShareHint({ items }: { items: NamedBlob[] }) {
  const { m } = useI18n()
  if (!isTouchDevice() || !canShareFiles(toFiles(items))) return null
  return <p className="hint">{m.common.shareHint}</p>
}
