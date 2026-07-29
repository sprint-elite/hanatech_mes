export type ProcessGroupProc = {
  id: number
  sequence: number
  processCode: string
  processName: string
}

/** 인접 공정끼리만 묶음. mergeWithNext[i]=true 이면 i번째와 i+1번째 공정이 같은 작업자 */
export function mergeFlagsToProcessGroups(orderedProcessIds: number[], mergeWithNext: boolean[]): number[][] {
  if (orderedProcessIds.length === 0) return []
  const groups: number[][] = []
  let cur = [orderedProcessIds[0]!]
  for (let i = 0; i < mergeWithNext.length; i++) {
    if (mergeWithNext[i]) {
      cur.push(orderedProcessIds[i + 1]!)
    } else {
      groups.push(cur)
      cur = [orderedProcessIds[i + 1]!]
    }
  }
  groups.push(cur)
  return groups
}

export function formatProcessGroupLabel(processes: ProcessGroupProc[], processIds: number[]): string {
  const byId = new Map(processes.map((p) => [p.id, p]))
  return processIds
    .map((id) => {
      const p = byId.get(id)
      return p ? String(p.sequence) : '?'
    })
    .join('·')
}

export function formatGroupsPreview(processes: ProcessGroupProc[], groups: number[][]): string {
  if (groups.length === 0) return '—'
  return groups.map((g) => formatProcessGroupLabel(processes, g)).join(' / ')
}

/** 공정 5단계 등 현장에서 흔한 1·2 / 3 / 4·5 패턴 */
export function defaultMergeWithNext(processCount: number): boolean[] {
  const flags = Array(Math.max(0, processCount - 1)).fill(false)
  if (processCount === 5) {
    flags[0] = true
    flags[3] = true
  }
  return flags
}
