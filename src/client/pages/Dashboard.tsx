import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../lib/api'

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
type CalendarItem = { id: string; kind: 'PLAN' | 'WO'; label: string; status: string }
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

const lotStatusLabel = (s: string) => {
  if (s === 'CREATED') return '생성'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'OUTSOURCING') return '외주'
  return s
}

export function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [results, setResults] = useState<ProcessResult[]>([])
  const [selectedYmd, setSelectedYmd] = useState(() => toYmd(new Date()))
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  const orphanWorkOrders = useMemo(() => workOrders.filter((w) => w.planId == null), [workOrders])

  const selectedItems = useMemo(() => itemsByDate.get(selectedYmd) ?? [], [itemsByDate, selectedYmd])

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
      if (samples.length >= 5) break
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
      if (samples.length >= 5) break
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

  const [calPage, setCalPage] = useState(() => {
    const t = new Date()
    return { y: t.getFullYear(), m: t.getMonth() }
  })

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

  const topWorkOrders = useMemo(() => {
    return [...workOrders].sort((a, b) => b.id - a.id).slice(0, 10)
  }, [workOrders])

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

  const progressText = (pct: number) => `${pct.toFixed(1)}%`

  const woLotSummary = (w: WorkOrder) => {
    const ls = lotByWoId.get(w.id)
    if (!ls || ls.length === 0) return '—'
    const first = ls[0]
    return `${first.lotNo} · ${lotStatusLabel(first.status)}`
  }

  const woWorkers = (w: WorkOrder) => {
    const list = w.assignedWorkers ?? []
    if (list.length === 0) return '—'
    return list.map((a) => a.worker.workerName).join(', ')
  }

  const kpiToneDone = woDoneRatePct >= 75 ? 'ok' : woDoneRatePct >= 40 ? 'warn' : 'danger'
  const defectPct = defectMetrics.rate * 100
  const kpiToneDefect = defectPct <= 2 ? 'ok' : defectPct <= 5 ? 'warn' : 'danger'
  const riskCount = delayRisk.totalRisk
  const kpiToneRisk = riskCount === 0 ? 'ok' : riskCount <= 3 ? 'warn' : 'danger'

  return (
    <div className="mesPage">
      <header className="mesPageHead mesDashFlowHead">
        <div>
          <h1 className="mesPageTitle">대시보드</h1>
          <p className="mesPageDesc">
            지금 막혀 있는지 · 왜 그런지 · 무엇을 손대야 하는지 한 화면에서 확인합니다.
          </p>
        </div>
        <div className="mesDashFlowHeadMeta">
          {lastUpdated ? (
            <span className="muted small">
              마지막 갱신{' '}
              <time dateTime={lastUpdated.toISOString()}>{lastUpdated.toLocaleString('ko-KR')}</time>
            </span>
          ) : (
            <span className="muted small">갱신 중…</span>
          )}
          <button type="button" className="mesBtnSecondary mesBtnSm" onClick={() => void load()}>
            새로고침
          </button>
        </div>
      </header>

      <section className="mesDashFlow">
        {/* [1] KPI */}
        <div className="mesDashKpiStrip" aria-label="핵심 지표">
          <Link
            to="/work-orders"
            className={`mesDashKpiFlowCard mesDashKpiFlowCard--${kpiToneDone}`}
            title="작업지시 화면으로 이동"
          >
            <div className="mesDashKpiFlowLabel">지시 완료율</div>
            <div className="mesDashKpiFlowValue">{woKpi.total === 0 ? '—' : `${woDoneRatePct}%`}</div>
            <div className="mesDashKpiFlowHint">완료 {woKpi.done} / 전체 {woKpi.total}</div>
          </Link>
          <Link
            to="/process-result"
            className={`mesDashKpiFlowCard mesDashKpiFlowCard--${kpiToneDefect}`}
            title="공정 실적 · 불량 입력 화면으로 이동"
          >
            <div className="mesDashKpiFlowLabel">불량률 (최근 7일)</div>
            <div className="mesDashKpiFlowValue">{defectMetrics.sumLast7 === 0 ? '—' : `${defectPct.toFixed(1)}%`}</div>
            <div className="mesDashKpiFlowHint">
              {defectMetrics.deltaPp == null
                ? '전주 대비 —'
                : defectMetrics.deltaPp >= 0
                  ? `↑ ${defectMetrics.deltaPp.toFixed(2)}%p (전주 대비)`
                  : `↓ ${Math.abs(defectMetrics.deltaPp).toFixed(2)}%p (전주 대비)`}
            </div>
          </Link>
          <Link
            to="/production-plans"
            className={`mesDashKpiFlowCard mesDashKpiFlowCard--${kpiToneRisk}`}
            title="생산계획 · 종료일 경과 건 확인"
          >
            <div className="mesDashKpiFlowLabel">지연·주의</div>
            <div className="mesDashKpiFlowValue">{riskCount}건</div>
            <div className="mesDashKpiFlowHint">종료일 경과 계획 {delayRisk.latePlans} · 지시 {delayRisk.lateWos}</div>
          </Link>
          <Link to="/integrated-ops" className="mesDashKpiFlowCard mesDashKpiFlowCard--info" title="통합 생산 운영">
            <div className="mesDashKpiFlowLabel">대기 지시</div>
            <div className="mesDashKpiFlowValue">{woKpi.ready}건</div>
            <div className="mesDashKpiFlowHint">진행 {woKpi.inProgress} · 보류 {woKpi.hold}</div>
          </Link>
        </div>

        {/* [2] 현장 상황 + 추이 */}
        <div className="mesDashMidRow">
          <div className="mesDashSituationCard" aria-label="작업 상태 현황">
            <div className="mesDashSituationTitle">작업 상태</div>
            <div className="mesDashSituationGrid">
              <div className="mesDashSituationCell mesDashSituationCell--ok">
                <span className="mesDashSituationCount">{woKpi.done}</span>
                <span className="mesDashSituationLabel">완료</span>
              </div>
              <div className="mesDashSituationCell mesDashSituationCell--progress">
                <span className="mesDashSituationCount">{woKpi.inProgress}</span>
                <span className="mesDashSituationLabel">진행</span>
              </div>
              <div className="mesDashSituationCell mesDashSituationCell--wait">
                <span className="mesDashSituationCount">{woKpi.ready}</span>
                <span className="mesDashSituationLabel">대기</span>
              </div>
              <div className="mesDashSituationCell mesDashSituationCell--hold">
                <span className="mesDashSituationCount">{woKpi.hold}</span>
                <span className="mesDashSituationLabel">보류</span>
              </div>
            </div>
            <div className="mesDashSituationAlerts">
              <div className="mesDashSituationAlertsTitle">지연·주의 요약</div>
              {delayRisk.samples.length === 0 ? (
                <p className="muted small mesDashSituationAlertsEmpty">종료일이 지난 미완료 계획/지시가 없습니다.</p>
              ) : (
                <ul className="mesDashSituationAlertList">
                  {delayRisk.samples.map((s) => (
                    <li key={s.key} className={`mesDashSituationAlertItem mesDashSituationAlertItem--${s.tone}`}>
                      {s.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mesDashTrendCard" aria-label="최근 7일 생산 실적">
            <div className="mesDashTrendHead">
              <div className="mesDashTrendTitle mesDashTrendTitle--tight">최근 7일 양품·불량</div>
              <div className="mesDashTrendLegend" aria-label="범례">
                <span className="mesDashTrendLegendItem">
                  <span className="mesDashTrendLegendDot mesDashTrendLegendDot--volume" aria-hidden />
                  <span>합계 높이</span>
                </span>
                <span className="mesDashTrendLegendItem">
                  <span className="mesDashTrendLegendDot mesDashTrendLegendDot--good" aria-hidden />
                  <span>양품</span>
                </span>
                <span className="mesDashTrendLegendItem">
                  <span className="mesDashTrendLegendDot mesDashTrendLegendDot--defect" aria-hidden />
                  <span>불량</span>
                </span>
              </div>
            </div>
            <div className="mesDashBars mesDashBarsCompact" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {resultKpi.days.map((d) => {
                const sum = d.good + d.defect
                const h = Math.round((sum / resultKpi.max) * 100)
                return (
                  <div
                    key={d.ymd}
                    className={`mesDashBarWrap${sum > 0 ? ' mesDashBarWrapLabeled' : ''}`}
                    title={`${d.ymd} · 양품 ${d.good} · 불량 ${d.defect}`}
                  >
                    {sum > 0 ? (
                      <div className="mesDashBarDataLabel mono">
                        <span className="mesDashBarDataLabelSum">{sum}</span>
                        <span className="mesDashBarDataLabelSub">
                          G{d.good}·D{d.defect}
                        </span>
                      </div>
                    ) : null}
                    <div className="mesDashBarChart">
                      <div
                        className="mesDashBarStack"
                        style={{
                          height: `${Math.max(h, sum > 0 ? 6 : 0)}%`,
                          minHeight: sum > 0 ? 4 : 0,
                        }}
                      >
                        {sum > 0 ? (
                          d.good > 0 && d.defect > 0 ? (
                            <>
                              <div className="mesDashBarSeg mesDashBarSeg--good" style={{ flex: d.good }} />
                              <div className="mesDashBarSeg mesDashBarSeg--defect" style={{ flex: d.defect }} />
                            </>
                          ) : d.good > 0 ? (
                            <div className="mesDashBarSeg mesDashBarSeg--good" style={{ flex: 1 }} />
                          ) : (
                            <div className="mesDashBarSeg mesDashBarSeg--defect" style={{ flex: 1 }} />
                          )
                        ) : null}
                      </div>
                    </div>
                    <div className="mesDashBarTick mono">{d.ymd.slice(5)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* [3] 작업지시 + 보조 일정 */}
        <div className="mesDashBottomRow">
          <div className="mesDashWoTableCard">
            <div className="mesDashWoTableHead">
              <div className="mesDashWoTableTitle">작업지시 (최근 10건)</div>
              <Link to="/work-orders" className="mesBtnSm mesBtnSecondary">
                전체 보기
              </Link>
            </div>
            <div className="mesTableWrap mesTableScroll">
              <table className="mesTable mesDashWoTable">
                <thead>
                  <tr>
                    <th>지시번호</th>
                    <th>품목</th>
                    <th>LOT</th>
                    <th>상태</th>
                    <th>진행률</th>
                    <th>담당</th>
                    <th>작업장</th>
                  </tr>
                </thead>
                <tbody>
                  {topWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="muted">
                        작업지시가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    topWorkOrders.map((w) => (
                      <tr key={w.id}>
                        <td className="mono">
                          <Link to="/work-orders">{w.woNo}</Link>
                        </td>
                        <td>{w.product?.productName ?? `품목#${w.id}`}</td>
                        <td className="mono mesTdEllipsis" title={woLotSummary(w)}>
                          {woLotSummary(w)}
                        </td>
                        <td>
                          <span
                            className={`mesDashWoPill mesDashWoPill--${
                              w.status === 'DONE' ? 'ok' : w.status === 'IN_PROGRESS' ? 'progress' : w.status === 'HOLD' ? 'hold' : 'wait'
                            }`}
                          >
                            {woStatusLabel(w.status)}
                          </span>
                        </td>
                        <td>{progressText(woProgressPct(w))}</td>
                        <td className="mesTdEllipsis" title={woWorkers(w)}>
                          {woWorkers(w)}
                        </td>
                        <td className="muted small mesTdEllipsis">
                          {w.workCenter ? `${w.workCenter.centerCode}` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="mesDashMiniSchedule" aria-label="월 단위 일정 보조">
            <div className="mesDashMiniScheduleTitle">월별 일정 (보조)</div>
            <div className="mesDashCalToolbar">
              <button
                type="button"
                className="mesDashCalToolBtn"
                aria-label="이전 달"
                onClick={() =>
                  setCalPage(({ y, m }) => {
                    const d = new Date(y, m - 1, 1)
                    return { y: d.getFullYear(), m: d.getMonth() }
                  })
                }
              >
                ‹
              </button>
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
              <button
                type="button"
                className="mesDashCalToolBtn"
                aria-label="다음 달"
                onClick={() =>
                  setCalPage(({ y, m }) => {
                    const d = new Date(y, m + 1, 1)
                    return { y: d.getFullYear(), m: d.getMonth() }
                  })
                }
              >
                ›
              </button>
              <button
                type="button"
                className="mesDashCalToolBtn mesDashCalToolBtn--today"
                onClick={() => {
                  const t = new Date()
                  setCalPage({ y: t.getFullYear(), m: t.getMonth() })
                  setSelectedYmd(toYmd(t))
                }}
              >
                오늘
              </button>
            </div>
            <div className="mesDashCalDowRow" aria-hidden>
              {dayNames.map((dn) => (
                <span key={dn} className="mesDashCalDowCell">
                  {dn}
                </span>
              ))}
            </div>
            <div className="mesDashMonthGrid">
              {calendarMonthCells.map((cell, idx) => {
                if (cell.kind === 'pad') return <div key={`pad-${idx}`} className="mesDashMonthPad" />
                const items = itemsByDate.get(cell.ymd) ?? []
                const isSelected = cell.ymd === selectedYmd
                const isToday = cell.ymd === toYmd(new Date())
                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    className={`mesDashMonthCell${isSelected ? ' isSelected' : ''}${isToday ? ' isToday' : ''}`}
                    onClick={() => setSelectedYmd(cell.ymd)}
                  >
                    <span className="mesDashMonthDate mono">{cell.day}</span>
                    {items.length > 0 ? <span className="mesDashMonthDot" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>
            <div className="mesDashMiniDay">
              <div className="mesDashMiniDayHead">
                <span className="mono mesDashMiniDayYmd">{selectedYmd}</span>
                <span className="muted small">{selectedItems.length}건</span>
              </div>
              {selectedItems.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>
                  일정 없음
                </p>
              ) : (
                <div className="mesDashMiniDayList">
                  {selectedItems.slice(0, 4).map((it) => (
                    <div key={it.id} className={`mesDashMiniDayRow ${it.kind === 'PLAN' ? 'isPlan' : 'isWo'}`}>
                      <span className="mesDashMiniDayKind mono">{it.kind}</span>
                      <span className="mesDashMiniDayText">{it.label}</span>
                    </div>
                  ))}
                  {selectedItems.length > 4 ? (
                    <div className="muted small">외 {selectedItems.length - 4}건…</div>
                  ) : null}
                </div>
              )}
            </div>
            {orphanWorkOrders.length > 0 ? (
              <div className="mesDashOrphanMini">
                <div className="mesDashOrphanMiniTitle">계획 미연결 지시</div>
                <ul className="mesDashOrphanMiniList">
                  {orphanWorkOrders.slice(0, 3).map((wo) => (
                    <li key={wo.id} className="mono small">
                      {wo.woNo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="mesCard mesCardNarrow" style={{ marginTop: 12 }}>
        <div className="mesCardTitle">시스템</div>
        {err ? (
          <div className="error">API: {err}</div>
        ) : health ? (
          <p className="muted" style={{ margin: 0 }}>
            서버 정상 · 마지막 확인 {new Date(health.time).toLocaleString('ko-KR')}
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            연결 확인 중…
          </p>
        )}
      </section>
    </div>
  )
}
