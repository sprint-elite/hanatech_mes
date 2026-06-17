import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import { itemTypeLabel } from '../lib/itemType'

type Row = {
  id: number
  workerCode: string
  workerName: string
  team: string | null
  position: string | null
  skillLevel: string | null
  phone: string | null
  hireDate: string | null
  status: string
  createdAt: string
}

type ProductSummaryRow = {
  productId: number
  productCode: string
  productName: string
  itemType: string
  inputQty: number
  goodQty: number
  defectQty: number
  workMinutes: number
}

type FormState = {
  workerCode: string
  workerName: string
  team: string
  position: string
  skillLevel: string
  phone: string
  hireDate: string
  status: string
}

const empty = (): FormState => ({
  workerCode: '',
  workerName: '',
  team: '',
  position: '',
  skillLevel: '',
  phone: '',
  hireDate: '',
  status: 'ACTIVE',
})

function formatWorkMinutes(m: number) {
  if (m <= 0) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}분`
  if (h === 0) return `${h}시간`
  return `${h}시간 ${min}분`
}

const GAUGE_COLORS = {
  good: '#3d9a5f',
  warn: '#d9a321',
  bad: '#c45c5c',
  accent: '#d4a524',
  muted: '#64748b',
} as const

function AbilityRing({
  label,
  value,
  sub,
  pct,
  color,
}: {
  label: string
  value: string
  sub?: string
  pct: number
  color: string
}) {
  const p = Math.min(100, Math.max(0, pct))
  const size = 88
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - p / 100)
  const cx = size / 2
  return (
    <div className="mesWorkerGauge" title={sub}>
      <div className="mesWorkerGaugeRing" aria-hidden>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cx})`}
            style={{ filter: `drop-shadow(0 0 8px ${color}44)` }}
          />
        </svg>
        <span className="mesWorkerGaugeVal">{value}</span>
      </div>
      <span className="mesWorkerGaugeLabel">{label}</span>
      {sub ? <span className="mesWorkerGaugeSub muted">{sub}</span> : null}
    </div>
  )
}

function sumWorkerTotals(rows: ProductSummaryRow[], workMinutesDraft: Record<number, string>) {
  return rows.reduce(
    (a, r) => {
      const wm = Number(workMinutesDraft[r.productId]?.replace(/\D/g, '') || 0)
      return {
        input: a.input + r.inputQty,
        good: a.good + r.goodQty,
        defect: a.defect + r.defectQty,
        minutes: a.minutes + (Number.isFinite(wm) ? wm : 0),
      }
    },
    { input: 0, good: 0, defect: 0, minutes: 0 },
  )
}

