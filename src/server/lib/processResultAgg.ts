/** 동일 현장 입력(한 번의 POST)으로 여러 공정에 실적이 복제될 때 품목 합계는 1회만 집계 */
export type ProcessResultAggRow = {
  productionLotId: number
  workerId: number | null
  processSequence: number
  inputQty: number
  goodQty: number
  defectQty: number
  createdAt: Date
  lot: { productId: number }
}

export function dedupeProcessResultsForProductTotals(rows: ProcessResultAggRow[]): ProcessResultAggRow[] {
  const best = new Map<string, ProcessResultAggRow>()
  for (const r of rows) {
    const key = `${r.lot.productId}|${r.productionLotId}|${r.workerId ?? 0}|${r.createdAt.getTime()}`
    const prev = best.get(key)
    if (!prev || r.processSequence > prev.processSequence) {
      best.set(key, r)
    }
  }
  return [...best.values()]
}
