import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../lots-page.css'

type Product = { id: number; productCode: string; productName: string }

type WorkOrderRef = {
  id: number
  woNo: string
  planId: number | null
  productId: number
  orderQty: number
  product?: { productCode: string; productName: string }
  plan?: { planNo: string } | null
  assignedWorkers?: { worker: { workerCode: string; workerName: string } }[]
}

type LotStatus = 'CREATED' | 'IN_PROGRESS' | 'DONE' | 'OUTSOURCING'

type Row = {
  id: number
  lotNo: string
  barcode: string | null
  woId: number | null
  productId: number
  lotQty: number
  goodQty: number
  defectQty: number
  status: LotStatus
  createdAt: string
  product: { productCode: string; productName: string }
  workOrder: {
    id: number
    woNo: string
    orderQty: number
    plan: { id: number; planNo: string } | null
    product: { productCode: string; productName: string }
    assignedWorkers?: { worker: { workerCode: string; workerName: string } }[]
  } | null
}

type FormState = {
  woId: string
  lotNo: string
  productId: string
  lotQty: string
  status: LotStatus
}

type Filters = { q: string; status: string; productId: string }

const statuses: LotStatus[] = ['CREATED', 'IN_PROGRESS', 'DONE', 'OUTSOURCING']

const emptyFilters = (): Filters => ({ q: '', status: '', productId: '' })

const lotStatusLabel = (s: string) => {
  if (s === 'CREATED') return '생성'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'OUTSOURCING') return '외주'
  return s
}

function lotStatusBadgeClass(s: string): string {
  if (s === 'CREATED') return 'mesLotStatusBadge mesLotStatusBadge--created'
  if (s === 'IN_PROGRESS') return 'mesLotStatusBadge mesLotStatusBadge--progress'
  if (s === 'DONE') return 'mesLotStatusBadge mesLotStatusBadge--done'
  if (s === 'OUTSOURCING') return 'mesLotStatusBadge mesLotStatusBadge--outsource'
  return 'mesLotStatusBadge'
}

function matchesFilters(row: Row, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const hay = [
      row.lotNo,
      row.barcode ?? '',
      row.product.productCode,
      row.product.productName,
      row.workOrder?.woNo ?? '',
      row.workOrder?.plan?.planNo ?? '',
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filters.status && row.status !== filters.status) return false
  return true
}

const empty = (): FormState => ({
  woId: '',
  lotNo: '',
  productId: '',
  lotQty: '',
  status: 'CREATED',
})

function workersLabel(wo: WorkOrderRef | Row['workOrder'] | null | undefined): string {
  if (wo == null) return '—'
  const list = wo.assignedWorkers
  if (!list?.length) return '배정 없음'
  return list.map((a) => a.worker.workerName || a.worker.workerCode).join(', ')
}

function woOptionLabel(wo: WorkOrderRef) {
  const pc = wo.product?.productCode ?? ''
  const pn = wo.product?.productName ?? ''
  const prod = pc && pn ? `${pc} · ${pn}` : `품목#${wo.productId}`
  const plan = wo.plan?.planNo ? ` · 계획 ${wo.plan.planNo}` : ''
  return `${wo.woNo} — ${prod} (${wo.orderQty})${plan}`
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

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
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

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4V8Z" fill="currentColor" stroke="none" />
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

function IconOutsource() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  )
}

function LotBarcodePreviewImage({ lotId, alt }: { lotId: number; alt: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  return (
    <img
      src={`/api/lots/${lotId}/barcode-image?view=screen`}
      alt={alt}
      className="mesBarcodePreviewImg"
      width={size?.w}
      height={size?.h}
      onLoad={(ev) => {
        const img = ev.currentTarget
        setSize({ w: img.naturalWidth, h: img.naturalHeight })
      }}
    />
  )
}

function IconPrint() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  )
}

