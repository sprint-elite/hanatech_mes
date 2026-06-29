import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../customers-page.css'
import {
  CustomerFormModal,
  type CustomerFormState,
  type CustomerType,
  typeBadgeClass,
} from '../ui/CustomerFormModal'

type Row = {
  id: number
  customerCode: string
  customerName: string
  type: CustomerType
  useYn: 'Y' | 'N'
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  remark: string | null
  createdAt: string
}

const PAGE_SIZE = 20

const emptyForm = (): CustomerFormState => ({
  customerCode: '',
  customerName: '',
  type: 'CUSTOMER',
  useYn: 'Y',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  remark: '',
})

function typeLabel(t: CustomerType) {
  if (t === 'CUSTOMER') return '고객사'
  if (t === 'SUPPLIER') return '공급업체'
  return '외주업체'
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

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M22 20a5 5 0 0 0-6-4" />
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

function totalPages(n: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, n) / pageSize))
}

export function CustomersPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<CustomerFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [draftFilters, setDraftFilters] = useState({ q: '', type: '', useYn: '' })
  const [filters, setFilters] = useState({ q: '', type: '', useYn: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/customers')
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
    if (filters.type) rows = rows.filter((r) => r.type === filters.type)
    if (filters.useYn) rows = rows.filter((r) => r.useYn === filters.useYn)
    const q = filters.q.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.customerCode} ${r.customerName} ${r.contactName ?? ''} ${r.phone ?? ''} ${r.email ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows.sort((a, b) => a.customerCode.localeCompare(b.customerCode, 'ko'))
  }, [items, filters])

  const stats = useMemo(() => ({
    total: items.length,
    customer: items.filter((r) => r.type === 'CUSTOMER').length,
    supplier: items.filter((r) => r.type === 'SUPPLIER').length,
    outsourcing: items.filter((r) => r.type === 'OUTSOURCING').length,
    active: items.filter((r) => r.useYn === 'Y').length,
  }), [items])

  const pages = totalPages(filtered.length, pageSize)
  const safePage = Math.min(Math.max(1, page), pages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  useEffect(() => {
    setPage(1)
  }, [filters])

  const reset = () => {
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
      customerCode: r.customerCode,
      customerName: r.customerName,
      type: r.type,
      useYn: r.useYn,
      contactName: r.contactName ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      address: r.address ?? '',
      remark: r.remark ?? '',
    })
    setPanelOpen(true)
  }

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const empty = { q: '', type: '', useYn: '' }
    setDraftFilters(empty)
    setFilters(empty)
    setPage(1)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const body = {
        customerCode: form.customerCode.trim(),
        customerName: form.customerName.trim(),
        type: form.type,
        useYn: form.useYn,
        contactName: form.contactName.trim() === '' ? null : form.contactName.trim(),
        phone: form.phone.trim() === '' ? null : form.phone.trim(),
        email: form.email.trim() === '' ? null : form.email.trim(),
        address: form.address.trim() === '' ? null : form.address.trim(),
        remark: form.remark.trim() === '' ? null : form.remark.trim(),
      }
      if (!body.customerCode || !body.customerName) {
        setErr('코드/명칭은 필수입니다.')
        setSaving(false)
        return
      }
      if (editingId == null) {
        await apiJson('/api/customers', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/customers/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await load()
      reset()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number, ev: MouseEvent) => {
    ev.stopPropagation()
    if (!confirm('삭제할까요? 품목의 기본업체로 연결된 경우 삭제가 실패할 수 있습니다.')) return
    setErr(null)
    try {
      await apiJson(`/api/customers/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) reset()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const selectedRowId = panelOpen && editingId != null ? editingId : null

  return (
    <div className="mesPage mesPageWide mesCustomersPage">
      <header className="mesCustHead">
        <div className="mesCustHeadMain">
          <h1 className="mesCustTitle">고객/업체</h1>
          <p className="mesCustDesc">고객사(발주처)·공급업체(구매처)·외주업체 기준정보를 통합 관리합니다.</p>
        </div>
        <div className="mesCustHeadActions">
          <span className="mesCustCountBadge">{loading ? '…' : `${filtered.length}건`}</span>
          <button type="button" className="mesCustBtn mesCustBtn--primary" onClick={openNew}>
            <IconPlus />
            신규 등록
          </button>
          <button type="button" className="mesCustBtn mesCustBtn--secondary" onClick={() => void load()}>
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

      <div className="mesCustFilterCard">
        <div className="mesCustField mesCustField--search">
          <span className="mesCustFieldLabel">검색</span>
          <div className="mesCustInputWrap">
            <span className="mesCustInputIcon"><IconSearch /></span>
            <input
              className="mesCustInput mesCustInput--search"
              placeholder="코드 / 명칭 / 담당자 / 전화 / 이메일"
              value={draftFilters.q}
              onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
            />
          </div>
        </div>
        <div className="mesCustField mesCustField--select">
          <span className="mesCustFieldLabel">구분</span>
          <select
            className="mesCustSelect"
            value={draftFilters.type}
            onChange={(e) => setDraftFilters((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="CUSTOMER">고객사</option>
            <option value="SUPPLIER">공급업체</option>
            <option value="OUTSOURCING">외주업체</option>
          </select>
        </div>
        <div className="mesCustField mesCustField--select">
          <span className="mesCustFieldLabel">사용</span>
          <select
            className="mesCustSelect"
            value={draftFilters.useYn}
            onChange={(e) => setDraftFilters((f) => ({ ...f, useYn: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>
        <div className="mesCustFilterActions">
          <button type="button" className="mesCustBtn mesCustBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesCustBtn mesCustBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesCustStatsStrip" aria-label="거래처 요약">
        <div className="mesCustStatItem">
          <div className="mesCustStatIcon mesCustStatIcon--gold"><IconUsers /></div>
          <div>
            <p className="mesCustStatLabel">전체</p>
            <p className="mesCustStatValue">{loading ? '…' : stats.total}</p>
          </div>
        </div>
        <div className="mesCustStatItem">
          <div className="mesCustStatIcon mesCustStatIcon--blue"><IconUsers /></div>
          <div>
            <p className="mesCustStatLabel">고객사</p>
            <p className="mesCustStatValue">{loading ? '…' : stats.customer}</p>
          </div>
        </div>
        <div className="mesCustStatItem">
          <div className="mesCustStatIcon mesCustStatIcon--green"><IconUsers /></div>
          <div>
            <p className="mesCustStatLabel">공급업체</p>
            <p className="mesCustStatValue">{loading ? '…' : stats.supplier}</p>
          </div>
        </div>
        <div className="mesCustStatItem">
          <div className="mesCustStatIcon mesCustStatIcon--purple"><IconUsers /></div>
          <div>
            <p className="mesCustStatLabel">외주업체</p>
            <p className="mesCustStatValue">{loading ? '…' : stats.outsourcing}</p>
          </div>
        </div>
        <div className="mesCustStatItem">
          <div className="mesCustStatIcon mesCustStatIcon--green"><IconUsers /></div>
          <div>
            <p className="mesCustStatLabel">사용중</p>
            <p className="mesCustStatValue">{loading ? '…' : stats.active}</p>
          </div>
        </div>
      </div>

      <div className="mesCustTableCard">
        <div className="mesCustTableViewport">
          <table className="mesCustTable">
            <thead>
              <tr>
                <th>코드</th>
                <th>명칭</th>
                <th>구분</th>
                <th>담당자</th>
                <th>전화</th>
                <th>이메일</th>
                <th>사용</th>
                <th className="mesCustThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="mesCustEmpty">로딩 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="mesCustEmpty">데이터가 없습니다. <strong>신규 등록</strong>으로 추가하세요.</td></tr>
              ) : (
                pageItems.map((r) => (
                  <tr
                    key={r.id}
                    className={selectedRowId === r.id ? 'mesCustRowSelected' : undefined}
                    onClick={() => openEdit(r)}
                  >
                    <td className="mono">{r.customerCode}</td>
                    <td>{r.customerName}</td>
                    <td><span className={typeBadgeClass(r.type)}>{typeLabel(r.type)}</span></td>
                    <td>{r.contactName ?? '—'}</td>
                    <td className="mono">{r.phone ?? '—'}</td>
                    <td>{r.email ?? '—'}</td>
                    <td>
                      <span className={r.useYn === 'Y' ? 'mesCustUseBadge mesCustUseBadge--y' : 'mesCustUseBadge mesCustUseBadge--n'}>
                        {r.useYn}
                      </span>
                    </td>
                    <td className="mesCustTdActions">
                      <div className="mesCustRowActions">
                        <button
                          type="button"
                          className="mesCustActionBtn"
                          onClick={(e) => { e.stopPropagation(); openEdit(r) }}
                        >
                          <IconEdit />
                          수정
                        </button>
                        <button
                          type="button"
                          className="mesCustActionBtn mesCustActionBtn--danger"
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
        <footer className="mesCustPager">
          <span>총 {filtered.length}건</span>
          <nav className="mesCustPagerNav" aria-label="페이지">
            <button type="button" className="mesCustPagerBtn" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
            <button type="button" className="mesCustPagerBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1]
                const ellipsis = prev != null && n - prev > 1
                return (
                  <span key={n} style={{ display: 'contents' }}>
                    {ellipsis ? <span className="mesCustPagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}
                    <button
                      type="button"
                      className={`mesCustPagerBtn${n === safePage ? ' mesCustPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button type="button" className="mesCustPagerBtn" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</button>
            <button type="button" className="mesCustPagerBtn" disabled={safePage >= pages} onClick={() => setPage(pages)}>»</button>
          </nav>
          <select
            className="mesCustSelect"
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

      <CustomerFormModal
        open={panelOpen}
        editingId={editingId}
        saving={saving}
        form={form}
        setForm={setForm}
        onSave={() => void save()}
        onClose={reset}
      />
    </div>
  )
}
