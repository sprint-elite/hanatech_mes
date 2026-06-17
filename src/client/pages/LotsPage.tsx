import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'

type Product = { id: number; productCode: string; productName: string }

type WorkOrderRef = {
  id: number
  woNo: string
  planId: number | null
  productId: number
  orderQty: number
  product?: { productCode: string; productName: string }
  plan?: { planNo: string } | null
  assignedWorkers?: { worker: { workerCode: string; workerName: string } }[]
}

type LotStatus = 'CREATED' | 'IN_PROGRESS' | 'DONE' | 'OUTSOURCING'

type Row = {
  id: number
  lotNo: string
  woId: number | null
  productId: number
  lotQty: number
  goodQty: number
  defectQty: number
  status: LotStatus
  createdAt: string
  product: { productCode: string; productName: string }
  workOrder: {
    id: number
    woNo: string
    orderQty: number
    plan: { id: number; planNo: string } | null
    product: { productCode: string; productName: string }
    assignedWorkers?: { worker: { workerCode: string; workerName: string } }[]
  } | null
}

type FormState = {
  woId: string
  lotNo: string
  productId: string
  lotQty: string
  status: LotStatus
}

const statuses: LotStatus[] = ['CREATED', 'IN_PROGRESS', 'DONE', 'OUTSOURCING']

const empty = (): FormState => ({
  woId: '',
  lotNo: '',
  productId: '',
  lotQty: '',
  status: 'CREATED',
})

function workersLabel(wo: WorkOrderRef | Row['workOrder'] | null | undefined): string {
  if (wo == null) return '—'
  const list = wo.assignedWorkers
  if (!list?.length) return '배정 없음'
  return list.map((a) => a.worker.workerName || a.worker.workerCode).join(', ')
}

function woOptionLabel(wo: WorkOrderRef) {
  const pc = wo.product?.productCode ?? ''
  const pn = wo.product?.productName ?? ''
  const prod = pc && pn ? `${pc} · ${pn}` : `품목#${wo.productId}`
  const plan = wo.plan?.planNo ? ` · 계획 ${wo.plan.planNo}` : ''
  return `${wo.woNo} — ${prod} (${wo.orderQty})${plan}`
}

