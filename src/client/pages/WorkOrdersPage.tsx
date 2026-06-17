import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'

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
}

type ProductRef = { id: number; productCode: string; productName: string }
type PlanRef = { id: number; planNo: string; product?: { productCode: string; productName: string } }
type WcRef = { id: number; centerCode: string; centerName: string }
type WorkerRef = { id: number; workerCode: string; workerName: string; status: string }

const statuses = ['READY', 'IN_PROGRESS', 'DONE', 'HOLD'] as const

const statusLabel = (s: string) => {
  if (s === 'READY') return '대기'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'HOLD') return '보류'
  return s
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

export function WorkOrdersPage() {
  const [items, setItems] = useState<Row[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [plans, setPlans] = useState<PlanRef[]>([])
  const [workCenters, setWorkCenters] = useState<WcRef[]>([])
  const [workers, setWorkers] = useState<WorkerRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [woNo, setWoNo] = useState('')
  const [planId, setPlanId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderQty, setOrderQty] = useState('1')
  const [workCenterId, setWorkCenterId] = useState('')
  const [status, setStatus] = useState<(typeof statuses)[number]>('READY')
  const [holdReason, setHoldReason] = useState('')
  const [priority, setPriority] = useState('')
  const [remark, setRemark] = useState('')
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterSearch, setFilterSearch] = useState('')

  const statusCounts = useMemo(() => {
    const c = { READY: 0, IN_PROGRESS: 0, DONE: 0, HOLD: 0 as number }
    for (const r of items) {
      if (r.status === 'READY') c.READY += 1
      else if (r.status === 'IN_PROGRESS') c.IN_PROGRESS += 1
      else if (r.status === 'DONE') c.DONE += 1
      else if (r.status === 'HOLD') c.HOLD += 1
    }
    return c
  }, [items])

  const filteredItems = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    return items.filter((r) => {
      if (filterStatus !== '' && r.status !== filterStatus) return false
      if (!q) return true
      const wo = r.woNo.toLowerCase()
      const pn = r.product?.productName?.toLowerCase() ?? ''
      const pc = r.product?.productCode?.toLowerCase() ?? ''
      const plan = r.plan?.planNo?.toLowerCase() ?? ''
      return wo.includes(q) || pn.includes(q) || pc.includes(q) || plan.includes(q)
    })
  }, [items, filterStatus, filterSearch])

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
    setSelectedWorkerIds([])
  }

  const closePanel = () => {
    setEditingId(null)
    resetForm()
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
    setSelectedWorkerIds((r.assignedWorkers ?? []).map((a) => a.worker.id))
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
        workerIds: selectedWorkerIds,
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

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">작업 지시</h1>
        <p className="mesPageDesc">
          생산 계획·품목·수량·작업장·<strong>배정 작업자(복수)</strong>를 등록합니다. 상단 숫자는 현재 불러온 목록 기준입니다.
        </p>
      </header>

      <div className="mesWoStats">
        <div className="mesWoStatCard">
          <div className="mesWoStatLabel">대기</div>
          <div className="mesWoStatVal">{statusCounts.READY}</div>
        </div>
        <div className="mesWoStatCard">
          <div className="mesWoStatLabel">진행</div>
          <div className="mesWoStatVal">{statusCounts.IN_PROGRESS}</div>
        </div>
        <div className="mesWoStatCard">
          <div className="mesWoStatLabel">완료</div>
          <div className="mesWoStatVal">{statusCounts.DONE}</div>
        </div>
        <div className="mesWoStatCard">
          <div className="mesWoStatLabel">보류</div>
          <div className="mesWoStatVal">{statusCounts.HOLD}</div>
        </div>
      </div>

      <div className="mesToolbar mesToolbarWrap">
        <label className="mesLabel mesLabelInline">
          상태
          <select className="mesInput mesInputShort" value={filterStatus} onChange={(ev) => setFilterStatus(ev.target.value)}>
            <option value="">전체</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="mesLabel mesLabelInline" style={{ flex: 1, minWidth: 200 }}>
          검색 (지시번호·품목·계획번호)
          <input
            className="mesInput"
            value={filterSearch}
            placeholder="입력 시 목록만 필터"
            onChange={(ev) => setFilterSearch(ev.target.value)}
          />
        </label>
        <button type="button" className="mesBtnPrimary" onClick={openNew}>
          새 지시
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

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
              <div className="mesWoWorkerBlock">
                <div className="mesWoWorkerTitle">배정 작업자 (복수 선택)</div>
                <div className="mesWoWorkerGrid">
                  {workers.map((w) => (
                    <label key={w.id} className="mesWoWorkerItem">
                      <input
                        type="checkbox"
                        checked={selectedWorkerIds.includes(w.id)}
                        onChange={() => setSelectedWorkerIds((ids) => toggleId(ids, w.id))}
                      />
                      <span>
                        <span className="mono">{w.workerCode}</span> {w.workerName}
                        {w.status !== 'ACTIVE' ? <span className="muted small"> ({w.status})</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="muted small" style={{ marginTop: 8 }}>
                  선택 {selectedWorkerIds.length}명 · 저장 시 서버에 반영됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>지시번호</th>
              <th>품목</th>
              <th>계획</th>
              <th>작업자</th>
              <th>지시/완료</th>
              <th>작업장</th>
              <th>상태</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  필터 조건에 맞는 지시가 없습니다.
                </td>
              </tr>
            ) : (
              filteredItems.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.woNo}</td>
                  <td>{r.product ? `${r.product.productCode} ${r.product.productName}` : r.productId}</td>
                  <td>{r.plan?.planNo ?? '—'}</td>
                  <td className="mesTdEllipsis" title={workerNamesShort(r)}>
                    {workerNamesShort(r)}
                  </td>
                  <td>
                    {r.orderQty} / {r.completedQty}
                  </td>
                  <td>{r.workCenter ? r.workCenter.centerCode : '—'}</td>
                  <td>{statusLabel(r.status)}</td>
                  <td className="mesTdActions">
                    <button type="button" className="mesBtnSm" onClick={() => openEdit(r)}>
                      수정
                    </button>
                    <button type="button" className="mesBtnSm mesBtnDanger" onClick={() => void remove(r.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
