import {
  LABEL_H_MM,
  LABEL_W_MM,
  getLabelPrintPageSpec,
  mmToLabelPx,
  ptToLabelPx,
} from './labelPrintProfile'
import { binarizedCanvasToZpl, trySendZplToZebra } from './zplPrint'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatKoDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

function formatKoDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  })
}

const LABEL_COMPANY_NAME = '(주)하나테크'

function buildProdLotLabelPageCss(
  pageWidthMm: number,
  pageHeightMm: number,
  imageWidthMm: number,
  imageHeightMm: number,
): string {
  return `
  @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @media print {
    html, body {
      width: ${pageWidthMm}mm !important;
      height: ${pageHeightMm}mm !important;
      overflow: hidden !important;
    }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    img.labelPrintImg {
      display: block !important;
      width: ${imageWidthMm}mm !important;
      height: ${imageHeightMm}mm !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      page-break-after: avoid;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
  }
  html, body {
    width: ${pageWidthMm}mm;
    height: ${pageHeightMm}mm;
    background: #fff;
    overflow: hidden;
  }
  img.labelPrintImg {
    display: block;
    width: ${imageWidthMm}mm;
    height: ${imageHeightMm}mm;
  }
`
}

async function printHtmlDocument(
  title: string,
  bodyHtml: string,
  pageCss: string,
  options?: { pageWidthMm?: number; pageHeightMm?: number },
): Promise<void> {
  const pageW = options?.pageWidthMm ?? LABEL_W_MM
  const pageH = options?.pageHeightMm ?? LABEL_H_MM
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = `position:fixed;left:0;top:0;width:${pageW}mm;height:${pageH}mm;border:0;opacity:0;pointer-events:none;z-index:-1;`
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument ?? win?.document
  if (!win || !doc) {
    iframe.remove()
    throw new Error('인쇄 창을 열 수 없습니다.')
  }

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    iframe.remove()
  }

  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8" /><title> </title>
