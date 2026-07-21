import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../barcodes-page.css'

type Row = {
  id: number
  barcodeValue: string
  barcodeType: string
  refTable: string
  refId: number
  isPrimary: string
  status: string
}

type Filters = { q: string; type: string; status: string }

const types = ['PRODUCT', 'LOT', 'MATERIAL_LOT', 'LOCATION', 'WO'] as const
const statuses = ['ACTIVE', 'DISABLED'] as const
const yn = ['Y', 'N'] as const

const emptyFilters = (): Filters => ({ q: '', type: '', status: '' })

const statusLabel = (s: string) => {
  if (s === 'ACTIVE') return '사용'
  if (s === 'DISABLED') return '비활성'
  return s
}

const typeLabel = (t: string) => {
  if (t === 'PRODUCT') return '품목'
  if (t === 'LOT') return 'LOT'
  if (t === 'MATERIAL_LOT') return '자재LOT'
  if (t === 'LOCATION') return '위치'
  if (t === 'WO') return '작업지시'
  return t
}

function statusBadgeClass(s: string): string {
  if (s === 'ACTIVE') return 'mesBcStatusBadge mesBcStatusBadge--active'
  if (s === 'DISABLED') return 'mesBcStatusBadge mesBcStatusBadge--disabled'
  return 'mesBcStatusBadge'
}

function matchesFilters(row: Row, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const hay = [row.barcodeValue, row.refTable, String(row.refId)].join(' ').toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filters.type && row.barcodeType !== filters.type) return false
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

function IconBarcode() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7V4h2v3M4 17v3h2v-3M18 7V4h2v3M18 17v3h-2v-3" />
      <path d="M8 7v10M11 7v10M14 7v10M17 7v10" />
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

function IconBan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m4.5 4.5 15 15" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  )
}

