import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson } from '../lib/api'

type Row = {
  id: number
  lotNo: string
  productId: number
  supplier: string | null
  receivedQty: string
  remainQty: string
  receivedDate: string
  status: string
  product?: { productCode: string; productName: string }
}

const statuses = ['AVAILABLE', 'USED', 'HOLD'] as const

export function MaterialLotsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | (typeof statuses)[number]>('ALL')
  const [search, setSearch] = useState('')
  const [lotNo, setLotNo] = useState('')
  const [productId, setProductId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [receivedQty, setReceivedQty] = useState('1')
  const [remainQty, setRemainQty] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [status, setStatus] = useState<(typeof statuses)[number]>('AVAILABLE')
  const [saving, setSaving] = useState(false)
  const [lotPanelOpen, setLotPanelOpen] = useState(false)
  const [invMatId, setInvMatId] = useState('')
  const [invQty, setInvQty] = useState('1')
  const [invLocId, setInvLocId] = useState('')
  const [invSaving, setInvSaving] = useState(false)
  const [invPanelOpen, setInvPanelOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/material-lots')
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
    void load()
  }, [load])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
      if (!q) return true
      const lot = r.lotNo.toLowerCase()
      const code = r.product?.productCode?.toLowerCase() ?? ''
      const name = r.product?.productName?.toLowerCase() ?? ''
      const supplierName = (r.supplier ?? '').toLowerCase()
      return lot.includes(q) || code.includes(q) || name.includes(q) || supplierName.includes(q)
    })
  }, [items, search, statusFilter])

  const resetLotForm = useCallback(() => {
    setLotNo('')
    setProductId('')
    setSupplier('')
    setReceivedQty('1')
    setRemainQty('')
    setReceivedDate('')
    setStatus('AVAILABLE')
  }, [])

  const closeLotPanel = useCallback(() => {
    setLotPanelOpen(false)
    resetLotForm()
  }, [resetLotForm])

  const openLotModal = useCallback(() => {
    resetLotForm()
    setLotPanelOpen(true)
  }, [resetLotForm])

  const resetInvForm = useCallback(() => {
    setInvMatId('')
    setInvQty('1')
    setInvLocId('')
  }, [])

  const closeInvPanel = useCallback(() => {
    setInvPanelOpen(false)
    resetInvForm()
  }, [resetInvForm])

  const openInvModal = useCallback(() => {
    resetInvForm()
    setInvPanelOpen(true)
  }, [resetInvForm])

  useEffect(() => {
    if (!lotPanelOpen && !invPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lotPanelOpen) closeLotPanel()
        if (invPanelOpen) closeInvPanel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lotPanelOpen, invPanelOpen, closeLotPanel, closeInvPanel])

  const add = async () => {
    setSaving(true)
    setErr(null)
    try {
      const pid = Number(productId)
      if (!Number.isFinite(pid) || !lotNo.trim() || !receivedDate) {
        setErr('LOT번호·품목 ID·입고일은 필수입니다.')
        setSaving(false)
        return
      }
      await apiJson('/api/material-lots', {
        method: 'POST',
        body: JSON.stringify({
          lotNo: lotNo.trim(),
          productId: pid,
          supplier: supplier.trim() || null,
          receivedQty,
          remainQty: remainQty.trim() === '' ? undefined : remainQty.trim(),
          receivedDate,
          status,
        }),
      })
      await load()
      closeLotPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/material-lots/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const receiveInventory = async () => {
    setInvSaving(true)
    setErr(null)
    try {
      const mid = Number(invMatId)
      const q = Number(invQty)
      if (!Number.isFinite(mid) || !Number.isInteger(q) || q <= 0) {
        setErr('자재 LOT ID·수량(양의 정수)을 확인하세요.')
        setInvSaving(false)
        return
      }
      const body: Record<string, unknown> = { materialLotId: mid, qty: q }
      if (invLocId.trim() !== '') {
        const l = Number(invLocId)
        if (!Number.isFinite(l)) {
          setErr('위치 ID는 숫자여야 합니다.')
          setInvSaving(false)
          return
        }
        body.locationId = l
      }
      await apiJson('/api/transactions/receive-material-inventory', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await load()
      closeInvPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setInvSaving(false)
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">자재 LOT</h1>
        <p className="mesPageDesc">입고 자재 LOT·잔량을 등록합니다. 아래 재고 반영으로 inventory·입고 트랜잭션을 남길 수 있습니다.</p>
      </header>

      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesToolbar">
        <button type="button" className="mesBtnPrimary" onClick={openLotModal}>
          신규 등록
        </button>
        <button type="button" className="mesBtnSecondary" onClick={openInvModal}>
          재고 반영 IN
        </button>
        <label className="mesLabel mesLabelInline">
          상태 필터
          <select
            className="mesInput mesInputShort"
            value={statusFilter}
            onChange={(ev) => setStatusFilter(ev.target.value as 'ALL' | (typeof statuses)[number])}
          >
            <option value="ALL">전체</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="mesLabel mesLabelInline">
          검색
          <input
            className="mesInput"
            style={{ minWidth: 240 }}
            value={search}
            placeholder="LOT/품번/품명/공급사"
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </label>
      </div>

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>LOT</th>
              <th>품목</th>
              <th>입고수량</th>
              <th>잔량</th>
              <th>입고일</th>
              <th>상태</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  검색 조건에 맞는 행이 없습니다.
                </td>
              </tr>
            ) : (
              filteredItems.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.lotNo}</td>
                  <td>{r.product ? `${r.product.productCode} · ${r.product.productName}` : `품목#${r.productId}`}</td>
                  <td className="mono">{r.receivedQty}</td>
                  <td className="mono">{r.remainQty}</td>
                  <td>{String(r.receivedDate).slice(0, 10)}</td>
                  <td>{r.status}</td>
                  <td className="mesTdActions">
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

      {lotPanelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeLotPanel} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-matlot-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-matlot-title">
                  신규 등록
                </h2>
                <div className="mesModalMeta muted">자재 LOT 입고</div>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  LOT 번호
                  <input className="mesInput mono" value={lotNo} onChange={(ev) => setLotNo(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  품목 ID
                  <input className="mesInput mono" value={productId} onChange={(ev) => setProductId(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  공급사
                  <input className="mesInput" value={supplier} onChange={(ev) => setSupplier(ev.target.value)} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  입고수량
                  <input className="mesInput" value={receivedQty} onChange={(ev) => setReceivedQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  잔량 (비우면 입고수량과 동일)
                  <input className="mesInput" value={remainQty} onChange={(ev) => setRemainQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  입고일
                  <input className="mesInput" type="date" value={receivedDate} onChange={(ev) => setReceivedDate(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={status}
                    onChange={(ev) => setStatus(ev.target.value as (typeof statuses)[number])}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeLotPanel}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void add()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {invPanelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeInvPanel} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-matlot-inv-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-matlot-inv-title">
                  재고 반영 IN
                </h2>
                <div className="mesModalMeta muted">
                  자재 LOT ID 기준 재고 행 생성·증가 및 inventory_transaction(IN). 위치 ID 비우면 location 없는 재고와 매칭.
                </div>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  자재 LOT ID
                  <input className="mesInput mono" value={invMatId} onChange={(ev) => setInvMatId(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  수량 (정수)
                  <input className="mesInput" value={invQty} onChange={(ev) => setInvQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  위치 ID (선택)
                  <input className="mesInput mono" value={invLocId} onChange={(ev) => setInvLocId(ev.target.value)} />
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={invSaving} onClick={closeInvPanel}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={invSaving} onClick={() => void receiveInventory()}>
                {invSaving ? '처리 중…' : '반영'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
