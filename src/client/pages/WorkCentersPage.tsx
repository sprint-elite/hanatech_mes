import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../work-centers-page.css'
import {
  WorkCenterFormModal,
  type WorkCenterFormState,
  typeBadgeClass,
  typeLabel,
} from '../ui/WorkCenterFormModal'

type Row = {
  id: number
  centerCode: string
  centerName: string
  centerType: string
  parentId: number | null
  location: string | null
  capacityPerHour: number | null
  useYn: 'Y' | 'N'
  createdAt: string
  parent?: { id: number; centerCode: string; centerName: string } | null
}

const PAGE_SIZE = 20

const emptyForm = (): WorkCenterFormState => ({
  centerCode: '',
  centerName: '',
  centerType: 'LINE',
  parentId: '',
  location: '',
  capacityPerHour: '',
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

export function WorkCentersPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<WorkCenterFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [draftFilters, setDraftFilters] = useState({ q: '', centerType: '', useYn: '' })
  const [filters, setFilters] = useState({ q: '', centerType: '', useYn: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/work-centers')
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
    if (filters.centerType) rows = rows.filter((r) => r.centerType === filters.centerType)
    if (filters.useYn) rows = rows.filter((r) => r.useYn === filters.useYn)
    const q = filters.q.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const parent = r.parent ? `${r.parent.centerCode} ${r.parent.centerName}` : ''
        const hay = `${r.centerCode} ${r.centerName} ${r.location ?? ''} ${parent}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows.sort((a, b) => a.centerCode.localeCompare(b.centerCode, 'ko'))
  }, [items, filters])

  const pages = totalPages(filtered.length, pageSize)
  const safePage = Math.min(Math.max(1, page), pages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const parentOptions = useMemo(
    () => items.filter((r) => r.id !== editingId).map((r) => ({ id: r.id, centerCode: r.centerCode, centerName: r.centerName })),
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
      centerCode: r.centerCode,
      centerName: r.centerName,
      centerType: (r.centerType as WorkCenterFormState['centerType']) ?? 'LINE',
      parentId: r.parentId != null ? String(r.parentId) : '',
      location: r.location ?? '',
      capacityPerHour: r.capacityPerHour != null ? String(r.capacityPerHour) : '',
      useYn: r.useYn,
    })
    setPanelOpen(true)
  }

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const empty = { q: '', centerType: '', useYn: '' }
    setDraftFilters(empty)
    setFilters(empty)
    setPage(1)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const parentId = form.parentId.trim() === '' ? null : Number(form.parentId.trim())
      if (form.parentId.trim() !== '' && (!Number.isFinite(parentId) || (parentId as number) < 1)) {
        setErr('상위 작업장을 올바르게 선택하세요.')
        setSaving(false)
        return
      }
      const cap = form.capacityPerHour.trim() === '' ? null : Number(form.capacityPerHour.trim())
      if (form.capacityPerHour.trim() !== '' && (!Number.isFinite(cap) || (cap as number) < 0)) {
        setErr('시간당 생산능력은 빈 값 또는 0 이상의 숫자여야 합니다.')
        setSaving(false)
        return
      }
      const body = {
        centerCode: form.centerCode.trim(),
        centerName: form.centerName.trim(),
        centerType: form.centerType.trim(),
        parentId: parentId ?? undefined,
        location: form.location.trim() === '' ? null : form.location.trim(),
        capacityPerHour: cap ?? undefined,
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/work-centers', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/work-centers/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
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
      await apiJson(`/api/work-centers/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) resetPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const selectedRowId = panelOpen && editingId != null ? editingId : null

  return (
    <div className="mesPage mesPageWide mesWorkCentersPage">
      <header className="mesWcHead">
        <div>
          <h1 className="mesWcTitle">작업장</h1>
          <p className="mesWcDesc">라인·설비·외주 단위 작업장 코드를 관리합니다.</p>
        </div>
        <div className="mesWcHeadActions">
          <span className="mesWcCountBadge">{loading ? '…' : `${filtered.length}건`}</span>
          <button type="button" className="mesWcBtn mesWcBtn--primary" onClick={openNew}>
            <IconPlus />
            새 작업장
          </button>
          <button type="button" className="mesWcBtn mesWcBtn--secondary" onClick={() => void load()}>
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

      <div className="mesWcFilterCard">
        <div className="mesWcField mesWcField--search">
          <span className="mesWcFieldLabel">검색</span>
          <div className="mesWcInputWrap">
            <span className="mesWcInputIcon"><IconSearch /></span>
            <input
              className="mesWcInput mesWcInput--search"
              placeholder="코드 / 명칭 / 위치 / 상위"
              value={draftFilters.q}
              onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
            />
          </div>
        </div>
        <div className="mesWcField mesWcField--select">
          <span className="mesWcFieldLabel">유형</span>
          <select
            className="mesWcSelect"
            value={draftFilters.centerType}
            onChange={(e) => setDraftFilters((f) => ({ ...f, centerType: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="LINE">LINE (라인)</option>
            <option value="EQUIPMENT">EQUIPMENT (설비)</option>
            <option value="OUTSOURCE">OUTSOURCE (외주)</option>
          </select>
        </div>
        <div className="mesWcField mesWcField--select">
          <span className="mesWcFieldLabel">사용</span>
          <select
            className="mesWcSelect"
            value={draftFilters.useYn}
            onChange={(e) => setDraftFilters((f) => ({ ...f, useYn: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>
        <div className="mesWcFilterActions">
          <button type="button" className="mesWcBtn mesWcBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesWcBtn mesWcBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesWcTableCard">
        <div className="mesWcTableViewport">
          <table className="mesWcTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>코드</th>
                <th>명칭</th>
                <th>유형</th>
                <th>상위</th>
                <th>위치</th>
                <th>시간당 생산능력</th>
                <th>사용</th>
                <th className="mesWcThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="mesWcEmpty">로딩 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="mesWcEmpty">데이터가 없습니다. <strong>새 작업장</strong>으로 추가하세요.</td></tr>
              ) : (
                pageItems.map((r) => (
                  <tr
                    key={r.id}
                    className={selectedRowId === r.id ? 'mesWcRowSelected' : undefined}
                    onClick={() => openEdit(r)}
                  >
                    <td className="mono">{r.id}</td>
                    <td className="mono">{r.centerCode}</td>
                    <td>{r.centerName}</td>
                    <td>
                      <span className={typeBadgeClass(r.centerType)}>{typeLabel(r.centerType as WorkCenterFormState['centerType'])}</span>
                    </td>
                    <td>{r.parent ? `${r.parent.centerCode} · ${r.parent.centerName}` : '—'}</td>
                    <td>{r.location ?? '—'}</td>
                    <td className="mono">{r.capacityPerHour ?? '—'}</td>
                    <td>
                      <span className={r.useYn === 'Y' ? 'mesWcUseBadge mesWcUseBadge--y' : 'mesWcUseBadge mesWcUseBadge--n'}>
                        {r.useYn}
                      </span>
                    </td>
                    <td className="mesWcTdActions">
                      <div className="mesWcRowActions">
                        <button
                          type="button"
                          className="mesWcActionBtn"
                          onClick={(e) => { e.stopPropagation(); openEdit(r) }}
                        >
                          <IconEdit />
                          수정
                        </button>
                        <button
                          type="button"
                          className="mesWcActionBtn mesWcActionBtn--danger"
                          onClick={(e) => void remove(r.id, e)}
                        >
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
        <footer className="mesWcPager">
          <span>총 {filtered.length}건</span>
          <nav className="mesWcPagerNav" aria-label="페이지">
            <button type="button" className="mesWcPagerBtn" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
            <button type="button" className="mesWcPagerBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1]
                const ellipsis = prev != null && n - prev > 1
                return (
                  <span key={n} style={{ display: 'contents' }}>
                    {ellipsis ? <span className="mesWcPagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}
                    <button
                      type="button"
                      className={`mesWcPagerBtn${n === safePage ? ' mesWcPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button type="button" className="mesWcPagerBtn" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</button>
            <button type="button" className="mesWcPagerBtn" disabled={safePage >= pages} onClick={() => setPage(pages)}>»</button>
          </nav>
          <select
            className="mesWcSelect"
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

      <WorkCenterFormModal
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
