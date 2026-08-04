import { useCallback, useEffect, useRef, useState } from 'react'
import { apiJson, ApiError } from '../lib/api'
import { itemTypeLabel } from '../lib/itemType'
import '../list-page.css'

type ProductionLot = {
  id: number
  lotNo: string
  barcode: string | null
  status: string
  createdAt: string
  lotQty: number
  goodQty: number
  defectQty: number
  currentStatus: string | null
  currentProcessId: number | null
  product: { productCode: string; productName: string }
  workCenter: { centerCode: string; centerName: string } | null
  workOrder:
    | {
        id: number
        woNo: string
        orderQty: number
        status: string
        holdReason: string | null
        plan: { id: number; planNo: string } | null
        product: { productCode: string; productName: string }
        assignedWorkers?: { worker: { id: number; workerCode: string; workerName: string } }[]
      }
    | null
  results: Array<{
    id: number
    processSequence: number
    inputQty: number
    goodQty: number
    defectQty: number
    startTime: string | null
    endTime: string | null
    createdAt: string
    process: { processCode: string; processName: string }
    worker: { workerCode: string; workerName: string } | null
    workCenter: { centerCode: string; centerName: string } | null
  }>
  defects: Array<{
    id: number
    qty: number
    remark: string | null
    detectedAt: string | null
    createdAt: string
    process: { processCode: string; processName: string }
    defectType: { defectCode: string; defectName: string }
    worker: { workerCode: string; workerName: string } | null
  }>
  materialUsages: Array<{
    id: number
    usedQty: string
    createdAt: string
    materialLot: { id: number; lotNo: string } | null
    materialProduct: { id: number; productCode: string; productName: string } | null
  }>
  histories: Array<{ id: number; eventType: string; eventDesc: string | null; createdAt: string }>
  inventory: Array<{
    id: number
    qty: number
    reservedQty: number
    status: string
    updatedAt: string
    location: { locationCode: string; locationName: string } | null
  }>
  inventoryTx: Array<{
    id: number
    transactionType: string
    qty: number
    remark: string | null
    createdAt: string
    fromLocation: { locationCode: string; locationName: string } | null
    toLocation: { locationCode: string; locationName: string } | null
    location: { locationCode: string; locationName: string } | null
  }>
  shipmentDetails: Array<{
    id: number
    qty: number
    shipment: { shipmentNo: string; shipmentDate: string | null; status: string; customerName: string }
  }>
  outsourcing: Array<{
    id: number
    outsourcingNo: string
    vendorName: string
    requestQty: number
    outDate: string | null
    expectedInDate: string | null
    status: string
    process: { processCode: string; processName: string }
  }>
}

type MaterialLot = {
  id: number
  lotNo: string
  barcode: string | null
  supplier: string | null
  receivedQty: string
  remainQty: string
  receivedDate: string
  status: string
  createdAt: string
  product: { productCode: string; productName: string }
  usages: Array<{
    id: number
    usedQty: string
    createdAt: string
    productionLot: {
      id: number
      lotNo: string
      status: string
      product: { productCode: string; productName: string }
    }
  }>
  inventory: Array<{
    id: number
    qty: number
    reservedQty: number
    status: string
    updatedAt: string
    location: { locationCode: string; locationName: string } | null
  }>
  inventoryTx: Array<{
    id: number
    transactionType: string
    qty: number
    remark: string | null
    createdAt: string
    fromLocation: { locationCode: string; locationName: string } | null
    toLocation: { locationCode: string; locationName: string } | null
    location: { locationCode: string; locationName: string } | null
  }>
}

type ProductScan = {
  id: number
  productCode: string
  productName: string
  itemType: string
  itemNumber: string | null
  unit: string
  safetyStock: number | null
  maxStock: number | null
  barcode: string | null
  status: string
  createdAt: string
  updatedAt: string
  inventoryProfile: { lotControlYn: 'Y' | 'N' } | null
  stockSummary: { totalQty: number; totalReserved: number; availableQty: number }
  inventories: Array<{
    id: number
    qty: number
    reservedQty: number
    status: string
    updatedAt: string
    location: { locationCode: string; locationName: string } | null
    lot: { id: number; lotNo: string } | null
    materialLot: { id: number; lotNo: string } | null
  }>
  inventoryTx: Array<{
    id: number
    transactionType: string
    qty: number
    remark: string | null
    createdAt: string
    fromLocation: { locationCode: string; locationName: string } | null
    toLocation: { locationCode: string; locationName: string } | null
    location: { locationCode: string; locationName: string } | null
    lot: { lotNo: string } | null
    materialLot: { lotNo: string } | null
  }>
}

