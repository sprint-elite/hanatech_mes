import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import { itemTypeLabel } from '../lib/itemType'

type ProductRef = {
  id: number
  productCode: string
  productName: string
  itemType: string
  unit: string
  safetyStock: number | null
  /** 1박스당 기준수량(EA 등). 품목 마스터 `standard_pack_qty` */
  standardPackQty?: number | null
}
type PlanStatus = 'PLANNED' | 'CONFIRMED' | 'CLOSED'
type WorkOrderStatus = 'READY' | 'IN_PROGRESS' | 'DONE' | 'HOLD'
type LotStatus = 'CREATED' | 'IN_PROGRESS' | 'DONE' | 'OUTSOURCING'

type PlanRow = {
  id: number
  planNo: string
  productId: number
  planQty: number
  startDate: string
  endDate: string
  status: PlanStatus
  product?: { productCode: string; productName: string }
}
type WorkOrderRow = {
  id: number
  woNo: string
  planId: number | null
  productId: number
  workCenterId?: number | null
  orderQty: number
  completedQty: number
  status: WorkOrderStatus
  holdReason?: string | null
  product?: { productCode: string; productName: string }
  workCenter?: { centerCode: string; centerName: string } | null
  assignedWorkers?: { worker: { id: number; workerCode: string; workerName: string } }[]
}
type LotRow = {
  id: number
  lotNo: string
  woId: number | null
  productId: number
  lotQty: number
  goodQty: number
  defectQty: number
  status: LotStatus
}
type InventoryRow = {
  id: number
  productId: number
  lotId: number | null
  materialLotId?: number | null
  qty: number
  reservedQty: number
  status: string
  product?: { productCode: string; productName: string }
  lot?: { lotNo: string } | null
  materialLot?: { lotNo: string } | null
}

type InventoryTxType = 'IN' | 'OUT' | 'MOVE' | 'ADJUST'
type InventoryTxRow = {
  id: number
  productId: number
  lotId: number | null
  materialLotId: number | null
  locationId: number | null
  transactionType: InventoryTxType
  qty: number
  refType: string | null
  refId: number | null
  fromLocationId: number | null
  toLocationId: number | null
  beforeQty: number | null
  afterQty: number | null
  remark: string | null
  createdAt: string
  product?: { productCode: string; productName: string }
  lot?: { lotNo: string } | null
  materialLot?: { lotNo: string } | null
  location?: { locationCode: string; locationName: string } | null
  fromLocation?: { locationCode: string; locationName: string } | null
  toLocation?: { locationCode: string; locationName: string } | null
}

type WorkCenterRef = { id: number; centerCode: string; centerName: string }
type WorkerRef = { id: number; workerCode: string; workerName: string; status: string }

type PlanForm = { planNo: string; productId: string; planQty: string; startDate: string; endDate: string; status: PlanStatus }
type WoForm = {
  woNo: string
  planId: string
  workCenterId: string
  workerIds: number[]
  orderQty: string
  status: WorkOrderStatus
  holdReason: string
}
type LotForm = { lotNo: string; woId: string; lotQty: string; status: LotStatus }

const planStatuses: PlanStatus[] = ['PLANNED', 'CONFIRMED', 'CLOSED']
const woStatuses: WorkOrderStatus[] = ['READY', 'IN_PROGRESS', 'DONE', 'HOLD']
const lotStatuses: LotStatus[] = ['CREATED', 'IN_PROGRESS', 'DONE', 'OUTSOURCING']

const woStatusLabel = (s: WorkOrderStatus) => {
  if (s === 'READY') return '대기'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'HOLD') return '보류'
  return s
}

const planStatusLabel = (s: PlanStatus) => {
  if (s === 'PLANNED') return '계획'
  if (s === 'CONFIRMED') return '확정'
  if (s === 'CLOSED') return '마감'
  return s
}

const lotStatusLabel = (s: LotStatus) => {
  if (s === 'CREATED') return '생성'
  if (s === 'IN_PROGRESS') return '진행'
  if (s === 'DONE') return '완료'
  if (s === 'OUTSOURCING') return '외주'
  return s
}

/** LOT수량 − (양품+불량) */
const lotRemainingWorkDisplay = (r: Pick<LotRow, 'lotQty' | 'goodQty' | 'defectQty'>) =>
  r.lotQty - r.goodQty - r.defectQty

const invTxTypeLabel = (t: InventoryTxType) => {
  if (t === 'IN') return '입고'
  if (t === 'OUT') return '출고'
  if (t === 'MOVE') return '이동'
  if (t === 'ADJUST') return '조정'
  return t
}

const formatInvTxWhen = (iso: string) => {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function invTxLotLabel(r: InventoryTxRow) {
  if (r.lot?.lotNo) return r.lot.lotNo
  if (r.materialLot?.lotNo) return r.materialLot.lotNo
  return '—'
}

function invTxLocLabel(r: InventoryTxRow) {
  if (r.transactionType === 'MOVE') {
    const a = r.fromLocation?.locationCode ?? '—'
    const b = r.toLocation?.locationCode ?? '—'
    return `${a} → ${b}`
  }
  return r.location?.locationCode ?? '—'
}

function invTxProductNameCell(r: InventoryTxRow) {
  return r.product?.productName ?? `품목#${r.productId}`
}

/** 계획수량과 품목 `standardPackQty`(1박스 입수)로 요약 문자열 생성. 예: 126 (1box), 252 (2box) */
function formatPlanQtyWithPacking(planQtyStr: string, product: ProductRef | null): string {
  const raw = planQtyStr.trim()
  if (raw === '') return '—'
  const qty = Number(raw)
  if (!Number.isFinite(qty) || qty < 0) return '—'
  const unit = product?.unit?.trim() ?? ''
  const pack = product?.standardPackQty
  if (pack == null || !Number.isInteger(pack) || pack < 1) {
    return unit ? `${qty} ${unit}` : String(qty)
  }
  const full = Math.floor(qty / pack)
  const rem = qty % pack
  if (rem === 0) return `${qty} (${full}box)`
  const remPart = unit ? `${rem} ${unit}` : String(rem)
  return `${qty} (${full}box + ${remPart})`
}

const toggleId = (ids: number[], id: number) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])

function woLotAllocatedQty(allLots: LotRow[], woId: number, excludeLotId?: number) {
  return allLots
    .filter((l) => l.woId === woId && (excludeLotId == null || l.id !== excludeLotId))
    .reduce((s, l) => s + l.lotQty, 0)
}

function woLotRemainingAlloc(allLots: LotRow[], wo: { id: number; orderQty: number }, excludeLotId?: number) {
  return Math.max(0, wo.orderQty - woLotAllocatedQty(allLots, wo.id, excludeLotId))
}

function woLotCount(allLots: LotRow[], woId: number) {
  return allLots.filter((l) => l.woId === woId).length
}

const PAGE_SIZE = 12
const INV_TX_PAGE_SIZE = 15

function totalPagesCount(length: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, length) / pageSize))
}

function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  const tp = totalPagesCount(items.length, pageSize)
  const p = Math.min(Math.max(1, page), tp)
  const start = (p - 1) * pageSize
  return items.slice(start, start + pageSize)
}

function filterProductsForPlanTabList(
  list: ProductRef[],
  planProductTypeFilter: string,
  planProductQuery: string,
): ProductRef[] {
  const q = planProductQuery.trim().toLowerCase()
  return list.filter((p) => {
    if (planProductTypeFilter && p.itemType !== planProductTypeFilter) return false
    if (!q) return true
    const hay = `${p.productCode} ${p.productName} ${p.itemType} ${itemTypeLabel(p.itemType)}`.toLowerCase()
    return hay.includes(q)
  })
}

function PaginationBar(props: {
  page: number
  total: number
  pageSize: number
  onPageChange: (p: number) => void
  className?: string
}) {
  const { page, total, pageSize, onPageChange, className } = props
  const tp = totalPagesCount(total, pageSize)
  const p = Math.min(Math.max(1, page), tp)
  if (total === 0) {
    return <div className={`mesOpsPagination ${className ?? ''}`}><span className="muted small">0건</span></div>
  }
  const start = (p - 1) * pageSize + 1
  const end = Math.min(p * pageSize, total)
  return (
    <div className={`mesOpsPagination ${className ?? ''}`}>
      <span className="muted small">
        {total}건 · {start}–{end} · {p}/{tp}페이지
      </span>
      <div className="mesOpsPaginationBtns">
        <button type="button" className="mesBtnSm" disabled={p <= 1} onClick={() => onPageChange(1)}>
          처음
        </button>
        <button type="button" className="mesBtnSm" disabled={p <= 1} onClick={() => onPageChange(p - 1)}>
          이전
        </button>
        <button type="button" className="mesBtnSm" disabled={p >= tp} onClick={() => onPageChange(p + 1)}>
          다음
        </button>
        <button type="button" className="mesBtnSm" disabled={p >= tp} onClick={() => onPageChange(tp)}>
          끝
        </button>
      </div>
    </div>
  )
}

type OpsTab = 'plans' | 'workOrders' | 'lots' | 'inventory'

