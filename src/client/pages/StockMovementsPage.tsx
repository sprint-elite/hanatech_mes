import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import { normalizeItemTypeToCode } from '../lib/itemType'

type ItemTypeCode = 'RAW' | 'WIP' | 'FG'
type MovementType = 'IN' | 'OUT'

type Product = {
  id: number
  productCode: string
  productName: string
  itemType: string
}

type LocationRow = {
  id: number
  locationCode: string
  locationName: string
}

type ProductionLotOpt = {
  id: number
  lotNo: string
  productId: number
}

type MaterialLotOpt = {
  id: number
  lotNo: string
  productId: number
}

type InventoryRow = {
  id: number
  productId: number
  lotId: number | null
  materialLotId?: number | null
  locationId: number | null
  qty: number
  reservedQty: number
}

type InventoryTxRow = {
  id: number
  productId: number
  lotId: number | null
  materialLotId: number | null
  locationId: number | null
  transactionType: MovementType | 'MOVE' | 'ADJUST'
  qty: number
  refType: 'WO' | 'LOT' | 'SHIPMENT' | 'OUTSOURCING' | 'ADJUST' | null
  refId: number | null
  remark: string | null
  beforeQty: number | null
  afterQty: number | null
  createdAt: string
  product?: { productCode: string; productName: string } | null
  lot?: { lotNo: string } | null
  materialLot?: { lotNo: string } | null
  location?: { locationCode: string; locationName: string } | null
}

type InventoryTxDisplayRow = InventoryTxRow & {
  computedBeforeQty: number
  computedAfterQty: number
}

type LotChoice = {
  key: string
  kind: 'P' | 'M'
  id: number
  lotNo: string
}

const ITEM_TABS: { code: ItemTypeCode; label: string }[] = [
  { code: 'RAW', label: '원자재' },
  { code: 'WIP', label: '반제품' },
  { code: 'FG', label: '상품' },
]

const movementLabel = (t: InventoryTxRow['transactionType']) => {
  if (t === 'IN') return '입고'
  if (t === 'OUT') return '출고'
  if (t === 'MOVE') return '이동'
  if (t === 'ADJUST') return '조정'
  return t
}

const fmtWhen = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

const txRemark = (r: InventoryTxRow) => {
  if (r.remark && r.remark.trim() !== '') return r.remark
  if (r.refType === 'SHIPMENT') return '출하 확정으로 재고 차감'
  if (r.refType === 'LOT') {
    if (r.transactionType === 'OUT') return '생산 투입으로 인한 출고'
    if (r.transactionType === 'IN') return '생산 실적 반영 입고'
    return '생산 LOT 연계 처리'
  }
  if (r.refType === 'OUTSOURCING') {
    if (r.transactionType === 'OUT') return '외주 반출로 인한 출고'
    if (r.transactionType === 'IN') return '외주 반입으로 인한 입고'
    return '외주 연계 처리'
  }
  if (r.refType === 'ADJUST') {
    if (r.transactionType === 'IN') return '수동 입고 등록'
    if (r.transactionType === 'OUT') return '수동 출고 등록'
    return '수동 재고 조정'
  }
  if (r.refType === 'WO') return '작업지시 연계 처리'
  return '—'
}

