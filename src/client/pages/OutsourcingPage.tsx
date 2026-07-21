import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../outsourcing-page.css'

type OutRow = {
  id: number
  outsourcingNo: string
  productionLotId: number
  processId: number
  vendorName: string
  requestQty: number
  status: string
  productionLot?: { lotNo: string }
  process?: { processCode: string; processName: string }
  results?: { id: number; goodQty: number; defectQty: number; inDate: string | null }[]
}

type LotOpt = { id: number; lotNo: string; productId: number }
type ProcessOpt = { id: number; processCode: string; processName: string; sequence: number }

type Filters = { q: string; status: string }

const statuses = ['REQUEST', 'OUT', 'IN', 'DONE'] as const

type ReqForm = {
  outsourcingNo: string
  productionLotId: string
  processId: string
  vendorName: string
  requestQty: string
  status: (typeof statuses)[number]
}

const emptyFilters = (): Filters => ({ q: '', status: '' })

const emptyReqForm = (): ReqForm => ({
  outsourcingNo: '',
  productionLotId: '',
  processId: '',
  vendorName: '',
  requestQty: '1',
  status: 'REQUEST',
})

const statusLabel = (s: string) => {
  if (s === 'REQUEST') return '의뢰'
  if (s === 'OUT') return '반출'
  if (s === 'IN') return '반입'
  if (s === 'DONE') return '완료'
  return s
}

function statusBadgeClass(s: string): string {
  if (s === 'REQUEST') return 'mesOutStatusBadge mesOutStatusBadge--request'
  if (s === 'OUT') return 'mesOutStatusBadge mesOutStatusBadge--out'
  if (s === 'IN') return 'mesOutStatusBadge mesOutStatusBadge--in'
  if (s === 'DONE') return 'mesOutStatusBadge mesOutStatusBadge--done'
  return 'mesOutStatusBadge'
}

function matchesFilters(row: OutRow, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const lotTxt = row.productionLot?.lotNo ?? String(row.productionLotId)
    const processTxt = row.process
      ? `${row.process.processCode} ${row.process.processName}`
      : String(row.processId)
    const hay = [row.outsourcingNo, lotTxt, processTxt, row.vendorName].join(' ').toLowerCase()
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

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

function IconTruck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.078A1 1 0 0 0 17.382 8H14" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
}

function IconPackageIn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 16v6M8 16v6M12 4v12" />
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="M4 8v8l8 4 8-4V8" />
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

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  )
}