function printLotBarcode(lotId: number, label: string) {
  const url = `/api/lots/${lotId}/barcode-image?view=print`
  const safeLabel = label.replace(/[<>&"']/g, '')
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument ?? win?.document
  if (!doc || !win) {
    iframe.remove()
    return
  }

  const cleanup = () => {
    iframe.remove()
  }

  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8" /><title>LOT 바코드 ${safeLabel}</title>
<style>
  @page { margin: 10mm; size: auto; }
  body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
  img { display: block; max-width: 100%; height: auto; }
  .label { margin-top: 3mm; font: 11pt monospace; text-align: center; letter-spacing: 0.06em; }
</style></head>
<body>
  <img id="bc" src="${url}" alt="${safeLabel}" />
  <div class="label">${safeLabel}</div>
</body></html>`)
  doc.close()

  const img = doc.getElementById('bc') as HTMLImageElement | null
  const triggerPrint = () => {
    win.focus()
    win.print()
  }

  win.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(cleanup, 120_000)

  if (!img) {
    triggerPrint()
    return
  }
  if (img.complete) {
    setTimeout(triggerPrint, 150)
    return
  }
  img.addEventListener('load', () => setTimeout(triggerPrint, 150), { once: true })
  img.addEventListener('error', cleanup, { once: true })
}

function normalizeScannedLotToken(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  const first = v.split(/[\s,\t|]+/)[0] ?? ''
  return first.trim()
}

export function LotsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRef[]>([])
  const [items, setItems] = useState<Row[]>([])
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const scanRef = useRef<HTMLInputElement | null>(null)
  const [scanValue, setScanValue] = useState<string>('')
  const [scanHitId, setScanHitId] = useState<number | null>(null)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [barcodePreview, setBarcodePreview] = useState<Row | null>(null)

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setEditingId(null)
    setForm(empty())
  }, [])

  const closeBarcodePreview = useCallback(() => {
    setBarcodePreview(null)
  }, [])

  useEffect(() => {
    scanRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  useEffect(() => {
    if (!barcodePreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBarcodePreview()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [barcodePreview, closeBarcodePreview])

  const loadRefs = useCallback(async () => {
    const [p, wo] = await Promise.all([
      apiJson<{ items: Product[] }>('/api/products'),
      apiJson<{ ok: boolean; items: WorkOrderRef[] }>('/api/work-orders'),
    ])
    setProducts([...p.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko')))
    setWorkOrders([...wo.items].sort((a, b) => b.id - a.id))
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const q = filters.productId === '' ? '' : `?productId=${encodeURIComponent(filters.productId)}`
      const data = await apiJson<{ ok: boolean; items: Row[] }>(`/api/lots${q}`)
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filters.productId])

  useEffect(() => {
    void loadRefs().catch((e) => setErr(e instanceof Error ? e.message : 'unknown error'))
  }, [loadRefs])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const filteredItems = useMemo(
    () => items.filter((row) => matchesFilters(row, filters)),
    [items, filters],
  )

  const stats = useMemo(() => {
    let created = 0
    let inProgress = 0
    let done = 0
    let outsourcing = 0
    for (const row of filteredItems) {
      if (row.status === 'CREATED') created += 1
      else if (row.status === 'IN_PROGRESS') inProgress += 1
      else if (row.status === 'DONE') done += 1
      else if (row.status === 'OUTSOURCING') outsourcing += 1
    }
    return { total: filteredItems.length, created, inProgress, done, outsourcing }
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

  const applyWorkOrderSelection = (woIdStr: string) => {
    if (!woIdStr) {
      setForm((f) => ({ ...f, woId: '' }))
      return
    }
    const wo = workOrders.find((x) => x.id === Number(woIdStr))
    if (!wo) {
      setForm((f) => ({ ...f, woId: woIdStr }))
      return
    }
    setForm((f) => ({
      ...f,
      woId: woIdStr,
      productId: String(wo.productId),
      lotQty: String(wo.orderQty),
    }))
  }

  const save = async () => {
    const pid = Number(form.productId)
    const qty = Number(form.lotQty)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setErr('LOT 수량은 1 이상 정수여야 합니다.')
      return
    }
    const woIdParsed = form.woId.trim() === '' ? undefined : Number(form.woId)
    if (form.woId.trim() !== '' && (!Number.isInteger(woIdParsed) || (woIdParsed as number) < 1)) {
      setErr('작업 지시 선택이 올바르지 않습니다.')
      return
    }

    setSaving(true)
    setErr(null)
    try {
      if (editingId == null) {
        const body: Record<string, unknown> = {
          lotNo: form.lotNo.trim(),
          productId: pid,
          lotQty: qty,
          status: form.status,
        }
        if (woIdParsed != null) body.woId = woIdParsed
        await apiJson('/api/lots', { method: 'POST', body: JSON.stringify(body) })
      } else {
        const body: Record<string, unknown> = {
          lotQty: qty,
          status: form.status,
          woId: form.woId.trim() === '' ? null : woIdParsed,
        }
        if (form.lotNo.trim() !== '') body.lotNo = form.lotNo.trim()
        await apiJson(`/api/lots/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await loadRows()
      closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('LOT를 삭제할까요? 연결된 재고·실적이 있으면 실패합니다.')) return
    try {
      await apiJson(`/api/lots/${id}`, { method: 'DELETE' })
      await loadRows()
      if (editingId === id) closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const productLocked = editingId != null || form.woId.trim() !== ''

  const parsedWoIdForHint = form.woId.trim() === '' ? null : Number(form.woId)
  const woForWorkerHint =
    parsedWoIdForHint == null || !Number.isInteger(parsedWoIdForHint) || parsedWoIdForHint < 1
      ? null
      : (workOrders.find((x) => x.id === parsedWoIdForHint) ??
        (editingId != null ? (items.find((r) => r.id === editingId)?.workOrder ?? null) : null))

  const workerHintValue =
    form.woId.trim() === ''
      ? '작업 지시를 선택하면 표시됩니다.'
      : woForWorkerHint == null
        ? '지시 정보를 불러올 수 없습니다.'
        : workersLabel(woForWorkerHint)

  const modalTitle = editingId == null ? '신규 등록' : '수정'

  const openNew = () => {
    setEditingId(null)
    setForm({
      ...empty(),
      productId: filters.productId || '',
    })
    setPanelOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditingId(row.id)
    setForm({
      woId: row.woId != null ? String(row.woId) : '',
      lotNo: row.lotNo,
      productId: String(row.productId),
      lotQty: String(row.lotQty),
      status: row.status,
    })
    setPanelOpen(true)
  }

  const scanCandidates = useMemo(() => {
    return items.map((r) => ({ id: r.id, lotNo: r.lotNo, barcode: r.barcode }))
  }, [items])

  const submitScan = useCallback(() => {
    const v = normalizeScannedLotToken(scanValue)
    if (!v) return
    const hit = scanCandidates.find((r) => r.lotNo === v || r.barcode === v) ?? null
    if (!hit) {
      setScanHitId(null)
      setScanMsg(`미일치: ${v}`)
      return
    }
    setScanHitId(hit.id)
    setScanMsg(`스캔됨: ${hit.lotNo}`)
  }, [scanValue, scanCandidates])

  return (
    <div className="mesPage mesPageWide mesLotPage">
      <header className="mesLotHead">
        <div className="mesLotHeadMain">
          <h1 className="mesLotTitle">생산 LOT</h1>
          <p className="mesLotDesc">
            작업지시·생산계획과 연결해 LOT를 생성합니다. 작업장·배정 작업자는 작업지시에서 확인합니다. (지시 미선택 시 품목만으로도 생성 가능)
          </p>
        </div>
        <div className="mesLotHeadActions">
          <span className="mesLotCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesLotBtn mesLotBtn--secondary" onClick={() => void loadRows()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesLotBtn mesLotBtn--primary" onClick={openNew}>
            <IconPlus />
            새 LOT
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesLotNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesLotFilterCard">
        <div className="mesLotField mesLotField--search">
          <span className="mesLotFieldLabel">검색</span>
          <div className="mesLotInputWrap">
            <span className="mesLotInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesLotInput mesLotInput--search"
              placeholder="LOT번호 / 바코드 / 품목 / 지시 / 계획 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesLotField mesLotField--select">
          <span className="mesLotFieldLabel">상태</span>
          <select
            className="mesLotSelect"
            value={draftFilters.status}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, status: ev.target.value }))}
            aria-label="상태 필터"
          >
            <option value="">상태(전체)</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {lotStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="mesLotField mesLotField--select">
          <span className="mesLotFieldLabel">품목</span>
          <select
            className="mesLotSelect"
            value={draftFilters.productId}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, productId: ev.target.value }))}
            aria-label="품목 필터"
          >
            <option value="">품목(전체)</option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.productCode}
              </option>
            ))}
          </select>
        </div>
        <div className="mesLotField mesLotField--search">
          <span className="mesLotFieldLabel">스캔 (LOT)</span>
          <input
            ref={scanRef}
            className="mesLotInput mono"
            placeholder="바코드 스캔 후 Enter"
            value={scanValue}
            onChange={(ev) => setScanValue(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                submitScan()
                setScanValue('')
                requestAnimationFrame(() => scanRef.current?.focus())
              } else if (ev.key === 'Escape') {
                setScanValue('')
                setScanMsg(null)
                setScanHitId(null)
              }
            }}
          />
        </div>
        <div className="mesLotFilterActions">
          <button type="button" className="mesLotBtn mesLotBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesLotBtn mesLotBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      {scanMsg ? <div className="mesBanner mesBannerInfo mesLotNotice">{scanMsg}</div> : null}

      <div className="mesLotStatsStrip" aria-label="생산 LOT 요약">
        <div className="mesLotStatItem">
          <div className="mesLotStatIcon mesLotStatIcon--gold">
            <IconBox />
          </div>
          <div className="mesLotStatMeta">
            <p className="mesLotStatLabel">전체 LOT</p>
            <p className="mesLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotStatValueNum">{stats.total}</span>
                  <span className="mesLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotStatItem">
          <div className="mesLotStatIcon mesLotStatIcon--blue">
            <IconClock />
          </div>
          <div className="mesLotStatMeta">
            <p className="mesLotStatLabel">생성</p>
            <p className="mesLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotStatValueNum">{stats.created}</span>
                  <span className="mesLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotStatItem">
          <div className="mesLotStatIcon mesLotStatIcon--purple">
            <IconPlay />
          </div>
          <div className="mesLotStatMeta">
            <p className="mesLotStatLabel">진행</p>
            <p className="mesLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotStatValueNum">{stats.inProgress}</span>
                  <span className="mesLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotStatItem">
          <div className="mesLotStatIcon mesLotStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesLotStatMeta">
            <p className="mesLotStatLabel">완료</p>
            <p className="mesLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotStatValueNum">{stats.done}</span>
                  <span className="mesLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLotStatItem">
          <div className="mesLotStatIcon mesLotStatIcon--orange">
            <IconOutsource />
          </div>
          <div className="mesLotStatMeta">
            <p className="mesLotStatLabel">외주</p>
            <p className="mesLotStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLotStatValueNum">{stats.outsourcing}</span>
                  <span className="mesLotStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mesLotTableCard">
        <div className="mesLotTableViewport">
          <table className="mesLotTable">
            <thead>
              <tr>
                <th>LOT No</th>
                <th>바코드</th>
                <th>품목</th>
                <th>작업지시</th>
                <th>생산계획</th>
                <th>LOT 수량</th>
                <th>양품</th>
                <th>불량</th>
                <th>상태</th>
                <th>작업자 (지시)</th>
                <th className="mesLotThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="mesLotEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="mesLotEmpty">
                    {items.length === 0 ? (
                      <>
                        데이터가 없습니다. <strong>새 LOT</strong>로 추가하세요.
                      </>
                    ) : (
                      '필터 조건에 맞는 LOT가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className={[
                      editingId === row.id && panelOpen ? 'mesLotRowSelected' : '',
                      scanHitId === row.id ? 'mesLotRowScanHit' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => openEdit(row)}
                  >
                    <td className="mono">{row.lotNo}</td>
                    <td>
                      {row.barcode ? (
                        <button
                          type="button"
                          className="mesBarcodeCell mesBarcodeOpenBtn"
                          title="바코드 크게 보기 (스캔 테스트)"
                          onClick={(ev: MouseEvent) => {
                            ev.stopPropagation()
                            setBarcodePreview(row)
                          }}
                        >
                          <img
                            src={`/api/lots/${row.id}/barcode-image`}
                            alt=""
                            width={120}
                            height={32}
                            className="mesBarcodeThumb"
                          />
                          <span className="mono small muted">{row.barcode}</span>
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="mono">{row.product.productCode}</span>
                      <div className="muted small">{row.product.productName}</div>
                    </td>
                    <td className="mono">{row.workOrder?.woNo ?? '—'}</td>
                    <td className="mono">{row.workOrder?.plan?.planNo ?? '—'}</td>
                    <td>{row.lotQty}</td>
                    <td>{row.goodQty}</td>
                    <td>{row.defectQty}</td>
                    <td>
                      <span className={lotStatusBadgeClass(row.status)}>{lotStatusLabel(row.status)}</span>
                    </td>
                    <td className="mesTdEllipsis" title={workersLabel(row.workOrder)}>
                      {workersLabel(row.workOrder)}
                    </td>
                    <td className="mesLotTdActions">
                      <button
                        type="button"
                        className="mesLotBtn mesLotBtn--edit"
                        onClick={(ev: MouseEvent) => {
                          ev.stopPropagation()
                          openEdit(row)
                        }}
                      >
                        <IconEdit />
                        수정
                      </button>
                      <button
                        type="button"
                        className="mesLotBtn mesLotBtn--danger"
                        onClick={(ev: MouseEvent) => {
                          ev.stopPropagation()
                          void remove(row.id)
                        }}
                      >
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

        <footer className="mesLotPager">
          <span className="mesLotPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesLotPagerNav" aria-label="페이지">
            <button type="button" className="mesLotPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesLotPagerBtn"
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
                      <span className="mesLotPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesLotPagerBtn${n === page ? ' mesLotPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesLotPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesLotPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesLotPageSize">
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

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div
            className="mesModalDialog mesModalDialogWide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mes-lot-modal-title"
          >
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-lot-modal-title">
                  {modalTitle}
                </h2>
                {editingId != null ? <div className="mesModalMeta muted">ID {editingId}</div> : null}
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  작업 지시 (선택)
                  <select
                    className="mesInput"
                    disabled={editingId != null}
                    value={form.woId}
                    onChange={(ev) => applyWorkOrderSelection(ev.target.value)}
                  >
                    <option value="">없음 (품목 직접 선택)</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={String(wo.id)}>
                        {woOptionLabel(wo)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  LOT 번호
                  <input
                    className="mesInput"
                    disabled={editingId != null}
                    placeholder={editingId == null ? '고유 LOT No' : '수정 시 비우면 유지'}
                    value={form.lotNo}
                    onChange={(ev) => setForm((f) => ({ ...f, lotNo: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  품목
                  <select
                    className="mesInput"
                    disabled={productLocked}
                    value={form.productId}
                    onChange={(ev) => setForm((f) => ({ ...f, productId: ev.target.value }))}
                  >
                    <option value="">선택</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.productCode} — {p.productName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  LOT 수량
                  <input
                    className="mesInput"
                    value={form.lotQty}
                    onChange={(ev) => setForm((f) => ({ ...f, lotQty: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={form.status}
                    onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value as LotStatus }))}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {lotStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  배정 작업자 (작업지시 기준)
                  <input className="mesInput muted" readOnly value={workerHintValue} />
                </label>
              </div>
              {editingId != null ? (
                <p className="muted small" style={{ marginTop: 8 }}>
                  수정 시 작업 지시는 변경할 수 없습니다. LOT 수량은 연결된 지시 수량 이하여야 합니다.
                </p>
              ) : null}
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

      {barcodePreview ? (
        <div className="mesModalRoot" role="presentation">
          <button
            type="button"
            className="mesModalBackdrop"
            aria-label="닫기"
            onClick={closeBarcodePreview}
          />
          <div
            className="mesModalDialog mesBarcodePreviewDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mes-lot-barcode-title"
          >
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-lot-barcode-title">
                  LOT 바코드
                </h2>
                <div className="mesModalMeta muted">
                  {barcodePreview.lotNo} · {barcodePreview.product.productCode}
                </div>
              </div>
            </div>
            <div className="mesModalBody mesBarcodePreviewBody">
              <p className="muted small mesBarcodePreviewHint">
                아래 크기는 실제 라벨 규격(약 40×12mm)과 같습니다. 모니터 밝기를 높이고 스캐너를 15~25cm 거리에서 시도해 보세요.
              </p>
              <p className="muted small mesBarcodePreviewHint">
                <strong>레이저 스캐너</strong>는 LCD 화면에서 잘 안 읽히는 경우가 많습니다.{' '}
                <strong>카메라(2D)형</strong>이 화면 스캔에 유리합니다. 가장 확실한 방법은{' '}
                <strong>인쇄 후 스캔</strong>입니다.
              </p>
              <p className="muted mesBarcodePreviewSpec">
                화면용 Code 128 · 높이 12.7mm · X 0.33mm
              </p>
              <div className="mesBarcodePreviewFrame">
                <LotBarcodePreviewImage
                  lotId={barcodePreview.id}
                  alt={`LOT 바코드 ${barcodePreview.barcode ?? barcodePreview.lotNo}`}
                />
              </div>
              <div className="mesBarcodePreviewValue mono">{barcodePreview.barcode ?? barcodePreview.lotNo}</div>
            </div>
            <div className="mesModalFoot mesBarcodePreviewFoot">
              <button
                type="button"
                className="mesBtnSecondary mesBarcodePrintBtn"
                onClick={() =>
                  printLotBarcode(barcodePreview.id, barcodePreview.barcode ?? barcodePreview.lotNo)
                }
              >
                <IconPrint />
                인쇄하기
              </button>
              <a
                className="mesBtnSm mesBarcodeOpenLink"
                href={`/api/lots/${barcodePreview.id}/barcode-image?view=print`}
                target="_blank"
                rel="noreferrer"
              >
                인쇄용 이미지 열기
              </a>
              <button type="button" className="mesBtnPrimary" onClick={closeBarcodePreview}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
