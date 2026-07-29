/** 유닛이 공정을 순차 통과하는 라인(파이프라인) 기준: 마지막 완성 시각(초) */
export function flowLineMakespanSeconds(perUnitSecByProcess: number[], orderQty: number): number {
  if (orderQty <= 0 || perUnitSecByProcess.length === 0) return 0
  const sum = perUnitSecByProcess.reduce((s, t) => s + t, 0)
  if (orderQty === 1) return sum
  const bottleneck = Math.max(...perUnitSecByProcess)
  return sum + (orderQty - 1) * bottleneck
}

export type OptimizeAssignmentRow = {
  processId: number
  workerId: number
  secPerUnit: number
  standardSecPerUnit: number | null
  efficiencyPct: number | null
  dataSource: 'history' | 'standard'
}

export type OptimizeResult = {
  assignments: OptimizeAssignmentRow[]
  estimatedMakespanSeconds: number
  orderQty: number
  groupCount: number
}

type ProcessRef = { id: number; sequence: number }
type WorkerRef = { id: number }

function efficiencyPct(secPerUnit: number, standardSecPerUnit: number | null): number | null {
  if (standardSecPerUnit == null || standardSecPerUnit <= 0 || secPerUnit <= 0) return null
  return Math.round((standardSecPerUnit / secPerUnit) * 1000) / 10
}

function secForWorkerProcess(
  workerId: number,
  processId: number,
  historySec: Map<string, number>,
  standardSec: number | null,
): { sec: number; source: 'history' | 'standard' } {
  const hist = historySec.get(`${workerId}:${processId}`)
  if (hist != null && hist > 0) return { sec: hist, source: 'history' }
  if (standardSec != null && standardSec > 0) return { sec: standardSec, source: 'standard' }
  return { sec: Number.POSITIVE_INFINITY, source: 'standard' }
}

function groupUnitSec(
  workerId: number,
  processIds: number[],
  historySec: Map<string, number>,
  standardSecByProcess: Map<number, number | null>,
): { totalSec: number; sources: Map<number, 'history' | 'standard'> } {
  let totalSec = 0
  const sources = new Map<number, 'history' | 'standard'>()
  for (const pid of processIds) {
    const std = standardSecByProcess.get(pid) ?? null
    const { sec, source } = secForWorkerProcess(workerId, pid, historySec, std)
    if (!Number.isFinite(sec)) return { totalSec: Number.POSITIVE_INFINITY, sources }
    totalSec += sec
    sources.set(pid, source)
  }
  return { totalSec, sources }
}

/**
 * 공정 묶음별로 작업자 1명(묶음 간 서로 다른 작업자). 묶음 내 공정은 한 작업자가 순차 수행.
 */
export function optimizeProcessWorkerAssignmentGrouped(
  processGroups: number[][],
  workers: WorkerRef[],
  historySec: Map<string, number>,
  standardSecByProcess: Map<number, number | null>,
  orderQty: number,
): OptimizeResult | { error: 'NO_WORKERS' | 'NOT_ENOUGH_WORKERS' | 'NO_PROCESSES' | 'INVALID_GROUPS' } {
  const groups = processGroups.filter((g) => g.length > 0)
  if (groups.length === 0) return { error: 'NO_PROCESSES' }
  if (workers.length === 0) return { error: 'NO_WORKERS' }
  if (workers.length < groups.length) return { error: 'NOT_ENOUGH_WORKERS' }

  let best: OptimizeResult | null = null

  const walk = (
    gIdx: number,
    used: Set<number>,
    groupPicks: { processIds: number[]; workerId: number; stageSec: number; sources: Map<number, 'history' | 'standard'> }[],
  ) => {
    if (gIdx >= groups.length) {
      const unitTimes = groupPicks.map((g) => g.stageSec)
      if (unitTimes.some((t) => !Number.isFinite(t) || t <= 0)) return
      const makespan = flowLineMakespanSeconds(unitTimes, orderQty)
      if (best == null || makespan < best.estimatedMakespanSeconds) {
        const assignments: OptimizeAssignmentRow[] = []
        for (const g of groupPicks) {
          for (const pid of g.processIds) {
            const std = standardSecByProcess.get(pid) ?? null
            const { sec, source } = secForWorkerProcess(g.workerId, pid, historySec, std)
            assignments.push({
              processId: pid,
              workerId: g.workerId,
              secPerUnit: sec,
              standardSecPerUnit: std,
              efficiencyPct: efficiencyPct(sec, std),
              dataSource: g.sources.get(pid) ?? source,
            })
          }
        }
        best = {
          orderQty,
          groupCount: groups.length,
          estimatedMakespanSeconds: Math.round(makespan * 100) / 100,
          assignments,
        }
      }
      return
    }

    const processIds = groups[gIdx]!
    for (const w of workers) {
      if (used.has(w.id)) continue
      const { totalSec, sources } = groupUnitSec(w.id, processIds, historySec, standardSecByProcess)
      if (!Number.isFinite(totalSec)) continue
      used.add(w.id)
      groupPicks.push({ processIds, workerId: w.id, stageSec: totalSec, sources })
      walk(gIdx + 1, used, groupPicks)
      groupPicks.pop()
      used.delete(w.id)
    }
  }

  walk(0, new Set(), [])

  if (best == null) return { error: 'NO_WORKERS' }
  return best
}

export function formatMakespanKo(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 90) return `${Math.round(seconds)}초`
  const min = Math.round(seconds / 60)
  if (min < 120) return `약 ${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`
}
