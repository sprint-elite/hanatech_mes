import { useCallback, useEffect, useState } from 'react'

import { apiJson } from '../lib/api'

type Detail = {
  id: number
  productId: number
  lotId: number | null
  qty: number
  product?: { productCode: string; productName: string }
  lot?: { lotNo: string } | null
}

type ShipmentRow = {
  id: number
  shipmentNo: string
  customerName: string
  shipmentDate: string | null
  status: string
  details: Detail[]
}

type CustomerRef = { id: number; customerName: string }
type ProductRef = { id: number; productCode: string; productName: string; itemType: string }

const shipStatuses = ['READY', 'SHIPPED', 'CANCEL'] as const

export function ShipmentsPage() {
  const [items, setItems] = useState<ShipmentRow[]>([])
  const [customers, setCustomers] = useState<CustomerRef[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [shipmentNo, setShipmentNo] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [shipmentDate, setShipmentDate] = useState('')
  const [status, setStatus] = useState<(typeof shipStatuses)[number]>('READY')
  const [selId, setSelId] = useState<number | null>(null)
  const [lineProductId, setLineProductId] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const [headerPanelOpen, setHeaderPanelOpen] = useState(false)
  const [confirmPanelOpen, setConfirmPanelOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: ShipmentRow[] }>('/api/shipments')
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

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [c, p] = await Promise.all([
          apiJson<{ ok: boolean; items: CustomerRef[] }>('/api/customers'),
          apiJson<{ ok: boolean; items: ProductRef[] }>('/api/products'),
        ])
        setCustomers(c.items)
        setProducts(p.items)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'unknown error')
      }
    }
    void loadRefs()
  }, [])

  const closeHeaderPanel = useCallback(() => {
    setHeaderPanelOpen(false)
    setShipmentNo('')
    setCustomerName('')
    setShipmentDate('')
    setStatus('READY')
    setLineProductId('')
    setLineQty('1')
  }, [])

  const closeConfirmPanel = useCallback(() => {
    setConfirmPanelOpen(false)
  }, [])

  useEffect(() => {
    if (!headerPanelOpen && !confirmPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (headerPanelOpen) closeHeaderPanel()
      if (confirmPanelOpen) closeConfirmPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [headerPanelOpen, confirmPanelOpen, closeHeaderPanel, closeConfirmPanel])

  const createShipment = async () => {
    setSaving(true)
    setErr(null)
    try {
      if (!shipmentNo.trim() || !customerName.trim()) {
        setErr('출하번호·거래처 선택은 필수입니다.')
        setSaving(false)
        return
      }
      const pid = Number(lineProductId)
      const qty = Number(lineQty)
      if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(qty) || qty < 1) {
        setErr('품목과 수량을 입력하세요.')
        setSaving(false)
        return
      }
      const res = await apiJson<{ ok: boolean; item: { id: number } }>('/api/shipments', {
        method: 'POST',
        body: JSON.stringify({
          shipmentNo: shipmentNo.trim(),
          customerName: customerName.trim(),
          shipmentDate: shipmentDate || null,
          status,
        }),
      })
      await apiJson(`/api/shipments/${res.item.id}/details`, {
        method: 'POST',
        body: JSON.stringify({ productId: pid, qty }),
      })
      await load()
      setSelId(res.item.id)
      closeHeaderPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const removeShipment = async (id: number) => {
    if (!confirm('출하 전체를 삭제할까요?')) return
    try {
      await apiJson(`/api/shipments/${id}`, { method: 'DELETE' })
      await load()
      if (selId === id) setSelId(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const confirmShipment = async () => {
    if (selId == null) {
      setErr('목록에서 출하를 선택하세요.')
      return
    }
    const row = items.find((s) => s.id === selId)
    if (!row || row.status !== 'READY') {
      setErr('READY 상태의 출하만 확정할 수 있습니다.')
      return
    }
    if (!confirm('출하를 확정합니다. 재고가 차감됩니다. 계속할까요?')) return
    setSaving(true)
    setErr(null)
    try {
      await apiJson(`/api/transactions/shipments/${selId}/confirm`, { method: 'POST' })
      await load()
      closeConfirmPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const selected = items.find((s) => s.id === selId)
  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">출하</h1>
        <details className="mesPageHint">
          <summary>처리 방식 안내</summary>
          <p className="mesPageHintBody">
            출하 확정 시 품목별 생산 LOT 재고를 선입선출(FIFO)로 자동 배정해 차감합니다. 단일 LOT 수량이 부족하면 여러 LOT에서 자동 분할 차감됩니다.
          </p>
        </details>
      </header>

      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesToolbarSplit">
        <div className="mesToolbarSplitMain">
          <button type="button" className="mesBtnPrimary" onClick={() => setHeaderPanelOpen(true)}>
            새 출하
          </button>
          <button type="button" className="mesBtnSecondary" onClick={() => setConfirmPanelOpen(true)}>
            출하 확정
          </button>
        </div>
        <div className="mesToolbarSplitEnd">
          <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>
      </div>

      <div className="mesSelectionBar" aria-live="polite">
        {selected ? (
          <>
            선택됨: <span className="mono">{selected.shipmentNo}</span> — 출하 확정 대상입니다.
          </>
        ) : (
          <span className="muted">목록에서 출하번호를 클릭해 출하 확정 대상을 선택하세요.</span>
        )}
      </div>

      <div className="mesTableWrap mesTableScroll">
        <table className="mesTable">
          <thead>
            <tr>
              <th className="mesTableColShipNo">출하번호</th>
              <th>거래처</th>
              <th className="mesTableColDate">일자</th>
              <th className="mesTableColStatus">상태</th>
              <th className="mesTableColLines">라인</th>
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
                <tr key={r.id} className={selId === r.id ? 'mesRowSelected' : undefined}>
                  <td className="mono">
                    <button type="button" className="mesBtnSm" onClick={() => setSelId(r.id)}>
                      {r.shipmentNo}
                    </button>
                  </td>
                  <td>{r.customerName}</td>
                  <td>{r.shipmentDate ? String(r.shipmentDate).slice(0, 10) : '—'}</td>
                  <td>{r.status}</td>
                  <td className="mesTableColLines">
                    {r.details?.length ? (
                      <div className="mesShipLineList">
                        {r.details.map((d) => (
                          <div key={d.id}>
                            {d.product?.productCode ?? d.productId} × {d.qty}
                            {d.lot ? ` (${d.lot.lotNo})` : ''}
                          </div>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="mesTdActions">
                    <button type="button" className="mesBtnSm mesBtnDanger" onClick={() => void removeShipment(r.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {headerPanelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeHeaderPanel} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-ship-h-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-ship-h-title">
                  새 출하 등록
                </h2>
                <div className="mesModalMeta muted">출하 헤더 + 출하 품목 입력</div>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  출하번호
                  <input className="mesInput mono" value={shipmentNo} onChange={(ev) => setShipmentNo(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  거래처
                  <select className="mesInput" value={customerName} onChange={(ev) => setCustomerName(ev.target.value)}>
                    <option value="">선택</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.customerName}>
                        {c.customerName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  출하일
                  <input className="mesInput" type="date" value={shipmentDate} onChange={(ev) => setShipmentDate(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={status}
                    onChange={(ev) => setStatus(ev.target.value as (typeof shipStatuses)[number])}
                  >
                    {shipStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesPanelCard" style={{ marginTop: 8 }}>
                <div className="mesPanelTitle">출하 품목</div>
                <div className="mesFieldRow" style={{ marginTop: 8 }}>
                  <label className="mesLabel">
                    품목
                    <select className="mesInput" value={lineProductId} onChange={(ev) => setLineProductId(ev.target.value)}>
                      <option value="">선택</option>
                      {products.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.productCode} · {p.productName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mesLabel">
                    수량
                    <input className="mesInput" value={lineQty} onChange={(ev) => setLineQty(ev.target.value)} />
                  </label>
                </div>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeHeaderPanel}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void createShipment()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmPanelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeConfirmPanel} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-ship-c-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-ship-c-title">
                  출하 확정
                </h2>
                <div className="mesModalMeta muted">
                  선택한 출하가 READY이고 라인이 있어야 합니다. 완제품은 마지막 공정 실적 시 생성된 재고(생산 LOT 연결)와 수량이 맞아야 합니다.
                </div>
              </div>
            </div>
            <div className="mesModalBody">
              <p className="muted" style={{ marginTop: 0 }}>
                현재 선택: {selected ? `${selected.shipmentNo} (${selected.status})` : '없음'}
              </p>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeConfirmPanel}>
                취소
              </button>
              <button
                type="button"
                className="mesBtnPrimary"
                disabled={saving || selId == null || selected?.status !== 'READY'}
                onClick={() => void confirmShipment()}
              >
                {saving ? '처리 중…' : '출하 확정 (재고 차감)'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
