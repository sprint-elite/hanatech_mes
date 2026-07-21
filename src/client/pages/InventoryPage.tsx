import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson } from '../lib/api'
import '../inventory-page.css'

type Product = { id: number; productCode: string; productName: string }

type LotOpt = { id: number; lotNo: string; productId: number }

type InvStatus = 'AVAILABLE' | 'HOLD' | 'DEFECT'

type StatusFilter = 'ALL' | InvStatus | 'MIXED'

type Row = {
  id: number
  productId: number
  lotId: number | null
  locationId: number | null
  qty: number
  reservedQty: number
  status: InvStatus
  updatedAt: string
  product: { productCode: string; productName: string }
  lot: { lotNo: string; id: number } | null
}

type FormState = {
  productId: string
  lotId: string
  qty: string
  reservedQty: string
  status: InvStatus
}

type Filters = { q: string; status: StatusFilter }

type InventoryTxRow = {
  id: number
  productId: number
  transactionType: 'IN' | 'OUT' | 'MOVE' | 'ADJUST'
  qty: number
  beforeQty: number | null
  afterQty: number | null
  createdAt: string
  product?: { productCode: string; productName: string } | null
}

type GroupedItem = {
  productId: number
  product: Row['product']
  qty: number
  reservedQty: number
  availableQty: number
  statusText: string
  updatedAt: string
}

type ChartSeries = {
  productId: number
  label: string
  color: string
  points: { ymd: string; qty: number }[]
}

const statuses: InvStatus[] = ['AVAILABLE', 'HOLD', 'DEFECT']

const CHART_DAYS_OPTS = [7, 14, 30] as const
type ChartDays = (typeof CHART_DAYS_OPTS)[number]

const LINE_COLORS = ['#d4a524', '#3d9a5f', '#5b9bd5', '#c45c5c', '#9b7ed9'] as const

const emptyFilters = (): Filters => ({ q: '', status: 'ALL' })

const statusLabel = (s: string) => {
  if (s === 'AVAILABLE') return '가용'
  if (s === 'HOLD') return '보류'
  if (s === 'DEFECT') return '불량'
  if (s === 'MIXED') return '혼합'
  return s
}

function statusBadgeClass(s: string): string {
  if (s === 'AVAILABLE') return 'mesInvStatusBadge mesInvStatusBadge--available'
  if (s === 'HOLD') return 'mesInvStatusBadge mesInvStatusBadge--hold'
  if (s === 'DEFECT') return 'mesInvStatusBadge mesInvStatusBadge--defect'
  if (s === 'MIXED') return 'mesInvStatusBadge mesInvStatusBadge--mixed'
  return 'mesInvStatusBadge'
}

const toYmd = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const buildDayList = (days: number): string[] => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const list: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    list.push(toYmd(d))
  }
  return list
}

const txDelta = (t: InventoryTxRow): number => {
  if (t.transactionType === 'IN') return t.qty
  if (t.transactionType === 'OUT') return -t.qty
  if (t.transactionType === 'ADJUST' && t.beforeQty != null && t.afterQty != null) {
    return t.afterQty - t.beforeQty
  }
  return 0
}

