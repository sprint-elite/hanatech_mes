import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { itemTypeLabel } from '../lib/itemType'
import '../list-page.css'
import '../production-pl-page.css'

type DailyPlWarning = {
  code: string
  message: string
  productId?: number
}

type DailyPlProductRow = {
  productId: number
  productCode: string
  productName: string
  itemType: string
  unit: string
  goodQty: number
  inputQty: number
  defectQty: number
  workMinutes: number
  materialCost: number
  laborCost: number
  fixedCost: number
  productUnitCostTotal: number
  totalCost: number
  revenue: number
  profit: number
  laborRatePerSec: number | null
  fixedRatePerSec: number | null
  sellingPriceUnit: number | null
  productUnitCostPerUnit: number | null
  materialStandardUnitCost: number | null
  materialQtyBasis: number
  warnings: string[]
}

type DailyPlTotals = {
  goodQty: number
  workMinutes: number
  materialCost: number
  laborCost: number
  fixedCost: number
  productUnitCostTotal: number
  totalCost: number
  revenue: number
  profit: number
}

type DailyPlResponse = {
  ok: boolean
  date: string
  products: DailyPlProductRow[]
  totals: DailyPlTotals
  warnings: DailyPlWarning[]
}

function todayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('ko-KR')
}

function fmtMinutes(m: number) {
  if (m <= 0) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h <= 0) return `${min}분`
  return `${h}시간 ${min}분`
}

function profitClass(v: number) {
  if (v > 0) return 'mesPlProfitPos'
  if (v < 0) return 'mesPlProfitNeg'
  return 'mesPlProfitZero'
}

function fmtShortMoney(v: number) {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (abs >= 10_000) return `${Math.round(v / 10_000).toLocaleString('ko-KR')}만`
  return v.toLocaleString('ko-KR')
}

function fmtPieAmount(v: number) {
  return `${fmtMoney(v)}원`
}

