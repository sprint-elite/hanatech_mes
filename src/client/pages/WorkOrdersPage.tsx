import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import {
  formatAssignedWorkerNames,
  processWorkerAssignmentsPayload,
  buildProcessWorkerMap,
  type ProcessWorkerMap,
} from '../components/WorkOrderProcessWorkerAssign'
import { WorkOrderProcessWorkerModal } from '../components/WorkOrderProcessWorkerModal'
import '../work-orders-page.css'

type AssignedWorker = { worker: { id: number; workerCode: string; workerName: string } }

type Row = {
  id: number
  woNo: string
  planId: number | null
  productId: number
  orderQty: number
  completedQty: number
  status: string
  holdReason?: string | null
  priority: string | null
  remark: string | null
  workCenterId: number | null
  product?: { productCode: string; productName: string }
  plan?: { planNo: string } | null
  workCenter?: { centerCode: string; centerName: string } | null
  assignedWorkers?: AssignedWorker[]
  assignedProcessWorkers?: {
    processId: number
    workerId: number
    worker: { id: number; workerCode: string; workerName: string }
  }[]
}

type ProductRef = { id: number; productCode: string; productName: string }
type PlanRef = { id: number; planNo: string; product?: { productCode: string; productName: string } }
type WcRef = { id: number; centerCode: string; centerName: string }
type WorkerRef = { id: number; workerCode: string; workerName: string; status: string }

type Filters = { q: string; status: string; workCenterId: string }

const statuses = ['READY', 'IN_PROGRESS', 'DONE', 'HOLD'] as const

const emptyFilters = (): Filters => ({ q: '', status: '', workCenterId: '' })

const statusLabel = (s: string) => {
  if (s === 'READY') return '대기'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'HOLD') return '보류'
  return s
}

function statusBadgeClass(s: string): string {
  if (s === 'READY') return 'mesWoStatusBadge mesWoStatusBadge--ready'
  if (s === 'IN_PROGRESS') return 'mesWoStatusBadge mesWoStatusBadge--progress'
  if (s === 'DONE') return 'mesWoStatusBadge mesWoStatusBadge--done'
  if (s === 'HOLD') return 'mesWoStatusBadge mesWoStatusBadge--hold'
  return 'mesWoStatusBadge'
}

function matchesFilters(row: Row, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const hay = [
      row.woNo,
      row.product?.productCode ?? '',
      row.product?.productName ?? '',
      row.plan?.planNo ?? '',
      String(row.productId),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filters.status && row.status !== filters.status) return false
  if (filters.workCenterId && String(row.workCenterId ?? '') !== filters.workCenterId) return false
  return true
}


function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 3v6h6" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4V8Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  )
}

