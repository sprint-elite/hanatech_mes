import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiJson, ApiError } from '../lib/api'
import '../dashboard.css'

type Health = { ok: boolean; time: string }
type Plan = {
  id: number
  planNo: string
  planQty: number
  startDate: string
  endDate: string
  status: string
  product?: { productCode: string; productName: string }
}
type WorkOrder = {
  id: number
  woNo: string
  planId: number | null
  orderQty: number
  completedQty: number
  status: string
  holdReason?: string | null
  product?: { productCode: string; productName: string }
  plan?: { planNo: string; startDate: string; endDate: string }
  workCenter?: { centerCode: string; centerName: string } | null
  assignedWorkers?: { worker: { workerName: string } }[]
}
type ProcessResult = {
  id: number
  createdAt: string
  goodQty: number
  defectQty: number
  lot?: {
    lotNo: string
    productId: number
    product?: { id: number; productCode: string; productName: string } | null
  } | null
}
type CalendarItem = { id: string; kind: 'PLAN' | 'WO'; label: string; status: string }
type KanbanColId = 'READY' | 'IN_PROGRESS' | 'HOLD'

const TREND_SERIES_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed', '#0891b2', '#ea580c', '#db2777']

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

const toYmd = (d: Date) => {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

const parseDateSafe = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const daysBetweenInclusive = (fromStr: string, toStr: string) => {
  const from = parseDateSafe(fromStr)
  const to = parseDateSafe(toStr)
  if (!from || !to) return []
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  if (end < start) return []
  const out: { ymd: string; label: string }[] = []
  const cursor = new Date(start)
  let guard = 0
  while (cursor <= end && guard < 120) {
    const ymd = toYmd(cursor)
    out.push({ ymd, label: ymd.slice(5) })
    cursor.setDate(cursor.getDate() + 1)
    guard += 1
  }
  return out
}

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const woStatusLabel = (s: string) => {
  if (s === 'READY') return '대기'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'HOLD') return '보류'
  return s
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4.5h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1Z" />
    </svg>
  )
}

function IconAlertCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconStatDone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconStatTotal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h8" strokeLinecap="round" />
    </svg>
  )
}

function IconStatGood() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 12h4l2-7 2 7h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v6h14v-6" strokeLinecap="round" />
    </svg>
  )
}

function IconStatDefect() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconStatWait() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" strokeLinecap="round" />
    </svg>
  )
}

function IconStatProgress() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12 17 9" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconQueue() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendarMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}

function IconClockMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  )
}

function IconPauseMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" strokeLinecap="round" />
    </svg>
  )
}

function IconKanbanCal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}

function IconKanbanUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" strokeLinecap="round" />
    </svg>
  )
}