export function LotsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRef[]>([])
  const [items, setItems] = useState<Row[]>([])
  const [filterProductId, setFilterProductId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setEditingId(null)
    setForm(empty())
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  const loadRefs = useCallback(async () => {
    const [p, wo] = await Promise.all([
      apiJson<{ items: Product[] }>('/api/products'),
      apiJson<{ ok: boolean; items: WorkOrderRef[] }>('/api/work-orders'),
    ])
    setProducts(p.items)
    setWorkOrders([...wo.items].sort((a, b) => b.id - a.id))
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const q = filterProductId === '' ? '' : `?productId=${encodeURIComponent(filterProductId)}`
      const data = await apiJson<{ ok: boolean; items: Row[] }>(`/api/lots${q}`)
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filterProductId])

  useEffect(() => {
    void loadRefs().catch((e) => setErr(e instanceof Error ? e.message : 'unknown error'))
  }, [loadRefs])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const applyWorkOrderSelection = (woIdStr: string) => {
    if (!woIdStr) {
      setForm((f) => ({ ...f, woId: '' }))
      return
    }
    const wo = workOrders.find((x) => x.id === Number(woIdStr))
    if (!wo) {
      setForm((f) => ({ ...f, woId: woIdStr }))
      return
    }
    setForm((f) => ({
      ...f,
      woId: woIdStr,
      productId: String(wo.productId),
      lotQty: String(wo.orderQty),
    }))
  }

  const save = async () => {
    const pid = Number(form.productId)
    const qty = Number(form.lotQty)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setErr('LOT 수량은 1 이상 정수여야 합니다.')
      return
    }
    const woIdParsed =
      form.woId.trim() === '' ? undefined : Number(form.woId)
    if (form.woId.trim() !== '' && (!Number.isInteger(woIdParsed) || (woIdParsed as number) < 1)) {
      setErr('작업 지시 선택이 올바르지 않습니다.')
      return
    }

    setSaving(true)
    setErr(null)
    try {
      if (editingId == null) {
        const body: Record<string, unknown> = {
          lotNo: form.lotNo.trim(),
          productId: pid,
          lotQty: qty,
          status: form.status,
        }
        if (woIdParsed != null) body.woId = woIdParsed
        await apiJson('/api/lots', { method: 'POST', body: JSON.stringify(body) })
      } else {
        const body: Record<string, unknown> = {
          lotQty: qty,
          status: form.status,
          woId: form.woId.trim() === '' ? null : woIdParsed,
        }
        if (form.lotNo.trim() !== '') body.lotNo = form.lotNo.trim()
        await apiJson(`/api/lots/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await loadRows()
      closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('LOT를 삭제할까요? 연결된 재고·실적이 있으면 실패합니다.')) return
    try {
      await apiJson(`/api/lots/${id}`, { method: 'DELETE' })
      await loadRows()
      if (editingId === id) closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const productLocked = editingId != null || form.woId.trim() !== ''

  const parsedWoIdForHint =
    form.woId.trim() === '' ? null : Number(form.woId)
  const woForWorkerHint =
    parsedWoIdForHint == null || !Number.isInteger(parsedWoIdForHint) || parsedWoIdForHint < 1
      ? null
      : workOrders.find((x) => x.id === parsedWoIdForHint) ??
        (editingId != null ? items.find((r) => r.id === editingId)?.workOrder ?? null : null)

  const workerHintValue =
    form.woId.trim() === ''
      ? '작업 지시를 선택하면 표시됩니다.'
      : woForWorkerHint == null
        ? '지시 정보를 불러올 수 없습니다.'
        : workersLabel(woForWorkerHint)

  const modalTitle = editingId == null ? '신규 등록' : '수정'

  const openNew = () => {
    setEditingId(null)
    setForm({
      ...empty(),
      productId: filterProductId || '',
    })
    setPanelOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditingId(row.id)
    setForm({
      woId: row.woId != null ? String(row.woId) : '',
      lotNo: row.lotNo,
      productId: String(row.productId),
      lotQty: String(row.lotQty),
      status: row.status,
    })
    setPanelOpen(true)
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">생산 LOT</h1>
        <p className="mesPageDesc">
          작업지시·생산계획과 연결해 LOT를 생성합니다. 작업장·배정 작업자는 작업지시에서 확인합니다. (지시 미선택 시 품목만으로도 생성 가능)
        </p>
      </header>

      <div className="mesToolbar mesToolbarWrap">
        <label className="mesLabel mesLabelInline">
          품목 필터
          <select
            className="mesInput mesInputShort"
            value={filterProductId}
            onChange={(ev) => setFilterProductId(ev.target.value)}
          >
            <option value="">전체</option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.productCode}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mesBtnPrimary" onClick={openNew}>
          새 LOT
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable mesTableClick">
          <thead>
            <tr>
              <th>LOT No</th>
              <th>품목</th>
              <th>작업지시</th>
              <th>생산계획</th>
              <th>LOT 수량</th>
              <th>양품</th>
              <th>불량</th>
              <th>상태</th>
              <th>작업자 (지시)</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  className={editingId === row.id && panelOpen ? 'mesRowSelected' : undefined}
                  onClick={() => openEdit(row)}
                >
                  <td className="mono">{row.lotNo}</td>
                  <td>
                    <span className="mono">{row.product.productCode}</span>
                    <div className="muted small">{row.product.productName}</div>
                  </td>
                  <td className="mono">{row.workOrder?.woNo ?? '—'}</td>
                  <td className="mono">{row.workOrder?.plan?.planNo ?? '—'}</td>
                  <td>{row.lotQty}</td>
                  <td>{row.goodQty}</td>
                  <td>{row.defectQty}</td>
                  <td>{row.status}</td>
                  <td className="mesTdEllipsis" title={workersLabel(row.workOrder)}>
                    {workersLabel(row.workOrder)}
                  </td>
                  <td className="mesTdActions">
                    <button
                      type="button"
                      className="mesBtnSm"
                      onClick={(ev: MouseEvent) => {
                        ev.stopPropagation()
                        openEdit(row)
                      }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="mesBtnSm mesBtnDanger"
                      onClick={(ev: MouseEvent) => {
                        ev.stopPropagation()
                        void remove(row.id)
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div
            className="mesModalDialog mesModalDialogWide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mes-lot-modal-title"
          >
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-lot-modal-title">
                  {modalTitle}
                </h2>
                {editingId != null ? <div className="mesModalMeta muted">ID {editingId}</div> : null}
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  작업 지시 (선택)
                  <select
                    className="mesInput"
                    disabled={editingId != null}
                    value={form.woId}
                    onChange={(ev) => applyWorkOrderSelection(ev.target.value)}
                  >
                    <option value="">없음 (품목 직접 선택)</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={String(wo.id)}>
                        {woOptionLabel(wo)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  LOT 번호
                  <input
                    className="mesInput"
                    disabled={editingId != null}
                    placeholder={editingId == null ? '고유 LOT No' : '수정 시 비우면 유지'}
                    value={form.lotNo}
                    onChange={(ev) => setForm((f) => ({ ...f, lotNo: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  품목
                  <select
                    className="mesInput"
                    disabled={productLocked}
                    value={form.productId}
                    onChange={(ev) => setForm((f) => ({ ...f, productId: ev.target.value }))}
                  >
                    <option value="">선택</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.productCode} — {p.productName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  LOT 수량
                  <input
                    className="mesInput"
                    value={form.lotQty}
                    onChange={(ev) => setForm((f) => ({ ...f, lotQty: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={form.status}
                    onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value as LotStatus }))}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  배정 작업자 (작업지시 기준)
                  <input className="mesInput muted" readOnly value={workerHintValue} />
                </label>
              </div>
              {editingId != null ? (
                <p className="muted small" style={{ marginTop: 8 }}>
                  수정 시 작업 지시는 변경할 수 없습니다. LOT 수량은 연결된 지시 수량 이하여야 합니다.
                </p>
              ) : null}
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closePanel}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