export function StockMovementsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [productionLots, setProductionLots] = useState<ProductionLotOpt[]>([])
  const [materialLots, setMaterialLots] = useState<MaterialLotOpt[]>([])
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([])
  const [txRows, setTxRows] = useState<InventoryTxRow[]>([])

  const [itemType, setItemType] = useState<ItemTypeCode>('RAW')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [movementType, setMovementType] = useState<MovementType>('IN')
  const [qty, setQty] = useState<string>('1')
  const [locationId, setLocationId] = useState<string>('')
  const [lotChoice, setLotChoice] = useState<string>('')
  const [materialLotNo, setMaterialLotNo] = useState<string>('')
  const [remark, setRemark] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, inv, tx, loc, pl, ml] = await Promise.all([
        apiJson<{ ok: boolean; items: Product[] }>('/api/products'),
        apiJson<{ ok: boolean; items: InventoryRow[] }>('/api/inventory'),
        apiJson<{ ok: boolean; items: InventoryTxRow[] }>('/api/inventory-transactions?limit=800'),
        apiJson<{ ok: boolean; items: LocationRow[] }>('/api/locations'),
        apiJson<{ ok: boolean; items: ProductionLotOpt[] }>('/api/lots'),
        apiJson<{ ok: boolean; items: MaterialLotOpt[] }>('/api/material-lots'),
      ])
      setProducts(p.items)
      setInventoryRows(inv.items)
      setTxRows(tx.items)
      setLocations(loc.items)
      setProductionLots(pl.items)
      setMaterialLots(ml.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tabProducts = useMemo(
    () => products.filter((p) => normalizeItemTypeToCode(p.itemType) === itemType).sort((a, b) => a.productCode.localeCompare(b.productCode)),
    [products, itemType],
  )

  useEffect(() => {
    if (tabProducts.length === 0) {
      setSelectedProductId('')
      return
    }
    const exists = tabProducts.some((p) => String(p.id) === selectedProductId)
    if (!exists) setSelectedProductId(String(tabProducts[0].id))
  }, [tabProducts, selectedProductId])

  const selectedPid = Number(selectedProductId)
  const selectedProduct = useMemo(
    () => tabProducts.find((p) => p.id === selectedPid) ?? null,
    [tabProducts, selectedPid],
  )
  const isRawIn = itemType === 'RAW' && movementType === 'IN'

  const lotChoices = useMemo(() => {
    if (!Number.isInteger(selectedPid) || selectedPid < 1) return [] as LotChoice[]
    if (itemType === 'RAW') {
      return materialLots
        .filter((x) => x.productId === selectedPid)
        .map((x) => ({ key: `M:${x.id}`, kind: 'M' as const, id: x.id, lotNo: x.lotNo }))
        .sort((a, b) => a.lotNo.localeCompare(b.lotNo))
    }
    return productionLots
      .filter((x) => x.productId === selectedPid)
      .map((x) => ({ key: `P:${x.id}`, kind: 'P' as const, id: x.id, lotNo: x.lotNo }))
      .sort((a, b) => a.lotNo.localeCompare(b.lotNo))
  }, [productionLots, materialLots, selectedPid, itemType])

  useEffect(() => {
    if (lotChoice && !lotChoices.some((l) => l.key === lotChoice)) setLotChoice('')
  }, [lotChoice, lotChoices])
  useEffect(() => {
    if (isRawIn) setLotChoice('')
  }, [isRawIn])

  const selectedLot = useMemo(() => lotChoices.find((l) => l.key === lotChoice) ?? null, [lotChoices, lotChoice])

  const productInvRows = useMemo(
    () => (Number.isInteger(selectedPid) && selectedPid > 0 ? inventoryRows.filter((r) => r.productId === selectedPid) : []),
    [inventoryRows, selectedPid],
  )
  const productTotalQty = useMemo(() => productInvRows.reduce((s, r) => s + r.qty, 0), [productInvRows])
  const productAvailQty = useMemo(() => productInvRows.reduce((s, r) => s + (r.qty - r.reservedQty), 0), [productInvRows])

  const productTxRows = useMemo<InventoryTxDisplayRow[]>(() => {
    if (!Number.isInteger(selectedPid) || selectedPid < 1) return []
    const baseRows = txRows.filter((r) => r.productId === selectedPid && (r.transactionType === 'IN' || r.transactionType === 'OUT'))
    const asc = [...baseRows].sort((a, b) => {
      const dt = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (dt !== 0) return dt
      return a.id - b.id
    })
    let running = 0
    const computed = new Map<number, { before: number; after: number }>()
    for (const r of asc) {
      const before = running
      running += r.transactionType === 'IN' ? r.qty : -r.qty
      computed.set(r.id, { before, after: running })
    }
    return [...baseRows]
      .sort((a, b) => b.id - a.id)
      .slice(0, 80)
      .map((r) => {
        const x = computed.get(r.id)
        return {
          ...r,
          computedBeforeQty: x?.before ?? 0,
          computedAfterQty: x?.after ?? 0,
        }
      })
  }, [txRows, selectedPid])

  const submitMovement = async () => {
    const pid = Number(selectedProductId)
    const q = Number(qty)
    const lid = locationId.trim() === '' ? null : Number(locationId)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    if (!Number.isInteger(q) || q < 1) {
      setErr('수량은 1 이상 정수여야 합니다.')
      return
    }
    if (locationId.trim() !== '' && (!Number.isInteger(lid) || (lid as number) < 1)) {
      setErr('위치 선택이 올바르지 않습니다.')
      return
    }
    if (isRawIn && materialLotNo.trim() === '') {
      setErr('원자재 입고 시 자재 LOT 번호를 입력하세요.')
      return
    }

    setSaving(true)
    setErr(null)
    setOkMsg(null)
    try {
      await apiJson('/api/transactions/stock-movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: pid,
          movementType,
          qty: q,
          locationId: lid,
          lotId: isRawIn ? undefined : selectedLot?.kind === 'P' ? selectedLot.id : undefined,
          materialLotId: isRawIn ? undefined : selectedLot?.kind === 'M' ? selectedLot.id : undefined,
          materialLotNo: isRawIn ? materialLotNo.trim() : undefined,
          remark: remark.trim() || undefined,
        }),
      })
      setOkMsg(`${movementType === 'IN' ? '입고' : '출고'} 처리 완료`)
      setQty('1')
      if (isRawIn) setMaterialLotNo('')
      setRemark('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const removeMovement = async (id: number) => {
    if (!confirm('이 입출고 이력을 삭제할까요? 재고와 자재 LOT 잔량이 함께 되돌려집니다.')) return
    try {
      await apiJson(`/api/transactions/stock-movements/${id}`, { method: 'DELETE' })
      setOkMsg('입출고 이력을 삭제했습니다.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">입출고관리</h1>
        <p className="mesPageDesc">원자재·반제품·상품을 품목별로 선택해 LOT 선택(옵션) 방식으로 입고/출고를 입력합니다.</p>
      </header>

      <section className="mesCard">
        <div className="mesToolbar" style={{ marginBottom: 10 }}>
          {ITEM_TABS.map((t) => (
            <button
              key={t.code}
              type="button"
              className={itemType === t.code ? 'mesBtnPrimary' : 'mesBtnSecondary'}
              onClick={() => setItemType(t.code)}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>

        {err ? <div className="error mesBanner">{err}</div> : null}
        {okMsg ? <div className="mesBanner muted">{okMsg}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 12, alignItems: 'start' }}>
          <div>
            <div className="mesFieldRow" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <label className="mesLabel">
                품목
                <select className="mesInput" value={selectedProductId} onChange={(ev) => setSelectedProductId(ev.target.value)}>
                  {tabProducts.length === 0 ? <option value="">선택 가능한 품목 없음</option> : null}
                  {tabProducts.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.productCode} · {p.productName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mesLabel">
                {isRawIn ? '자재 LOT 번호 (입고 시 생성/증가)' : 'LOT (선택)'}
                {isRawIn ? (
                  <>
                    <input
                      className="mesInput mono"
                      value={materialLotNo}
                      onChange={(ev) => setMaterialLotNo(ev.target.value)}
                      placeholder="예: ML-2026-0001"
                      list="mes-material-lot-suggest"
                      disabled={!selectedProductId}
                    />
                    <datalist id="mes-material-lot-suggest">
                      {lotChoices.map((l) => (
                        <option key={l.key} value={l.lotNo} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <select className="mesInput" value={lotChoice} onChange={(ev) => setLotChoice(ev.target.value)} disabled={!selectedProductId}>
                    <option value="">미지정 (품목 재고)</option>
                    {lotChoices.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.kind === 'P' ? '[생산LOT]' : '[자재LOT]'} {l.lotNo}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <div className="mesFieldRow" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
              <label className="mesLabel">
                구분
                <select className="mesInput" value={movementType} onChange={(ev) => setMovementType(ev.target.value as MovementType)}>
                  <option value="IN">입고</option>
                  <option value="OUT">출고</option>
                </select>
              </label>
              <label className="mesLabel">
                수량
                <input className="mesInput" value={qty} onChange={(ev) => setQty(ev.target.value)} />
              </label>
              <label className="mesLabel">
                위치(선택)
                <select className="mesInput" value={locationId} onChange={(ev) => setLocationId(ev.target.value)}>
                  <option value="">미지정</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.locationCode} · {loc.locationName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mesLabel">
                비고(직접입력)
                <input
                  className="mesInput"
                  value={remark}
                  onChange={(ev) => setRemark(ev.target.value)}
                  placeholder="예: 긴급보충, 반품재고 재입고"
                />
              </label>
              <div className="mesLabel">
                <span>처리</span>
                <button type="button" className="mesBtnPrimary" disabled={saving || loading || !selectedProductId} onClick={() => void submitMovement()}>
                  {saving ? '처리 중…' : movementType === 'IN' ? '입고 등록' : '출고 등록'}
                </button>
              </div>
            </div>
          </div>

          <aside className="mesCard mesCardNarrow" style={{ margin: 0 }}>
            <div className="mesCardTitle">품목 재고 요약</div>
            <table className="mesTable">
              <tbody>
                <tr>
                  <th>품목</th>
                  <td>{selectedProduct ? `${selectedProduct.productCode} · ${selectedProduct.productName}` : '—'}</td>
                </tr>
                <tr>
                  <th>재고합계</th>
                  <td>{productTotalQty}</td>
                </tr>
                <tr>
                  <th>가용재고</th>
                  <td>{productAvailQty}</td>
                </tr>
                <tr>
                  <th>LOT행 수</th>
                  <td>{productInvRows.length}</td>
                </tr>
              </tbody>
            </table>
          </aside>
        </div>
      </section>

      <section className="mesCard" style={{ marginTop: 12 }}>
        <div className="mesCardTitle">최근 입출고 이력</div>
        <div className="mesTableWrap mesTableScroll">
          <table className="mesTable">
            <thead>
              <tr>
                <th>일시</th>
                <th>구분</th>
                <th>품목</th>
                <th>수량</th>
                <th>비고</th>
                <th>전→후</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {!selectedProductId ? (
                <tr>
                  <td colSpan={7} className="muted">
                    품목을 선택하세요.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={7} className="muted">
                    로딩 중…
                  </td>
                </tr>
              ) : productTxRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    이력이 없습니다.
                  </td>
                </tr>
              ) : (
                productTxRows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted small">{fmtWhen(r.createdAt)}</td>
                    <td>{movementLabel(r.transactionType)}</td>
                    <td>{r.product ? `${r.product.productCode} · ${r.product.productName}` : `품목#${r.productId}`}</td>
                    <td>{r.qty}</td>
                    <td>{txRemark(r)}</td>
                    <td className="muted small">
                      {`${r.computedBeforeQty} → ${r.computedAfterQty}`}
                    </td>
                    <td className="mesTdActions">
                      <button
                        type="button"
                        className="mesBtnSm danger"
                        disabled={r.refType !== 'ADJUST'}
                        onClick={() => void removeMovement(r.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

