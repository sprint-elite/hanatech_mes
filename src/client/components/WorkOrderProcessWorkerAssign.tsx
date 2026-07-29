import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiJson, ApiError } from '../lib/api'
import { ProcessWorkerGroupOptimizeModal } from './ProcessWorkerGroupOptimizeModal'
import {
  ProcessWorkerAssignConfirmModal,
  type AssignConfirmRow,
} from './ProcessWorkerAssignConfirmModal'

export type ProcessWorkerMap = Record<number, number[]>

type MbomProcessRef = {
  id: number
  processCode: string
  processName: string
  sequence: number
}

export type WorkerPickRef = { id: number; workerCode: string; workerName: string; status: string }

type AssignedProcessWorkerRow = {
  processId: number
  workerId: number
  worker?: { id: number }
}

type AssignedWorkerRow = { worker: { id: number } }

const WORKER_DRAG_MIME = 'application/x-mes-worker-id'

export function buildProcessWorkerMap(
  processIds: number[],
  assignedProcessWorkers?: AssignedProcessWorkerRow[],
  legacyAssignedWorkers?: AssignedWorkerRow[],
): ProcessWorkerMap {
  const map: ProcessWorkerMap = Object.fromEntries(processIds.map((id) => [id, []]))
  if (assignedProcessWorkers?.length) {
    for (const row of assignedProcessWorkers) {
      if (!map[row.processId]) map[row.processId] = []
      const wid = row.worker?.id ?? row.workerId
      if (!map[row.processId].includes(wid)) map[row.processId].push(wid)
    }
    return map
  }
  const legacyIds = (legacyAssignedWorkers ?? []).map((a) => a.worker.id)
  if (legacyIds.length > 0) {
    for (const pid of processIds) map[pid] = [...legacyIds]
  }
  return map
}

export function processWorkerAssignmentsPayload(map: ProcessWorkerMap): { processId: number; workerIds: number[] }[] {
  return Object.entries(map).map(([processId, workerIds]) => ({
    processId: Number(processId),
    workerIds: [...new Set(workerIds)].filter((id) => id > 0),
  }))
}

export function uniqueWorkerCount(map: ProcessWorkerMap): number {
  return new Set(Object.values(map).flat()).size
}

export function formatAssignedWorkerNames(map: ProcessWorkerMap, workers: WorkerPickRef[]): string {
  const ids = [...new Set(Object.values(map).flat())].filter((id) => id > 0)
  if (ids.length === 0) return '—'
  const byId = new Map(workers.map((w) => [w.id, w]))
  return ids
    .map((id) => {
      const w = byId.get(id)
      return w ? w.workerName || w.workerCode : `#${id}`
    })
    .join(', ')
}

type Variant = 'ops' | 'wo'

type Props = {
  productId: number | null
  workers: WorkerPickRef[]
  value: ProcessWorkerMap
  onChange: (next: ProcessWorkerMap) => void
  variant: Variant
  metaExtra?: string
  legacyWorkerIds?: number[]
  /** 모달 안에 넣을 때 바깥 테두리·제목 생략 */
  embedded?: boolean
  orderQty?: number
}

