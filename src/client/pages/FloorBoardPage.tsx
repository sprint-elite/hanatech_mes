import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../lib/api'
import pkg from '../../../package.json'
import './floor-board.css'

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
  product?: { productCode: string; productName: string }
  plan?: { planNo: string; startDate: string; endDate: string }
  workCenter?: { centerCode: string; centerName: string } | null
  assignedWorkers?: { worker: { workerName: string } }[]
}
type Lot = {
  id: number
  status: string
  createdAt: string
  woId: number | null
  lotNo: string
  goodQty: number
  defectQty: number
  lotQty: number
}
type ProcessResult = { id: number; createdAt: string; goodQty: number; defectQty: number }
type WcRow = {
  id: number
  centerCode: string
  centerName: string
  centerType: string
  useYn: 'Y' | 'N'
}
type ShipmentRow = {
  id: number
  shipmentNo: string
  status: string
  details: { qty: number }[]
}

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

const lotStatusLabel = (s: string) => {
  if (s === 'CREATED') return '생성'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'OUTSOURCING') return '외주'
  return s
}

const REFRESH_MS = 45_000

const BRAND = import.meta.env.VITE_FLOOR_BRAND ?? 'HANA-TECH'

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0 1 8-8V2l3 3-3 3V7a6 6 0 1 0 1.8 4.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22Zm7-5V11a7 7 0 1 0-14 0v6l-2 2h18l-2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSliders({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M4 14h4m4-5h4m4 9h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconExpand({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3H3v6M15 21h6v-6M21 3l-6 6M3 21l6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type RingProps = {
  pct: number
  size?: number
  stroke?: number
  className?: string
  accent?: string
}

/** 스크린 보드용 시안 (레퍼런스 #00E5FF 계열) */
const C_CYAN = '#00e5ff'

function RingGauge({ pct, size = 112, stroke = 9, className, accent = C_CYAN }: RingProps) {
  const p = Math.min(100, Math.max(0, pct))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - p / 100)
  const cx = size / 2
  const cy = size / 2
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 10px ${accent}55)` }}
      />
    </svg>
  )
}

type LineCardProps = {
  lineName: string
  lotText: string
  statusLabel: string
  woStatus: string | null
  pct: number
  orderQty: number
  goodQty: number
  defectQty: number
  centerCode: string
  hasWo: boolean
}

function LineCard({
  lineName,
  lotText,
  statusLabel,
  woStatus,
  pct,
  orderQty,
  goodQty,
  defectQty,
  centerCode,
  hasWo,
}: LineCardProps) {
  const ringColor =
    woStatus === 'IN_PROGRESS' ? C_CYAN : woStatus === 'READY' ? '#60a5fa' : '#64748b'
  return (
    <article className={`fbLine${woStatus === 'IN_PROGRESS' ? ' fbLine--run' : ''}`}>
      <div className="fbLine__top">
        <div>
          <h4 className="fbLine__title">
            <span className="fbLine__pill">내부</span>
            {lineName}
          </h4>
          <div className="fbLine__lot">
            <span className="fbLine__lotDot" aria-hidden />
            <span>
              {lotText} · {statusLabel}
            </span>
          </div>
        </div>
        <div className="fbLine__ring" aria-label={hasWo ? `진행률 ${pct}%` : undefined}>
          <RingGauge pct={hasWo ? pct : 0} size={80} stroke={6} accent={ringColor} />
          <span className="fbLine__ringPct">{hasWo ? `${pct}%` : '—'}</span>
        </div>
      </div>
      <div className="fbLine__metrics">
        <div className="fbLine__m">
          <span>목표 수량</span>
          <strong>{hasWo ? orderQty.toLocaleString() : '—'}</strong>
        </div>
        <div className="fbLine__m fbLine__m--right">
          <span>투입 수량</span>
          <strong>{hasWo ? (goodQty + defectQty).toLocaleString() : '—'}</strong>
        </div>
        <div className="fbLine__m">
          <span>양품 (LOT)</span>
          <strong className="primary">{goodQty.toLocaleString()}</strong>
        </div>
        <div className="fbLine__m fbLine__m--right">
          <span>불량 (LOT)</span>
          <strong className="bad">{defectQty.toLocaleString()}</strong>
        </div>
      </div>
      <div className="fbLine__foot">
        <span className="mono">REF · {centerCode}</span>
        <span>실시간 집계</span>
      </div>
    </article>
  )
}

export function FloorBoardPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [results, setResults] = useState<ProcessResult[]>([])
  const [workCenters, setWorkCenters] = useState<WcRow[]>([])
  const [shipments, setShipments] = useState<ShipmentRow[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const [pingMs, setPingMs] = useState<number | null>(null)
  const [refreshDeadline, setRefreshDeadline] = useState(() => Date.now() + REFRESH_MS)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const secToRefresh = useMemo(
    () => Math.max(0, Math.ceil((refreshDeadline - Date.now()) / 1000)),
    [refreshDeadline, tick],
  )

  const load = useCallback(async () => {
    const t0 = performance.now()
    try {
      const [healthRes, planRes, woRes, lotsRes, prRes, wcRes, shipRes] = await Promise.all([
        fetch('/api/health'),
        apiJson<{ ok: boolean; items: Plan[] }>('/api/production-plans'),
        apiJson<{ ok: boolean; items: WorkOrder[] }>('/api/work-orders'),
        apiJson<{ ok: boolean; items: Lot[] }>('/api/lots'),
        apiJson<{ ok: boolean; items: ProcessResult[] }>('/api/process-results'),
        apiJson<{ ok: boolean; items: WcRow[] }>('/api/work-centers'),
        apiJson<{ ok: boolean; items: ShipmentRow[] }>('/api/shipments'),
      ])
      if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`)
      setHealth((await healthRes.json()) as Health)
      setPlans(planRes.items)
      setWorkOrders(woRes.items)
      setLots(lotsRes.items)
      setResults(prRes.items)
      setWorkCenters(wcRes.items)
      setShipments(shipRes.items)
      setLastUpdated(new Date())
      setRefreshDeadline(Date.now() + REFRESH_MS)
      setErr(null)
      setPingMs(Math.min(9999, Math.round(performance.now() - t0)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setPingMs(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const root = document.documentElement
    if (document.fullscreenElement) void document.exitFullscreen()
    else void root.requestFullscreen().catch(() => {})
  }, [])

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  const lotByWoId = useMemo(() => {
    const m = new Map<number, Lot[]>()
    for (const l of lots) {
      if (l.woId == null) continue
      const arr = m.get(l.woId) ?? []
      arr.push(l)
      m.set(l.woId, arr)
    }
    return m
  }, [lots])

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
    const samples: { key: string; text: string; tone: 'danger' | 'warn' }[] = []
    for (const p of plans) {
      if (samples.length >= 8) break
      if (p.status === 'CLOSED') continue
      const end = parseDateSafe(p.endDate)
      if (!end) continue
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      if (endDay >= today) continue
      samples.push({
        key: `p-${p.id}`,
        text: `계획 ${p.planNo} 종료일 경과 (${String(p.endDate).slice(0, 10)})`,
        tone: 'danger',
      })
    }
    for (const w of workOrders) {
      if (samples.length >= 8) break
      if (w.status === 'DONE') continue
      const p = w.planId != null ? planById.get(w.planId) : null
      if (!p) continue
      const end = parseDateSafe(p.endDate)
      if (!end) continue
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      if (endDay >= today) continue
      samples.push({
        key: `w-${w.id}`,
        text: `지시 ${w.woNo} · 계획 종료일 경과 · ${woStatusLabel(w.status)}`,
        tone: 'warn',
      })
    }
    return { latePlans, lateWos, totalRisk: latePlans + lateWos, samples }
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
    return { rate, deltaPp, last7Good: last7.g, sumLast7 }
  }, [resultBuckets])

  const resultKpi = useMemo(() => {
    const today = new Date()
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i))
      return { ymd: toYmd(d), good: 0, defect: 0 }
    })
    const idx = new Map(days.map((d, i) => [d.ymd, i]))
    for (const r of results) {
      const key = toYmd(new Date(r.createdAt))
      const i = idx.get(key)
      if (i == null) continue
      days[i].good += r.goodQty
      days[i].defect += r.defectQty
    }
    const max = Math.max(1, ...days.map((d) => d.good + d.defect))
    return { days, max }
  }, [results])

  const openPlanTargetQty = useMemo(() => {
    return plans.filter((p) => p.status !== 'CLOSED').reduce((a, p) => a + p.planQty, 0)
  }, [plans])

  const estThroughputPerHour = useMemo(() => {
    if (defectMetrics.last7Good <= 0) return 0
    return Math.max(0, Math.round(defectMetrics.last7Good / (7 * 24)))
  }, [defectMetrics.last7Good])

  const logistics = useMemo(() => {
    let readyQty = 0
    let readyN = 0
    let shippedQty = 0
    let shippedN = 0
    for (const s of shipments) {
      const q = s.details.reduce((a, d) => a + d.qty, 0)
      if (s.status === 'READY') {
        readyN += 1
        readyQty += q
      } else if (s.status === 'SHIPPED') {
        shippedN += 1
        shippedQty += q
      }
    }
    return { readyQty, readyN, shippedQty, shippedN }
  }, [shipments])

  const outsourceLotCount = useMemo(() => lots.filter((l) => l.status === 'OUTSOURCING').length, [lots])

  const lineWorkCenters = useMemo(() => {
    return workCenters.filter((w) => w.useYn === 'Y' && w.centerType === 'LINE')
  }, [workCenters])

  const activeLineCodes = useMemo(() => {
    const set = new Set<string>()
    for (const w of workOrders) {
      if (w.status !== 'IN_PROGRESS') continue
      const c = w.workCenter?.centerCode
      if (c) set.add(c)
    }
    return set
  }, [workOrders])

  const activeLinesOnFloor = useMemo(() => {
    let n = 0
    for (const wc of lineWorkCenters) {
      if (activeLineCodes.has(wc.centerCode)) n += 1
    }
    return n
  }, [lineWorkCenters, activeLineCodes])

  const lineSlots = useMemo((): (WcRow | null)[] => {
    const sorted = [...lineWorkCenters].sort((a, b) => a.id - b.id)
    const slots: (WcRow | null)[] = sorted.slice(0, 3)
    while (slots.length < 3) slots.push(null)
    return slots
  }, [lineWorkCenters])

  const woProgressPct = (w: WorkOrder) => {
    const target = Math.max(1, w.orderQty)
    const ls = lotByWoId.get(w.id) ?? []
    const good =
      ls.length > 0
        ? ls.reduce((acc, l) => acc + Math.max(0, l.goodQty), 0)
        : w.completedQty
    const pct = (good / target) * 100
    return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
  }

  const woLotSummary = (w: WorkOrder) => {
    const ls = lotByWoId.get(w.id)
    if (!ls || ls.length === 0) return '—'
    const first = ls[0]
    return `${first.lotNo} · ${lotStatusLabel(first.status)}`
  }

  const woLotNo = (w: WorkOrder) => {
    const ls = lotByWoId.get(w.id)
    if (!ls || ls.length === 0) return '—'
    return ls[0].lotNo
  }

  const lotGoodDefect = (woId: number) => {
    const ls = lotByWoId.get(woId) ?? []
    return ls.reduce(
      (a, l) => ({ g: a.g + l.goodQty, d: a.d + l.defectQty }),
      { g: 0, d: 0 },
    )
  }

  const pickWoForCenter = (wc: WcRow | null): WorkOrder | null => {
    if (!wc) return null
    const list = workOrders.filter((w) => w.workCenter?.centerCode === wc.centerCode)
    const ing = list.find((w) => w.status === 'IN_PROGRESS')
    if (ing) return ing
    const ready = list.find((w) => w.status === 'READY')
    if (ready) return ready
    const hold = list.find((w) => w.status === 'HOLD')
    if (hold) return hold
    return list[0] ?? null
  }

  const statusRank = (s: string) => {
    if (s === 'IN_PROGRESS') return 0
    if (s === 'READY') return 1
    if (s === 'HOLD') return 2
    if (s === 'DONE') return 3
    return 9
  }

  const displayWorkOrders = useMemo(() => {
    return [...workOrders]
      .sort((a, b) => {
        const ra = statusRank(a.status)
        const rb = statusRank(b.status)
        if (ra !== rb) return ra - rb
        return b.id - a.id
      })
      .slice(0, 12)
  }, [workOrders])

  const defectPct = defectMetrics.rate * 100
  const yieldPct = useMemo(() => {
    const s = defectMetrics.sumLast7
    if (s === 0) return null
    return Math.round((defectMetrics.last7Good / s) * 1000) / 10
  }, [defectMetrics])

  const riskCount = delayRisk.totalRisk

  const sysTone = useMemo(() => {
    if (err || health?.ok === false) return 'crit' as const
    if (riskCount > 0) return 'warn' as const
    return 'ok' as const
  }, [err, health?.ok, riskCount])

  const sysLabel =
    sysTone === 'ok' ? '최적' : sysTone === 'warn' ? '주의' : '점검'

  const activityLogs = useMemo(() => {
    const time = lastUpdated
      ? lastUpdated.toLocaleTimeString('ko-KR', { hour12: false })
      : clock.toLocaleTimeString('ko-KR', { hour12: false })
    const rows: { key: string; time: string; level: 'SYSTEM' | 'WARN' | 'ERROR'; text: string }[] = []
    if (err) {
      rows.push({ key: 'err', time, level: 'ERROR', text: `API 연결 실패: ${err}` })
    } else if (health?.ok) {
      rows.push({ key: 'sync', time, level: 'SYSTEM', text: '생산·재고 데이터 동기화 완료' })
    }
    if (woKpi.inProgress > 0) {
      rows.push({
        key: 'wo-run',
        time,
        level: 'SYSTEM',
        text: `진행 중 작업지시 ${woKpi.inProgress}건 · 가동 라인 ${activeLinesOnFloor}/${Math.max(1, lineWorkCenters.length)}`,
      })
    }
    for (const s of delayRisk.samples) {
      rows.push({
        key: s.key,
        time,
        level: s.tone === 'danger' ? 'ERROR' : 'WARN',
        text: s.text,
      })
    }
    if (logistics.readyN > 0) {
      rows.push({
        key: 'ship',
        time,
        level: 'WARN',
        text: `출하 대기 ${logistics.readyN}건 · ${logistics.readyQty.toLocaleString()} EA`,
      })
    }
    return rows.slice(0, 14)
  }, [
    err,
    health?.ok,
    lastUpdated,
    clock,
    woKpi.inProgress,
    activeLinesOnFloor,
    lineWorkCenters.length,
    delayRisk.samples,
    logistics.readyN,
    logistics.readyQty,
  ])

  const woPillClass = (s: string) => {
    if (s === 'IN_PROGRESS') return 'fb__pill fb__pill--run'
    if (s === 'DONE') return 'fb__pill fb__pill--done'
    if (s === 'HOLD') return 'fb__pill fb__pill--hold'
    return 'fb__pill fb__pill--wait'
  }

  return (
    <div className="fb">
      <div className="fb__bg" aria-hidden />

      <header className="fb__topbar">
        <div className="fb__brand">{BRAND}</div>
        <div className="fb__topbarRight">
          <div className="fb__sys">
            <span className="fb__sysLbl">시스템 상태</span>
            <div
              className={`fb__sysRow${sysTone === 'warn' ? ' fb__sysRow--warn' : ''}${sysTone === 'crit' ? ' fb__sysRow--crit' : ''}`}
            >
              <span className="fb__sysDot" />
              SYSTEM: {sysLabel}
            </div>
          </div>
          <div className="fb__vline" aria-hidden />
          <div className="fb__clock" aria-live="polite">
            {clock.toLocaleTimeString('ko-KR', { hour12: false })}
          </div>
          <div className="fb__icons">
            <Link to="/" className="fb__iconBtn" title="관리 화면">
              ⌂
            </Link>
            <button type="button" className="fb__iconBtn" onClick={() => void load()} title="새로고침">
              <IconRefresh />
            </button>
            <button type="button" className="fb__iconBtn" title="알림 (준비 중)" disabled>
              <IconBell />
            </button>
            <button type="button" className="fb__iconBtn" title="설정 (준비 중)" disabled>
              <IconSliders />
            </button>
            <button type="button" className="fb__iconBtn" onClick={toggleFullscreen} title="전체 화면">
              <IconExpand />
            </button>
          </div>
        </div>
      </header>

      <div className="fb__layout">
        <div className="fb__colMain">
          <section className="fb__kpis" aria-label="요약 KPI">
            <article className="fb__kpi fb__kpi--prod">
              <div className="fb__kpiKicker">Production</div>
              <div className="fb__kpiBig mono">
                {estThroughputPerHour > 0 ? estThroughputPerHour.toLocaleString() : '—'}
                <span>EA/H</span>
              </div>
              <div className="fb__kpiSub">TARGET · {openPlanTargetQty.toLocaleString()} EA</div>
              <div className="fb__kpiBar">
                <div className="fb__kpiBarTrack">
                  <div
                    className="fb__kpiBarFill"
                    style={{ width: `${woKpi.total === 0 ? 0 : woDoneRatePct}%` }}
                  />
                </div>
                <div className="fb__kpiBarLbl">
                  <span>지시 완료율</span>
                  <span className="mono">
                    {woKpi.total === 0 ? '—' : `${woDoneRatePct}%`} ({woKpi.done}/{woKpi.total})
                  </span>
                </div>
              </div>
            </article>

            <article className="fb__kpi fb__kpi--log">
              <div className="fb__kpiKicker">Logistics</div>
              <ul className="fb__kpiList">
                <li>
                  <span>출하 대기</span>
                  <strong>
                    {logistics.readyN}건 · {logistics.readyQty.toLocaleString()} EA
                  </strong>
                </li>
                <li>
                  <span>출하 완료</span>
                  <strong>
                    {logistics.shippedN}건 · {logistics.shippedQty.toLocaleString()} EA
                  </strong>
                </li>
                <li>
                  <span>외주 LOT</span>
                  <strong className="mono">{String(outsourceLotCount).padStart(2, '0')} 건</strong>
                </li>
              </ul>
            </article>

            <article className="fb__kpi fb__kpi--qc">
              <div className="fb__kpiKicker">Quality</div>
              <div className="fb__kpiSplit">
                <div className="fb__kpiSplitItem">
                  <div className="val val--good mono">{yieldPct == null ? '—' : `${yieldPct}%`}</div>
                  <div className="lbl">Yield (7D)</div>
                </div>
                <div className="fb__kpiSplitItem">
                  <div className="val val--bad mono">
                    {defectMetrics.sumLast7 === 0 ? '—' : `${defectPct.toFixed(2)}%`}
                  </div>
                  <div className="lbl">Defect (7D)</div>
                </div>
              </div>
              <div className="fb__kpiSub mono" style={{ marginTop: 8 }}>
                GOOD {defectMetrics.last7Good.toLocaleString()} · DEF{' '}
                {Math.max(0, defectMetrics.sumLast7 - defectMetrics.last7Good).toLocaleString()}
              </div>
            </article>

            <article className="fb__kpi fb__kpi--res">
              <div className="fb__kpiKicker">Resources</div>
              <div className="fb__nodes">
                <div className="fb__node">
                  <div className="fb__nodeLbl">내장 라인</div>
                  <div className="fb__nodeVal" style={{ color: 'var(--fb-primary)' }}>
                    {woKpi.inProgress > 0 ? 'ACTIVE' : 'STANDBY'}
                  </div>
                </div>
                <div className="fb__node">
                  <div className="fb__nodeLbl">가동 라인</div>
                  <div className="fb__nodeVal mono">
                    {activeLinesOnFloor}/{Math.max(1, lineWorkCenters.length)}
                  </div>
                </div>
                <div className="fb__node">
                  <div className="fb__nodeLbl">진행 지시</div>
                  <div className="fb__nodeVal mono">{woKpi.inProgress}건</div>
                </div>
              </div>
            </article>
          </section>

          <section className="fb__zone" aria-label="라인 모니터링">
            <div className="fb__zoneHead">
              <div className="fb__zoneTitleWrap">
                <span className="fb__zoneBadge">REAL-TIME MONITORING</span>
                <h2 className="fb__zoneTitle">내부 조립 · 라인 / 설비</h2>
              </div>
              <div className="fb__zoneMeta">
                <div className="fb__legend">
                  <span>
                    <span className="fb__ldot fb__ldot--run" /> 진행
                  </span>
                  <span>
                    <span className="fb__ldot fb__ldot--wait" /> 대기
                  </span>
                  <span>
                    <span className="fb__ldot fb__ldot--stop" /> 정지
                  </span>
                </div>
                {lastUpdated ? (
                  <span className="mono">
                    LAST UPDATE{' '}
                    <time dateTime={lastUpdated.toISOString()}>{lastUpdated.toLocaleString('ko-KR')}</time>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="fb__lines">
              {lineSlots.map((wc, i) => {
                const wo = pickWoForCenter(wc)
                const gd = wo ? lotGoodDefect(wo.id) : { g: 0, d: 0 }
                return (
                  <LineCard
                    key={wc?.id ?? `empty-${i}`}
                    lineName={wc?.centerName ?? `${i + 1}번 라인`}
                    lotText={wo ? woLotNo(wo) : '—'}
                    statusLabel={wo ? woStatusLabel(wo.status) : '—'}
                    woStatus={wo?.status ?? null}
                    pct={wo ? woProgressPct(wo) : 0}
                    orderQty={wo?.orderQty ?? 0}
                    goodQty={gd.g}
                    defectQty={gd.d}
                    centerCode={wc?.centerCode ?? `L${i + 1}`}
                    hasWo={Boolean(wo)}
                  />
                )
              })}
            </div>
          </section>

          <div className="fb__bottom">
            <section className="fb__panel" aria-label="작업지시">
              <div className="fb__panelHead">
                <span className="fb__panelTitle">작업지시</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--fb-muted)' }}>
                  진행 · 대기 우선
                </span>
              </div>
              <div className="fb__tableWrap">
                <table className="fb__table">
                  <thead>
                    <tr>
                      <th>지시번호</th>
                      <th>품목</th>
                      <th>LOT</th>
                      <th>상태</th>
                      <th>진행률</th>
                      <th>작업장</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayWorkOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: 'var(--fb-muted)' }}>
                          작업지시가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      displayWorkOrders.map((w) => (
                        <tr
                          key={w.id}
                          className={w.status === 'IN_PROGRESS' ? 'fb__tr--run' : undefined}
                        >
                          <td className="mono">{w.woNo}</td>
                          <td>{w.product?.productName ?? `품목#${w.id}`}</td>
                          <td className="mono">{woLotSummary(w)}</td>
                          <td>
                            <span className={woPillClass(w.status)}>{woStatusLabel(w.status)}</span>
                          </td>
                          <td className="mono">{woProgressPct(w).toFixed(1)}%</td>
                          <td>{w.workCenter?.centerName ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="fb__panel" aria-label="최근 7일 추이">
              <div className="fb__panelHead">
                <span className="fb__panelTitle">최근 7일 양품 · 불량</span>
              </div>
              <div className="fb__bars">
                {resultKpi.days.map((d) => {
                  const sum = d.good + d.defect
                  const h = Math.round((sum / resultKpi.max) * 100)
                  return (
                    <div key={d.ymd} className="fb__barCol" title={`${d.ymd} · G${d.good} D${d.defect}`}>
                      <div className="fb__barChart">
                        <div
                          className="fb__barStack"
                          style={{
                            height: `${Math.max(h, sum > 0 ? 12 : 0)}%`,
                            flexDirection: d.good > 0 && d.defect > 0 ? 'column' : undefined,
                            display: 'flex',
                          }}
                        >
                          {sum > 0 ? (
                            d.good > 0 && d.defect > 0 ? (
                              <>
                                <div className="fb__barG" style={{ flex: d.good }} />
                                <div className="fb__barD" style={{ flex: d.defect }} />
                              </>
                            ) : d.good > 0 ? (
                              <div className="fb__barG" style={{ flex: 1, width: '100%' }} />
                            ) : (
                              <div className="fb__barD" style={{ flex: 1, width: '100%' }} />
                            )
                          ) : null}
                        </div>
                      </div>
                      <div className="fb__barTick">{d.ymd.slice(5)}</div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>

        <aside className="fb__aside" aria-label="실시간 로그">
          <div className="fb__logCard">
            <div className="fb__logHead">
              <h3>실시간 시스템 로그</h3>
              <span className="fb__logLive" title="Live" />
            </div>
            <div className="fb__logBody">
              {activityLogs.length === 0 ? (
                <div className="fb__logRow">로그 없음</div>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.key}
                    className={`fb__logRow${log.level === 'ERROR' ? ' fb__logRow--err' : ''}`}
                  >
                    <span className="fb__logTime">[{log.time}]</span>
                    <span
                      className={
                        log.level === 'SYSTEM'
                          ? 'fb__logLvl--sys'
                          : log.level === 'WARN'
                            ? 'fb__logLvl--warn'
                            : 'fb__logLvl--err'
                      }
                    >
                      [{log.level === 'WARN' ? '경고' : log.level}]
                    </span>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="fb__footer">
        <div className="fb__footerLeft mono">
          <span>V{pkg.version}-STABLE</span>
          <span>│</span>
          <span>SYS HEALTH {health?.ok === false ? '0' : '100'}%</span>
          <span>│</span>
          <span>NODE_01_ACTIVE</span>
        </div>
        <div className="fb__footerRight">
          <span>LATENCY</span>
          <strong>{pingMs == null ? '—' : `${pingMs}ms`}</strong>
          <span>│</span>
          <span>AUTO {secToRefresh}s</span>
          <Link to="/" className="fb__footerLink">
            관리
          </Link>
          <button type="button" className="fb__footerLink" onClick={() => void load()}>
            새로고침
          </button>
        </div>
      </footer>
    </div>
  )
}
