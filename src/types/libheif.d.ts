// libheif-js 沒有附型別；這裡只宣告我們用到的部分
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifTarget {
    data: Uint8ClampedArray<ArrayBuffer>
    width: number
    height: number
  }

  interface HeifImage {
    get_width(): number
    get_height(): number
    /** 把影像解成 RGBA 寫進 target；解碼失敗時 callback 收到 null */
    display(target: HeifTarget, callback: (result: HeifTarget | null) => void): void
  }

  interface Libheif {
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] }
  }

  /** wasm 已內嵌在 JS 裡，不需要另外處理 .wasm 檔 */
  const createLibheif: () => Libheif | Promise<Libheif>
  export default createLibheif
}
