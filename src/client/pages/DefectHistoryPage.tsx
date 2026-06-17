import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'

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

/** 자재 LOT: FIFO 순 칩 + 투입량. 3건 이상이면 2건까지 표시 후 +N, 전체는 툴팁 */
function MaterialLotCell({ usages }: { usages: MatUsageItem[] }) {
  if (usages.length === 0) return <span className="muted">—</span>

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

function fmtDate(v?: string | null) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
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
    return <div className="muted mesDhEmptyChart">표시할 데이터가 없습니다.</div>
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
    <div className="mesDashBars mesDashBarsCompact mesDhTrendBars" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
      {chart.dayList.map((d) => {
        const h = Math.round((d.qty / chart.max) * 100)
        return (
          <div
            key={d.ymd}
            className={`mesDashBarWrap${d.qty > 0 ? ' mesDashBarWrapLabeled' : ''}`}
            title={`${d.ymd} · ${d.qty}개 · ${d.count}건`}
          >
            {d.qty > 0 ? (
              <div className="mesDashBarDataLabel mono">
                <span className="mesDashBarDataLabelSum">{d.qty}</span>
              </div>
            ) : null}
            <div className="mesDashBarChart">
              <div
                className="mesDashBarStack"
                style={{ height: `${Math.max(h, d.qty > 0 ? 6 : 0)}%`, minHeight: d.qty > 0 ? 4 : 0 }}
              >
                {d.qty > 0 ? <div className="mesDashBarSeg mesDashBarSeg--defect" style={{ flex: 1 }} /> : null}
              </div>
            </div>
            <div className="mesDashBarTick mono">{d.ymd.slice(5)}</div>
          </div>
        )
      })}
    </div>
  )
}

