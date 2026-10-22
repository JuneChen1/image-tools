import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 專案頁面的網址是 /<repo 名稱>/
  base: '/image-tools/',
  plugins: [react()],
  // wasm 編碼器要用 new URL(..., import.meta.url) 找檔案，不能被預先打包
  optimizeDeps: { exclude: ['@jsquash/avif'] },
})