const buildProductDailySeries = (
  productId: number,
  txs: InventoryTxRow[],
  dayList: string[],
  currentQty: number,
): { ymd: string; qty: number }[] => {
  const rangeStart = dayList[0]
  const rangeEnd = dayList[dayList.length - 1]
  const inRange = txs
    .filter((t) => t.productId === productId)
    .filter((t) => {
      const ymd = t.createdAt.slice(0, 10)
      return ymd >= rangeStart && ymd <= rangeEnd
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const deltaByDay = new Map(dayList.map((ymd) => [ymd, 0]))
  let totalDelta = 0
  for (const t of inRange) {
    const ymd = t.createdAt.slice(0, 10)
    const d = txDelta(t)
    deltaByDay.set(ymd, (deltaByDay.get(ymd) ?? 0) + d)
    totalDelta += d
  }

  let running = currentQty - totalDelta
  return dayList.map((ymd) => {
    running += deltaByDay.get(ymd) ?? 0
    return { ymd, qty: running }
  })
}

/** 재고 차트 Y축: 최대값을 올림한 뒤 백/천 단위 눈금 */
const computeInvYAxis = (dataMax: number): { min: number; max: number; ticks: number[] } => {
  const peak = Math.max(dataMax, 0)
  if (peak === 0) {
    return { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100] }
  }

  let axisMax: number
  let step: number

  if (peak <= 1000) {
    axisMax = 1000
    step = 100
  } else if (peak <= 10000) {
    axisMax = Math.ceil(peak / 1000) * 1000
    step = 1000
  } else if (peak <= 100000) {
    axisMax = Math.ceil(peak / 10000) * 10000
    step = 10000
  } else {
    const exp = 10 ** Math.floor(Math.log10(peak))
    axisMax = Math.ceil(peak / exp) * exp
    step = axisMax / 10
  }

  const ticks: number[] = []
  for (let v = 0; v <= axisMax; v += step) ticks.push(v)
  return { min: 0, max: axisMax, ticks }
}

function InventoryLineChart({ series, dayLabels }: { series: ChartSeries[]; dayLabels: string[] }) {
  const W = 1200
  const H = 420
  const pad = { l: 52, r: 20, t: 20, b: 36 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b

  const allQty = series.flatMap((s) => s.points.map((p) => p.qty))
  const dataMax = Math.max(...allQty, 0)
  const { min: minV, max: maxV, ticks: yTicks } = computeInvYAxis(dataMax)
  const range = maxV - minV || 1

  const xAt = (i: number) => pad.l + (i / Math.max(1, dayLabels.length - 1)) * plotW
  const yAt = (v: number) => pad.t + plotH - ((v - minV) / range) * plotH

  const tickStep = dayLabels.length <= 10 ? 1 : dayLabels.length <= 20 ? 2 : 5

  return (
    <svg className="mesInvTrendSvg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      {yTicks.map((v) => (
        <g key={`y-${v}`}>
          <line
            x1={pad.l}
            y1={yAt(v)}
            x2={W - pad.r}
            y2={yAt(v)}
            className="mesInvTrendGridLine"
          />
          <text x={pad.l - 6} y={yAt(v) + 4} className="mesInvTrendAxisLabel" textAnchor="end">
            {v.toLocaleString()}
          </text>
        </g>
      ))}
      {series.map((s) => {
        const pts = s.points.map((p, i) => `${xAt(i)},${yAt(p.qty)}`).join(' ')
        return (
          <g key={s.productId}>
            <polyline className="mesInvTrendLine" points={pts} stroke={s.color} />
            {s.points.map((p, i) => (
              <circle
                key={p.ymd}
                cx={xAt(i)}
                cy={yAt(p.qty)}
                r={series.length === 1 ? 3.5 : 2.5}
                className="mesInvTrendDot"
                fill={s.color}
              />
            ))}
          </g>
        )
      })}
      {dayLabels.map((ymd, i) =>
        i % tickStep === 0 || i === dayLabels.length - 1 ? (
          <text key={ymd} x={xAt(i)} y={H - 6} className="mesInvTrendAxisLabel" textAnchor="middle">
            {ymd.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  )
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

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}

function IconStack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
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

const empty = (): FormState => ({
  productId: '',
  lotId: '',
  qty: '0',
  reservedQty: '0',
  status: 'AVAILABLE',
})

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [lots, setLots] = useState<LotOpt[]>([])
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [txRows, setTxRows] = useState<InventoryTxRow[]>([])
  const [chartDays, setChartDays] = useState<ChartDays>(14)
  const [chartProductId, setChartProductId] = useState('')

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setEditingId(null)
    setForm(empty())
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  const loadProducts = useCallback(async () => {
    const p = await apiJson<{ items: Product[] }>('/api/products')
    setProducts(p.items)
  }, [])

  const loadLots = useCallback(async (productId: string) => {
    if (productId === '') {
      setLots([])
      return
    }
    const data = await apiJson<{ items: LotOpt[] }>(`/api/lots?productId=${encodeURIComponent(productId)}`)
    setLots(data.items.map((r) => ({ id: r.id, lotNo: r.lotNo, productId: r.productId })))
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, tx] = await Promise.all([
        apiJson<{ ok: boolean; items: Row[] }>('/api/inventory'),
        apiJson<{ ok: boolean; items: InventoryTxRow[] }>('/api/inventory-transactions?limit=800'),
      ])
      setItems(inv.items)
      setTxRows(tx.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
      setTxRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts().catch((e) => setErr(e instanceof Error ? e.message : 'unknown error'))
  }, [loadProducts])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    void loadLots(form.productId)
  }, [form.productId, loadLots])

  const save = async () => {
    const pid = Number(form.productId)
    const qty = Number(form.qty)
    const resv = Number(form.reservedQty)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(resv) || resv < 0) {
      setErr('수량·예약수량은 0 이상 숫자여야 합니다.')
      return
    }
    const lid = form.lotId.trim() === '' ? null : Number(form.lotId)
    if (form.lotId.trim() !== '' && (!Number.isInteger(lid) || (lid as number) < 1)) {
      setErr('LOT 선택이 올바르지 않습니다.')
      return
    }

    setSaving(true)
    setErr(null)
    try {
      if (editingId == null) {
        await apiJson('/api/inventory', {
          method: 'POST',
          body: JSON.stringify({
            productId: pid,
            lotId: lid,
            qty,
            reservedQty: resv,
            status: form.status,
          }),
        })
      } else {
        await apiJson(`/api/inventory/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            productId: pid,
            lotId: lid,
            qty,
            reservedQty: resv,
            status: form.status,
          }),
        })
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
    if (!confirm('재고 행을 삭제할까요?')) return
    try {
      await apiJson(`/api/inventory/${id}`, { method: 'DELETE' })
      await loadRows()
      if (editingId === id) closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const openNew = () => {
    setEditingId(null)
    setForm(empty())
    setPanelOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditingId(row.id)
    setForm({
      productId: String(row.productId),
      lotId: row.lotId != null ? String(row.lotId) : '',
      qty: String(row.qty),
      reservedQty: String(row.reservedQty),
      status: row.status,
    })
    setPanelOpen(true)
  }

  const modalTitle = editingId == null ? '신규 등록' : '수정'
  const groupedItems = useMemo(() => {
    const m = new Map<
      number,
      { product: Row['product']; qty: number; reservedQty: number; statuses: Set<InvStatus>; updatedAt: string }
    >()
    for (const row of items) {
      const prev = m.get(row.productId)
      if (!prev) {
        m.set(row.productId, {
          product: row.product,
          qty: row.qty,
          reservedQty: row.reservedQty,
          statuses: new Set([row.status]),
          updatedAt: row.updatedAt,
        })
      } else {
        prev.qty += row.qty
        prev.reservedQty += row.reservedQty
        prev.statuses.add(row.status)
        if (new Date(row.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) prev.updatedAt = row.updatedAt
      }
    }
    return Array.from(m.entries()).map(([productId, x]) => ({
      productId,
      product: x.product,
      qty: x.qty,
      reservedQty: x.reservedQty,
      updatedAt: x.updatedAt,
      availableQty: x.qty - x.reservedQty,
      statusText: x.statuses.size === 1 ? Array.from(x.statuses)[0] : 'MIXED',
    }))
  }, [items])

  const filteredItems = useMemo(() => {
    const keyword = filters.q.trim().toLowerCase()
    return groupedItems.filter((row) => {
      if (filters.status !== 'ALL' && row.statusText !== filters.status) return false
      if (keyword === '') return true
      return (
        row.product.productCode.toLowerCase().includes(keyword) ||
        row.product.productName.toLowerCase().includes(keyword)
      )
    })
  }, [groupedItems, filters])

  const stats = useMemo(() => {
    let qtySum = 0
    let reservedSum = 0
    let availableSum = 0
    for (const row of filteredItems) {
      qtySum += row.qty
      reservedSum += row.reservedQty
      availableSum += row.availableQty
    }
    return {
      total: filteredItems.length,
      qtySum,
      reservedSum,
      availableSum,
    }
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
    const emptyF = emptyFilters()
    setDraftFilters(emptyF)
    setFilters(emptyF)
    setPage(1)
  }

  const chartDayList = useMemo(() => buildDayList(chartDays), [chartDays])

  const chartTargets = useMemo((): GroupedItem[] => {
    if (chartProductId !== '') {
      const row = groupedItems.find((g) => String(g.productId) === chartProductId)
      return row ? [row] : []
    }
    const pool = filteredItems.length > 0 ? filteredItems : groupedItems
    return [...pool].sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [chartProductId, filteredItems, groupedItems])

  const chartSeries = useMemo((): ChartSeries[] => {
    return chartTargets.map((row, idx) => ({
      productId: row.productId,
      label: row.product.productName,
      color: LINE_COLORS[idx % LINE_COLORS.length],
      points: buildProductDailySeries(row.productId, txRows, chartDayList, row.qty),
    }))
  }, [chartTargets, txRows, chartDayList])

  return (
    <div className="mesPage mesPageWide mesInvPage">
      <header className="mesInvHead">
        <div className="mesInvHeadMain">
          <h1 className="mesInvTitle">재고</h1>
          <p className="mesInvDesc">LOT 단위 재고를 등록·수정합니다. (수동 입고/조정용)</p>
        </div>
        <div className="mesInvHeadActions">
          <span className="mesInvCountBadge">{loading ? '…' : `${filteredItems.length.toLocaleString()}건`}</span>
          <button type="button" className="mesInvBtn mesInvBtn--secondary" onClick={() => void loadRows()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesInvBtn mesInvBtn--primary" onClick={openNew}>
            <IconPlus />
            새 재고
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesInvNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesInvFilterCard">
        <div className="mesInvField mesInvField--search">
          <span className="mesInvFieldLabel">검색</span>
          <div className="mesInvInputWrap">
            <span className="mesInvInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesInvInput mesInvInput--search"
              placeholder="품목코드/품목명"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesInvField mesInvField--select">
          <span className="mesInvFieldLabel">상태</span>
          <select
            className="mesInvSelect"
            value={draftFilters.status}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, status: ev.target.value as StatusFilter }))}
            aria-label="상태 필터"
          >
            <option value="ALL">전체</option>
            <option value="AVAILABLE">가용</option>
            <option value="HOLD">보류</option>
            <option value="DEFECT">불량</option>
            <option value="MIXED">혼합</option>
          </select>
        </div>
        <div className="mesInvFilterActions">
          <button type="button" className="mesInvBtn mesInvBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesInvBtn mesInvBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesInvStatsStrip" aria-label="재고 요약">
        <div className="mesInvStatItem">
          <div className="mesInvStatIcon mesInvStatIcon--blue">
            <IconBox />
          </div>
          <div className="mesInvStatMeta">
            <p className="mesInvStatLabel">전체 품목</p>
            <p className="mesInvStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesInvStatValueNum">{stats.total.toLocaleString()}</span>
                  <span className="mesInvStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesInvStatItem">
          <div className="mesInvStatIcon mesInvStatIcon--gold">
            <IconStack />
          </div>
          <div className="mesInvStatMeta">
            <p className="mesInvStatLabel">총 재고합계</p>
            <p className="mesInvStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesInvStatValueNum">{stats.qtySum.toLocaleString()}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesInvStatItem">
          <div className="mesInvStatIcon mesInvStatIcon--orange">
            <IconLock />
          </div>
          <div className="mesInvStatMeta">
            <p className="mesInvStatLabel">예약</p>
            <p className="mesInvStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesInvStatValueNum">{stats.reservedSum.toLocaleString()}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesInvStatItem">
          <div className="mesInvStatIcon mesInvStatIcon--green">
            <IconCheck />
          </div>
          <div className="mesInvStatMeta">
            <p className="mesInvStatLabel">가용</p>
            <p className="mesInvStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesInvStatValueNum">{stats.availableSum.toLocaleString()}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mesInvFormCard">
        <div className="mesDashTrendHead">
          <h2 className="mesDashTrendTitle mesDashTrendTitle--tight">재고 추이</h2>
          <div className="mesDashTrendLegend">
            {chartSeries.map((s) => (
              <span key={s.productId} className="mesDashTrendLegendItem">
                <span className="mesDashTrendLegendDot" style={{ background: s.color }} />
                <span className="mono small">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mesInvTrendFilters" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <label className="mesLabel mesLabelInline">
            기간
            <select
              className="mesInput"
              value={chartDays}
              onChange={(ev) => setChartDays(Number(ev.target.value) as ChartDays)}
            >
              {CHART_DAYS_OPTS.map((d) => (
                <option key={d} value={d}>
                  최근 {d}일
                </option>
              ))}
            </select>
          </label>
          <label className="mesLabel mesLabelInline">
            품목
            <select className="mesInput" value={chartProductId} onChange={(ev) => setChartProductId(ev.target.value)}>
              <option value="">상위 5개 (표 필터 연동)</option>
              {groupedItems
                .slice()
                .sort((a, b) => a.product.productName.localeCompare(b.product.productName, 'ko'))
                .map((row) => (
                  <option key={row.productId} value={String(row.productId)}>
                    {row.product.productCode} — {row.product.productName}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="mesInvTrendChartWrap">
          {loading ? (
            <p className="muted small mesInvTrendEmpty">차트 로딩 중…</p>
          ) : chartSeries.length === 0 ? (
            <p className="muted small mesInvTrendEmpty">표시할 품목이 없습니다.</p>
          ) : (
            <InventoryLineChart series={chartSeries} dayLabels={chartDayList} />
          )}
        </div>
        <p className="muted small mesInvTrendHint">
          일말 재고합계(품목 단위). 입고·출고·조정 이력을 역산해 표시하며, 기간 이전 이력이 없으면 당일 잔량 기준으로 맞춥니다.
        </p>
      </div>

      <div className="mesInvTableCard">
        <div className="mesInvTableViewport">
          <table className="mesInvTable">
            <thead>
              <tr>
                <th>품목</th>
                <th>재고합계</th>
                <th>예약</th>
                <th>가용</th>
                <th>상태</th>
                <th>최종갱신</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="mesInvEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mesInvEmpty">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      <span className="mono">{row.product.productCode}</span>
                      <div className="muted small">{row.product.productName}</div>
                    </td>
                    <td>{row.qty.toLocaleString()}</td>
                    <td>{row.reservedQty.toLocaleString()}</td>
                    <td>{row.availableQty.toLocaleString()}</td>
                    <td>
                      <span className={statusBadgeClass(row.statusText)}>{statusLabel(row.statusText)}</span>
                    </td>
                    <td className="small muted">{new Date(row.updatedAt).toLocaleString('ko-KR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesInvPager">
          <span className="mesInvPagerTotal">전체 {filteredItems.length.toLocaleString()}건</span>
          <nav className="mesInvPagerNav" aria-label="페이지">
            <button type="button" className="mesInvPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesInvPagerBtn"
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
                      <span className="mesInvPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesInvPagerBtn${n === page ? ' mesInvPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesInvPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesInvPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesInvPageSize">
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
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-inv-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-inv-modal-title">
                  {modalTitle}
                </h2>
                {editingId != null ? <div className="mesModalMeta muted">ID {editingId}</div> : null}
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  품목
                  <select
                    className="mesInput"
                    value={form.productId}
                    onChange={(ev) => setForm((f) => ({ ...f, productId: ev.target.value, lotId: '' }))}
                  >
                    <option value="">선택</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.productCode} — {p.productName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  LOT (선택)
                  <select
                    className="mesInput"
                    value={form.lotId}
                    onChange={(ev) => setForm((f) => ({ ...f, lotId: ev.target.value }))}
                    disabled={form.productId === ''}
                  >
                    <option value="">없음</option>
                    {lots.map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.lotNo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  수량
                  <input className="mesInput" value={form.qty} onChange={(ev) => setForm((f) => ({ ...f, qty: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  예약
                  <input
                    className="mesInput"
                    value={form.reservedQty}
                    onChange={(ev) => setForm((f) => ({ ...f, reservedQty: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={form.status}
                    onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value as InvStatus }))}
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
    </div>
  )
}