export function DefectHistoryPage() {
  const [tab, setTab] = useState<Tab>('list')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState('')
  const [productionLotFilter, setProductionLotFilter] = useState('')
  const [materialLotFilter, setMaterialLotFilter] = useState('')
  const [defectTypeFilter, setDefectTypeFilter] = useState('')
  const [workerFilter, setWorkerFilter] = useState('')

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
    return rows.filter((r) => {
      if (productFilter && String(rowProductId(r) ?? '') !== productFilter) return false
      if (productionLotFilter && String(r.productionLotId) !== productionLotFilter) return false
      if (materialLotFilter && !materialLotIds(r).includes(Number(materialLotFilter))) return false
      if (defectTypeFilter && String(r.defectTypeId) !== defectTypeFilter) return false
      if (workerFilter) {
        if (workerFilter === '__none__') {
          if (r.workerId != null) return false
        } else if (String(r.workerId ?? '') !== workerFilter) {
          return false
        }
      }
      return true
    })
  }, [rows, productFilter, productionLotFilter, materialLotFilter, defectTypeFilter, workerFilter])

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

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">불량 이력</h1>
        <p className="mesPageDesc">
          공정 실적 등록 시 기록된 불량 상세 이력을 조회합니다. 자재 LOT은 선입선출(FIFO) 투입 기준으로 생산 LOT과 연결됩니다.
        </p>
      </header>

      <div className="mesOpsTopRow" style={{ marginBottom: 12 }}>
        <div className="mesOpsTabs" role="tablist" aria-label="불량 이력 구역">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'list'}
            className={`mesOpsTab ${tab === 'list' ? 'mesOpsTabActive' : ''}`}
            onClick={() => setTab('list')}
          >
            이력 목록
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'stats'}
            className={`mesOpsTab ${tab === 'stats' ? 'mesOpsTabActive' : ''}`}
            onClick={() => setTab('stats')}
          >
            통계
          </button>
        </div>
        <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
          새로고침
        </button>
      </div>

      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesOpsTableToolbar mesDhFilterBar">
        <select
          className="mesInput mesOpsTableToolbarSelect mesDhFilterSelect"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          aria-label="생산품 필터"
        >
          <option value="">전체 생산품</option>
          {productOptions.map(([id, name]) => (
            <option key={id} value={String(id)}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="mesInput mesOpsTableToolbarSelect mesDhFilterSelect"
          value={productionLotFilter}
          onChange={(e) => setProductionLotFilter(e.target.value)}
          aria-label="생산 LOT 필터"
        >
          <option value="">전체 생산 LOT</option>
          {productionLotOptions.map(([id, v]) => (
            <option key={id} value={String(id)}>
              {v.lotNo}
            </option>
          ))}
        </select>
        <select
          className="mesInput mesOpsTableToolbarSelect mesDhFilterSelect"
          value={materialLotFilter}
          onChange={(e) => setMaterialLotFilter(e.target.value)}
          aria-label="자재 LOT 필터"
        >
          <option value="">전체 자재 LOT (FIFO)</option>
          {materialLotOptions.map(([id, v]) => (
            <option key={id} value={String(id)}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          className="mesInput mesOpsTableToolbarSelect mesDhFilterSelect"
          value={defectTypeFilter}
          onChange={(e) => setDefectTypeFilter(e.target.value)}
          aria-label="불량 유형 필터"
        >
          <option value="">전체 불량 유형</option>
          {defectTypeOptions.map(([id, name]) => (
            <option key={id} value={String(id)}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="mesInput mesOpsTableToolbarSelect mesDhFilterSelect"
          value={workerFilter}
          onChange={(e) => setWorkerFilter(e.target.value)}
          aria-label="작업자 필터"
        >
          <option value="">전체 작업자</option>
          <option value="__none__">미지정</option>
          {workerOptions.map(([id, name]) => (
            <option key={id} value={String(id)}>
              {name}
            </option>
          ))}
        </select>
        {(productFilter || productionLotFilter || materialLotFilter || defectTypeFilter || workerFilter) && (
          <button
            type="button"
            className="mesBtnSm"
            onClick={() => {
              setProductFilter('')
              setProductionLotFilter('')
              setMaterialLotFilter('')
              setDefectTypeFilter('')
              setWorkerFilter('')
            }}
          >
            필터 초기화
          </button>
        )}
        <span className="muted small mesDhFilterMeta">
          {loading ? '로딩 중…' : `${filtered.length}건 · 불량 ${stats.totalQty.toLocaleString()}개`}
        </span>
      </div>

      {tab === 'list' ? (
        <div className="mesTableWrap mesTableScroll">
          <table className="mesTable">
            <thead>
              <tr>
                <th>생산품</th>
                <th>생산 LOT</th>
                <th>자재 LOT</th>
                <th>불량유형</th>
                <th>수량</th>
                <th>작업자</th>
                <th>작업장</th>
                <th>검출시각</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="muted">
                    로딩 중…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{rowProductName(r)}</td>
                    <td className="mono">{r.lot?.lotNo ?? r.productionLotId}</td>
                    <td className="mesTdMatLot">
                      <MaterialLotCell usages={parseMaterialUsages(r)} />
                    </td>
                    <td>{r.defectType?.defectName ?? r.defectTypeId}</td>
                    <td>{r.qty}</td>
                    <td>{r.worker?.workerName ?? '—'}</td>
                    <td>{r.workCenter?.centerName ?? '—'}</td>
                    <td className="mono small">{fmtDate(r.detectedAt)}</td>
                    <td className="mesTdEllipsis" title={r.remark ?? undefined}>
                      {r.remark ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mesDhStats">
          <div className="mesDhKpiRow">
            <div className="mesDashKpiCard">
              <div className="mesDashKpiLabel">총 투입 수량</div>
              <div className="mesDashKpiValue">{stats.inputQty.toLocaleString()}</div>
              <div className="mesDashKpiMeta muted">실적 등록 기준</div>
            </div>
            <div className="mesDashKpiCard">
              <div className="mesDashKpiLabel">총 불량 / 불량률</div>
              <div className="mesDashKpiValue">
                {stats.defectQty.toLocaleString()}
                <span className="mesWoKpiSub"> ({stats.defectRate}%)</span>
              </div>
              <div className="mesDashKpiMeta muted">양품 {stats.goodQty.toLocaleString()}</div>
            </div>
            <div className="mesDashKpiCard">
              <div className="mesDashKpiLabel">이력 건수</div>
              <div className="mesDashKpiValue">{stats.count.toLocaleString()}</div>
              <div className="mesDashKpiMeta muted">불량 상세 건</div>
            </div>
          </div>

          <div className="mesDhChartGrid">
            <section className="mesDashChartCard">
              <h2 className="mesDhChartTitle">일별 불량 추이 (최근 14일)</h2>
              <DailyTrendChart rows={filtered} days={14} />
            </section>

            <section className="mesDashChartCard">
              <h2 className="mesDhChartTitle">불량 유형별</h2>
              <HBarChart rows={stats.byType} />
            </section>

            <section className="mesDashChartCard">
              <h2 className="mesDhChartTitle">생산품별</h2>
              <HBarChart rows={stats.byProduct} />
            </section>

            <section className="mesDashChartCard">
              <h2 className="mesDhChartTitle">작업자별</h2>
              <HBarChart rows={stats.byWorker} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
