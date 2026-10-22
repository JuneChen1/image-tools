# image-tools

純前端圖片工具箱，所有處理都在瀏覽器內完成，圖片不會上傳到任何伺服器。

- **切圖**：等寬直條切成 2、3、4 張，可下載單張或 ZIP
- **壓縮**：批次壓縮，可調品質、限制最長邊
- **轉檔**：批次轉 JPEG / PNG / WebP

## 開發

```bash
npm install
npm run dev
```

其他指令：`npm run build`（建置）、`npm run lint`

## 結構

```
src/
├─ components/   Dropzone（拖放上傳）
├─ features/     SplitTab（切圖）、BatchTab（壓縮 / 轉檔共用）
└─ utils/        image.ts（Canvas 處理、下載、ZIP）
```

## 尚未實作

AVIF 輸出、HEIC 讀取、Web Worker、部署設定。
