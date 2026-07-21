import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson } from '../lib/api'
import '../material-lots-page.css'

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

type Filters = { q: string; status: string }

const statuses = ['AVAILABLE', 'USED', 'HOLD'] as const

const emptyFilters = (): Filters => ({ q: '', status: '' })

const statusLabel = (s: string) => {
  if (s === 'AVAILABLE') return '가용'
  if (s === 'USED') return '사용'
  if (s === 'HOLD') return '보류'
  return s
}

function statusBadgeClass(s: string): string {
  if (s === 'AVAILABLE') return 'mesMatLotStatusBadge mesMatLotStatusBadge--available'
  if (s === 'USED') return 'mesMatLotStatusBadge mesMatLotStatusBadge--used'
  if (s === 'HOLD') return 'mesMatLotStatusBadge mesMatLotStatusBadge--hold'
  return 'mesMatLotStatusBadge'
}

function matchesFilters(row: Row, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const hay = [
      row.lotNo,
      row.product?.productCode ?? '',
      row.product?.productName ?? '',
      row.supplier ?? '',
      String(row.productId),
    ]
      .join(' ')
      .toLowerCase()
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

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
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

function IconPackage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
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

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 12h-6l-2 3H10l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  )
}

export function MaterialLotsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
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

  const filteredItems = useMemo(
    () => items.filter((row) => matchesFilters(row, filters)),
    [items, filters],
  )

  const stats = useMemo(() => {
    let available = 0
    let used = 0
    let hold = 0
    let totalRemainQty = 0
    for (const row of filteredItems) {
      if (row.status === 'AVAILABLE') available += 1
      else if (row.status === 'USED') used += 1
      else if (row.status === 'HOLD') hold += 1
      const rq = Number(row.remainQty)
      if (Number.isFinite(rq)) totalRemainQty += rq
    }
    return { total: filteredItems.length, available, used, hold, totalRemainQty }
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
    <div className="mesPage mesPageWide mesMatLotPage">
      <header className="mesMatLotHead">
        <div className="mesMatLotHeadMain">
          <h1 className="mesMatLotTitle">자재 LOT</h1>
          <p className="mesMatLotDesc">
            입고 자재 LOT·잔량을 등록합니다. 아래 재고 반영으로 inventory·입고 트랜잭션을 남길 수 있습니다.
          </p>
        </div>
        <div className="mesMatLotHeadActions">
          <span className="mesMatLotCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesMatLotBtn mesMatLotBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesMatLotBtn mesMatLotBtn--secondary" onClick={openInvModal}>
            재고 반영 IN
          </button>
          <button type="button" className="mesMatLotBtn mesMatLotBtn--primary" onClick={openLotModal}>
            <IconPlus />
            신규 등록
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesMatLotNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesMatLotFilterCard">
        <div className="mesMatLotField mesMatLotField--search">
          <span className="mesMatLotFieldLabel">검색</span>
          <div className="mesMatLotInputWrap">
            <span className="mesMatLotInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesMatLotInput mesMatLotInput--search"
              placeholder="LOT / 품번 / 품명 / 공급사 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesMatLotField mesMatLotField--select">
          <span className="mesMatLotFieldLabel">상태</span>
          <select
            className="mesMatLotSelect"
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
        <div className="mesMatLotFilterActions">
          <button type="button" className="mesMatLotBtn mesMatLotBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesMatLotBtn mesMatLotBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesMatLotStatsStrip" aria-label="자재 LOT 요약">
        <div className="mesMatLotStatItem">
          <div className="mesMatLotStatIcon mesMatLotStatIcon--gold">
            <IconBox />
          </div>
          <div className="mesMatLotStatMeta">
            <p className="mesMatLotStatLabel">전체</p>
            <p className="mesMatLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesMatLotStatValueNum">{stats.total}</span>
                  <span className="mesMatLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesMatLotStatItem">
          <div className="mesMatLotStatIcon mesMatLotStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesMatLotStatMeta">
            <p className="mesMatLotStatLabel">가용</p>
            <p className="mesMatLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesMatLotStatValueNum">{stats.available}</span>
                  <span className="mesMatLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesMatLotStatItem">
          <div className="mesMatLotStatIcon mesMatLotStatIcon--blue">
            <IconPackage />
          </div>
          <div className="mesMatLotStatMeta">
            <p className="mesMatLotStatLabel">사용</p>
            <p className="mesMatLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesMatLotStatValueNum">{stats.used}</span>
                  <span className="mesMatLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesMatLotStatItem">
          <div className="mesMatLotStatIcon mesMatLotStatIcon--orange">
            <IconPause />
          </div>
          <div className="mesMatLotStatMeta">
            <p className="mesMatLotStatLabel">보류</p>
            <p className="mesMatLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesMatLotStatValueNum">{stats.hold}</span>
                  <span className="mesMatLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesMatLotStatItem">
          <div className="mesMatLotStatIcon mesMatLotStatIcon--purple">
            <IconInbox />
          </div>
          <div className="mesMatLotStatMeta">
            <p className="mesMatLotStatLabel">총 잔량</p>
            <p className="mesMatLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesMatLotStatValueNum">{stats.totalRemainQty.toLocaleString('ko-KR')}</span>
                </>
              )}
            </p>
          </div>
        </div>
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
                        {statusLabel(s)}
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

      <div className="mesMatLotTableCard">
        <div className="mesMatLotTableViewport">
          <table className="mesMatLotTable">
            <thead>
              <tr>
                <th>LOT</th>
                <th>품목</th>
                <th>입고수량</th>
                <th>잔량</th>
                <th>입고일</th>
                <th>상태</th>
                <th className="mesMatLotThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="mesMatLotEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mesMatLotEmpty">
                    {items.length === 0 ? (
                      <>
                        데이터가 없습니다. <strong>신규 등록</strong>으로 추가하세요.
                      </>
                    ) : (
                      '필터 조건에 맞는 LOT가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.lotNo}</td>
                    <td>{r.product ? `${r.product.productCode} · ${r.product.productName}` : `품목#${r.productId}`}</td>
                    <td className="mono">{r.receivedQty}</td>
                    <td className="mono">{r.remainQty}</td>
                    <td>{String(r.receivedDate).slice(0, 10)}</td>
                    <td>
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="mesMatLotTdActions">
                      <button type="button" className="mesMatLotBtn mesMatLotBtn--danger" onClick={() => void remove(r.id)} aria-label="삭제">
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesMatLotPager">
          <span className="mesMatLotPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesMatLotPagerNav" aria-label="페이지">
            <button type="button" className="mesMatLotPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesMatLotPagerBtn"
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
                      <span className="mesMatLotPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesMatLotPagerBtn${n === page ? ' mesMatLotPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesMatLotPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesMatLotPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesMatLotPageSize">
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