export function WorkOrdersPage() {
  const [items, setItems] = useState<Row[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [plans, setPlans] = useState<PlanRef[]>([])
  const [workCenters, setWorkCenters] = useState<WcRef[]>([])
  const [workers, setWorkers] = useState<WorkerRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [woNo, setWoNo] = useState('')
  const [planId, setPlanId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderQty, setOrderQty] = useState('1')
  const [workCenterId, setWorkCenterId] = useState('')
  const [status, setStatus] = useState<(typeof statuses)[number]>('READY')
  const [holdReason, setHoldReason] = useState('')
  const [priority, setPriority] = useState('')
  const [remark, setRemark] = useState('')
  const [processWorkerMap, setProcessWorkerMap] = useState<ProcessWorkerMap>({})
  const [legacyWorkerSeed, setLegacyWorkerSeed] = useState<number[]>([])
  const [workerAssignOpen, setWorkerAssignOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadRefs = useCallback(async () => {
    try {
      const [p, pl, wc, wk] = await Promise.all([
        apiJson<{ ok: boolean; items: ProductRef[] }>('/api/products'),
        apiJson<{ ok: boolean; items: PlanRef[] }>('/api/production-plans'),
        apiJson<{ ok: boolean; items: WcRef[] }>('/api/work-centers'),
        apiJson<{ ok: boolean; items: WorkerRef[] }>('/api/workers'),
      ])
      setProducts([...p.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko')))
      setPlans([...pl.items].sort((a, b) => b.id - a.id))
      setWorkCenters([...wc.items].sort((a, b) => a.centerCode.localeCompare(b.centerCode, 'ko')))
      setWorkers([...wk.items].sort((a, b) => a.workerCode.localeCompare(b.workerCode, 'ko')))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/work-orders')
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRefs()
  }, [loadRefs])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(
    () => items.filter((row) => matchesFilters(row, filters)),
    [items, filters],
  )

  const stats = useMemo(() => {
    let ready = 0
    let inProgress = 0
    let done = 0
    let hold = 0
    let totalQty = 0
    for (const row of filteredItems) {
      if (row.status === 'READY') ready += 1
      else if (row.status === 'IN_PROGRESS') inProgress += 1
      else if (row.status === 'DONE') done += 1
      else if (row.status === 'HOLD') hold += 1
      totalQty += row.orderQty
    }
    return { total: filteredItems.length, ready, inProgress, done, hold, totalQty }
  }, [filteredItems])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const empty = emptyFilters()
    setDraftFilters(empty)
    setFilters(empty)
    setPage(1)
  }

  const resetForm = () => {
    setWoNo('')
    setPlanId('')
    setProductId('')
    setOrderQty('1')
    setWorkCenterId('')
    setPriority('')
    setRemark('')
    setHoldReason('')
    setStatus('READY')
    setProcessWorkerMap({})
    setLegacyWorkerSeed([])
  }

  const closePanel = () => {
    setEditingId(null)
    resetForm()
    setWorkerAssignOpen(false)
    setPanelOpen(false)
  }

  const openNew = () => {
    setEditingId(null)
    resetForm()
    setPanelOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setWoNo(r.woNo)
    setPlanId(r.planId != null ? String(r.planId) : '')
    setProductId(String(r.productId))
    setOrderQty(String(r.orderQty))
    setWorkCenterId(r.workCenterId != null ? String(r.workCenterId) : '')
    setStatus(r.status as (typeof statuses)[number])
    setHoldReason(r.holdReason ?? '')
    setPriority(r.priority ?? '')
    setRemark(r.remark ?? '')
    const hasProcessAssign = (r.assignedProcessWorkers?.length ?? 0) > 0
    setLegacyWorkerSeed(hasProcessAssign ? [] : (r.assignedWorkers ?? []).map((a) => a.worker.id))
    setProcessWorkerMap(
      hasProcessAssign
        ? buildProcessWorkerMap(
            [...new Set((r.assignedProcessWorkers ?? []).map((a) => a.processId))],
            r.assignedProcessWorkers,
          )
        : {},
    )
    setPanelOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const pid = Number(productId)
      const oq = Number(orderQty)
      if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(oq)) {
        setErr('품목과 지시수량을 확인하세요.')
        setSaving(false)
        return
      }
      const pl = planId.trim() === '' ? null : Number(planId)
      if (planId.trim() !== '' && (!Number.isFinite(pl) || (pl as number) < 1)) {
        setErr('생산 계획을 올바르게 선택하세요.')
        setSaving(false)
        return
      }
      const wc = workCenterId.trim() === '' ? null : Number(workCenterId)
      if (workCenterId.trim() !== '' && (!Number.isFinite(wc) || (wc as number) < 1)) {
        setErr('작업장을 올바르게 선택하세요.')
        setSaving(false)
        return
      }
      if (status === 'HOLD' && holdReason.trim() === '') {
        setErr('보류 상태일 때 보류 사유를 입력하세요.')
        setSaving(false)
        return
      }
      const body = {
        woNo: woNo.trim(),
        planId: pl ?? undefined,
        productId: pid,
        orderQty: oq,
        workCenterId: wc ?? undefined,
        status,
        holdReason: status === 'HOLD' ? holdReason.trim() : null,
        priority: priority.trim() || null,
        remark: remark.trim() || null,
        processWorkerAssignments: processWorkerAssignmentsPayload(processWorkerMap),
      }
      if (editingId == null) {
        await apiJson('/api/work-orders', { method: 'POST', body: JSON.stringify(body) })
      } else {
        const { woNo: _w, ...patch } = body
        await apiJson(`/api/work-orders/${editingId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      }
      await load()
      closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요? (연결 LOT이 있으면 실패할 수 있습니다)')) return
    try {
      await apiJson(`/api/work-orders/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const planOptionLabel = (pl: PlanRef) => {
    const prod = pl.product
    const prodTxt = prod ? `${prod.productCode} · ${prod.productName}` : ''
    return prodTxt ? `${pl.planNo} — ${prodTxt}` : pl.planNo
  }

  const workerNamesShort = (r: Row) => {
    const list = r.assignedWorkers ?? []
    if (list.length === 0) return '—'
    return list.map((a) => a.worker.workerName).join(', ')
  }

  const modalTitle = editingId == null ? '작업 지시 등록' : `작업 지시 수정 (ID ${editingId})`

  const assignedWorkerNames = useMemo(
    () => formatAssignedWorkerNames(processWorkerMap, workers),
    [processWorkerMap, workers],
  )

  const canOpenWorkerAssign = productId.trim() !== '' && Number(productId) > 0

  return (
    <div className="mesPage mesPageWide mesWoPage">
      <header className="mesWoHead">
        <div className="mesWoHeadMain">
          <h1 className="mesWoTitle">작업 지시</h1>
          <p className="mesWoDesc">
            생산 계획·품목·수량·작업장·공정별 배정 작업자를 등록합니다. 상단 숫자는 필터 적용 후 목록 기준입니다.
          </p>
        </div>
        <div className="mesWoHeadActions">
          <span className="mesWoCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesWoBtn mesWoBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesWoBtn mesWoBtn--primary" onClick={openNew}>
            <IconPlus />
            새 지시
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesWoNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesWoFilterCard">
        <div className="mesWoField mesWoField--search">
          <span className="mesWoFieldLabel">검색</span>
          <div className="mesWoInputWrap">
            <span className="mesWoInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesWoInput mesWoInput--search"
              placeholder="지시번호 / 품목 / 계획번호 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesWoField mesWoField--select">
          <span className="mesWoFieldLabel">상태</span>
          <select
            className="mesWoSelect"
            value={draftFilters.status}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, status: ev.target.value }))}
            aria-label="상태 필터"
          >
            <option value="">상태(전체)</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="mesWoField mesWoField--select">
          <span className="mesWoFieldLabel">작업장</span>
          <select
            className="mesWoSelect"
            value={draftFilters.workCenterId}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, workCenterId: ev.target.value }))}
            aria-label="작업장 필터"
          >
            <option value="">작업장(전체)</option>
            {workCenters.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.centerCode} · {w.centerName}
              </option>
            ))}
          </select>
        </div>
        <div className="mesWoFilterActions">
          <button type="button" className="mesWoBtn mesWoBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesWoBtn mesWoBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesWoStatsStrip" aria-label="작업 지시 요약">
        <div className="mesWoStatItem">
          <div className="mesWoStatIcon mesWoStatIcon--blue">
            <IconClipboard />
          </div>
          <div className="mesWoStatMeta">
            <p className="mesWoStatLabel">전체 지시</p>
            <p className="mesWoStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesWoStatValueNum">{stats.total}</span>
                  <span className="mesWoStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesWoStatItem">
          <div className="mesWoStatIcon mesWoStatIcon--blue">
            <IconClock />
          </div>
          <div className="mesWoStatMeta">
            <p className="mesWoStatLabel">대기</p>
            <p className="mesWoStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesWoStatValueNum">{stats.ready}</span>
                  <span className="mesWoStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesWoStatItem">
          <div className="mesWoStatIcon mesWoStatIcon--purple">
            <IconPlay />
          </div>
          <div className="mesWoStatMeta">
            <p className="mesWoStatLabel">진행</p>
            <p className="mesWoStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesWoStatValueNum">{stats.inProgress}</span>
                  <span className="mesWoStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesWoStatItem">
          <div className="mesWoStatIcon mesWoStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesWoStatMeta">
            <p className="mesWoStatLabel">완료</p>
            <p className="mesWoStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesWoStatValueNum">{stats.done}</span>
                  <span className="mesWoStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesWoStatItem">
          <div className="mesWoStatIcon mesWoStatIcon--orange">
            <IconPause />
          </div>
          <div className="mesWoStatMeta">
            <p className="mesWoStatLabel">보류</p>
            <p className="mesWoStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesWoStatValueNum">{stats.hold}</span>
                  <span className="mesWoStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-wo-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-wo-modal-title">
                  {modalTitle}
                </h2>
              </div>
              <div className="mesModalHeadActions">
                <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closePanel}>
                  취소
                </button>
                <button type="button" className="mesBtnGhost" onClick={closePanel}>
                  닫기
                </button>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  지시번호
                  <input className="mesInput mono" value={woNo} disabled={editingId != null} onChange={(ev) => setWoNo(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  생산 계획 (선택)
                  <select className="mesInput" value={planId} onChange={(ev) => setPlanId(ev.target.value)}>
                    <option value="">없음</option>
                    {plans.map((pl) => (
                      <option key={pl.id} value={String(pl.id)}>
                        {planOptionLabel(pl)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  품목
                  <select className="mesInput" value={productId} onChange={(ev) => setProductId(ev.target.value)}>
                    <option value="">선택</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.productCode} · {p.productName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  지시수량
                  <input className="mesInput" value={orderQty} onChange={(ev) => setOrderQty(ev.target.value)} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  작업장 (선택)
                  <select className="mesInput" value={workCenterId} onChange={(ev) => setWorkCenterId(ev.target.value)}>
                    <option value="">없음</option>
                    {workCenters.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.centerCode} · {w.centerName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={status}
                    onChange={(ev) => {
                      const next = ev.target.value as (typeof statuses)[number]
                      setStatus(next)
                      if (next !== 'HOLD') setHoldReason('')
                    }}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                {status === 'HOLD' ? (
                  <label className="mesLabel" style={{ gridColumn: '1 / -1' }}>
                    보류 사유
                    <textarea
                      className="mesInput"
                      rows={3}
                      value={holdReason}
                      placeholder="예) 원재료 입고 지연으로 인한 생산 대기"
                      onChange={(ev) => setHoldReason(ev.target.value)}
                    />
                  </label>
                ) : null}
                <label className="mesLabel">
                  우선순위
                  <input className="mesInput" value={priority} onChange={(ev) => setPriority(ev.target.value)} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel" style={{ flex: 1 }}>
                  비고
                  <input className="mesInput" value={remark} onChange={(ev) => setRemark(ev.target.value)} />
                </label>
              </div>
              <div className="mesWoAssignBlock">
                <div className="mesWoAssignBlockRow">
                  <span className="mesWoFieldLabel">배정 작업자</span>
                  <p className="mesWoAssignNames" title={assignedWorkerNames}>
                    {assignedWorkerNames}
                  </p>
                </div>
                <button
                  type="button"
                  className="mesWoBtn mesWoBtn--secondary mesWoAssignOpenBtn"
                  disabled={!canOpenWorkerAssign}
                  onClick={() => setWorkerAssignOpen(true)}
                >
                  공정별 작업 배정
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {panelOpen && workerAssignOpen ? (
        <WorkOrderProcessWorkerModal
          open
          onClose={() => setWorkerAssignOpen(false)}
          variant="wo"
          productId={productId.trim() === '' ? null : Number(productId)}
          workers={workers}
          value={processWorkerMap}
          onChange={setProcessWorkerMap}
          legacyWorkerIds={legacyWorkerSeed}
          orderQty={Math.max(1, Number(orderQty) || 1)}
        />
      ) : null}

      <div className="mesWoTableCard">
        <div className="mesWoTableViewport">
          <table className="mesWoTable">
            <thead>
              <tr>
                <th>지시번호</th>
                <th>품목</th>
                <th>계획</th>
                <th>작업자</th>
                <th>지시/완료</th>
                <th>작업장</th>
                <th>상태</th>
                <th className="mesWoThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="mesWoEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="mesWoEmpty">
                    {items.length === 0 ? (
                      <>
                        데이터가 없습니다. <strong>새 지시</strong>로 추가하세요.
                      </>
                    ) : (
                      '필터 조건에 맞는 지시가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.woNo}</td>
                    <td>{r.product ? `${r.product.productCode} ${r.product.productName}` : r.productId}</td>
                    <td>{r.plan?.planNo ?? '—'}</td>
                    <td className="mesTdEllipsis" title={workerNamesShort(r)}>
                      {workerNamesShort(r)}
                    </td>
                    <td>
                      {r.orderQty.toLocaleString('ko-KR')} / {r.completedQty.toLocaleString('ko-KR')}
                    </td>
                    <td>{r.workCenter ? r.workCenter.centerCode : '—'}</td>
                    <td>
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="mesWoTdActions">
                      <button type="button" className="mesWoBtn mesWoBtn--edit" onClick={() => openEdit(r)}>
                        <IconEdit />
                        수정
                      </button>
                      <button type="button" className="mesWoBtn mesWoBtn--danger" onClick={() => void remove(r.id)}>
                        <IconTrash />
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesWoPager">
          <span className="mesWoPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesWoPagerNav" aria-label="페이지">
            <button type="button" className="mesWoPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesWoPagerBtn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1]
                const showEllipsis = prev != null && n - prev > 1
                return (
                  <span key={n} style={{ display: 'contents' }}>
                    {showEllipsis ? (
                      <span className="mesWoPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesWoPagerBtn${n === page ? ' mesWoPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesWoPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesWoPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesWoPageSize">
            <select
              value={pageSize}
              onChange={(ev) => {
                setPageSize(Number(ev.target.value))
                setPage(1)
              }}
              aria-label="페이지당 표시 건수"
            >
              <option value={10}>10개씩 보기</option>
              <option value={20}>20개씩 보기</option>
              <option value={50}>50개씩 보기</option>
            </select>
          </div>
        </footer>
      </div>
    </div>
  )
}
