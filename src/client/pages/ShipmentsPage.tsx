import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson } from '../lib/api'
import '../shipments-page.css'

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

type Filters = { q: string; status: string }

const shipStatuses = ['READY', 'SHIPPED', 'CANCEL'] as const

const emptyFilters = (): Filters => ({ q: '', status: '' })

const statusLabel = (s: string) => {
  if (s === 'READY') return '준비'
  if (s === 'SHIPPED') return '출하완료'
  if (s === 'CANCEL') return '취소'
  return s
}

function statusBadgeClass(s: string): string {
  if (s === 'READY') return 'mesShipStatusBadge mesShipStatusBadge--ready'
  if (s === 'SHIPPED') return 'mesShipStatusBadge mesShipStatusBadge--shipped'
  if (s === 'CANCEL') return 'mesShipStatusBadge mesShipStatusBadge--cancel'
  return 'mesShipStatusBadge'
}

function matchesFilters(row: ShipmentRow, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const lineHay = (row.details ?? [])
      .map((d) => [d.product?.productCode ?? '', d.product?.productName ?? '', String(d.productId)].join(' '))
      .join(' ')
    const hay = [row.shipmentNo, row.customerName, lineHay].join(' ').toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filters.status && row.status !== filters.status) return false
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

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
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

function IconBan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m4.5 4.5 15 15" />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

