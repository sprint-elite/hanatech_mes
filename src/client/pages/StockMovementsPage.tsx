import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../stock-movements-page.css'
import { normalizeItemTypeToCode } from '../lib/itemType'

type ItemTypeCode = 'RAW' | 'WIP' | 'FG'
type MovementType = 'IN' | 'OUT'
type MovementFilter = 'ALL' | 'IN' | 'OUT'

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
  unitPrice: number | null
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

type Filters = { q: string; movement: MovementFilter }

const ITEM_TABS: { code: ItemTypeCode; label: string }[] = [
  { code: 'RAW', label: '원자재' },
  { code: 'WIP', label: '반제품' },
  { code: 'FG', label: '상품' },
]

const emptyFilters = (): Filters => ({ q: '', movement: 'ALL' })

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

const canEditUnitPrice = (r: InventoryTxRow) =>
  r.transactionType === 'IN' || (r.transactionType === 'OUT' && r.refType === 'ADJUST')

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

function matchesFilters(row: InventoryTxDisplayRow, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (q) {
    const hay = [
      txRemark(row),
      row.remark ?? '',
      row.product?.productCode ?? '',
      row.product?.productName ?? '',
      row.lot?.lotNo ?? '',
      row.materialLot?.lotNo ?? '',
      String(row.productId),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filters.movement !== 'ALL' && row.transactionType !== filters.movement) return false
  return true
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
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

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}

function IconArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}

function IconArrowUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function IconStack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
    </svg>
  )
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
  const [unitPrice, setUnitPrice] = useState<string>('')
  const [suggestedUnitPrice, setSuggestedUnitPrice] = useState<number | null>(null)
  const [remark, setRemark] = useState<string>('')

  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editingTx, setEditingTx] = useState<InventoryTxRow | null>(null)
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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

  useEffect(() => {
    if (movementType !== 'IN' || !selectedProductId) {
      setSuggestedUnitPrice(null)
      return
    }
    const pid = Number(selectedProductId)
    if (!Number.isFinite(pid) || pid < 1) return
    void apiJson<{ ok: boolean; suggestedUnitPrice: number | null }>(`/api/products/${pid}/inbound-unit-price`)
      .then((r) => setSuggestedUnitPrice(r.suggestedUnitPrice))
      .catch(() => setSuggestedUnitPrice(null))
  }, [movementType, selectedProductId])

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

  useEffect(() => {
    setPage(1)
  }, [selectedProductId])

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
      .map((r) => {
        const x = computed.get(r.id)
        return {
          ...r,
          computedBeforeQty: x?.before ?? 0,
          computedAfterQty: x?.after ?? 0,
        }
      })
  }, [txRows, selectedPid])

  const filteredTxRows = useMemo(
    () => productTxRows.filter((r) => matchesFilters(r, filters)),
    [productTxRows, filters],
  )

  const stats = useMemo(() => {
    let inCount = 0
    let outCount = 0
    let inQty = 0
    let outQty = 0
    for (const r of filteredTxRows) {
      if (r.transactionType === 'IN') {
        inCount += 1
        inQty += r.qty
      } else if (r.transactionType === 'OUT') {
        outCount += 1
        outQty += r.qty
      }
    }
    return { total: filteredTxRows.length, inCount, outCount, inQty, outQty }
  }, [filteredTxRows])

  const totalPages = Math.max(1, Math.ceil(filteredTxRows.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredTxRows.slice(start, start + pageSize)
  }, [filteredTxRows, page, pageSize])

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
          unitPrice: movementType === 'IN' && unitPrice.trim() !== '' ? Number(unitPrice) : undefined,
          remark: remark.trim() || undefined,
        }),
      })
      setOkMsg(`${movementType === 'IN' ? '입고' : '출고'} 처리 완료`)
      setQty('1')
      setUnitPrice('')
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

  const openEditUnitPrice = (row: InventoryTxRow) => {
    setEditingTx(row)
    setEditUnitPrice(row.unitPrice != null ? String(row.unitPrice) : '')
    setErr(null)
  }

  const closeEditUnitPrice = () => {
    if (editSaving) return
    setEditingTx(null)
    setEditUnitPrice('')
  }

  const saveEditUnitPrice = async () => {
    if (!editingTx) return
    const trimmed = editUnitPrice.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (!Number.isFinite(parsed) || (parsed as number) < 0)) {
      setErr('단가는 0 이상 숫자여야 합니다.')
      return
    }
    setEditSaving(true)
    setErr(null)
    try {
      await apiJson(`/api/transactions/stock-movements/${editingTx.id}/unit-price`, {
        method: 'PATCH',
        body: JSON.stringify({ unitPrice: parsed }),
      })
      setOkMsg('단가를 수정했습니다.')
      closeEditUnitPrice()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="mesPage mesPageWide mesSmPage">
      <header className="mesSmHead">
        <div className="mesSmHeadMain">
          <h1 className="mesSmTitle">입출고관리</h1>
          <p className="mesSmDesc">
            원자재·반제품·상품을 품목별로 선택해 LOT 선택(옵션) 방식으로 입고/출고를 입력합니다.
          </p>
        </div>
        <div className="mesSmHeadActions">
          <span className="mesSmCountBadge">{loading ? '…' : `${filteredTxRows.length}건`}</span>
          <button type="button" className="mesSmBtn mesSmBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesSmNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      {okMsg ? (
        <div className="mesSmOkNotice" role="status">
          {okMsg}
        </div>
      ) : null}

      <section className="mesSmFormCard">
        <div className="mesSmTabRow" role="tablist" aria-label="품목 유형">
          {ITEM_TABS.map((t) => (
            <button
              key={t.code}
              type="button"
              role="tab"
              aria-selected={itemType === t.code}
              className={`mesSmTab${itemType === t.code ? ' mesSmTab--active' : ''}`}
              onClick={() => setItemType(t.code)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mesSmFormGrid">
          <div className="mesSmFormMain">
            <div className="mesSmFormRow mesSmFormRow--2">
              <label className="mesSmField">
                <span className="mesSmFieldLabel">품목</span>
                <select className="mesSmSelect" value={selectedProductId} onChange={(ev) => setSelectedProductId(ev.target.value)}>
                  {tabProducts.length === 0 ? <option value="">선택 가능한 품목 없음</option> : null}
                  {tabProducts.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.productCode} · {p.productName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mesSmField">
                <span className="mesSmFieldLabel">{isRawIn ? '자재 LOT 번호 (입고 시 생성/증가)' : 'LOT (선택)'}</span>
                {isRawIn ? (
                  <>
                    <input
                      className="mesSmInput mono"
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
                  <select className="mesSmSelect" value={lotChoice} onChange={(ev) => setLotChoice(ev.target.value)} disabled={!selectedProductId}>
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

            <div className="mesSmFormRow mesSmFormRow--5">
              <label className="mesSmField">
                <span className="mesSmFieldLabel">구분</span>
                <select className="mesSmSelect" value={movementType} onChange={(ev) => setMovementType(ev.target.value as MovementType)}>
                  <option value="IN">입고</option>
                  <option value="OUT">출고</option>
                </select>
              </label>
              <label className="mesSmField">
                <span className="mesSmFieldLabel">수량</span>
                <input className="mesSmInput" value={qty} onChange={(ev) => setQty(ev.target.value)} />
              </label>
              {movementType === 'IN' ? (
                <label className="mesSmField">
                  <span className="mesSmFieldLabel">
                    입고 단가
                    {suggestedUnitPrice != null ? (
                      <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>
                        (비우면 {suggestedUnitPrice.toLocaleString('ko-KR')}원 자동)
                      </span>
                    ) : null}
                  </span>
                  <input
                    className="mesSmInput mono"
                    value={unitPrice}
                    placeholder={suggestedUnitPrice != null ? String(suggestedUnitPrice) : '입고 단가'}
                    onChange={(ev) => setUnitPrice(ev.target.value)}
                  />
                </label>
              ) : null}
              <label className="mesSmField">
                <span className="mesSmFieldLabel">위치(선택)</span>
                <select className="mesSmSelect" value={locationId} onChange={(ev) => setLocationId(ev.target.value)}>
                  <option value="">미지정</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.locationCode} · {loc.locationName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mesSmField">
                <span className="mesSmFieldLabel">비고(직접입력)</span>
                <input
                  className="mesSmInput"
                  value={remark}
                  onChange={(ev) => setRemark(ev.target.value)}
                  placeholder="예: 긴급보충, 반품재고 재입고"
                />
              </label>
              <div className="mesSmField mesSmField--submit">
                <span className="mesSmFieldLabel">처리</span>
                <button
                  type="button"
                  className="mesSmBtn mesSmBtn--primary"
                  disabled={saving || loading || !selectedProductId}
                  onClick={() => void submitMovement()}
                >
                  {saving ? '처리 중…' : movementType === 'IN' ? '입고 등록' : '출고 등록'}
                </button>
              </div>
            </div>
          </div>

          <aside className="mesSmSideCard">
            <h2 className="mesSmSideTitle">품목 재고 요약</h2>
            <table className="mesSmSideTable">
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

      <div className="mesSmFilterCard">
        <div className="mesSmField mesSmField--search">
          <span className="mesSmFieldLabel">검색</span>
          <div className="mesSmInputWrap">
            <span className="mesSmInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesSmInput mesSmInput--search"
              placeholder="비고 / 품목 / LOT 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesSmField mesSmField--select">
          <span className="mesSmFieldLabel">구분</span>
          <select
            className="mesSmSelect"
            value={draftFilters.movement}
            onChange={(ev) => setDraftFilters((f) => ({ ...f, movement: ev.target.value as MovementFilter }))}
            aria-label="입출고 구분 필터"
          >
            <option value="ALL">전체</option>
            <option value="IN">입고</option>
            <option value="OUT">출고</option>
          </select>
        </div>
        <div className="mesSmFilterActions">
          <button type="button" className="mesSmBtn mesSmBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesSmBtn mesSmBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesSmStatsStrip" aria-label="선택 품목 입출고 요약">
        <div className="mesSmStatItem">
          <div className="mesSmStatIcon mesSmStatIcon--gold">
            <IconClipboard />
          </div>
          <div className="mesSmStatMeta">
            <p className="mesSmStatLabel">전체</p>
            <p className="mesSmStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesSmStatValueNum">{stats.total}</span>
                  <span className="mesSmStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesSmStatItem">
          <div className="mesSmStatIcon mesSmStatIcon--green">
            <IconArrowDown />
          </div>
          <div className="mesSmStatMeta">
            <p className="mesSmStatLabel">입고 건수</p>
            <p className="mesSmStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesSmStatValueNum">{stats.inCount}</span>
                  <span className="mesSmStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesSmStatItem">
          <div className="mesSmStatIcon mesSmStatIcon--orange">
            <IconArrowUp />
          </div>
          <div className="mesSmStatMeta">
            <p className="mesSmStatLabel">출고 건수</p>
            <p className="mesSmStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesSmStatValueNum">{stats.outCount}</span>
                  <span className="mesSmStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesSmStatItem">
          <div className="mesSmStatIcon mesSmStatIcon--green">
            <IconStack />
          </div>
          <div className="mesSmStatMeta">
            <p className="mesSmStatLabel">입고 수량합</p>
            <p className="mesSmStatValue">
              {loading ? (
                '…'
              ) : (
                <span className="mesSmStatValueNum">{stats.inQty.toLocaleString()}</span>
              )}
            </p>
          </div>
        </div>
        <div className="mesSmStatItem">
          <div className="mesSmStatIcon mesSmStatIcon--orange">
            <IconStack />
          </div>
          <div className="mesSmStatMeta">
            <p className="mesSmStatLabel">출고 수량합</p>
            <p className="mesSmStatValue">
              {loading ? (
                '…'
              ) : (
                <span className="mesSmStatValueNum">{stats.outQty.toLocaleString()}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <section className="mesSmTableCard">
        <div className="mesSmTableHead">
          <h2 className="mesSmTableTitle">최근 입출고 이력</h2>
        </div>
        <div className="mesSmTableViewport">
          <table className="mesSmTable">
            <thead>
              <tr>
                <th>일시</th>
                <th>구분</th>
                <th>품목</th>
                <th>수량</th>
                <th>단가</th>
                <th>비고</th>
                <th>전→후</th>
                <th className="mesSmThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {!selectedProductId ? (
                <tr>
                  <td colSpan={8} className="mesSmEmpty">
                    품목을 선택하세요.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={8} className="mesSmEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredTxRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="mesSmEmpty">
                    {productTxRows.length === 0 ? '이력이 없습니다.' : '필터 조건에 맞는 이력이 없습니다.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="muted small">{fmtWhen(r.createdAt)}</td>
                    <td>
                      <span
                        className={`mesSmMoveBadge ${
                          r.transactionType === 'IN' ? 'mesSmMoveBadge--in' : 'mesSmMoveBadge--out'
                        }`}
                      >
                        {movementLabel(r.transactionType)}
                      </span>
                    </td>
                    <td>{r.product ? `${r.product.productCode} · ${r.product.productName}` : `품목#${r.productId}`}</td>
                    <td>{r.qty}</td>
                    <td className="mono">{r.unitPrice != null ? Number(r.unitPrice).toLocaleString('ko-KR') : '—'}</td>
                    <td>{txRemark(r)}</td>
                    <td className="muted small mono">
                      {`${r.computedBeforeQty} → ${r.computedAfterQty}`}
                    </td>
                    <td className="mesSmTdActions">
                      <div className="mesSmActionGroup">
                        {canEditUnitPrice(r) ? (
                          <button
                            type="button"
                            className="mesSmBtn mesSmBtn--edit"
                            onClick={() => openEditUnitPrice(r)}
                          >
                            <IconPencil />
                            단가
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="mesSmBtn mesSmBtn--danger"
                          disabled={r.refType !== 'ADJUST'}
                          onClick={() => void removeMovement(r.id)}
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

        <footer className="mesSmPager">
          <span className="mesSmPagerTotal">전체 {filteredTxRows.length}건</span>
          <nav className="mesSmPagerNav" aria-label="페이지">
            <button type="button" className="mesSmPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesSmPagerBtn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1]
                const showEllipsis = prev != null && n - prev > 1
                return (
                  <span key={n} style={{ display: 'contents' }}>
                    {showEllipsis ? (
                      <span className="mesSmPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesSmPagerBtn${n === page ? ' mesSmPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesSmPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesSmPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesSmPageSize">
            <select
              value={pageSize}
              onChange={(ev) => {
                setPageSize(Number(ev.target.value))
                setPage(1)
              }}
              aria-label="페이지당 표시 건수"
            >
              <option value={10}>10개씩 보기</option>
              <option value={20}>20개씩 보기</option>
              <option value={50}>50개씩 보기</option>
            </select>
          </div>
        </footer>
      </section>

      {editingTx ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeEditUnitPrice} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-sm-unit-price-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-sm-unit-price-title">
                  입출고 단가 수정
                </h2>
                <div className="mesModalMeta muted">
                  {movementLabel(editingTx.transactionType)} ·{' '}
                  {editingTx.product
                    ? `${editingTx.product.productCode} · ${editingTx.product.productName}`
                    : `품목#${editingTx.productId}`}{' '}
                  · 수량 {editingTx.qty}
                </div>
              </div>
            </div>
            <div className="mesModalBody">
              <label className="mesLabel">
                단가 (원)
                <input
                  className="mesInput mono"
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(e.target.value)}
                  placeholder="비우면 단가 없음"
                  autoFocus
                />
              </label>
              {editingTx.transactionType === 'IN' ? (
                <p className="muted mesSmEditHint">
                  입고 단가 수정 시 자재 LOT·품목 평균 입고단가가 함께 갱신됩니다.
                </p>
              ) : null}
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={editSaving} onClick={closeEditUnitPrice}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={editSaving} onClick={() => void saveEditUnitPrice()}>
                {editSaving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
