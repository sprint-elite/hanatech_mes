/** DB/API에는 FG / WIP / RAW 로 저장, 화면 표시는 한글 */

export const ITEM_TYPE_STORAGE = ['FG', 'WIP', 'RAW'] as const

export function normalizeItemTypeToCode(raw: string): (typeof ITEM_TYPE_STORAGE)[number] | null {
  const t = raw.trim()
  const u = t.toUpperCase()
  if (u === 'FG' || t === '완제품') return 'FG'
  if (u === 'WIP' || t === '반제품') return 'WIP'
  if (u === 'RAW' || t === '원자재') return 'RAW'
  return null
}

export function itemTypeLabel(code: string): string {
  const c = normalizeItemTypeToCode(code)
  if (c === 'FG') return '완제품'
  if (c === 'WIP') return '반제품'
  if (c === 'RAW') return '원자재'
  return code.trim() || '—'
}

export function isStandardItemType(code: string): boolean {
  return normalizeItemTypeToCode(code) != null
}

export function productItemTypeCode(itemType: string): (typeof ITEM_TYPE_STORAGE)[number] | null {
  return normalizeItemTypeToCode(itemType)
}
