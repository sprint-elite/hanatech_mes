import bwipjs from 'bwip-js'

export type BarcodeImageOptions = {
  text: string
  scale?: number
  height?: number
  includetext?: boolean
  dpi?: number
  textsize?: number
}

export type BarcodeImageMeta = {
  buffer: Buffer
  widthPx: number
  heightPx: number
  widthMm: number
  heightMm: number
  dpi: number
}

/** Code 128 — 목록 썸네일 */
export const CODE128_THUMB = {
  dpi: 96,
  scale: 2,
  height: 8,
  includetext: false,
} as const

/**
 * Code 128 — 모니터 스캔 테스트용
 * scale 1 → 약 41×12mm (156×44px), 화면 1:1 표시 시 실제 라벨 크기
 */
export const CODE128_SCREEN = {
  dpi: 96,
  scale: 1,
  height: 12.7,
  includetext: true,
  textsize: 9,
} as const

/**
 * Code 128 — 라벨 프린터 인쇄용 (Zebra 203dpi)
 */
export const CODE128_PRINT = {
  dpi: 203,
  scale: 2,
  height: 12.7,
  includetext: true,
  textsize: 10,
} as const

/** Code 128 — 생산 LOT 라벨 (ZD421 203dpi) */
export const CODE128_LABEL = {
  dpi: 203,
  scale: 3,
  height: 18,
  includetext: false,
} as const

function pxToMm(px: number, dpi: number): number {
  return Math.round((px / dpi) * 25.4 * 10) / 10
}

function pngDimensions(buffer: Buffer): { widthPx: number; heightPx: number } {
  return {
    widthPx: buffer.readUInt32BE(16),
    heightPx: buffer.readUInt32BE(20),
  }
}

/** Code 128 PNG + 표시용 메타데이터 */
export async function renderCode128PngWithMeta(options: BarcodeImageOptions): Promise<BarcodeImageMeta> {
  const text = options.text.trim()
  if (!text) throw new Error('BARCODE_TEXT_EMPTY')

  const dpi = options.dpi ?? CODE128_THUMB.dpi
  const includetext = options.includetext ?? CODE128_THUMB.includetext

  const buffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: options.scale ?? CODE128_THUMB.scale,
    height: options.height ?? CODE128_THUMB.height,
    dpi,
    includetext,
    ...(includetext
      ? {
          textsize: options.textsize ?? CODE128_SCREEN.textsize,
          textxalign: 'center' as const,
        }
      : {}),
    backgroundcolor: 'ffffff',
  })

  const { widthPx, heightPx } = pngDimensions(buffer)

  return {
    buffer,
    widthPx,
    heightPx,
    widthMm: pxToMm(widthPx, dpi),
    heightMm: pxToMm(heightPx, dpi),
    dpi,
  }
}

export async function renderCode128Png(options: BarcodeImageOptions): Promise<Buffer> {
  const { buffer } = await renderCode128PngWithMeta(options)
  return buffer
}