function fmtPiePct(value: number, total: number) {
  if (total <= 0) return '0.0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

function fmtAxisUnit(v: number) {
  if (!Number.isFinite(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${Math.round(v).toLocaleString('ko-KR')}원`
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return dt.toISOString().slice(0, 10)
}

type DailyPlTrendDay = {
  date: string
  goodQty: number
  workMinutes: number
  profit: number
  profitPerUnit: number
  baselineOne: number
  extraProfit: number
}

type DailyPlTrendResponse = {
  ok: boolean
  from: string
  to: string
  days: DailyPlTrendDay[]
}

const TREND_LINE_COLOR = '#e8c24a'

function PlDailyProfitTrendChart({
  days,
  today,
  hoverIdx,
  onHover,
}: {
  days: DailyPlTrendDay[]
  today: string
  hoverIdx: number | null
  onHover: (idx: number | null) => void
}) {
  const chart = useMemo(() => {
    const dayCount = Math.max(days.length, 1)
    const dayWidth = 56
    const w = 68 + 24 + dayCount * dayWidth
    const h = 280
    const padL = 68
    const padR = 24
    const padT = 20
    const padB = 36
    const innerW = w - padL - padR
    const innerH = h - padT - padB
    const values = days.map((d) => d.profitPerUnit)
    const absMax = Math.max(...values.map((v) => Math.abs(v)), 1)
    const midY = padT + innerH / 2
    const n = Math.max(1, days.length - 1)
    const xAt = (i: number) => padL + (innerW * i) / n
    const yAt = (v: number) => midY - (innerH / 2) * (v / absMax)

    const lineD = days
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.profitPerUnit).toFixed(1)}`)
      .join(' ')

    const points = days.map((d, i) => ({
      i,
      date: d.date,
      label: d.date.slice(5),
      x: xAt(i),
      y: yAt(d.profitPerUnit),
      ...d,
    }))

    const yTicks = [-1, -0.5, 0, 0.5, 1].map((t) => {
      const v = absMax * t
      return { y: yAt(v), v, isZero: t === 0 }
    })

    return {
      w,
      h,
      padL,
      padR,
      padT,
      padB,
      innerW,
      innerH,
      lineD,
      points,
      yTicks,
      midY,
      absMax,
      yAt,
    }
  }, [days])

  if (days.length === 0) {
    return <div className="mesPlChartEmpty">기간 내 손익 데이터가 없습니다.</div>
  }

  const hasData = days.some((d) => d.goodQty > 0)
  if (!hasData) {
    return <div className="mesPlChartEmpty">기간 내 생산 실적이 없습니다.</div>
  }

  const hover = hoverIdx != null ? chart.points[hoverIdx] : null

  return (
    <div className="mesPlLineChart" onMouseLeave={() => onHover(null)}>
      <div className="mesPlLineChartLegend">
        <span className="mesPlLineChartLegendItem">
          <i className="mesPlLineChartLegendLine" style={{ background: TREND_LINE_COLOR }} />
          1개당 손익 (원/개)
        </span>
      </div>
      <div className="mesPlLineChartScroll">
        <svg
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          width={chart.w}
          height={chart.h}
          className="mesPlLineChartSvg"
          role="img"
          aria-label="일별 1개당 손익 추이"
        >
          {chart.yTicks.map((t) => (
            <g key={`yt-${t.v}`}>
              <line
                x1={chart.padL}
                x2={chart.w - chart.padR}
                y1={t.y}
                y2={t.y}
                className={t.isZero ? 'mesPlLineChartZero' : 'mesPlLineChartGrid'}
              />
              <text x={chart.padL - 8} y={t.y + 3} className="mesPlLineChartTick" textAnchor="end">
                {fmtAxisUnit(t.v)}
              </text>
            </g>
          ))}
          <path d={chart.lineD} className="mesPlLineChartPath" style={{ stroke: TREND_LINE_COLOR }} />
          {chart.points.map((p) => (
            <g key={p.date}>
              <rect
                x={p.x - Math.max(8, chart.innerW / Math.max(chart.points.length, 1) / 2)}
                y={chart.padT}
                width={Math.max(16, chart.innerW / Math.max(chart.points.length, 1))}
                height={chart.innerH}
                className="mesPlLineChartHit"
                onMouseEnter={() => onHover(p.i)}
              />
              <text
                x={p.x}
                y={chart.h - 10}
                className={`mesPlLineChartXLabel${p.date === today ? ' mesPlLineChartXLabel--today' : ''}`}
                textAnchor="middle"
              >
                {p.label}
              </text>
            </g>
          ))}
          {hover ? (
            <>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={chart.padT}
                y2={chart.padT + chart.innerH}
                className="mesPlLineChartHoverLine"
              />
              <circle cx={hover.x} cy={hover.y} r={4} fill={TREND_LINE_COLOR} />
            </>
          ) : null}
        </svg>
      </div>
      {hover ? (
        <div className="mesPlLineChartTooltip" style={{ left: `${(hover.x / chart.w) * 100}%` }}>
          <strong>{hover.date}</strong>
          <span>양품 {fmtMoney(hover.goodQty)}</span>
          <span className="mesPlLineChartTooltipProfit">
            실제 손익 {hover.profit > 0 ? '+' : ''}
            {fmtMoney(hover.profit)}원
          </span>
          <span className="mesPlLineChartTooltipBaseline">
            1개당 손익 {hover.profitPerUnit > 0 ? '+' : ''}
            {fmtMoney(hover.profitPerUnit)}원
          </span>
          <span className={`mesPlLineChartTooltipExtra ${profitClass(hover.extraProfit)}`}>
            1개 초과분 합계 {hover.extraProfit > 0 ? '+' : ''}
            {fmtMoney(hover.extraProfit)}원
          </span>
        </div>
      ) : null}
    </div>
  )
}

const PIE_COLORS = {
  mat: '#9b8fe8',
  labor: '#f0b078',
  fixed: '#7ebef0',
  product: '#b8c0cc',
  profit: '#3dba72',
  loss: '#e85d5d',
}

type PieSliceItem = {
  key: string
  label: string
  value: number
  color: string
  /** 흑자 손익 — 본체 도넛에서 살짝 띄워 그림 */
  explode?: boolean
  signedDisplay?: 'pos' | 'neg'
}

type PieArc = PieSliceItem & {
  d: string
  edgeX: number
  edgeY: number
  labelX: number
  labelY: number
  lineEndX: number
  anchor: 'start' | 'end'
}

