// GitHub Pages 沒有 SPA fallback，直接開 /zh/、/en/、/ja/ 會 404。
// 建置後為每個語言複製一份 index.html，並換上對應的 lang 與標題。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// 網站網址，需與 vite.config.ts 的 base 對應（結尾要有 /）
const SITE = 'https://junechen1.github.io/image-tools/'

// 標題需與 src/i18n 內的 siteTitle、htmlLang 保持一致
const LANGS = {
  zh: {
    htmlLang: 'zh-Hant',
    title: '圖片工具箱',
    description:
      '免費線上圖片工具：圖片分割、合併、壓縮與格式轉換，支援 JPEG、PNG、WebP、AVIF、HEIC。',
  },
  en: {
    htmlLang: 'en',
    title: 'Image Toolbox',
    description:
      'Free online image tools: split, combine, compress and convert images. Supports JPEG, PNG, WebP, AVIF and HEIC.',
  },
  ja: {
    htmlLang: 'ja',
    title: '画像ツールボックス',
    description:
      '無料のオンライン画像ツール。画像の分割・結合・圧縮・フォーマット変換に対応（JPEG、PNG、WebP、AVIF、HEIC）。',
  },
}

const urlOf = (code) => `${SITE}${code}/`

// 各語言版本互相指向，x-default 指向首頁（會依使用者偏好導向語言）
const alternates = [
  ...Object.entries(LANGS).map(
    ([code, { htmlLang }]) => `<link rel="alternate" hreflang="${htmlLang}" href="${urlOf(code)}" />`,
  ),
  `<link rel="alternate" hreflang="x-default" href="${SITE}" />`,
]

const withHead = (page, tags) => page.replace(/\s*<\/head>/, `\n    ${tags.join('\n    ')}\n  </head>`)

const html = readFileSync('dist/index.html', 'utf8')

// 首頁沒有語言路徑，內容為預設語言（zh）；不設 canonical，避免和 /zh/ 搶正規網址
writeFileSync(
  'dist/index.html',
  withHead(html, [`<meta name="description" content="${LANGS.zh.description}" />`, ...alternates]),
)

for (const [code, { htmlLang, title, description }] of Object.entries(LANGS)) {
  const out = withHead(
    html
      .replace(/<html lang="[^"]*"/, `<html lang="${htmlLang}"`)
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`),
    [
      `<meta name="description" content="${description}" />`,
      `<link rel="canonical" href="${urlOf(code)}" />`,
      ...alternates,
    ],
  )
  mkdirSync(`dist/${code}`, { recursive: true })
  writeFileSync(`dist/${code}/index.html`, out)
}

// 不存在的路徑會落到 404.html，內容同首頁，由前端導向使用者偏好的語言
writeFileSync('dist/404.html', html)

// sitemap 只列各語言頁；每一頁都標出其他語言版本
const xhtmlLinks = [
  ...Object.entries(LANGS).map(
    ([code, { htmlLang }]) =>
      `    <xhtml:link rel="alternate" hreflang="${htmlLang}" href="${urlOf(code)}" />`,
  ),
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}" />`,
].join('\n')

const urls = Object.keys(LANGS)
  .map((code) => `  <url>\n    <loc>${urlOf(code)}</loc>\n${xhtmlLinks}\n  </url>`)
  .join('\n')

writeFileSync(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
)

console.log(
  `postbuild: generated ${Object.keys(LANGS).join(', ')} pages, 404.html and sitemap.xml`,
)
