/** Zebra ZD421 203dpi — 캔버스(흑백) → ZPL ^GFA 그래픽 */
export function binarizedCanvasToZpl(canvas: HTMLCanvasElement): string {
  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ZPL 변환 실패')

  const img = ctx.getImageData(0, 0, W, H)
  const bytesPerRow = Math.ceil(W / 8)
  const totalBytes = bytesPerRow * H
  const hex: string[] = []

  for (let y = 0; y < H; y++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit
        if (x < W) {
          const offset = (y * W + x) * 4
          const isBlack = img.data[offset]! < 128
          if (isBlack) byte |= 0x80 >> bit
        }
      }
      hex.push(byte.toString(16).toUpperCase().padStart(2, '0'))
    }
  }

  return `^XA^PW${W}^LL${H}^FO0,0^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hex.join('')}^FS^XZ\n`
}

type ZebraDevice = {
  send: (data: string, onSuccess: () => void, onError: (err: unknown) => void) => void
}

type BrowserPrintApi = {
  getDefaultDevice: (
    kind: string,
    onSuccess: (device: ZebraDevice) => void,
    onError: (err: unknown) => void,
  ) => void
}

declare global {
  interface Window {
    BrowserPrint?: BrowserPrintApi
  }
}

let browserPrintLoadAttempted = false

/** Zebra Browser Print JS 로드 (PC에 Browser Print 설치 시) */
async function ensureBrowserPrint(): Promise<BrowserPrintApi | null> {
  if (window.BrowserPrint) return window.BrowserPrint
  if (browserPrintLoadAttempted) return null
  browserPrintLoadAttempted = true

  const urls = [
    'http://127.0.0.1:9100/browserprint.js',
    'http://localhost:9100/browserprint.js',
  ]

  for (const url of urls) {
    try {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = url
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('load failed'))
        document.head.appendChild(script)
      })
      if (window.BrowserPrint) return window.BrowserPrint
    } catch {
      // 다음 URL 시도
    }
  }
  return null
}

/** ZPL을 ZD421 등 Zebra 프린터로 직접 전송 (Browser Print 필요) */
export async function trySendZplToZebra(zpl: string): Promise<boolean> {
  const bp = (await ensureBrowserPrint()) ?? window.BrowserPrint
  if (!bp) return false

  return new Promise((resolve) => {
    bp.getDefaultDevice(
      'printer',
      (device) => {
        device.send(
          zpl,
          () => resolve(true),
          () => resolve(false),
        )
      },
      () => resolve(false),
    )
  })
}