function IconKanbanEmptyTray() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="12" y="18" width="40" height="30" rx="4" stroke="#94a3b8" strokeWidth="2.5" />
      <path d="M18 28h28" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 36h20M26 42h12" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 48h24l-3 6H23l-3-6Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [results, setResults] = useState<ProcessResult[]>([])
  const [selectedYmd, setSelectedYmd] = useState(() => toYmd(new Date()))
  const [calPage, setCalPage] = useState(() => {
    const t = new Date()
    return { y: t.getFullYear(), m: t.getMonth() }
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dragWoId, setDragWoId] = useState<number | null>(null)
  const [dropColId, setDropColId] = useState<KanbanColId | null>(null)
  const [woMovingId, setWoMovingId] = useState<number | null>(null)
  const [kanbanErr, setKanbanErr] = useState<string | null>(null)
  const [trendFrom, setTrendFrom] = useState(() => {
    const d = startOfToday()
    d.setDate(d.getDate() - 6)
    return toYmd(d)
  })
  const [trendTo, setTrendTo] = useState(() => toYmd(startOfToday()))
  const [trendProductId, setTrendProductId] = useState<number | 'ALL'>('ALL')
  const [trendHoverIdx, setTrendHoverIdx] = useState<number | null>(null)
  const [qualityFrom, setQualityFrom] = useState(() => {
    const d = startOfToday()
    d.setDate(d.getDate() - 89)
    return toYmd(d)
  })
  const [qualityTo, setQualityTo] = useState(() => toYmd(startOfToday()))
  const [qualityProductId, setQualityProductId] = useState<number | 'ALL'>('ALL')
  const [qualityRangeReady, setQualityRangeReady] = useState(false)

  const load = useCallback(async () => {
    try {
      const [healthRes, planRes, woRes, prRes] = await Promise.all([
        fetch('/api/health'),
        apiJson<{ ok: boolean; items: Plan[] }>('/api/production-plans'),
        apiJson<{ ok: boolean; items: WorkOrder[] }>('/api/work-orders'),
        apiJson<{ ok: boolean; items: ProcessResult[] }>('/api/process-results'),
      ])
      if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`)
      setHealth((await healthRes.json()) as Health)
      setPlans(planRes.items)
      setWorkOrders(woRes.items)
      setResults(prRes.items)
      setLastUpdated(new Date())
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (qualityRangeReady || results.length === 0) return
    const dates = results
      .map((r) => toYmd(new Date(r.createdAt)))
      .filter(Boolean)
      .sort()
    if (dates.length === 0) return
    setQualityFrom(dates[0])
    setQualityTo(dates[dates.length - 1])
    setQualityRangeReady(true)
  }, [results, qualityRangeReady])

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  const orphanWorkOrders = useMemo(() => workOrders.filter((w) => w.planId == null), [workOrders])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    const add = (ymd: string, item: CalendarItem) => {
      const arr = map.get(ymd)
      if (arr) arr.push(item)
      else map.set(ymd, [item])
    }

    for (const p of plans) {
      const start = parseDateSafe(p.startDate)
      const end = parseDateSafe(p.endDate)
      if (!start || !end) continue
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      let guard = 0
      while (cursor <= endDay && guard < 400) {
        add(toYmd(cursor), {
          id: `P-${p.id}`,
          kind: 'PLAN',
          label: `${p.planNo} · ${p.product?.productName ?? `품목#${p.id}`}`,
          status: p.status,
        })
        cursor.setDate(cursor.getDate() + 1)
        guard += 1
      }
    }

    for (const wo of workOrders) {
      if (wo.planId == null) continue
      const p = planById.get(wo.planId)
      if (!p) continue
      const start = parseDateSafe(p.startDate)
      const end = parseDateSafe(p.endDate)
      if (!start || !end) continue
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      let guard = 0
      while (cursor <= endDay && guard < 400) {
        add(toYmd(cursor), {
          id: `W-${wo.id}`,
          kind: 'WO',
          label: `${wo.woNo} · ${wo.product?.productName ?? `품목#${wo.id}`}`,
          status: wo.status,
        })
        cursor.setDate(cursor.getDate() + 1)
        guard += 1
      }
    }
    return map
  }, [plans, workOrders, planById])

  const selectedItems = useMemo(() => itemsByDate.get(selectedYmd) ?? [], [itemsByDate, selectedYmd])

  const calendarMonthCells = useMemo(() => {
    const { y, m } = calPage
    const first = new Date(y, m, 1)
    const pad = first.getDay()
    const dim = new Date(y, m + 1, 0).getDate()
    const cells: ({ kind: 'pad' } | { kind: 'day'; ymd: string; day: number })[] = []
    for (let i = 0; i < pad; i++) cells.push({ kind: 'pad' })
    for (let d = 1; d <= dim; d++) {
      const ymd = toYmd(new Date(y, m, d))
      cells.push({ kind: 'day', ymd, day: d })
    }
    while (cells.length % 7 !== 0) cells.push({ kind: 'pad' })
    return cells
  }, [calPage])

  const woKpi = useMemo(() => {
    const c = { ready: 0, inProgress: 0, done: 0, hold: 0, total: workOrders.length }
    for (const w of workOrders) {
      if (w.status === 'READY') c.ready += 1
      else if (w.status === 'IN_PROGRESS') c.inProgress += 1
      else if (w.status === 'DONE') c.done += 1
      else if (w.status === 'HOLD') c.hold += 1
    }
    return c
  }, [workOrders])

  const woDoneRatePct = useMemo(() => {
    if (woKpi.total === 0) return 0
    return Math.round((woKpi.done / woKpi.total) * 1000) / 10
  }, [woKpi])

  const delayRisk = useMemo(() => {
    const today = startOfToday()
    let latePlans = 0
    for (const p of plans) {
      if (p.status === 'CLOSED') continue
      const end = parseDateSafe(p.endDate)
      if (!end) continue
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      if (endDay < today) latePlans += 1
    }
    let lateWos = 0
    for (const w of workOrders) {
      if (w.status === 'DONE') continue
      const p = w.planId != null ? planById.get(w.planId) : null
      if (!p) continue
      const end = parseDateSafe(p.endDate)
      if (!end) continue
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      if (endDay < today) lateWos += 1
    }
    return { latePlans, lateWos, totalRisk: latePlans + lateWos }
  }, [plans, workOrders, planById])

  const resultBuckets = useMemo(() => {
    const map = new Map<string, { good: number; defect: number }>()
    for (const r of results) {
      const key = toYmd(new Date(r.createdAt))
      const x = map.get(key) ?? { good: 0, defect: 0 }
      x.good += r.goodQty
      x.defect += r.defectQty
      map.set(key, x)
    }
    return map
  }, [results])

  const trendProducts = useMemo(() => {
    const map = new Map<number, { id: number; code: string; name: string }>()
    for (const r of results) {
      const p = r.lot?.product
      if (!p) continue
      if (!map.has(p.id)) map.set(p.id, { id: p.id, code: p.productCode, name: p.productName })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [results])

  const defectMetrics = useMemo(() => {
    const windowSum = (startDaysAgo: number, len: number) => {
      let g = 0
      let d = 0
      const t = startOfToday()
      for (let i = 0; i < len; i++) {
        const day = new Date(t)
        day.setDate(day.getDate() - startDaysAgo - i)
        const b = resultBuckets.get(toYmd(day))
        if (b) {
          g += b.good
          d += b.defect
        }
      }
      return { g, d }
    }
    const last7 = windowSum(0, 7)
    const prev7 = windowSum(7, 7)
    const sumLast7 = last7.g + last7.d
    const rate = sumLast7 === 0 ? 0 : last7.d / sumLast7
    const ratePrev = prev7.g + prev7.d === 0 ? null : prev7.d / (prev7.g + prev7.d)
    const deltaPp = ratePrev == null ? null : (rate - ratePrev) * 100
    return { rate, deltaPp, last7Good: last7.g, last7Defect: last7.d, sumLast7 }
  }, [resultBuckets])

  const trendChart = useMemo(() => {
    const from = trendFrom <= trendTo ? trendFrom : trendTo
    const to = trendFrom <= trendTo ? trendTo : trendFrom
    const dayMeta = daysBetweenInclusive(from, to)
    const idx = new Map(dayMeta.map((d, i) => [d.ymd, i]))

    if (trendProductId === 'ALL') {
      const seriesMap = new Map<number, { id: number; name: string; values: number[] }>()
      for (const p of trendProducts) {
        seriesMap.set(p.id, { id: p.id, name: p.name, values: dayMeta.map(() => 0) })
      }
      let goodSum = 0
      let defectSum = 0
      for (const r of results) {
        const key = toYmd(new Date(r.createdAt))
        const i = idx.get(key)
        if (i == null) continue
        const pid = r.lot?.productId
        if (pid == null) continue
        let s = seriesMap.get(pid)
        if (!s) {
          const name = r.lot?.product?.productName ?? `품목#${pid}`
          s = { id: pid, name, values: dayMeta.map(() => 0) }
          seriesMap.set(pid, s)
        }
        s.values[i] += r.goodQty + r.defectQty
        goodSum += r.goodQty
        defectSum += r.defectQty
      }
      const series = [...seriesMap.values()].filter((s) => s.values.some((v) => v > 0))
      const max = Math.max(1, ...series.flatMap((s) => s.values), 1)
      const days = dayMeta.map((d, i) => ({
        ...d,
        total: series.reduce((a, s) => a + s.values[i], 0),
        byProduct: Object.fromEntries(series.map((s) => [s.id, s.values[i]])),
      }))
      return {
        mode: 'all' as const,
        from,
        to,
        days,
        series,
        max,
        goodSum,
        defectSum,
        totalSum: goodSum + defectSum,
      }
    }

    const days = dayMeta.map((d) => ({ ...d, good: 0, defect: 0 }))
    for (const r of results) {
      if (r.lot?.productId !== trendProductId) continue
      const key = toYmd(new Date(r.createdAt))
      const i = idx.get(key)
      if (i == null) continue
      days[i].good += r.goodQty
      days[i].defect += r.defectQty
    }
    const max = Math.max(1, ...days.map((d) => Math.max(d.good, d.defect)))
    const goodSum = days.reduce((a, d) => a + d.good, 0)
    const defectSum = days.reduce((a, d) => a + d.defect, 0)
    return {
      mode: 'single' as const,
      from,
      to,
      days,
      series: [] as { id: number; name: string; values: number[] }[],
      max,
      goodSum,
      defectSum,
      totalSum: goodSum + defectSum,
    }
  }, [results, trendFrom, trendTo, trendProductId, trendProducts])

  const trendPaths = useMemo(() => {
    const w = 640
    const h = 220
    const padL = 36
    const padR = 16
    const padT = 18
    const padB = 28
    const innerW = w - padL - padR
    const innerH = h - padT - padB
    const n = Math.max(1, trendChart.days.length - 1)
    const xAt = (i: number) => padL + (innerW * i) / n
    const yAt = (v: number) => padT + innerH - (innerH * v) / trendChart.max
    const dayCount = trendChart.days.length
    const labelStep = Math.max(1, Math.ceil(dayCount / 8))

    if (trendChart.mode === 'all') {
      const seriesPaths = trendChart.series.map((s, si) => ({
        ...s,
        color: TREND_SERIES_COLORS[si % TREND_SERIES_COLORS.length],
        d: s.values
          .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
          .join(' '),
      }))
      const points = trendChart.days.map((d, i) => ({
        i,
        ymd: d.ymd,
        label: d.label,
        x: xAt(i),
        total: d.total,
        byProduct: d.byProduct,
      }))
      const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        y: padT + innerH * (1 - t),
        v: Math.round(trendChart.max * t),
      }))
      return { mode: 'all' as const, w, h, padL, padR, padT, padB, innerW, innerH, points, yTicks, seriesPaths, labelStep }
    }

    const toPath = (key: 'good' | 'defect') =>
      trendChart.days
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt((d as { good: number; defect: number })[key]).toFixed(1)}`)
        .join(' ')
    const points = trendChart.days.map((d, i) => {
      const row = d as { ymd: string; label: string; good: number; defect: number }
      return {
        i,
        ymd: row.ymd,
        label: row.label,
        good: row.good,
        defect: row.defect,
        x: xAt(i),
        yGood: yAt(row.good),
        yDefect: yAt(row.defect),
      }
    })
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: padT + innerH * (1 - t),
      v: Math.round(trendChart.max * t),
    }))
    return { mode: 'single' as const, w, h, padL, padR, padT, padB, innerW, innerH, toPath, points, yTicks, seriesPaths: [], labelStep }
  }, [trendChart])

  const productQuality = useMemo(() => {
    const from = qualityFrom <= qualityTo ? qualityFrom : qualityTo
    const to = qualityFrom <= qualityTo ? qualityTo : qualityFrom
    const map = new Map<number, { id: number; name: string; good: number; defect: number }>()
    let allGood = 0
    let allDefect = 0
    for (const r of results) {
      const key = toYmd(new Date(r.createdAt))
      if (key < from || key > to) continue
      const pid = r.lot?.productId ?? 0
      if (qualityProductId !== 'ALL' && pid !== qualityProductId) continue
      allGood += r.goodQty
      allDefect += r.defectQty
      const name = r.lot?.product?.productName ?? (pid === 0 ? '품목 미지정' : `품목#${pid}`)
      const row = map.get(pid) ?? { id: pid, name, good: 0, defect: 0 }
      row.good += r.goodQty
      row.defect += r.defectQty
      map.set(pid, row)
    }
    const rows = [...map.values()]
      .map((row) => {
        const total = row.good + row.defect
        const rate = total === 0 ? 0 : (row.defect / total) * 100
        return { ...row, total, rate }
      })
      .sort((a, b) => b.rate - a.rate || b.defect - a.defect || b.total - a.total)
      .slice(0, qualityProductId === 'ALL' ? 8 : 1)
    const allTotal = allGood + allDefect
    const rate = allTotal === 0 ? 0 : (allDefect / allTotal) * 100
    const maxRate = Math.max(1, ...rows.map((r) => r.rate), rate)
    return {
      from,
      to,
      rows,
      goodSum: allGood,
      defectSum: allDefect,
      totalSum: allTotal,
      rate,
      maxRate,
    }
  }, [results, qualityFrom, qualityTo, qualityProductId])

  const kanbanColumns = useMemo(() => {
    const cols: { id: KanbanColId; label: string; tone: string }[] = [
      { id: 'READY', label: '대기', tone: 'wait' },
      { id: 'IN_PROGRESS', label: '진행', tone: 'progress' },
      { id: 'HOLD', label: '보류', tone: 'hold' },
    ]
    return cols.map((col) => ({
      ...col,
      items: workOrders
        .filter((w) => w.status === col.id)
        .sort((a, b) => b.id - a.id),
    }))
  }, [workOrders])

  const moveWoToColumn = useCallback(async (woId: number, newStatus: KanbanColId) => {
    const wo = workOrders.find((w) => w.id === woId)
    if (!wo || wo.status === newStatus) return

    const snapshot = workOrders
    setKanbanErr(null)
    setWoMovingId(woId)
    setWorkOrders((list) =>
      list.map((w) =>
        w.id === woId
          ? { ...w, status: newStatus, holdReason: newStatus === 'HOLD' ? w.holdReason ?? null : null }
          : w,
      ),
    )

    try {
      const body: { status: KanbanColId; holdReason?: string | null } = { status: newStatus }
      if (newStatus !== 'HOLD') body.holdReason = null
      await apiJson(`/api/work-orders/${woId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    } catch (e) {
      setWorkOrders(snapshot)
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : '상태 변경 실패'
      setKanbanErr(msg)
    } finally {
      setWoMovingId(null)
    }
  }, [workOrders])

  const onKanbanDragStart = (woId: number) => (ev: DragEvent) => {
    setDragWoId(woId)
    setKanbanErr(null)
    ev.dataTransfer.setData('text/plain', String(woId))
    ev.dataTransfer.effectAllowed = 'move'
  }

  const onKanbanDragEnd = () => {
    setDragWoId(null)
    setDropColId(null)
  }

  const onKanbanDragOver = (colId: KanbanColId) => (ev: DragEvent) => {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'move'
    setDropColId(colId)
  }

  const onKanbanDrop = (colId: KanbanColId) => (ev: DragEvent) => {
    ev.preventDefault()
    setDropColId(null)
    const raw = ev.dataTransfer.getData('text/plain')
    const woId = Number(raw)
    if (!Number.isFinite(woId)) return
    void moveWoToColumn(woId, colId)
    setDragWoId(null)
  }

  const woPlanPeriod = (w: WorkOrder) => {
    const p = w.planId != null ? planById.get(w.planId) : w.plan
    if (!p) return null
    return `${String(p.startDate).slice(0, 10)} ~ ${String(p.endDate).slice(0, 10)}`
  }

  const woLateDays = (w: WorkOrder) => {
    if (w.status === 'DONE') return 0
    const p = w.planId != null ? planById.get(w.planId) : w.plan
    if (!p) return 0
    const end = parseDateSafe(p.endDate)
    if (!end) return 0
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    const diff = startOfToday().getTime() - endDay.getTime()
    if (diff <= 0) return 0
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)))
  }

  const woWorkersShort = (w: WorkOrder) => {
    const list = w.assignedWorkers ?? []
    if (list.length === 0) return null
    if (list.length === 1) return list[0].worker.workerName
    return `${list[0].worker.workerName} 외 ${list.length - 1}명`
  }

  const kpiToneDone = woDoneRatePct >= 75 ? 'ok' : woDoneRatePct >= 40 ? 'warn' : 'danger'
  const defectPct = defectMetrics.rate * 100
  const kpiToneDefect = defectPct <= 2 ? 'ok' : defectPct <= 5 ? 'warn' : 'danger'
  const riskCount = delayRisk.totalRisk
  const kpiToneRisk = riskCount === 0 ? 'ok' : riskCount <= 3 ? 'warn' : 'danger'
  const woWaitPct = woKpi.total ? (woKpi.ready / woKpi.total) * 100 : 0
  const woInProgressPct = woKpi.total ? (woKpi.inProgress / woKpi.total) * 100 : 0
  const woDonePct = woKpi.total ? (woKpi.done / woKpi.total) * 100 : 0
  const woInProgressPctLabel = Math.round(woInProgressPct * 10) / 10
  const todayYmd = toYmd(new Date())
  const activeWos = workOrders.filter((w) => w.status === 'READY' || w.status === 'IN_PROGRESS' || w.status === 'HOLD')
  const kanbanSummaryTotal = activeWos.length
  const kanbanSummaryDelay = activeWos.filter((w) => {
    const p = w.planId != null ? planById.get(w.planId) : w.plan
    if (!p) return false
    const end = parseDateSafe(p.endDate)
    if (!end) return false
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    return endDay < startOfToday()
  }).length
  const kanbanSummaryToday = activeWos.filter((w) => {
    const p = w.planId != null ? planById.get(w.planId) : w.plan
    if (!p) return false
    const start = parseDateSafe(p.startDate)
    const end = parseDateSafe(p.endDate)
    if (!start || !end) return false
    const day = startOfToday()
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    return startDay <= day && day <= endDay
  }).length
  const kanbanSummaryHold = activeWos.filter((w) => w.status === 'HOLD').length

  return (
    <div className="mesPage mesDashPage">
      <header className="mesDashHeader">
        <h1 className="mesDashHeaderTitle">대시보드</h1>
        <div className="mesDashHeaderAside">
          {lastUpdated ? (
            <span className="mesDashHeaderMeta">
              마지막 갱신{' '}
              <time dateTime={lastUpdated.toISOString()}>{lastUpdated.toLocaleString('ko-KR')}</time>
            </span>
          ) : (
            <span className="mesDashHeaderMeta">데이터 불러오는 중…</span>
          )}
          <button type="button" className="mesBtnSecondary mesBtnSm" onClick={() => void load()}>
            새로고침
          </button>
        </div>
        {err && <p className="mesDashHeaderError">API 오류: {err}</p>}
      </header>

      <section className="mesDashKpiGrid" aria-label="핵심 지표">
        <Link to="/work-orders" className={`mesDashKpiCard mesDashKpiCard--${kpiToneDone} mesDashKpiCard--simple`}>
          <div className="mesDashSimpleHead">
            <div className="mesDashSimpleHeadMain">
              <span className={`mesDashSimpleLeadIcon mesDashSimpleLeadIcon--${kpiToneDone}`}><IconCheck /></span>
              <p className="mesDashSimpleTitle">지시 완료율</p>
            </div>
          </div>
          <div className="mesDashSimpleMain mesDashSimpleMain--split">
            <div className="mesDashSimpleMainPrimary">
              <p className="mesDashSimpleValue">{woKpi.total === 0 ? '—' : `${woDoneRatePct}%`}</p>
              <p className="mesDashSimpleSub">완료율 기준</p>
            </div>
            <div className="mesDashSimpleStats" aria-label="지시 완료율 상세">
              <div className="mesDashSimpleStat mesDashSimpleStat--ok">
                <span className="mesDashSimpleStatMeta">
                  <span className="mesDashSimpleStatIcon"><IconStatDone /></span>
                  <span className="mesDashSimpleStatLabel">완료</span>
                </span>
                <strong className="mesDashSimpleStatValue">{woKpi.done}</strong>
              </div>
              <div className="mesDashSimpleStat mesDashSimpleStat--neutral">
                <span className="mesDashSimpleStatMeta">
                  <span className="mesDashSimpleStatIcon"><IconStatTotal /></span>
                  <span className="mesDashSimpleStatLabel">전체</span>
                </span>
                <strong className="mesDashSimpleStatValue">{woKpi.total}</strong>
              </div>
            </div>
          </div>
          <div className="mesDashSimpleFoot">
            <div className="mesDashKpiBar">
              <div className={`mesDashKpiBarFill mesDashKpiBarFill--${kpiToneDone}`} style={{ width: `${woDoneRatePct}%` }} />
            </div>
          </div>
        </Link>

        <Link to="/process-result" className={`mesDashKpiCard mesDashKpiCard--${kpiToneDefect} mesDashKpiCard--simple`}>
          <div className="mesDashSimpleHead">
            <div className="mesDashSimpleHeadMain">
              <span className={`mesDashSimpleLeadIcon mesDashSimpleLeadIcon--${kpiToneDefect}`}><IconAlert /></span>
              <p className="mesDashSimpleTitle">불량률 (최근 7일)</p>
            </div>
          </div>
          <div className="mesDashSimpleMain mesDashSimpleMain--split">
            <div className="mesDashSimpleMainPrimary">
              <p className="mesDashSimpleValue">{defectMetrics.sumLast7 === 0 ? '—' : `${defectPct.toFixed(1)}%`}</p>
              <p className="mesDashSimpleSub">최근 7일 기준</p>
            </div>
            <div className="mesDashSimpleStats" aria-label="불량률 상세">
              <div className="mesDashSimpleStat mesDashSimpleStat--ok">
                <span className="mesDashSimpleStatMeta">
                  <span className="mesDashSimpleStatIcon"><IconStatGood /></span>
                  <span className="mesDashSimpleStatLabel">양품</span>
                </span>
                <strong className="mesDashSimpleStatValue">{defectMetrics.last7Good.toLocaleString()}</strong>
              </div>
              <div className="mesDashSimpleStat mesDashSimpleStat--danger">
                <span className="mesDashSimpleStatMeta">
                  <span className="mesDashSimpleStatIcon"><IconStatDefect /></span>
                  <span className="mesDashSimpleStatLabel">불량</span>
                </span>
                <strong className="mesDashSimpleStatValue">{defectMetrics.last7Defect.toLocaleString()}</strong>
              </div>
            </div>
          </div>
          <div className="mesDashSimpleFoot">
            <div className="mesDashKpiBar">
              <div
                className={`mesDashKpiBarFill mesDashKpiBarFill--${kpiToneDefect}`}
                style={{ width: `${Math.max(0, Math.min(100, defectPct))}%` }}
              />
            </div>
            {defectMetrics.sumLast7 === 0 ? null : (
              <p className={`mesDashSimpleDelta ${defectMetrics.deltaPp == null ? 'mesDashKpiDelta--flat' : defectMetrics.deltaPp >= 0 ? 'mesDashKpiDelta--up' : 'mesDashKpiDelta--down'}`}>
                {defectMetrics.deltaPp == null
                  ? '전주 대비 비교 데이터 없음'
                  : defectMetrics.deltaPp >= 0
                    ? `▲ ${defectMetrics.deltaPp.toFixed(2)}%p 전주 대비 증가`
                    : `▼ ${Math.abs(defectMetrics.deltaPp).toFixed(2)}%p 전주 대비 감소`}
              </p>
            )}
          </div>
        </Link>

        <Link to="/production-plans" className={`mesDashKpiCard mesDashKpiCard--${kpiToneRisk} mesDashKpiCard--risk`}>
          <div className="mesDashRiskHead">
            <div className="mesDashRiskHeadMain">
              <span className="mesDashRiskLeadIcon"><IconAlert /></span>
              <p className="mesDashRiskTitle">지연 · 주의</p>
            </div>
            <span className="mesDashRiskNeedChip">
              <span className="mesDashRiskNeedDot" aria-hidden />
              {riskCount === 0 ? '정상' : '확인 필요'}
            </span>
          </div>
          <div className="mesDashRiskMain">
            <div className="mesDashRiskCountWrap">
              <p className="mesDashRiskCount">{riskCount}건</p>
              <p className="mesDashRiskCountSub">종료일 경과 건수</p>
            </div>
            <div className="mesDashRiskBreakdown" aria-label="지연 상세">
              <div className="mesDashRiskStat">
                <span className="mesDashRiskStatMeta">
                  <IconCalendar />
                  <span className="mesDashRiskStatLabel">계획</span>
                </span>
                <strong className="mesDashRiskStatValue">{delayRisk.latePlans}</strong>
              </div>
              <div className="mesDashRiskStat">
                <span className="mesDashRiskStatMeta">
                  <IconClipboard />
                  <span className="mesDashRiskStatLabel">지시</span>
                </span>
                <strong className="mesDashRiskStatValue">{delayRisk.lateWos}</strong>
              </div>
            </div>
          </div>
          <div className="mesDashRiskFoot">
            <p className={`mesDashKpiDelta mesDashKpiDelta--risk ${riskCount === 0 ? 'mesDashKpiDelta--flat' : 'mesDashKpiDelta--up'}`}>
              <IconAlertCircle />
              {riskCount === 0 ? '지연 항목 없음' : '종료일 경과 항목 확인 필요'}
            </p>
          </div>
        </Link>

        <Link to="/integrated-ops" className="mesDashKpiCard mesDashKpiCard--info mesDashKpiCard--simple mesDashKpiCard--work">
          <div className="mesDashSimpleHead">
            <div className="mesDashSimpleHeadMain">
              <span className="mesDashSimpleLeadIcon mesDashSimpleLeadIcon--info"><IconQueue /></span>
              <p className="mesDashSimpleTitle">작업지시 현황</p>
            </div>
          </div>
          <div className="mesDashSimpleMain mesDashSimpleMain--split">
            <div className="mesDashSimpleMainPrimary">
              <p className="mesDashSimpleValue">{woKpi.total}건</p>
              <p className="mesDashSimpleSub">작업지시 총 건수</p>
            </div>
            <div className="mesDashWorkDonut" aria-label="작업지시 진행률">
              <svg viewBox="0 0 64 64" aria-hidden>
                <circle className="mesDashWorkDonutTrack" cx="32" cy="32" r="24" />
                <circle
                  className="mesDashWorkDonutValue mesDashWorkDonutValue--progress"
                  cx="32"
                  cy="32"
                  r="24"
                  pathLength="100"
                  strokeDasharray={`${woInProgressPct} 100`}
                  strokeDashoffset="0"
                />
                <circle
                  className="mesDashWorkDonutValue mesDashWorkDonutValue--wait"
                  cx="32"
                  cy="32"
                  r="24"
                  pathLength="100"
                  strokeDasharray={`${woWaitPct} 100`}
                  strokeDashoffset={-woInProgressPct}
                />
                <circle
                  className="mesDashWorkDonutValue mesDashWorkDonutValue--done"
                  cx="32"
                  cy="32"
                  r="24"
                  pathLength="100"
                  strokeDasharray={`${woDonePct} 100`}
                  strokeDashoffset={-(woInProgressPct + woWaitPct)}
                />
              </svg>
              <div className="mesDashWorkDonutCenter">
                <strong>{woInProgressPctLabel % 1 === 0 ? woInProgressPctLabel.toFixed(0) : woInProgressPctLabel.toFixed(1)}%</strong>
                <span>진행</span>
              </div>
            </div>
          </div>
          <div className="mesDashSimpleFoot mesDashSimpleFoot--work">
            <div className="mesDashSimpleStats mesDashSimpleStats--footer3" aria-label="작업지시 상태 상세">
              <div className="mesDashSimpleStat mesDashSimpleStat--wait">
                <span className="mesDashSimpleStatMeta">
                  <span className="mesDashSimpleStatIcon"><IconStatWait /></span>
                  <span className="mesDashSimpleStatLabel">대기</span>
                </span>
                <strong className="mesDashSimpleStatValue">{woKpi.ready}</strong>
              </div>
              <div className="mesDashSimpleStat mesDashSimpleStat--progress">
                <span className="mesDashSimpleStatMeta">
                  <span className="mesDashSimpleStatIcon"><IconStatProgress /></span>
                  <span className="mesDashSimpleStatLabel">진행</span>
                </span>
                <strong className="mesDashSimpleStatValue">{woKpi.inProgress}</strong>
              </div>
              <div className="mesDashSimpleStat mesDashSimpleStat--ok">
                <span className="mesDashSimpleStatMeta">
                  <span className="mesDashSimpleStatIcon"><IconStatDone /></span>
                  <span className="mesDashSimpleStatLabel">완료</span>
                </span>
                <strong className="mesDashSimpleStatValue">{woKpi.done}</strong>
              </div>
            </div>
          </div>
        </Link>
      </section>

      <section className="mesDashKanban" aria-label="작업 일정 보드">
        <div className="mesDashKanbanHead">
          <div className="mesDashKanbanHeadMain">
            <h2 className="mesDashKanbanTitle">작업 일정</h2>
            <p className="mesDashKanbanSub">
              카드를 드래그하여 대기 · 진행 · 보류 상태 변경
              {orphanWorkOrders.length > 0 && ` · 계획 미연결 ${orphanWorkOrders.length}건`}
            </p>
          </div>
        </div>
        <div className="mesDashKanbanLayout">
          <div className="mesDashWorkBoard">
            <div className="mesDashScheduleSummary" aria-label="작업 일정 요약">
              <div className="mesDashScheduleSummaryItem">
                <span className="mesDashScheduleSummaryIcon mesDashScheduleSummaryIcon--all"><IconCalendarMini /></span>
                <div>
                  <p className="mesDashScheduleSummaryLabel">전체</p>
                  <p className="mesDashScheduleSummaryValue">
                    <span className="mesDashScheduleSummaryValueNum">{kanbanSummaryTotal}</span>
                    <span className="mesDashScheduleSummaryValueUnit">건</span>
                  </p>
                </div>
              </div>
              <div className="mesDashScheduleSummaryItem">
                <span className="mesDashScheduleSummaryIcon mesDashScheduleSummaryIcon--delay"><IconClockMini /></span>
                <div>
                  <p className="mesDashScheduleSummaryLabel">지연</p>
                  <p className="mesDashScheduleSummaryValue">
                    <span className="mesDashScheduleSummaryValueNum">{kanbanSummaryDelay}</span>
                    <span className="mesDashScheduleSummaryValueUnit">건</span>
                  </p>
                </div>
              </div>
              <div className="mesDashScheduleSummaryItem">
                <span className="mesDashScheduleSummaryIcon mesDashScheduleSummaryIcon--today"><IconCalendarMini /></span>
                <div>
                  <p className="mesDashScheduleSummaryLabel">오늘 예정</p>
                  <p className="mesDashScheduleSummaryValue">
                    <span className="mesDashScheduleSummaryValueNum">{kanbanSummaryToday}</span>
                    <span className="mesDashScheduleSummaryValueUnit">건</span>
                  </p>
                </div>
              </div>
              <div className="mesDashScheduleSummaryItem">
                <span className="mesDashScheduleSummaryIcon mesDashScheduleSummaryIcon--hold"><IconPauseMini /></span>
                <div>
                  <p className="mesDashScheduleSummaryLabel">보류</p>
                  <p className="mesDashScheduleSummaryValue">
                    <span className="mesDashScheduleSummaryValueNum">{kanbanSummaryHold}</span>
                    <span className="mesDashScheduleSummaryValueUnit">건</span>
                  </p>
                </div>
              </div>
            </div>
            {kanbanErr ? <p className="mesDashKanbanErr">{kanbanErr}</p> : null}
            <div className="mesDashKanbanBoard mesDashKanbanBoard--triple">
              {kanbanColumns.map((col) => (
                <div key={col.id} className={`mesDashKanbanCol mesDashKanbanCol--${col.tone}`}>
                  <div className="mesDashKanbanColHead">
                    <span className="mesDashKanbanColLabel">{col.label}</span>
                    <span className="mesDashKanbanColCount">{col.items.length}</span>
                  </div>
                  <div
                    className={`mesDashKanbanColBody${dropColId === col.id ? ' mesDashKanbanColBody--drop' : ''}`}
                    onDragOver={onKanbanDragOver(col.id)}
                    onDragLeave={() => setDropColId((cur) => (cur === col.id ? null : cur))}
                    onDrop={onKanbanDrop(col.id)}
                  >
                    {col.items.length === 0 ? (
                      col.id === 'HOLD' ? (
                        <div className="mesDashKanbanEmptyHold">
                          <div className="mesDashKanbanEmptyHoldIcon" aria-hidden>
                            <IconKanbanEmptyTray />
                          </div>
                          <p className="mesDashKanbanEmptyHoldTitle">보류 중인 작업이 없습니다</p>
                          <p className="mesDashKanbanEmptyHoldSub">카드를 이 영역으로 이동하면 보류 상태로 변경됩니다.</p>
                        </div>
                      ) : (
                        <p className="mesDashKanbanEmpty">없음 · 여기로 드롭</p>
                      )
                    ) : (
                      col.items.map((w) => {
                        const period = woPlanPeriod(w)
                        const lateDays = woLateDays(w)
                        const workersShort = woWorkersShort(w) ?? '담당자 미지정'
                        const line = w.workCenter?.centerCode ?? '공정 미지정'
                        const isDragging = dragWoId === w.id
                        const isMoving = woMovingId === w.id
                        const lateTone = lateDays >= 7 ? 'critical' : lateDays >= 3 ? 'high' : lateDays >= 1 ? 'warn' : 'normal'
                        return (
                          <div
                            key={w.id}
                            className={`mesDashKanbanCard${isDragging ? ' mesDashKanbanCard--dragging' : ''}${isMoving ? ' mesDashKanbanCard--moving' : ''}`}
                            draggable={!isMoving}
                            onDragStart={onKanbanDragStart(w.id)}
                            onDragEnd={onKanbanDragEnd}
                          >
                            <div className="mesDashKanbanCardHead">
                              <Link to="/work-orders" className="mesDashKanbanCardNo" draggable={false}>
                                {w.woNo}
                              </Link>
                              {lateDays > 0 ? (
                                <span className={`mesDashKanbanLateBadge mesDashKanbanLateBadge--${lateTone}`}>
                                  지연 {lateDays}일
                                </span>
                              ) : (
                                <span className="mesDashKanbanLateBadge mesDashKanbanLateBadge--normal">
                                  {woStatusLabel(w.status)}
                                </span>
                              )}
                            </div>
                            <p className="mesDashKanbanCardProduct">{w.product?.productName ?? `품목#${w.id}`}</p>
                            <p className="mesDashKanbanCardPeriod">
                              <span className="mesDashKanbanCardMetaIcon"><IconKanbanCal /></span>
                              <span>{period ? period.replaceAll('-', '.').replace(' ~ ', ' → ') : '일정 미지정'}</span>
                            </p>
                            <p className="mesDashKanbanCardMeta">
                              <span className="mesDashKanbanCardMetaIcon"><IconKanbanUser /></span>
                              <span>{workersShort}</span>
                              <span className="mesDashKanbanCardSep">·</span>
                              <span className="mesDashKanbanCardLine">{line}</span>
                            </p>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="mesDashSchedulePanel" aria-label="일정 패널">
            <div className="mesDashSchedulePanelSection">
              <div className="mesDashCalNav">
                <button type="button" className="mesDashCalBtn" aria-label="이전 달" onClick={() => setCalPage(({ y, m }) => { const d = new Date(y, m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() } })}>‹</button>
                <p className="mesDashCalMonthText">{`${calPage.y}년 ${String(calPage.m + 1).padStart(2, '0')}월`}</p>
                <button type="button" className="mesDashCalBtn" aria-label="다음 달" onClick={() => setCalPage(({ y, m }) => { const d = new Date(y, m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() } })}>›</button>
                <button type="button" className="mesDashCalTodayBtn" onClick={() => { const t = new Date(); setCalPage({ y: t.getFullYear(), m: t.getMonth() }); setSelectedYmd(toYmd(t)) }}>오늘</button>
              </div>
              <div className="mesDashCalDow" aria-hidden>
                {dayNames.map((dn) => <span key={dn}>{dn}</span>)}
              </div>
              <div className="mesDashCalGrid">
                {calendarMonthCells.map((cell, idx) => {
                  if (cell.kind === 'pad') return <div key={`pad-${idx}`} className="mesDashCalDay mesDashCalDay--pad" />
                  const items = itemsByDate.get(cell.ymd) ?? []
                  const delayed = items.some((it) => it.kind === 'WO' && it.status !== 'DONE')
                  const isSelected = cell.ymd === selectedYmd
                  const isToday = cell.ymd === todayYmd
                  return (
                    <button
                      key={cell.ymd}
                      type="button"
                      className={[
                        'mesDashCalDay',
                        isSelected ? 'mesDashCalDay--selected' : '',
                        isToday ? 'mesDashCalDay--today' : '',
                        items.length > 0 ? 'mesDashCalDay--hasEvent' : '',
                        delayed ? 'mesDashCalDay--hasDelay' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setSelectedYmd(cell.ymd)}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mesDashSchedulePanelSection">
              <div className="mesDashSideListHead">
                <p>선택 날짜 일정</p>
                <span>{selectedYmd} · {selectedItems.length}건</span>
              </div>
              {selectedItems.length === 0 ? (
                <p className="mesDashKanbanEmpty">일정 없음</p>
              ) : (
                <div className="mesDashSideList">
                  {selectedItems.slice(0, 5).map((it) => {
                    const [meta, ...rest] = it.label.split(' · ')
                    const title = rest.length > 0 ? rest.join(' · ') : it.label
                    return (
                      <div key={it.id} className="mesDashSideListRow">
                        <span className={`mesDashSideListKind mesDashSideListKind--${it.kind === 'PLAN' ? 'plan' : 'wo'}`}>{it.kind}</span>
                        <div className="mesDashSideListBody">
                          <p className="mesDashSideListTitle">{title}</p>
                          <p className="mesDashSideListMeta">{meta} · {it.kind === 'PLAN' ? '생산계획' : '작업지시'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="mesDashLayout mesDashLayout--pair">
          <section className="mesDashPanel" aria-label="생산 실적 추이">
            <div className="mesDashPanelHead">
              <div>
                <h2 className="mesDashPanelTitle">생산 실적 추이</h2>
                <p className="mesDashPanelSub">
                  {trendProductId === 'ALL' ? '기간 · 물품별 생산량 추이' : '기간 · 양품/불량 추이'}
                </p>
              </div>
              <div className="mesDashTrendFilters">
                <label className="mesDashTrendFilter">
                  <span>시작</span>
                  <input
                    type="date"
                    value={trendFrom}
                    max={trendTo}
                    onChange={(ev) => {
                      const v = ev.target.value
                      if (!v) return
                      setTrendFrom(v)
                      if (v > trendTo) setTrendTo(v)
                    }}
                  />
                </label>
                <label className="mesDashTrendFilter">
                  <span>종료</span>
                  <input
                    type="date"
                    value={trendTo}
                    min={trendFrom}
                    onChange={(ev) => {
                      const v = ev.target.value
                      if (!v) return
                      setTrendTo(v)
                      if (v < trendFrom) setTrendFrom(v)
                    }}
                  />
                </label>
                <label className="mesDashTrendFilter">
                  <span>물품</span>
                  <select
                    value={trendProductId === 'ALL' ? 'ALL' : String(trendProductId)}
                    onChange={(ev) => {
                      const v = ev.target.value
                      setTrendProductId(v === 'ALL' ? 'ALL' : Number(v))
                      setTrendHoverIdx(null)
                    }}
                  >
                    <option value="ALL">전체 물품</option>
                    {trendProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mesDashPanelBody">
              <div className="mesDashChartStats">
                <div className="mesDashChartStat mesDashChartStat--good">
                  <span className="mesDashChartStatVal">{trendChart.goodSum.toLocaleString()}</span>
                  <span className="mesDashChartStatLabel">양품 합계</span>
                </div>
                <div className="mesDashChartStat mesDashChartStat--defect">
                  <span className="mesDashChartStatVal">{trendChart.defectSum.toLocaleString()}</span>
                  <span className="mesDashChartStatLabel">불량 합계</span>
                </div>
                <div className="mesDashChartStat">
                  <span className="mesDashChartStatVal">{trendChart.totalSum.toLocaleString()}</span>
                  <span className="mesDashChartStatLabel">총 생산량</span>
                </div>
              </div>

              <div
                className="mesDashLineChart"
                onMouseLeave={() => setTrendHoverIdx(null)}
              >
                <svg viewBox={`0 0 ${trendPaths.w} ${trendPaths.h}`} className="mesDashLineChartSvg" role="img" aria-label="생산 실적 꺾은선 차트">
                  {trendPaths.yTicks.map((t) => (
                    <g key={`yt-${t.v}`}>
                      <line
                        x1={trendPaths.padL}
                        x2={trendPaths.w - trendPaths.padR}
                        y1={t.y}
                        y2={t.y}
                        className="mesDashLineChartGrid"
                      />
                      <text x={trendPaths.padL - 8} y={t.y + 3} className="mesDashLineChartTick" textAnchor="end">
                        {t.v}
                      </text>
                    </g>
                  ))}

                  {trendPaths.mode === 'all' ? (
                    <>
                      {trendPaths.seriesPaths.map((s) => (
                        <path
                          key={s.id}
                          d={s.d}
                          className="mesDashLineChartPath"
                          style={{ stroke: s.color }}
                        />
                      ))}
                      {trendPaths.points.map((p) => (
                        <g key={p.ymd}>
                          <rect
                            x={p.x - Math.max(8, trendPaths.innerW / Math.max(trendPaths.points.length, 1) / 2)}
                            y={trendPaths.padT}
                            width={Math.max(16, trendPaths.innerW / Math.max(trendPaths.points.length, 1))}
                            height={trendPaths.innerH}
                            className="mesDashLineChartHit"
                            onMouseEnter={() => setTrendHoverIdx(p.i)}
                          />
                          {(p.i % trendPaths.labelStep === 0 || p.i === trendPaths.points.length - 1) && (
                            <text
                              x={p.x}
                              y={trendPaths.h - 8}
                              className={`mesDashLineChartXLabel${p.ymd === todayYmd ? ' mesDashLineChartXLabel--today' : ''}`}
                              textAnchor="middle"
                            >
                              {p.label}
                            </text>
                          )}
                        </g>
                      ))}
                      {trendHoverIdx != null && trendPaths.points[trendHoverIdx] && (
                        <>
                          <line
                            x1={trendPaths.points[trendHoverIdx].x}
                            x2={trendPaths.points[trendHoverIdx].x}
                            y1={trendPaths.padT}
                            y2={trendPaths.padT + trendPaths.innerH}
                            className="mesDashLineChartHoverLine"
                          />
                          {trendPaths.seriesPaths.map((s) => {
                            const v = s.values[trendHoverIdx] ?? 0
                            const y =
                              trendPaths.padT +
                              trendPaths.innerH -
                              (trendPaths.innerH * v) / Math.max(trendChart.max, 1)
                            return (
                              <circle
                                key={`h-${s.id}`}
                                cx={trendPaths.points[trendHoverIdx].x}
                                cy={y}
                                r={4}
                                fill={s.color}
                              />
                            )
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <path d={trendPaths.toPath('good')} className="mesDashLineChartPath mesDashLineChartPath--good" />
                      <path d={trendPaths.toPath('defect')} className="mesDashLineChartPath mesDashLineChartPath--defect" />
                      {trendPaths.points.map((p) => (
                        <g key={p.ymd}>
                          <circle
                            cx={p.x}
                            cy={p.yGood}
                            r={trendHoverIdx === p.i ? 4.5 : 3}
                            className="mesDashLineChartDot mesDashLineChartDot--good"
                            onMouseEnter={() => setTrendHoverIdx(p.i)}
                          />
                          <circle
                            cx={p.x}
                            cy={p.yDefect}
                            r={trendHoverIdx === p.i ? 4.5 : 3}
                            className="mesDashLineChartDot mesDashLineChartDot--defect"
                            onMouseEnter={() => setTrendHoverIdx(p.i)}
                          />
                          <rect
                            x={p.x - Math.max(8, trendPaths.innerW / Math.max(trendPaths.points.length, 1) / 2)}
                            y={trendPaths.padT}
                            width={Math.max(16, trendPaths.innerW / Math.max(trendPaths.points.length, 1))}
                            height={trendPaths.innerH}
                            className="mesDashLineChartHit"
                            onMouseEnter={() => setTrendHoverIdx(p.i)}
                          />
                          {(p.i % trendPaths.labelStep === 0 || p.i === trendPaths.points.length - 1) && (
                            <text
                              x={p.x}
                              y={trendPaths.h - 8}
                              className={`mesDashLineChartXLabel${p.ymd === todayYmd ? ' mesDashLineChartXLabel--today' : ''}`}
                              textAnchor="middle"
                            >
                              {p.label}
                            </text>
                          )}
                        </g>
                      ))}
                      {trendHoverIdx != null && trendPaths.points[trendHoverIdx] && (
                        <line
                          x1={trendPaths.points[trendHoverIdx].x}
                          x2={trendPaths.points[trendHoverIdx].x}
                          y1={trendPaths.padT}
                          y2={trendPaths.padT + trendPaths.innerH}
                          className="mesDashLineChartHoverLine"
                        />
                      )}
                    </>
                  )}
                </svg>
                {trendHoverIdx != null && trendPaths.points[trendHoverIdx] && (
                  <div
                    className="mesDashLineChartTooltip"
                    style={{
                      left: `${(trendPaths.points[trendHoverIdx].x / trendPaths.w) * 100}%`,
                    }}
                  >
                    <strong>{trendPaths.points[trendHoverIdx].ymd}</strong>
                    {trendPaths.mode === 'all' ? (
                      <>
                        <span>합계 {(trendPaths.points[trendHoverIdx] as { total: number }).total.toLocaleString()}</span>
                        {trendPaths.seriesPaths.map((s) => {
                          const v = (trendPaths.points[trendHoverIdx] as { byProduct: Record<number, number> }).byProduct[s.id] ?? 0
                          if (v <= 0) return null
                          return (
                            <span key={s.id} style={{ color: s.color }}>
                              {s.name} {v.toLocaleString()}
                            </span>
                          )
                        })}
                      </>
                    ) : (
                      <>
                        <span className="mesDashLineChartTooltipGood">
                          양품 {(trendPaths.points[trendHoverIdx] as { good: number }).good.toLocaleString()}
                        </span>
                        <span className="mesDashLineChartTooltipDefect">
                          불량 {(trendPaths.points[trendHoverIdx] as { defect: number }).defect.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="mesDashChartLegend">
                {trendPaths.mode === 'all' ? (
                  trendPaths.seriesPaths.length === 0 ? (
                    <span className="mesDashChartLegendItem">해당 기간 데이터 없음</span>
                  ) : (
                    trendPaths.seriesPaths.map((s) => (
                      <span key={s.id} className="mesDashChartLegendItem">
                        <span className="mesDashChartLegendDot" style={{ background: s.color }} />
                        {s.name}
                      </span>
                    ))
                  )
                ) : (
                  <>
                    <span className="mesDashChartLegendItem"><span className="mesDashChartLegendDot mesDashChartLegendDot--good" />양품</span>
                    <span className="mesDashChartLegendItem"><span className="mesDashChartLegendDot mesDashChartLegendDot--defect" />불량</span>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="mesDashPanel" aria-label="품질관리 현황">
            <div className="mesDashPanelHead">
              <div>
                <h2 className="mesDashPanelTitle">품질관리 현황</h2>
                <p className="mesDashPanelSub">
                  기간 불량률 {productQuality.rate.toFixed(2)}%
                  {qualityProductId === 'ALL'
                    ? ` · 상위 ${productQuality.rows.length}품목`
                    : ' · 선택 물품'}
                </p>
              </div>
              <div className="mesDashTrendFilters">
                <label className="mesDashTrendFilter">
                  <span>시작</span>
                  <input
                    type="date"
                    value={qualityFrom}
                    max={qualityTo}
                    onChange={(ev) => {
                      const v = ev.target.value
                      if (!v) return
                      setQualityFrom(v)
                      setQualityRangeReady(true)
                      if (v > qualityTo) setQualityTo(v)
                    }}
                  />
                </label>
                <label className="mesDashTrendFilter">
                  <span>종료</span>
                  <input
                    type="date"
                    value={qualityTo}
                    min={qualityFrom}
                    onChange={(ev) => {
                      const v = ev.target.value
                      if (!v) return
                      setQualityTo(v)
                      setQualityRangeReady(true)
                      if (v < qualityFrom) setQualityFrom(v)
                    }}
                  />
                </label>
                <label className="mesDashTrendFilter">
                  <span>물품</span>
                  <select
                    value={qualityProductId === 'ALL' ? 'ALL' : String(qualityProductId)}
                    onChange={(ev) => {
                      const v = ev.target.value
                      setQualityProductId(v === 'ALL' ? 'ALL' : Number(v))
                    }}
                  >
                    <option value="ALL">전체 물품</option>
                    {trendProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mesDashPanelBody">
              <div className="mesDashSimpleStats mesDashSimpleStats--footer3 mesDashQualityStats" aria-label="품질 요약">
                <div className="mesDashSimpleStat mesDashSimpleStat--ok">
                  <span className="mesDashSimpleStatMeta">
                    <span className="mesDashSimpleStatIcon"><IconStatGood /></span>
                    <span className="mesDashSimpleStatLabel">양품</span>
                  </span>
                  <strong className="mesDashSimpleStatValue">{productQuality.goodSum.toLocaleString()}</strong>
                </div>
                <div className="mesDashSimpleStat mesDashSimpleStat--danger">
                  <span className="mesDashSimpleStatMeta">
                    <span className="mesDashSimpleStatIcon"><IconStatDefect /></span>
                    <span className="mesDashSimpleStatLabel">불량</span>
                  </span>
                  <strong className="mesDashSimpleStatValue">{productQuality.defectSum.toLocaleString()}</strong>
                </div>
                <div className="mesDashSimpleStat mesDashSimpleStat--neutral">
                  <span className="mesDashSimpleStatMeta">
                    <span className="mesDashSimpleStatIcon"><IconStatTotal /></span>
                    <span className="mesDashSimpleStatLabel">총량</span>
                  </span>
                  <strong className="mesDashSimpleStatValue">{productQuality.totalSum.toLocaleString()}</strong>
                </div>
              </div>

              <div className="mesDashQualityRateBar">
                <div className="mesDashQualityRateBarHead">
                  <span>기간 불량률</span>
                  <strong className={productQuality.rate <= 2 ? 'is-ok' : productQuality.rate <= 5 ? 'is-warn' : 'is-bad'}>
                    {productQuality.rate.toFixed(2)}%
                  </strong>
                </div>
                <div className="mesDashQualityTrack" aria-hidden>
                  <div
                    className="mesDashQualityFill"
                    style={{ width: `${Math.min(100, Math.max(productQuality.rate > 0 ? 3 : 0, productQuality.rate * 4))}%` }}
                  />
                </div>
              </div>

              {productQuality.rows.length === 0 ? (
                <p className="mesDashEmpty">선택 기간에 실적이 없습니다. 시작·종료일을 조정해 보세요.</p>
              ) : (
                <div className="mesDashQualityList">
                  {productQuality.rows.map((row, idx) => (
                    <div key={row.id} className="mesDashQualityRow">
                      <div className="mesDashQualityRowTop">
                        <span className="mesDashQualityRank">{idx + 1}</span>
                        <span className="mesDashQualityName" title={row.name}>{row.name}</span>
                        <span className={`mesDashQualityPct ${row.rate <= 2 ? 'is-ok' : row.rate <= 5 ? 'is-warn' : 'is-bad'}`}>
                          {row.rate.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mesDashQualityTrack" aria-hidden>
                        <div
                          className="mesDashQualityFill"
                          style={{ width: `${Math.max(4, (row.rate / productQuality.maxRate) * 100)}%` }}
                        />
                      </div>
                      <div className="mesDashQualityMeta">
                        <span>양품 {row.good.toLocaleString()}</span>
                        <span>불량 {row.defect.toLocaleString()}</span>
                        <span>합계 {row.total.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
      </div>
    </div>
  )
}
