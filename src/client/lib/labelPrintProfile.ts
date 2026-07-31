/** 실제 라벨 용지 크기 (mm) */
export const LABEL_W_MM = 150
export const LABEL_H_MM = 100

/** Zebra ZD421 등 열전사 라벨 프린터 — 203dpi (도트 = 픽셀 1:1) */
export const LABEL_RENDER_DPI = 203

/**
 * 프린터 드라이버에 표시되는 용지(mm).
 * 실물(150×100)과 드라이버(104×76.2 등)가 다르면 인쇄 시 작게 나옴 → img 크기를 실물 기준으로 출력.
 * 드라이버를 150×100으로 맞출 수 있으면 localStorage `mes.lotLabelDriverCompensate` = '0'
 */
export const DRIVER_PAGE_W_MM = 104
export const DRIVER_PAGE_H_MM = 76.2

export function isDriverCompensateEnabled(): boolean {
  const v = localStorage.getItem('mes.lotLabelDriverCompensate')
  if (v === '0' || v === 'false') return false
  if (v === '1' || v === 'true') return true
  return false
}

export function getLabelPrintPageSpec(): {
  pageWidthMm: number
  pageHeightMm: number
  imageWidthMm: number
  imageHeightMm: number
} {
  if (!isDriverCompensateEnabled()) {
    return {
      pageWidthMm: LABEL_W_MM,
      pageHeightMm: LABEL_H_MM,
      imageWidthMm: LABEL_W_MM,
      imageHeightMm: LABEL_H_MM,
    }
  }
  return {
    pageWidthMm: DRIVER_PAGE_W_MM,
    pageHeightMm: DRIVER_PAGE_H_MM,
    imageWidthMm: LABEL_W_MM,
    imageHeightMm: LABEL_H_MM,
  }
}

export function mmToLabelPx(mm: number): number {
  return Math.round((mm / 25.4) * LABEL_RENDER_DPI)
}

export function ptToLabelPx(pt: number): number {
  return Math.round((pt / 72) * LABEL_RENDER_DPI)
}