type ScanResult =
  | { kind: 'production'; lot: ProductionLot }
  | { kind: 'material'; lot: MaterialLot }
  | { kind: 'product'; product: ProductScan }

function normalizeScannedLotToken(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  const first = v.split(/[\s,\t|]+/)[0] ?? ''
  return first.trim()
}

function fmt(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleDateString()
  } catch {
    return ts
  }
}

function workersLabel(wo: ProductionLot['workOrder'] | null | undefined): string {
  if (!wo?.assignedWorkers?.length) return '—'
  return wo.assignedWorkers.map((a) => a.worker.workerName || a.worker.workerCode).join(', ')
}

type InventoryRow = {
  id: number
  qty: number
  reservedQty: number
  status: string
  updatedAt: string
  location: { locationCode: string; locationName: string } | null
  lot?: { id?: number; lotNo: string } | null
  materialLot?: { id?: number; lotNo: string } | null
}

function InventoryTable({ items, showLot = false }: { items: InventoryRow[]; showLot?: boolean }) {
  return (
    <div className="mesCard" style={{ marginTop: 14 }}>
      <div className="mesCardTitle">재고 (최대 {showLot ? 50 : 20})</div>
      <div className="mesTableWrap mesTableScroll">
        <table className="mesTable">
          <thead>
            <tr>
              {showLot ? <th>LOT</th> : null}
              <th>위치</th>
              <th>수량</th>
              <th>예약</th>
              <th>상태</th>
              <th>업데이트</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={showLot ? 6 : 5} className="muted">
                  없음
                </td>
              </tr>
            ) : (
              items.map((inv) => (
                <tr key={inv.id}>
                  {showLot ? (
                    <td className="mono">
                      {inv.lot
                        ? `생산 ${inv.lot.lotNo}`
                        : inv.materialLot
                          ? `자재 ${inv.materialLot.lotNo}`
                          : '—'}
                    </td>
                  ) : null}
                  <td className="mono">{inv.location ? `${inv.location.locationCode} · ${inv.location.locationName}` : '—'}</td>
                  <td className="mono">{inv.qty}</td>
                  <td className="mono">{inv.reservedQty}</td>
                  <td className="mono">{inv.status}</td>
                  <td className="mono">{fmt(inv.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InventoryTxTable({ items }: { items: ProductionLot['inventoryTx'] }) {
  return (
    <div className="mesCard" style={{ marginTop: 14 }}>
      <div className="mesCardTitle">재고 이력 (최대 30)</div>
      <div className="mesTableWrap mesTableScroll">
        <table className="mesTable">
          <thead>
            <tr>
              <th>유형</th>
              <th>수량</th>
              <th>위치</th>
              <th>일시</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  없음
                </td>
              </tr>
            ) : (
              items.map((tx) => (
                <tr key={tx.id}>
                  <td className="mono">{tx.transactionType}</td>
                  <td className="mono">{tx.qty}</td>
                  <td className="mono">
                    {tx.fromLocation || tx.toLocation || tx.location
                      ? [
                          tx.fromLocation ? `${tx.fromLocation.locationCode} →` : null,
                          tx.toLocation ? tx.toLocation.locationCode : null,
                          !tx.fromLocation && !tx.toLocation && tx.location ? tx.location.locationCode : null,
                        ]
                          .filter(Boolean)
                          .join(' ')
                      : '—'}
                  </td>
                  <td className="mono">{fmt(tx.createdAt)}</td>
                  <td>{tx.remark ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProductionLotModal({ lot, onClose }: { lot: ProductionLot; onClose: () => void }) {
  return (
    <>
      <div className="mesModalHead">
        <div>
          <h2 className="mesModalTitle" id="mes-lot-scan-title">
            {lot.lotNo}
          </h2>
          <div className="mesModalMeta muted">
            생산 LOT · {lot.product.productCode} · {lot.product.productName} · 등록 {fmt(lot.createdAt)}
          </div>
        </div>
      </div>

      <div className="mesModalBody mesLotScanModalBody">
        <div className="mesFieldRow mesLotScanSummaryGrid">
          <label className="mesLabel">
            상태
            <input className="mesInput muted" readOnly value={`${lot.status}${lot.currentStatus ? ` · ${lot.currentStatus}` : ''}`} />
          </label>
          <label className="mesLabel">
            수량 (LOT/양품/불량)
            <input className="mesInput muted" readOnly value={`${lot.lotQty} / ${lot.goodQty} / ${lot.defectQty}`} />
          </label>
          <label className="mesLabel">
            작업장
            <input className="mesInput muted" readOnly value={lot.workCenter ? `${lot.workCenter.centerCode} · ${lot.workCenter.centerName}` : '—'} />
          </label>
        </div>

        <div className="mesFieldRow mesLotScanSummaryGrid">
          <label className="mesLabel">
            작업지시
            <input className="mesInput muted" readOnly value={lot.workOrder?.woNo ?? '—'} />
          </label>
          <label className="mesLabel">
            생산계획
            <input className="mesInput muted" readOnly value={lot.workOrder?.plan?.planNo ?? '—'} />
          </label>
          <label className="mesLabel">
            배정 작업자 (지시)
            <input className="mesInput muted" readOnly value={workersLabel(lot.workOrder)} />
          </label>
        </div>

        <div className="mesCard" style={{ marginTop: 14 }}>
          <div className="mesCardTitle">최근 실적 (최대 20)</div>
          <div className="mesTableWrap mesTableScroll">
            <table className="mesTable">
              <thead>
                <tr>
                  <th>공정</th>
                  <th>작업자</th>
                  <th>작업장</th>
                  <th>투입/양품/불량</th>
                  <th>시작</th>
                  <th>종료</th>
                </tr>
              </thead>
              <tbody>
                {lot.results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      없음
                    </td>
                  </tr>
                ) : (
                  lot.results.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">
                        {r.process.processCode} · {r.process.processName} (#{r.processSequence})
                      </td>
                      <td>{r.worker ? r.worker.workerName || r.worker.workerCode : '—'}</td>
                      <td>{r.workCenter ? `${r.workCenter.centerCode} · ${r.workCenter.centerName}` : '—'}</td>
                      <td className="mono">
                        {r.inputQty}/{r.goodQty}/{r.defectQty}
                      </td>
                      <td className="mono">{fmt(r.startTime)}</td>
                      <td className="mono">{fmt(r.endTime)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mesCard" style={{ marginTop: 14 }}>
          <div className="mesCardTitle">불량 (최대 50)</div>
          <div className="mesTableWrap mesTableScroll">
            <table className="mesTable">
              <thead>
                <tr>
                  <th>공정</th>
                  <th>불량유형</th>
                  <th>수량</th>
                  <th>작업자</th>
                  <th>일시</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {lot.defects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      없음
                    </td>
                  </tr>
                ) : (
                  lot.defects.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">
                        {d.process.processCode} · {d.process.processName}
                      </td>
                      <td className="mono">
                        {d.defectType.defectCode} · {d.defectType.defectName}
                      </td>
                      <td className="mono">{d.qty}</td>
                      <td>{d.worker ? d.worker.workerName || d.worker.workerCode : '—'}</td>
                      <td className="mono">{fmt(d.detectedAt ?? d.createdAt)}</td>
                      <td>{d.remark ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mesCard" style={{ marginTop: 14 }}>
          <div className="mesCardTitle">자재 투입 (최대 50)</div>
          <div className="mesTableWrap mesTableScroll">
            <table className="mesTable">
              <thead>
                <tr>
                  <th>자재LOT</th>
                  <th>자재품목</th>
                  <th>사용량</th>
                  <th>일시</th>
                </tr>
              </thead>
              <tbody>
                {lot.materialUsages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      없음
                    </td>
                  </tr>
                ) : (
                  lot.materialUsages.map((u) => (
                    <tr key={u.id}>
                      <td className="mono">{u.materialLot?.lotNo ?? '—'}</td>
                      <td className="mono">
                        {u.materialProduct ? `${u.materialProduct.productCode} · ${u.materialProduct.productName}` : '—'}
                      </td>
                      <td className="mono">{u.usedQty}</td>
                      <td className="mono">{fmt(u.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mesCard" style={{ marginTop: 14 }}>
          <div className="mesCardTitle">출하 (최대 20)</div>
          <div className="mesTableWrap mesTableScroll">
            <table className="mesTable">
              <thead>
                <tr>
                  <th>출하번호</th>
                  <th>고객</th>
                  <th>일자</th>
                  <th>상태</th>
                  <th>수량</th>
                </tr>
              </thead>
              <tbody>
                {lot.shipmentDetails.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      없음
                    </td>
                  </tr>
                ) : (
                  lot.shipmentDetails.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.shipment.shipmentNo}</td>
                      <td>{s.shipment.customerName}</td>
                      <td className="mono">{fmt(s.shipment.shipmentDate)}</td>
                      <td className="mono">{s.shipment.status}</td>
                      <td className="mono">{s.qty}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <InventoryTable items={lot.inventory} />

        <div className="mesCard" style={{ marginTop: 14 }}>
          <div className="mesCardTitle">LOT 이력 (최대 50)</div>
          <div className="mesTableWrap mesTableScroll">
            <table className="mesTable">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>이벤트</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {lot.histories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      없음
                    </td>
                  </tr>
                ) : (
                  lot.histories.map((h) => (
                    <tr key={h.id}>
                      <td className="mono">{fmt(h.createdAt)}</td>
                      <td className="mono">{h.eventType}</td>
                      <td>{h.eventDesc ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mesModalFoot">
        <button type="button" className="mesBtnSecondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </>
  )
}

function MaterialLotModal({ lot, onClose }: { lot: MaterialLot; onClose: () => void }) {
  return (
    <>
      <div className="mesModalHead">
        <div>
          <h2 className="mesModalTitle" id="mes-lot-scan-title">
            {lot.lotNo}
          </h2>
          <div className="mesModalMeta muted">
            자재 LOT · {lot.product.productCode} · {lot.product.productName} · 등록 {fmt(lot.createdAt)}
          </div>
        </div>
      </div>

      <div className="mesModalBody mesLotScanModalBody">
        <div className="mesFieldRow mesLotScanSummaryGrid">
          <label className="mesLabel">
            상태
            <input className="mesInput muted" readOnly value={lot.status} />
          </label>
          <label className="mesLabel">
            입고수량 / 잔여수량
            <input className="mesInput muted" readOnly value={`${lot.receivedQty} / ${lot.remainQty}`} />
          </label>
          <label className="mesLabel">
            입고일자
            <input className="mesInput muted" readOnly value={fmtDate(lot.receivedDate)} />
          </label>
        </div>

        <div className="mesFieldRow mesLotScanSummaryGrid">
          <label className="mesLabel">
            공급업체
            <input className="mesInput muted" readOnly value={lot.supplier ?? '—'} />
          </label>
          <label className="mesLabel">
            바코드
            <input className="mesInput muted mono" readOnly value={lot.barcode ?? lot.lotNo} />
          </label>
        </div>

        <div className="mesCard" style={{ marginTop: 14 }}>
          <div className="mesCardTitle">생산 투입 이력 (최대 50)</div>
          <div className="mesTableWrap mesTableScroll">
            <table className="mesTable">
              <thead>
                <tr>
                  <th>생산 LOT</th>
                  <th>생산품목</th>
                  <th>상태</th>
                  <th>사용량</th>
                  <th>일시</th>
                </tr>
              </thead>
              <tbody>
                {lot.usages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      없음
                    </td>
                  </tr>
                ) : (
                  lot.usages.map((u) => (
                    <tr key={u.id}>
                      <td className="mono">{u.productionLot.lotNo}</td>
                      <td className="mono">
                        {u.productionLot.product.productCode} · {u.productionLot.product.productName}
                      </td>
                      <td className="mono">{u.productionLot.status}</td>
                      <td className="mono">{u.usedQty}</td>
                      <td className="mono">{fmt(u.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <InventoryTable items={lot.inventory} />
        <InventoryTxTable items={lot.inventoryTx} />
      </div>

      <div className="mesModalFoot">
        <button type="button" className="mesBtnSecondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </>
  )
}

function ProductModal({ product, onClose }: { product: ProductScan; onClose: () => void }) {
  const invItems = product.inventories.map((inv) => ({
    id: inv.id,
    qty: inv.qty,
    reservedQty: inv.reservedQty,
    status: inv.status,
    updatedAt: inv.updatedAt,
    location: inv.location,
    lot: inv.lot,
    materialLot: inv.materialLot,
  }))

  return (
    <>
      <div className="mesModalHead">
        <div>
          <h2 className="mesModalTitle" id="mes-lot-scan-title">
            {product.productCode}
          </h2>
          <div className="mesModalMeta muted">
            품목 · {product.productName} · 등록 {fmt(product.createdAt)}
          </div>
        </div>
      </div>

      <div className="mesModalBody mesLotScanModalBody">
        <div className="mesFieldRow mesLotScanSummaryGrid">
          <label className="mesLabel">
            품목명
            <input className="mesInput muted" readOnly value={product.productName} />
          </label>
          <label className="mesLabel">
            유형 / 단위
            <input className="mesInput muted" readOnly value={`${itemTypeLabel(product.itemType)} / ${product.unit}`} />
          </label>
          <label className="mesLabel">
            상태
            <input className="mesInput muted" readOnly value={product.status} />
          </label>
        </div>

        <div className="mesFieldRow mesLotScanSummaryGrid">
          <label className="mesLabel">
            재고 합계
            <input
              className="mesInput muted"
              readOnly
              value={`${product.stockSummary.totalQty} (가용 ${product.stockSummary.availableQty}, 예약 ${product.stockSummary.totalReserved})`}
            />
          </label>
          <label className="mesLabel">
            현재재고
            <input
              className="mesInput muted"
              readOnly
              value={`${product.stockSummary.totalQty} ${product.unit}`}
            />
          </label>
          <label className="mesLabel">
            바코드
            <input className="mesInput muted mono" readOnly value={product.barcode ?? product.productCode} />
          </label>
        </div>

        <InventoryTable items={invItems} showLot />
        <InventoryTxTable items={product.inventoryTx} />
      </div>

      <div className="mesModalFoot">
        <button type="button" className="mesBtnSecondary" onClick={onClose}>
          닫기
        </button>
      </div>
    </>
  )
}

export function LotScanLookupPage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [scanValue, setScanValue] = useState('')
  const [lastToken, setLastToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)

  const closeModal = useCallback(() => {
    setResult(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setErr(null)
    setLastToken(null)
    setScanValue('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const lookup = useCallback(async (raw: string) => {
    const token = normalizeScannedLotToken(raw)
    if (!token) return
    setLastToken(token)
    setLoading(true)
    setErr(null)
    const q = encodeURIComponent(token)
    try {
      const data = await apiJson<{ ok: true; lot: ProductionLot }>(`/api/lots/lookup?value=${q}`)
      setResult({ kind: 'production', lot: data.lot })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        try {
          const data = await apiJson<{ ok: true; lot: MaterialLot }>(`/api/material-lots/lookup?value=${q}`)
          setResult({ kind: 'material', lot: data.lot })
        } catch (e2) {
          if (e2 instanceof ApiError && e2.status === 404) {
            try {
              const data = await apiJson<{ ok: true; product: ProductScan }>(`/api/products/lookup?value=${q}`)
              setResult({ kind: 'product', product: data.product })
            } catch (e3) {
              setResult(null)
              setErr(e3 instanceof Error ? e3.message : '생산/자재 LOT·품목을 찾을 수 없습니다.')
            }
          } else {
            setResult(null)
            setErr(e2 instanceof Error ? e2.message : '생산/자재 LOT를 찾을 수 없습니다.')
          }
        }
      } else {
        setResult(null)
        setErr(e instanceof Error ? e.message : '조회 실패')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="mesPage mesPageWide mesListPage mesLotScanPage">
      <header className="mesListHead">
        <div className="mesListHeadMain">
          <h1 className="mesListTitle">바코드 스캔 조회</h1>
          <p className="mesListDesc">바코드를 스캔하면 생산 LOT, 자재 LOT, 품목에 연결된 정보를 모달로 한 번에 조회합니다.</p>
        </div>
        <div className="mesListHeadActions">
          <button type="button" className="mesListBtn mesListBtn--secondary" onClick={reset}>
            초기화
          </button>
        </div>
      </header>

      <div className="mesListFilterCard mesLotScanShell">
        <label className="mesListField mesListField--search">
          <span className="mesListFieldLabel">스캔 (LOT·품목)</span>
          <input
            ref={inputRef}
            className="mesListInput mono mesLotScanInput"
            placeholder="바코드 스캔 후 Enter"
            value={scanValue}
            onChange={(ev) => setScanValue(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                void lookup(scanValue)
                setScanValue('')
                requestAnimationFrame(() => inputRef.current?.focus())
              } else if (ev.key === 'Escape') {
                setScanValue('')
                setResult(null)
                setErr(null)
              }
            }}
          />
        </label>
      </div>

      {err ? <div className="mesBanner mesListNotice">{err}</div> : null}
      {loading ? <div className="mesBanner mesBannerInfo mesListNotice">조회 중…</div> : null}
      {lastToken && !loading && !err && result ? (
        <div className="mesBanner mesBannerInfo mesListNotice">
          스캔: {lastToken} (
          {result.kind === 'production' ? '생산 LOT' : result.kind === 'material' ? '자재 LOT' : '품목'})
        </div>
      ) : null}

      {result ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeModal} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-lot-scan-title">
            {result.kind === 'production' ? (
              <ProductionLotModal lot={result.lot} onClose={closeModal} />
            ) : result.kind === 'material' ? (
              <MaterialLotModal lot={result.lot} onClose={closeModal} />
            ) : (
              <ProductModal product={result.product} onClose={closeModal} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
