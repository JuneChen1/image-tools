# 圖片工具箱

純前端圖片工具箱，所有處理都在瀏覽器內完成。

- **切圖**：等寬直條切成 2、3、4 張，可下載單張或 ZIP
- **壓縮**：批次壓縮，可調品質、限制最長邊
- **轉檔**：批次轉 JPEG / PNG / WebP

---

## 本地開發環境架設
安裝套件：
```bash
npm install
```

啟動專案：
```bash
npm run dev
```

## 結構

```
src/
├─ components/   Dropzone（拖放上傳）
├─ features/     SplitTab（切圖）、BatchTab（壓縮 / 轉檔共用）
└─ utils/        image.ts（Canvas 處理、下載、ZIP）
```
