import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../defect-types-page.css'
import {
  DefectTypeFormModal,
  severityBadgeClass,
  type DefectTypeFormState,
} from '../ui/DefectTypeFormModal'

type ProductRef = { id: number; productCode: string; productName: string }

type Row = {
  id: number
  productId: number
  defectCode: string
  defectName: string
  defectCategory: string | null
  severity: string | null
  useYn: 'Y' | 'N'
  product?: ProductRef
}

const PAGE_SIZE = 20

const emptyForm = (): DefectTypeFormState => ({
  productId: '',
  defectCode: '',
  defectName: '',
  defectCategory: '',
  severity: '',
  useYn: 'Y',
})

function productLabel(p?: ProductRef): string {
  return p ? p.productName : '—'
}

function productCode(p?: ProductRef): string {
  return p ? p.productCode : ''
}

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

export function DefectTypesPage() {
  const [items, setItems] = useState<Row[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<DefectTypeFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [draftFilters, setDraftFilters] = useState({ q: '', productId: '', severity: '', useYn: '' })
  const [filters, setFilters] = useState({ q: '', productId: '', severity: '', useYn: '' })

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
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/defect-types')
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

  const filtered = useMemo(() => {
    let rows = [...items]
    if (filters.productId) rows = rows.filter((r) => String(r.productId) === filters.productId)
    if (filters.severity) rows = rows.filter((r) => (r.severity ?? '').toUpperCase() === filters.severity)
    if (filters.useYn) rows = rows.filter((r) => r.useYn === filters.useYn)
    const q = filters.q.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.defectCode} ${r.defectName} ${r.defectCategory ?? ''} ${productLabel(r.product)} ${productCode(r.product)}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows.sort((a, b) => {
      const pc = (a.product?.productCode ?? '').localeCompare(b.product?.productCode ?? '', 'ko')
      if (pc !== 0) return pc
      return a.defectCode.localeCompare(b.defectCode, 'ko')
    })
  }, [items, filters])

  const pages = totalPages(filtered.length, pageSize)
  const safePage = Math.min(Math.max(1, page), pages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

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
      productId: String(r.productId),
      defectCode: r.defectCode,
      defectName: r.defectName,
      defectCategory: r.defectCategory ?? '',
      severity: r.severity ?? '',
      useYn: r.useYn,
    })
    setPanelOpen(true)
  }

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const empty = { q: '', productId: '', severity: '', useYn: '' }
    setDraftFilters(empty)
    setFilters(empty)
    setPage(1)
  }

  const save = async () => {
    const pid = Number(form.productId)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        productId: pid,
        defectCode: form.defectCode.trim(),
        defectName: form.defectName.trim(),
        defectCategory: form.defectCategory.trim() === '' ? null : form.defectCategory.trim(),
        severity: form.severity.trim() === '' ? null : form.severity.trim(),
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/defect-types', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/defect-types/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
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
      await apiJson(`/api/defect-types/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) resetPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const selectedRowId = panelOpen && editingId != null ? editingId : null

  return (
    <div className="mesPage mesPageWide mesDefectTypesPage">
      <header className="mesDtHead">
        <div>
          <h1 className="mesDtTitle">불량 유형</h1>
          <p className="mesDtDesc">품목별 불량 코드·등급을 정의합니다.</p>
        </div>
        <div className="mesDtHeadActions">
          <span className="mesDtCountBadge">{loading ? '…' : `${filtered.length}건`}</span>
          <button type="button" className="mesDtBtn mesDtBtn--primary" onClick={openNew}>
            <IconPlus />
            새 유형
          </button>
          <button type="button" className="mesDtBtn mesDtBtn--secondary" onClick={() => void load()}>
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

      <div className="mesDtFilterCard">
        <div className="mesDtField mesDtField--search">
          <span className="mesDtFieldLabel">검색</span>
          <div className="mesDtInputWrap">
            <span className="mesDtInputIcon"><IconSearch /></span>
            <input
              className="mesDtInput mesDtInput--search"
              placeholder="코드 / 명칭 / 카테고리 / 품목"
              value={draftFilters.q}
              onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
            />
          </div>
        </div>
        <div className="mesDtField mesDtField--select">
          <span className="mesDtFieldLabel">품목</span>
          <select
            className="mesDtSelect"
            value={draftFilters.productId}
            onChange={(e) => setDraftFilters((f) => ({ ...f, productId: e.target.value }))}
          >
            <option value="">전체</option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.productCode} · {p.productName}
              </option>
            ))}
          </select>
        </div>
        <div className="mesDtField mesDtField--select">
          <span className="mesDtFieldLabel">심각도</span>
          <select
            className="mesDtSelect"
            value={draftFilters.severity}
            onChange={(e) => setDraftFilters((f) => ({ ...f, severity: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="LOW">LOW</option>
            <option value="MID">MID</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
        <div className="mesDtField mesDtField--select">
          <span className="mesDtFieldLabel">사용</span>
          <select
            className="mesDtSelect"
            value={draftFilters.useYn}
            onChange={(e) => setDraftFilters((f) => ({ ...f, useYn: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>
        <div className="mesDtFilterActions">
          <button type="button" className="mesDtBtn mesDtBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesDtBtn mesDtBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesDtTableCard">
        <div className="mesDtTableViewport">
          <table className="mesDtTable">
            <thead>
              <tr>
                <th>품목</th>
                <th>코드</th>
                <th>명칭</th>
                <th>카테고리</th>
                <th>심각도</th>
                <th>사용</th>
                <th className="mesDtThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="mesDtEmpty">로딩 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="mesDtEmpty">데이터가 없습니다. <strong>새 유형</strong>으로 추가하세요.</td></tr>
              ) : (
                pageItems.map((r) => (
                  <tr
                    key={r.id}
                    className={selectedRowId === r.id ? 'mesDtRowSelected' : undefined}
                    onClick={() => openEdit(r)}
                  >
                    <td className="mesDtProductCell">
                      {productLabel(r.product)}
                      {r.product ? <span className="mesDtProductCode">{r.product.productCode}</span> : null}
                    </td>
                    <td className="mono">{r.defectCode}</td>
                    <td>{r.defectName}</td>
                    <td>{r.defectCategory ?? '—'}</td>
                    <td>
                      <span className={severityBadgeClass(r.severity)}>{r.severity ?? '—'}</span>
                    </td>
                    <td>
                      <span className={r.useYn === 'Y' ? 'mesDtUseBadge mesDtUseBadge--y' : 'mesDtUseBadge mesDtUseBadge--n'}>
                        {r.useYn}
                      </span>
                    </td>
                    <td className="mesDtTdActions">
                      <div className="mesDtRowActions">
                        <button
                          type="button"
                          className="mesDtActionBtn"
                          onClick={(e) => { e.stopPropagation(); openEdit(r) }}
                        >
                          <IconEdit />
                          수정
                        </button>
                        <button
                          type="button"
                          className="mesDtActionBtn mesDtActionBtn--danger"
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
        <footer className="mesDtPager">
          <span>총 {filtered.length}건</span>
          <nav className="mesDtPagerNav" aria-label="페이지">
            <button type="button" className="mesDtPagerBtn" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
            <button type="button" className="mesDtPagerBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1]
                const ellipsis = prev != null && n - prev > 1
                return (
                  <span key={n} style={{ display: 'contents' }}>
                    {ellipsis ? <span className="mesDtPagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}
                    <button
                      type="button"
                      className={`mesDtPagerBtn${n === safePage ? ' mesDtPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button type="button" className="mesDtPagerBtn" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</button>
            <button type="button" className="mesDtPagerBtn" disabled={safePage >= pages} onClick={() => setPage(pages)}>»</button>
          </nav>
          <select
            className="mesDtSelect"
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

      <DefectTypeFormModal
        open={panelOpen}
        editingId={editingId}
        saving={saving}
        form={form}
        setForm={setForm}
        products={products}
        onSave={() => void save()}
        onClose={resetPanel}
      />
    </div>
  )
}