function formatMakespanKo(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 90) return `${Math.round(seconds)}초`
  const min = Math.round(seconds / 60)
  if (min < 120) return `약 ${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `약 ${h}시간 ${m}분` : `약 ${h}시간`
}

export function WorkOrderProcessWorkerAssign({
  productId,
  workers,
  value,
  onChange,
  variant,
  metaExtra,
  legacyWorkerIds,
  embedded,
  orderQty = 1,
}: Props) {
  const [processes, setProcesses] = useState<MbomProcessRef[]>([])
  const [loadingProc, setLoadingProc] = useState(false)
  const [procErr, setProcErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)
  const [focusedProcessId, setFocusedProcessId] = useState<number | null>(null)
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeErr, setOptimizeErr] = useState<string | null>(null)
  const [groupOptOpen, setGroupOptOpen] = useState(false)
  const [assignConfirm, setAssignConfirm] = useState<{
    groupPreview: string
    makespanLabel: string
    assignments: AssignConfirmRow[]
  } | null>(null)
  const legacySeedApplied = useRef(false)

  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])

  useEffect(() => {
    legacySeedApplied.current = false
  }, [productId, legacyWorkerIds])

  useEffect(() => {
    if (productId == null || !Number.isInteger(productId) || productId < 1) {
      setProcesses([])
      return
    }
    let cancelled = false
    setLoadingProc(true)
    setProcErr(null)
    void apiJson<{ ok: boolean; items: MbomProcessRef[] }>(`/api/processes?productId=${productId}`)
      .then((res) => {
        if (cancelled) return
        setProcesses(res.items ?? [])
      })
      .catch((e) => {
        if (cancelled) return
        setProcErr(e instanceof Error ? e.message : '공정 조회 실패')
        setProcesses([])
      })
      .finally(() => {
        if (!cancelled) setLoadingProc(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (processes.length === 0) {
      setFocusedProcessId(null)
      return
    }
    if (focusedProcessId == null || !processes.some((p) => p.id === focusedProcessId)) {
      setFocusedProcessId(processes[0]?.id ?? null)
    }
  }, [processes, focusedProcessId])

  useEffect(() => {
    if (processes.length === 0) return
    const anySelected = processes.some((p) => (value[p.id]?.length ?? 0) > 0)
    if (
      !legacySeedApplied.current &&
      !anySelected &&
      (legacyWorkerIds?.length ?? 0) > 0 &&
      processes.every((p) => (value[p.id]?.length ?? 0) === 0)
    ) {
      legacySeedApplied.current = true
      const seed = [...legacyWorkerIds!]
      const next: ProcessWorkerMap = { ...value }
      for (const p of processes) next[p.id] = [...seed]
      onChange(next)
      return
    }
    const missing = processes.some((p) => value[p.id] === undefined)
    if (!missing) return
    const next = { ...value }
    for (const p of processes) {
      if (next[p.id] === undefined) next[p.id] = []
    }
    onChange(next)
  }, [processes, value, onChange, legacyWorkerIds])

  const filteredWorkers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return workers
      .filter((w) => (!onlyActive ? true : w.status === 'ACTIVE'))
      .filter((w) => {
        if (!q) return true
        return `${w.workerCode} ${w.workerName}`.toLowerCase().includes(q)
      })
  }, [workers, onlyActive, query])

  const addWorkerToProcess = useCallback(
    (processId: number, workerId: number) => {
      const selected = value[processId] ?? []
      if (selected.includes(workerId)) return
      onChange({ ...value, [processId]: [...selected, workerId] })
    },
    [onChange, value],
  )

  const removeWorkerFromProcess = useCallback(
    (processId: number, workerId: number) => {
      const selected = value[processId] ?? []
      onChange({ ...value, [processId]: selected.filter((id) => id !== workerId) })
    },
    [onChange, value],
  )

  const parseWorkerIdFromDrag = (dt: DataTransfer): number | null => {
    const raw = dt.getData(WORKER_DRAG_MIME) || dt.getData('text/plain')
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  }

  const onWorkerDragStart = (e: React.DragEvent, workerId: number) => {
    e.dataTransfer.setData(WORKER_DRAG_MIME, String(workerId))
    e.dataTransfer.setData('text/plain', String(workerId))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const onProcessDragOver = (e: React.DragEvent, processId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropTargetId(processId)
  }

  const onProcessDrop = (e: React.DragEvent, processId: number) => {
    e.preventDefault()
    setDropTargetId(null)
    const workerId = parseWorkerIdFromDrag(e.dataTransfer)
    if (workerId != null) addWorkerToProcess(processId, workerId)
  }

  const toggleWorkerOnFocusedProcess = (workerId: number) => {
    const pid = focusedProcessId
    if (pid == null) return
    const selected = value[pid] ?? []
    if (selected.includes(workerId)) removeWorkerFromProcess(pid, workerId)
    else addWorkerToProcess(pid, workerId)
  }

  const isOps = variant === 'ops'
  const rootClass = embedded
    ? 'mesWoProcessAssign mesWoProcessAssign--embedded'
    : isOps
      ? 'mesOpsPlanModalWorker mesWoProcessAssign'
      : 'mesWoWorkerBlock mesWoWorkerBlockRich mesWoProcessAssign'
  const titleClass = isOps ? 'mesOpsPlanModalCardTitle' : 'mesWoWorkerTitle'
  const mutedClass = isOps ? 'mesOpsPlanModalMuted' : 'muted small'
  const inputClass = isOps ? 'mesOpsPlanModalInput' : 'mesInput'
  const checkClass = isOps ? 'mesOpsPlanModalCheck' : 'mesWoWorkerToggle'

  const totalUnique = uniqueWorkerCount(value)
  const meta = [metaExtra, `공정 ${processes.length}단계`, `배정 ${totalUnique}명(중복 제외)`].filter(Boolean).join(' · ')

  const qty = Math.max(1, Math.floor(Number(orderQty) || 1))

  const runAutoAssign = useCallback(
    async (processGroups: number[][]) => {
      if (productId == null || processes.length === 0) return
      setOptimizing(true)
      setOptimizeErr(null)
      try {
        const res = await apiJson<{
          ok: boolean
          message?: string
          estimatedMakespanLabel?: string
          estimatedMakespanSeconds?: number
          groupPreview?: string
          assignments?: Array<{
            processId: number
            workerId: number
            processCode: string
            processName: string
            workerCode: string
            workerName: string
            efficiencyPct: number | null
            dataSource: 'history' | 'standard'
          }>
        }>('/api/process-worker-assignments/optimize', {
          method: 'POST',
          body: JSON.stringify({
            productId,
            orderQty: qty,
            activeOnly: onlyActive,
            processGroups,
          }),
        })
        if (!res.ok || !res.assignments?.length) {
          setOptimizeErr(res.message ?? '자동 배정에 실패했습니다.')
          return
        }
        setGroupOptOpen(false)
        setAssignConfirm({
          groupPreview: res.groupPreview ?? '',
          makespanLabel: res.estimatedMakespanLabel ?? formatMakespanKo(res.estimatedMakespanSeconds ?? 0),
          assignments: res.assignments,
        })
      } catch (e) {
        let msg = e instanceof Error ? e.message : '자동 배정 중 오류'
        if (e instanceof ApiError && e.body && typeof e.body === 'object') {
          const b = e.body as { message?: string }
          if (typeof b.message === 'string') msg = b.message
        }
        setOptimizeErr(msg)
      } finally {
        setOptimizing(false)
      }
    },
    [productId, processes, qty, onlyActive],
  )

  const applyAssignConfirm = () => {
    if (!assignConfirm) return
    const next: ProcessWorkerMap = { ...value }
    for (const p of processes) {
      if (next[p.id] === undefined) next[p.id] = []
    }
    for (const a of assignConfirm.assignments) {
      next[a.processId] = [a.workerId]
    }
    onChange(next)
    setAssignConfirm(null)
  }

  return (
    <section className={rootClass}>
      {!embedded ? (
        <div className={isOps ? 'mesOpsPlanModalWorkerHead' : undefined}>
          <h3 className={titleClass} style={isOps ? undefined : { marginBottom: 6 }}>
            공정별 배정 작업자
          </h3>
          <p className={isOps ? 'mesOpsPlanModalWorkerMeta' : mutedClass} style={isOps ? undefined : { margin: '0 0 10px' }}>
            {meta}
          </p>
          <p className={`mesWoProcessAssignHint ${mutedClass}`}>
            오른쪽 작업자 카드를 왼쪽 공정으로 끌어다 놓으세요. 공정을 선택한 뒤 작업자를 클릭해도 배정·해제됩니다.
          </p>
        </div>
      ) : (
        <p className={isOps ? 'mesOpsPlanModalWorkerMeta' : mutedClass} style={{ margin: '0 0 10px' }}>
          {meta}
        </p>
      )}

      <div className={isOps ? 'mesOpsPlanModalWorkerTools' : 'mesWoWorkerTools'}>
        {isOps ? (
          <div className="mesOpsPlanModalWorkerSearch">
            <input
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="작업자 코드/이름 검색"
            />
          </div>
        ) : (
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="작업자 코드/이름 검색"
          />
        )}
        <label className={checkClass}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          <span>활성만</span>
        </label>
        <button
          type="button"
          className={isOps ? 'mesOpsPlanModalBtn mesOpsPlanModalBtn--cancel' : 'mesWoBtn mesWoBtn--secondary'}
          disabled={optimizing || loadingProc || productId == null || processes.length === 0}
          title="작업자 묶음을 정한 뒤 완성까지 걸리는 시간이 가장 짧은 배정을 제안합니다"
          onClick={() => {
            setOptimizeErr(null)
            setGroupOptOpen(true)
          }}
        >
          {optimizing ? '계산 중…' : '최단 완료 자동 배정'}
        </button>
      </div>

      {optimizeErr ? (
        <p className={mutedClass} role="alert">
          {optimizeErr}
        </p>
      ) : null}

      <ProcessWorkerGroupOptimizeModal
        open={groupOptOpen}
        variant={variant}
        processes={processes}
        orderQty={qty}
        saving={optimizing}
        onClose={() => !optimizing && setGroupOptOpen(false)}
        onSubmit={(groups) => void runAutoAssign(groups)}
      />

      <ProcessWorkerAssignConfirmModal
        open={assignConfirm != null}
        variant={variant}
        groupPreview={assignConfirm?.groupPreview ?? ''}
        orderQty={qty}
        makespanLabel={assignConfirm?.makespanLabel ?? '—'}
        assignments={assignConfirm?.assignments ?? []}
        applying={false}
        onCancel={() => setAssignConfirm(null)}
        onApply={applyAssignConfirm}
      />

      {loadingProc ? <p className={mutedClass}>MBOM 공정 불러오는 중…</p> : null}
      {procErr ? (
        <p className={mutedClass} role="alert">
          {procErr}
        </p>
      ) : null}
      {!loadingProc && productId != null && processes.length === 0 && !procErr ? (
        <p className={mutedClass}>이 품목에 등록된 MBOM 공정이 없습니다. 「MBOM 공정」에서 먼저 등록하세요.</p>
      ) : null}

      {processes.length > 0 ? (
        <div className="mesWoProcessAssignDnD">
          <div className="mesWoProcessAssignDnDCol mesWoProcessAssignDnDCol--processes">
            <div className="mesWoProcessAssignDnDColTitle">작업 공정</div>
            <ul className="mesWoProcessAssignDnDList" role="list">
              {processes.map((proc) => {
                const assignedIds = value[proc.id] ?? []
                const isFocused = focusedProcessId === proc.id
                const isDrop = dropTargetId === proc.id
                return (
                  <li key={proc.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`mesWoProcessCard${isFocused ? ' mesWoProcessCard--focus' : ''}${isDrop ? ' mesWoProcessCard--drop' : ''}`}
                      onClick={() => setFocusedProcessId(proc.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setFocusedProcessId(proc.id)
                        }
                      }}
                      onDragOver={(e) => onProcessDragOver(e, proc.id)}
                      onDragLeave={() => setDropTargetId((id) => (id === proc.id ? null : id))}
                      onDrop={(e) => onProcessDrop(e, proc.id)}
                    >
                      <div className="mesWoProcessCardHead">
                        <span className="mesWoProcessCardSeq mono">{proc.sequence}</span>
                        <div className="mesWoProcessCardTitle">
                          <span className="mono">{proc.processCode}</span> {proc.processName}
                        </div>
                        <span className={`mesWoProcessCardCount ${mutedClass}`}>{assignedIds.length}명</span>
                      </div>
                      <div className="mesWoProcessCardDrop">
                        {assignedIds.length === 0 ? (
                          <span className="mesWoProcessCardDropPlaceholder">작업자를 여기에 놓으세요</span>
                        ) : (
                          <ul className="mesWoProcessCardChips" role="list">
                            {assignedIds.map((wid) => {
                              const w = workerById.get(wid)
                              if (!w) return null
                              return (
                                <li key={wid}>
                                  <span className="mesWoProcessChip">
                                    <span className="mono">{w.workerCode}</span> {w.workerName}
                                    <button
                                      type="button"
                                      className="mesWoProcessChipRemove"
                                      aria-label={`${w.workerName} 배정 해제`}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        removeWorkerFromProcess(proc.id, wid)
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="mesWoProcessAssignDnDCol mesWoProcessAssignDnDCol--workers">
            <div className="mesWoProcessAssignDnDColTitle">등록 작업자</div>
            {filteredWorkers.length === 0 ? (
              <p className={mutedClass}>조건에 맞는 작업자가 없습니다.</p>
            ) : (
              <ul className="mesWoProcessAssignDnDList" role="list">
                {filteredWorkers.map((w) => {
                  const onFocused = focusedProcessId != null && (value[focusedProcessId] ?? []).includes(w.id)
                  return (
                    <li key={w.id}>
                      <div
                        className={`mesWoWorkerDragCard${onFocused ? ' mesWoWorkerDragCard--onFocus' : ''}`}
                        draggable
                        onDragStart={(e) => onWorkerDragStart(e, w.id)}
                        onClick={() => toggleWorkerOnFocusedProcess(w.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleWorkerOnFocusedProcess(w.id)
                          }
                        }}
                      >
                        <span className="mesWoWorkerDragCardGrip" aria-hidden>
                          ⋮⋮
                        </span>
                        <span className="mesWoWorkerDragCardBody">
                          <span className="mono mesWoWorkerDragCardCode">{w.workerCode}</span>
                          <span className="mesWoWorkerDragCardName">{w.workerName}</span>
                          {w.status !== 'ACTIVE' ? <span className={mutedClass}> ({w.status})</span> : null}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
