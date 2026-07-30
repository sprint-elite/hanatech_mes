import type { WorkerCountLimit } from './processWorkerLimits'
import { groupWorkerCountBounds } from './processWorkerLimits'

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
  estimatedEfficiencyPct: number | null
  orderQty: number
  groupCount: number
  totalWorkersUsed: number
}

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

type GroupPick = {
  processIds: number[]
  workerIds: number[]
  stageSec: number
  sourcesByWorker: Map<number, Map<number, 'history' | 'standard'>>
}

function rankWorkersForGroup(
  processIds: number[],
  candidates: WorkerRef[],
  historySec: Map<string, number>,
  standardSecByProcess: Map<number, number | null>,
): { workerId: number; totalSec: number; sources: Map<number, 'history' | 'standard'> }[] {
  const ranked: { workerId: number; totalSec: number; sources: Map<number, 'history' | 'standard'> }[] = []
  for (const w of candidates) {
    const { totalSec, sources } = groupUnitSec(w.id, processIds, historySec, standardSecByProcess)
    if (!Number.isFinite(totalSec) || totalSec <= 0) continue
    ranked.push({ workerId: w.id, totalSec, sources })
  }
  ranked.sort((a, b) => a.totalSec - b.totalSec)
  return ranked
}

/**
 * 공정 묶음별 작업자 수(min~max)와 MBOM 인원 제약을 반영.
 * 묶음 내 공정은 배정된 작업자들이 병렬로 담당(스테이지 시간 ≈ 최고 효율 1인 시간 / 인원수).
 */
export function optimizeProcessWorkerAssignmentGrouped(
  processGroups: number[][],
  workers: WorkerRef[],
  historySec: Map<string, number>,
  standardSecByProcess: Map<number, number | null>,
  workerLimitsByProcess: Map<number, WorkerCountLimit>,
  orderQty: number,
): OptimizeResult | { error: 'NO_WORKERS' | 'NOT_ENOUGH_WORKERS' | 'NO_PROCESSES' | 'INFEASIBLE_GROUP' } {
  const groups = processGroups.filter((g) => g.length > 0)
  if (groups.length === 0) return { error: 'NO_PROCESSES' }
  if (workers.length === 0) return { error: 'NO_WORKERS' }

  const groupBounds = groups.map((g) => groupWorkerCountBounds(g, workerLimitsByProcess))
  for (const b of groupBounds) {
    if (typeof b === 'object' && b !== null && 'error' in b) return { error: 'INFEASIBLE_GROUP' }
  }
  const minTotal = groupBounds.reduce((s, b) => s + (b as { lo: number; hi: number }).lo, 0)
  if (workers.length < minTotal) return { error: 'NOT_ENOUGH_WORKERS' }

  let best: OptimizeResult | null = null

  const walk = (gIdx: number, used: Set<number>, groupPicks: GroupPick[]) => {
    if (gIdx >= groups.length) {
      const unitTimes = groupPicks.map((g) => g.stageSec)
      if (unitTimes.some((t) => !Number.isFinite(t) || t <= 0)) return
      const makespan = flowLineMakespanSeconds(unitTimes, orderQty)
      if (best == null || makespan < best.estimatedMakespanSeconds) {
        const assignments: OptimizeAssignmentRow[] = []
        for (const g of groupPicks) {
          for (const pid of g.processIds) {
            const std = standardSecByProcess.get(pid) ?? null
            for (const wid of g.workerIds) {
              const { sec, source } = secForWorkerProcess(wid, pid, historySec, std)
              const srcMap = g.sourcesByWorker.get(wid)
              assignments.push({
                processId: pid,
                workerId: wid,
                secPerUnit: sec,
                standardSecPerUnit: std,
                efficiencyPct: efficiencyPct(sec, std),
                dataSource: srcMap?.get(pid) ?? source,
              })
            }
          }
        }
        const totalWorkersUsed = new Set(assignments.map((a) => a.workerId)).size
        best = {
          orderQty,
          groupCount: groups.length,
          totalWorkersUsed,
          estimatedMakespanSeconds: Math.round(makespan * 100) / 100,
          estimatedEfficiencyPct: estimatedLineEfficiencyPct(
            groupPicks,
            standardSecByProcess,
            makespan,
            orderQty,
          ),
          assignments,
        }
      }
      return
    }

    const processIds = groups[gIdx]!
    const bounds = groupBounds[gIdx] as { lo: number; hi: number }
    const available = workers.filter((w) => !used.has(w.id))
    if (available.length < bounds.lo) return

    const ranked = rankWorkersForGroup(processIds, available, historySec, standardSecByProcess)
    if (ranked.length < bounds.lo) return

    for (let k = bounds.lo; k <= bounds.hi && k <= ranked.length; k++) {
      const picked = ranked.slice(0, k)
      const bestSec = picked[0]!.totalSec
      const stageSec = bestSec / k
      const workerIds = picked.map((p) => p.workerId)
      const sourcesByWorker = new Map<number, Map<number, 'history' | 'standard'>>()
      for (const p of picked) {
        sourcesByWorker.set(p.workerId, p.sources)
      }
      for (const wid of workerIds) used.add(wid)
      groupPicks.push({ processIds, workerIds, stageSec, sourcesByWorker })
      walk(gIdx + 1, used, groupPicks)
      groupPicks.pop()
      for (const wid of workerIds) used.delete(wid)
    }
  }

  walk(0, new Set(), [])

  if (best == null) return { error: 'NO_WORKERS' }
  return best
}

function standardStageSecForGroup(
  processIds: number[],
  workerCount: number,
  standardSecByProcess: Map<number, number | null>,
): number | null {
  if (workerCount <= 0) return null
  let sum = 0
  for (const pid of processIds) {
    const std = standardSecByProcess.get(pid) ?? null
    if (std == null || std <= 0) return null
    sum += std
  }
  return sum / workerCount
}

/**
 * 배정과 동일한 묶음·인원 구조에서 표준 시간만으로 산출한 메이크스팬 대비 실제 메이크스팬 비율(%).
 */
export function estimatedLineEfficiencyPct(
  groupPicks: { processIds: number[]; workerIds: number[] }[],
  standardSecByProcess: Map<number, number | null>,
  estimatedMakespanSeconds: number,
  orderQty: number,
): number | null {
  const standardUnitTimes = groupPicks.map((g) =>
    standardStageSecForGroup(g.processIds, g.workerIds.length, standardSecByProcess),
  )
  if (
    standardUnitTimes.some((t) => t == null || t <= 0) ||
    orderQty <= 0 ||
    !Number.isFinite(estimatedMakespanSeconds) ||
    estimatedMakespanSeconds <= 0
  ) {
    return null
  }
  const standardMakespan = flowLineMakespanSeconds(standardUnitTimes as number[], orderQty)
  if (standardMakespan <= 0) return null
  return Math.round((standardMakespan / estimatedMakespanSeconds) * 1000) / 10
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