export function ShipmentsPage() {
  const [items, setItems] = useState<ShipmentRow[]>([])
  const [customers, setCustomers] = useState<CustomerRef[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
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

  const filteredItems = useMemo(
    () => items.filter((row) => matchesFilters(row, filters)),
    [items, filters],
  )

  const stats = useMemo(() => {
    let ready = 0
    let shipped = 0
    let cancel = 0
    let totalLines = 0
    for (const row of filteredItems) {
      if (row.status === 'READY') ready += 1
      else if (row.status === 'SHIPPED') shipped += 1
      else if (row.status === 'CANCEL') cancel += 1
      totalLines += row.details?.length ?? 0
    }
    return { total: filteredItems.length, ready, shipped, cancel, totalLines }
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
    <div className="mesPage mesPageWide mesShipPage">
      <header className="mesShipHead">
        <div className="mesShipHeadMain">
          <h1 className="mesShipTitle">출하</h1>
          <p className="mesShipDesc">
            출하 확정 시 품목별 생산 LOT 재고를 선입선출(FIFO)로 자동 배정해 차감합니다. 단일 LOT 수량이 부족하면 여러 LOT에서 자동 분할 차감됩니다.
          </p>
        </div>
        <div className="mesShipHeadActions">
          <span className="mesShipCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesShipBtn mesShipBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesShipBtn mesShipBtn--secondary" onClick={() => setConfirmPanelOpen(true)}>
            <IconCheck />
            출하 확정
          </button>
          <button type="button" className="mesShipBtn mesShipBtn--primary" onClick={() => setHeaderPanelOpen(true)}>
            <IconPlus />
            새 출하
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesShipNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesShipSelectionBar" aria-live="polite">
        {selected ? (
          <>
            선택됨: <span className="mono">{selected.shipmentNo}</span> — 출하 확정 대상입니다.
          </>
        ) : (
          <span className="muted">목록에서 출하번호를 클릭해 출하 확정 대상을 선택하세요.</span>
        )}
      </div>

      <div className="mesShipFilterCard">
        <div className="mesShipField mesShipField--search">
          <span className="mesShipFieldLabel">검색</span>
          <div className="mesShipInputWrap">
            <span className="mesShipInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesShipInput mesShipInput--search"
              placeholder="출하번호 / 거래처 / 품목 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesShipField mesShipField--select">
          <span className="mesShipFieldLabel">상태</span>
          <select
            className="mesShipSelect"
            value={draftFilters.status}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, status: ev.target.value }))}
            aria-label="상태 필터"
          >
            <option value="">상태(전체)</option>
            {shipStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="mesShipFilterActions">
          <button type="button" className="mesShipBtn mesShipBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesShipBtn mesShipBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesShipStatsStrip" aria-label="출하 요약">
        <div className="mesShipStatItem">
          <div className="mesShipStatIcon mesShipStatIcon--gold">
            <IconClipboard />
          </div>
          <div className="mesShipStatMeta">
            <p className="mesShipStatLabel">전체</p>
            <p className="mesShipStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesShipStatValueNum">{stats.total}</span>
                  <span className="mesShipStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesShipStatItem">
          <div className="mesShipStatIcon mesShipStatIcon--blue">
            <IconClock />
          </div>
          <div className="mesShipStatMeta">
            <p className="mesShipStatLabel">준비</p>
            <p className="mesShipStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesShipStatValueNum">{stats.ready}</span>
                  <span className="mesShipStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesShipStatItem">
          <div className="mesShipStatIcon mesShipStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesShipStatMeta">
            <p className="mesShipStatLabel">출하완료</p>
            <p className="mesShipStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesShipStatValueNum">{stats.shipped}</span>
                  <span className="mesShipStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesShipStatItem">
          <div className="mesShipStatIcon mesShipStatIcon--orange">
            <IconBan />
          </div>
          <div className="mesShipStatMeta">
            <p className="mesShipStatLabel">취소</p>
            <p className="mesShipStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesShipStatValueNum">{stats.cancel}</span>
                  <span className="mesShipStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesShipStatItem">
          <div className="mesShipStatIcon mesShipStatIcon--purple">
            <IconList />
          </div>
          <div className="mesShipStatMeta">
            <p className="mesShipStatLabel">총 라인수</p>
            <p className="mesShipStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesShipStatValueNum">{stats.totalLines}</span>
                  <span className="mesShipStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mesShipTableCard">
        <div className="mesShipTableViewport">
          <table className="mesShipTable">
            <colgroup>
              <col className="mesShipColNo" />
              <col className="mesShipColCustomer" />
              <col className="mesShipColDate" />
              <col className="mesShipColStatus" />
              <col className="mesShipColLines" />
              <col className="mesShipColActions" />
            </colgroup>
            <thead>
              <tr>
                <th className="mesShipColNo">출하번호</th>
                <th className="mesShipColCustomer">거래처</th>
                <th className="mesShipColDate">일자</th>
                <th className="mesShipColStatus">상태</th>
                <th className="mesShipColLines">라인</th>
                <th className="mesShipThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="mesShipEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mesShipEmpty">
                    {items.length === 0 ? (
                      <>
                        데이터가 없습니다. <strong>새 출하</strong>로 추가하세요.
                      </>
                    ) : (
                      '필터 조건에 맞는 출하가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className={selId === r.id ? 'mesShipRowSelected' : undefined}>
                    <td className="mesShipColNo mono">
                      <button type="button" className="mesShipSelectBtn" onClick={() => setSelId(r.id)}>
                        {r.shipmentNo}
                      </button>
                    </td>
                    <td className="mesShipColCustomer" title={r.customerName}>
                      {r.customerName}
                    </td>
                    <td className="mesShipColDate">{r.shipmentDate ? String(r.shipmentDate).slice(0, 10) : '—'}</td>
                    <td className="mesShipColStatus">
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="mesShipColLines">
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
                    <td className="mesShipTdActions">
                      <button type="button" className="mesShipBtn mesShipBtn--danger" onClick={() => void removeShipment(r.id)}>
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

        <footer className="mesShipPager">
          <span className="mesShipPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesShipPagerNav" aria-label="페이지">
            <button type="button" className="mesShipPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesShipPagerBtn"
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
                      <span className="mesShipPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesShipPagerBtn${n === page ? ' mesShipPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesShipPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesShipPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesShipPageSize">
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
                        {statusLabel(s)}
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
                현재 선택: {selected ? `${selected.shipmentNo} (${statusLabel(selected.status)})` : '없음'}
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
