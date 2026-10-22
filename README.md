# 圖片工具箱 (Image Toolbox)

> **線上圖片處理工具**  
> 專為社群媒體發圖、圖片壓縮與格式轉換打造，支援 JPEG, PNG, WebP, AVIF, HEIC 格式。

---

## 主要功能 (Features)

### 1. 圖切條 (Image Splitter)
* **重點功能**：將單張圖片切成 **2、3、4 張** 等寬直條，方便在 X 上拼成滿版大圖（預設切為 3 張）。
* **無損精準**：切完拼回後與原圖 **逐像素一致** (Pixel-perfect)。
* **單張模式**：一次僅處理 1 張圖片，若拖入 2 張以上會顯示提示訊息。
* **輸出格式**：支援 PNG（預設）、JPEG、WebP、AVIF。
* **下載方式**：可單張分別下載，或打包成 ZIP 檔下載。

### 2. 壓縮 (Batch Compression)
* **批次處理**：一次最多可處理 **10 張** 圖片。
* **品質調整**：品質滑桿支援 **10% – 100%** 自由調校。
* **最長邊限制**：
  * 不限制（維持原解析度）
  * 4096 px / 2048 px / 1920 px / 1280 px
* **預設格式**：預設為「維持原格式」。
* **數據呈現**：即時顯示壓縮前後的檔案大小與 **省下的%數**。
* **下載方式**：可打包成 ZIP 一鍵下載。

### 3. 轉檔 (Batch Conversion)
* **批次處理**：一次最多可處理 **10 張** 圖片。
* **輸出格式**：支援 WebP、JPEG、PNG、AVIF。
* **透明背景處理**：轉成 JPEG 時，可自訂「背景填色」來處理透明圖層。
* **下載方式**：可打包成 ZIP 一鍵下載。

---

## 支援格式 (Supported Formats)

| 類型 | 支援格式 | 說明 |
| :--- | :--- | :--- |
| **📥 輸入格式** | `JPEG`, `PNG`, `WebP`, `AVIF`, `HEIC` | 包含 iPhone 預設照片格式 (`HEIC`) |
| **📤 輸出格式** | `JPEG`, `PNG`, `WebP`, `AVIF` | 涵蓋主流與最新高效能格式 |
| **❌ 不支援格式** | `GIF`, `SVG`, `TIFF`, `BMP` 等 | 拖入時會自動略過並跳出提示 |

---

## 上傳規則與限制 (Upload Limits)

| 限制項目 | 規格上限 | 說明 / 超過處理機制 |
| :--- | :--- | :--- |
| **單檔大小** | **50 MB** | 超過大小會自動略過並顯示提示 |
| **最大像素** | **6,400 萬像素** | 約 $8000 \times 8000$ px，超過會自動略過並顯示提示 |
| **批次數量** | **最多 10 張** | 超過數量會自動略過並顯示提示 |





---

## 專案技術 (Tech Stack)

**純前端、沒有後端**：所有圖片處理都在使用者的瀏覽器內完成，不會上傳到任何伺服器。

| 類別 | 技術 | 用途 |
| :--- | :--- | :--- |
| **前端框架** | React 19 + TypeScript | 介面與狀態管理 |
| **建置工具** | Vite 8 | 開發伺服器與打包 |
| **影像處理** | Canvas API / OffscreenCanvas | 裁切、縮放，以及 PNG、JPEG、WebP 的編碼 |
| **背景處理** | Web Worker | 解碼與編碼都在背景執行，處理大圖或 AVIF 時畫面不會卡住；瀏覽器不支援時自動退回主執行緒 |
| **AVIF 編碼** | `@jsquash/avif` (WebAssembly) | 瀏覽器的 Canvas 無法輸出 AVIF，選擇 AVIF 時才動態載入 |
| **HEIC 解碼** | `libheif-js` (WebAssembly) | 瀏覽器原生讀不了 HEIC（iPhone 照片）時才動態載入 |
| **打包下載** | JSZip | 將多張圖片打包成 ZIP |
| **多語系** | 自製輕量字典 + 網址路徑 | 以 `/zh/`、`/en/` 區分中英文，建置後由 `scripts/postbuild.mjs` 產生各語言頁面（GitHub Pages 沒有路徑轉址功能） |
| **樣式** | 純 CSS | 不使用 UI 框架，亮 / 暗色依系統設定自動切換 |
| **程式碼檢查** | oxlint | 靜態檢查 |
| **自動化測試** | Vitest | 測試切圖邊界、上傳規則與上限、中英文字典等純邏輯 |
| **部署** | GitHub Pages | 純靜態網站 |