export function IntegratedOpsPage() {
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<OpsTab>('plans')
  const [planTabProductId, setPlanTabProductId] = useState('')
  const [planProductQuery, setPlanProductQuery] = useState('')
  const [planProductTypeFilter, setPlanProductTypeFilter] = useState('')
  const [products, setProducts] = useState<ProductRef[]>([])
  const [workCenters, setWorkCenters] = useState<WorkCenterRef[]>([])
  const [workers, setWorkers] = useState<WorkerRef[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [lots, setLots] = useState<LotRow[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [invTransactions, setInvTransactions] = useState<InventoryTxRow[]>([])
  const [invSummaryPage, setInvSummaryPage] = useState(1)
  const [invInPage, setInvInPage] = useState(1)
  const [invOutPage, setInvOutPage] = useState(1)
  const [selectedProductId, setSelectedProductId] = useState('')

  const [planPanel, setPlanPanel] = useState(false)
  const [woPanel, setWoPanel] = useState(false)
  const [lotPanel, setLotPanel] = useState(false)
  const [lotAllocNoticeOpen, setLotAllocNoticeOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)
  const [editingWoId, setEditingWoId] = useState<number | null>(null)
  const [editingLotId, setEditingLotId] = useState<number | null>(null)

  const [planForm, setPlanForm] = useState<PlanForm>({ planNo: '', productId: '', planQty: '1', startDate: '', endDate: '', status: 'PLANNED' })
  const [woForm, setWoForm] = useState<WoForm>({
    woNo: '',
    planId: '',
    workCenterId: '',
    workerIds: [],
    orderQty: '1',
    status: 'READY',
    holdReason: '',
  })
  const [lotForm, setLotForm] = useState<LotForm>({ lotNo: '', woId: '', lotQty: '1', status: 'CREATED' })
  const [woWorkerQuery, setWoWorkerQuery] = useState('')
  const [woOnlyActive, setWoOnlyActive] = useState(true)

  const [planProductListPage, setPlanProductListPage] = useState(1)
  const [planTableQuery, setPlanTableQuery] = useState('')
  const [planTableStatusFilter, setPlanTableStatusFilter] = useState<PlanStatus | ''>('')
  const [planTablePage, setPlanTablePage] = useState(1)

  const [woTabPlanId, setWoTabPlanId] = useState('')
  const [woPlanQuery, setWoPlanQuery] = useState('')
  const [woPlanStatusFilter, setWoPlanStatusFilter] = useState<PlanStatus | ''>('')
  const [woPlanListPage, setWoPlanListPage] = useState(1)
  const [woTableQuery, setWoTableQuery] = useState('')
  const [woTableStatusFilter, setWoTableStatusFilter] = useState<WorkOrderStatus | ''>('')
  const [woTablePage, setWoTablePage] = useState(1)

  const [lotTabWoId, setLotTabWoId] = useState('')
  const [lotWoListQuery, setLotWoListQuery] = useState('')
  const [lotWoListStatusFilter, setLotWoListStatusFilter] = useState<WorkOrderStatus | ''>('')
  const [lotWoListPage, setLotWoListPage] = useState(1)
  const [lotTableQuery, setLotTableQuery] = useState('')
  const [lotTableStatusFilter, setLotTableStatusFilter] = useState<LotStatus | ''>('')
  const [lotTablePage, setLotTablePage] = useState(1)

  const [invTabProductId, setInvTabProductId] = useState('')
  const [invProductQuery, setInvProductQuery] = useState('')
  const [invProductTypeFilter, setInvProductTypeFilter] = useState('')
  const [invProductListPage, setInvProductListPage] = useState(1)
  const [invShowZeroAvailLots, setInvShowZeroAvailLots] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, wc, wk, pp, wo, lt, inv, invTx] = await Promise.all([
        apiJson<{ ok: boolean; items: ProductRef[] }>('/api/products'),
        apiJson<{ ok: boolean; items: WorkCenterRef[] }>('/api/work-centers'),
        apiJson<{ ok: boolean; items: WorkerRef[] }>('/api/workers'),
        apiJson<{ ok: boolean; items: PlanRow[] }>('/api/production-plans'),
        apiJson<{ ok: boolean; items: WorkOrderRow[] }>('/api/work-orders'),
        apiJson<{ ok: boolean; items: LotRow[] }>('/api/lots'),
        apiJson<{ ok: boolean; items: InventoryRow[] }>('/api/inventory'),
        apiJson<{ ok: boolean; items: InventoryTxRow[] }>('/api/inventory-transactions?limit=600'),
      ])
      const sortedProducts = [...p.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko'))
      setProducts(sortedProducts)
      setWorkCenters([...wc.items].sort((a, b) => a.centerCode.localeCompare(b.centerCode, 'ko')))
      setWorkers([...wk.items].sort((a, b) => a.workerCode.localeCompare(b.workerCode, 'ko')))
      setSelectedProductId((prev) => prev || (sortedProducts[0] ? String(sortedProducts[0].id) : ''))
      setPlanTabProductId((prev) => prev || (sortedProducts[0] ? String(sortedProducts[0].id) : ''))
      setInvTabProductId((prev) => prev || (sortedProducts[0] ? String(sortedProducts[0].id) : ''))
      setPlans(pp.items)
      setWorkOrders(wo.items)
      setLots(lt.items)
      setInventory(inv.items)
      setInvTransactions(invTx.items)
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

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null
    return products.find((x) => x.id === Number(selectedProductId)) ?? null
  }, [products, selectedProductId])

  const planTabProduct = useMemo(() => {
    if (!planTabProductId) return null
    return products.find((x) => x.id === Number(planTabProductId)) ?? null
  }, [products, planTabProductId])

  const invTabProduct = useMemo(() => {
    if (!invTabProductId) return null
    return products.find((x) => x.id === Number(invTabProductId)) ?? null
  }, [products, invTabProductId])

  const plansForPlanTab = useMemo(() => {
    if (!planTabProductId) return []
    const pid = Number(planTabProductId)
    if (!Number.isInteger(pid) || pid < 1) return []
    return plans.filter((p) => p.productId === pid).sort((a, b) => b.id - a.id)
  }, [plans, planTabProductId])

  const planProductItemTypes = useMemo(() => {
    const s = new Set<string>()
    for (const p of products) {
      if (p.itemType?.trim()) s.add(p.itemType.trim())
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [products])

  const planTabFilteredProducts = useMemo(
    () => filterProductsForPlanTabList(products, planProductTypeFilter, planProductQuery),
    [products, planProductTypeFilter, planProductQuery],
  )

  const invTabFilteredProducts = useMemo(
    () => filterProductsForPlanTabList(products, invProductTypeFilter, invProductQuery),
    [products, invProductTypeFilter, invProductQuery],
  )

  const invProductListPages = totalPagesCount(invTabFilteredProducts.length, PAGE_SIZE)
  const invProductListSafePage = Math.min(Math.max(1, invProductListPage), invProductListPages)
  const invProductsPageSlice = useMemo(
    () => slicePage(invTabFilteredProducts, invProductListSafePage, PAGE_SIZE),
    [invTabFilteredProducts, invProductListSafePage],
  )

  const workerNamesShort = (r: WorkOrderRow) => {
    const list = r.assignedWorkers ?? []
    if (list.length === 0) return '—'
    return list.map((a) => a.worker.workerName).join(', ')
  }

  /** 계획별: 연결 작업지시 LOT들의 양품(goodQty) 합계 (작업지시.planId → LOT.woId) */
  const planConsumedGoodQtyByPlanId = useMemo(() => {
    const woToPlan = new Map<number, number | null>()
    for (const w of workOrders) {
      woToPlan.set(w.id, w.planId)
    }
    const sumByPlan = new Map<number, number>()
    for (const lot of lots) {
      const wid = lot.woId
      if (wid == null) continue
      const planId = woToPlan.get(wid)
      if (planId == null || !Number.isInteger(planId) || planId < 1) continue
      const g = Number.isFinite(lot.goodQty) ? lot.goodQty : 0
      sumByPlan.set(planId, (sumByPlan.get(planId) ?? 0) + g)
    }
    return sumByPlan
  }, [workOrders, lots])

  const plansForPlanTabFiltered = useMemo(() => {
    let rows = plansForPlanTab
    if (planTableStatusFilter) rows = rows.filter((r) => r.status === planTableStatusFilter)
    const q = planTableQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const consumed = planConsumedGoodQtyByPlanId.get(r.id) ?? 0
        const rem = r.planQty - consumed
        const hay = `${r.planNo} ${r.planQty} ${rem} ${String(r.startDate).slice(0, 10)} ${String(r.endDate).slice(0, 10)} ${planStatusLabel(r.status)}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows
  }, [plansForPlanTab, planTableQuery, planTableStatusFilter, planConsumedGoodQtyByPlanId])

  const planProductListPages = totalPagesCount(planTabFilteredProducts.length, PAGE_SIZE)
  const planProductListSafePage = Math.min(Math.max(1, planProductListPage), planProductListPages)
  const planProductsPageSlice = useMemo(
    () => slicePage(planTabFilteredProducts, planProductListSafePage, PAGE_SIZE),
    [planTabFilteredProducts, planProductListSafePage],
  )

  const planTablePages = totalPagesCount(plansForPlanTabFiltered.length, PAGE_SIZE)
  const planTableSafePage = Math.min(Math.max(1, planTablePage), planTablePages)
  const plansTablePageSlice = useMemo(
    () => slicePage(plansForPlanTabFiltered, planTableSafePage, PAGE_SIZE),
    [plansForPlanTabFiltered, planTableSafePage],
  )

  const woPlansBaseSorted = useMemo(() => [...plans].sort((a, b) => b.id - a.id), [plans])

  const woTabPlansFiltered = useMemo(() => {
    let rows = woPlansBaseSorted
    if (woPlanStatusFilter) rows = rows.filter((r) => r.status === woPlanStatusFilter)
    const q = woPlanQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const prod = r.product ? `${r.product.productCode} ${r.product.productName}` : `품목#${r.productId}`
        const hay = `${r.planNo} ${r.planQty} ${prod} ${planStatusLabel(r.status)}`.toLowerCase()
        return hay.includes(q)
      })
    }
    const selId = Number(woTabPlanId)
    if (Number.isInteger(selId) && selId >= 1) {
      const sel = plans.find((p) => p.id === selId)
      if (sel && !rows.some((r) => r.id === sel.id)) {
        rows = [sel, ...rows]
      }
    }
    return rows
  }, [woPlansBaseSorted, woPlanQuery, woPlanStatusFilter, woTabPlanId, plans])

  const woPlanListPages = totalPagesCount(woTabPlansFiltered.length, PAGE_SIZE)
  const woPlanListSafePage = Math.min(Math.max(1, woPlanListPage), woPlanListPages)
  const woPlansPageSlice = useMemo(
    () => slicePage(woTabPlansFiltered, woPlanListSafePage, PAGE_SIZE),
    [woTabPlansFiltered, woPlanListSafePage],
  )

  const woTabSelectedPlan = useMemo(() => {
    const id = Number(woTabPlanId)
    if (!Number.isInteger(id) || id < 1) return null
    return plans.find((p) => p.id === id) ?? null
  }, [woTabPlanId, plans])

  const woTabSummaryProduct = useMemo(() => {
    if (!woTabSelectedPlan) return null
    return products.find((p) => p.id === woTabSelectedPlan.productId) ?? null
  }, [woTabSelectedPlan, products])

  const workOrdersForWoTab = useMemo(() => {
    const pid = Number(woTabPlanId)
    if (!Number.isInteger(pid) || pid < 1) return []
    return workOrders.filter((w) => w.planId === pid).sort((a, b) => b.id - a.id)
  }, [workOrders, woTabPlanId])

  const woTabKpi = useMemo(() => {
    if (!woTabPlanId || workOrdersForWoTab.length === 0) return null
    const orderQty = workOrdersForWoTab.reduce((s, w) => s + w.orderQty, 0)
    const woIds = new Set(workOrdersForWoTab.map((w) => w.id))
    let good = 0
    let defect = 0
    for (const l of lots) {
      if (l.woId != null && woIds.has(l.woId)) {
        good += l.goodQty
        defect += l.defectQty
      }
    }
    const worked = good + defect
    const defectRate = worked > 0 ? Math.round((defect / worked) * 1000) / 10 : 0
    return { orderQty, worked, defect, defectRate }
  }, [woTabPlanId, workOrdersForWoTab, lots])

  const woTableFiltered = useMemo(() => {
    let rows = workOrdersForWoTab
    if (woTableStatusFilter) rows = rows.filter((w) => w.status === woTableStatusFilter)
    const q = woTableQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((w) => {
        const workers = workerNamesShort(w)
        const wc = w.workCenter ? `${w.workCenter.centerCode} ${w.workCenter.centerName}` : ''
        const prod = w.product ? `${w.product.productCode} ${w.product.productName}` : `품목#${w.productId}`
        const hay = `${w.woNo} ${prod} ${wc} ${workers} ${w.orderQty} ${woStatusLabel(w.status)}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows
  }, [workOrdersForWoTab, woTableQuery, woTableStatusFilter])

  const woTablePages = totalPagesCount(woTableFiltered.length, PAGE_SIZE)
  const woTableSafePage = Math.min(Math.max(1, woTablePage), woTablePages)
  const woTablePageSlice = useMemo(
    () => slicePage(woTableFiltered, woTableSafePage, PAGE_SIZE),
    [woTableFiltered, woTableSafePage],
  )

  const lotWoListBaseSorted = useMemo(() => [...workOrders].sort((a, b) => b.id - a.id), [workOrders])

  const lotTabWorkOrdersFiltered = useMemo(() => {
    let rows = lotWoListBaseSorted
    if (lotWoListStatusFilter) rows = rows.filter((w) => w.status === lotWoListStatusFilter)
    const q = lotWoListQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((w) => {
        const plan = w.planId != null ? plans.find((p) => p.id === w.planId) : null
        const planStr = plan ? plan.planNo : ''
        const prod = w.product ? `${w.product.productCode} ${w.product.productName}` : `품목#${w.productId}`
        const wc = w.workCenter ? `${w.workCenter.centerCode} ${w.workCenter.centerName}` : ''
        const workers = workerNamesShort(w)
        const hay = `${w.woNo} ${prod} ${wc} ${workers} ${planStr} ${woStatusLabel(w.status)}`.toLowerCase()
        return hay.includes(q)
      })
    }
    const selId = Number(lotTabWoId)
    if (Number.isInteger(selId) && selId >= 1) {
      const sel = workOrders.find((w) => w.id === selId)
      if (sel && !rows.some((r) => r.id === sel.id)) {
        rows = [sel, ...rows]
      }
    }
    return rows
  }, [lotWoListBaseSorted, lotWoListQuery, lotWoListStatusFilter, lotTabWoId, workOrders, plans])

  const lotWoListPages = totalPagesCount(lotTabWorkOrdersFiltered.length, PAGE_SIZE)
  const lotWoListSafePage = Math.min(Math.max(1, lotWoListPage), lotWoListPages)
  const lotWoListPageSlice = useMemo(
    () => slicePage(lotTabWorkOrdersFiltered, lotWoListSafePage, PAGE_SIZE),
    [lotTabWorkOrdersFiltered, lotWoListSafePage],
  )

  const lotTabSelectedWo = useMemo(() => {
    const id = Number(lotTabWoId)
    if (!Number.isInteger(id) || id < 1) return null
    return workOrders.find((w) => w.id === id) ?? null
  }, [lotTabWoId, workOrders])

  const lotTabSummaryProduct = useMemo(() => {
    if (!lotTabSelectedWo) return null
    return products.find((p) => p.id === lotTabSelectedWo.productId) ?? null
  }, [lotTabSelectedWo, products])

  const lotTabAllocation = useMemo(() => {
    if (!lotTabSelectedWo) return null
    const allocated = woLotAllocatedQty(lots, lotTabSelectedWo.id)
    const remain = woLotRemainingAlloc(lots, lotTabSelectedWo)
    const count = woLotCount(lots, lotTabSelectedWo.id)
    return { allocated, remain, count }
  }, [lotTabSelectedWo, lots])

  const editingWoLotAllocation = useMemo(() => {
    if (editingWoId == null) return null
    const wo = workOrders.find((w) => w.id === editingWoId)
    if (!wo) return null
    const allocated = woLotAllocatedQty(lots, wo.id)
    const remain = woLotRemainingAlloc(lots, wo)
    const count = woLotCount(lots, wo.id)
    return { allocated, remain, count, orderQty: wo.orderQty }
  }, [editingWoId, workOrders, lots])

  const lotFormAllocation = useMemo(() => {
    if (!lotForm.woId.trim()) return null
    const woId = Number(lotForm.woId)
    const wo = workOrders.find((w) => w.id === woId)
    if (!wo) return null
    const allocated = woLotAllocatedQty(lots, woId, editingLotId ?? undefined)
    const remain = woLotRemainingAlloc(lots, wo, editingLotId ?? undefined)
    return { wo, allocated, remain }
  }, [lotForm.woId, workOrders, lots, editingLotId])

  const lotsForLotTab = useMemo(() => {
    const wid = Number(lotTabWoId)
    if (!Number.isInteger(wid) || wid < 1) return []
    return lots.filter((l) => l.woId === wid).sort((a, b) => b.id - a.id)
  }, [lots, lotTabWoId])

  const lotTableFiltered = useMemo(() => {
    let rows = lotsForLotTab
    if (lotTableStatusFilter) rows = rows.filter((r) => r.status === lotTableStatusFilter)
    const q = lotTableQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const rem = lotRemainingWorkDisplay(r)
        const hay = `${r.lotNo} ${r.lotQty} ${r.goodQty} ${r.defectQty} ${rem} ${lotStatusLabel(r.status)}`.toLowerCase()
        return hay.includes(q)
      })
    }
    return rows
  }, [lotsForLotTab, lotTableQuery, lotTableStatusFilter])

  const lotTablePages = totalPagesCount(lotTableFiltered.length, PAGE_SIZE)
  const lotTableSafePage = Math.min(Math.max(1, lotTablePage), lotTablePages)
  const lotTablePageSlice = useMemo(
    () => slicePage(lotTableFiltered, lotTableSafePage, PAGE_SIZE),
    [lotTableFiltered, lotTableSafePage],
  )

  const summaryProduct = useMemo(() => {
    if (activeTab === 'plans') return planTabProduct
    if (activeTab === 'workOrders') return woTabSummaryProduct ?? selectedProduct
    if (activeTab === 'lots') return lotTabSummaryProduct
    if (activeTab === 'inventory') return invTabProduct
    return selectedProduct
  }, [activeTab, planTabProduct, woTabSummaryProduct, lotTabSummaryProduct, invTabProduct, selectedProduct])

  useEffect(() => {
    setPlanProductListPage(1)
  }, [planProductQuery, planProductTypeFilter])

  useEffect(() => {
    setInvProductListPage(1)
  }, [invProductQuery, invProductTypeFilter])

  useEffect(() => {
    if (!planTabProductId) return
    const list = filterProductsForPlanTabList(products, planProductTypeFilter, planProductQuery)
    const selId = Number(planTabProductId)
    if (Number.isInteger(selId) && selId >= 1 && list.some((p) => p.id === selId)) return
    const first = list[0]
    const next = first ? String(first.id) : ''
    setPlanTabProductId(next)
    setSelectedProductId(next)
  }, [planProductQuery, planProductTypeFilter, products, planTabProductId])

  useEffect(() => {
    setPlanTablePage(1)
  }, [planTabProductId, planTableQuery, planTableStatusFilter])

  useEffect(() => {
    setWoPlanListPage(1)
  }, [woPlanQuery, woPlanStatusFilter])

  useEffect(() => {
    setWoTablePage(1)
  }, [woTabPlanId, woTableQuery, woTableStatusFilter])

  useEffect(() => {
    setLotWoListPage(1)
  }, [lotWoListQuery, lotWoListStatusFilter])

  useEffect(() => {
    setLotTablePage(1)
  }, [lotTabWoId, lotTableQuery, lotTableStatusFilter])

  useEffect(() => {
    if (!invTabProductId) return
    const list = filterProductsForPlanTabList(products, invProductTypeFilter, invProductQuery)
    const selId = Number(invTabProductId)
    if (Number.isInteger(selId) && selId >= 1 && list.some((p) => p.id === selId)) return
    const first = list[0]
    setInvTabProductId(first ? String(first.id) : '')
  }, [invProductQuery, invProductTypeFilter, products, invTabProductId])

  useEffect(() => {
    setInvSummaryPage(1)
    setInvInPage(1)
    setInvOutPage(1)
  }, [invTabProductId])

  const filtered = useMemo(() => {
    if (!selectedProductId) return { plans, workOrders, lots, inventory }
    const pid = Number(selectedProductId)
    return {
      plans: plans.filter((x) => x.productId === pid),
      workOrders: workOrders.filter((x) => x.productId === pid),
      lots: lots.filter((x) => x.productId === pid),
      inventory: inventory.filter((x) => x.productId === pid),
    }
  }, [selectedProductId, plans, workOrders, lots, inventory])

  const invSummarySourceRows = useMemo(() => {
    if (activeTab === 'inventory') {
      const pid = Number(invTabProductId)
      if (!Number.isInteger(pid) || pid < 1) return []
      return inventory.filter((r) => r.productId === pid)
    }
    return filtered.inventory
  }, [activeTab, invTabProductId, inventory, filtered.inventory])

  const invSummary = useMemo(() => {
    const totalQty = invSummarySourceRows.reduce((s, r) => s + r.qty, 0)
    const totalReserved = invSummarySourceRows.reduce((s, r) => s + r.reservedQty, 0)
    return { totalQty, availableQty: totalQty - totalReserved }
  }, [invSummarySourceRows])

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  const selectedWoPlan = useMemo(() => {
    const id = Number(woForm.planId)
    if (!Number.isInteger(id) || id < 1) return null
    return plans.find((p) => p.id === id) ?? null
  }, [woForm.planId, plans])

  const selectedWoProduct = useMemo(() => {
    if (!selectedWoPlan) return null
    return products.find((p) => p.id === selectedWoPlan.productId) ?? null
  }, [selectedWoPlan, products])

  const selectedWoCenter = useMemo(() => {
    const id = Number(woForm.workCenterId)
    if (!Number.isInteger(id) || id < 1) return null
    return workCenters.find((w) => w.id === id) ?? null
  }, [woForm.workCenterId, workCenters])

  const selectedPlanProduct = useMemo(() => {
    const id = Number(planForm.productId)
    if (!Number.isInteger(id) || id < 1) return null
    return products.find((p) => p.id === id) ?? null
  }, [planForm.productId, products])

  const planModalQtyPackingLine = useMemo(
    () => formatPlanQtyWithPacking(planForm.planQty, selectedPlanProduct),
    [planForm.planQty, selectedPlanProduct],
  )

  const invTabInventoryRows = useMemo(() => {
    const pid = Number(invTabProductId)
    if (!Number.isInteger(pid) || pid < 1) return []
    const rows = inventory.filter((r) => r.productId === pid)
    return (invShowZeroAvailLots ? rows : rows.filter((r) => r.qty - r.reservedQty > 0)).sort((a, b) => b.id - a.id)
  }, [inventory, invTabProductId, invShowZeroAvailLots])

  const invStockRowsPages = totalPagesCount(invTabInventoryRows.length, PAGE_SIZE)
  const invStockRowsSafePage = Math.min(Math.max(1, invSummaryPage), invStockRowsPages)
  const invTabInventoryPageSlice = useMemo(
    () => slicePage(invTabInventoryRows, invStockRowsSafePage, PAGE_SIZE),
    [invTabInventoryRows, invStockRowsSafePage],
  )

  const invTxFiltered = useMemo(() => {
    const pid = Number(invTabProductId)
    if (!Number.isInteger(pid) || pid < 1) return []
    return invTransactions.filter((t) => t.productId === pid)
  }, [invTransactions, invTabProductId])

  const invTxInRows = useMemo(() => invTxFiltered.filter((x) => x.transactionType === 'IN'), [invTxFiltered])
  const invTxOutEtcRows = useMemo(() => invTxFiltered.filter((x) => x.transactionType !== 'IN'), [invTxFiltered])

  const invInPages = totalPagesCount(invTxInRows.length, INV_TX_PAGE_SIZE)
  const invInSafePage = Math.min(Math.max(1, invInPage), invInPages)
  const invTxInPageSlice = useMemo(
    () => slicePage(invTxInRows, invInSafePage, INV_TX_PAGE_SIZE),
    [invTxInRows, invInSafePage],
  )

  const invOutPages = totalPagesCount(invTxOutEtcRows.length, INV_TX_PAGE_SIZE)
  const invOutSafePage = Math.min(Math.max(1, invOutPage), invOutPages)
  const invTxOutPageSlice = useMemo(
    () => slicePage(invTxOutEtcRows, invOutSafePage, INV_TX_PAGE_SIZE),
    [invTxOutEtcRows, invOutSafePage],
  )

  const lotSelectableWorkOrders = useMemo(() => {
    const assignedWoIds = new Set(
      lots
        .filter((l) => l.woId != null && (editingLotId == null || l.id !== editingLotId))
        .map((l) => l.woId as number),
    )
    return filtered.workOrders.filter((w) => !assignedWoIds.has(w.id))
  }, [filtered.workOrders, lots, editingLotId])

  const selectedLotWorkOrder = useMemo(() => {
    const id = Number(lotForm.woId)
    if (!Number.isInteger(id) || id < 1) return null
    return workOrders.find((w) => w.id === id) ?? null
  }, [lotForm.woId, workOrders])

  const woSelectableWorkers = useMemo(() => {
    const q = woWorkerQuery.trim().toLowerCase()
    return workers
      .filter((w) => (!woOnlyActive ? true : w.status === 'ACTIVE'))
      .filter((w) => {
        if (!q) return true
        const text = `${w.workerCode} ${w.workerName}`.toLowerCase()
        return text.includes(q)
      })
  }, [workers, woOnlyActive, woWorkerQuery])

  const openPlanCreate = () => {
    setEditingPlanId(null)
    setPlanForm({
      planNo: '',
      productId: planTabProductId || selectedProductId || '',
      planQty: '1',
      startDate: '',
      endDate: '',
      status: 'PLANNED',
    })
    setPlanPanel(true)
  }
  const openPlanEdit = (r: PlanRow) => {
    setEditingPlanId(r.id)
    setPlanForm({
      planNo: r.planNo,
      productId: String(r.productId),
      planQty: String(r.planQty),
      startDate: String(r.startDate).slice(0, 10),
      endDate: String(r.endDate).slice(0, 10),
      status: r.status,
    })
    setPlanPanel(true)
  }
  const savePlan = async () => {
    const pid = Number(planForm.productId)
    const qty = Number(planForm.planQty)
    if (!Number.isInteger(pid) || !Number.isInteger(qty) || qty < 1 || !planForm.startDate || !planForm.endDate) {
      setErr('계획 입력값을 확인하세요.')
      return
    }
    setSaving(true)
    try {
      if (editingPlanId == null) {
        await apiJson('/api/production-plans', {
          method: 'POST',
          body: JSON.stringify({
            planNo: planForm.planNo.trim(),
            productId: pid,
            planQty: qty,
            startDate: planForm.startDate,
            endDate: planForm.endDate,
            status: planForm.status,
          }),
        })
      } else {
        await apiJson(`/api/production-plans/${editingPlanId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            productId: pid,
            planQty: qty,
            startDate: planForm.startDate,
            endDate: planForm.endDate,
            status: planForm.status,
          }),
        })
      }
      setPlanPanel(false)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }
  const removePlan = async (id: number) => {
    if (!confirm('생산계획을 삭제할까요?')) return
    try {
      await apiJson(`/api/production-plans/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const openWoCreate = () => {
    const pl = woTabPlanId.trim() !== '' ? plans.find((p) => p.id === Number(woTabPlanId)) : null
    const pq = pl?.planQty != null ? String(pl.planQty) : '1'
    setEditingWoId(null)
    setWoForm({
      woNo: '',
      planId: woTabPlanId.trim() !== '' ? woTabPlanId : '',
      workCenterId: '',
      workerIds: [],
      orderQty: pq,
      status: 'READY',
      holdReason: '',
    })
    setWoWorkerQuery('')
    setWoOnlyActive(true)
    setWoPanel(true)
  }
  const openWoEdit = (r: WorkOrderRow) => {
    setEditingWoId(r.id)
    setWoForm({
      woNo: r.woNo,
      planId: r.planId != null ? String(r.planId) : '',
      workCenterId: r.workCenterId != null ? String(r.workCenterId) : '',
      workerIds: (r.assignedWorkers ?? []).map((a) => a.worker.id),
      orderQty: String(r.orderQty),
      status: r.status,
      holdReason: r.holdReason ?? '',
    })
    setWoWorkerQuery('')
    setWoOnlyActive(false)
    setWoPanel(true)
  }
  const saveWo = async () => {
    const qty = Number(woForm.orderQty)
    const planId = woForm.planId.trim() === '' ? null : Number(woForm.planId)
    const workCenterId = woForm.workCenterId.trim() === '' ? null : Number(woForm.workCenterId)
    const plan = planId == null ? null : plans.find((p) => p.id === planId) ?? null
    if (planId == null || !Number.isInteger(planId) || !plan || !Number.isInteger(qty) || qty < 1) {
      setErr('작업지시 입력값을 확인하세요.')
      return
    }
    if (workCenterId == null || !Number.isInteger(workCenterId) || workCenterId < 1) {
      setErr('배정 라인(작업장)을 선택하세요.')
      return
    }
    if (woForm.status === 'HOLD' && woForm.holdReason.trim() === '') {
      setErr('보류 상태일 때 보류 사유를 입력하세요.')
      return
    }
    if (editingWoId != null) {
      const allocated = woLotAllocatedQty(lots, editingWoId)
      if (qty < allocated) {
        setErr(`지시수량은 이미 배정된 LOT 합계(${allocated})보다 작을 수 없습니다.`)
        return
      }
    }
    setSaving(true)
    try {
      const body = {
        woNo: woForm.woNo.trim(),
        planId,
        productId: plan.productId,
        orderQty: qty,
        workCenterId,
        status: woForm.status,
        holdReason: woForm.status === 'HOLD' ? woForm.holdReason.trim() : null,
        workerIds: woForm.workerIds,
      }
      if (editingWoId == null) {
        await apiJson('/api/work-orders', { method: 'POST', body: JSON.stringify(body) })
      } else {
        const { woNo: _w, ...patch } = body
        await apiJson(`/api/work-orders/${editingWoId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      }
      setWoPanel(false)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }
  const removeWo = async (id: number) => {
    if (!confirm('작업지시를 삭제할까요?')) return
    try {
      await apiJson(`/api/work-orders/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const openLotCreate = () => {
    const wo = lotTabWoId.trim() !== '' ? workOrders.find((w) => w.id === Number(lotTabWoId)) : null
    if (!wo) return
    const remain = woLotRemainingAlloc(lots, wo)
    if (remain <= 0) {
      setLotAllocNoticeOpen(true)
      return
    }
    setEditingLotId(null)
    setLotForm({
      lotNo: '',
      woId: wo ? lotTabWoId : '',
      lotQty: remain > 0 ? String(remain) : '1',
      status: 'CREATED',
    })
    setLotPanel(true)
  }
  const openLotEdit = (r: LotRow) => {
    setEditingLotId(r.id)
    setLotForm({
      lotNo: r.lotNo,
      woId: r.woId != null ? String(r.woId) : '',
      lotQty: String(r.lotQty),
      status: r.status,
    })
    setLotPanel(true)
  }
  const applyWoToLot = (woIdStr: string) => {
    if (woIdStr.trim() === '') {
      setLotForm((f) => ({ ...f, woId: '' }))
      return
    }
    const wo = workOrders.find((x) => x.id === Number(woIdStr))
    if (!wo) {
      setLotForm((f) => ({ ...f, woId: woIdStr }))
      return
    }
    setLotForm((f) => ({
      ...f,
      woId: woIdStr,
      lotQty: String(woLotRemainingAlloc(lots, wo, editingLotId ?? undefined) || 1),
    }))
  }
  const saveLot = async () => {
    const woId = lotForm.woId.trim() === '' ? null : Number(lotForm.woId)
    const wo = woId == null ? null : workOrders.find((x) => x.id === woId) ?? null
    const pid = wo?.productId
    const qty = Number(lotForm.lotQty)
    if (woId == null || !Number.isInteger(woId) || woId < 1 || !pid || !Number.isInteger(qty) || qty < 1) {
      setErr('작업지시와 LOT 입력값을 확인하세요.')
      return
    }
    const remain = woLotRemainingAlloc(lots, wo, editingLotId ?? undefined)
    if (qty > remain) {
      setErr(`LOT 수량이 초과됩니다. 이 지시에 추가 배정 가능: ${remain}개`)
      return
    }
    setSaving(true)
    try {
      if (editingLotId == null) {
        await apiJson('/api/lots', {
          method: 'POST',
          body: JSON.stringify({
            lotNo: lotForm.lotNo.trim(),
            productId: pid,
            lotQty: qty,
            woId,
            workCenterId: wo.workCenterId ?? undefined,
            status: lotForm.status,
          }),
        })
      } else {
        await apiJson(`/api/lots/${editingLotId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            lotNo: lotForm.lotNo.trim(),
            lotQty: qty,
            woId,
            status: lotForm.status,
          }),
        })
      }
      setLotPanel(false)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }
  const removeLot = async (id: number) => {
    if (!confirm('생산 LOT를 삭제할까요?')) return
    try {
      await apiJson(`/api/lots/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage mesPageWide mesPageOps">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">통합 생산 운영</h1>
        <p className="mesPageDesc">생산계획·작업지시·생산 LOT·재고를 탭으로 구분해 조회/등록/수정/삭제합니다.</p>
      </header>

      {err ? <div className="error mesBanner">{err}</div> : null}

      <section className="mesOpsTop">
        <div className="mesOpsTopRow">
          <div className="mesOpsTabs" role="tablist" aria-label="통합 생산 운영 구역">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'plans'}
              className={`mesOpsTab ${activeTab === 'plans' ? 'mesOpsTabActive' : ''}`}
              onClick={() => setActiveTab('plans')}
            >
              생산계획
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'workOrders'}
              className={`mesOpsTab ${activeTab === 'workOrders' ? 'mesOpsTabActive' : ''}`}
              onClick={() => setActiveTab('workOrders')}
            >
              작업지시
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'lots'}
              className={`mesOpsTab ${activeTab === 'lots' ? 'mesOpsTabActive' : ''}`}
              onClick={() => setActiveTab('lots')}
            >
              생산 LOT
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'inventory'}
              className={`mesOpsTab ${activeTab === 'inventory' ? 'mesOpsTabActive' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              재고현황
            </button>
          </div>
          <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>
        <div className="mesOpsSummaryBar">
          <span className="mesOpsSummaryGroup">
            <span className="mesOpsSummaryPair">
              <span className="mesOpsSummaryKey">제품ID</span>
              <span className="mesOpsSummaryVal mono">{summaryProduct?.productCode ?? '-'}</span>
            </span>
            <span className="mesOpsSummaryPair">
              <span className="mesOpsSummaryKey">제품명</span>
              <span className="mesOpsSummaryVal">
                {activeTab === 'plans'
                  ? (planTabProduct?.productName ?? '품목을 선택하세요')
                  : activeTab === 'workOrders'
                    ? (woTabSelectedPlan ? (summaryProduct?.productName ?? '—') : '계획을 선택하세요')
                    : activeTab === 'lots'
                      ? (lotTabSelectedWo ? (summaryProduct?.productName ?? '—') : '작업지시를 선택하세요')
                      : activeTab === 'inventory'
                        ? (invTabProduct ? (invTabProduct.productName ?? '—') : '품목을 선택하세요')
                        : (selectedProduct?.productName ?? '전체 제품')}
              </span>
            </span>
            <span className="mesOpsSummaryPair">
              <span className="mesOpsSummaryKey">제품군</span>
              <span className="mesOpsSummaryVal">
                {summaryProduct?.itemType?.trim() ? itemTypeLabel(summaryProduct.itemType) : '-'}
              </span>
            </span>
            <span className="mesOpsSummaryPair">
              <span className="mesOpsSummaryKey">단위</span>
              <span className="mesOpsSummaryVal">{summaryProduct?.unit ?? '-'}</span>
            </span>
            {activeTab === 'workOrders' && woTabSelectedPlan ? (
              <span className="mesOpsSummaryPair">
                <span className="mesOpsSummaryKey">선택계획</span>
                <span className="mesOpsSummaryVal mono">{woTabSelectedPlan.planNo}</span>
              </span>
            ) : null}
            {activeTab === 'lots' && lotTabSelectedWo && lotTabAllocation ? (
              <>
                <span className="mesOpsSummaryPair">
                  <span className="mesOpsSummaryKey">선택지시</span>
                  <span className="mesOpsSummaryVal mono">{lotTabSelectedWo.woNo}</span>
                </span>
                <span className="mesOpsSummaryPair">
                  <span className="mesOpsSummaryKey">지시수량</span>
                  <span className="mesOpsSummaryVal">{lotTabSelectedWo.orderQty}</span>
                </span>
                <span className="mesOpsSummaryPair">
                  <span className="mesOpsSummaryKey">LOT배정</span>
                  <span className="mesOpsSummaryVal">
                    {lotTabAllocation.count}건 · {lotTabAllocation.allocated}
                  </span>
                </span>
                <span className="mesOpsSummaryPair">
                  <span className="mesOpsSummaryKey">잔여배정</span>
                  <span className="mesOpsSummaryVal">{lotTabAllocation.remain}</span>
                </span>
              </>
            ) : null}
            {activeTab === 'inventory' && invTabProduct ? (
              <span className="mesOpsSummaryPair">
                <span className="mesOpsSummaryKey">선택품목</span>
                <span className="mesOpsSummaryVal mono">{invTabProduct.productCode}</span>
              </span>
            ) : null}
          </span>
          <span className="mesOpsSummaryGroup">
            <span className="mesOpsSummaryPair">
              <span className="mesOpsSummaryKey">기초재고</span>
              <span className="mesOpsSummaryVal">{invSummary.totalQty}</span>
            </span>
            <span className="mesOpsSummaryPair">
              <span className="mesOpsSummaryKey">가용재고</span>
              <span className="mesOpsSummaryVal">{invSummary.availableQty}</span>
            </span>
            <span className="mesOpsSummaryPair">
              <span className="mesOpsSummaryKey">안전재고</span>
              <span className="mesOpsSummaryVal">{summaryProduct?.safetyStock ?? 0}</span>
            </span>
          </span>
        </div>
      </section>

      {activeTab === 'plans' ? (
        <div className="mesOpsPlanSplit">
          <aside className="mesOpsProductList" aria-label="품목 목록">
            <div className="mesOpsProductListHead">품목</div>
            <div className="mesOpsProductListTools">
              <input
                type="search"
                className="mesInput mesOpsProductSearch"
                value={planProductQuery}
                onChange={(e) => setPlanProductQuery(e.target.value)}
                placeholder="코드·품명·구분 검색"
                aria-label="품목 검색"
              />
              <div className="mesOpsProductListToolsRow">
                <select
                  className="mesInput mesOpsProductFilterSelect"
                  value={planProductTypeFilter}
                  onChange={(e) => setPlanProductTypeFilter(e.target.value)}
                  aria-label="품목구분 필터"
                >
                  <option value="">전체 구분</option>
                  {planProductItemTypes.map((t) => (
                    <option key={t} value={t}>
                      {itemTypeLabel(t)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mesBtnSm mesOpsProductFilterReset"
                  onClick={() => {
                    setPlanProductQuery('')
                    setPlanProductTypeFilter('')
                  }}
                >
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsProductListBody">
              {loading ? (
                <div className="muted small mesOpsProductListEmpty">로딩 중…</div>
              ) : products.length === 0 ? (
                <div className="muted small mesOpsProductListEmpty">등록된 품목이 없습니다.</div>
              ) : planTabFilteredProducts.length === 0 ? (
                <div className="muted small mesOpsProductListEmpty">조건에 맞는 품목이 없습니다.</div>
              ) : (
                planProductsPageSlice.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`mesOpsProductRow ${planTabProductId === String(p.id) ? 'mesOpsProductRowActive' : ''}`}
                    onClick={() => {
                      setPlanTabProductId(String(p.id))
                      setSelectedProductId(String(p.id))
                    }}
                  >
                    <div className="mesOpsProductRowTop">
                      <span className="mesOpsProductCode mono">{p.productCode}</span>
                      <span className="mesOpsProductTypeLabel">{itemTypeLabel(p.itemType)}</span>
                    </div>
                    <span className="mesOpsProductName">{p.productName}</span>
                  </button>
                ))
              )}
            </div>
            <PaginationBar
              className="mesOpsPaginationInList"
              page={planProductListSafePage}
              total={planTabFilteredProducts.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPlanProductListPage}
            />
          </aside>
          <section className="mesOpsPlanMain">
            <div className="mesOpsSectionHead">
              <div className="mesCardTitle mesOpsPlanTitleRow">
                <span className="mesOpsPlanTitleBase">생산계획</span>
                {planTabProduct ? (
                  <span className="mesOpsPlanContextChip" title={`${planTabProduct.productCode} · ${planTabProduct.productName}`}>
                    <span className="mesOpsPlanContextChipName">{planTabProduct.productName}</span>
                  </span>
                ) : null}
              </div>
              <button type="button" className="mesBtnSm" onClick={openPlanCreate} disabled={!planTabProductId}>
                계획 등록
              </button>
            </div>
            <div className="mesOpsTableToolbar">
              <input
                type="search"
                className="mesInput mesOpsTableToolbarSearch"
                value={planTableQuery}
                onChange={(e) => setPlanTableQuery(e.target.value)}
                placeholder="계획번호·수량·일자·상태 검색"
                disabled={!planTabProductId}
                aria-label="생산계획 표 검색"
              />
              <select
                className="mesInput mesOpsTableToolbarSelect"
                value={planTableStatusFilter}
                onChange={(e) => setPlanTableStatusFilter((e.target.value || '') as PlanStatus | '')}
                disabled={!planTabProductId}
                aria-label="생산계획 상태 필터"
              >
                <option value="">전체 상태</option>
                {planStatuses.map((s) => (
                  <option key={s} value={s}>
                    {planStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mesTableWrap mesTableScroll mesOpsTableWrap">
              <table className="mesTable mesOpsTable">
                <thead>
                  <tr>
                    <th>계획번호</th>
                    <th>수량</th>
                    <th>잔여수량</th>
                    <th>시작일</th>
                    <th>종료일</th>
                    <th>상태</th>
                    <th className="mesThActions">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {!planTabProductId ? (
                    <tr><td colSpan={7} className="muted">왼쪽에서 품목을 선택하세요.</td></tr>
                  ) : loading ? (
                    <tr><td colSpan={7} className="muted">로딩 중…</td></tr>
                  ) : plansForPlanTabFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="muted">조건에 맞는 생산계획이 없습니다.</td></tr>
                  ) : (
                    plansTablePageSlice.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.planNo}</td>
                        <td>{r.planQty}</td>
                        <td title="계획수량 − 해당 계획 작업지시 LOT 양품 합계">
                          {r.planQty - (planConsumedGoodQtyByPlanId.get(r.id) ?? 0)}
                        </td>
                        <td>{String(r.startDate).slice(0, 10)}</td>
                        <td>{String(r.endDate).slice(0, 10)}</td>
                        <td>{planStatusLabel(r.status)}</td>
                        <td className="mesTdActions">
                          <button type="button" className="mesBtnSm" onClick={() => openPlanEdit(r)}>수정</button>
                          <button type="button" className="mesBtnSm danger" onClick={() => void removePlan(r.id)}>삭제</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              className="mesOpsPaginationBelowTable"
              page={planTableSafePage}
              total={plansForPlanTabFiltered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPlanTablePage}
            />
          </section>
        </div>
      ) : null}

      {activeTab === 'workOrders' ? (
        <div className="mesOpsPlanSplit mesOpsWoSplit">
          <aside className="mesOpsProductList" aria-label="생산계획 목록">
            <div className="mesOpsProductListHead">생산계획</div>
            <div className="mesOpsProductListTools">
              <input
                type="search"
                className="mesInput mesOpsProductSearch"
                value={woPlanQuery}
                onChange={(e) => setWoPlanQuery(e.target.value)}
                placeholder="계획번호·품목·상태 검색"
                aria-label="생산계획 검색"
              />
              <div className="mesOpsProductListToolsRow">
                <select
                  className="mesInput mesOpsProductFilterSelect"
                  value={woPlanStatusFilter}
                  onChange={(e) => setWoPlanStatusFilter((e.target.value || '') as PlanStatus | '')}
                  aria-label="계획 상태 필터"
                >
                  <option value="">전체 상태</option>
                  {planStatuses.map((s) => (
                    <option key={s} value={s}>
                      {planStatusLabel(s)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mesBtnSm mesOpsProductFilterReset"
                  onClick={() => {
                    setWoPlanQuery('')
                    setWoPlanStatusFilter('')
                  }}
                >
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsProductListBody">
              {loading ? (
                <div className="muted small mesOpsProductListEmpty">로딩 중…</div>
              ) : woTabPlansFiltered.length === 0 ? (
                <div className="muted small mesOpsProductListEmpty">등록된 생산계획이 없습니다.</div>
              ) : (
                woPlansPageSlice.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    className={`mesOpsPlanPickRow ${woTabPlanId === String(pl.id) ? 'mesOpsProductRowActive' : ''}`}
                    onClick={() => {
                      setWoTabPlanId(String(pl.id))
                      setSelectedProductId(String(pl.productId))
                    }}
                  >
                    <div className="mesOpsProductRowTop">
                      <span className="mesOpsProductCode mono">{pl.planNo}</span>
                      <span className="mesOpsProductTypeLabel">{planStatusLabel(pl.status)}</span>
                    </div>
                    <span className="mesOpsProductName">
                      {pl.product ? `${pl.product.productCode} · ${pl.product.productName}` : `품목#${pl.productId}`}
                    </span>
                    <span className="muted small mesOpsPlanPickMeta">
                      수량 {pl.planQty} · {String(pl.startDate).slice(0, 10)} ~ {String(pl.endDate).slice(0, 10)}
                    </span>
                  </button>
                ))
              )}
            </div>
            <PaginationBar
              className="mesOpsPaginationInList"
              page={woPlanListSafePage}
              total={woTabPlansFiltered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setWoPlanListPage}
            />
          </aside>
          <section className="mesOpsPlanMain">
            <div className="mesOpsSectionHead">
              <div className="mesCardTitle">
                작업지시
                {woTabSelectedPlan ? (
                  <span className="muted small" style={{ marginLeft: 8, fontWeight: 600 }}>
                    · {woTabSelectedPlan.planNo}
                  </span>
                ) : null}
              </div>
              <button type="button" className="mesBtnSm" onClick={openWoCreate} disabled={!woTabPlanId}>
                지시 등록
              </button>
            </div>
            {woTabKpi ? (
              <div className="mesOpsSummaryStrip mesOpsWoKpiStrip" aria-label="작업지시 요약">
                <div className="mesWoSummaryItem">
                  <span>지시 수량</span>
                  <strong>{woTabKpi.orderQty.toLocaleString()}</strong>
                </div>
                <div className="mesWoSummaryItem">
                  <span>현재 작업량</span>
                  <strong>{woTabKpi.worked.toLocaleString()}</strong>
                </div>
                <div className="mesWoSummaryItem">
                  <span>불량수량 / 불량률</span>
                  <strong>
                    {woTabKpi.defect.toLocaleString()}
                    <span className="mesWoKpiSub"> ({woTabKpi.defectRate}%)</span>
                  </strong>
                </div>
              </div>
            ) : null}
            <div className="mesOpsTableToolbar">
              <input
                type="search"
                className="mesInput mesOpsTableToolbarSearch"
                value={woTableQuery}
                onChange={(e) => setWoTableQuery(e.target.value)}
                placeholder="지시번호·품목·작업장·작업자·상태 검색"
                disabled={!woTabPlanId}
                aria-label="작업지시 표 검색"
              />
              <select
                className="mesInput mesOpsTableToolbarSelect"
                value={woTableStatusFilter}
                onChange={(e) => setWoTableStatusFilter((e.target.value || '') as WorkOrderStatus | '')}
                disabled={!woTabPlanId}
                aria-label="작업지시 상태 필터"
              >
                <option value="">전체 상태</option>
                {woStatuses.map((s) => (
                  <option key={s} value={s}>
                    {woStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mesTableWrap mesTableScroll mesOpsTableWrap">
              <table className="mesTable mesOpsTable">
                <thead>
                  <tr>
                    <th>작업지시번호</th>
                    <th>생산품목</th>
                    <th>작업장</th>
                    <th>작업자</th>
                    <th>수량</th>
                    <th>진행상태</th>
                    <th className="mesThActions">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {!woTabPlanId ? (
                    <tr><td colSpan={7} className="muted">왼쪽에서 생산계획을 선택하세요.</td></tr>
                  ) : loading ? (
                    <tr><td colSpan={7} className="muted">로딩 중…</td></tr>
                  ) : woTableFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="muted">이 계획에 연결된 작업지시가 없거나, 조건에 맞는 행이 없습니다.</td></tr>
                  ) : (
                    woTablePageSlice.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.woNo}</td>
                        <td>{r.product?.productName ?? `품목#${r.productId}`}</td>
                        <td>{r.workCenter?.centerName ?? '—'}</td>
                        <td className="mesTdEllipsis" title={workerNamesShort(r)}>{workerNamesShort(r)}</td>
                        <td>{r.orderQty}</td>
                        <td>
                          {woStatusLabel(r.status)}
                          {r.status === 'HOLD' && r.holdReason ? (
                            <div className="muted small" title={r.holdReason}>
                              {r.holdReason.length > 24 ? `${r.holdReason.slice(0, 24)}…` : r.holdReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="mesTdActions">
                          <button type="button" className="mesBtnSm" onClick={() => openWoEdit(r)}>수정</button>
                          <button type="button" className="mesBtnSm danger" onClick={() => void removeWo(r.id)}>삭제</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              className="mesOpsPaginationBelowTable"
              page={woTableSafePage}
              total={woTableFiltered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setWoTablePage}
            />
          </section>
        </div>
      ) : null}

      {activeTab === 'lots' ? (
        <div className="mesOpsPlanSplit mesOpsWoSplit">
          <aside className="mesOpsProductList" aria-label="작업지시 목록">
            <div className="mesOpsProductListHead">작업지시</div>
            <div className="mesOpsProductListTools">
              <input
                type="search"
                className="mesInput mesOpsProductSearch"
                value={lotWoListQuery}
                onChange={(e) => setLotWoListQuery(e.target.value)}
                placeholder="지시번호·품목·계획·작업장 검색"
                aria-label="작업지시 검색"
              />
              <div className="mesOpsProductListToolsRow">
                <select
                  className="mesInput mesOpsProductFilterSelect"
                  value={lotWoListStatusFilter}
                  onChange={(e) => setLotWoListStatusFilter((e.target.value || '') as WorkOrderStatus | '')}
                  aria-label="작업지시 상태 필터"
                >
                  <option value="">전체 상태</option>
                  {woStatuses.map((s) => (
                    <option key={s} value={s}>
                      {woStatusLabel(s)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mesBtnSm mesOpsProductFilterReset"
                  onClick={() => {
                    setLotWoListQuery('')
                    setLotWoListStatusFilter('')
                  }}
                >
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsProductListBody">
              {loading ? (
                <div className="muted small mesOpsProductListEmpty">로딩 중…</div>
              ) : lotTabWorkOrdersFiltered.length === 0 ? (
                <div className="muted small mesOpsProductListEmpty">등록된 작업지시가 없습니다.</div>
              ) : (
                lotWoListPageSlice.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`mesOpsPlanPickRow ${lotTabWoId === String(w.id) ? 'mesOpsProductRowActive' : ''}`}
                    onClick={() => {
                      setLotTabWoId(String(w.id))
                      setSelectedProductId(String(w.productId))
                    }}
                  >
                    <div className="mesOpsProductRowTop">
                      <span className="mesOpsProductCode mono">{w.woNo}</span>
                      <span className="mesOpsProductTypeLabel">{woStatusLabel(w.status)}</span>
                    </div>
                    <span className="mesOpsProductName">
                      {w.product ? `${w.product.productCode} · ${w.product.productName}` : `품목#${w.productId}`}
                    </span>
                    <span className="muted small mesOpsPlanPickMeta">
                      수량 {w.orderQty}
                      {` · LOT ${woLotCount(lots, w.id)}건`}
                      {w.planId != null && planById.get(w.planId) ? ` · 계획 ${planById.get(w.planId)!.planNo}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
            <PaginationBar
              className="mesOpsPaginationInList"
              page={lotWoListSafePage}
              total={lotTabWorkOrdersFiltered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setLotWoListPage}
            />
          </aside>
          <section className="mesOpsPlanMain">
            <div className="mesOpsSectionHead">
              <div className="mesCardTitle">
                생산 LOT
                {lotTabSelectedWo ? (
                  <span className="muted small" style={{ marginLeft: 8, fontWeight: 600 }}>
                    · {lotTabSelectedWo.woNo}
                    {lotTabAllocation
                      ? ` (배정 ${lotTabAllocation.allocated}/${lotTabSelectedWo.orderQty}, 잔여 ${lotTabAllocation.remain})`
                      : ''}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="mesBtnSm"
                onClick={openLotCreate}
                disabled={!lotTabWoId}
                title={
                  lotTabAllocation && lotTabAllocation.remain <= 0
                    ? '잔여 배정 0 — 클릭하면 안내를 확인할 수 있습니다'
                    : undefined
                }
              >
                LOT 등록
              </button>
            </div>
            <div className="mesOpsTableToolbar">
              <input
                type="search"
                className="mesInput mesOpsTableToolbarSearch"
                value={lotTableQuery}
                onChange={(e) => setLotTableQuery(e.target.value)}
                placeholder="LOT번호·수량·양품·불량·잔여·상태 검색"
                disabled={!lotTabWoId}
                aria-label="생산 LOT 표 검색"
              />
              <select
                className="mesInput mesOpsTableToolbarSelect"
                value={lotTableStatusFilter}
                onChange={(e) => setLotTableStatusFilter((e.target.value || '') as LotStatus | '')}
                disabled={!lotTabWoId}
                aria-label="LOT 상태 필터"
              >
                <option value="">전체 상태</option>
                {lotStatuses.map((s) => (
                  <option key={s} value={s}>
                    {lotStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mesTableWrap mesTableScroll mesOpsTableWrap">
              <table className="mesTable mesOpsTable">
                <thead>
                  <tr>
                    <th>LOT번호</th>
                    <th>LOT수량</th>
                    <th>양품</th>
                    <th>불량</th>
                    <th>잔여 작업량</th>
                    <th>상태</th>
                    <th className="mesThActions">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {!lotTabWoId ? (
                    <tr><td colSpan={7} className="muted">왼쪽에서 작업지시를 선택하세요.</td></tr>
                  ) : loading ? (
                    <tr><td colSpan={7} className="muted">로딩 중…</td></tr>
                  ) : lotTableFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="muted">이 지시에 연결된 LOT이 없거나, 조건에 맞는 행이 없습니다.</td></tr>
                  ) : (
                    lotTablePageSlice.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.lotNo}</td>
                        <td>{r.lotQty}</td>
                        <td>{r.goodQty}</td>
                        <td>{r.defectQty}</td>
                        <td>{lotRemainingWorkDisplay(r)}</td>
                        <td>{lotStatusLabel(r.status)}</td>
                        <td className="mesTdActions">
                          <button type="button" className="mesBtnSm" onClick={() => openLotEdit(r)}>수정</button>
                          <button type="button" className="mesBtnSm danger" onClick={() => void removeLot(r.id)}>삭제</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              className="mesOpsPaginationBelowTable"
              page={lotTableSafePage}
              total={lotTableFiltered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setLotTablePage}
            />
          </section>
        </div>
      ) : null}

      {activeTab === 'inventory' ? (
        <div className="mesOpsPlanSplit mesOpsWoSplit">
          <aside className="mesOpsProductList" aria-label="품목 목록">
            <div className="mesOpsProductListHead">품목</div>
            <div className="mesOpsProductListTools">
              <input
                type="search"
                className="mesInput mesOpsProductSearch"
                value={invProductQuery}
                onChange={(e) => setInvProductQuery(e.target.value)}
                placeholder="코드·품명·구분 검색"
                aria-label="재고 탭 품목 검색"
              />
              <div className="mesOpsProductListToolsRow">
                <select
                  className="mesInput mesOpsProductFilterSelect"
                  value={invProductTypeFilter}
                  onChange={(e) => setInvProductTypeFilter(e.target.value)}
                  aria-label="품목구분 필터"
                >
                  <option value="">전체 구분</option>
                  {planProductItemTypes.map((t) => (
                    <option key={t} value={t}>
                      {itemTypeLabel(t)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mesBtnSm mesOpsProductFilterReset"
                  onClick={() => {
                    setInvProductQuery('')
                    setInvProductTypeFilter('')
                  }}
                >
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsProductListBody">
              {loading ? (
                <div className="muted small mesOpsProductListEmpty">로딩 중…</div>
              ) : products.length === 0 ? (
                <div className="muted small mesOpsProductListEmpty">등록된 품목이 없습니다.</div>
              ) : invTabFilteredProducts.length === 0 ? (
                <div className="muted small mesOpsProductListEmpty">조건에 맞는 품목이 없습니다.</div>
              ) : (
                invProductsPageSlice.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`mesOpsProductRow ${invTabProductId === String(p.id) ? 'mesOpsProductRowActive' : ''}`}
                    onClick={() => setInvTabProductId(String(p.id))}
                  >
                    <div className="mesOpsProductRowTop">
                      <span className="mesOpsProductCode mono">{p.productCode}</span>
                      <span className="mesOpsProductTypeLabel">{itemTypeLabel(p.itemType)}</span>
                    </div>
                    <span className="mesOpsProductName">{p.productName}</span>
                  </button>
                ))
              )}
            </div>
            <PaginationBar
              className="mesOpsPaginationInList"
              page={invProductListSafePage}
              total={invTabFilteredProducts.length}
              pageSize={PAGE_SIZE}
              onPageChange={setInvProductListPage}
            />
          </aside>
          <section className="mesOpsPlanMain mesOpsInvStack">
            <div className="mesOpsSectionHead">
              <div className="mesCardTitle mesOpsPlanTitleRow">
                <span className="mesOpsPlanTitleBase">재고 현황</span>
                {invTabProduct ? (
                  <span className="mesOpsPlanContextChip" title={`${invTabProduct.productCode} · ${invTabProduct.productName}`}>
                    <span className="mesOpsPlanContextChipName">{invTabProduct.productName}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mesOpsSectionHead" style={{ marginBottom: 8 }}>
                <h3 className="mesOpsInvSubHead" style={{ margin: 0 }}>재고(LOT별)</h3>
                <label className="mesInlineCheck" style={{ marginLeft: 'auto' }}>
                  <input
                    type="checkbox"
                    checked={invShowZeroAvailLots}
                    onChange={(e) => setInvShowZeroAvailLots(e.target.checked)}
                  />
                  <span>가용 0 LOT도 표시</span>
                </label>
              </div>
              <div className="mesTableWrap mesTableScroll mesOpsTableWrap">
                <table className="mesTable mesOpsTable">
                  <thead>
                    <tr><th>LOT</th><th>수량</th><th>예약</th><th>가용</th><th>상태</th></tr>
                  </thead>
                  <tbody>
                    {!invTabProductId ? (
                      <tr><td colSpan={5} className="muted">왼쪽에서 품목을 선택하세요.</td></tr>
                    ) : loading ? (
                      <tr><td colSpan={5} className="muted">로딩 중…</td></tr>
                    ) : invTabInventoryRows.length === 0 ? (
                      <tr><td colSpan={5} className="muted">해당 품목의 재고 행이 없습니다.</td></tr>
                    ) : (
                      invTabInventoryPageSlice.map((r) => (
                        <tr key={r.id}>
                          <td className="mono">{r.lot?.lotNo ?? r.materialLot?.lotNo ?? '—'}</td>
                          <td>{r.qty}</td>
                          <td>{r.reservedQty}</td>
                          <td>{r.qty - r.reservedQty}</td>
                          <td>{r.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                className="mesOpsPaginationBelowTable"
                page={invStockRowsSafePage}
                total={invTabInventoryRows.length}
                pageSize={PAGE_SIZE}
                onPageChange={setInvSummaryPage}
              />
            </div>

            <div>
              <h3 className="mesOpsInvSubHead">입고 내역</h3>
              <div className="mesTableWrap mesTableScroll mesOpsTableWrap">
                <table className="mesTable mesOpsTable">
                  <thead>
                    <tr>
                      <th>일시</th>
                      <th>품목</th>
                      <th>수량</th>
                      <th>LOT</th>
                      <th>위치</th>
                      <th>전→후</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!invTabProductId ? (
                      <tr><td colSpan={6} className="muted">왼쪽에서 품목을 선택하세요.</td></tr>
                    ) : loading ? (
                      <tr><td colSpan={6} className="muted">로딩 중…</td></tr>
                    ) : invTxInRows.length === 0 ? (
                      <tr><td colSpan={6} className="muted">입고 이력이 없습니다.</td></tr>
                    ) : (
                      invTxInPageSlice.map((r) => (
                        <tr key={r.id}>
                          <td className="muted small">{formatInvTxWhen(r.createdAt)}</td>
                          <td>{invTxProductNameCell(r)}</td>
                          <td>{r.qty}</td>
                          <td className="mono">{invTxLotLabel(r)}</td>
                          <td className="mono">{invTxLocLabel(r)}</td>
                          <td className="muted small">
                            {r.beforeQty != null || r.afterQty != null ? `${r.beforeQty ?? '—'} → ${r.afterQty ?? '—'}` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                className="mesOpsPaginationBelowTable"
                page={invInSafePage}
                total={invTxInRows.length}
                pageSize={INV_TX_PAGE_SIZE}
                onPageChange={setInvInPage}
              />
            </div>

            <div>
              <h3 className="mesOpsInvSubHead">출고·이동·조정</h3>
              <div className="mesTableWrap mesTableScroll mesOpsTableWrap">
                <table className="mesTable mesOpsTable">
                  <thead>
                    <tr>
                      <th>일시</th>
                      <th>구분</th>
                      <th>품목</th>
                      <th>수량</th>
                      <th>LOT</th>
                      <th>위치</th>
                      <th>전→후</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!invTabProductId ? (
                      <tr><td colSpan={7} className="muted">왼쪽에서 품목을 선택하세요.</td></tr>
                    ) : loading ? (
                      <tr><td colSpan={7} className="muted">로딩 중…</td></tr>
                    ) : invTxOutEtcRows.length === 0 ? (
                      <tr><td colSpan={7} className="muted">출고·이동·조정 이력이 없습니다.</td></tr>
                    ) : (
                      invTxOutPageSlice.map((r) => (
                        <tr key={r.id}>
                          <td className="muted small">{formatInvTxWhen(r.createdAt)}</td>
                          <td>{invTxTypeLabel(r.transactionType)}</td>
                          <td>{invTxProductNameCell(r)}</td>
                          <td>{r.qty}</td>
                          <td className="mono">{invTxLotLabel(r)}</td>
                          <td className="mono">{invTxLocLabel(r)}</td>
                          <td className="muted small">
                            {r.beforeQty != null || r.afterQty != null ? `${r.beforeQty ?? '—'} → ${r.afterQty ?? '—'}` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                className="mesOpsPaginationBelowTable"
                page={invOutSafePage}
                total={invTxOutEtcRows.length}
                pageSize={INV_TX_PAGE_SIZE}
                onPageChange={setInvOutPage}
              />
            </div>
          </section>
        </div>
      ) : null}

      {planPanel ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setPlanPanel(false)} />
          <div className="mesModalDialog mesOpsFormModalDialog" role="dialog" aria-modal="true">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle">{editingPlanId == null ? '생산계획 등록' : `생산계획 수정 (${editingPlanId})`}</h2>
                <p className="mesModalMeta">생산계획 기준정보를 입력합니다.</p>
              </div>
              <div className="mesWoBadge">{planStatusLabel(planForm.status)}</div>
            </div>
            <div className="mesModalBody mesOpsFormModalBody">
              <div className="mesOpsSummaryStrip">
                <div className="mesWoSummaryItem">
                  <span>품목코드</span>
                  <strong>{selectedPlanProduct?.productCode ?? '—'}</strong>
                </div>
                <div className="mesWoSummaryItem">
                  <span>기준단위</span>
                  <strong>{selectedPlanProduct?.unit ?? '—'}</strong>
                </div>
                <div className="mesWoSummaryItem">
                  <span>안전재고</span>
                  <strong>{selectedPlanProduct?.safetyStock ?? '—'}</strong>
                </div>
              </div>

              <div className="mesWoModalGrid">
                <section className="mesWoModalCard">
                  <h3 className="mesWoModalCardTitle">계획 기본정보</h3>
                  <div className="mesFieldRow">
                    <label className="mesLabel">계획번호<input className="mesInput mono" value={planForm.planNo} disabled={editingPlanId != null} onChange={(e) => setPlanForm((f) => ({ ...f, planNo: e.target.value }))} /></label>
                    <label className="mesLabel">품목<select className="mesInput" value={planForm.productId} onChange={(e) => setPlanForm((f) => ({ ...f, productId: e.target.value }))}><option value="">선택</option>{products.map((p) => <option key={p.id} value={String(p.id)}>{p.productCode} · {p.productName}</option>)}</select></label>
                  </div>
                  <div className="mesFieldRow">
                    <label className="mesLabel">계획수량<input className="mesInput" value={planForm.planQty} onChange={(e) => setPlanForm((f) => ({ ...f, planQty: e.target.value }))} /></label>
                    <label className="mesLabel">상태<select className="mesInput" value={planForm.status} onChange={(e) => setPlanForm((f) => ({ ...f, status: e.target.value as PlanStatus }))}>{planStatuses.map((s) => <option key={s} value={s}>{planStatusLabel(s)}</option>)}</select></label>
                  </div>
                  <div className="mesFieldRow">
                    <label className="mesLabel">시작일<input className="mesInput" type="date" value={planForm.startDate} onChange={(e) => setPlanForm((f) => ({ ...f, startDate: e.target.value }))} /></label>
                    <label className="mesLabel">종료일<input className="mesInput" type="date" value={planForm.endDate} onChange={(e) => setPlanForm((f) => ({ ...f, endDate: e.target.value }))} /></label>
                  </div>
                </section>

                <section className="mesWoModalCard">
                  <h3 className="mesWoModalCardTitle">계획 정보 요약</h3>
                  <div className="mesWoInfoList">
                    <div className="mesWoInfoRow"><span>품목명</span><strong>{selectedPlanProduct?.productName ?? '—'}</strong></div>
                    <div className="mesWoInfoRow">
                      <span>계획수량·포장</span>
                      <strong className="mono mesWoInfoValMultiline">{planModalQtyPackingLine}</strong>
                    </div>
                    <div className="mesWoInfoRow"><span>분류</span><strong>{selectedPlanProduct?.itemType ?? '—'}</strong></div>
                    <div className="mesWoInfoRow"><span>기간</span><strong>{planForm.startDate && planForm.endDate ? `${planForm.startDate} ~ ${planForm.endDate}` : '—'}</strong></div>
                    <div className="mesWoInfoRow"><span>상태</span><strong>{planStatusLabel(planForm.status)}</strong></div>
                  </div>
                </section>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={() => setPlanPanel(false)}>취소</button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void savePlan()}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {woPanel ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setWoPanel(false)} />
          <div className="mesModalDialog mesWoModalDialog" role="dialog" aria-modal="true">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle">{editingWoId == null ? '작업지시 등록' : `작업지시 수정 (${editingWoId})`}</h2>
                <p className="mesModalMeta">작업지시 기본정보와 배정 작업자를 입력합니다. 생산 LOT는 「생산 LOT」 탭에서 별도 등록합니다.</p>
              </div>
              <div className="mesWoBadge">{woStatusLabel(woForm.status)}</div>
            </div>
            <div className="mesModalBody mesWoModalBody">
              <div className="mesWoWorkbench">
                <section className="mesWoFormPanel">
                  <h3 className="mesWoPanelTitle">작업지시 입력</h3>
                  <div className="mesWoCompactGrid">
                    <label className="mesLabel">지시번호<input className="mesInput mono" value={woForm.woNo} disabled={editingWoId != null} onChange={(e) => setWoForm((f) => ({ ...f, woNo: e.target.value }))} /></label>
                    <label className="mesLabel">계획<select className="mesInput" value={woForm.planId} onChange={(e) => setWoForm((f) => ({ ...f, planId: e.target.value }))}><option value="">선택</option>{filtered.plans.map((p) => <option key={p.id} value={String(p.id)}>{p.planNo} · {p.product?.productName ?? `품목#${p.productId}`}</option>)}</select></label>
                    <label className="mesLabel">제조 품목<input className="mesInput" value={selectedWoPlan ? `${selectedWoPlan.product?.productName ?? `품목#${selectedWoPlan.productId}`}` : ''} readOnly placeholder="계획 선택 시 자동 표시" /></label>
                    <label className="mesLabel">지시수량<input className="mesInput" value={woForm.orderQty} onChange={(e) => setWoForm((f) => ({ ...f, orderQty: e.target.value }))} /></label>
                    <label className="mesLabel">배정 라인<select className="mesInput" value={woForm.workCenterId} onChange={(e) => setWoForm((f) => ({ ...f, workCenterId: e.target.value }))}><option value="">라인 선택</option>{workCenters.map((w) => <option key={w.id} value={String(w.id)}>{w.centerCode} · {w.centerName}</option>)}</select></label>
                    <label className="mesLabel">상태<select className="mesInput" value={woForm.status} onChange={(e) => {
                      const next = e.target.value as WorkOrderStatus
                      setWoForm((f) => ({
                        ...f,
                        status: next,
                        holdReason: next === 'HOLD' ? f.holdReason : '',
                      }))
                    }}>{woStatuses.map((s) => <option key={s} value={s}>{woStatusLabel(s)}</option>)}</select></label>
                    {woForm.status === 'HOLD' ? (
                      <label className="mesLabel" style={{ gridColumn: '1 / -1' }}>
                        보류 사유
                        <textarea
                          className="mesInput"
                          rows={3}
                          value={woForm.holdReason}
                          placeholder="예) 금형 점검으로 인한 작업 일시 중단"
                          onChange={(e) => setWoForm((f) => ({ ...f, holdReason: e.target.value }))}
                        />
                      </label>
                    ) : null}
                  </div>
                </section>

                <section className="mesWoProductPanel">
                  <h3 className="mesWoPanelTitle">품목 정보</h3>
                  <table className="mesWoInfoTable">
                    <tbody>
                      <tr><th>계획번호</th><td>{selectedWoPlan?.planNo ?? '미선택'}</td></tr>
                      <tr><th>품목코드</th><td>{selectedWoProduct?.productCode ?? '—'}</td></tr>
                      <tr><th>품목명</th><td>{selectedWoProduct?.productName ?? '—'}</td></tr>
                      <tr><th>품목구분</th><td>{selectedWoProduct?.itemType ?? '—'}</td></tr>
                      <tr><th>단위</th><td>{selectedWoProduct?.unit ?? '—'}</td></tr>
                      <tr><th>배정라인</th><td>{selectedWoCenter ? `${selectedWoCenter.centerCode} · ${selectedWoCenter.centerName}` : '미지정'}</td></tr>
                      <tr><th>안전재고</th><td>{selectedWoProduct?.safetyStock ?? '—'}</td></tr>
                      <tr><th>계획수량</th><td>{selectedWoPlan?.planQty ?? '—'}</td></tr>
                      {editingWoLotAllocation ? (
                        <>
                          <tr><th>LOT 건수</th><td>{editingWoLotAllocation.count}건</td></tr>
                          <tr><th>LOT 배정</th><td>{editingWoLotAllocation.allocated} / {editingWoLotAllocation.orderQty}</td></tr>
                          <tr><th>잔여 배정</th><td>{editingWoLotAllocation.remain}</td></tr>
                        </>
                      ) : (
                        <tr><th>LOT</th><td className="muted small">저장 후 「생산 LOT」 탭에서 등록</td></tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </div>

              <div className="mesWoWorkerBlock mesWoWorkerBlockRich">
                <div className="mesWoWorkerTitle">배정 작업자 (복수 선택)</div>
                <div className="mesWoWorkerTools">
                  <input
                    className="mesInput"
                    value={woWorkerQuery}
                    onChange={(e) => setWoWorkerQuery(e.target.value)}
                    placeholder="작업자 코드/이름 검색"
                  />
                  <label className="mesWoWorkerToggle">
                    <input
                      type="checkbox"
                      checked={woOnlyActive}
                      onChange={(e) => setWoOnlyActive(e.target.checked)}
                    />
                    <span>활성만</span>
                  </label>
                  <button
                    type="button"
                    className="mesBtnSm"
                    onClick={() =>
                      setWoForm((f) => ({
                        ...f,
                        workerIds: Array.from(new Set([...f.workerIds, ...woSelectableWorkers.map((w) => w.id)])),
                      }))
                    }
                  >
                    전체선택
                  </button>
                  <button
                    type="button"
                    className="mesBtnSm"
                    onClick={() =>
                      setWoForm((f) => ({
                        ...f,
                        workerIds: f.workerIds.filter((id) => !woSelectableWorkers.some((w) => w.id === id)),
                      }))
                    }
                  >
                    필터해제
                  </button>
                </div>
                <div className="mesWoWorkerGrid">
                  {woSelectableWorkers.length === 0 ? (
                    <div className="muted small">조건에 맞는 작업자가 없습니다.</div>
                  ) : (
                    woSelectableWorkers.map((w) => (
                    <label key={w.id} className="mesWoWorkerItem">
                      <input
                        type="checkbox"
                        checked={woForm.workerIds.includes(w.id)}
                        onChange={() => setWoForm((f) => ({ ...f, workerIds: toggleId(f.workerIds, w.id) }))}
                      />
                      <span>
                        <span className="mono">{w.workerCode}</span> {w.workerName}
                        {w.status !== 'ACTIVE' ? <span className="muted small"> ({w.status})</span> : null}
                      </span>
                    </label>
                    ))
                  )}
                </div>
                <p className="muted small" style={{ marginTop: 10 }}>
                  라인 {selectedWoCenter?.centerCode ?? '미지정'} · 계획번호 {selectedWoPlan?.planNo ?? '미선택'} · 지시수량 {woForm.orderQty || '0'} · 선택 {woForm.workerIds.length}명
                </p>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={() => setWoPanel(false)}>취소</button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void saveWo()}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {lotPanel ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setLotPanel(false)} />
          <div className="mesModalDialog mesOpsFormModalDialog" role="dialog" aria-modal="true">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle">{editingLotId == null ? 'LOT 등록' : `LOT 수정 (${editingLotId})`}</h2>
                <p className="mesModalMeta">하나의 작업지시에 여러 LOT를 나눠 등록할 수 있습니다. (예: 지시 1000 → LOT 700 + 300)</p>
              </div>
              <div className="mesWoBadge">{lotStatusLabel(lotForm.status)}</div>
            </div>
            <div className="mesModalBody mesOpsFormModalBody">
              <div className="mesWoModalGrid">
                <section className="mesWoModalCard">
                  <h3 className="mesWoModalCardTitle">LOT 기본정보</h3>
                  <div className="mesFieldRow">
                    <label className="mesLabel">LOT번호<input className="mesInput mono" value={lotForm.lotNo} onChange={(e) => setLotForm((f) => ({ ...f, lotNo: e.target.value }))} /></label>
                    <label className="mesLabel">작업지시<select className="mesInput" value={lotForm.woId} onChange={(e) => applyWoToLot(e.target.value)}><option value="">선택</option>{lotSelectableWorkOrders.map((w) => <option key={w.id} value={String(w.id)}>{w.woNo} · {w.product?.productName ?? `품목#${w.productId}`}</option>)}</select></label>
                  </div>
                  <div className="mesFieldRow">
                    <label className="mesLabel">제조 품목<input className="mesInput" value={selectedLotWorkOrder ? `${selectedLotWorkOrder.product?.productName ?? `품목#${selectedLotWorkOrder.productId}`}` : ''} readOnly placeholder="작업지시 선택 시 자동 표시" /></label>
                    <label className="mesLabel">
                      LOT수량
                      <input className="mesInput" value={lotForm.lotQty} onChange={(e) => setLotForm((f) => ({ ...f, lotQty: e.target.value }))} />
                      {lotFormAllocation ? (
                        <span className="muted small" style={{ display: 'block', marginTop: 4 }}>
                          추가 배정 가능: {lotFormAllocation.remain} (지시 {lotFormAllocation.wo.orderQty}, 기배정{' '}
                          {lotFormAllocation.allocated})
                        </span>
                      ) : null}
                    </label>
                  </div>
                  <div className="mesFieldRow">
                    <label className="mesLabel">상태<select className="mesInput" value={lotForm.status} onChange={(e) => setLotForm((f) => ({ ...f, status: e.target.value as LotStatus }))}>{lotStatuses.map((s) => <option key={s} value={s}>{lotStatusLabel(s)}</option>)}</select></label>
                  </div>
                </section>

                <section className="mesWoModalCard">
                  <h3 className="mesWoModalCardTitle">LOT 정보 요약</h3>
                  <div className="mesWoInfoList">
                    <div className="mesWoInfoRow"><span>작업지시</span><strong>{selectedLotWorkOrder?.woNo ?? '미선택'}</strong></div>
                    <div className="mesWoInfoRow"><span>지시수량</span><strong>{lotFormAllocation?.wo.orderQty ?? '—'}</strong></div>
                    <div className="mesWoInfoRow"><span>기배정 LOT</span><strong>{lotFormAllocation ? lotFormAllocation.allocated : '—'}</strong></div>
                    <div className="mesWoInfoRow"><span>추가 가능</span><strong>{lotFormAllocation ? lotFormAllocation.remain : '—'}</strong></div>
                    <div className="mesWoInfoRow"><span>품목명</span><strong>{selectedLotWorkOrder?.product?.productName ?? '—'}</strong></div>
                    <div className="mesWoInfoRow"><span>상태</span><strong>{lotStatusLabel(lotForm.status)}</strong></div>
                  </div>
                </section>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={() => setLotPanel(false)}>취소</button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void saveLot()}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {lotAllocNoticeOpen && lotTabSelectedWo && lotTabAllocation ? (
        <div className="mesModalRoot" role="presentation">
          <button
            type="button"
            className="mesModalBackdrop"
            aria-label="닫기"
            onClick={() => setLotAllocNoticeOpen(false)}
          />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-lot-alloc-notice-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-lot-alloc-notice-title">
                  LOT 등록 불가
                </h2>
                <p className="mesModalMeta">
                  선택한 작업지시({lotTabSelectedWo.woNo})의 지시수량 {lotTabSelectedWo.orderQty.toLocaleString()}이(가) 모두
                  LOT에 배정되었습니다.
                </p>
              </div>
            </div>
            <div className="mesModalBody">
              <p className="muted" style={{ marginTop: 0 }}>
                배정 {lotTabAllocation.allocated.toLocaleString()}/{lotTabSelectedWo.orderQty.toLocaleString()}, 잔여{' '}
                {lotTabAllocation.remain.toLocaleString()}
              </p>
              <p className="muted" style={{ marginBottom: 0 }}>
                추가 LOT를 등록하려면 기존 LOT 수량을 조정하거나, 작업지시 수량을 늘려주세요.
              </p>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnPrimary" onClick={() => setLotAllocNoticeOpen(false)}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
