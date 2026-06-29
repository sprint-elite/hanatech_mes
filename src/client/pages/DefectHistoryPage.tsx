import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../defect-history-page.css'

type Row = {
  id: number
  productionLotId: number
  processId: number
  defectTypeId: number
  qty: number
  workerId: number | null
  workCenterId: number | null
  detectedAt: string | null
  processResultId: number | null
  remark: string | null
  createdAt: string
  lot?: {
    lotNo: string
    productId: number
    createdAt?: string
    product?: { id: number; productCode: string; productName: string }
    materialUsages?: {
      id: number
      materialLotId: number | null
      usedQty: string | number
      materialLot?: {
        id: number
        lotNo: string
        receivedDate: string
        product?: { productName: string }
      } | null
    }[]
  }
  defectType?: { defectCode: string; defectName: string }
  worker?: { workerCode: string; workerName: string } | null
  workCenter?: { centerCode: string; centerName: string } | null
  processResult?: {
    id: number
    inputQty: number
    goodQty: number
    defectQty: number
    createdAt: string
  } | null
}

type Tab = 'list' | 'stats'

type FilterState = {
  q: string
  productId: string
  productionLotId: string
  materialLotId: string
  defectTypeId: string
  workerId: string
}

const PAGE_SIZE = 20

const emptyFilters = (): FilterState => ({
  q: '',
  productId: '',
  productionLotId: '',
  materialLotId: '',
  defectTypeId: '',
  workerId: '',
})

function materialLotIds(r: Row): number[] {
  const ids: number[] = []
  for (const u of r.lot?.materialUsages ?? []) {
    if (u.materialLotId != null) ids.push(u.materialLotId)
  }
  return ids
}

type MatUsageItem = {
  lotNo: string
  usedQty: number
  productName?: string
}

function parseMaterialUsages(r: Row): MatUsageItem[] {
  return (r.lot?.materialUsages ?? [])
    .filter((u) => u.materialLot?.lotNo)
    .map((u) => ({
      lotNo: u.materialLot!.lotNo,
      usedQty: Number(u.usedQty) || 0,
      productName: u.materialLot?.product?.productName,
    }))
}

function materialUsagesTitle(usages: MatUsageItem[]) {
  return usages
    .map((u, i) => {
      const mat = u.productName ? ` · ${u.productName}` : ''
      return `${i + 1}순위 ${u.lotNo} · ${u.usedQty.toLocaleString()}${mat}`
    })
    .join('\n')
}

function MaterialLotCell({ usages }: { usages: MatUsageItem[] }) {
  if (usages.length === 0) return <span className="mesDhRemarkCell">—</span>

  const title = `FIFO 투입\n${materialUsagesTitle(usages)}`
  const visible = usages.length <= 2 ? usages : usages.slice(0, 2)
  const hidden = usages.length - visible.length

  return (
    <div className="mesDhMatLotCell" title={title}>
      {visible.map((u, i) => (
        <span key={`${u.lotNo}-${i}`} className="mesDhMatLotChip">
          <span className="mesDhMatLotOrd" aria-hidden>
            {i + 1}
          </span>
          <span className="mesDhMatLotNo mono">{u.lotNo}</span>
          <span className="mesDhMatLotQty">{u.usedQty.toLocaleString()}</span>
        </span>
      ))}
      {hidden > 0 ? <span className="mesDhMatLotMore">+{hidden}</span> : null}
    </div>
  )
}

function defectRatePct(defect: number, input: number) {
  if (input <= 0) return 0
  return Math.round((defect / input) * 1000) / 10
}

function fmtDateKst(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).replace('T', ' ').slice(0, 19)
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const p = (type: Intl.DateTimeFormatPartTypes) => parts.find((x) => x.type === type)?.value ?? ''
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`
}

function toYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rowProductId(r: Row) {
  return r.lot?.product?.id ?? r.lot?.productId ?? null
}

function rowProductName(r: Row) {
  return r.lot?.product?.productName ?? (rowProductId(r) ? `품목#${rowProductId(r)}` : '—')
}

function rowProductCode(r: Row) {
  return r.lot?.product?.productCode ?? ''
}

function totalPages(n: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, n) / pageSize))
}

