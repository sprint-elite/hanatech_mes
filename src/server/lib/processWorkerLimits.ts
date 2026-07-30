export type WorkerCountLimit = { minWorkers: number; maxWorkers: number }

export function groupWorkerCountBounds(
  processIds: number[],
  limitsByProcess: Map<number, WorkerCountLimit>,
): { lo: number; hi: number } | { error: 'INFEASIBLE' } {
  let lo = 1
  let hi = 99
  for (const pid of processIds) {
    const l = limitsByProcess.get(pid) ?? { minWorkers: 1, maxWorkers: 1 }
    lo = Math.max(lo, l.minWorkers)
    hi = Math.min(hi, l.maxWorkers)
  }
  if (lo > hi) return { error: 'INFEASIBLE' }
  return { lo, hi }
}

export function minWorkersRequiredForGroups(
  processGroups: number[][],
  limitsByProcess: Map<number, WorkerCountLimit>,
): number | { error: 'INFEASIBLE' } {
  let sum = 0
  for (const g of processGroups) {
    const b = groupWorkerCountBounds(g, limitsByProcess)
    if (typeof b === 'object' && b !== null && 'error' in b) return { error: 'INFEASIBLE' }
    sum += b.lo
  }
  return sum
}
