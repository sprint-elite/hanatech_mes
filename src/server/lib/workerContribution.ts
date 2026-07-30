export function qtyBasisForEfficiency(goodQty: number, inputQty: number): number {
  if (goodQty > 0) return goodQty
  if (inputQty > 0) return inputQty
  return 0
}

export function effectiveQtyWithContribution(basisQty: number, contributionPct: number): number {
  if (basisQty <= 0) return 0
  const pct = Math.min(100, Math.max(1, contributionPct))
  return Math.round((basisQty * pct) / 100)
}

export type WorkTimeEntrySlice = {
  goodQty: number
  inputQty: number
  workMinutes: number
  contributionPct: number
}

/** LOT 작업시간이 있으면 기여도 반영 합계, 없으면 원시 실적 수량 */
export function effectiveGoodQtyForProcess(
  rawGoodQty: number,
  rawInputQty: number,
  entries: WorkTimeEntrySlice[],
): number {
  const active = entries.filter((e) => e.workMinutes > 0)
  if (active.length === 0) return qtyBasisForEfficiency(rawGoodQty, rawInputQty)
  const sum = active.reduce((s, e) => {
    const basis = qtyBasisForEfficiency(e.goodQty, e.inputQty)
    return s + effectiveQtyWithContribution(basis, e.contributionPct)
  }, 0)
  return sum > 0 ? sum : qtyBasisForEfficiency(rawGoodQty, rawInputQty)
}

export function groupWorkTimeEntriesByWorkerProcess<
  T extends WorkTimeEntrySlice & { workerId: number; processId: number },
>(entries: T[]): Map<string, WorkTimeEntrySlice[]> {
  const map = new Map<string, WorkTimeEntrySlice[]>()
  for (const e of entries) {
    const k = `${e.workerId}:${e.processId}`
    const list = map.get(k) ?? []
    list.push({
      goodQty: e.goodQty,
      inputQty: e.inputQty,
      workMinutes: e.workMinutes,
      contributionPct: e.contributionPct,
    })
    map.set(k, list)
  }
  return map
}
