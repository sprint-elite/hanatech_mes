import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../production-plans-page.css'

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

type Filters = { q: string; status: string; periodFrom: string; periodTo: string }

const statuses = ['PLANNED', 'CONFIRMED', 'CLOSED'] as const

const emptyFilters = (): Filters => ({ q: '', status: '', periodFrom: '', periodTo: '' })

const statusLabel = (s: string) => {
  if (s === 'PLANNED') return '계획'
  if (s === 'CONFIRMED') return '확정'
  if (s === 'CLOSED') return '마감'
  return s
}

function statusBadgeClass(s: string): string {
  if (s === 'PLANNED') return 'mesPlanStatusBadge mesPlanStatusBadge--planned'
  if (s === 'CONFIRMED') return 'mesPlanStatusBadge mesPlanStatusBadge--confirmed'
  if (s === 'CLOSED') return 'mesPlanStatusBadge mesPlanStatusBadge--closed'
  return 'mesPlanStatusBadge'
}

function ymdOf(v: string): string {
  return String(v).slice(0, 10)
}

function matchesFilters(row: Row, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const hay = [
      row.planNo,
      row.product?.productCode ?? '',
      row.product?.productName ?? '',
      String(row.productId),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }

  if (filters.status && row.status !== filters.status) return false

  const start = ymdOf(row.startDate)
  const end = ymdOf(row.endDate)
  if (filters.periodFrom && end < filters.periodFrom) return false
  if (filters.periodTo && start > filters.periodTo) return false

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

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function IconDocument() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
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

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  )
}

export function ProductionPlansPage() {
  const [items, setItems] = useState<Row[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
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

  const filteredItems = useMemo(
    () => items.filter((row) => matchesFilters(row, filters)),
    [items, filters],
  )

  const stats = useMemo(() => {
    let planned = 0
    let confirmed = 0
    let totalQty = 0
    for (const row of filteredItems) {
      if (row.status === 'PLANNED') planned += 1
      if (row.status === 'CONFIRMED') confirmed += 1
      totalQty += row.planQty
    }
    return { total: filteredItems.length, planned, confirmed, totalQty }
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
    setStartDate(ymdOf(r.startDate))
    setEndDate(ymdOf(r.endDate))
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
    <div className="mesPage mesPageWide mesPlanPage">
      <header className="mesPlanHead">
        <div className="mesPlanHeadMain">
          <h1 className="mesPlanTitle">생산 계획</h1>
          <p className="mesPlanDesc">
            계획 번호·기간·수량을 등록합니다. (확정·마감 등 상태 변경은 이후 트랜잭션과 연동 가능)
          </p>
        </div>
        <div className="mesPlanHeadActions">
          <span className="mesPlanCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesPlanBtn mesPlanBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesPlanBtn mesPlanBtn--primary" onClick={openNew}>
            <IconPlus />
            새 계획
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesPlanNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesPlanFilterCard">
        <div className="mesPlanField mesPlanField--search">
          <span className="mesPlanFieldLabel">검색</span>
          <div className="mesPlanInputWrap">
            <span className="mesPlanInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesPlanInput mesPlanInput--search"
              placeholder="계획번호 / 품목 / 품번 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesPlanField mesPlanField--select">
          <span className="mesPlanFieldLabel">상태</span>
          <select
            className="mesPlanSelect"
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
        <div className="mesPlanField mesPlanField--period">
          <span className="mesPlanFieldLabel">기간</span>
          <div className="mesPlanPeriodRow">
            <input
              className="mesPlanInput"
              type="date"
              value={draftFilters.periodFrom}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, periodFrom: ev.target.value }))}
              aria-label="기간 시작"
            />
            <span className="mesPlanPeriodSep">~</span>
            <input
              className="mesPlanInput"
              type="date"
              value={draftFilters.periodTo}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, periodTo: ev.target.value }))}
              aria-label="기간 종료"
            />
          </div>
        </div>
        <div className="mesPlanFilterActions">
          <button type="button" className="mesPlanBtn mesPlanBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesPlanBtn mesPlanBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesPlanStatsStrip" aria-label="생산 계획 요약">
        <div className="mesPlanStatItem">
          <div className="mesPlanStatIcon mesPlanStatIcon--blue">
            <IconCalendar />
          </div>
          <div className="mesPlanStatMeta">
            <p className="mesPlanStatLabel">전체 계획</p>
            <p className="mesPlanStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesPlanStatValueNum">{stats.total}</span>
                  <span className="mesPlanStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesPlanStatItem">
          <div className="mesPlanStatIcon mesPlanStatIcon--purple">
            <IconDocument />
          </div>
          <div className="mesPlanStatMeta">
            <p className="mesPlanStatLabel">계획</p>
            <p className="mesPlanStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesPlanStatValueNum">{stats.planned}</span>
                  <span className="mesPlanStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesPlanStatItem">
          <div className="mesPlanStatIcon mesPlanStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesPlanStatMeta">
            <p className="mesPlanStatLabel">확정</p>
            <p className="mesPlanStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesPlanStatValueNum">{stats.confirmed}</span>
                  <span className="mesPlanStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesPlanStatItem">
          <div className="mesPlanStatIcon mesPlanStatIcon--gold">
            <IconBox />
          </div>
          <div className="mesPlanStatMeta">
            <p className="mesPlanStatLabel">총 수량</p>
            <p className="mesPlanStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesPlanStatValueNum">{stats.totalQty.toLocaleString('ko-KR')}</span>
                  <span className="mesPlanStatValueUnit">EA</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

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

      <div className="mesPlanTableCard">
        <div className="mesPlanTableViewport">
          <table className="mesPlanTable">
            <thead>
              <tr>
                <th>계획번호</th>
                <th>품목</th>
                <th>수량</th>
                <th>기간</th>
                <th>상태</th>
                <th className="mesPlanThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="mesPlanEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mesPlanEmpty">
                    데이터가 없습니다. <strong>새 계획</strong>으로 추가하세요.
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.planNo}</td>
                    <td>{r.product ? `${r.product.productCode} ${r.product.productName}` : r.productId}</td>
                    <td>{r.planQty.toLocaleString('ko-KR')}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {ymdOf(r.startDate)} ~ {ymdOf(r.endDate)}
                    </td>
                    <td>
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="mesPlanTdActions">
                      <button type="button" className="mesPlanBtn mesPlanBtn--edit" onClick={() => openEdit(r)}>
                        <IconEdit />
                        수정
                      </button>
                      <button type="button" className="mesPlanBtn mesPlanBtn--danger" onClick={() => void remove(r.id)}>
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

        <footer className="mesPlanPager">
          <span className="mesPlanPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesPlanPagerNav" aria-label="페이지">
            <button type="button" className="mesPlanPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesPlanPagerBtn"
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
                      <span className="mesPlanPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesPlanPagerBtn${n === page ? ' mesPlanPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesPlanPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesPlanPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesPlanPageSize">
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
