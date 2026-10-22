// GitHub Pages 沒有 SPA fallback，直接開 /zh/、/en/、/ja/ 會 404。
// 建置後為每個語言複製一份 index.html，並換上對應的 lang 與標題。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// 標題需與 src/i18n 內的 siteTitle、htmlLang 保持一致
const LANGS = {
  zh: { htmlLang: 'zh-Hant', title: '圖片工具箱' },
  en: { htmlLang: 'en', title: 'Image Toolbox' },
  ja: { htmlLang: 'ja', title: '画像ツールボックス' },
}

const html = readFileSync('dist/index.html', 'utf8')

for (const [code, { htmlLang, title }] of Object.entries(LANGS)) {
  const out = html
    .replace(/<html lang="[^"]*"/, `<html lang="${htmlLang}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  mkdirSync(`dist/${code}`, { recursive: true })
  writeFileSync(`dist/${code}/index.html`, out)
}

// 不存在的路徑會落到 404.html，內容同首頁，由前端導向使用者偏好的語言
writeFileSync('dist/404.html', html)

console.log(`postbuild: generated ${Object.keys(LANGS).join(', ')} pages and 404.html`)