export function BarcodesPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [barcodeValue, setBarcodeValue] = useState('')
  const [barcodeType, setBarcodeType] = useState<(typeof types)[number]>('PRODUCT')
  const [refTable, setRefTable] = useState('products')
  const [refId, setRefId] = useState('')
  const [isPrimary, setIsPrimary] = useState<(typeof yn)[number]>('N')
  const [status, setStatus] = useState<(typeof statuses)[number]>('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/barcodes')
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
    let active = 0
    let disabled = 0
    let primary = 0
    for (const row of filteredItems) {
      if (row.status === 'ACTIVE') active += 1
      else if (row.status === 'DISABLED') disabled += 1
      if (row.isPrimary === 'Y') primary += 1
    }
    return { total: filteredItems.length, active, disabled, primary }
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

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setEditingId(null)
    setBarcodeValue('')
    setBarcodeType('PRODUCT')
    setRefTable('products')
    setRefId('')
    setIsPrimary('N')
    setStatus('ACTIVE')
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  const openNew = () => {
    setEditingId(null)
    setBarcodeValue('')
    setBarcodeType('PRODUCT')
    setRefTable('products')
    setRefId('')
    setIsPrimary('N')
    setStatus('ACTIVE')
    setPanelOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setBarcodeValue(r.barcodeValue)
    setBarcodeType((types.includes(r.barcodeType as (typeof types)[number]) ? r.barcodeType : 'PRODUCT') as (typeof types)[number])
    setRefTable(r.refTable)
    setRefId(String(r.refId))
    setIsPrimary(r.isPrimary === 'Y' ? 'Y' : 'N')
    setStatus((statuses.includes(r.status as (typeof statuses)[number]) ? r.status : 'ACTIVE') as (typeof statuses)[number])
    setPanelOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const rid = Number(refId)
      if (!barcodeValue.trim() || !Number.isFinite(rid)) {
        setErr('바코드·참조 ID는 필수입니다.')
        setSaving(false)
        return
      }
      if (editingId == null) {
        await apiJson('/api/barcodes', {
          method: 'POST',
          body: JSON.stringify({
            barcodeValue: barcodeValue.trim(),
            barcodeType,
            refTable: refTable.trim(),
            refId: rid,
            isPrimary,
            status,
          }),
        })
      } else {
        await apiJson(`/api/barcodes/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            barcodeValue: barcodeValue.trim(),
            barcodeType,
            refTable: refTable.trim(),
            refId: rid,
            isPrimary,
            status,
          }),
        })
      }
      await load()
      closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number, ev: MouseEvent) => {
    ev.stopPropagation()
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/barcodes/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const modalTitle = editingId == null ? '신규 등록' : '수정'
  const selectedRowId = panelOpen && editingId != null ? editingId : null

  return (
    <div className="mesPage mesPageWide mesBcPage">
      <header className="mesBcHead">
        <div className="mesBcHeadMain">
          <h1 className="mesBcTitle">바코드</h1>
          <p className="mesBcDesc">엔티티(품목·LOT 등)와 연결된 바코드 레코드를 등록합니다. 상단 숫자는 필터 적용 후 목록 기준입니다.</p>
        </div>
        <div className="mesBcHeadActions">
          <span className="mesBcCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesBcBtn mesBcBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesBcBtn mesBcBtn--primary" onClick={openNew}>
            <IconPlus />
            새 바코드
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesBcNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesBcFilterCard">
        <div className="mesBcField mesBcField--search">
          <span className="mesBcFieldLabel">검색</span>
          <div className="mesBcInputWrap">
            <span className="mesBcInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesBcInput mesBcInput--search"
              placeholder="바코드 / 참조 테이블 / 참조 ID 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesBcField mesBcField--select">
          <span className="mesBcFieldLabel">유형</span>
          <select
            className="mesBcSelect"
            value={draftFilters.type}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, type: ev.target.value }))}
            aria-label="유형 필터"
          >
            <option value="">유형(전체)</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="mesBcField mesBcField--select">
          <span className="mesBcFieldLabel">상태</span>
          <select
            className="mesBcSelect"
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
        <div className="mesBcFilterActions">
          <button type="button" className="mesBcBtn mesBcBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesBcBtn mesBcBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesBcStatsStrip" aria-label="바코드 요약">
        <div className="mesBcStatItem">
          <div className="mesBcStatIcon mesBcStatIcon--gold">
            <IconBarcode />
          </div>
          <div className="mesBcStatMeta">
            <p className="mesBcStatLabel">전체</p>
            <p className="mesBcStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesBcStatValueNum">{stats.total}</span>
                  <span className="mesBcStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesBcStatItem">
          <div className="mesBcStatIcon mesBcStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesBcStatMeta">
            <p className="mesBcStatLabel">사용</p>
            <p className="mesBcStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesBcStatValueNum">{stats.active}</span>
                  <span className="mesBcStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesBcStatItem">
          <div className="mesBcStatIcon mesBcStatIcon--orange">
            <IconBan />
          </div>
          <div className="mesBcStatMeta">
            <p className="mesBcStatLabel">비활성</p>
            <p className="mesBcStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesBcStatValueNum">{stats.disabled}</span>
                  <span className="mesBcStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesBcStatItem">
          <div className="mesBcStatIcon mesBcStatIcon--purple">
            <IconStar />
          </div>
          <div className="mesBcStatMeta">
            <p className="mesBcStatLabel">주바코드</p>
            <p className="mesBcStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesBcStatValueNum">{stats.primary}</span>
                  <span className="mesBcStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-bc-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-bc-modal-title">
                  {modalTitle}
                </h2>
                {editingId != null ? <div className="mesModalMeta muted">ID {editingId}</div> : null}
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  바코드 값
                  <input className="mesInput mono" value={barcodeValue} onChange={(ev) => setBarcodeValue(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  유형
                  <select
                    className="mesInput"
                    value={barcodeType}
                    onChange={(ev) => setBarcodeType(ev.target.value as (typeof types)[number])}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {typeLabel(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  주 바코드
                  <select className="mesInput" value={isPrimary} onChange={(ev) => setIsPrimary(ev.target.value as (typeof yn)[number])}>
                    {yn.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  참조 테이블
                  <input className="mesInput mono" value={refTable} onChange={(ev) => setRefTable(ev.target.value)} placeholder="예: products" />
                </label>
                <label className="mesLabel">
                  참조 ID
                  <input className="mesInput mono" value={refId} onChange={(ev) => setRefId(ev.target.value)} />
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

      <div className="mesBcTableCard">
        <div className="mesBcTableViewport">
          <table className="mesBcTable">
            <colgroup>
              <col className="mesBcColBarcode" />
              <col className="mesBcColType" />
              <col className="mesBcColRef" />
              <col className="mesBcColPrimary" />
              <col className="mesBcColStatus" />
              <col className="mesBcColActions" />
            </colgroup>
            <thead>
              <tr>
                <th className="mesBcColBarcode">바코드</th>
                <th className="mesBcColType">유형</th>
                <th className="mesBcColRef">참조</th>
                <th className="mesBcColPrimary">대표</th>
                <th className="mesBcColStatus">상태</th>
                <th className="mesBcThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="mesBcEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mesBcEmpty">
                    {items.length === 0 ? (
                      <>
                        데이터가 없습니다. <strong>새 바코드</strong>로 추가하세요.
                      </>
                    ) : (
                      '필터 조건에 맞는 바코드가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr
                    key={r.id}
                    className={selectedRowId === r.id ? 'mesBcRowSelected' : undefined}
                    onClick={() => openEdit(r)}
                  >
                    <td className="mesBcColBarcode mono" title={r.barcodeValue}>
                      {r.barcodeValue}
                    </td>
                    <td className="mesBcColType">{typeLabel(r.barcodeType)}</td>
                    <td className="mesBcColRef mono" title={`${r.refTable}#${r.refId}`}>
                      {r.refTable}#{r.refId}
                    </td>
                    <td className="mesBcColPrimary">
                      {r.isPrimary === 'Y' ? <span className="mesBcPrimaryBadge">주</span> : '—'}
                    </td>
                    <td className="mesBcColStatus">
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    </td>
                    <td className="mesBcTdActions">
                      <button
                        type="button"
                        className="mesBcBtn mesBcBtn--danger"
                        aria-label="삭제"
                        onClick={(ev) => void remove(r.id, ev)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesBcPager">
          <span className="mesBcPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesBcPagerNav" aria-label="페이지">
            <button type="button" className="mesBcPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesBcPagerBtn"
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
                      <span className="mesBcPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesBcPagerBtn${n === page ? ' mesBcPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesBcPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesBcPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesBcPageSize">
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