type BarRow = { key: string; label: string; qty: number; count: number }

function aggregateBy(
  rows: Row[],
  keyFn: (r: Row) => string | null,
  labelFn: (r: Row, key: string) => string,
) {
  const map = new Map<string, { label: string; qty: number; count: number }>()
  for (const r of rows) {
    const key = keyFn(r)
    if (!key) continue
    const cur = map.get(key) ?? { label: labelFn(r, key), qty: 0, count: 0 }
    cur.qty += r.qty
    cur.count += 1
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.qty - a.qty)
}

function HBarChart({ rows, maxBars = 8 }: { rows: BarRow[]; maxBars?: number }) {
  const slice = rows.slice(0, maxBars)
  const max = Math.max(1, ...slice.map((r) => r.qty))
  if (slice.length === 0) {
    return <div className="mesDhEmptyChart">표시할 데이터가 없습니다.</div>
  }
  return (
    <div className="mesDhHBarChart" role="img" aria-label="막대 차트">
      {slice.map((r) => {
        const pct = Math.round((r.qty / max) * 100)
        return (
          <div key={r.key} className="mesDhHBarRow" title={`${r.label} · ${r.qty}개 · ${r.count}건`}>
            <span className="mesDhHBarLabel">{r.label}</span>
            <div className="mesDhHBarTrack">
              <div className="mesDhHBarFill" style={{ width: `${Math.max(pct, r.qty > 0 ? 4 : 0)}%` }} />
            </div>
            <span className="mesDhHBarVal mono">{r.qty.toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}

function DailyTrendChart({ rows, days = 14 }: { rows: Row[]; days?: number }) {
  const chart = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayList: { ymd: string; qty: number; count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      dayList.push({ ymd: toYmd(d), qty: 0, count: 0 })
    }
    const byYmd = new Map(dayList.map((d) => [d.ymd, d]))
    for (const r of rows) {
      const raw = r.detectedAt ?? r.createdAt
      if (!raw) continue
      const ymd = String(raw).slice(0, 10)
      const slot = byYmd.get(ymd)
      if (slot) {
        slot.qty += r.qty
        slot.count += 1
      }
    }
    const max = Math.max(1, ...dayList.map((d) => d.qty))
    return { dayList, max }
  }, [rows, days])

  return (
    <div className="mesDhTrendBars" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
      {chart.dayList.map((d) => {
        const h = Math.round((d.qty / chart.max) * 100)
        return (
          <div key={d.ymd} className="mesDhTrendBarWrap" title={`${d.ymd} · ${d.qty}개 · ${d.count}건`}>
            <span className="mesDhTrendBarLabel">{d.qty > 0 ? d.qty : ''}</span>
            <div className="mesDhTrendBarTrack">
              {d.qty > 0 ? (
                <div className="mesDhTrendBarFill" style={{ height: `${Math.max(h, 6)}%` }} />
              ) : null}
            </div>
            <span className="mesDhTrendBarTick">{d.ymd.slice(5)}</span>
          </div>
        )
      })}
    </div>
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

function applyRowFilters(rows: Row[], filters: FilterState) {
  const q = filters.q.trim().toLowerCase()
  return rows.filter((r) => {
    if (filters.productId && String(rowProductId(r) ?? '') !== filters.productId) return false
    if (filters.productionLotId && String(r.productionLotId) !== filters.productionLotId) return false
    if (filters.materialLotId && !materialLotIds(r).includes(Number(filters.materialLotId))) return false
    if (filters.defectTypeId && String(r.defectTypeId) !== filters.defectTypeId) return false
    if (filters.workerId) {
      if (filters.workerId === '__none__') {
        if (r.workerId != null) return false
      } else if (String(r.workerId ?? '') !== filters.workerId) {
        return false
      }
    }
    if (q) {
      const hay = [
        rowProductName(r),
        rowProductCode(r),
        r.lot?.lotNo ?? '',
        r.defectType?.defectName ?? '',
        r.defectType?.defectCode ?? '',
        r.worker?.workerName ?? '',
        r.workCenter?.centerName ?? '',
        r.remark ?? '',
        ...parseMaterialUsages(r).map((u) => u.lotNo),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function DefectHistoryPage() {
  const [tab, setTab] = useState<Tab>('list')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters)
  const [filters, setFilters] = useState<FilterState>(emptyFilters)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/defect-histories')
      setRows(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const productOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rows) {
      const id = rowProductId(r)
      if (id == null) continue
      map.set(id, rowProductName(r))
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'))
  }, [rows])

  const productionLotOptions = useMemo(() => {
    const map = new Map<number, { lotNo: string; sortKey: string }>()
    for (const r of rows) {
      if (map.has(r.productionLotId)) continue
      map.set(r.productionLotId, {
        lotNo: r.lot?.lotNo ?? String(r.productionLotId),
        sortKey: r.lot?.createdAt ?? String(r.productionLotId).padStart(12, '0'),
      })
    }
    return [...map.entries()].sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey) || a[0] - b[0])
  }, [rows])

  const materialLotOptions = useMemo(() => {
    const map = new Map<number, { lotNo: string; label: string; sortKey: string }>()
    for (const r of rows) {
      for (const u of r.lot?.materialUsages ?? []) {
        if (u.materialLotId == null || !u.materialLot) continue
        if (map.has(u.materialLotId)) continue
        const mat = u.materialLot
        const pname = mat.product?.productName
        map.set(u.materialLotId, {
          lotNo: mat.lotNo,
          label: pname ? `${mat.lotNo} · ${pname}` : mat.lotNo,
          sortKey: `${mat.receivedDate}#${String(u.materialLotId).padStart(8, '0')}`,
        })
      }
    }
    return [...map.entries()].sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
  }, [rows])

  const defectTypeOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rows) {
      if (!r.defectType) continue
      map.set(r.defectTypeId, r.defectType.defectName)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'))
  }, [rows])

  const workerOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rows) {
      if (r.workerId == null || !r.worker) continue
      map.set(r.workerId, r.worker.workerName)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'))
  }, [rows])

  const filtered = useMemo(() => {
    return applyRowFilters(rows, filters).sort((a, b) => {
      const ta = a.detectedAt ?? a.createdAt
      const tb = b.detectedAt ?? b.createdAt
      return tb.localeCompare(ta)
    })
  }, [rows, filters])

  const pages = totalPages(filtered.length, pageSize)
  const safePage = Math.min(Math.max(1, page), pages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  useEffect(() => {
    setPage(1)
  }, [filters])

  const stats = useMemo(() => {
    const totalQty = filtered.reduce((s, r) => s + r.qty, 0)
    const seenPr = new Set<number>()
    let inputQty = 0
    let goodQty = 0
    let defectQty = 0
    for (const r of filtered) {
      if (r.processResultId != null && r.processResult) {
        if (seenPr.has(r.processResultId)) continue
        seenPr.add(r.processResultId)
        inputQty += r.processResult.inputQty
        goodQty += r.processResult.goodQty
        defectQty += r.processResult.defectQty
      }
    }
    if (seenPr.size === 0) defectQty = totalQty
    const defectRate = defectRatePct(defectQty, inputQty)
    const byType = aggregateBy(
      filtered,
      (r) => String(r.defectTypeId),
      (r) => r.defectType?.defectName ?? `유형#${r.defectTypeId}`,
    )
    const byProduct = aggregateBy(
      filtered,
      (r) => (rowProductId(r) != null ? String(rowProductId(r)) : null),
      (r, key) => rowProductName(r) || `품목#${key}`,
    )
    const byWorker = aggregateBy(
      filtered,
      (r) => (r.workerId != null ? String(r.workerId) : '__none__'),
      (r) => r.worker?.workerName ?? '미지정',
    )
    return { totalQty, inputQty, goodQty, defectQty, defectRate, count: filtered.length, byType, byProduct, byWorker }
  }, [filtered])

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const empty = emptyFilters()
    setDraftFilters(empty)
    setFilters(empty)
    setPage(1)
  }

  return (
    <div className="mesPage mesPageWide mesDefectHistoryPage">
      <header className="mesDhHead">
        <div>
          <h1 className="mesDhTitle">불량 이력</h1>
          <p className="mesDhDesc">
            공정 실적 등록 시 기록된 불량 상세 이력을 조회합니다. 자재 LOT은 선입선출(FIFO) 투입 기준으로 생산 LOT과 연결됩니다.
          </p>
        </div>
        <div className="mesDhHeadActions">
          <span className="mesDhSummaryBadge mesDhSummaryBadge--accent">
            {loading ? '…' : `${stats.count}건`}
          </span>
          <span className="mesDhSummaryBadge mesDhSummaryBadge--danger">
            {loading ? '…' : `불량 ${stats.totalQty.toLocaleString()}개`}
          </span>
          <button type="button" className="mesDhBtn mesDhBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
        </div>
      </header>

      <div className="mesDhTopRow">
        <div className="mesDhTabs" role="tablist" aria-label="불량 이력 구역">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'list'}
            className={`mesDhTab${tab === 'list' ? ' mesDhTab--active' : ''}`}
            onClick={() => setTab('list')}
          >
            이력 목록
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'stats'}
            className={`mesDhTab${tab === 'stats' ? ' mesDhTab--active' : ''}`}
            onClick={() => setTab('stats')}
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

      <div className="mesDhFilterCard">
        <div className="mesDhField mesDhField--search">
          <span className="mesDhFieldLabel">검색</span>
          <div className="mesDhInputWrap">
            <span className="mesDhInputIcon"><IconSearch /></span>
            <input
              className="mesDhInput mesDhInput--search"
              placeholder="생산품 / LOT / 불량유형 / 작업자"
              value={draftFilters.q}
              onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
            />
          </div>
        </div>
        <div className="mesDhField mesDhField--select">
          <span className="mesDhFieldLabel">생산품</span>
          <select
            className="mesDhSelect"
            value={draftFilters.productId}
            onChange={(e) => setDraftFilters((f) => ({ ...f, productId: e.target.value }))}
          >
            <option value="">전체</option>
            {productOptions.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        </div>
        <div className="mesDhField mesDhField--select">
          <span className="mesDhFieldLabel">생산 LOT</span>
          <select
            className="mesDhSelect"
            value={draftFilters.productionLotId}
            onChange={(e) => setDraftFilters((f) => ({ ...f, productionLotId: e.target.value }))}
          >
            <option value="">전체</option>
            {productionLotOptions.map(([id, v]) => (
              <option key={id} value={String(id)}>{v.lotNo}</option>
            ))}
          </select>
        </div>
        <div className="mesDhField mesDhField--select">
          <span className="mesDhFieldLabel">자재 LOT</span>
          <select
            className="mesDhSelect"
            value={draftFilters.materialLotId}
            onChange={(e) => setDraftFilters((f) => ({ ...f, materialLotId: e.target.value }))}
          >
            <option value="">전체 (FIFO)</option>
            {materialLotOptions.map(([id, v]) => (
              <option key={id} value={String(id)}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="mesDhField mesDhField--select">
          <span className="mesDhFieldLabel">불량 유형</span>
          <select
            className="mesDhSelect"
            value={draftFilters.defectTypeId}
            onChange={(e) => setDraftFilters((f) => ({ ...f, defectTypeId: e.target.value }))}
          >
            <option value="">전체</option>
            {defectTypeOptions.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        </div>
        <div className="mesDhField mesDhField--select">
          <span className="mesDhFieldLabel">작업자</span>
          <select
            className="mesDhSelect"
            value={draftFilters.workerId}
            onChange={(e) => setDraftFilters((f) => ({ ...f, workerId: e.target.value }))}
          >
            <option value="">전체</option>
            <option value="__none__">미지정</option>
            {workerOptions.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        </div>
        <div className="mesDhFilterActions">
          <button type="button" className="mesDhBtn mesDhBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesDhBtn mesDhBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      {tab === 'list' ? (
        <div className="mesDhTableCard">
          <div className="mesDhTableViewport">
            <table className="mesDhTable">
              <thead>
                <tr>
                  <th>생산품</th>
                  <th>생산 LOT</th>
                  <th>자재 LOT</th>
                  <th>불량유형</th>
                  <th className="mesDhThQty">수량</th>
                  <th>작업자</th>
                  <th>작업장</th>
                  <th>검출시각</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="mesDhEmpty">로딩 중…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="mesDhEmpty">조건에 맞는 이력이 없습니다.</td></tr>
                ) : (
                  pageItems.map((r) => (
                    <tr key={r.id}>
                      <td className="mesDhProductCell">
                        <span className="mesDhProductName">{rowProductName(r)}</span>
                        {rowProductCode(r) ? (
                          <span className="mono" style={{ display: 'block', fontSize: 11, color: 'var(--dh-muted)', marginTop: 2 }}>
                            {rowProductCode(r)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="mesDhLotPill mono">{r.lot?.lotNo ?? r.productionLotId}</span>
                      </td>
                      <td className="mesDhTdMatLot">
                        <MaterialLotCell usages={parseMaterialUsages(r)} />
                      </td>
                      <td>
                        <span className="mesDhDefectBadge">{r.defectType?.defectName ?? r.defectTypeId}</span>
                      </td>
                      <td className="mesDhQtyCell">{r.qty.toLocaleString()}</td>
                      <td className="mesDhWorkerCell">{r.worker?.workerName ?? '—'}</td>
                      <td className="mesDhCenterCell">{r.workCenter?.centerName ?? '—'}</td>
                      <td className="mesDhTimeCell mono">{fmtDateKst(r.detectedAt)}</td>
                      <td className="mesDhRemarkCell" title={r.remark ?? undefined}>
                        {r.remark ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 ? (
            <footer className="mesDhPager">
              <span>총 {filtered.length}건 · 불량 {stats.totalQty.toLocaleString()}개</span>
              <nav className="mesDhPagerNav" aria-label="페이지">
                <button type="button" className="mesDhPagerBtn" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
                <button type="button" className="mesDhPagerBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
                  .map((n, idx, arr) => {
                    const prev = arr[idx - 1]
                    const ellipsis = prev != null && n - prev > 1
                    return (
                      <span key={n} style={{ display: 'contents' }}>
                        {ellipsis ? <span className="mesDhPagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}
                        <button
                          type="button"
                          className={`mesDhPagerBtn${n === safePage ? ' mesDhPagerBtn--active' : ''}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      </span>
                    )
                  })}
                <button type="button" className="mesDhPagerBtn" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</button>
                <button type="button" className="mesDhPagerBtn" disabled={safePage >= pages} onClick={() => setPage(pages)}>»</button>
              </nav>
              <select
                className="mesDhSelect"
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
          ) : null}
        </div>
      ) : (
        <div className="mesDhStatsPanel">
          <div className="mesDhKpiRow">
            <div className="mesDhKpiCard">
              <div className="mesDhKpiLabel">총 투입 수량</div>
              <div className="mesDhKpiValue">{stats.inputQty.toLocaleString()}</div>
              <div className="mesDhKpiMeta">실적 등록 기준</div>
            </div>
            <div className="mesDhKpiCard">
              <div className="mesDhKpiLabel">총 불량 / 불량률</div>
              <div className="mesDhKpiValue mesDhKpiValue--danger">
                {stats.defectQty.toLocaleString()}
                <span className="mesDhKpiSub"> ({stats.defectRate}%)</span>
              </div>
              <div className="mesDhKpiMeta">양품 {stats.goodQty.toLocaleString()}</div>
            </div>
            <div className="mesDhKpiCard">
              <div className="mesDhKpiLabel">이력 건수</div>
              <div className="mesDhKpiValue">{stats.count.toLocaleString()}</div>
              <div className="mesDhKpiMeta">불량 상세 건</div>
            </div>
          </div>

          <div className="mesDhChartGrid">
            <section className="mesDhChartCard mesDhChartCard--wide">
              <h2 className="mesDhChartTitle">일별 불량 추이 (최근 14일)</h2>
              <DailyTrendChart rows={filtered} days={14} />
            </section>

            <section className="mesDhChartCard">
              <h2 className="mesDhChartTitle">불량 유형별</h2>
              <HBarChart rows={stats.byType} />
            </section>

            <section className="mesDhChartCard">
              <h2 className="mesDhChartTitle">생산품별</h2>
              <HBarChart rows={stats.byProduct} />
            </section>

            <section className="mesDhChartCard">
              <h2 className="mesDhChartTitle">작업자별</h2>
              <HBarChart rows={stats.byWorker} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
