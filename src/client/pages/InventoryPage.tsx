import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson } from '../lib/api'

type Product = { id: number; productCode: string; productName: string }

type LotOpt = { id: number; lotNo: string; productId: number }

type InvStatus = 'AVAILABLE' | 'HOLD' | 'DEFECT'

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvStatus | 'MIXED'>('ALL')
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
    const m = new Map<number, { product: Row['product']; qty: number; reservedQty: number; statuses: Set<InvStatus>; updatedAt: string }>()
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
    const keyword = search.trim().toLowerCase()
    return groupedItems.filter((row) => {
      if (statusFilter !== 'ALL' && row.statusText !== statusFilter) return false
      if (keyword === '') return true
      return (
        row.product.productCode.toLowerCase().includes(keyword) ||
        row.product.productName.toLowerCase().includes(keyword)
      )
    })
  }, [groupedItems, search, statusFilter])

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
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">재고</h1>
        <p className="mesPageDesc">LOT 단위 재고를 등록·수정합니다. (수동 입고/조정용)</p>
      </header>

      <div className="mesToolbar">
        <button type="button" className="mesBtnPrimary" onClick={openNew}>
          새 재고
        </button>
        <button type="button" className="mesBtnSecondary" onClick={() => void loadRows()}>
          새로고침
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesToolbar" style={{ marginBottom: 8 }}>
        <label className="mesLabel mesLabelInline">
          검색
          <input
            className="mesInput mesInputShort"
            placeholder="품목코드/품목명"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </label>
        <label className="mesLabel mesLabelInline">
          상태
          <select className="mesInput" value={statusFilter} onChange={(ev) => setStatusFilter(ev.target.value as 'ALL' | InvStatus | 'MIXED')}>
            <option value="ALL">전체</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="HOLD">HOLD</option>
            <option value="DEFECT">DEFECT</option>
            <option value="MIXED">MIXED</option>
          </select>
        </label>
        <button
          type="button"
          className="mesBtnSecondary"
          onClick={() => {
            setSearch('')
            setStatusFilter('ALL')
          }}
        >
          필터 초기화
        </button>
        <span className="muted small">표시 {filteredItems.length}건</span>
      </div>

      <section className="mesInvTrendCard">
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
        <div className="mesToolbar mesInvTrendFilters">
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
      </section>

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
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
                <td colSpan={6} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              filteredItems.map((row) => (
                <tr key={row.productId}>
                  <td>
                    <span className="mono">{row.product.productCode}</span>
                    <div className="muted small">{row.product.productName}</div>
                  </td>
                  <td>{row.qty}</td>
                  <td>{row.reservedQty}</td>
                  <td>{row.availableQty}</td>
                  <td>{row.statusText}</td>
                  <td className="small muted">{new Date(row.updatedAt).toLocaleString('ko-KR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
                        {s}
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
