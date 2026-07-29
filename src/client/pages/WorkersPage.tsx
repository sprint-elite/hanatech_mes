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

type ProductProcessSummaryRow = {
  processId: number
  processCode: string
  processName: string
  sequence: number
  standardTime: number | null
  baseQty: number | null
  inputQty: number
  goodQty: number
  defectQty: number
  workMinutes: number
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
  processes: ProductProcessSummaryRow[]
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

function fmtSeconds(sec: number): string {
  const rounded = Math.round(sec * 10000) / 10000
  return rounded.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
}

function fmtStandardLabel(standardTime: number | null, baseQty: number | null): string {
  if (standardTime == null || baseQty == null) return '표준 미등록'
  return `${fmtSeconds(standardTime)}초 / ${baseQty.toLocaleString('ko-KR')}개`
}

function fmtProductStandardSummary(processes: ProductProcessSummaryRow[]): string {
  const withStd = processes.filter((p) => p.standardTime != null && p.baseQty != null)
  if (withStd.length === 0) return '—'
  const totalSec = withStd.reduce((s, p) => s + (p.standardTime ?? 0), 0)
  return `${fmtSeconds(totalSec)}초 (${withStd.length}공정)`
}

function sumDraftWorkMinutes(processes: ProductProcessSummaryRow[], draft: Record<number, string>): number {
  return processes.reduce((s, p) => {
    const n = Number((draft[p.processId] ?? '0').replace(/\D/g, '') || 0)
    return s + (Number.isFinite(n) ? n : 0)
  }, 0)
}

function processMinutesFromDraft(processId: number, draft: Record<number, string>): number {
  const n = Number((draft[processId] ?? '0').replace(/\D/g, '') || 0)
  return Number.isFinite(n) ? n : 0
}

function qtyBasisForEfficiency(goodQty: number, inputQty: number): number {
  if (goodQty > 0) return goodQty
  if (inputQty > 0) return inputQty
  return 0
}

function fmtWorkEfficiency(
  workMinutes: number,
  goodQty: number,
  inputQty: number,
  standardTime: number | null,
  baseQty: number | null,
): string {
  const qty = qtyBasisForEfficiency(goodQty, inputQty)
  if (workMinutes <= 0 || qty <= 0) return '—'
  const secPerUnit = (workMinutes * 60) / qty
  const secLabel = `${fmtSeconds(secPerUnit)}초/개`
  if (standardTime == null || baseQty == null || baseQty <= 0) return secLabel
  const stdSecPerUnit = standardTime / baseQty
  const effPct = stdSecPerUnit > 0 ? Math.round((stdSecPerUnit / secPerUnit) * 1000) / 10 : 0
  return `${secLabel} · 효율 ${effPct}%`
}

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type WorkTimeEntryDraft = {
  productionLotId: number | null
  workDate: string
  planNo: string
  woNo: string
  lotNo: string
  inputQty: string
  goodQty: string
  defectQty: string
  workMinutes: string
}

function workTimeRowKey(row: WorkTimeEntryDraft): string {
  return row.productionLotId != null ? `lot:${row.productionLotId}` : `date:${row.workDate}`
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
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
      let minutes = 0
      for (const p of r.processes ?? []) {
        const wm = Number(workMinutesDraft[p.processId]?.replace(/\D/g, '') || 0)
        minutes += Number.isFinite(wm) ? wm : 0
      }
      return {
        input: a.input + r.inputQty,
        good: a.good + r.goodQty,
        defect: a.defect + r.defectQty,
        minutes: a.minutes + minutes,
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

type StatsProcessCell = {
  workerId: number
  workerName: string
  productId: number
  processId: number
  processCode: string
  processName: string
  sequence: number
  inputQty: number
  goodQty: number
  defectQty: number
  workMinutes: number
  secPerUnit: number | null
  standardSecPerUnit: number | null
  efficiencyPct: number | null
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
              <span className="mesWrBarLabel mesWrBarLabel--full">{r.workerName}</span>
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

type ProcessChartFilters = {
  productId: string
  processId: string
  workerId: string
}

type ProcessGroup = {
  processId: number
  sequence: number
  processName: string
  processCode: string
  standardSecPerUnit: number | null
  rows: StatsProcessCell[]
}

function productOptionsFromCells(processCells: StatsProcessCell[], products: StatsProduct[]) {
  const ids = new Set(processCells.map((c) => c.productId))
  return products.filter((p) => ids.has(p.id))
}

function processOptionsFromCells(processCells: StatsProcessCell[], productId: number) {
  const map = new Map<number, { id: number; sequence: number; name: string; code: string }>()
  for (const c of processCells) {
    if (c.productId !== productId) continue
    if (!map.has(c.processId)) {
      map.set(c.processId, { id: c.processId, sequence: c.sequence, name: c.processName, code: c.processCode })
    }
  }
  return [...map.values()].sort((a, b) => a.sequence - b.sequence)
}

function workerOptionsFromCells(
  processCells: StatsProcessCell[],
  productId: number,
  processId: string,
) {
  const map = new Map<number, string>()
  for (const c of processCells) {
    if (c.productId !== productId) continue
    if (processId && c.processId !== Number(processId)) continue
    map.set(c.workerId, c.workerName)
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

function buildProcessGroups(
  processCells: StatsProcessCell[],
  filters: ProcessChartFilters,
  requireSecPerUnit: boolean,
): ProcessGroup[] {
  const productId = filters.productId ? Number(filters.productId) : null
  if (productId == null || !Number.isFinite(productId)) return []

  let scoped = processCells.filter((c) => c.productId === productId)
  if (filters.processId) scoped = scoped.filter((c) => c.processId === Number(filters.processId))
  if (filters.workerId) scoped = scoped.filter((c) => c.workerId === Number(filters.workerId))

  const byProcess = new Map<number, StatsProcessCell[]>()
  for (const c of scoped) {
    if (requireSecPerUnit && (c.secPerUnit == null || c.secPerUnit <= 0)) continue
    const list = byProcess.get(c.processId) ?? []
    list.push(c)
    byProcess.set(c.processId, list)
  }

  return [...byProcess.entries()]
    .map(([processId, rows]) => ({
      processId,
      sequence: rows[0]!.sequence,
      processName: rows[0]!.processName,
      processCode: rows[0]!.processCode,
      standardSecPerUnit: rows[0]!.standardSecPerUnit,
      rows,
    }))
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => a.sequence - b.sequence)
}

function ProcessChartFilterRow({
  idPrefix,
  filters,
  onChange,
  productList,
  processCells,
}: {
  idPrefix: string
  filters: ProcessChartFilters
  onChange: (next: ProcessChartFilters) => void
  productList: StatsProduct[]
  processCells: StatsProcessCell[]
}) {
  const productIdNum = filters.productId ? Number(filters.productId) : null
  const processOpts =
    productIdNum != null && Number.isFinite(productIdNum)
      ? processOptionsFromCells(processCells, productIdNum)
      : []
  const workerOpts =
    productIdNum != null && Number.isFinite(productIdNum)
      ? workerOptionsFromCells(processCells, productIdNum, filters.processId)
      : []

  const setProduct = (productId: string) => {
    onChange({ productId, processId: '', workerId: '' })
  }
  const setProcess = (processId: string) => {
    onChange({ ...filters, processId, workerId: '' })
  }
  const setWorker = (workerId: string) => {
    onChange({ ...filters, workerId })
  }

  return (
    <div className="mesWrStatsCardFilters">
      <label className="mesWrStatsCardFilter" htmlFor={`${idPrefix}-product`}>
        <span className="mesWrFieldLabel">생산품</span>
        <select
          id={`${idPrefix}-product`}
          className="mesWrSelect mesWrStatsCardSelect"
          value={filters.productId}
          onChange={(e) => setProduct(e.target.value)}
          aria-label="생산품 필터"
        >
          <option value="">선택</option>
          {productList.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.productName}
            </option>
          ))}
        </select>
      </label>
      <label className="mesWrStatsCardFilter" htmlFor={`${idPrefix}-process`}>
        <span className="mesWrFieldLabel">공정</span>
        <select
          id={`${idPrefix}-process`}
          className="mesWrSelect mesWrStatsCardSelect"
          value={filters.processId}
          onChange={(e) => setProcess(e.target.value)}
          disabled={!filters.productId || processOpts.length === 0}
          aria-label="공정 필터"
        >
          <option value="">전체 공정</option>
          {processOpts.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.sequence}. {p.name} ({p.code})
            </option>
          ))}
        </select>
      </label>
      <label className="mesWrStatsCardFilter" htmlFor={`${idPrefix}-worker`}>
        <span className="mesWrFieldLabel">작업자</span>
        <select
          id={`${idPrefix}-worker`}
          className="mesWrSelect mesWrStatsCardSelect"
          value={filters.workerId}
          onChange={(e) => setWorker(e.target.value)}
          disabled={!filters.productId || workerOpts.length === 0}
          aria-label="작업자 필터"
        >
          <option value="">전체 작업자</option>
          {workerOpts.map((w) => (
            <option key={w.id} value={String(w.id)}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function ProcessEfficiencyCharts({
  products,
  defaultProductId,
  processCells,
}: {
  products: StatsProduct[]
  defaultProductId: number | null
  processCells: StatsProcessCell[]
}) {
  const emptyFilters = (): ProcessChartFilters => ({ productId: '', processId: '', workerId: '' })

  const [secFilters, setSecFilters] = useState<ProcessChartFilters>(emptyFilters)
  const [effFilters, setEffFilters] = useState<ProcessChartFilters>(emptyFilters)

  const productList = useMemo(() => productOptionsFromCells(processCells, products), [processCells, products])

  useEffect(() => {
    if (defaultProductId == null) return
    const id = String(defaultProductId)
    setSecFilters({ productId: id, processId: '', workerId: '' })
    setEffFilters({ productId: id, processId: '', workerId: '' })
  }, [defaultProductId])

  const secGroups = useMemo(
    () => buildProcessGroups(processCells, secFilters, true),
    [processCells, secFilters],
  )

  const effGroups = useMemo(() => buildProcessGroups(processCells, effFilters, true), [processCells, effFilters])

  const effRows = useMemo(() => {
    return effGroups
      .flatMap((g) => g.rows.filter((r) => r.efficiencyPct != null))
      .sort((a, b) => (b.efficiencyPct ?? 0) - (a.efficiencyPct ?? 0))
      .slice(0, 12)
  }, [effGroups])

  const secProductName = productList.find((p) => String(p.id) === secFilters.productId)?.productName

  return (
    <>
      <section className="mesWrStatsCard">
        <h3 className="mesWrStatsCardTitle">공정별 개당 작업시간(초)</h3>
        <ProcessChartFilterRow
          idPrefix="mes-stats-sec"
          filters={secFilters}
          onChange={setSecFilters}
          productList={productList}
          processCells={processCells}
        />
        <p className="mesWrStatsBest muted small">작업시간(분)×60 ÷ 양품(없으면 투입) · 작업자 비교</p>
        {!secFilters.productId ? (
          <div className="mesWrStatsEmpty">생산품을 선택하세요.</div>
        ) : secGroups.length === 0 ? (
          <div className="mesWrStatsEmpty">조건에 맞는 작업시간 데이터가 없습니다.</div>
        ) : (
          <div className="mesWrProcessChartStack">
            {secGroups.map((g) => {
              const std =
                g.standardSecPerUnit != null
                  ? `표준 ${fmtSeconds(g.standardSecPerUnit)}초/개`
                  : '표준 미등록'
              const localMax = Math.max(1, ...g.rows.map((r) => r.secPerUnit ?? 0))
              return (
                <div key={g.processId} className="mesWrProcessChartGroup">
                  <div className="mesWrProcessChartHead">
                    <span className="mesWrProcessChartTitle">
                      {g.sequence}. {g.processName}
                    </span>
                    <span className="muted small mono">
                      {g.processCode} · {std}
                      {secProductName ? ` · ${secProductName}` : ''}
                    </span>
                  </div>
                  <div className="mesWrBarChart">
                    {g.rows
                      .sort((a, b) => (a.secPerUnit ?? 0) - (b.secPerUnit ?? 0))
                      .map((r, i) => {
                        const val = r.secPerUnit ?? 0
                        const pct = Math.round((val / localMax) * 100)
                        return (
                          <div
                            key={r.workerId}
                            className={`mesWrBarRow mesWrBarRow--plain${i === 0 ? ' mesWrBarRow--best' : ''}`}
                          >
                            <span className="mesWrBarLabel mesWrBarLabel--full">{r.workerName}</span>
                            <div className="mesWrBarTrack">
                              <div className="mesWrBarFill mesWrBarFill--eff" style={{ width: `${Math.max(pct, 4)}%` }} />
                            </div>
                            <span className="mesWrBarVal mono">{fmtSeconds(val)}초</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mesWrStatsCard">
        <h3 className="mesWrStatsCardTitle">공정별 표준 대비 효율(%)</h3>
        <ProcessChartFilterRow
          idPrefix="mes-stats-eff"
          filters={effFilters}
          onChange={setEffFilters}
          productList={productList}
          processCells={processCells}
        />
        {!effFilters.productId ? (
          <div className="mesWrStatsEmpty">생산품을 선택하세요.</div>
        ) : effRows.length === 0 ? (
          <div className="mesWrStatsEmpty">조건에 맞는 표준 대비 효율 데이터가 없습니다.</div>
        ) : (
          <>
            {effRows[0] ? (
              <p className="mesWrStatsBest">
                최고 효율: <strong>{effRows[0].workerName}</strong> ({effRows[0].efficiencyPct}%)
              </p>
            ) : null}
            <div className="mesWrBarChart">
              {effRows.map((r, i) => {
                const val = r.efficiencyPct ?? 0
                const pct = Math.min(100, Math.round(val))
                return (
                  <div
                    key={`${r.processId}-${r.workerId}`}
                    className={`mesWrBarRow${i === 0 ? ' mesWrBarRow--best' : ''}`}
                  >
                    <span className="mesWrBarRank">{i + 1}</span>
                    <span className="mesWrBarLabel mesWrBarLabel--full">{r.workerName}</span>
                    <div className="mesWrBarTrack">
                      <div className="mesWrBarFill mesWrBarFill--good" style={{ width: `${Math.max(pct, val > 0 ? 4 : 0)}%` }} />
                    </div>
                    <span className="mesWrBarVal mono">{val}%</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </>
  )
}

function WorkerStatsPanel({
  loading,
  products,
  cells,
  processCells,
}: {
  loading: boolean
  products: StatsProduct[]
  cells: StatsCell[]
  processCells: StatsProcessCell[]
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

  const chartProductId = useMemo(() => {
    if (productFilter) return Number(productFilter)
    const totals = new Map<number, number>()
    for (const c of processCells) {
      totals.set(c.productId, (totals.get(c.productId) ?? 0) + c.goodQty)
    }
    let bestId: number | null = null
    let bestGood = 0
    for (const [id, good] of totals) {
      if (good > bestGood) {
        bestGood = good
        bestId = id
      }
    }
    return bestId
  }, [productFilter, processCells])

  const chartProductName = useMemo(() => {
    if (chartProductId == null) return null
    return products.find((p) => p.id === chartProductId)?.productName ?? null
  }, [chartProductId, products])

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
          {chartProductName && !productFilter ? (
            <span className="mesWrStatsFilterCount muted"> · 공정 차트: {chartProductName}</span>
          ) : null}
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
          <div className="mesWrStatsProcessRow">
            <ProcessEfficiencyCharts
              products={products}
              defaultProductId={chartProductId}
              processCells={processCells}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function WorkTimeEntryModal({
  open,
  workerName,
  process,
  rows,
  loading,
  saving,
  onChangeRows,
  onSave,
  onClose,
}: {
  open: boolean
  workerName: string
  process: ProductProcessSummaryRow
  rows: WorkTimeEntryDraft[]
  loading: boolean
  saving: boolean
  onChangeRows: (rows: WorkTimeEntryDraft[]) => void
  onSave: () => void
  onClose: () => void
}) {
  if (!open) return null

  const totalMinutes = rows.reduce((s, r) => s + Number(digitsOnly(r.workMinutes) || 0), 0)

  return (
    <div className="mesModalRoot mesModalRootNested" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => !saving && onClose()} />
      <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true">
        <div className="mesModalHead">
          <div>
            <h2 className="mesModalTitle">
              작업시간 입력 · {process.processName}
            </h2>
            <p className="mesModalMeta muted">
              {workerName} · 투입·양품·불량은 공정 실적(LOT별) 자동 집계, 작업시간(분)만 입력. 합계{' '}
              {totalMinutes.toLocaleString()}분
            </p>
          </div>
          <div className="mesModalHeadActions">
            <button type="button" className="mesBtnPrimary" disabled={saving || loading} onClick={() => void onSave()}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" className="mesBtnSecondary" disabled={saving} onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
        <div className="mesModalBody">
          {loading ? (
            <p className="muted">불러오는 중…</p>
          ) : (
            <>
              <div className="mesTableWrap mesTableScroll" style={{ maxHeight: 'min(50vh, 400px)' }}>
                <table className="mesTable mesTableCompact">
                  <thead>
                    <tr>
                      <th>작업일</th>
                      <th>생산계획</th>
                      <th>작업지시</th>
                      <th>생산 LOT</th>
                      <th>투입</th>
                      <th>양품</th>
                      <th>불량</th>
                      <th>작업시간 (분)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="muted">
                          해당 공정에 실적이 있는 LOT가 없습니다. 현장 실적 입력 후 다시 열어 주세요.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={workTimeRowKey(row)}>
                          <td className="mono">{row.workDate}</td>
                          <td className="mono">{row.planNo || '—'}</td>
                          <td className="mono">{row.woNo || '—'}</td>
                          <td className="mono">{row.lotNo || '—'}</td>
                          <td className="mono">{Number(row.inputQty || 0).toLocaleString()}</td>
                          <td className="mono">{Number(row.goodQty || 0).toLocaleString()}</td>
                          <td className="mono">{Number(row.defectQty || 0).toLocaleString()}</td>
                          <td>
                            <input
                              className="mesInput mesWorkerMinutesInput"
                              inputMode="numeric"
                              aria-label={`${row.lotNo || row.workDate} 작업시간(분)`}
                              value={row.workMinutes}
                              onChange={(ev) => {
                                const next = [...rows]
                                next[idx] = { ...row, workMinutes: digitsOnly(ev.target.value) }
                                onChangeRows(next)
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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
  const [workMinutesDraft, setWorkMinutesDraft] = useState<Record<number, string>>({})
  const [processModalProduct, setProcessModalProduct] = useState<ProductSummaryRow | null>(null)
  const [workTimeEntryTarget, setWorkTimeEntryTarget] = useState<{
    process: ProductProcessSummaryRow
    product: ProductSummaryRow
  } | null>(null)
  const [workTimeEntryRows, setWorkTimeEntryRows] = useState<WorkTimeEntryDraft[]>([])
  const [workTimeEntryLoading, setWorkTimeEntryLoading] = useState(false)
  const [workTimeEntrySaving, setWorkTimeEntrySaving] = useState(false)

  const [statsProducts, setStatsProducts] = useState<StatsProduct[]>([])
  const [statsCells, setStatsCells] = useState<StatsCell[]>([])
  const [statsProcessCells, setStatsProcessCells] = useState<StatsProcessCell[]>([])
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
      const data = await apiJson<{
        ok: boolean
        products: StatsProduct[]
        cells: StatsCell[]
        processCells: StatsProcessCell[]
      }>('/api/workers/stats/comparison')
      setStatsProducts(data.products)
      setStatsCells(data.cells)
      setStatsProcessCells(data.processCells ?? [])
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setStatsProducts([])
      setStatsCells([])
      setStatsProcessCells([])
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
      setSummaryRows(
        data.items.map((r) => ({
          ...r,
          processes: r.processes ?? [],
        })),
      )
      const draft: Record<number, string> = {}
      for (const r of data.items) {
        for (const p of r.processes ?? []) {
          draft[p.processId] = String(p.workMinutes)
        }
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
    setProcessModalProduct(null)
    setWorkTimeEntryTarget(null)
    setWorkTimeEntryRows([])
  }

  const openWorkTimeEntry = async (product: ProductSummaryRow, process: ProductProcessSummaryRow) => {
    if (!detailWorker) return
    setWorkTimeEntryTarget({ product, process })
    setWorkTimeEntryLoading(true)
    setWorkTimeEntryRows([])
    try {
      const data = await apiJson<{
        ok: boolean
        items: Array<{
          productionLotId: number | null
          workDate: string
          planNo: string | null
          woNo: string | null
          lotNo: string | null
          inputQty: number
          goodQty: number
          defectQty: number
          workMinutes: number
        }>
      }>(`/api/workers/${detailWorker.id}/process-work-time-entries?processId=${process.processId}`)
      const rows = data.items.map((e) => ({
        productionLotId: e.productionLotId,
        workDate: e.workDate,
        planNo: e.planNo ?? '',
        woNo: e.woNo ?? '',
        lotNo: e.lotNo ?? '',
        inputQty: String(e.inputQty),
        goodQty: String(e.goodQty),
        defectQty: String(e.defectQty),
        workMinutes: String(e.workMinutes),
      }))
      setWorkTimeEntryRows(rows)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setWorkTimeEntryRows([])
    } finally {
      setWorkTimeEntryLoading(false)
    }
  }

  const closeWorkTimeEntry = () => {
    if (workTimeEntrySaving) return
    setWorkTimeEntryTarget(null)
    setWorkTimeEntryRows([])
  }

  const saveWorkTimeEntries = async () => {
    if (!detailWorker || !workTimeEntryTarget) return
    setWorkTimeEntrySaving(true)
    setErr(null)
    try {
      const entries = workTimeEntryRows.map((r) => ({
        productionLotId: r.productionLotId,
        workDate: r.workDate,
        workMinutes: Number(digitsOnly(r.workMinutes) || 0),
      }))
      const res = await apiJson<{ ok: boolean; workMinutes: number }>(
        `/api/workers/${detailWorker.id}/process-work-time-entries`,
        {
          method: 'PUT',
          body: JSON.stringify({
            processId: workTimeEntryTarget.process.processId,
            entries,
          }),
        },
      )
      const pid = workTimeEntryTarget.process.processId
      setWorkMinutesDraft((d) => ({ ...d, [pid]: String(res.workMinutes ?? 0) }))
      closeWorkTimeEntry()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setWorkTimeEntrySaving(false)
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
        <WorkerStatsPanel
          loading={statsLoading}
          products={statsProducts}
          cells={statsCells}
          processCells={statsProcessCells}
        />
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
                  {detailWorker.workerCode} · 투입·양품·불량은 공정 실적 집계, 작업시간은 일자별 입력 합계(분)
                </p>
              </div>
              <div className="mesModalHeadActions">
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
                <table className="mesTable mesWorkerProcessTable">
                  <thead>
                    <tr>
                      <th>품목</th>
                      <th>구분</th>
                      <th>투입</th>
                      <th>양품</th>
                      <th>불량</th>
                      <th>표준시간 (MBOM)</th>
                      <th>작업시간 (분)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryLoading ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          로딩 중…
                        </td>
                      </tr>
                    ) : summaryRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          등록된 생산 품목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      summaryRows.map((r) => {
                        const processes = r.processes ?? []
                        const hasActivity = r.inputQty > 0 || r.goodQty > 0 || r.defectQty > 0
                        const totalMinutes = sumDraftWorkMinutes(processes, workMinutesDraft)
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
                            <td className="small">
                              {processes.length === 0 ? (
                                <span className="muted">공정 없음</span>
                              ) : (
                                fmtProductStandardSummary(processes)
                              )}
                            </td>
                            <td>
                              {processes.length === 0 ? (
                                <span className="muted small">—</span>
                              ) : (
                                <div className="mesWorkerTimeCell">
                                  <span className="mono mesWorkerTimeSum">{totalMinutes.toLocaleString()}분</span>
                                  <button
                                    type="button"
                                    className="mesWrActionBtn"
                                    onClick={() => setProcessModalProduct(r)}
                                  >
                                    상세보기
                                  </button>
                                </div>
                              )}
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

          {processModalProduct ? (
            <div className="mesModalRoot mesModalRootNested" role="presentation">
              <button
                type="button"
                className="mesModalBackdrop"
                aria-label="닫기"
                onClick={() => !workTimeEntrySaving && setProcessModalProduct(null)}
              />
              <div
                className="mesModalDialog mesModalDialogWide"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mes-worker-process-modal-title"
              >
                <div className="mesModalHead">
                  <div>
                    <h2 className="mesModalTitle" id="mes-worker-process-modal-title">
                      공정별 작업시간 · {processModalProduct.productName}
                    </h2>
                    <p className="mesModalMeta muted">
                      {processModalProduct.productCode} · 표준시간은 MBOM 공정에 등록된 값(초/기준수량)입니다.
                    </p>
                  </div>
                  <div className="mesModalHeadActions">
                    <button
                      type="button"
                      className="mesBtnSecondary"
                      onClick={() => setProcessModalProduct(null)}
                    >
                      닫기
                    </button>
                  </div>
                </div>
                <div className="mesModalBody">
                  <div className="mesTableWrap mesTableScroll" style={{ maxHeight: 'min(55vh, 480px)' }}>
                    <table className="mesTable mesTableCompact">
                      <thead>
                        <tr>
                          <th>공정</th>
                          <th>순서</th>
                          <th>표준시간</th>
                          <th>투입</th>
                          <th>양품</th>
                          <th>불량</th>
                          <th>작업시간 (분)</th>
                          <th>작업시간 입력</th>
                          <th>작업효율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(processModalProduct.processes ?? []).map((p) => {
                          const minutes = processMinutesFromDraft(p.processId, workMinutesDraft)
                          const rowActive = p.inputQty > 0 || p.goodQty > 0 || p.defectQty > 0
                          return (
                            <tr key={p.processId} className={rowActive ? 'mesTrHighlight' : undefined}>
                              <td>
                                <div>{p.processName}</div>
                                <div className="muted small mono">{p.processCode}</div>
                              </td>
                              <td className="mono">{p.sequence}</td>
                              <td className="small">{fmtStandardLabel(p.standardTime, p.baseQty)}</td>
                              <td>{p.inputQty.toLocaleString()}</td>
                              <td>{p.goodQty.toLocaleString()}</td>
                              <td>{p.defectQty.toLocaleString()}</td>
                              <td className="mono">{minutes.toLocaleString()}</td>
                              <td>
                                <button
                                  type="button"
                                  className="mesWrActionBtn"
                                  onClick={() => void openWorkTimeEntry(processModalProduct, p)}
                                >
                                  작업시간 입력
                                </button>
                              </td>
                              <td className="small">
                                {fmtWorkEfficiency(minutes, p.goodQty, p.inputQty, p.standardTime, p.baseQty)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {workTimeEntryTarget ? (
                <WorkTimeEntryModal
                  open
                  workerName={detailWorker.workerName}
                  process={workTimeEntryTarget.process}
                  rows={workTimeEntryRows}
                  loading={workTimeEntryLoading}
                  saving={workTimeEntrySaving}
                  onChangeRows={setWorkTimeEntryRows}
                  onSave={() => void saveWorkTimeEntries()}
                  onClose={closeWorkTimeEntry}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