<style>
${pageCss}
</style></head>
<body>${bodyHtml}</body></html>`)
  doc.close()

  await new Promise<void>((resolve, reject) => {
    const runPrint = () => {
      setTimeout(() => {
        try {
          win.focus()
          win.print()
          resolve()
        } catch (e) {
          cleanup()
          reject(e instanceof Error ? e : new Error('인쇄 실패'))
        }
      }, 250)
    }

    win.addEventListener('afterprint', cleanup, { once: true })
    setTimeout(cleanup, 120_000)

    const img = doc.querySelector('img[data-print-wait]') as HTMLImageElement | null
    if (!img) {
      runPrint()
      return
    }
    if (img.complete) {
      runPrint()
      return
    }
    img.addEventListener('load', runPrint, { once: true })
    img.addEventListener(
      'error',
      () => {
        cleanup()
        reject(new Error('라벨 이미지 로드 실패'))
      },
      { once: true },
    )
  })
}

async function printLabelImage(
  imageUrl: string,
  title: string,
  widthPx: number,
  heightPx: number,
): Promise<void> {
  const spec = getLabelPrintPageSpec()
  const pageCss = buildProdLotLabelPageCss(
    spec.pageWidthMm,
    spec.pageHeightMm,
    spec.imageWidthMm,
    spec.imageHeightMm,
  )
  const bodyHtml = `<img class="labelPrintImg" data-print-wait src="${imageUrl}" width="${widthPx}" height="${heightPx}" alt=" " />`
  await printHtmlDocument(' ', bodyHtml, pageCss, {
    pageWidthMm: spec.pageWidthMm,
    pageHeightMm: spec.pageHeightMm,
  })
}

/** 바코드 PNG만 인쇄 (자재 LOT 등 단순 라벨) */
export async function printBarcodeImage(imageUrl: string, label: string): Promise<void> {
  const res = await fetch(imageUrl, { credentials: 'same-origin' })
  if (!res.ok) throw new Error('바코드 이미지를 불러오지 못했습니다.')

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const safeLabel = escapeHtml(label)

  const pageCss = `
  @page { margin: 8mm; size: auto; }
  @media print {
    html, body { margin: 0; padding: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  body {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100vh;
    padding: 4mm 0;
  }
  img { display: block; max-width: 100%; height: auto; }
  .label { margin-top: 2mm; font: 11pt monospace; text-align: center; letter-spacing: 0.06em; }
`

  const bodyHtml = `
  <img data-print-wait src="${blobUrl}" alt="${safeLabel}" />
  <div class="label">${safeLabel}</div>`

  try {
    await printHtmlDocument(`바코드 ${label}`, bodyHtml, pageCss)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

export type ProductionLotLabelData = {
  lotId: number
  lotNo: string
  barcodeText: string
  productCode: string
  productName: string
  createdAt: string
  lotQty: number
}

export type MaterialLotLabelData = {
  lotId: number
  lotNo: string
  barcodeText: string
  productName: string
  receivedDate: string
  receivedQty: string
  remainQty: string
}

type LabelRow = { key: string; value: string; emphasize?: boolean }

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('바코드 이미지 로드 실패'))
    img.src = src
  })
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

function snap(n: number): number {
  return Math.round(n)
}

/** 열전사 인쇄용 순수 흑백(1비트) 변환 — 회색 안티앨리어싱·번짐 제거 */
function binarizeLabelCanvas(canvas: HTMLCanvasElement, threshold = 200): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: W, height: H } = canvas
  const imageData = ctx.getImageData(0, 0, W, H)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!
    const bit = lum < threshold ? 0 : 255
    d[i] = bit
    d[i + 1] = bit
    d[i + 2] = bit
    d[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

function fillHLine(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, thickness: number): void {
  ctx.fillStyle = '#000000'
  const th = Math.max(2, Math.round(thickness))
  ctx.fillRect(Math.round(x1), Math.round(y), Math.round(x2 - x1), th)
}

/** 점선 — stroke 대신 사각형 조각 (열전사에서 끊김·번짐 적음) */
function fillDashedHLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  thickness: number,
  dashMm: number,
  gapMm: number,
): void {
  ctx.fillStyle = '#000000'
  const dash = mmToLabelPx(dashMm)
  const gap = mmToLabelPx(gapMm)
  const th = Math.max(2, Math.round(thickness))
  const y0 = Math.round(y)
  for (let x = x1; x < x2; x += dash + gap) {
    const w = Math.min(dash, x2 - x)
    if (w > 0) ctx.fillRect(Math.round(x), y0, Math.round(w), th)
  }
}

/** 150×100mm · 203dpi 캔버스에 라벨 전체 합성 */
async function renderLotLabelCanvas(
  labelTitle: string,
  rows: LabelRow[],
  barcodeText: string,
  barcodeBlobUrl: string,
): Promise<{ url: string; widthPx: number; heightPx: number; canvas: HTMLCanvasElement }> {
  const W = mmToLabelPx(LABEL_W_MM)
  const H = mmToLabelPx(LABEL_H_MM)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('라벨 이미지를 생성할 수 없습니다.')

  ctx.imageSmoothingEnabled = false

  const padLeft = mmToLabelPx(8)
  const padRight = mmToLabelPx(8)
  const padTop = mmToLabelPx(7)
  const padBottom = mmToLabelPx(7)
  const keyW = mmToLabelPx(28)
  const rowGap = mmToLabelPx(3.2)
  const footerH = ptToLabelPx(9)
  const contentW = W - padLeft - padRight
  const valueX = padLeft + keyW + mmToLabelPx(2)
  const valueMaxW = contentW - keyW - mmToLabelPx(2)
  const fontFamily = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  const monoFamily = 'ui-monospace, Consolas, "Courier New", monospace'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'

  let y = padTop

  ctx.font = `700 ${ptToLabelPx(9)}px ${fontFamily}`
  ctx.fillText('HANA-TECH MES', padLeft, y)

  ctx.font = `800 ${ptToLabelPx(15)}px ${fontFamily}`
  ctx.fillText(labelTitle, snap(padLeft + contentW - ctx.measureText(labelTitle).width), y)

  y += ptToLabelPx(16)
  fillHLine(ctx, padLeft, padLeft + contentW, y, mmToLabelPx(0.45))

  y += mmToLabelPx(4)

  for (const row of rows) {
    const keyFontPx = ptToLabelPx(12)
    const valueFontPx = ptToLabelPx(row.emphasize ? 18 : 12)
    const rowContentH = row.emphasize ? ptToLabelPx(20) : ptToLabelPx(14.5)
    const rowY = snap(y)

    ctx.font = `700 ${keyFontPx}px ${fontFamily}`
    ctx.fillText(row.key, padLeft, snap(rowY + (rowContentH - keyFontPx) / 2))

    ctx.font = `${row.emphasize ? '800' : '600'} ${valueFontPx}px ${fontFamily}`
    const value = truncateText(ctx, row.value, valueMaxW)
    ctx.fillText(value, valueX, snap(rowY + (rowContentH - valueFontPx) / 2))

    y += rowContentH + rowGap
  }

  const footerTop = H - padBottom - footerH
  const barcodeSectionH = footerTop - y - mmToLabelPx(2)
  const barcodeTop = y + mmToLabelPx(2)
  fillDashedHLine(ctx, padLeft, padLeft + contentW, barcodeTop, mmToLabelPx(0.4), 2.5, 1.5)

  const barcodeImg = await loadImageElement(barcodeBlobUrl)
  const lotText = barcodeText
  const lotTextH = ptToLabelPx(12)
  const lotTextGap = mmToLabelPx(1.5)
  const barcodeAreaH = barcodeSectionH - mmToLabelPx(2) - lotTextH - lotTextGap
  const maxBarcodeW = contentW - mmToLabelPx(4)
  const maxBarcodeH = mmToLabelPx(18)

  let drawW = barcodeImg.naturalWidth
  let drawH = barcodeImg.naturalHeight
  // 작을 때도 영역에 맞게 확대 (기존에는 축소만 해서 바코드가 계속 작게 나옴)
  const fitRatio = Math.min(maxBarcodeW / drawW, maxBarcodeH / drawH)
  drawW = Math.max(1, Math.round(drawW * fitRatio))
  drawH = Math.max(1, Math.round(drawH * fitRatio))
  const drawX = snap(padLeft + (contentW - drawW) / 2)
  const drawY = snap(barcodeTop + mmToLabelPx(2) + (maxBarcodeH - drawH) / 2)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(barcodeImg, drawX, drawY, drawW, drawH)

  ctx.font = `700 ${lotTextH}px ${monoFamily}`
  ctx.textAlign = 'center'
  ctx.fillText(lotText, snap(padLeft + contentW / 2), snap(drawY + drawH + lotTextGap))
  ctx.textAlign = 'left'

  ctx.font = `600 ${footerH}px ${fontFamily}`
  ctx.fillText(LABEL_COMPANY_NAME, padLeft, snap(footerTop))

  binarizeLabelCanvas(canvas)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) reject(new Error('라벨 이미지를 생성할 수 없습니다.'))
      else resolve(b)
    }, 'image/png')
  })

  return { url: URL.createObjectURL(blob), widthPx: W, heightPx: H, canvas }
}

async function printLabelFromBarcodeUrl(
  barcodeImageUrl: string,
  labelTitle: string,
  rows: LabelRow[],
  barcodeText: string,
): Promise<void> {
  const res = await fetch(barcodeImageUrl, { credentials: 'same-origin' })
  if (!res.ok) throw new Error('바코드 이미지를 불러오지 못했습니다.')

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)

  let labelImage: { url: string; widthPx: number; heightPx: number; canvas: HTMLCanvasElement } | null = null
  try {
    labelImage = await renderLotLabelCanvas(labelTitle, rows, barcodeText, blobUrl)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }

  try {
    const zpl = binarizedCanvasToZpl(labelImage.canvas)
    const sent = await trySendZplToZebra(zpl)
    if (sent) return

    await printLabelImage(labelImage.url, labelTitle, labelImage.widthPx, labelImage.heightPx)
  } finally {
    URL.revokeObjectURL(labelImage.url)
  }
}

/** 생산 LOT 150×100mm 라벨 양식 인쇄 */
export async function printProductionLotLabel(data: ProductionLotLabelData): Promise<void> {
  await printLabelFromBarcodeUrl(
    `/api/lots/${data.lotId}/barcode-image?view=label`,
    '생산 LOT 라벨',
    [
      { key: '생산 LOT', value: data.lotNo, emphasize: true },
      { key: '품목', value: `${data.productCode} · ${data.productName}` },
      { key: 'LOT 수량', value: `${data.lotQty}개` },
      { key: '생성 일시', value: formatKoDateTime(data.createdAt) },
      { key: '생산 일자', value: formatKoDate(data.createdAt) },
    ],
    data.barcodeText || data.lotNo,
  )
}

/** 자재 LOT 150×100mm 라벨 양식 인쇄 */
export async function printMaterialLotLabel(data: MaterialLotLabelData): Promise<void> {
  await printLabelFromBarcodeUrl(
    `/api/material-lots/${data.lotId}/barcode-image?view=label`,
    '자재 LOT 라벨',
    [
      { key: '자재 LOT', value: data.lotNo, emphasize: true },
      { key: '품목', value: data.productName },
      { key: '입고일자', value: formatKoDate(data.receivedDate) },
      { key: '입고수량', value: data.receivedQty },
      { key: '잔여수량', value: data.remainQty },
    ],
    data.barcodeText || data.lotNo,
  )
}

export type ProductLabelData = {
  productId: number
  productCode: string
  productName: string
  barcodeText: string
  itemType: string
  unit: string
  currentStock: number | null
}

/** 품목 150×100mm 라벨 양식 인쇄 */
export async function printProductLabel(data: ProductLabelData): Promise<void> {
  await printLabelFromBarcodeUrl(
    `/api/products/${data.productId}/barcode-image?view=label`,
    '품목 라벨',
    [
      { key: '품목코드', value: data.productCode, emphasize: true },
      { key: '품목명', value: data.productName },
      { key: '유형', value: data.itemType },
      { key: '단위', value: data.unit },
      {
        key: '현재재고',
        value: data.currentStock != null ? `${data.currentStock}${data.unit ? ` ${data.unit}` : ''}` : '—',
      },
    ],
    data.barcodeText || data.productCode,
  )
}
