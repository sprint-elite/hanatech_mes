import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../locations-page.css'
import {
  LocationFormModal,
  type LocationFormState,
  type LocationType,
  typeBadgeClass,
  typeLabel,
} from '../ui/LocationFormModal'

type Row = {
  id: number
  locationCode: string
  locationName: string
  parentId: number | null
  locationType: string
  useYn: 'Y' | 'N'
  parent?: { id: number; locationCode: string; locationName: string } | null
}

const PAGE_SIZE = 20

const emptyForm = (): LocationFormState => ({
  locationCode: '',
  locationName: '',
  parentId: '',
  locationType: 'WAREHOUSE',
  useYn: 'Y',
})

function totalPages(n: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, n) / pageSize))
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

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

export function LocationsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<LocationFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [draftFilters, setDraftFilters] = useState({ q: '', locationType: '', useYn: '' })
  const [filters, setFilters] = useState({ q: '', locationType: '', useYn: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/locations')
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

  const filtered = useMemo(() => {
    let rows = [...items]
    if (filters.locationType) rows = rows.filter((r) => r.locationType === filters.locationType)
    if (filters.useYn) rows = rows.filter((r) => r.useYn === filters.useYn)
    const q = filters.q.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const parent = r.parent ? `${r.parent.locationCode} ${r.parent.locationName}` : ''
        const hay = `${r.locationCode} ${r.locationName} ${parent}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows.sort((a, b) => a.locationCode.localeCompare(b.locationCode, 'ko'))
  }, [items, filters])

  const pages = totalPages(filtered.length, pageSize)
  const safePage = Math.min(Math.max(1, page), pages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const parentOptions = useMemo(
    () => items.filter((r) => r.id !== editingId).map((r) => ({ id: r.id, locationCode: r.locationCode, locationName: r.locationName })),
    [items, editingId],
  )

  useEffect(() => {
    setPage(1)
  }, [filters])

  const resetPanel = () => {
    setEditingId(null)
    setForm(emptyForm())
    setPanelOpen(false)
  }

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm())
    setPanelOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({
      locationCode: r.locationCode,
      locationName: r.locationName,
      parentId: r.parentId != null ? String(r.parentId) : '',
      locationType: (r.locationType as LocationType) ?? 'WAREHOUSE',
      useYn: r.useYn,
    })
    setPanelOpen(true)
  }

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const empty = { q: '', locationType: '', useYn: '' }
    setDraftFilters(empty)
    setFilters(empty)
    setPage(1)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const parentId = form.parentId.trim() === '' ? null : Number(form.parentId)
      if (form.parentId.trim() !== '' && (!Number.isFinite(parentId) || (parentId as number) < 1)) {
        setErr('상위 위치를 올바르게 선택하세요.')
        setSaving(false)
        return
      }
      const body = {
        locationCode: form.locationCode.trim(),
        locationName: form.locationName.trim(),
        parentId: parentId ?? undefined,
        locationType: form.locationType.trim(),
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/locations', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/locations/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await load()
      resetPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number, ev: MouseEvent) => {
    ev.stopPropagation()
    if (!confirm('삭제할까요?')) return
    setErr(null)
    try {
      await apiJson(`/api/locations/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) resetPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const selectedRowId = panelOpen && editingId != null ? editingId : null

  return (
    <div className="mesPage mesPageWide mesLocationsPage">
      <header className="mesLocHead">
        <div>
          <h1 className="mesLocTitle">창고·위치</h1>
          <p className="mesLocDesc">창고·랙·구역 등 재고 위치를 관리합니다.</p>
        </div>
        <div className="mesLocHeadActions">
          <span className="mesLocCountBadge">{loading ? '…' : `${filtered.length}건`}</span>
          <button type="button" className="mesLocBtn mesLocBtn--primary" onClick={openNew}>
            <IconPlus />
            새 위치
          </button>
          <button type="button" className="mesLocBtn mesLocBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">×</button>
        </div>
      ) : null}

      <div className="mesLocFilterCard">
        <div className="mesLocField mesLocField--search">
          <span className="mesLocFieldLabel">검색</span>
          <div className="mesLocInputWrap">
            <span className="mesLocInputIcon"><IconSearch /></span>
            <input
              className="mesLocInput mesLocInput--search"
              placeholder="코드 / 명칭 / 상위"
              value={draftFilters.q}
              onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
            />
          </div>
        </div>
        <div className="mesLocField mesLocField--select">
          <span className="mesLocFieldLabel">유형</span>
          <select
            className="mesLocSelect"
            value={draftFilters.locationType}
            onChange={(e) => setDraftFilters((f) => ({ ...f, locationType: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="WAREHOUSE">창고</option>
            <option value="RACK">랙</option>
            <option value="ZONE">구역</option>
          </select>
        </div>
        <div className="mesLocField mesLocField--select">
          <span className="mesLocFieldLabel">사용</span>
          <select
            className="mesLocSelect"
            value={draftFilters.useYn}
            onChange={(e) => setDraftFilters((f) => ({ ...f, useYn: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>
        <div className="mesLocFilterActions">
          <button type="button" className="mesLocBtn mesLocBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesLocBtn mesLocBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesLocTableCard">
        <div className="mesLocTableViewport">
          <table className="mesLocTable">
            <thead>
              <tr>
                <th>코드</th>
                <th>명칭</th>
                <th>유형</th>
                <th>상위</th>
                <th>사용</th>
                <th className="mesLocThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="mesLocEmpty">로딩 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="mesLocEmpty">데이터가 없습니다. <strong>새 위치</strong>로 추가하세요.</td></tr>
              ) : (
                pageItems.map((r) => (
                  <tr
                    key={r.id}
                    className={selectedRowId === r.id ? 'mesLocRowSelected' : undefined}
                    onClick={() => openEdit(r)}
                  >
                    <td className="mono">{r.locationCode}</td>
                    <td>{r.locationName}</td>
                    <td>
                      <span className={typeBadgeClass(r.locationType)}>{typeLabel(r.locationType as LocationType)}</span>
                    </td>
                    <td>{r.parent ? `${r.parent.locationCode} · ${r.parent.locationName}` : '—'}</td>
                    <td>
                      <span className={r.useYn === 'Y' ? 'mesLocUseBadge mesLocUseBadge--y' : 'mesLocUseBadge mesLocUseBadge--n'}>
                        {r.useYn}
                      </span>
                    </td>
                    <td className="mesLocTdActions">
                      <div className="mesLocRowActions">
                        <button type="button" className="mesLocActionBtn" onClick={(e) => { e.stopPropagation(); openEdit(r) }}>
                          <IconEdit />
                          수정
                        </button>
                        <button type="button" className="mesLocActionBtn mesLocActionBtn--danger" onClick={(e) => void remove(r.id, e)}>
                          <IconTrash />
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="mesLocPager">
          <span>총 {filtered.length}건</span>
          <nav className="mesLocPagerNav" aria-label="페이지">
            <button type="button" className="mesLocPagerBtn" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
            <button type="button" className="mesLocPagerBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1]
                const ellipsis = prev != null && n - prev > 1
                return (
                  <span key={n} style={{ display: 'contents' }}>
                    {ellipsis ? <span className="mesLocPagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}
                    <button
                      type="button"
                      className={`mesLocPagerBtn${n === safePage ? ' mesLocPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button type="button" className="mesLocPagerBtn" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</button>
            <button type="button" className="mesLocPagerBtn" disabled={safePage >= pages} onClick={() => setPage(pages)}>»</button>
          </nav>
          <select
            className="mesLocSelect"
            style={{ width: 'auto', minWidth: '120px' }}
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            aria-label="페이지당 표시 건수"
          >
            <option value={10}>10개씩 보기</option>
            <option value={20}>20개씩 보기</option>
            <option value={50}>50개씩 보기</option>
          </select>
        </footer>
      </div>

      <LocationFormModal
        open={panelOpen}
        editingId={editingId}
        saving={saving}
        form={form}
        setForm={setForm}
        parentOptions={parentOptions}
        onSave={() => void save()}
        onClose={resetPanel}
      />
    </div>
  )
}
