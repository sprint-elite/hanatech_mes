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
type CalendarItem = { id: string; kind: 'PLAN' | 'WO'; label: string; status: string }
type KanbanColId = 'READY' | 'IN_PROGRESS' | 'HOLD'

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

const woStatusTone = (s: string) => {
  if (s === 'DONE') return 'ok'
  if (s === 'IN_PROGRESS') return 'progress'
  if (s === 'HOLD') return 'hold'
  return 'wait'
}

const lotStatusLabel = (s: string) => {
  if (s === 'CREATED') return '생성'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'OUTSOURCING') return '외주'
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

function IconQueue() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  )
}

export function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [lots, setLots] = useState<Lot[]>([])
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

  const load = useCallback(async () => {
    try {
      const [healthRes, planRes, woRes, lotsRes, prRes] = await Promise.all([
        fetch('/api/health'),
        apiJson<{ ok: boolean; items: Plan[] }>('/api/production-plans'),
        apiJson<{ ok: boolean; items: WorkOrder[] }>('/api/work-orders'),
        apiJson<{ ok: boolean; items: Lot[] }>('/api/lots'),
        apiJson<{ ok: boolean; items: ProcessResult[] }>('/api/process-results'),
      ])
      if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`)
      setHealth((await healthRes.json()) as Health)
      setPlans(planRes.items)
      setWorkOrders(woRes.items)
      setLots(lotsRes.items)
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

  const topWorkOrders = useMemo(() => {
    return [...workOrders].sort((a, b) => b.id - a.id).slice(0, 10)
  }, [workOrders])

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

  const woIsLate = (w: WorkOrder) => {
    if (w.status === 'DONE') return false
    const p = w.planId != null ? planById.get(w.planId) : w.plan
    if (!p) return false
    const end = parseDateSafe(p.endDate)
    if (!end) return false
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    return endDay < startOfToday()
  }

  const woProgressPct = (w: WorkOrder) => {
    const ls = lotByWoId.get(w.id) ?? []
    if (ls.length > 0) {
      const total = ls.reduce((acc, l) => acc + Math.max(0, l.lotQty), 0)
      const done = ls.reduce((acc, l) => acc + Math.max(0, l.goodQty + l.defectQty), 0)
      if (total > 0) {
        const pct = (done / total) * 100
        return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
      }
    }
    const o = Math.max(1, w.orderQty)
    const pct = (w.completedQty / o) * 100
    return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
  }

  const woLotSummary = (w: WorkOrder) => {
    const ls = lotByWoId.get(w.id)
    if (!ls || ls.length === 0) return null
    const first = ls[0]
    return `${first.lotNo} · ${lotStatusLabel(first.status)}`
  }

  const woWorkersShort = (w: WorkOrder) => {
    const list = w.assignedWorkers ?? []
    if (list.length === 0) return null
    if (list.length === 1) return list[0].worker.workerName
    return `${list[0].worker.workerName} 외 ${list.length - 1}명`
  }

  const woWorkers = (w: WorkOrder) => {
    const list = w.assignedWorkers ?? []
    if (list.length === 0) return null
    return list.map((a) => a.worker.workerName).join(', ')
  }

  const kpiToneDone = woDoneRatePct >= 75 ? 'ok' : woDoneRatePct >= 40 ? 'warn' : 'danger'
  const defectPct = defectMetrics.rate * 100
  const kpiToneDefect = defectPct <= 2 ? 'ok' : defectPct <= 5 ? 'warn' : 'danger'
  const riskCount = delayRisk.totalRisk
  const kpiToneRisk = riskCount === 0 ? 'ok' : riskCount <= 3 ? 'warn' : 'danger'
  const todayYmd = toYmd(new Date())

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
        <Link to="/work-orders" className={`mesDashKpiCard mesDashKpiCard--${kpiToneDone}`}>
          <div className="mesDashKpiTop">
            <div className="mesDashKpiIcon"><IconCheck /></div>
            <div className="mesDashKpiMeta">
              <p className="mesDashKpiLabel">지시 완료율</p>
              <p className="mesDashKpiValue">{woKpi.total === 0 ? '—' : `${woDoneRatePct}%`}</p>
              <p className="mesDashKpiSub">완료 {woKpi.done}건 · 전체 {woKpi.total}건</p>
            </div>
          </div>
          <div className="mesDashKpiFoot">
            <div className="mesDashKpiBar">
              <div className={`mesDashKpiBarFill mesDashKpiBarFill--${kpiToneDone}`} style={{ width: `${woDoneRatePct}%` }} />
            </div>
          </div>
        </Link>

        <Link to="/process-result" className={`mesDashKpiCard mesDashKpiCard--${kpiToneDefect}`}>
          <div className="mesDashKpiTop">
            <div className="mesDashKpiIcon"><IconAlert /></div>
            <div className="mesDashKpiMeta">
              <p className="mesDashKpiLabel">불량률 (최근 7일)</p>
              <p className="mesDashKpiValue">{defectMetrics.sumLast7 === 0 ? '—' : `${defectPct.toFixed(1)}%`}</p>
              <p className="mesDashKpiSub">
                양품 {defectMetrics.last7Good.toLocaleString()} · 불량 {defectMetrics.last7Defect.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mesDashKpiFoot">
            <p className={`mesDashKpiDelta ${defectMetrics.sumLast7 === 0 ? 'mesDashKpiDelta--flat' : defectMetrics.deltaPp == null ? 'mesDashKpiDelta--flat' : defectMetrics.deltaPp >= 0 ? 'mesDashKpiDelta--up' : 'mesDashKpiDelta--down'}`}>
              {defectMetrics.sumLast7 === 0
                ? '최근 7일 실적 없음'
                : defectMetrics.deltaPp == null
                  ? '전주 대비 비교 데이터 없음'
                  : defectMetrics.deltaPp >= 0
                    ? `▲ ${defectMetrics.deltaPp.toFixed(2)}%p 전주 대비 증가`
                    : `▼ ${Math.abs(defectMetrics.deltaPp).toFixed(2)}%p 전주 대비 감소`}
            </p>
          </div>
        </Link>

        <Link to="/production-plans" className={`mesDashKpiCard mesDashKpiCard--${kpiToneRisk}`}>
          <div className="mesDashKpiTop">
            <div className="mesDashKpiIcon"><IconClock /></div>
            <div className="mesDashKpiMeta">
              <p className="mesDashKpiLabel">지연 · 주의</p>
              <p className="mesDashKpiValue">{riskCount}건</p>
              <p className="mesDashKpiSub">계획 {delayRisk.latePlans} · 지시 {delayRisk.lateWos}</p>
            </div>
          </div>
          <div className="mesDashKpiFoot">
            <p className={`mesDashKpiDelta ${riskCount === 0 ? 'mesDashKpiDelta--flat' : 'mesDashKpiDelta--up'}`}>
              {riskCount === 0 ? '지연 항목 없음' : '종료일 경과 항목 확인 필요'}
            </p>
          </div>
        </Link>

        <Link to="/integrated-ops" className="mesDashKpiCard mesDashKpiCard--info">
          <div className="mesDashKpiTop">
            <div className="mesDashKpiIcon"><IconQueue /></div>
            <div className="mesDashKpiMeta">
              <p className="mesDashKpiLabel">작업지시 현황</p>
              <p className="mesDashKpiValue">{woKpi.total}건</p>
              <p className="mesDashKpiSub">대기 {woKpi.ready} · 진행 {woKpi.inProgress} · 보류 {woKpi.hold}</p>
            </div>
          </div>
          <div className="mesDashKpiFoot">
            <div className="mesDashKpiBar">
              <div className="mesDashKpiBarFill mesDashKpiBarFill--info" style={{ width: `${woKpi.total ? (woKpi.inProgress / woKpi.total) * 100 : 0}%` }} />
            </div>
            <p className="mesDashKpiBarHint">진행 {woKpi.inProgress}건 / 전체 {woKpi.total}건</p>
          </div>
        </Link>
      </section>

      <section className="mesDashKanban" aria-label="작업 일정 보드">
        <div className="mesDashKanbanHead">
          <div>
            <h2 className="mesDashKanbanTitle">작업 일정</h2>
            <p className="mesDashKanbanSub">
              카드를 드래그하여 대기 · 진행 · 보류 상태 변경
              {orphanWorkOrders.length > 0 && ` · 계획 미연결 ${orphanWorkOrders.length}건`}
            </p>
          </div>
          <Link to="/work-orders" className="mesDashPanelAction">작업지시 관리 →</Link>
        </div>
        {kanbanErr ? <p className="mesDashKanbanErr">{kanbanErr}</p> : null}
        <div className="mesDashKanbanBoard">
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
                  <p className="mesDashKanbanEmpty">없음 · 여기로 드롭</p>
                ) : (
                  col.items.map((w) => {
                    const period = woPlanPeriod(w)
                    const late = woIsLate(w)
                    const workersShort = woWorkersShort(w)
                    const isDragging = dragWoId === w.id
                    const isMoving = woMovingId === w.id
                    return (
                      <div
                        key={w.id}
                        className={`mesDashKanbanCard${isDragging ? ' mesDashKanbanCard--dragging' : ''}${isMoving ? ' mesDashKanbanCard--moving' : ''}`}
                        draggable={!isMoving}
                        onDragStart={onKanbanDragStart(w.id)}
                        onDragEnd={onKanbanDragEnd}
                      >
                        <div className="mesDashKanbanCardTop">
                          <Link to="/work-orders" className="mesDashKanbanCardNo" draggable={false}>
                            {w.woNo}
                          </Link>
                          {(workersShort || w.workCenter) && (
                            <div className="mesDashKanbanCardAssign">
                              {workersShort && <span>{workersShort}</span>}
                              {workersShort && w.workCenter && <span className="mesDashKanbanCardSep">·</span>}
                              {w.workCenter && <span className="mesDashKanbanCardLine">{w.workCenter.centerCode}</span>}
                            </div>
                          )}
                        </div>
                        <p className="mesDashKanbanCardProduct">{w.product?.productName ?? `품목#${w.id}`}</p>
                        {period && (
                          <p className="mesDashKanbanCardPeriod">
                            <span>{period}</span>
                            {late && <span className="mesDashKanbanLateBadge">지연</span>}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ))}

          <div className="mesDashKanbanCol mesDashKanbanCol--cal" aria-label="월별 일정">
            <div className="mesDashKanbanColHead">
              <span className="mesDashKanbanColLabel">일정</span>
            </div>
            <div className="mesDashKanbanColBody mesDashKanbanColBody--cal">
              <div className="mesDashCalNav">
                <button type="button" className="mesDashCalBtn" aria-label="이전 달" onClick={() => setCalPage(({ y, m }) => { const d = new Date(y, m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() } })}>‹</button>
                <input
                  type="month"
                  className="mesDashCalMonthInput"
                  aria-label="연도·월 선택"
                  value={`${calPage.y}-${String(calPage.m + 1).padStart(2, '0')}`}
                  onChange={(ev) => {
                    const v = ev.target.value
                    if (!v) return
                    const [ys, ms] = v.split('-').map(Number)
                    if (!Number.isFinite(ys) || !Number.isFinite(ms)) return
                    setCalPage({ y: ys, m: ms - 1 })
                  }}
                />
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
                      ].filter(Boolean).join(' ')}
                      onClick={() => setSelectedYmd(cell.ymd)}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>
              <div className="mesDashDayDetail mesDashDayDetail--compact">
                <div className="mesDashDayDetailHead">
                  <span className="mesDashDayDetailDate">{selectedYmd}</span>
                  <span className="mesDashDayDetailCount">{selectedItems.length}건</span>
                </div>
                {selectedItems.length === 0 ? (
                  <p className="mesDashKanbanEmpty">일정 없음</p>
                ) : (
                  <div className="mesDashDayItems">
                    {selectedItems.slice(0, 4).map((it) => (
                      <div key={it.id} className={`mesDashDayItem mesDashDayItem--${it.kind === 'PLAN' ? 'plan' : 'wo'}`}>
                        <span className="mesDashDayItemKind">{it.kind}</span>
                        <span>{it.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mesDashLayout mesDashLayout--pair">
          <section className="mesDashPanel" aria-label="최근 7일 생산 실적">
            <div className="mesDashPanelHead">
              <div>
                <h2 className="mesDashPanelTitle">생산 실적 추이</h2>
                <p className="mesDashPanelSub">최근 7일 양품 · 불량</p>
              </div>
            </div>
            <div className="mesDashPanelBody">
              <div className="mesDashChartStats">
                <div className="mesDashChartStat mesDashChartStat--good">
                  <span className="mesDashChartStatVal">{defectMetrics.last7Good.toLocaleString()}</span>
                  <span className="mesDashChartStatLabel">양품 합계</span>
                </div>
                <div className="mesDashChartStat mesDashChartStat--defect">
                  <span className="mesDashChartStatVal">{defectMetrics.last7Defect.toLocaleString()}</span>
                  <span className="mesDashChartStatLabel">불량 합계</span>
                </div>
                <div className="mesDashChartStat">
                  <span className="mesDashChartStatVal">{defectMetrics.sumLast7.toLocaleString()}</span>
                  <span className="mesDashChartStatLabel">총 생산량</span>
                </div>
              </div>
              <div className="mesDashChartArea">
                {resultKpi.days.map((d) => {
                  const sum = d.good + d.defect
                  const h = sum > 0 ? Math.max(8, Math.round((sum / resultKpi.max) * 100)) : 0
                  const goodFlex = sum > 0 ? d.good : 0
                  const defectFlex = sum > 0 ? d.defect : 0
                  const isToday = d.ymd === todayYmd
                  return (
                    <div key={d.ymd} className={`mesDashChartCol${isToday ? ' mesDashChartCol--today' : ''}`} title={`${d.ymd} · 양품 ${d.good} · 불량 ${d.defect}`}>
                      <span className={`mesDashChartVal${sum > 0 ? ' mesDashChartVal--active' : ''}`}>{sum > 0 ? sum : '—'}</span>
                      <div className="mesDashChartBarWrap">
                        {sum > 0 && (
                          <div className="mesDashChartBarStack" style={{ height: `${h}%` }}>
                            {d.good > 0 && <div className="mesDashChartBarGood" style={{ flex: goodFlex }} />}
                            {d.defect > 0 && <div className="mesDashChartBarDefect" style={{ flex: defectFlex }} />}
                          </div>
                        )}
                      </div>
                      <span className="mesDashChartDate">{d.ymd.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mesDashChartLegend">
                <span className="mesDashChartLegendItem"><span className="mesDashChartLegendDot mesDashChartLegendDot--good" />양품</span>
                <span className="mesDashChartLegendItem"><span className="mesDashChartLegendDot mesDashChartLegendDot--defect" />불량</span>
              </div>
            </div>
          </section>

          <section className="mesDashPanel" aria-label="작업지시 목록">
            <div className="mesDashPanelHead">
              <div>
                <h2 className="mesDashPanelTitle">작업지시</h2>
                <p className="mesDashPanelSub">최근 {topWorkOrders.length}건</p>
              </div>
              <Link to="/work-orders" className="mesDashPanelAction">전체 보기 →</Link>
            </div>
            <div className="mesDashPanelBody mesDashPanelBody--flush">
              {topWorkOrders.length === 0 ? (
                <p className="mesDashEmpty">등록된 작업지시가 없습니다.</p>
              ) : (
                <div className="mesDashWoList">
                  {topWorkOrders.map((w) => {
                    const pct = woProgressPct(w)
                    const lot = woLotSummary(w)
                    const workers = woWorkers(w)
                    const tone = woStatusTone(w.status)
                    return (
                      <Link key={w.id} to="/work-orders" className="mesDashWoRow">
                        <div className="mesDashWoRowMain">
                          <div className="mesDashWoRowTop">
                            <span className="mesDashWoNo">{w.woNo}</span>
                            <span className={`mesDashPill mesDashPill--${tone}`}>{woStatusLabel(w.status)}</span>
                          </div>
                          <div className="mesDashWoProduct">{w.product?.productName ?? `품목#${w.id}`}</div>
                          <div className="mesDashWoMeta">
                            {lot && <span>LOT {lot}</span>}
                            {workers && <span>담당 {workers}</span>}
                            {w.workCenter && <span>{w.workCenter.centerCode}</span>}
                          </div>
                        </div>
                        <div className="mesDashWoRowRight">
                          <div className="mesDashWoProgress">
                            <div className="mesDashWoProgressPct">{pct.toFixed(1)}%</div>
                            <div className="mesDashWoProgressTrack">
                              <div className="mesDashWoProgressFill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
      </div>
    </div>
  )
}
