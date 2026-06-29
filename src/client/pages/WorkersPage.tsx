import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import { itemTypeLabel } from '../lib/itemType'
import '../workers-page.css'
import { WorkerFormModal, statusBadgeClass, type WorkerFormState } from '../ui/WorkerFormModal'

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

const PAGE_SIZE = 20

const empty = (): WorkerFormState => ({
  workerCode: '',
  workerName: '',
  team: '',
  position: '',
  skillLevel: '',
  phone: '',
  hireDate: '',
  status: 'ACTIVE',
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

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

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
  barVariant,
  sort,
  bestLabel,
}: {
  title: string
  rows: WorkerAggRow[]
  valueKey: 'contributionPct' | 'defectPct' | 'perHour'
  format: (v: number, r: WorkerAggRow) => string
  barVariant: 'good' | 'defect' | 'eff'
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
      <section className="mesWrStatsCard">
        <h3 className="mesWrStatsCardTitle">{title}</h3>
        <div className="mesWrStatsEmpty">비교할 데이터가 없습니다.</div>
      </section>
    )
  }

  const max = Math.max(
    1,
    ...data.map((r) => (valueKey === 'perHour' ? (r.perHour ?? 0) : r[valueKey])),
  )
  const best = data[0]

  return (
    <section className="mesWrStatsCard">
      <h3 className="mesWrStatsCardTitle">{title}</h3>
      {best ? (
        <p className="mesWrStatsBest">
          {bestLabel}: <strong>{best.workerName}</strong> ({format(valueKey === 'perHour' ? (best.perHour ?? 0) : best[valueKey], best)})
        </p>
      ) : null}
      <div className="mesWrBarChart">
        {data.map((r, i) => {
          const val = valueKey === 'perHour' ? (r.perHour ?? 0) : r[valueKey]
          const pct = Math.round((val / max) * 100)
          return (
            <div
              key={r.workerId}
              className={`mesWrBarRow${i === 0 ? ' mesWrBarRow--best' : ''}`}
              title={`${r.workerName} · 투입 ${r.inputQty} · 양품 ${r.goodQty} · 불량 ${r.defectQty}`}
            >
              <span className="mesWrBarRank">{i + 1}</span>
              <span className="mesWrBarLabel">{r.workerName}</span>
              <div className="mesWrBarTrack">
                <div className={`mesWrBarFill mesWrBarFill--${barVariant}`} style={{ width: `${Math.max(pct, val > 0 ? 4 : 0)}%` }} />
              </div>
              <span className="mesWrBarVal mono">{format(val, r)}</span>
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
    return <div className="mesWrStatsEmpty mesWrStatsEmpty--page">통계 로딩 중…</div>
  }

  return (
    <section className="mesWrStatsPanel" aria-label="작업자 통계">
      <div className="mesWrFilterCard mesWrStatsFilter">
        <div className="mesWrField mesWrField--select" style={{ flex: '1 1 280px' }}>
          <span className="mesWrFieldLabel">품목</span>
          <select
            className="mesWrSelect"
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
        </div>
        <div className="mesWrStatsFilterHint">
          {selectedName ? `${selectedName} · 작업자별 비교` : '전체 품목 실적 합산 비교'}
          {aggRows.length > 0 ? <span className="mesWrStatsFilterCount"> · {aggRows.length}명</span> : null}
        </div>
      </div>

      {cells.length === 0 ? (
        <div className="mesWrStatsEmpty mesWrStatsEmpty--page">집계할 작업 실적이 없습니다.</div>
      ) : (
        <div className="mesWrStatsGrid">
          <CompareBarChart
            title={`생산 기여도${selectedName ? ` · ${selectedName}` : ''}`}
            rows={aggRows}
            valueKey="contributionPct"
            format={(v, r) => `${v}% · ${r.goodQty.toLocaleString()}개`}
            barVariant="good"
            sort="desc"
            bestLabel="최다 생산 기여"
          />
          <CompareBarChart
            title={`불량률 순위 (낮을수록 우수)${selectedName ? ` · ${selectedName}` : ''}`}
            rows={aggRows}
            valueKey="defectPct"
            format={(v) => `${v}%`}
            barVariant="defect"
            sort="asc"
            bestLabel="최저 불량률"
          />
          <CompareBarChart
            title={`시간당 양품 (효율)${selectedName ? ` · ${selectedName}` : ''}`}
            rows={aggRows}
            valueKey="perHour"
            format={(v) => `${v}개/h`}
            barVariant="eff"
            sort="desc"
            bestLabel="최고 효율"
          />
          <section className="mesWrStatsCard mesWrStatsCard--table">
            <h3 className="mesWrStatsCardTitle">비교 요약</h3>
            <div className="mesWrStatsTableWrap">
              <table className="mesWrStatsTable">
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
                    .map((r, i) => (
                      <tr key={r.workerId} className={i === 0 ? 'mesWrStatsTableRow--top' : undefined}>
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
  const [form, setForm] = useState<WorkerFormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [draftFilters, setDraftFilters] = useState({ q: '', team: '', status: '' })
  const [filters, setFilters] = useState({ q: '', team: '', status: '' })

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

  const teams = useMemo(
    () => [...new Set(items.map((r) => r.team).filter((t): t is string => t != null && t.trim() !== ''))].sort((a, b) => a.localeCompare(b, 'ko')),
    [items],
  )

  const filtered = useMemo(() => {
    let rows = [...items]
    if (filters.team) rows = rows.filter((r) => (r.team ?? '') === filters.team)
    if (filters.status) rows = rows.filter((r) => r.status === filters.status)
    const q = filters.q.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.workerCode} ${r.workerName} ${r.team ?? ''} ${r.position ?? ''} ${r.phone ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows.sort((a, b) => a.workerCode.localeCompare(b.workerCode, 'ko'))
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
    setForm(empty())
    setPanelOpen(false)
  }

  const openNew = () => {
    setEditingId(null)
    setForm(empty())
    setPanelOpen(true)
  }

  const openEdit = (r: Row) => {
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
  }

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const emptyFilters = { q: '', team: '', status: '' }
    setDraftFilters(emptyFilters)
    setFilters(emptyFilters)
    setPage(1)
  }

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
      resetPanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number, ev?: MouseEvent) => {
    ev?.stopPropagation()
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/workers/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) resetPanel()
      if (detailWorker?.id === id) closeDetail()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const selectedRowId = panelOpen && editingId != null ? editingId : null

  return (
    <div className="mesPage mesPageWide mesWorkersPage">
      <header className="mesWrHead">
        <div>
          <h1 className="mesWrTitle">작업자</h1>
          <p className="mesWrDesc">현장 작업자 코드 및 팀 정보를 관리합니다.</p>
        </div>
        <div className="mesWrTopActions">
          {pageTab === 'list' ? (
            <>
              <span className="mesWrCountBadge">{loading ? '…' : `${filtered.length}건`}</span>
              <button type="button" className="mesWrBtn mesWrBtn--primary" onClick={openNew}>
                <IconPlus />
                새 작업자
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="mesWrBtn mesWrBtn--secondary"
            onClick={() => void (pageTab === 'stats' ? loadStats() : load())}
          >
            <IconRefresh />
            새로고침
          </button>
        </div>
      </header>

      <div className="mesWrTopRow">
        <div className="mesWrTabs" role="tablist" aria-label="작업자 구역">
          <button
            type="button"
            role="tab"
            aria-selected={pageTab === 'list'}
            className={`mesWrTab${pageTab === 'list' ? ' mesWrTab--active' : ''}`}
            onClick={() => setPageTab('list')}
          >
            작업자 목록
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pageTab === 'stats'}
            className={`mesWrTab${pageTab === 'stats' ? ' mesWrTab--active' : ''}`}
            onClick={() => setPageTab('stats')}
          >
            통계
          </button>
        </div>
      </div>

      {err ? (
        <div className="mesNotice mesNoticeError" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">×</button>
        </div>
      ) : null}

      {pageTab === 'stats' ? (
        <WorkerStatsPanel loading={statsLoading} products={statsProducts} cells={statsCells} />
      ) : null}

      {pageTab === 'list' ? (
        <>
          <div className="mesWrFilterCard">
            <div className="mesWrField mesWrField--search">
              <span className="mesWrFieldLabel">검색</span>
              <div className="mesWrInputWrap">
                <span className="mesWrInputIcon"><IconSearch /></span>
                <input
                  className="mesWrInput mesWrInput--search"
                  placeholder="코드 / 이름 / 팀 / 직급 / 전화"
                  value={draftFilters.q}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
                />
              </div>
            </div>
            <div className="mesWrField mesWrField--select">
              <span className="mesWrFieldLabel">팀</span>
              <select
                className="mesWrSelect"
                value={draftFilters.team}
                onChange={(e) => setDraftFilters((f) => ({ ...f, team: e.target.value }))}
              >
                <option value="">전체</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="mesWrField mesWrField--select">
              <span className="mesWrFieldLabel">상태</span>
              <select
                className="mesWrSelect"
                value={draftFilters.status}
                onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">전체</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="mesWrFilterActions">
              <button type="button" className="mesWrBtn mesWrBtn--secondary" onClick={resetFilters}>
                <IconReset />
                필터 초기화
              </button>
              <button type="button" className="mesWrBtn mesWrBtn--primary" onClick={applyFilters}>
                <IconFilter />
                필터 적용
              </button>
            </div>
          </div>

          <div className="mesWrTableCard">
            <div className="mesWrTableViewport">
              <table className="mesWrTable">
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
                    <th className="mesWrThActions">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} className="mesWrEmpty">로딩 중…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={10} className="mesWrEmpty">데이터가 없습니다. <strong>새 작업자</strong>로 추가하세요.</td></tr>
                  ) : (
                    pageItems.map((r) => (
                      <tr
                        key={r.id}
                        className={selectedRowId === r.id ? 'mesWrRowSelected' : undefined}
                        onClick={() => openEdit(r)}
                      >
                        <td className="mono">{r.id}</td>
                        <td className="mono">{r.workerCode}</td>
                        <td>{r.workerName}</td>
                        <td>{r.team ?? '—'}</td>
                        <td>{r.position ?? '—'}</td>
                        <td>{r.skillLevel ?? '—'}</td>
                        <td className="mono">{r.phone ?? '—'}</td>
                        <td>{r.hireDate ? new Date(r.hireDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <span className={statusBadgeClass(r.status)}>{r.status}</span>
                        </td>
                        <td className="mesWrTdActions">
                          <div className="mesWrRowActions">
                            <button
                              type="button"
                              className="mesWrActionBtn"
                              onClick={(e) => { e.stopPropagation(); void openDetail(r) }}
                            >
                              <IconEye />
                              상세
                            </button>
                            <button
                              type="button"
                              className="mesWrActionBtn"
                              onClick={(e) => { e.stopPropagation(); openEdit(r) }}
                            >
                              <IconEdit />
                              수정
                            </button>
                            <button
                              type="button"
                              className="mesWrActionBtn mesWrActionBtn--danger"
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
            <footer className="mesWrPager">
              <span>총 {filtered.length}건</span>
              <nav className="mesWrPagerNav" aria-label="페이지">
                <button type="button" className="mesWrPagerBtn" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
                <button type="button" className="mesWrPagerBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
                  .map((n, idx, arr) => {
                    const prev = arr[idx - 1]
                    const ellipsis = prev != null && n - prev > 1
                    return (
                      <span key={n} style={{ display: 'contents' }}>
                        {ellipsis ? <span className="mesWrPagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}
                        <button
                          type="button"
                          className={`mesWrPagerBtn${n === safePage ? ' mesWrPagerBtn--active' : ''}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      </span>
                    )
                  })}
                <button type="button" className="mesWrPagerBtn" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</button>
                <button type="button" className="mesWrPagerBtn" disabled={safePage >= pages} onClick={() => setPage(pages)}>»</button>
              </nav>
              <select
                className="mesWrSelect"
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

          <WorkerFormModal
            open={panelOpen}
            editingId={editingId}
            saving={saving}
            form={form}
            setForm={setForm}
            onSave={() => void save()}
            onClose={resetPanel}
          />
        </>
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
    </div>
  )
}