### 常用指令

```bash
npm run dev       # 開發伺服器
npm run build     # 型別檢查 + 建置 + 產生各語言頁面
npm run preview   # 預覽建置結果
npm run lint      # 程式碼檢查
npm test          # 執行自動化測試
```

---

## 結構

```
image-tools/
├─ public/
│  └─ favicon.svg
├─ scripts/
│  └─ postbuild.mjs        建置後產生 /zh/、/en/ 頁面與 404.html
├─ src/
│  ├─ components/
│  │  └─ Dropzone.tsx      拖放上傳區（格式、大小、張數檢查與提示）
│  ├─ features/
│  │  ├─ SplitTab.tsx      切圖
│  │  └─ BatchTab.tsx      壓縮與轉檔共用
│  ├─ i18n/
│  │  ├─ zh.ts / en.ts     中英文字典
│  │  ├─ I18nProvider.tsx  語言狀態、網址同步
│  │  └─ useI18n.ts        取得語言與錯誤訊息的 hook
│  ├─ workers/
│  │  ├─ image.worker.ts   在背景解碼、處理、編碼
│  │  └─ protocol.ts       主執行緒與 Worker 的訊息格式
│  ├─ utils/
│  │  ├─ image.ts          Canvas 處理、格式對照、下載、ZIP
│  │  ├─ decode.ts         解碼（HEIC 退回 WebAssembly）、像素上限檢查
│  │  ├─ avif.ts           AVIF 編碼
│  │  ├─ processImage.ts   派工給 Worker、取消、備援
│  │  ├─ selectFiles.ts    上傳篩選規則
│  │  └─ limits.ts         大小與像素上限
│  ├─ types/
│  │  └─ libheif.d.ts      libheif-js 型別宣告
│  ├─ App.tsx / main.tsx   頁面外框與進入點
│  ├─ *.css                樣式
│  └─ *.test.ts            測試檔，放在被測檔案旁邊（Vitest）
└─ package.json、vite.config.ts、tsconfig*.json   專案、建置與型別設定
```

---

## 本地開發環境架設

**環境需求**：[Node.js](https://nodejs.org/) **22.12 以上**（Vite 8 需要 20.19 以上或 22.12 以上，測試工具 Vitest 5 需要 22.12 以上；本專案以 Node 24 開發）。可用 `node -v` 確認版本。

1. 複製專案
```bash
git clone https://github.com/JuneChen1/image-tools.git
```

2. 移動到專案資料夾
```bash
cd image-tools
```

3. 安裝套件：
```bash
npm install
```

4. 啟動專案：
```bash
npm run dev
```

---

## 致謝與協作 (Acknowledgments)
* **AI 協作開發**  
  本專案全流程由 **Claude Code** 輔助架構設計與程式碼編寫。

* **介面與樣式規範**  
  前端視覺風格採用 [Claude Code Skill 設計風格圖鑑 · 島嶼共鳴 2026](https://www.casper.tw/claude-skill-design-gallery/) 範例開發。

* **第三方開源套件**  
  本專案使用下列開源套件，感謝作者們的貢獻，授權條款依各專案規定：

  | 套件 | 用途 | 授權 |
  | :--- | :--- | :--- |
  | [`libheif-js`](https://github.com/catdad-experiments/libheif-js) | 讀取 HEIC 圖片（WebAssembly 版的 [libheif](https://github.com/strukturag/libheif)） | LGPL-3.0 |
  | [`@jsquash/avif`](https://github.com/jamsinclair/jSquash) | 輸出 AVIF 圖片（WebAssembly） | Apache-2.0 |
  | [`JSZip`](https://github.com/Stuk/jszip) | 將多張圖片打包成 ZIP | MIT 或 GPL-3.0 以上（雙授權） |