type LossOverlay = {
  d: string
  edgeX: number
  edgeY: number
  labelX: number
  labelY: number
  lineEndX: number
  anchor: 'start' | 'end'
  value: number
  /** 총비용 대비 손실 비율 */
  pctOfCost: number
}

function estimatePieLabelWidth(value: number, signedDisplay?: 'pos' | 'neg') {
  // 금액 행이 보통 가장 길다 ("12,500원", "+12,500원" 등). viewBox 단위 ≈ 굵은 12px 글자폭.
  const text = fmtPieSliceAmount(value, signedDisplay)
  return Math.max(text.length * 7.4, 52)
}

function fmtPieSliceAmount(value: number, signedDisplay?: 'pos' | 'neg') {
  if (signedDisplay === 'pos') return `+${fmtPieAmount(value)}`
  if (signedDisplay === 'neg') return `-${fmtPieAmount(value)}`
  return fmtPieAmount(value)
}

function buildDonutPath(
  cx: number,
  cy: number,
  r: number,
  ir: number,
  start: number,
  end: number,
) {
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  const xi1 = cx + ir * Math.cos(end)
  const yi1 = cy + ir * Math.sin(end)
  const xi2 = cx + ir * Math.cos(start)
  const yi2 = cy + ir * Math.sin(start)
  const large = end - start > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${ir} ${ir} 0 ${large} 0 ${xi2} ${yi2} Z`
}

function placePieLabel(opts: {
  cx: number
  cy: number
  scx: number
  scy: number
  r: number
  cosMid: number
  sinMid: number
  labelR: number
  value: number
  signedDisplay?: 'pos' | 'neg'
  vbW: number
  vbH: number
  pad: number
}) {
  const { cx, scx, scy, r, cosMid, sinMid, labelR, value, signedDisplay, vbW, vbH, pad } = opts
  const anchor: 'start' | 'end' = cosMid >= 0 ? 'start' : 'end'
  const labelW = estimatePieLabelWidth(value, signedDisplay)
  let labelX = scx + labelR * cosMid
  let labelY = scy + labelR * sinMid
  if (anchor === 'start') {
    labelX = Math.min(labelX, vbW - pad - labelW)
    labelX = Math.max(labelX, cx + r + 10)
  } else {
    labelX = Math.max(labelX, pad + labelW)
    labelX = Math.min(labelX, cx - r - 10)
  }
  const labelHalfH = 28
  labelY = Math.max(pad + labelHalfH, Math.min(vbH - pad - labelHalfH, labelY))
  const lineEndX = anchor === 'start' ? labelX - 4 : labelX + 4
  return { labelX, labelY, lineEndX, anchor }
}

/**
 * 흑자: 비용 + 손익(분리) = 매출 구성
 * 적자: 비용만 100% 도넛, 손실은 빗금 오버레이로 별도 표시
 */
function PlRevenuePieChart({ totals }: { totals: DailyPlTotals }) {
  const { arcs, total, lossOverlay } = useMemo(() => {
    const costItems: PieSliceItem[] = [
      { key: 'mat', label: '자재비', value: totals.materialCost, color: PIE_COLORS.mat },
      { key: 'labor', label: '인건비', value: totals.laborCost, color: PIE_COLORS.labor },
      { key: 'fixed', label: '고정비', value: totals.fixedCost, color: PIE_COLORS.fixed },
      { key: 'product', label: '제품원가', value: totals.productUnitCostTotal, color: PIE_COLORS.product },
    ].filter((s) => s.value > 0)

    const isLoss = totals.profit < 0
    const items: PieSliceItem[] = [...costItems]
    if (totals.profit > 0) {
      items.push({
        key: 'profit',
        label: '손익',
        value: totals.profit,
        color: PIE_COLORS.profit,
        explode: true,
        signedDisplay: 'pos',
      })
    }

    const sum = items.reduce((s, x) => s + x.value, 0)
    const costSum = costItems.reduce((s, x) => s + x.value, 0)
    if (sum <= 0) return { arcs: [] as PieArc[], total: 0, lossOverlay: null as LossOverlay | null }

    const vbW = 380
    const vbH = 320
    const pad = 12
    const cx = vbW / 2
    const cy = vbH / 2
    const r = 70
    const ir = 40
    const explodeGap = 0.07
    const explodeOffset = 14
    const hasExplode = items.some((s) => s.explode)
    const reservedGap = hasExplode ? explodeGap * 2 : 0
    const angleScale = (Math.PI * 2 - reservedGap) / (Math.PI * 2)

    let start = -Math.PI / 2
    const arcList: PieArc[] = items.map((s) => {
      const rawAngle = (s.value / sum) * Math.PI * 2 * angleScale
      if (s.explode) start += explodeGap
      const end = start + rawAngle
      const mid = start + rawAngle / 2
      const cosMid = Math.cos(mid)
      const sinMid = Math.sin(mid)
      const ox = s.explode ? explodeOffset * cosMid : 0
      const oy = s.explode ? explodeOffset * sinMid : 0
      const scx = cx + ox
      const scy = cy + oy
      const d = buildDonutPath(scx, scy, r, ir, start, end)
      const edgeX = scx + r * cosMid
      const edgeY = scy + r * sinMid
      const placed = placePieLabel({
        cx,
        cy,
        scx,
        scy,
        r,
        cosMid,
        sinMid,
        labelR: r + (s.explode ? 42 : 36),
        value: s.value,
        signedDisplay: s.signedDisplay,
        vbW,
        vbH,
        pad,
      })
      start = end
      if (s.explode) start += explodeGap
      return {
        ...s,
        d,
        edgeX,
        edgeY,
        ...placed,
      }
    })

    let overlay: LossOverlay | null = null
    if (isLoss && costSum > 0) {
      const lossValue = Math.abs(totals.profit)
      const lossAngle = Math.min(Math.PI * 2, (lossValue / costSum) * Math.PI * 2)
      const lossStart = -Math.PI / 2
      const lossEnd = lossStart + lossAngle
      const mid = lossStart + lossAngle / 2
      const cosMid = Math.cos(mid)
      const sinMid = Math.sin(mid)
      const d = buildDonutPath(cx, cy, r, ir, lossStart, lossEnd)
      const edgeX = cx + r * cosMid
      const edgeY = cy + r * sinMid
      const placed = placePieLabel({
        cx,
        cy,
        scx: cx,
        scy: cy,
        r,
        cosMid,
        sinMid,
        labelR: r + 40,
        value: lossValue,
        signedDisplay: 'neg',
        vbW,
        vbH,
        pad,
      })
      overlay = {
        d,
        edgeX,
        edgeY,
        ...placed,
        value: lossValue,
        pctOfCost: (lossValue / costSum) * 100,
      }
    }

    return { arcs: arcList, total: sum, lossOverlay: overlay }
  }, [totals])

  if (total <= 0) {
    return <div className="mesPlChartEmpty">매출 구성 데이터가 없습니다.</div>
  }

  return (
    <div className="mesPlPieChartWrap">
      <svg viewBox="0 0 380 320" className="mesPlPieChartSvg" role="img" aria-label="매출 구성 원형 차트">
        <defs>
          <pattern
            id="mesPlLossHatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="7" className="mesPlPieLossHatchLine" />
          </pattern>
        </defs>

        {arcs.map((a) => (
          <g key={a.key} className={a.explode ? 'mesPlPieSlice--explode' : undefined}>
            <path
              d={a.d}
              fill={a.color}
              stroke={a.explode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'}
              strokeWidth={a.explode ? 1.5 : 1}
            >
              <title>{`${a.label} ${fmtPieSliceAmount(a.value, a.signedDisplay)} (${fmtPiePct(a.value, total)})`}</title>
            </path>
            <line
              x1={a.edgeX}
              y1={a.edgeY}
              x2={a.lineEndX}
              y2={a.labelY}
              className="mesPlPieConnector"
            />
            <text
              x={a.labelX}
              y={a.labelY}
              textAnchor={a.anchor}
              dominantBaseline="middle"
              className="mesPlPieSliceLabel"
            >
              <tspan x={a.labelX} dy="-1.05em" className="mesPlPieSliceLabelName">
                {a.label}
              </tspan>
              <tspan
                x={a.labelX}
                dy="1.15em"
                className={`mesPlPieSliceLabelAmount${a.key === 'profit' ? ' mesPlPieSliceLabelAmount--profit' : ''}`}
              >
                {fmtPieSliceAmount(a.value, a.signedDisplay)}
              </tspan>
              <tspan x={a.labelX} dy="1.1em" className="mesPlPieSliceLabelPct">
                {fmtPiePct(a.value, total)}
              </tspan>
            </text>
          </g>
        ))}

        {lossOverlay ? (
          <g className="mesPlPieLossOverlay">
            <path d={lossOverlay.d} className="mesPlPieLossOverlayArc">
              <title>{`손실 -${fmtPieAmount(lossOverlay.value)}원 (총비용 대비 ${lossOverlay.pctOfCost.toFixed(1)}%)`}</title>
            </path>
            <line
              x1={lossOverlay.edgeX}
              y1={lossOverlay.edgeY}
              x2={lossOverlay.lineEndX}
              y2={lossOverlay.labelY}
              className="mesPlPieConnector mesPlPieConnector--loss"
            />
            <text
              x={lossOverlay.labelX}
              y={lossOverlay.labelY}
              textAnchor={lossOverlay.anchor}
              dominantBaseline="middle"
              className="mesPlPieSliceLabel"
            >
              <tspan x={lossOverlay.labelX} dy="-1.05em" className="mesPlPieSliceLabelName mesPlPieSliceLabelName--loss">
                손실
              </tspan>
              <tspan x={lossOverlay.labelX} dy="1.15em" className="mesPlPieSliceLabelAmount mesPlPieSliceLabelAmount--loss">
                {fmtPieSliceAmount(lossOverlay.value, 'neg')}
              </tspan>
              <tspan x={lossOverlay.labelX} dy="1.1em" className="mesPlPieSliceLabelPct mesPlPieSliceLabelPct--loss">
                총비용 대비 {lossOverlay.pctOfCost.toFixed(1)}%
              </tspan>
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}


export function ProductionDailyPlPage() {
  const [date, setDate] = useState(todayYmd)
  const [draftDate, setDraftDate] = useState(todayYmd)
  const [trendTo, setTrendTo] = useState(() => todayYmd())
  const [trendFrom, setTrendFrom] = useState(() => addDaysYmd(todayYmd(), -13))
  const [filterProductId, setFilterProductId] = useState<number | 'ALL'>('ALL')
  const [data, setData] = useState<DailyPlResponse | null>(null)
  const [trendData, setTrendData] = useState<DailyPlTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [trendErr, setTrendErr] = useState<string | null>(null)
  const [detailRow, setDetailRow] = useState<DailyPlProductRow | null>(null)
  const [trendHoverIdx, setTrendHoverIdx] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiJson<DailyPlResponse>(`/api/production-daily-pl?date=${encodeURIComponent(date)}`)
      setData(res)
      setErr(null)
    } catch (e) {
      setData(null)
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [date])

  const loadTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const from = trendFrom <= trendTo ? trendFrom : trendTo
      const to = trendFrom <= trendTo ? trendTo : trendFrom
      const res = await apiJson<DailyPlTrendResponse>(
        `/api/production-daily-pl/trend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      setTrendData(res)
      setTrendErr(null)
    } catch (e) {
      setTrendData(null)
      setTrendErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setTrendLoading(false)
    }
  }, [trendFrom, trendTo])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadTrend()
  }, [loadTrend])

  const filteredProducts = useMemo(() => {
    const rows = data?.products ?? []
    if (filterProductId === 'ALL') return rows
    return rows.filter((r) => r.productId === filterProductId)
  }, [data, filterProductId])

  const productOptions = useMemo(() => data?.products ?? [], [data])

  const applyDate = () => setDate(draftDate)

  return (
    <div className="mesPage mesPageWide mesListPage">
      <header className="mesListHead">
        <div className="mesListHeadMain">
          <h1 className="mesListTitle">당일 생산 손익</h1>
          <p className="mesListDesc">
            당일 생산 실적·작업시간·원가 기준을 합산한 품목별 예상 손익입니다. 행을 클릭하면 산정 내역을 확인할 수 있습니다.
          </p>
        </div>
        <div className="mesListHeadActions">
          <Link to="/production-cost-basis" className="mesListBtn mesListBtn--secondary">
            원가 기준 관리
          </Link>
          <button type="button" className="mesListBtn mesListBtn--secondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>
      </header>

      {err ? <div className="error mesBanner mesListNotice">{err}</div> : null}
      {trendErr ? <div className="error mesBanner mesListNotice">{trendErr}</div> : null}

      <section className="mesPlToolbar">
        <label className="mesListField">
          <span className="mesListFieldLabel">기준일</span>
          <input className="mesListInput" type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
        </label>
        <label className="mesListField mesPlToolbarProduct">
          <span className="mesListFieldLabel">품목</span>
          <select
            className="mesListInput"
            value={filterProductId === 'ALL' ? 'ALL' : String(filterProductId)}
            onChange={(e) => {
              const v = e.target.value
              setFilterProductId(v === 'ALL' ? 'ALL' : Number(v))
            }}
          >
            <option value="ALL">전체 품목</option>
            {productOptions.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.productCode} · {p.productName}
              </option>
            ))}
          </select>
        </label>
        <div className="mesPlToolbarActions">
          <button type="button" className="mesListBtn mesListBtn--primary" onClick={applyDate}>
            조회
          </button>
        </div>
      </section>

      {data?.warnings.length ? (
        <section className="mesPlWarnBanner">
          <div className="mesCardTitle">주의</div>
          <ul className="mesPlWarnList">
            {data.warnings.map((w, i) => (
              <li key={`${w.code}-${w.productId ?? i}`}>{w.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="mesPlSummaryGrid">
            <div className="mesPlSummaryCard">
              <div className="mesPlSummaryLabel">생산수량 (양품)</div>
              <div className="mesPlSummaryValue">{fmtMoney(data.totals.goodQty)}</div>
            </div>
            <div className="mesPlSummaryCard">
              <div className="mesPlSummaryLabel">생산시간</div>
              <div className="mesPlSummaryValue">{fmtMinutes(data.totals.workMinutes)}</div>
            </div>
            <div className="mesPlSummaryCard">
              <div className="mesPlSummaryLabel">매출 (기준)</div>
              <div className="mesPlSummaryValue">{fmtMoney(data.totals.revenue)}원</div>
            </div>
            <div className="mesPlSummaryCard">
              <div className="mesPlSummaryLabel">총 비용</div>
              <div className="mesPlSummaryValue">{fmtMoney(data.totals.totalCost)}원</div>
            </div>
            <div className="mesPlSummaryCard">
              <div className="mesPlSummaryLabel">손익</div>
              <div className={`mesPlSummaryValue ${profitClass(data.totals.profit)}`}>
                {data.totals.profit > 0 ? '+' : ''}
                {fmtMoney(data.totals.profit)}원
              </div>
            </div>
          </section>

          <section className="mesPlChartRow">
            <div className="mesPlChartCard mesPlChartCard--trend">
              <div className="mesPlTrendHead">
                <div>
                  <h3 className="mesPlChartTitle">일별 손익 추이</h3>
                  <p className="mesPlTrendDesc muted">1개당 손익(원/개) · Y=0 기준선</p>
                </div>
                <div className="mesPlTrendFilters">
                  <label className="mesListField">
                    <span className="mesListFieldLabel">시작</span>
                    <input
                      className="mesListInput"
                      type="date"
                      value={trendFrom}
                      max={trendTo}
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) return
                        setTrendFrom(v)
                        if (v > trendTo) setTrendTo(v)
                      }}
                    />
                  </label>
                  <label className="mesListField">
                    <span className="mesListFieldLabel">종료</span>
                    <input
                      className="mesListInput"
                      type="date"
                      value={trendTo}
                      min={trendFrom}
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) return
                        setTrendTo(v)
                        if (v < trendFrom) setTrendFrom(v)
                      }}
                    />
                  </label>
                  <button type="button" className="mesListBtn mesListBtn--secondary" onClick={() => void loadTrend()}>
                    추이 조회
                  </button>
                </div>
              </div>
              {trendLoading ? (
                <div className="mesPlChartEmpty">추이 데이터 불러오는 중…</div>
              ) : (
                <PlDailyProfitTrendChart
                  days={trendData?.days ?? []}
                  today={todayYmd()}
                  hoverIdx={trendHoverIdx}
                  onHover={setTrendHoverIdx}
                />
              )}
            </div>
            <div className="mesPlChartCard mesPlChartCard--pie">
              <h3 className="mesPlChartTitle">매출 구성</h3>
              <PlRevenuePieChart totals={data.totals} />
            </div>
          </section>

          <div className="mesListTableCard">
            <div className="mesCardTitle">품목별 손익 — {data.date}</div>
            <div className="mesTableWrap mesListTableViewport">
              <table className="mesTable mesPlTable">
                <thead>
                  <tr>
                    <th>품목</th>
                    <th>유형</th>
                    <th>양품</th>
                    <th>생산시간</th>
                    <th>자재비</th>
                    <th>인건비</th>
                    <th>고정비</th>
                    <th>제품원가</th>
                    <th>총비용</th>
                    <th>매출</th>
                    <th>손익</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="muted">
                        불러오는 중…
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="muted">
                        {data.products.length === 0 ? '해당 일자의 생산 실적이 없습니다.' : '검색 결과가 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((r) => (
                      <tr
                        key={r.productId}
                        className={`mesPlRowClickable${r.profit < 0 && r.goodQty > 0 ? ' mesPlRowLoss' : ''}`}
                        onClick={() => setDetailRow(r)}
                      >
                        <td>
                          <div className="mono">{r.productCode}</div>
                          <div className="muted">{r.productName}</div>
                        </td>
                        <td>{itemTypeLabel(r.itemType)}</td>
                        <td className="mono">
                          {fmtMoney(r.goodQty)}
                          {r.unit}
                        </td>
                        <td>{fmtMinutes(r.workMinutes)}</td>
                        <td className="mono">{fmtMoney(r.materialCost)}</td>
                        <td className="mono">{fmtMoney(r.laborCost)}</td>
                        <td className="mono">{fmtMoney(r.fixedCost)}</td>
                        <td className="mono">{fmtMoney(r.productUnitCostTotal)}</td>
                        <td className="mono">{fmtMoney(r.totalCost)}</td>
                        <td className="mono">{fmtMoney(r.revenue)}</td>
                        <td className={`mono ${profitClass(r.profit)}`}>
                          {r.profit > 0 ? '+' : ''}
                          {fmtMoney(r.profit)}
                        </td>
                        <td className="muted mesPlWarnCell">
                          {r.warnings.length ? r.warnings.join(' · ') : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                  {filteredProducts.length > 0 ? (
                    <tr className="mesPlTotalRow">
                      <td colSpan={2}>
                        <strong>합계</strong>
                      </td>
                      <td className="mono">{fmtMoney(data.totals.goodQty)}</td>
                      <td>{fmtMinutes(data.totals.workMinutes)}</td>
                      <td className="mono">{fmtMoney(data.totals.materialCost)}</td>
                      <td className="mono">{fmtMoney(data.totals.laborCost)}</td>
                      <td className="mono">{fmtMoney(data.totals.fixedCost)}</td>
                      <td className="mono">{fmtMoney(data.totals.productUnitCostTotal)}</td>
                      <td className="mono">{fmtMoney(data.totals.totalCost)}</td>
                      <td className="mono">{fmtMoney(data.totals.revenue)}</td>
                      <td className={`mono ${profitClass(data.totals.profit)}`}>
                        {data.totals.profit > 0 ? '+' : ''}
                        {fmtMoney(data.totals.profit)}
                      </td>
                      <td />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {detailRow ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setDetailRow(null)} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-pl-detail-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-pl-detail-title">
                  손익 산정 내역
                </h2>
                <div className="mesModalMeta muted">
                  {detailRow.productCode} · {detailRow.productName} · {data?.date}
                </div>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesPlDetailGrid">
                <div className="mesPlDetailItem">
                  <div className="mesPlDetailItemLabel">양품 수량</div>
                  <div className="mesPlDetailItemValue mono">
                    {fmtMoney(detailRow.goodQty)} {detailRow.unit}
                  </div>
                </div>
                <div className="mesPlDetailItem">
                  <div className="mesPlDetailItemLabel">투입 수량</div>
                  <div className="mesPlDetailItemValue mono">
                    {fmtMoney(detailRow.inputQty)} {detailRow.unit}
                    {detailRow.defectQty > 0 ? (
                      <span className="muted"> (불량 {fmtMoney(detailRow.defectQty)})</span>
                    ) : null}
                  </div>
                </div>
                <div className="mesPlDetailItem">
                  <div className="mesPlDetailItemLabel">생산시간</div>
                  <div className="mesPlDetailItemValue">{fmtMinutes(detailRow.workMinutes)}</div>
                </div>
                <div className="mesPlDetailItem">
                  <div className="mesPlDetailItemLabel">적용 초당 입률</div>
                  <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.laborRatePerSec)}원/초</div>
                </div>
                <div className="mesPlDetailItem">
                  <div className="mesPlDetailItemLabel">적용 고정입률</div>
                  <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.fixedRatePerSec)}원/초</div>
                </div>
                <div className="mesPlDetailItem">
                  <div className="mesPlDetailItemLabel">판매단가</div>
                  <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.sellingPriceUnit)}원</div>
                </div>
                <div className="mesPlDetailItem">
                  <div className="mesPlDetailItemLabel">제품원가 (단가)</div>
                  <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.productUnitCostPerUnit)}원</div>
                </div>
              </div>

              <div className="mesPlModalSection">
                <h3 className="mesPlModalSectionTitle">비용 구성</h3>
                <div className="mesPlDetailGrid">
                  <div className="mesPlDetailItem">
                    <div className="mesPlDetailItemLabel">자재비</div>
                    <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.materialCost)}원</div>
                  </div>
                  <div className="mesPlDetailItem">
                    <div className="mesPlDetailItemLabel">인건비</div>
                    <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.laborCost)}원</div>
                  </div>
                  <div className="mesPlDetailItem">
                    <div className="mesPlDetailItemLabel">고정비</div>
                    <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.fixedCost)}원</div>
                  </div>
                  <div className="mesPlDetailItem">
                    <div className="mesPlDetailItemLabel">제품원가 합계</div>
                    <div className="mesPlDetailItemValue mono">{fmtMoney(detailRow.productUnitCostTotal)}원</div>
                  </div>
                </div>
              </div>

              <div className="mesPlModalSection">
                <h3 className="mesPlModalSectionTitle">산정식</h3>
                <div className="mesPlFormulaBox">
                  자재비 = {fmtMoney(detailRow.materialStandardUnitCost)}원/투입 × {fmtMoney(detailRow.materialQtyBasis)}투입 ={' '}
                  <strong>{fmtMoney(detailRow.materialCost)}원</strong>
                  <span className="muted"> (EBOM·입고단가 기준, 불량 포함 투입수량 적용)</span>
                  <br />
                  인건비 = {detailRow.workMinutes}분 × 60 × {fmtMoney(detailRow.laborRatePerSec)} = <strong>{fmtMoney(detailRow.laborCost)}원</strong>
                  <br />
                  고정비 = {detailRow.workMinutes}분 × 60 × {fmtMoney(detailRow.fixedRatePerSec)} = <strong>{fmtMoney(detailRow.fixedCost)}원</strong>
                  <br />
                  제품원가 = {fmtMoney(detailRow.goodQty)}양품 × {fmtMoney(detailRow.productUnitCostPerUnit ?? 0)} ={' '}
                  <strong>{fmtMoney(detailRow.productUnitCostTotal)}원</strong>
                  {detailRow.productUnitCostPerUnit == null ? (
                    <span className="muted"> (기준정보에 제품원가 미등록)</span>
                  ) : null}
                  <br />
                  매출 = {fmtMoney(detailRow.goodQty)}양품 × {fmtMoney(detailRow.sellingPriceUnit)} = <strong>{fmtMoney(detailRow.revenue)}원</strong>
                  <br />
                  총비용 = 자재비 + 인건비 + 고정비 + 제품원가 = <strong>{fmtMoney(detailRow.totalCost)}원</strong>
                  <br />
                  손익 = 매출 − 총비용 = <strong className={profitClass(detailRow.profit)}>{detailRow.profit > 0 ? '+' : ''}{fmtMoney(detailRow.profit)}원</strong>
                </div>
              </div>

              {detailRow.warnings.length > 0 ? (
                <div className="mesPlModalSection">
                  <h3 className="mesPlModalSectionTitle">주의</h3>
                  <ul className="mesPlWarnList">
                    {detailRow.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="mesModalFoot">
              <Link to="/production-cost-basis" className="mesBtnSecondary" onClick={() => setDetailRow(null)}>
                원가 기준 수정
              </Link>
              <button type="button" className="mesBtnPrimary" onClick={() => setDetailRow(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
