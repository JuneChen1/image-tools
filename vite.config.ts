import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 專案頁面的網址是 /<repo 名稱>/
  base: '/image-tools/',
  plugins: [react()],
})