export function OutsourcingPage() {
  const [items, setItems] = useState<OutRow[]>([])
  const [lots, setLots] = useState<LotOpt[]>([])
  const [processes, setProcesses] = useState<ProcessOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selId, setSelId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const [reqOpen, setReqOpen] = useState(false)
  const [reqEditingId, setReqEditingId] = useState<number | null>(null)
  const [reqForm, setReqForm] = useState<ReqForm>(emptyReqForm())

  const [resOpen, setResOpen] = useState(false)
  const [goodQty, setGoodQty] = useState('0')
  const [defectQty, setDefectQty] = useState('0')
  const [inDate, setInDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: OutRow[] }>('/api/outsourcing')
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLots = useCallback(async () => {
    try {
      const data = await apiJson<{ ok?: boolean; items: LotOpt[] }>('/api/lots')
      setLots(data.items ?? [])
    } catch {
      setLots([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadLots()
  }, [loadLots])

  const filteredItems = useMemo(
    () => items.filter((row) => matchesFilters(row, filters)),
    [items, filters],
  )

  const stats = useMemo(() => {
    let request = 0
    let out = 0
    let inStatus = 0
    let done = 0
    for (const row of filteredItems) {
      if (row.status === 'REQUEST') request += 1
      else if (row.status === 'OUT') out += 1
      else if (row.status === 'IN') inStatus += 1
      else if (row.status === 'DONE') done += 1
    }
    return { total: filteredItems.length, request, out, in: inStatus, done }
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

  const closeReq = useCallback(() => {
    setReqOpen(false)
    setReqEditingId(null)
    setReqForm(emptyReqForm())
    setProcesses([])
  }, [])

  const closeRes = useCallback(() => {
    setResOpen(false)
    setGoodQty('0')
    setDefectQty('0')
    setInDate('')
  }, [])

  useEffect(() => {
    if (!reqOpen && !resOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (reqOpen) closeReq()
      if (resOpen) closeRes()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reqOpen, resOpen, closeReq, closeRes])

  const lidNum = Number(reqForm.productionLotId)
  const selectedLot = Number.isInteger(lidNum) && lidNum >= 1 ? lots.find((l) => l.id === lidNum) : undefined

  useEffect(() => {
    const lid = Number(reqForm.productionLotId)
    if (!Number.isInteger(lid) || lid < 1) {
      setProcesses([])
      return
    }
    const lot = lots.find((l) => l.id === lid)
    if (!lot) {
      setProcesses([])
      return
    }
    let cancelled = false
    void apiJson<{ ok?: boolean; items: ProcessOpt[] }>(`/api/processes?productId=${lot.productId}`)
      .then((data) => {
        if (!cancelled) setProcesses(data.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setProcesses([])
      })
    return () => {
      cancelled = true
    }
  }, [reqForm.productionLotId, lots])

  const openReqNew = () => {
    setReqEditingId(null)
    setReqForm(emptyReqForm())
    setReqOpen(true)
  }

  const openReqEdit = (r: OutRow) => {
    setReqEditingId(r.id)
    setReqForm({
      outsourcingNo: r.outsourcingNo,
      productionLotId: String(r.productionLotId),
      processId: String(r.processId),
      vendorName: r.vendorName,
      requestQty: String(r.requestQty),
      status: (statuses.includes(r.status as (typeof statuses)[number]) ? r.status : 'REQUEST') as (typeof statuses)[number],
    })
    setReqOpen(true)
  }

  const saveReq = async () => {
    setSaving(true)
    setErr(null)
    try {
      const lid = Number(reqForm.productionLotId)
      const pid = Number(reqForm.processId)
      const rq = Number(reqForm.requestQty)
      if (!Number.isFinite(lid) || !Number.isFinite(pid) || !Number.isFinite(rq) || !reqForm.outsourcingNo.trim() || !reqForm.vendorName.trim()) {
        setErr('필수 항목을 확인하세요.')
        setSaving(false)
        return
      }
      if (reqEditingId == null) {
        await apiJson('/api/outsourcing', {
          method: 'POST',
          body: JSON.stringify({
            outsourcingNo: reqForm.outsourcingNo.trim(),
            productionLotId: lid,
            processId: pid,
            vendorName: reqForm.vendorName.trim(),
            requestQty: rq,
            status: reqForm.status,
          }),
        })
      } else {
        await apiJson(`/api/outsourcing/${reqEditingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            outsourcingNo: reqForm.outsourcingNo.trim(),
            productionLotId: lid,
            processId: pid,
            vendorName: reqForm.vendorName.trim(),
            requestQty: rq,
            status: reqForm.status,
          }),
        })
      }
      await load()
      closeReq()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const openRes = () => {
    setGoodQty('0')
    setDefectQty('0')
    setInDate('')
    setResOpen(true)
  }

  const addResult = async () => {
    if (selId == null) {
      setErr('목록에서 외주 행을 선택하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const g = Number(goodQty)
      if (!Number.isFinite(g) || g < 0) {
        setErr('양품 수량을 확인하세요.')
        setSaving(false)
        return
      }
      await apiJson(`/api/outsourcing/${selId}/results`, {
        method: 'POST',
        body: JSON.stringify({
          goodQty: g,
          defectQty: Number(defectQty) || 0,
          inDate: inDate || null,
        }),
      })
      await load()
      closeRes()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/outsourcing/${id}`, { method: 'DELETE' })
      await load()
      if (selId === id) setSelId(null)
      if (reqEditingId === id) closeReq()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const reqModalTitle = reqEditingId == null ? '신규 등록' : '수정'
  const selected = items.find((r) => r.id === selId)

  return (
    <div className="mesPage mesPageWide mesOutPage">
      <header className="mesOutHead">
        <div className="mesOutHeadMain">
          <h1 className="mesOutTitle">외주</h1>
          <p className="mesOutDesc">생산 LOT·공정 단위 외주 요청과 입고 실적(간단)을 등록합니다.</p>
        </div>
        <div className="mesOutHeadActions">
          <span className="mesOutCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesOutBtn mesOutBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesOutBtn mesOutBtn--secondary" onClick={openRes}>
            <IconInbox />
            입고 실적
          </button>
          <button type="button" className="mesOutBtn mesOutBtn--primary" onClick={openReqNew}>
            <IconPlus />
            새 외주
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesOutNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesOutSelectionBar" aria-live="polite">
        {selected ? (
          <>
            선택됨: <span className="mono">{selected.outsourcingNo}</span> — 입고 실적 대상입니다.
          </>
        ) : (
          <span className="muted">목록에서 외주번호를 클릭해 입고 실적 대상을 선택하세요.</span>
        )}
      </div>

      <div className="mesOutFilterCard">
        <div className="mesOutField mesOutField--search">
          <span className="mesOutFieldLabel">검색</span>
          <div className="mesOutInputWrap">
            <span className="mesOutInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesOutInput mesOutInput--search"
              placeholder="외주번호 / LOT / 공정 / 협력사 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesOutField mesOutField--select">
          <span className="mesOutFieldLabel">상태</span>
          <select
            className="mesOutSelect"
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
        <div className="mesOutFilterActions">
          <button type="button" className="mesOutBtn mesOutBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesOutBtn mesOutBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesOutStatsStrip" aria-label="외주 요약">
        <div className="mesOutStatItem">
          <div className="mesOutStatIcon mesOutStatIcon--gold">
            <IconClipboard />
          </div>
          <div className="mesOutStatMeta">
            <p className="mesOutStatLabel">전체</p>
            <p className="mesOutStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesOutStatValueNum">{stats.total}</span>
                  <span className="mesOutStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesOutStatItem">
          <div className="mesOutStatIcon mesOutStatIcon--blue">
            <IconClock />
          </div>
          <div className="mesOutStatMeta">
            <p className="mesOutStatLabel">의뢰</p>
            <p className="mesOutStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesOutStatValueNum">{stats.request}</span>
                  <span className="mesOutStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesOutStatItem">
          <div className="mesOutStatIcon mesOutStatIcon--purple">
            <IconTruck />
          </div>
          <div className="mesOutStatMeta">
            <p className="mesOutStatLabel">반출</p>
            <p className="mesOutStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesOutStatValueNum">{stats.out}</span>
                  <span className="mesOutStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesOutStatItem">
          <div className="mesOutStatIcon mesOutStatIcon--orange">
            <IconPackageIn />
          </div>
          <div className="mesOutStatMeta">
            <p className="mesOutStatLabel">반입</p>
            <p className="mesOutStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesOutStatValueNum">{stats.in}</span>
                  <span className="mesOutStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesOutStatItem">
          <div className="mesOutStatIcon mesOutStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesOutStatMeta">
            <p className="mesOutStatLabel">완료</p>
            <p className="mesOutStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesOutStatValueNum">{stats.done}</span>
                  <span className="mesOutStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mesOutTableCard">
        <div className="mesOutTableViewport">
          <table className="mesOutTable">
            <colgroup>
              <col className="mesOutColNo" />
              <col className="mesOutColLot" />
              <col className="mesOutColProcess" />
              <col className="mesOutColVendor" />
              <col className="mesOutColQtyStatus" />
              <col className="mesOutColResults" />
              <col className="mesOutColActions" />
            </colgroup>
            <thead>
              <tr>
                <th className="mesOutColNo">외주번호</th>
                <th className="mesOutColLot">LOT</th>
                <th className="mesOutColProcess">공정</th>
                <th className="mesOutColVendor">협력사</th>
                <th className="mesOutColQtyStatus">수량·상태</th>
                <th className="mesOutColResults">실적</th>
                <th className="mesOutThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="mesOutEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mesOutEmpty">
                    {items.length === 0 ? (
                      <>
                        데이터가 없습니다. <strong>새 외주</strong>로 추가하세요.
                      </>
                    ) : (
                      '필터 조건에 맞는 외주가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className={selId === r.id ? 'mesOutRowSelected' : undefined}>
                    <td className="mesOutColNo mono">
                      <button type="button" className="mesOutSelectBtn" onClick={() => setSelId(r.id)}>
                        {r.outsourcingNo}
                      </button>
                    </td>
                    <td className="mesOutColLot">{r.productionLot?.lotNo ?? r.productionLotId}</td>
                    <td className="mesOutColProcess" title={r.process ? `${r.process.processCode} ${r.process.processName}` : undefined}>
                      {r.process ? r.process.processCode : r.processId}
                    </td>
                    <td className="mesOutColVendor" title={r.vendorName}>
                      {r.vendorName}
                    </td>
                    <td className="mesOutColQtyStatus">
                      {r.requestQty.toLocaleString('ko-KR')}{' '}
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="mesOutColResults">
                      {r.results?.length ? (
                        <div className="mesOutResultList">
                          {r.results.map((x) => (
                            <div key={x.id}>
                              양{x.goodQty} 불량{x.defectQty}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="mesOutTdActions">
                      <button type="button" className="mesOutIconBtn mesOutIconBtn--edit" onClick={() => openReqEdit(r)} aria-label="수정">
                        <IconEdit />
                      </button>
                      <button type="button" className="mesOutIconBtn mesOutIconBtn--danger" onClick={() => void remove(r.id)} aria-label="삭제">
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesOutPager">
          <span className="mesOutPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesOutPagerNav" aria-label="페이지">
            <button type="button" className="mesOutPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesOutPagerBtn"
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
                      <span className="mesOutPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesOutPagerBtn${n === page ? ' mesOutPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesOutPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesOutPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesOutPageSize">
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

      {reqOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeReq} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-out-req-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-out-req-title">
                  외주 요청 · {reqModalTitle}
                </h2>
                {reqEditingId != null ? <div className="mesModalMeta muted">ID {reqEditingId}</div> : null}
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  외주번호
                  <input
                    className="mesInput mono"
                    value={reqForm.outsourcingNo}
                    onChange={(ev) => setReqForm((f) => ({ ...f, outsourcingNo: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  생산 LOT
                  <select
                    className="mesInput"
                    value={reqForm.productionLotId}
                    onChange={(ev) => setReqForm((f) => ({ ...f, productionLotId: ev.target.value, processId: '' }))}
                  >
                    <option value="">선택</option>
                    {lots.map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.lotNo} (품목 #{l.productId})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  공정
                  <select
                    className="mesInput"
                    value={reqForm.processId}
                    onChange={(ev) => setReqForm((f) => ({ ...f, processId: ev.target.value }))}
                    disabled={!selectedLot}
                  >
                    <option value="">{selectedLot ? '선택' : 'LOT을 먼저 선택'}</option>
                    {processes.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.sequence}. {p.processCode} — {p.processName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  협력사
                  <input className="mesInput" value={reqForm.vendorName} onChange={(ev) => setReqForm((f) => ({ ...f, vendorName: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  의뢰수량
                  <input className="mesInput" value={reqForm.requestQty} onChange={(ev) => setReqForm((f) => ({ ...f, requestQty: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={reqForm.status}
                    onChange={(ev) => setReqForm((f) => ({ ...f, status: ev.target.value as (typeof statuses)[number] }))}
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
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeReq}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void saveReq()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeRes} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-out-res-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-out-res-title">
                  입고 실적
                </h2>
                <div className="mesModalMeta muted">선택 외주 ID: {selId ?? '—'}</div>
              </div>
            </div>
            <div className="mesModalBody">
              {selId == null ? <p className="muted">목록에서 외주번호를 먼저 선택하세요.</p> : null}
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  양품
                  <input className="mesInput" value={goodQty} onChange={(ev) => setGoodQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  불량
                  <input className="mesInput" value={defectQty} onChange={(ev) => setDefectQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  입고일
                  <input className="mesInput" type="date" value={inDate} onChange={(ev) => setInDate(ev.target.value)} />
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeRes}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving || selId == null} onClick={() => void addResult()}>
                {saving ? '저장 중…' : '실적 추가'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
