import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../lot-history-page.css'

type Row = {
  id: number
  productionLotId: number
  eventType: string
  eventDesc: string | null
  createdAt: string
  productionLot?: { lotNo: string }
}

type Filters = { q: string; eventType: string }

const eventTypes = ['CREATE', 'MOVE', 'SPLIT', 'MERGE', 'CLOSE'] as const

const emptyFilters = (): Filters => ({ q: '', eventType: '' })

const eventLabel = (e: string) => {
  if (e === 'CREATE') return '생성'
  if (e === 'MOVE') return '이동'
  if (e === 'SPLIT') return '분할'
  if (e === 'MERGE') return '병합'
  if (e === 'CLOSE') return '마감'
  return e
}

function eventBadgeClass(e: string): string {
  const key = e.toLowerCase()
  if (key === 'create' || key === 'move' || key === 'split' || key === 'merge' || key === 'close') {
    return `mesLotHistEventBadge mesLotHistEventBadge--${key}`
  }
  return 'mesLotHistEventBadge mesLotHistEventBadge--other'
}

function formatTs(v: string): string {
  return String(v).replace('T', ' ').slice(0, 19)
}

function matchesFilters(row: Row, filters: Filters): boolean {
  if (filters.eventType && row.eventType !== filters.eventType) return false
  const q = filters.q.trim().toLowerCase()
  if (!q) return true
  const hay = [
    row.productionLot?.lotNo ?? '',
    String(row.productionLotId),
    row.eventType,
    eventLabel(row.eventType),
    row.eventDesc ?? '',
    formatTs(row.createdAt),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
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

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function IconSplit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 3h5v5M8 3H3v5M12 12v9M8 21l4-9 4 9" />
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

export function LotHistoryPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/lot-histories')
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
    let create = 0
    let move = 0
    let splitMerge = 0
    let close = 0
    for (const row of filteredItems) {
      if (row.eventType === 'CREATE') create += 1
      else if (row.eventType === 'MOVE') move += 1
      else if (row.eventType === 'SPLIT' || row.eventType === 'MERGE') splitMerge += 1
      else if (row.eventType === 'CLOSE') close += 1
    }
    return { total: filteredItems.length, create, move, splitMerge, close }
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

  return (
    <div className="mesPage mesPageWide mesLotHistPage">
      <header className="mesLotHistHead">
        <div className="mesLotHistHeadMain">
          <h1 className="mesLotHistTitle">생산 LOT 이력</h1>
          <p className="mesLotHistDesc">LOT 상태 변경 이벤트 로그(조회 전용).</p>
        </div>
        <div className="mesLotHistHeadActions">
          <span className="mesLotHistCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesLotHistBtn mesLotHistBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesLotHistNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesLotHistFilterCard">
        <div className="mesLotHistField mesLotHistField--search">
          <span className="mesLotHistFieldLabel">검색</span>
          <div className="mesLotHistInputWrap">
            <span className="mesLotHistInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesLotHistInput mesLotHistInput--search"
              placeholder="LOT / 이벤트 / 설명 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesLotHistField mesLotHistField--select">
          <span className="mesLotHistFieldLabel">이벤트</span>
          <select
            className="mesLotHistSelect"
            value={draftFilters.eventType}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, eventType: ev.target.value }))}
            aria-label="이벤트 필터"
          >
            <option value="">이벤트(전체)</option>
            {eventTypes.map((s) => (
              <option key={s} value={s}>
                {eventLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="mesLotHistFilterActions">
          <button type="button" className="mesLotHistBtn mesLotHistBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesLotHistBtn mesLotHistBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesLotHistStatsStrip" aria-label="LOT 이력 요약">
        <div className="mesLotHistStatItem">
          <div className="mesLotHistStatIcon mesLotHistStatIcon--blue">
            <IconHistory />
          </div>
          <div className="mesLotHistStatMeta">
            <p className="mesLotHistStatLabel">전체 이력</p>
            <p className="mesLotHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotHistStatValueNum">{stats.total}</span>
                  <span className="mesLotHistStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotHistStatItem">
          <div className="mesLotHistStatIcon mesLotHistStatIcon--blue">
            <IconPlus />
          </div>
          <div className="mesLotHistStatMeta">
            <p className="mesLotHistStatLabel">생성</p>
            <p className="mesLotHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotHistStatValueNum">{stats.create}</span>
                  <span className="mesLotHistStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotHistStatItem">
          <div className="mesLotHistStatIcon mesLotHistStatIcon--purple">
            <IconArrow />
          </div>
          <div className="mesLotHistStatMeta">
            <p className="mesLotHistStatLabel">이동</p>
            <p className="mesLotHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotHistStatValueNum">{stats.move}</span>
                  <span className="mesLotHistStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotHistStatItem">
          <div className="mesLotHistStatIcon mesLotHistStatIcon--orange">
            <IconSplit />
          </div>
          <div className="mesLotHistStatMeta">
            <p className="mesLotHistStatLabel">분할·병합</p>
            <p className="mesLotHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotHistStatValueNum">{stats.splitMerge}</span>
                  <span className="mesLotHistStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotHistStatItem">
          <div className="mesLotHistStatIcon mesLotHistStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesLotHistStatMeta">
            <p className="mesLotHistStatLabel">마감</p>
            <p className="mesLotHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotHistStatValueNum">{stats.close}</span>
                  <span className="mesLotHistStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mesLotHistTableCard">
        <div className="mesLotHistTableViewport">
          <table className="mesLotHistTable">
            <thead>
              <tr>
                <th>LOT</th>
                <th>이벤트</th>
                <th>설명</th>
                <th>시각</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="mesLotHistEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="mesLotHistEmpty">
                    {items.length === 0 ? '데이터가 없습니다.' : '필터 조건에 맞는 이력이 없습니다.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.productionLot?.lotNo ?? r.productionLotId}</td>
                    <td>
                      <span className={eventBadgeClass(r.eventType)}>{eventLabel(r.eventType)}</span>
                    </td>
                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.eventDesc ?? '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {formatTs(r.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesLotHistPager">
          <span className="mesLotHistPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesLotHistPagerNav" aria-label="페이지">
            <button type="button" className="mesLotHistPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesLotHistPagerBtn"
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
                      <span className="mesLotHistPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesLotHistPagerBtn${n === page ? ' mesLotHistPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesLotHistPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesLotHistPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesLotHistPageSize">
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
