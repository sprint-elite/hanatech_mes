import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../process-history-page.css'

type Row = {
  id: number
  productionLotId: number
  processId: number
  processSequence: number
  inputQty: number
  goodQty: number
  defectQty: number
  startTime: string | null
  endTime: string | null
  createdAt: string
  lot: { lotNo: string }
  process: { processCode: string; processName: string }
  worker: { workerCode: string; workerName: string } | null
  workCenter: { centerCode: string; centerName: string } | null
}

type Filters = { q: string }

const emptyFilters = (): Filters => ({ q: '' })

function formatTs(v: string): string {
  try {
    return new Date(v).toLocaleString('ko-KR')
  } catch {
    return String(v).replace('T', ' ').slice(0, 19)
  }
}

function matchesFilters(row: Row, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (!q) return true
  const hay = [
    row.lot?.lotNo ?? '',
    String(row.productionLotId),
    row.process?.processCode ?? '',
    row.process?.processName ?? '',
    row.worker?.workerCode ?? '',
    row.worker?.workerName ?? '',
    row.workCenter?.centerCode ?? '',
    row.workCenter?.centerName ?? '',
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

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
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

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  )
}

export function ProcessHistoryPage() {
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
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/process-results')
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
    let inputQty = 0
    let goodQty = 0
    let defectQty = 0
    for (const row of filteredItems) {
      inputQty += Number(row.inputQty) || 0
      goodQty += Number(row.goodQty) || 0
      defectQty += Number(row.defectQty) || 0
    }
    return { total: filteredItems.length, inputQty, goodQty, defectQty }
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
    <div className="mesPage mesPageWide mesProcHistPage">
      <header className="mesProcHistHead">
        <div className="mesProcHistHeadMain">
          <h1 className="mesProcHistTitle">공정 실적 이력</h1>
          <p className="mesProcHistDesc">
            등록된 공정 실적을 조회합니다. 조회 전용이며 삭제는 제공되지 않습니다.
          </p>
        </div>
        <div className="mesProcHistHeadActions">
          <span className="mesProcHistCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesProcHistBtn mesProcHistBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesProcHistNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesProcHistFilterCard">
        <div className="mesProcHistField mesProcHistField--search">
          <span className="mesProcHistFieldLabel">검색</span>
          <div className="mesProcHistInputWrap">
            <span className="mesProcHistInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesProcHistInput mesProcHistInput--search"
              placeholder="LOT / 공정코드·명 / 작업자 / 작업장 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesProcHistFilterActions">
          <button type="button" className="mesProcHistBtn mesProcHistBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesProcHistBtn mesProcHistBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesProcHistStatsStrip" aria-label="공정 실적 요약">
        <div className="mesProcHistStatItem">
          <div className="mesProcHistStatIcon mesProcHistStatIcon--blue">
            <IconClipboard />
          </div>
          <div className="mesProcHistStatMeta">
            <p className="mesProcHistStatLabel">전체 실적</p>
            <p className="mesProcHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesProcHistStatValueNum">{stats.total.toLocaleString()}</span>
                  <span className="mesProcHistStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesProcHistStatItem">
          <div className="mesProcHistStatIcon mesProcHistStatIcon--purple">
            <IconInbox />
          </div>
          <div className="mesProcHistStatMeta">
            <p className="mesProcHistStatLabel">총 투입</p>
            <p className="mesProcHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesProcHistStatValueNum">{stats.inputQty.toLocaleString()}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesProcHistStatItem">
          <div className="mesProcHistStatIcon mesProcHistStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesProcHistStatMeta">
            <p className="mesProcHistStatLabel">양품</p>
            <p className="mesProcHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesProcHistStatValueNum">{stats.goodQty.toLocaleString()}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesProcHistStatItem">
          <div className="mesProcHistStatIcon mesProcHistStatIcon--orange">
            <IconAlert />
          </div>
          <div className="mesProcHistStatMeta">
            <p className="mesProcHistStatLabel">불량</p>
            <p className="mesProcHistStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesProcHistStatValueNum">{stats.defectQty.toLocaleString()}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mesProcHistTableCard">
        <div className="mesProcHistTableViewport">
          <table className="mesProcHistTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>LOT</th>
                <th>공정</th>
                <th>순서</th>
                <th>투입</th>
                <th>양품</th>
                <th>불량</th>
                <th>작업자</th>
                <th>작업장</th>
                <th>등록</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="mesProcHistEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="mesProcHistEmpty">
                    {items.length === 0 ? '실적이 없습니다.' : '필터 조건에 맞는 실적이 없습니다.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td className="mono">{r.lot.lotNo}</td>
                    <td>
                      <span className="mono">{r.process.processCode}</span>
                      <div style={{ fontSize: 12, color: 'var(--ph-muted)', marginTop: 2 }}>
                        {r.process.processName}
                      </div>
                    </td>
                    <td>{r.processSequence}</td>
                    <td>{Number(r.inputQty).toLocaleString()}</td>
                    <td>{Number(r.goodQty).toLocaleString()}</td>
                    <td>{Number(r.defectQty).toLocaleString()}</td>
                    <td>
                      {r.worker ? `${r.worker.workerCode} · ${r.worker.workerName}` : '—'}
                    </td>
                    <td>{r.workCenter ? r.workCenter.centerCode : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--ph-muted)', whiteSpace: 'nowrap' }}>
                      {formatTs(r.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesProcHistPager">
          <span className="mesProcHistPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesProcHistPagerNav" aria-label="페이지">
            <button
              type="button"
              className="mesProcHistPagerBtn"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              aria-label="첫 페이지"
            >
              «
            </button>
            <button
              type="button"
              className="mesProcHistPagerBtn"
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
                      <span className="mesProcHistPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesProcHistPagerBtn${n === page ? ' mesProcHistPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesProcHistPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesProcHistPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesProcHistPageSize">
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
