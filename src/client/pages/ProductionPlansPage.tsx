import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type Row = {
  id: number
  planNo: string
  productId: number
  planQty: number
  startDate: string
  endDate: string
  priority: string | null
  status: string
  remark: string | null
  product?: { productCode: string; productName: string }
}

type ProductRef = { id: number; productCode: string; productName: string }

const statuses = ['PLANNED', 'CONFIRMED', 'CLOSED'] as const

const statusLabel = (s: string) => {
  if (s === 'PLANNED') return '계획'
  if (s === 'CONFIRMED') return '확정'
  if (s === 'CLOSED') return '마감'
  return s
}

export function ProductionPlansPage() {
  const [items, setItems] = useState<Row[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [planNo, setPlanNo] = useState('')
  const [productId, setProductId] = useState('')
  const [planQty, setPlanQty] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState<(typeof statuses)[number]>('PLANNED')
  const [remark, setRemark] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadRefs = useCallback(async () => {
    try {
      const data = await apiJson<{ ok: boolean; items: ProductRef[] }>('/api/products')
      setProducts([...data.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko')))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/production-plans')
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
    setPlanNo('')
    setProductId('')
    setPlanQty('1')
    setStartDate('')
    setEndDate('')
    setPriority('')
    setRemark('')
    setStatus('PLANNED')
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
    setPlanNo(r.planNo)
    setProductId(String(r.productId))
    setPlanQty(String(r.planQty))
    setStartDate(String(r.startDate).slice(0, 10))
    setEndDate(String(r.endDate).slice(0, 10))
    setPriority(r.priority ?? '')
    setRemark(r.remark ?? '')
    setStatus(r.status as (typeof statuses)[number])
    setPanelOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const pid = Number(productId)
      const pq = Number(planQty)
      if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(pq)) {
        setErr('품목과 계획수량을 확인하세요.')
        setSaving(false)
        return
      }
      if (!startDate || !endDate) {
        setErr('시작·종료일을 입력하세요.')
        setSaving(false)
        return
      }
      const body = {
        planNo: planNo.trim(),
        productId: pid,
        planQty: pq,
        startDate,
        endDate,
        priority: priority.trim() || null,
        status,
        remark: remark.trim() || null,
      }
      if (editingId == null) {
        await apiJson('/api/production-plans', { method: 'POST', body: JSON.stringify(body) })
      } else {
        const { planNo: _pn, ...patch } = body
        await apiJson(`/api/production-plans/${editingId}`, { method: 'PATCH', body: JSON.stringify(patch) })
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
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/production-plans/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const modalTitle = editingId == null ? '생산 계획 등록' : `생산 계획 수정 (ID ${editingId})`

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">생산 계획</h1>
        <p className="mesPageDesc">계획 번호·기간·수량을 등록합니다. (확정·마감 등 상태 변경은 이후 트랜잭션과 연동 가능)</p>
      </header>
      <div className="mesToolbar">
        <button type="button" className="mesBtnPrimary" onClick={openNew}>
          새 계획
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-plan-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-plan-modal-title">
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
                  계획번호
                  <input className="mesInput mono" value={planNo} disabled={editingId != null} onChange={(ev) => setPlanNo(ev.target.value)} />
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
                  계획수량
                  <input className="mesInput" value={planQty} onChange={(ev) => setPlanQty(ev.target.value)} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  시작일
                  <input className="mesInput" type="date" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  종료일
                  <input className="mesInput" type="date" value={endDate} onChange={(ev) => setEndDate(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  우선순위
                  <input className="mesInput" value={priority} onChange={(ev) => setPriority(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  상태
                  <select className="mesInput" value={status} onChange={(ev) => setStatus(ev.target.value as (typeof statuses)[number])}>
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel" style={{ flex: 1 }}>
                  비고
                  <input className="mesInput" value={remark} onChange={(ev) => setRemark(ev.target.value)} />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>계획번호</th>
              <th>품목</th>
              <th>수량</th>
              <th>기간</th>
              <th>상태</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.planNo}</td>
                  <td>{r.product ? `${r.product.productCode} ${r.product.productName}` : r.productId}</td>
                  <td>{r.planQty}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {String(r.startDate).slice(0, 10)} ~ {String(r.endDate).slice(0, 10)}
                  </td>
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