function WorkerAbilityPanel({
  rows,
  workMinutesDraft,
  loading,
}: {
  rows: ProductSummaryRow[]
  workMinutesDraft: Record<number, string>
  loading: boolean
}) {
  const [productFilter, setProductFilter] = useState('')

  const filteredRows = useMemo(() => {
    if (!productFilter) return rows
    return rows.filter((r) => String(r.productId) === productFilter)
  }, [rows, productFilter])

  const totals = useMemo(
    () => sumWorkerTotals(filteredRows, workMinutesDraft),
    [filteredRows, workMinutesDraft],
  )

  const selectedProductName = useMemo(() => {
    if (!productFilter) return null
    return rows.find((r) => String(r.productId) === productFilter)?.productName ?? null
  }, [rows, productFilter])

  const metrics = useMemo(() => {
    const { input, good, defect, minutes } = totals
    const processed = good + defect
    const completionPct = input > 0 ? Math.round((processed / input) * 1000) / 10 : 0
    const defectPct = input > 0 ? Math.round((defect / input) * 1000) / 10 : 0
    const hours = minutes / 60
    const perHour = hours > 0 ? Math.round((good / hours) * 10) / 10 : 0
    const productivityPct = Math.min(100, perHour > 0 ? Math.round((perHour / 20) * 100) : 0)
    return { processed, completionPct, defectPct, perHour, productivityPct, hours }
  }, [totals])

  const productBars = useMemo(() => {
    return filteredRows
      .map((r) => ({
        id: r.productId,
        label: r.productName,
        good: r.goodQty,
        defect: r.defectQty,
        input: r.inputQty,
        total: r.goodQty + r.defectQty,
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.good - a.good)
      .slice(0, 8)
  }, [filteredRows])

  const barMax = Math.max(1, ...productBars.map((b) => b.good))

  if (loading) {
    return <div className="muted mesWorkerAbilityEmpty">능력치 차트 로딩 중…</div>
  }

  const hasData = totals.input > 0 || totals.minutes > 0

  return (
    <section className="mesWorkerAbility" aria-label="작업자 능력치">
      <div className="mesWorkerAbilityToolbar">
        <label className="mesWorkerAbilityFilterLabel">
          <span className="muted small">품목</span>
          <select
            className="mesInput mesWorkerAbilitySelect"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            aria-label="실적·능력치 품목 필터"
          >
            <option value="">전체</option>
            {rows.map((r) => (
              <option key={r.productId} value={String(r.productId)}>
                {r.productName}
              </option>
            ))}
          </select>
        </label>
        {selectedProductName ? (
          <span className="muted small mesWorkerAbilityFilterHint">{selectedProductName} 기준</span>
        ) : (
          <span className="muted small mesWorkerAbilityFilterHint">전체 품목 합산</span>
        )}
      </div>
      <div className="mesWorkerAbilityGrid">
        <div className="mesDashChartCard mesWorkerAbilityCard">
          <h3 className="mesWorkerChartTitle">실적 구성{selectedProductName ? ` · ${selectedProductName}` : ''}</h3>
          {totals.input > 0 ? (
            <>
              <div className="mesWorkerStackBar" role="img" aria-label={`투입 ${totals.input}, 양품 ${totals.good}, 불량 ${totals.defect}`}>
                <div
                  className="mesWorkerStackSeg mesWorkerStackSeg--good"
                  style={{ flex: totals.good || 0.001 }}
                  title={`양품 ${totals.good}`}
                />
                <div
                  className="mesWorkerStackSeg mesWorkerStackSeg--defect"
                  style={{ flex: totals.defect || 0.001 }}
                  title={`불량 ${totals.defect}`}
                />
                {totals.good + totals.defect < totals.input ? (
                  <div
                    className="mesWorkerStackSeg mesWorkerStackSeg--rest"
                    style={{ flex: totals.input - totals.good - totals.defect }}
                    title={`미반영 ${totals.input - totals.good - totals.defect}`}
                  />
                ) : null}
              </div>
              <div className="mesWorkerStackLegend">
                <span>
                  <i className="mesWorkerLegendDot mesWorkerLegendDot--good" />
                  양품 {totals.good.toLocaleString()}
                </span>
                <span>
                  <i className="mesWorkerLegendDot mesWorkerLegendDot--defect" />
                  불량 {totals.defect.toLocaleString()}
                </span>
                <span className="muted">투입 {totals.input.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <div className="muted mesWorkerAbilityEmpty">집계된 실적이 없습니다.</div>
          )}
        </div>

        <div className="mesDashChartCard mesWorkerAbilityCard mesWorkerGaugeRow">
          <h3 className="mesWorkerChartTitle">능력치 지표{selectedProductName ? ` · ${selectedProductName}` : ''}</h3>
          {hasData ? (
            <div className="mesWorkerGauges">
              <AbilityRing
                label="작업 완료율"
                value={`${metrics.completionPct}%`}
                pct={metrics.completionPct}
                color={metrics.completionPct >= 95 ? GAUGE_COLORS.good : metrics.completionPct >= 85 ? GAUGE_COLORS.warn : GAUGE_COLORS.bad}
                sub={`처리 ${metrics.processed.toLocaleString()} / 투입 ${totals.input.toLocaleString()}`}
              />
              <AbilityRing
                label="불량률"
                value={`${metrics.defectPct}%`}
                pct={Math.min(100, metrics.defectPct * 5)}
                color={metrics.defectPct <= 2 ? GAUGE_COLORS.good : metrics.defectPct <= 5 ? GAUGE_COLORS.warn : GAUGE_COLORS.bad}
                sub={`불량 ${totals.defect.toLocaleString()}`}
              />
              <AbilityRing
                label="시간당 양품"
                value={metrics.perHour > 0 ? String(metrics.perHour) : '—'}
                pct={metrics.productivityPct}
                color={GAUGE_COLORS.accent}
                sub={totals.minutes > 0 ? formatWorkMinutes(totals.minutes) : '작업시간 미입력'}
              />
            </div>
          ) : (
            <div className="muted mesWorkerAbilityEmpty">실적 또는 작업시간을 입력하면 지표가 표시됩니다.</div>
          )}
        </div>
      </div>

      {productBars.length > 0 && !productFilter ? (
        <div className="mesDashChartCard mesWorkerAbilityCard">
          <h3 className="mesWorkerChartTitle">품목별 양품 생산</h3>
          <div className="mesDhHBarChart mesWorkerProductBars">
            {productBars.map((b) => {
              const pct = Math.round((b.good / barMax) * 100)
              const yieldP = b.input > 0 ? Math.round((b.good / b.input) * 100) : 0
              return (
                <div key={b.id} className="mesDhHBarRow" title={`${b.label} · 양품 ${b.good} · 불량 ${b.defect}`}>
                  <span className="mesDhHBarLabel">{b.label}</span>
                  <div className="mesDhHBarTrack">
                    <div
                      className="mesDhHBarFill mesWorkerBarFill--good"
                      style={{ width: `${Math.max(pct, b.good > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="mesDhHBarVal mono">
                    {b.good.toLocaleString()}
                    <span className="mesWorkerBarSub muted"> ({yieldP}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}

type StatsCell = {
  workerId: number
  workerCode: string
  workerName: string
  productId: number
  productName: string
  inputQty: number
  goodQty: number
  defectQty: number
  workMinutes: number
  yieldPct: number
  defectPct: number
  perHour: number | null
}

type StatsProduct = {
  id: number
  productCode: string
  productName: string
  itemType: string
}

type WorkerAggRow = {
  workerId: number
  workerName: string
  inputQty: number
  goodQty: number
  defectQty: number
  workMinutes: number
  yieldPct: number
  defectPct: number
  perHour: number | null
  contributionPct: number
}

function aggregateByWorker(cells: StatsCell[]): WorkerAggRow[] {
  const map = new Map<number, WorkerAggRow & { workerName: string }>()
  for (const c of cells) {
    let row = map.get(c.workerId)
    if (!row) {
      row = {
        workerId: c.workerId,
        workerName: c.workerName,
        inputQty: 0,
        goodQty: 0,
        defectQty: 0,
        workMinutes: 0,
        yieldPct: 0,
        defectPct: 0,
        perHour: null,
        contributionPct: 0,
      }
      map.set(c.workerId, row)
    }
    row.inputQty += c.inputQty
    row.goodQty += c.goodQty
    row.defectQty += c.defectQty
    row.workMinutes += c.workMinutes
  }
  const base = [...map.values()].filter((r) => r.inputQty > 0 || r.goodQty > 0)
  const totalGood = base.reduce((s, r) => s + r.goodQty, 0)
  return base.map((r) => {
    const yieldPct = r.inputQty > 0 ? Math.round((r.goodQty / r.inputQty) * 1000) / 10 : 0
    const defectPct = r.inputQty > 0 ? Math.round((r.defectQty / r.inputQty) * 1000) / 10 : 0
    const hours = r.workMinutes / 60
    const perHour = hours > 0 && r.goodQty > 0 ? Math.round((r.goodQty / hours) * 10) / 10 : null
    const contributionPct = totalGood > 0 ? Math.round((r.goodQty / totalGood) * 1000) / 10 : 0
    return { ...r, yieldPct, defectPct, perHour, contributionPct }
  })
}

function CompareBarChart({
  title,
  rows,
  valueKey,
  format,
  barClass,
  sort,
  bestLabel,
}: {
  title: string
  rows: WorkerAggRow[]
  valueKey: 'contributionPct' | 'defectPct' | 'perHour'
  format: (v: number, r: WorkerAggRow) => string
  barClass: string
  sort: 'asc' | 'desc'
  bestLabel: string
}) {
  const data = rows
    .filter((r) => {
      if (valueKey === 'perHour') return r.perHour != null && r.perHour > 0
      if (valueKey === 'contributionPct') return r.goodQty > 0
      return r.inputQty > 0
    })
    .sort((a, b) => {
      const av = valueKey === 'perHour' ? (a.perHour ?? 0) : a[valueKey]
      const bv = valueKey === 'perHour' ? (b.perHour ?? 0) : b[valueKey]
      return sort === 'asc' ? av - bv : bv - av
    })
    .slice(0, 10)

  if (data.length === 0) {
    return (
      <section className="mesDashChartCard mesWorkerAbilityCard">
        <h3 className="mesWorkerChartTitle">{title}</h3>
        <div className="muted mesWorkerAbilityEmpty">비교할 데이터가 없습니다.</div>
      </section>
    )
  }

  const max = Math.max(
    1,
    ...data.map((r) => (valueKey === 'perHour' ? (r.perHour ?? 0) : r[valueKey])),
  )
  const best = data[0]

  return (
    <section className="mesDashChartCard mesWorkerAbilityCard">
      <h3 className="mesWorkerChartTitle">{title}</h3>
      {best ? (
        <p className="mesWorkerStatsBest muted small">
          {bestLabel}: <strong>{best.workerName}</strong> ({format(valueKey === 'perHour' ? (best.perHour ?? 0) : best[valueKey], best)})
        </p>
      ) : null}
      <div className="mesDhHBarChart">
        {data.map((r, i) => {
          const val = valueKey === 'perHour' ? (r.perHour ?? 0) : r[valueKey]
          const pct = Math.round((val / max) * 100)
          return (
            <div
              key={r.workerId}
              className={`mesDhHBarRow${i === 0 ? ' mesDhHBarRow--best' : ''}`}
              title={`${r.workerName} · 투입 ${r.inputQty} · 양품 ${r.goodQty} · 불량 ${r.defectQty}`}
            >
              <span className="mesDhHBarLabel">{r.workerName}</span>
              <div className="mesDhHBarTrack">
                <div className={`mesDhHBarFill ${barClass}`} style={{ width: `${Math.max(pct, val > 0 ? 4 : 0)}%` }} />
              </div>
              <span className="mesDhHBarVal mono">{format(val, r)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function WorkerStatsPanel({
  loading,
  products,
  cells,
}: {
  loading: boolean
  products: StatsProduct[]
  cells: StatsCell[]
}) {
  const [productFilter, setProductFilter] = useState('')

  const aggRows = useMemo(() => {
    const scoped = !productFilter
      ? cells
      : cells.filter((c) => c.productId === Number(productFilter))
    const rows = aggregateByWorker(scoped)
    const totalGood = rows.reduce((s, r) => s + r.goodQty, 0)
    return rows.map((r) => ({
      ...r,
      contributionPct: totalGood > 0 ? Math.round((r.goodQty / totalGood) * 1000) / 10 : 0,
    }))
  }, [cells, productFilter])

  const selectedName = productFilter
    ? products.find((p) => String(p.id) === productFilter)?.productName ?? null
    : null

  if (loading) {
    return <div className="muted mesWorkerAbilityEmpty">통계 로딩 중…</div>
  }

  return (
    <section className="mesWorkerStats" aria-label="작업자 통계">
      <div className="mesWorkerAbilityToolbar">
        <label className="mesWorkerAbilityFilterLabel">
          <span className="muted small">품목</span>
          <select
            className="mesInput mesWorkerAbilitySelect"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            aria-label="품목별 작업자 비교"
          >
            <option value="">전체 (품목 합산)</option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.productName}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small mesWorkerAbilityFilterHint">
          {selectedName ? `${selectedName} · 작업자별 비교` : '전체 품목 실적 합산 비교'}
        </span>
      </div>

      {cells.length === 0 ? (
        <div className="muted mesWorkerAbilityEmpty">집계할 작업 실적이 없습니다.</div>
      ) : (
        <div className="mesDhChartGrid">
          <CompareBarChart
            title={`생산 기여도${selectedName ? ` · ${selectedName}` : ''}`}
            rows={aggRows}
            valueKey="contributionPct"
            format={(v, r) => `${v}% · ${r.goodQty.toLocaleString()}개`}
            barClass="mesWorkerBarFill--good"
            sort="desc"
            bestLabel="최다 생산 기여"
          />
          <CompareBarChart
            title={`불량률 순위 (낮을수록 우수)${selectedName ? ` · ${selectedName}` : ''}`}
            rows={aggRows}
            valueKey="defectPct"
            format={(v) => `${v}%`}
            barClass="mesWorkerBarFill--defect"
            sort="asc"
            bestLabel="최저 불량률"
          />
          <CompareBarChart
            title={`시간당 양품 (효율)${selectedName ? ` · ${selectedName}` : ''}`}
            rows={aggRows}
            valueKey="perHour"
            format={(v) => `${v}개/h`}
            barClass="mesWorkerBarFill--eff"
            sort="desc"
            bestLabel="최고 효율"
          />
          <section className="mesDashChartCard mesWorkerAbilityCard">
            <h3 className="mesWorkerChartTitle">비교 요약</h3>
            <div className="mesWorkerStatsTableWrap">
              <table className="mesTable mesTableCompact">
                <thead>
                  <tr>
                    <th>작업자</th>
                    <th>투입</th>
                    <th>양품</th>
                    <th>불량</th>
                    <th>기여도</th>
                    <th>불량률</th>
                    <th>시간당 양품</th>
                  </tr>
                </thead>
                <tbody>
                  {[...aggRows]
                    .sort((a, b) => b.contributionPct - a.contributionPct || a.defectPct - b.defectPct)
                    .map((r) => (
                      <tr key={r.workerId}>
                        <td>{r.workerName}</td>
                        <td className="mono">{r.inputQty.toLocaleString()}</td>
                        <td className="mono">{r.goodQty.toLocaleString()}</td>
                        <td className="mono">{r.defectQty.toLocaleString()}</td>
                        <td className="mono">{r.contributionPct}%</td>
                        <td className="mono">{r.defectPct}%</td>
                        <td className="mono">{r.perHour != null ? `${r.perHour}/h` : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

type PageTab = 'list' | 'stats'

export function WorkersPage() {
  const [pageTab, setPageTab] = useState<PageTab>('list')
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const [detailWorker, setDetailWorker] = useState<Row | null>(null)
  const [summaryRows, setSummaryRows] = useState<ProductSummaryRow[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summarySaving, setSummarySaving] = useState(false)
  const [workMinutesDraft, setWorkMinutesDraft] = useState<Record<number, string>>({})

  const [statsProducts, setStatsProducts] = useState<StatsProduct[]>([])
  const [statsCells, setStatsCells] = useState<StatsCell[]>([])
  const [statsLoading, setStatsLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/workers')
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; products: StatsProduct[]; cells: StatsCell[] }>(
        '/api/workers/stats/comparison',
      )
      setStatsProducts(data.products)
      setStatsCells(data.cells)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setStatsProducts([])
      setStatsCells([])
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (pageTab === 'stats') void loadStats()
  }, [pageTab, loadStats])

  const openDetail = async (worker: Row) => {
    setDetailWorker(worker)
    setSummaryLoading(true)
    setErr(null)
    try {
      const data = await apiJson<{ ok: boolean; items: ProductSummaryRow[] }>(
        `/api/workers/${worker.id}/product-summary`,
      )
      setSummaryRows(data.items)
      const draft: Record<number, string> = {}
      for (const r of data.items) {
        draft[r.productId] = String(r.workMinutes)
      }
      setWorkMinutesDraft(draft)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setSummaryRows([])
      setWorkMinutesDraft({})
    } finally {
      setSummaryLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailWorker(null)
    setSummaryRows([])
    setWorkMinutesDraft({})
  }

  const saveWorkTimes = async () => {
    if (!detailWorker) return
    setSummarySaving(true)
    setErr(null)
    try {
      const items = summaryRows.map((r) => {
        const raw = workMinutesDraft[r.productId] ?? '0'
        const n = Number(raw.replace(/\D/g, ''))
        return { productId: r.productId, workMinutes: Number.isFinite(n) ? Math.max(0, n) : 0 }
      })
      await apiJson(`/api/workers/${detailWorker.id}/product-work-times`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
      })
      await openDetail(detailWorker)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSummarySaving(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const body = {
        workerCode: form.workerCode.trim(),
        workerName: form.workerName.trim(),
        team: form.team.trim() === '' ? null : form.team.trim(),
        position: form.position.trim() === '' ? null : form.position.trim(),
        skillLevel: form.skillLevel.trim() === '' ? null : form.skillLevel.trim(),
        phone: form.phone.trim() === '' ? null : form.phone.trim(),
        hireDate: form.hireDate.trim() === '' ? null : form.hireDate.trim(),
        status: form.status.trim() || 'ACTIVE',
      }
      if (editingId == null) {
        await apiJson('/api/workers', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/workers/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await load()
      setEditingId(null)
      setForm(empty())
      setPanelOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/workers/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) {
        setEditingId(null)
        setForm(empty())
        setPanelOpen(false)
      }
      if (detailWorker?.id === id) closeDetail()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">작업자</h1>
        <p className="mesPageDesc">현장 작업자 코드 및 팀 정보를 관리합니다.</p>
      </header>

      <div className="mesOpsTopRow" style={{ marginBottom: 12 }}>
        <div className="mesOpsTabs" role="tablist" aria-label="작업자 구역">
          <button
            type="button"
            role="tab"
            aria-selected={pageTab === 'list'}
            className={`mesOpsTab ${pageTab === 'list' ? 'mesOpsTabActive' : ''}`}
            onClick={() => setPageTab('list')}
          >
            작업자 목록
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pageTab === 'stats'}
            className={`mesOpsTab ${pageTab === 'stats' ? 'mesOpsTabActive' : ''}`}
            onClick={() => setPageTab('stats')}
          >
            통계
          </button>
        </div>
        <button
          type="button"
          className="mesBtnSecondary"
          onClick={() => void (pageTab === 'stats' ? loadStats() : load())}
        >
          새로고침
        </button>
        {pageTab === 'list' ? (
          <button
            type="button"
            className="mesBtnPrimary"
            onClick={() => {
              setEditingId(null)
              setForm(empty())
              setPanelOpen(true)
            }}
          >
            새 작업자
          </button>
        ) : null}
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

      {pageTab === 'stats' ? (
        <WorkerStatsPanel loading={statsLoading} products={statsProducts} cells={statsCells} />
      ) : null}

      {pageTab === 'list' ? (
      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>코드</th>
              <th>이름</th>
              <th>팀</th>
              <th>직급</th>
              <th>숙련도</th>
              <th>전화</th>
              <th>입사일</th>
              <th>상태</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td className="mono">{r.workerCode}</td>
                  <td>{r.workerName}</td>
                  <td>{r.team ?? '—'}</td>
                  <td>{r.position ?? '—'}</td>
                  <td>{r.skillLevel ?? '—'}</td>
                  <td className="mono">{r.phone ?? '—'}</td>
                  <td>{r.hireDate ? new Date(r.hireDate).toLocaleDateString() : '—'}</td>
                  <td>{r.status}</td>
                  <td className="mesTdActions">
                    <button type="button" className="mesBtnSm" onClick={() => void openDetail(r)}>
                      상세보기
                    </button>
                    <button
                      type="button"
                      className="mesBtnSm"
                      onClick={() => {
                        setEditingId(r.id)
                        setForm({
                          workerCode: r.workerCode,
                          workerName: r.workerName,
                          team: r.team ?? '',
                          position: r.position ?? '',
                          skillLevel: r.skillLevel ?? '',
                          phone: r.phone ?? '',
                          hireDate: r.hireDate ? new Date(r.hireDate).toISOString().slice(0, 10) : '',
                          status: r.status,
                        })
                        setPanelOpen(true)
                      }}
                    >
                      수정
                    </button>
                    <button type="button" className="mesBtnSm mesBtnDanger" onClick={() => void remove(r.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : null}

      {detailWorker ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeDetail} />
          <div
            className="mesModalDialog mesModalDialogWide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mes-worker-detail-title"
          >
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-worker-detail-title">
                  작업 실적 상세 · {detailWorker.workerName}
                </h2>
                <p className="mesModalMeta muted">
                  {detailWorker.workerCode} · 품목별 투입·양품·불량은 공정 실적 집계, 작업시간은 관리자 수동 입력(분)
                </p>
              </div>
              <div className="mesModalHeadActions">
                <button
                  type="button"
                  className="mesBtnPrimary"
                  disabled={summaryLoading || summarySaving}
                  onClick={() => void saveWorkTimes()}
                >
                  {summarySaving ? '저장 중…' : '작업시간 저장'}
                </button>
                <button type="button" className="mesBtnSecondary" onClick={closeDetail}>
                  닫기
                </button>
              </div>
            </div>
            <div className="mesModalBody">
              <WorkerAbilityPanel
                rows={summaryRows}
                workMinutesDraft={workMinutesDraft}
                loading={summaryLoading}
              />
              <div className="mesTableWrap mesTableScroll" style={{ maxHeight: 'min(50vh, 420px)', marginTop: 12 }}>
                <table className="mesTable">
                  <thead>
                    <tr>
                      <th>품목</th>
                      <th>구분</th>
                      <th>투입</th>
                      <th>양품</th>
                      <th>불량</th>
                      <th>작업시간 (분)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryLoading ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          로딩 중…
                        </td>
                      </tr>
                    ) : summaryRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          등록된 생산 품목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      summaryRows.map((r) => {
                        const hasActivity = r.inputQty > 0 || r.goodQty > 0 || r.defectQty > 0
                        const wm = workMinutesDraft[r.productId] ?? '0'
                        return (
                          <tr key={r.productId} className={hasActivity ? 'mesTrHighlight' : undefined}>
                            <td>
                              <div>{r.productName}</div>
                              <div className="muted small mono">{r.productCode}</div>
                            </td>
                            <td>{itemTypeLabel(r.itemType)}</td>
                            <td>{r.inputQty.toLocaleString()}</td>
                            <td>{r.goodQty.toLocaleString()}</td>
                            <td>{r.defectQty.toLocaleString()}</td>
                            <td>
                              <input
                                className="mesInput mesWorkerMinutesInput"
                                inputMode="numeric"
                                aria-label={`${r.productName} 작업시간(분)`}
                                value={wm}
                                onChange={(ev) =>
                                  setWorkMinutesDraft((d) => ({
                                    ...d,
                                    [r.productId]: ev.target.value.replace(/\D/g, ''),
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button
            type="button"
            className="mesModalBackdrop"
            aria-label="닫기"
            onClick={() => {
              setEditingId(null)
              setForm(empty())
              setPanelOpen(false)
            }}
          />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-worker-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-worker-modal-title">
                  {editingId == null ? '작업자 등록' : `작업자 수정 (ID ${editingId})`}
                </h2>
              </div>
              <div className="mesModalHeadActions">
                <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button
                  type="button"
                  className="mesBtnSecondary"
                  onClick={() => {
                    setEditingId(null)
                    setForm(empty())
                    setPanelOpen(false)
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="mesBtnGhost"
                  onClick={() => {
                    setEditingId(null)
                    setForm(empty())
                    setPanelOpen(false)
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  사번/코드
                  <input className="mesInput" value={form.workerCode} onChange={(ev) => setForm((f) => ({ ...f, workerCode: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  이름
                  <input className="mesInput" value={form.workerName} onChange={(ev) => setForm((f) => ({ ...f, workerName: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  상태
                  <input className="mesInput" value={form.status} onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  팀
                  <input className="mesInput" value={form.team} onChange={(ev) => setForm((f) => ({ ...f, team: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  직급
                  <input className="mesInput" value={form.position} onChange={(ev) => setForm((f) => ({ ...f, position: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  숙련도
                  <input className="mesInput" value={form.skillLevel} onChange={(ev) => setForm((f) => ({ ...f, skillLevel: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  전화
                  <input className="mesInput" value={form.phone} onChange={(ev) => setForm((f) => ({ ...f, phone: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  입사일
                  <input className="mesInput" type="date" value={form.hireDate} onChange={(ev) => setForm((f) => ({ ...f, hireDate: ev.target.value }))} />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
