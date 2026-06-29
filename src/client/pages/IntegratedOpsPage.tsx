import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import { itemTypeLabel, normalizeItemTypeToCode } from '../lib/itemType'
import '../integrated-ops-page.css'

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
const PLAN_TABLE_PAGE_SIZE = 20
const INV_TX_PAGE_SIZE = 15

function productTypeBadgeClass(code: string): string {
  const c = normalizeItemTypeToCode(code)
  if (c === 'FG') return 'mesOpsV2TypeBadge mesOpsV2TypeBadge--fg'
  if (c === 'WIP') return 'mesOpsV2TypeBadge mesOpsV2TypeBadge--wip'
  if (c === 'RAW') return 'mesOpsV2TypeBadge mesOpsV2TypeBadge--raw'
  return 'mesOpsV2TypeBadge'
}

function planStatusBadgeClass(s: PlanStatus): string {
  if (s === 'PLANNED') return 'mesOpsV2PlanBadge mesOpsV2PlanBadge--planned'
  if (s === 'CONFIRMED') return 'mesOpsV2PlanBadge mesOpsV2PlanBadge--confirmed'
  return 'mesOpsV2PlanBadge mesOpsV2PlanBadge--closed'
}

function woStatusBadgeClass(s: WorkOrderStatus): string {
  if (s === 'READY') return 'mesOpsV2WoBadge mesOpsV2WoBadge--ready'
  if (s === 'IN_PROGRESS') return 'mesOpsV2WoBadge mesOpsV2WoBadge--progress'
  if (s === 'DONE') return 'mesOpsV2WoBadge mesOpsV2WoBadge--done'
  return 'mesOpsV2WoBadge mesOpsV2WoBadge--hold'
}

function lotStatusBadgeClass(s: LotStatus): string {
  if (s === 'CREATED') return 'mesOpsV2LotBadge mesOpsV2LotBadge--created'
  if (s === 'IN_PROGRESS') return 'mesOpsV2LotBadge mesOpsV2LotBadge--progress'
  if (s === 'DONE') return 'mesOpsV2LotBadge mesOpsV2LotBadge--done'
  return 'mesOpsV2LotBadge mesOpsV2LotBadge--outsource'
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  )
}

function IconCog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
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

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12h14" />
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

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M12 12v10M3 7l9 5 9-5" />
    </svg>
  )
}

function IconMonitor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
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

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l6.59-6.59a1 1 0 0 0 0-1.41L12 2Z" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m12 2 9 4.5 12 2-9-4.5-9 4.5 12 2Z" />
      <path d="m3 10 9 4.5 9-4.5" />
      <path d="m3 16 9 4.5 9-4.5" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V5l-8-3Z" />
    </svg>
  )
}

function IconSave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function PlanTablePager({
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  showPageSizeSelect = true,
}: {
  page: number
  total: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (n: number) => void
  showPageSizeSelect?: boolean
}) {
  const tp = totalPagesCount(total, pageSize)
  const p = Math.min(Math.max(1, page), tp)
  return (
    <footer className="mesOpsV2TablePager">
      <span>총 {total}건</span>
      <nav className="mesOpsV2PagerNav" aria-label="페이지">
        <button type="button" className="mesOpsV2PagerBtn" disabled={p <= 1} onClick={() => onPageChange(1)} aria-label="첫 페이지">«</button>
        <button type="button" className="mesOpsV2PagerBtn" disabled={p <= 1} onClick={() => onPageChange(p - 1)} aria-label="이전">‹</button>
        {Array.from({ length: tp }, (_, i) => i + 1)
          .filter((n) => n === 1 || n === tp || Math.abs(n - p) <= 1)
          .map((n, idx, arr) => {
            const prev = arr[idx - 1]
            const ellipsis = prev != null && n - prev > 1
            return (
              <span key={n} style={{ display: 'contents' }}>
                {ellipsis ? <span className="mesOpsV2PagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}
                <button type="button" className={`mesOpsV2PagerBtn${n === p ? ' mesOpsV2PagerBtn--active' : ''}`} onClick={() => onPageChange(n)}>{n}</button>
              </span>
            )
          })}
        <button type="button" className="mesOpsV2PagerBtn" disabled={p >= tp} onClick={() => onPageChange(p + 1)} aria-label="다음">›</button>
        <button type="button" className="mesOpsV2PagerBtn" disabled={p >= tp} onClick={() => onPageChange(tp)} aria-label="마지막">»</button>
      </nav>
      <select
        className="mesOpsV2Select"
        style={{ width: 'auto', minWidth: '120px', display: showPageSizeSelect ? undefined : 'none' }}
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        aria-label="페이지당 표시 건수"
      >
        <option value={10}>10개씩 보기</option>
        <option value={20}>20개씩 보기</option>
        <option value={50}>50개씩 보기</option>
      </select>
    </footer>
  )
}

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
  const [planTablePageSize, setPlanTablePageSize] = useState(PLAN_TABLE_PAGE_SIZE)

  const [woTabPlanId, setWoTabPlanId] = useState('')
  const [woPlanQuery, setWoPlanQuery] = useState('')
  const [woPlanStatusFilter, setWoPlanStatusFilter] = useState<PlanStatus | ''>('')
  const [woPlanListPage, setWoPlanListPage] = useState(1)
  const [woTableQuery, setWoTableQuery] = useState('')
  const [woTableStatusFilter, setWoTableStatusFilter] = useState<WorkOrderStatus | ''>('')
  const [woTablePage, setWoTablePage] = useState(1)
  const [woTablePageSize, setWoTablePageSize] = useState(PLAN_TABLE_PAGE_SIZE)

  const [lotTabWoId, setLotTabWoId] = useState('')
  const [lotWoListQuery, setLotWoListQuery] = useState('')
  const [lotWoListStatusFilter, setLotWoListStatusFilter] = useState<WorkOrderStatus | ''>('')
  const [lotWoListPage, setLotWoListPage] = useState(1)
  const [lotTableQuery, setLotTableQuery] = useState('')
  const [lotTableStatusFilter, setLotTableStatusFilter] = useState<LotStatus | ''>('')
  const [lotTablePage, setLotTablePage] = useState(1)
  const [lotTablePageSize, setLotTablePageSize] = useState(PLAN_TABLE_PAGE_SIZE)

  const [invTabProductId, setInvTabProductId] = useState('')
  const [invProductQuery, setInvProductQuery] = useState('')
  const [invProductTypeFilter, setInvProductTypeFilter] = useState('')
  const [invProductListPage, setInvProductListPage] = useState(1)
  const [invShowZeroAvailLots, setInvShowZeroAvailLots] = useState(false)
  const [invStockPageSize, setInvStockPageSize] = useState(PLAN_TABLE_PAGE_SIZE)
  const [invInPageSize, setInvInPageSize] = useState(INV_TX_PAGE_SIZE)
  const [invOutPageSize, setInvOutPageSize] = useState(INV_TX_PAGE_SIZE)

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

  const planTablePages = totalPagesCount(plansForPlanTabFiltered.length, planTablePageSize)
  const planTableSafePage = Math.min(Math.max(1, planTablePage), planTablePages)
  const plansTablePageSlice = useMemo(
    () => slicePage(plansForPlanTabFiltered, planTableSafePage, planTablePageSize),
    [plansForPlanTabFiltered, planTableSafePage, planTablePageSize],
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
    if (!woTabPlanId) return null
    if (workOrdersForWoTab.length === 0) {
      const orderQty = woTabSelectedPlan?.planQty ?? 0
      return { orderQty, worked: 0, defect: 0, defectRate: 0 }
    }
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
  }, [woTabPlanId, woTabSelectedPlan, workOrdersForWoTab, lots])

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

  const woTablePages = totalPagesCount(woTableFiltered.length, woTablePageSize)
  const woTableSafePage = Math.min(Math.max(1, woTablePage), woTablePages)
  const woTablePageSlice = useMemo(
    () => slicePage(woTableFiltered, woTableSafePage, woTablePageSize),
    [woTableFiltered, woTableSafePage, woTablePageSize],
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

  const lotTabKpi = useMemo(() => {
    if (!lotTabSelectedWo) return null
    const orderQty = lotTabSelectedWo.orderQty
    const allocated = lotTabAllocation?.allocated ?? 0
    const remain = lotTabAllocation?.remain ?? orderQty
    const count = lotTabAllocation?.count ?? 0
    return { orderQty, allocated, remain, count }
  }, [lotTabSelectedWo, lotTabAllocation])

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

  const lotTablePages = totalPagesCount(lotTableFiltered.length, lotTablePageSize)
  const lotTableSafePage = Math.min(Math.max(1, lotTablePage), lotTablePages)
  const lotTablePageSlice = useMemo(
    () => slicePage(lotTableFiltered, lotTableSafePage, lotTablePageSize),
    [lotTableFiltered, lotTableSafePage, lotTablePageSize],
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
    if (activeTab === 'workOrders' && woTabSummaryProduct) {
      return inventory.filter((r) => r.productId === woTabSummaryProduct.id)
    }
    if (activeTab === 'lots' && lotTabSummaryProduct) {
      return inventory.filter((r) => r.productId === lotTabSummaryProduct.id)
    }
    return filtered.inventory
  }, [activeTab, invTabProductId, inventory, filtered.inventory, woTabSummaryProduct, lotTabSummaryProduct])

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

  const invStockRowsPages = totalPagesCount(invTabInventoryRows.length, invStockPageSize)
  const invStockRowsSafePage = Math.min(Math.max(1, invSummaryPage), invStockRowsPages)
  const invTabInventoryPageSlice = useMemo(
    () => slicePage(invTabInventoryRows, invStockRowsSafePage, invStockPageSize),
    [invTabInventoryRows, invStockRowsSafePage, invStockPageSize],
  )

  const invTabKpi = useMemo(() => {
    if (!invTabProduct) return null
    const totalReserved = invSummarySourceRows.reduce((s, r) => s + r.reservedQty, 0)
    return {
      totalQty: invSummary.totalQty,
      reservedQty: totalReserved,
      availableQty: invSummary.availableQty,
    }
  }, [invTabProduct, invSummary, invSummarySourceRows])

  const invTxFiltered = useMemo(() => {
    const pid = Number(invTabProductId)
    if (!Number.isInteger(pid) || pid < 1) return []
    return invTransactions.filter((t) => t.productId === pid)
  }, [invTransactions, invTabProductId])

  const invTxInRows = useMemo(() => invTxFiltered.filter((x) => x.transactionType === 'IN'), [invTxFiltered])
  const invTxOutEtcRows = useMemo(() => invTxFiltered.filter((x) => x.transactionType !== 'IN'), [invTxFiltered])

  const invInPages = totalPagesCount(invTxInRows.length, invInPageSize)
  const invInSafePage = Math.min(Math.max(1, invInPage), invInPages)
  const invTxInPageSlice = useMemo(
    () => slicePage(invTxInRows, invInSafePage, invInPageSize),
    [invTxInRows, invInSafePage, invInPageSize],
  )

  const invOutPages = totalPagesCount(invTxOutEtcRows.length, invOutPageSize)
  const invOutSafePage = Math.min(Math.max(1, invOutPage), invOutPages)
  const invTxOutPageSlice = useMemo(
    () => slicePage(invTxOutEtcRows, invOutSafePage, invOutPageSize),
    [invTxOutEtcRows, invOutSafePage, invOutPageSize],
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
      <header className="mesOpsV2Head">
        <div className="mesOpsV2HeadMain">
          <h1 className="mesOpsV2Title">통합 생산 운영</h1>
          <p className="mesOpsV2Desc">생산계획·작업지시·생산 LOT·재고를 탭으로 구분해 조회/등록/수정/삭제합니다.</p>
        </div>
        <div className="mesOpsV2HeadActions">
          <button type="button" className="mesOpsV2Btn mesOpsV2Btn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          {activeTab === 'plans' ? (
            <button type="button" className="mesOpsV2Btn mesOpsV2Btn--primary" onClick={openPlanCreate} disabled={!planTabProductId}>
              <IconPlus />
              계획 등록
            </button>
          ) : null}
        </div>
      </header>

      {err ? <div className="error mesBanner">{err}</div> : null}

      <section className="mesOpsTop">
        <div className="mesOpsV2Tabs" role="tablist" aria-label="통합 생산 운영 구역">
          <button type="button" role="tab" aria-selected={activeTab === 'plans'} className={`mesOpsV2Tab ${activeTab === 'plans' ? 'mesOpsV2Tab--active' : ''}`} onClick={() => setActiveTab('plans')}>
            <IconCalendar />
            생산계획
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'workOrders'} className={`mesOpsV2Tab ${activeTab === 'workOrders' ? 'mesOpsV2Tab--active' : ''}`} onClick={() => setActiveTab('workOrders')}>
            <IconDoc />
            작업지시
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'lots'} className={`mesOpsV2Tab ${activeTab === 'lots' ? 'mesOpsV2Tab--active' : ''}`} onClick={() => setActiveTab('lots')}>
            <IconBox />
            생산 LOT
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'inventory'} className={`mesOpsV2Tab ${activeTab === 'inventory' ? 'mesOpsV2Tab--active' : ''}`} onClick={() => setActiveTab('inventory')}>
            <IconMonitor />
            재고현황
          </button>
        </div>

        {activeTab === 'plans' ? (
          <div className="mesOpsV2SummaryStrip" aria-label="선택 품목 요약">
            <div className="mesOpsV2SummaryItem">
              <div className="mesOpsV2SummaryIcon"><IconTag /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품 ID</p>
                <p className="mesOpsV2SummaryVal mono">{planTabProduct?.productCode ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--name">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품명</p>
                <p className="mesOpsV2SummaryVal">{planTabProduct?.productName ?? '품목을 선택하세요'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품군</p>
                <p className="mesOpsV2SummaryVal">
                  {planTabProduct?.itemType?.trim() ? itemTypeLabel(planTabProduct.itemType) : '—'}
                  {planTabProduct?.unit ? ` · ${planTabProduct.unit}` : ''}
                </p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">기초재고</p>
                <p className="mesOpsV2SummaryVal">{invSummary.totalQty.toLocaleString()}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">가용재고</p>
                <p className="mesOpsV2SummaryVal">{invSummary.availableQty.toLocaleString()}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconShield /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">안전재고</p>
                <p className="mesOpsV2SummaryVal">{(planTabProduct?.safetyStock ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : activeTab === 'workOrders' ? (
          <div className="mesOpsV2SummaryStrip mesOpsV2SummaryStrip--wo" aria-label="선택 계획 요약">
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconTag /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품 ID</p>
                <p className="mesOpsV2SummaryVal mono">{woTabSummaryProduct?.productCode ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--name">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품명</p>
                <p className="mesOpsV2SummaryVal">
                  {woTabSelectedPlan ? (woTabSummaryProduct?.productName ?? '—') : '계획을 선택하세요'}
                </p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--plan">
              <div className="mesOpsV2SummaryIcon"><IconCalendar /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">선택계획</p>
                <p className="mesOpsV2SummaryVal mono">{woTabSelectedPlan?.planNo ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품군</p>
                <p className="mesOpsV2SummaryVal">
                  {woTabSummaryProduct?.itemType?.trim() ? itemTypeLabel(woTabSummaryProduct.itemType) : '—'}
                </p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">단위</p>
                <p className="mesOpsV2SummaryVal">{woTabSummaryProduct?.unit ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">기초재고</p>
                <p className="mesOpsV2SummaryVal">{invSummary.totalQty.toLocaleString()}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">가용재고</p>
                <p className="mesOpsV2SummaryVal">{invSummary.availableQty.toLocaleString()}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconShield /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">안전재고</p>
                <p className="mesOpsV2SummaryVal">{(woTabSummaryProduct?.safetyStock ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : activeTab === 'lots' ? (
          <div className="mesOpsV2SummaryStrip mesOpsV2SummaryStrip--lot" aria-label="선택 작업지시 요약">
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconTag /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품 ID</p>
                <p className="mesOpsV2SummaryVal mono">{lotTabSummaryProduct?.productCode ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--name">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품명</p>
                <p className="mesOpsV2SummaryVal">
                  {lotTabSelectedWo ? (lotTabSummaryProduct?.productName ?? '—') : '작업지시를 선택하세요'}
                </p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--plan">
              <div className="mesOpsV2SummaryIcon"><IconDoc /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">선택지시</p>
                <p className="mesOpsV2SummaryVal mono">{lotTabSelectedWo?.woNo ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품군</p>
                <p className="mesOpsV2SummaryVal">
                  {lotTabSummaryProduct?.itemType?.trim() ? itemTypeLabel(lotTabSummaryProduct.itemType) : '—'}
                </p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">단위</p>
                <p className="mesOpsV2SummaryVal">{lotTabSummaryProduct?.unit ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconDoc /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">지시수량</p>
                <p className="mesOpsV2SummaryVal">{lotTabSelectedWo ? lotTabSelectedWo.orderQty.toLocaleString() : '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">LOT배정</p>
                <p className="mesOpsV2SummaryVal">
                  {lotTabAllocation ? `${lotTabAllocation.count}건 · ${lotTabAllocation.allocated.toLocaleString()}` : '—'}
                </p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconShield /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">잔여배정</p>
                <p className="mesOpsV2SummaryVal">{lotTabAllocation ? lotTabAllocation.remain.toLocaleString() : '—'}</p>
              </div>
            </div>
          </div>
        ) : activeTab === 'inventory' ? (
          <div className="mesOpsV2SummaryStrip" aria-label="선택 품목 요약">
            <div className="mesOpsV2SummaryItem">
              <div className="mesOpsV2SummaryIcon"><IconTag /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품 ID</p>
                <p className="mesOpsV2SummaryVal mono">{invTabProduct?.productCode ?? '—'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--name">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품명</p>
                <p className="mesOpsV2SummaryVal">{invTabProduct?.productName ?? '품목을 선택하세요'}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">제품군</p>
                <p className="mesOpsV2SummaryVal">
                  {invTabProduct?.itemType?.trim() ? itemTypeLabel(invTabProduct.itemType) : '—'}
                  {invTabProduct?.unit ? ` · ${invTabProduct.unit}` : ''}
                </p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconBox /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">기초재고</p>
                <p className="mesOpsV2SummaryVal">{invSummary.totalQty.toLocaleString()}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconLayers /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">가용재고</p>
                <p className="mesOpsV2SummaryVal">{invSummary.availableQty.toLocaleString()}</p>
              </div>
            </div>
            <div className="mesOpsV2SummaryItem mesOpsV2SummaryItem--narrow">
              <div className="mesOpsV2SummaryIcon"><IconShield /></div>
              <div className="mesOpsV2SummaryMeta">
                <p className="mesOpsV2SummaryLabel">안전재고</p>
                <p className="mesOpsV2SummaryVal">{(invTabProduct?.safetyStock ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {activeTab === 'plans' ? (
        <div className="mesOpsPlanV2Split">
          <aside className="mesOpsV2SidePanel" aria-label="품목 목록">
            <div className="mesOpsV2SideHead">
              <IconBox />
              품목
            </div>
            <div className="mesOpsV2SideTools">
              <div className="mesOpsV2SearchWrap">
                <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                <input
                  type="search"
                  className="mesOpsV2Input mesOpsV2Input--search"
                  value={planProductQuery}
                  onChange={(e) => setPlanProductQuery(e.target.value)}
                  placeholder="코드·품명·구분 검색"
                  aria-label="품목 검색"
                />
              </div>
              <div className="mesOpsV2ToolsRow">
                <select
                  className="mesOpsV2Select"
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
                  className="mesOpsV2ResetBtn"
                  onClick={() => {
                    setPlanProductQuery('')
                    setPlanProductTypeFilter('')
                  }}
                >
                  <IconRefresh />
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsV2SideBody">
              {loading ? (
                <div className="mesOpsV2Empty">로딩 중…</div>
              ) : products.length === 0 ? (
                <div className="mesOpsV2Empty">등록된 품목이 없습니다.</div>
              ) : planTabFilteredProducts.length === 0 ? (
                <div className="mesOpsV2Empty">조건에 맞는 품목이 없습니다.</div>
              ) : (
                planProductsPageSlice.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`mesOpsV2ProductRow ${planTabProductId === String(p.id) ? 'mesOpsV2ProductRow--active' : ''}`}
                    onClick={() => {
                      setPlanTabProductId(String(p.id))
                      setSelectedProductId(String(p.id))
                    }}
                  >
                    <div className="mesOpsV2ProductRowTop">
                      <span className="mesOpsV2ProductCode">{p.productCode}</span>
                      <span className={productTypeBadgeClass(p.itemType)}>{itemTypeLabel(p.itemType)}</span>
                    </div>
                    <span className="mesOpsV2ProductName">{p.productName}</span>
                  </button>
                ))
              )}
            </div>
            <div className="mesOpsV2SidePager">
              <span>총 {planTabFilteredProducts.length}건</span>
              <div className="mesOpsV2PagerNav">
                <button type="button" className="mesOpsV2PagerBtn" disabled={planProductListSafePage <= 1} onClick={() => setPlanProductListPage(planProductListSafePage - 1)}>‹</button>
                <span>{planProductListSafePage} / {planProductListPages} 페이지</span>
                <button type="button" className="mesOpsV2PagerBtn" disabled={planProductListSafePage >= planProductListPages} onClick={() => setPlanProductListPage(planProductListSafePage + 1)}>›</button>
              </div>
            </div>
          </aside>

          <section className="mesOpsV2MainPanel">
            <div className="mesOpsV2MainHead">
              <div className="mesOpsV2MainTitleRow">
                <span className="mesOpsV2MainTitle">
                  <IconCalendar />
                  생산계획
                </span>
                {planTabProduct ? (
                  <span className="mesOpsV2ContextChip" title={`${planTabProduct.productCode} · ${planTabProduct.productName}`}>
                    {planTabProduct.productName}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mesOpsV2TableToolbar">
              <div className="mesOpsV2SearchWrap">
                <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                <input
                  type="search"
                  className="mesOpsV2Input mesOpsV2Input--search"
                  value={planTableQuery}
                  onChange={(e) => setPlanTableQuery(e.target.value)}
                  placeholder="계획번호·수량·일자·상태 검색"
                  disabled={!planTabProductId}
                  aria-label="생산계획 표 검색"
                />
              </div>
              <select
                className="mesOpsV2Select"
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
            <div className="mesOpsV2TableWrap">
              <table className="mesOpsV2Table">
                <thead>
                  <tr>
                    <th>계획번호</th>
                    <th>수량</th>
                    <th className="mesOpsV2ThSort">잔여수량</th>
                    <th className="mesOpsV2ThSort">시작일</th>
                    <th className="mesOpsV2ThSort">종료일</th>
                    <th>상태</th>
                    <th style={{ textAlign: 'right' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {!planTabProductId ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">왼쪽에서 품목을 선택하세요.</td></tr>
                  ) : loading ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">로딩 중…</td></tr>
                  ) : plansForPlanTabFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">조건에 맞는 생산계획이 없습니다.</td></tr>
                  ) : (
                    plansTablePageSlice.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.planNo}</td>
                        <td>{r.planQty.toLocaleString()}</td>
                        <td title="계획수량 − 해당 계획 작업지시 LOT 양품 합계">
                          {(r.planQty - (planConsumedGoodQtyByPlanId.get(r.id) ?? 0)).toLocaleString()}
                        </td>
                        <td>{String(r.startDate).slice(0, 10)}</td>
                        <td>{String(r.endDate).slice(0, 10)}</td>
                        <td>
                          <span className={planStatusBadgeClass(r.status)}>{planStatusLabel(r.status)}</span>
                        </td>
                        <td>
                          <div className="mesOpsV2RowActions">
                            <button type="button" className="mesOpsV2ActionBtn" onClick={() => openPlanEdit(r)}>
                              <IconEdit />
                              수정
                            </button>
                            <button type="button" className="mesOpsV2ActionBtn mesOpsV2ActionBtn--danger" onClick={() => void removePlan(r.id)}>
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
            <PlanTablePager
              page={planTableSafePage}
              total={plansForPlanTabFiltered.length}
              pageSize={planTablePageSize}
              onPageChange={setPlanTablePage}
              onPageSizeChange={(n) => {
                setPlanTablePageSize(n)
                setPlanTablePage(1)
              }}
            />
          </section>
        </div>
      ) : null}

      {activeTab === 'workOrders' ? (
        <div className="mesOpsPlanV2Split">
          <aside className="mesOpsV2SidePanel" aria-label="생산계획 목록">
            <div className="mesOpsV2SideHead">
              <IconCalendar />
              생산계획
            </div>
            <div className="mesOpsV2SideTools">
              <div className="mesOpsV2SearchWrap">
                <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                <input
                  type="search"
                  className="mesOpsV2Input mesOpsV2Input--search"
                  value={woPlanQuery}
                  onChange={(e) => setWoPlanQuery(e.target.value)}
                  placeholder="계획번호·품목·상태 검색"
                  aria-label="생산계획 검색"
                />
              </div>
              <div className="mesOpsV2ToolsRow">
                <select
                  className="mesOpsV2Select"
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
                  className="mesOpsV2ResetBtn"
                  onClick={() => {
                    setWoPlanQuery('')
                    setWoPlanStatusFilter('')
                  }}
                >
                  <IconRefresh />
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsV2SideBody">
              {loading ? (
                <div className="mesOpsV2Empty">로딩 중…</div>
              ) : woTabPlansFiltered.length === 0 ? (
                <div className="mesOpsV2Empty">등록된 생산계획이 없습니다.</div>
              ) : (
                woPlansPageSlice.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    className={`mesOpsV2PlanPickRow ${woTabPlanId === String(pl.id) ? 'mesOpsV2PlanPickRow--active' : ''}`}
                    onClick={() => {
                      setWoTabPlanId(String(pl.id))
                      setSelectedProductId(String(pl.productId))
                    }}
                  >
                    <div className="mesOpsV2ProductRowTop">
                      <span className="mesOpsV2ProductCode">{pl.planNo}</span>
                      <span className={planStatusBadgeClass(pl.status)}>{planStatusLabel(pl.status)}</span>
                    </div>
                    <span className="mesOpsV2ProductName">
                      {pl.product ? pl.product.productName : `품목#${pl.productId}`}
                    </span>
                    <span className="mesOpsV2PlanPickMeta">
                      수량 {pl.planQty.toLocaleString()} · {String(pl.startDate).slice(0, 10)} ~ {String(pl.endDate).slice(0, 10)}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="mesOpsV2SidePager">
              <span>총 {woTabPlansFiltered.length}건</span>
              <div className="mesOpsV2PagerNav">
                <button type="button" className="mesOpsV2PagerBtn" disabled={woPlanListSafePage <= 1} onClick={() => setWoPlanListPage(woPlanListSafePage - 1)}>‹</button>
                <span>{woPlanListSafePage} / {woPlanListPages} 페이지</span>
                <button type="button" className="mesOpsV2PagerBtn" disabled={woPlanListSafePage >= woPlanListPages} onClick={() => setWoPlanListPage(woPlanListSafePage + 1)}>›</button>
              </div>
            </div>
          </aside>

          <section className="mesOpsV2MainPanel">
            <div className="mesOpsV2MainHead">
              <div className="mesOpsV2MainTitleRow">
                <span className="mesOpsV2MainTitle">
                  <IconDoc />
                  작업지시
                  {woTabSelectedPlan ? (
                    <span className="mesOpsV2WoTitleSep">· {woTabSelectedPlan.planNo}</span>
                  ) : null}
                </span>
              </div>
              <button type="button" className="mesOpsV2Btn mesOpsV2Btn--info mesOpsV2Btn--compact" onClick={openWoCreate} disabled={!woTabPlanId}>
                <IconPlus />
                지시 등록
              </button>
            </div>

            {woTabKpi ? (
              <div className="mesOpsV2KpiStrip" aria-label="작업지시 요약">
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--blue"><IconDoc /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">지시 수량</p>
                    <p className="mesOpsV2KpiVal">{woTabKpi.orderQty.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--green"><IconCog /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">현재 작업량</p>
                    <p className="mesOpsV2KpiVal">{woTabKpi.worked.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--purple"><IconAlert /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">불량수량 / 불량률</p>
                    <p className="mesOpsV2KpiVal">
                      {woTabKpi.defect.toLocaleString()}
                      <span className="mesOpsV2KpiSub"> ({woTabKpi.defectRate}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mesOpsV2TableToolbar">
              <div className="mesOpsV2SearchWrap">
                <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                <input
                  type="search"
                  className="mesOpsV2Input mesOpsV2Input--search"
                  value={woTableQuery}
                  onChange={(e) => setWoTableQuery(e.target.value)}
                  placeholder="지시번호·품목·작업장·작업자·상태 검색"
                  disabled={!woTabPlanId}
                  aria-label="작업지시 표 검색"
                />
              </div>
              <select
                className="mesOpsV2Select"
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

            <div className="mesOpsV2TableWrap">
              <table className="mesOpsV2Table">
                <thead>
                  <tr>
                    <th>작업지시번호</th>
                    <th>생산품목</th>
                    <th>작업장</th>
                    <th>작업자</th>
                    <th>수량</th>
                    <th>진행상태</th>
                    <th style={{ textAlign: 'right' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {!woTabPlanId ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">왼쪽에서 생산계획을 선택하세요.</td></tr>
                  ) : loading ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">로딩 중…</td></tr>
                  ) : woTableFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">이 계획에 연결된 작업지시가 없거나, 조건에 맞는 행이 없습니다.</td></tr>
                  ) : (
                    woTablePageSlice.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.woNo}</td>
                        <td>{r.product?.productName ?? `품목#${r.productId}`}</td>
                        <td>{r.workCenter?.centerName ?? '—'}</td>
                        <td className="mesTdEllipsis" title={workerNamesShort(r)}>{workerNamesShort(r)}</td>
                        <td>{r.orderQty.toLocaleString()}</td>
                        <td>
                          <span className={woStatusBadgeClass(r.status)}>{woStatusLabel(r.status)}</span>
                          {r.status === 'HOLD' && r.holdReason ? (
                            <div className="muted small" title={r.holdReason}>
                              {r.holdReason.length > 24 ? `${r.holdReason.slice(0, 24)}…` : r.holdReason}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div className="mesOpsV2RowActions" style={{ justifyContent: 'flex-end' }}>
                            <button type="button" className="mesOpsV2ActionBtn" onClick={() => openWoEdit(r)}>
                              <IconEdit />
                              수정
                            </button>
                            <button type="button" className="mesOpsV2ActionBtn mesOpsV2ActionBtn--danger" onClick={() => void removeWo(r.id)}>
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
            <PlanTablePager
              page={woTableSafePage}
              total={woTableFiltered.length}
              pageSize={woTablePageSize}
              onPageChange={setWoTablePage}
              onPageSizeChange={(n) => {
                setWoTablePageSize(n)
                setWoTablePage(1)
              }}
            />
          </section>
        </div>
      ) : null}

      {activeTab === 'lots' ? (
        <div className="mesOpsPlanV2Split">
          <aside className="mesOpsV2SidePanel" aria-label="작업지시 목록">
            <div className="mesOpsV2SideHead">
              <IconDoc />
              작업지시
            </div>
            <div className="mesOpsV2SideTools">
              <div className="mesOpsV2SearchWrap">
                <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                <input
                  type="search"
                  className="mesOpsV2Input mesOpsV2Input--search"
                  value={lotWoListQuery}
                  onChange={(e) => setLotWoListQuery(e.target.value)}
                  placeholder="지시번호·품목·계획·작업장 검색"
                  aria-label="작업지시 검색"
                />
              </div>
              <div className="mesOpsV2ToolsRow">
                <select
                  className="mesOpsV2Select"
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
                  className="mesOpsV2ResetBtn"
                  onClick={() => {
                    setLotWoListQuery('')
                    setLotWoListStatusFilter('')
                  }}
                >
                  <IconRefresh />
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsV2SideBody">
              {loading ? (
                <div className="mesOpsV2Empty">로딩 중…</div>
              ) : lotTabWorkOrdersFiltered.length === 0 ? (
                <div className="mesOpsV2Empty">등록된 작업지시가 없습니다.</div>
              ) : (
                lotWoListPageSlice.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`mesOpsV2PlanPickRow ${lotTabWoId === String(w.id) ? 'mesOpsV2PlanPickRow--active' : ''}`}
                    onClick={() => {
                      setLotTabWoId(String(w.id))
                      setSelectedProductId(String(w.productId))
                    }}
                  >
                    <div className="mesOpsV2ProductRowTop">
                      <span className="mesOpsV2ProductCode">{w.woNo}</span>
                      <span className={woStatusBadgeClass(w.status)}>{woStatusLabel(w.status)}</span>
                    </div>
                    <span className="mesOpsV2ProductName">
                      {w.product ? w.product.productName : `품목#${w.productId}`}
                    </span>
                    <span className="mesOpsV2PlanPickMeta">
                      수량 {w.orderQty.toLocaleString()}
                      {` · LOT ${woLotCount(lots, w.id)}건`}
                      {w.planId != null && planById.get(w.planId) ? ` · 계획 ${planById.get(w.planId)!.planNo}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="mesOpsV2SidePager">
              <span>총 {lotTabWorkOrdersFiltered.length}건</span>
              <div className="mesOpsV2PagerNav">
                <button type="button" className="mesOpsV2PagerBtn" disabled={lotWoListSafePage <= 1} onClick={() => setLotWoListPage(lotWoListSafePage - 1)}>‹</button>
                <span>{lotWoListSafePage} / {lotWoListPages} 페이지</span>
                <button type="button" className="mesOpsV2PagerBtn" disabled={lotWoListSafePage >= lotWoListPages} onClick={() => setLotWoListPage(lotWoListSafePage + 1)}>›</button>
              </div>
            </div>
          </aside>

          <section className="mesOpsV2MainPanel">
            <div className="mesOpsV2MainHead">
              <div className="mesOpsV2MainTitleRow">
                <span className="mesOpsV2MainTitle">
                  <IconBox />
                  생산 LOT
                  {lotTabSelectedWo ? (
                    <span className="mesOpsV2WoTitleSep">· {lotTabSelectedWo.woNo}</span>
                  ) : null}
                </span>
              </div>
              <button
                type="button"
                className="mesOpsV2Btn mesOpsV2Btn--primary mesOpsV2Btn--compact"
                onClick={openLotCreate}
                disabled={!lotTabWoId}
                title={
                  lotTabAllocation && lotTabAllocation.remain <= 0
                    ? '잔여 배정 0 — 클릭하면 안내를 확인할 수 있습니다'
                    : undefined
                }
              >
                <IconPlus />
                LOT 등록
              </button>
            </div>

            {lotTabKpi ? (
              <div className="mesOpsV2KpiStrip" aria-label="LOT 배정 요약">
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--blue"><IconDoc /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">지시 수량</p>
                    <p className="mesOpsV2KpiVal">{lotTabKpi.orderQty.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--green"><IconLayers /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">LOT 배정</p>
                    <p className="mesOpsV2KpiVal">
                      {lotTabKpi.allocated.toLocaleString()}
                      <span className="mesOpsV2KpiSub"> ({lotTabKpi.count}건)</span>
                    </p>
                  </div>
                </div>
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--purple"><IconShield /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">잔여 배정</p>
                    <p className="mesOpsV2KpiVal">{lotTabKpi.remain.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mesOpsV2TableToolbar">
              <div className="mesOpsV2SearchWrap">
                <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                <input
                  type="search"
                  className="mesOpsV2Input mesOpsV2Input--search"
                  value={lotTableQuery}
                  onChange={(e) => setLotTableQuery(e.target.value)}
                  placeholder="LOT번호·수량·양품·불량·잔여·상태 검색"
                  disabled={!lotTabWoId}
                  aria-label="생산 LOT 표 검색"
                />
              </div>
              <select
                className="mesOpsV2Select"
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

            <div className="mesOpsV2TableWrap">
              <table className="mesOpsV2Table">
                <thead>
                  <tr>
                    <th>LOT번호</th>
                    <th>LOT수량</th>
                    <th>양품</th>
                    <th>불량</th>
                    <th>잔여 작업량</th>
                    <th>상태</th>
                    <th style={{ textAlign: 'right' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {!lotTabWoId ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">왼쪽에서 작업지시를 선택하세요.</td></tr>
                  ) : loading ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">로딩 중…</td></tr>
                  ) : lotTableFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="mesOpsV2Empty">이 지시에 연결된 LOT이 없거나, 조건에 맞는 행이 없습니다.</td></tr>
                  ) : (
                    lotTablePageSlice.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.lotNo}</td>
                        <td>{r.lotQty.toLocaleString()}</td>
                        <td>{r.goodQty.toLocaleString()}</td>
                        <td>{r.defectQty.toLocaleString()}</td>
                        <td>{lotRemainingWorkDisplay(r).toLocaleString()}</td>
                        <td>
                          <span className={lotStatusBadgeClass(r.status)}>{lotStatusLabel(r.status)}</span>
                        </td>
                        <td>
                          <div className="mesOpsV2RowActions" style={{ justifyContent: 'flex-end' }}>
                            <button type="button" className="mesOpsV2ActionBtn" onClick={() => openLotEdit(r)}>
                              <IconEdit />
                              수정
                            </button>
                            <button type="button" className="mesOpsV2ActionBtn mesOpsV2ActionBtn--danger" onClick={() => void removeLot(r.id)}>
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
            <PlanTablePager
              page={lotTableSafePage}
              total={lotTableFiltered.length}
              pageSize={lotTablePageSize}
              onPageChange={setLotTablePage}
              onPageSizeChange={(n) => {
                setLotTablePageSize(n)
                setLotTablePage(1)
              }}
            />
          </section>
        </div>
      ) : null}

      {activeTab === 'inventory' ? (
        <div className="mesOpsPlanV2Split">
          <aside className="mesOpsV2SidePanel" aria-label="품목 목록">
            <div className="mesOpsV2SideHead">
              <IconBox />
              품목
            </div>
            <div className="mesOpsV2SideTools">
              <div className="mesOpsV2SearchWrap">
                <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                <input
                  type="search"
                  className="mesOpsV2Input mesOpsV2Input--search"
                  value={invProductQuery}
                  onChange={(e) => setInvProductQuery(e.target.value)}
                  placeholder="코드·품명·구분 검색"
                  aria-label="재고 탭 품목 검색"
                />
              </div>
              <div className="mesOpsV2ToolsRow">
                <select
                  className="mesOpsV2Select"
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
                  className="mesOpsV2ResetBtn"
                  onClick={() => {
                    setInvProductQuery('')
                    setInvProductTypeFilter('')
                  }}
                >
                  <IconRefresh />
                  초기화
                </button>
              </div>
            </div>
            <div className="mesOpsV2SideBody">
              {loading ? (
                <div className="mesOpsV2Empty">로딩 중…</div>
              ) : products.length === 0 ? (
                <div className="mesOpsV2Empty">등록된 품목이 없습니다.</div>
              ) : invTabFilteredProducts.length === 0 ? (
                <div className="mesOpsV2Empty">조건에 맞는 품목이 없습니다.</div>
              ) : (
                invProductsPageSlice.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`mesOpsV2ProductRow ${invTabProductId === String(p.id) ? 'mesOpsV2ProductRow--active' : ''}`}
                    onClick={() => setInvTabProductId(String(p.id))}
                  >
                    <div className="mesOpsV2ProductRowTop">
                      <span className="mesOpsV2ProductCode">{p.productCode}</span>
                      <span className={productTypeBadgeClass(p.itemType)}>{itemTypeLabel(p.itemType)}</span>
                    </div>
                    <span className="mesOpsV2ProductName">{p.productName}</span>
                  </button>
                ))
              )}
            </div>
            <div className="mesOpsV2SidePager">
              <span>총 {invTabFilteredProducts.length}건</span>
              <div className="mesOpsV2PagerNav">
                <button type="button" className="mesOpsV2PagerBtn" disabled={invProductListSafePage <= 1} onClick={() => setInvProductListPage(invProductListSafePage - 1)}>‹</button>
                <span>{invProductListSafePage} / {invProductListPages} 페이지</span>
                <button type="button" className="mesOpsV2PagerBtn" disabled={invProductListSafePage >= invProductListPages} onClick={() => setInvProductListPage(invProductListSafePage + 1)}>›</button>
              </div>
            </div>
          </aside>

          <section className="mesOpsV2MainPanel mesOpsV2MainPanel--inv">
            <div className="mesOpsV2MainHead">
              <div className="mesOpsV2MainTitleRow">
                <span className="mesOpsV2MainTitle">
                  <IconMonitor />
                  재고현황
                </span>
                {invTabProduct ? (
                  <span className="mesOpsV2ContextChip" title={`${invTabProduct.productCode} · ${invTabProduct.productName}`}>
                    {invTabProduct.productName}
                  </span>
                ) : null}
              </div>
            </div>

            {invTabKpi ? (
              <div className="mesOpsV2KpiStrip" aria-label="재고 요약">
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--blue"><IconBox /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">기초재고</p>
                    <p className="mesOpsV2KpiVal">{invTabKpi.totalQty.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--purple"><IconLayers /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">예약재고</p>
                    <p className="mesOpsV2KpiVal">{invTabKpi.reservedQty.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mesOpsV2KpiCard">
                  <div className="mesOpsV2KpiIcon mesOpsV2KpiIcon--green"><IconShield /></div>
                  <div className="mesOpsV2KpiMeta">
                    <p className="mesOpsV2KpiLabel">가용재고</p>
                    <p className="mesOpsV2KpiVal">{invTabKpi.availableQty.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mesOpsV2InvStack">
              <div className="mesOpsV2InvSection">
                <div className="mesOpsV2InvSectionHead">
                  <h3 className="mesOpsV2InvSubHead">재고 (LOT별)</h3>
                  <label className="mesOpsV2CheckLabel">
                    <input
                      type="checkbox"
                      checked={invShowZeroAvailLots}
                      onChange={(e) => setInvShowZeroAvailLots(e.target.checked)}
                    />
                    <span>가용 0 LOT도 표시</span>
                  </label>
                </div>
                <div className="mesOpsV2TableWrap mesOpsV2TableWrap--inv">
                  <table className="mesOpsV2Table">
                    <thead>
                      <tr><th>LOT</th><th>수량</th><th>예약</th><th>가용</th><th>상태</th></tr>
                    </thead>
                    <tbody>
                      {!invTabProductId ? (
                        <tr><td colSpan={5} className="mesOpsV2Empty">왼쪽에서 품목을 선택하세요.</td></tr>
                      ) : loading ? (
                        <tr><td colSpan={5} className="mesOpsV2Empty">로딩 중…</td></tr>
                      ) : invTabInventoryRows.length === 0 ? (
                        <tr><td colSpan={5} className="mesOpsV2Empty">해당 품목의 재고 행이 없습니다.</td></tr>
                      ) : (
                        invTabInventoryPageSlice.map((r) => (
                          <tr key={r.id}>
                            <td className="mono">{r.lot?.lotNo ?? r.materialLot?.lotNo ?? '—'}</td>
                            <td>{r.qty.toLocaleString()}</td>
                            <td>{r.reservedQty.toLocaleString()}</td>
                            <td>{(r.qty - r.reservedQty).toLocaleString()}</td>
                            <td><span className="mesOpsV2InvStatus">{r.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PlanTablePager
                  page={invStockRowsSafePage}
                  total={invTabInventoryRows.length}
                  pageSize={invStockPageSize}
                  onPageChange={setInvSummaryPage}
                  onPageSizeChange={(n) => {
                    setInvStockPageSize(n)
                    setInvSummaryPage(1)
                  }}
                />
              </div>

              <div className="mesOpsV2InvSection">
                <div className="mesOpsV2InvSectionHead">
                  <h3 className="mesOpsV2InvSubHead">입고 내역</h3>
                </div>
                <div className="mesOpsV2TableWrap mesOpsV2TableWrap--inv">
                  <table className="mesOpsV2Table">
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
                        <tr><td colSpan={6} className="mesOpsV2Empty">왼쪽에서 품목을 선택하세요.</td></tr>
                      ) : loading ? (
                        <tr><td colSpan={6} className="mesOpsV2Empty">로딩 중…</td></tr>
                      ) : invTxInRows.length === 0 ? (
                        <tr><td colSpan={6} className="mesOpsV2Empty">입고 이력이 없습니다.</td></tr>
                      ) : (
                        invTxInPageSlice.map((r) => (
                          <tr key={r.id}>
                            <td className="muted small">{formatInvTxWhen(r.createdAt)}</td>
                            <td>{invTxProductNameCell(r)}</td>
                            <td>{r.qty.toLocaleString()}</td>
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
                <PlanTablePager
                  page={invInSafePage}
                  total={invTxInRows.length}
                  pageSize={invInPageSize}
                  onPageChange={setInvInPage}
                  onPageSizeChange={(n) => {
                    setInvInPageSize(n)
                    setInvInPage(1)
                  }}
                />
              </div>

              <div className="mesOpsV2InvSection">
                <div className="mesOpsV2InvSectionHead">
                  <h3 className="mesOpsV2InvSubHead">출고 · 이동 · 조정</h3>
                </div>
                <div className="mesOpsV2TableWrap mesOpsV2TableWrap--inv">
                  <table className="mesOpsV2Table">
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
                        <tr><td colSpan={7} className="mesOpsV2Empty">왼쪽에서 품목을 선택하세요.</td></tr>
                      ) : loading ? (
                        <tr><td colSpan={7} className="mesOpsV2Empty">로딩 중…</td></tr>
                      ) : invTxOutEtcRows.length === 0 ? (
                        <tr><td colSpan={7} className="mesOpsV2Empty">출고·이동·조정 이력이 없습니다.</td></tr>
                      ) : (
                        invTxOutPageSlice.map((r) => (
                          <tr key={r.id}>
                            <td className="muted small">{formatInvTxWhen(r.createdAt)}</td>
                            <td><span className="mesOpsV2InvTxType">{invTxTypeLabel(r.transactionType)}</span></td>
                            <td>{invTxProductNameCell(r)}</td>
                            <td>{r.qty.toLocaleString()}</td>
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
                <PlanTablePager
                  page={invOutSafePage}
                  total={invTxOutEtcRows.length}
                  pageSize={invOutPageSize}
                  onPageChange={setInvOutPage}
                  onPageSizeChange={(n) => {
                    setInvOutPageSize(n)
                    setInvOutPage(1)
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {planPanel ? (
        <div className="mesModalRoot mesOpsPlanModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setPlanPanel(false)} />
          <div className="mesOpsPlanModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-plan-modal-title">
            <header className="mesOpsPlanModalHead">
              <div className="mesOpsPlanModalHeadTitle">
                <span className="mesOpsPlanModalHeadIcon"><IconCalendar /></span>
                <div>
                  <h2 className="mesOpsPlanModalTitle" id="mes-plan-modal-title">
                    {editingPlanId == null ? '생산계획 등록' : '생산계획 수정'}
                  </h2>
                  <p className="mesOpsPlanModalSub">
                    {editingPlanId == null ? '생산계획 기준정보를 입력합니다.' : `계획 ID ${editingPlanId}`}
                  </p>
                </div>
              </div>
              <span className={`mesOpsPlanModalStatus ${planStatusBadgeClass(planForm.status)}`}>{planStatusLabel(planForm.status)}</span>
            </header>

            <div className="mesOpsPlanModalBody">
              <div className="mesOpsPlanModalStrip" aria-label="품목 참고 정보">
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">품목코드</span>
                  <strong className="mesOpsPlanModalStripVal mono">{selectedPlanProduct?.productCode ?? '—'}</strong>
                </div>
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">기준단위</span>
                  <strong className="mesOpsPlanModalStripVal">{selectedPlanProduct?.unit ?? '—'}</strong>
                </div>
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">안전재고</span>
                  <strong className="mesOpsPlanModalStripVal">
                    {selectedPlanProduct?.safetyStock != null ? selectedPlanProduct.safetyStock.toLocaleString() : '—'}
                  </strong>
                </div>
              </div>

              <div className="mesOpsPlanModalGrid">
                <section className="mesOpsPlanModalCard">
                  <h3 className="mesOpsPlanModalCardTitle">계획 기본정보</h3>
                  <div className="mesOpsPlanModalFieldGrid">
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">계획번호</span>
                      <input
                        className="mesOpsPlanModalInput mono"
                        value={planForm.planNo}
                        disabled={editingPlanId != null}
                        onChange={(e) => setPlanForm((f) => ({ ...f, planNo: e.target.value }))}
                      />
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">계획수량</span>
                      <input
                        className="mesOpsPlanModalInput"
                        value={planForm.planQty}
                        onChange={(e) => setPlanForm((f) => ({ ...f, planQty: e.target.value }))}
                      />
                    </label>
                    <label className="mesOpsPlanModalField mesOpsPlanModalField--product">
                      <span className="mesOpsPlanModalFieldLabel">품목</span>
                      <select
                        className="mesOpsPlanModalInput mesOpsPlanModalSelect"
                        value={planForm.productId}
                        onChange={(e) => setPlanForm((f) => ({ ...f, productId: e.target.value }))}
                      >
                        <option value="">선택</option>
                        {products.map((p) => (
                          <option key={p.id} value={String(p.id)}>{p.productCode} · {p.productName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">상태</span>
                      <select
                        className="mesOpsPlanModalInput"
                        value={planForm.status}
                        onChange={(e) => setPlanForm((f) => ({ ...f, status: e.target.value as PlanStatus }))}
                      >
                        {planStatuses.map((s) => (
                          <option key={s} value={s}>{planStatusLabel(s)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">시작일</span>
                      <input
                        className="mesOpsPlanModalInput"
                        type="date"
                        value={planForm.startDate}
                        onChange={(e) => setPlanForm((f) => ({ ...f, startDate: e.target.value }))}
                      />
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">종료일</span>
                      <input
                        className="mesOpsPlanModalInput"
                        type="date"
                        value={planForm.endDate}
                        onChange={(e) => setPlanForm((f) => ({ ...f, endDate: e.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="mesOpsPlanModalCard mesOpsPlanModalCard--summary">
                  <h3 className="mesOpsPlanModalCardTitle">계획 정보 요약</h3>
                  <div className="mesOpsPlanModalInfoList">
                    <div className="mesOpsPlanModalInfoRow">
                      <span>품목명</span>
                      <strong>{selectedPlanProduct?.productName ?? '—'}</strong>
                    </div>
                    <div className="mesOpsPlanModalInfoRow">
                      <span>계획수량·포장</span>
                      <strong className="mono">{planModalQtyPackingLine}</strong>
                    </div>
                    <div className="mesOpsPlanModalInfoRow">
                      <span>분류</span>
                      <strong>{selectedPlanProduct?.itemType?.trim() ? itemTypeLabel(selectedPlanProduct.itemType) : '—'}</strong>
                    </div>
                    <div className="mesOpsPlanModalInfoRow">
                      <span>기간</span>
                      <strong>
                        {planForm.startDate && planForm.endDate ? `${planForm.startDate} ~ ${planForm.endDate}` : '—'}
                      </strong>
                    </div>
                    <div className="mesOpsPlanModalInfoRow">
                      <span>상태</span>
                      <strong>{planStatusLabel(planForm.status)}</strong>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <footer className="mesOpsPlanModalFoot">
              <button type="button" className="mesOpsPlanModalBtn mesOpsPlanModalBtn--cancel" disabled={saving} onClick={() => setPlanPanel(false)}>
                <IconX />
                취소
              </button>
              <button type="button" className="mesOpsPlanModalBtn mesOpsPlanModalBtn--save" disabled={saving} onClick={() => void savePlan()}>
                <IconSave />
                {saving ? '저장 중…' : '저장'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {woPanel ? (
        <div className="mesOpsPlanModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setWoPanel(false)} />
          <div className="mesOpsPlanModalDialog mesOpsPlanModalDialog--wide" role="dialog" aria-modal="true" aria-labelledby="mes-wo-modal-title">
            <header className="mesOpsPlanModalHead">
              <div className="mesOpsPlanModalHeadTitle">
                <span className="mesOpsPlanModalHeadIcon mesOpsPlanModalHeadIcon--info"><IconDoc /></span>
                <div>
                  <h2 className="mesOpsPlanModalTitle" id="mes-wo-modal-title">
                    {editingWoId == null ? '작업지시 등록' : '작업지시 수정'}
                  </h2>
                  <p className="mesOpsPlanModalSub">
                    작업지시 기본정보와 배정 작업자를 입력합니다. 생산 LOT는 「생산 LOT」 탭에서 별도 등록합니다.
                  </p>
                </div>
              </div>
              <span className={`mesOpsPlanModalStatus ${woStatusBadgeClass(woForm.status)}`}>{woStatusLabel(woForm.status)}</span>
            </header>

            <div className="mesOpsPlanModalBody">
              <div className="mesOpsPlanModalStrip" aria-label="계획 참고 정보">
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">계획번호</span>
                  <strong className="mesOpsPlanModalStripVal mono">{selectedWoPlan?.planNo ?? '—'}</strong>
                </div>
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">품목코드</span>
                  <strong className="mesOpsPlanModalStripVal mono">{selectedWoProduct?.productCode ?? '—'}</strong>
                </div>
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">지시수량</span>
                  <strong className="mesOpsPlanModalStripVal">{woForm.orderQty || '—'}</strong>
                </div>
              </div>

              <div className="mesOpsPlanModalGrid">
                <section className="mesOpsPlanModalCard">
                  <h3 className="mesOpsPlanModalCardTitle">작업지시 입력</h3>
                  <div className="mesOpsPlanModalFieldGrid">
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">지시번호</span>
                      <input
                        className="mesOpsPlanModalInput mono"
                        value={woForm.woNo}
                        disabled={editingWoId != null}
                        onChange={(e) => setWoForm((f) => ({ ...f, woNo: e.target.value }))}
                      />
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">지시수량</span>
                      <input
                        className="mesOpsPlanModalInput"
                        value={woForm.orderQty}
                        onChange={(e) => setWoForm((f) => ({ ...f, orderQty: e.target.value }))}
                      />
                    </label>
                    <label className="mesOpsPlanModalField mesOpsPlanModalField--product">
                      <span className="mesOpsPlanModalFieldLabel">계획</span>
                      <select
                        className="mesOpsPlanModalInput mesOpsPlanModalSelect"
                        value={woForm.planId}
                        onChange={(e) => setWoForm((f) => ({ ...f, planId: e.target.value }))}
                      >
                        <option value="">선택</option>
                        {filtered.plans.map((p) => (
                          <option key={p.id} value={String(p.id)}>{p.planNo} · {p.product?.productName ?? `품목#${p.productId}`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">배정 라인</span>
                      <select
                        className="mesOpsPlanModalInput mesOpsPlanModalSelect"
                        value={woForm.workCenterId}
                        onChange={(e) => setWoForm((f) => ({ ...f, workCenterId: e.target.value }))}
                      >
                        <option value="">라인 선택</option>
                        {workCenters.map((w) => (
                          <option key={w.id} value={String(w.id)}>{w.centerCode} · {w.centerName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">상태</span>
                      <select
                        className="mesOpsPlanModalInput"
                        value={woForm.status}
                        onChange={(e) => {
                          const next = e.target.value as WorkOrderStatus
                          setWoForm((f) => ({
                            ...f,
                            status: next,
                            holdReason: next === 'HOLD' ? f.holdReason : '',
                          }))
                        }}
                      >
                        {woStatuses.map((s) => (
                          <option key={s} value={s}>{woStatusLabel(s)}</option>
                        ))}
                      </select>
                    </label>
                    {woForm.status === 'HOLD' ? (
                      <label className="mesOpsPlanModalField mesOpsPlanModalField--product">
                        <span className="mesOpsPlanModalFieldLabel">보류 사유</span>
                        <textarea
                          className="mesOpsPlanModalInput mesOpsPlanModalTextarea"
                          rows={3}
                          value={woForm.holdReason}
                          placeholder="예) 금형 점검으로 인한 작업 일시 중단"
                          onChange={(e) => setWoForm((f) => ({ ...f, holdReason: e.target.value }))}
                        />
                      </label>
                    ) : null}
                  </div>
                </section>

                <section className="mesOpsPlanModalCard mesOpsPlanModalCard--summary">
                  <h3 className="mesOpsPlanModalCardTitle">품목 정보</h3>
                  <div className="mesOpsPlanModalInfoList">
                    <div className="mesOpsPlanModalInfoRow"><span>품목명</span><strong>{selectedWoProduct?.productName ?? '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>품목구분</span><strong>{selectedWoProduct?.itemType?.trim() ? itemTypeLabel(selectedWoProduct.itemType) : '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>단위</span><strong>{selectedWoProduct?.unit ?? '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>배정라인</span><strong>{selectedWoCenter ? `${selectedWoCenter.centerCode} · ${selectedWoCenter.centerName}` : '미지정'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>안전재고</span><strong>{selectedWoProduct?.safetyStock ?? '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>계획수량</span><strong>{selectedWoPlan?.planQty ?? '—'}</strong></div>
                    {editingWoLotAllocation ? (
                      <>
                        <div className="mesOpsPlanModalInfoRow"><span>LOT 건수</span><strong>{editingWoLotAllocation.count}건</strong></div>
                        <div className="mesOpsPlanModalInfoRow"><span>LOT 배정</span><strong>{editingWoLotAllocation.allocated} / {editingWoLotAllocation.orderQty}</strong></div>
                        <div className="mesOpsPlanModalInfoRow"><span>잔여 배정</span><strong>{editingWoLotAllocation.remain}</strong></div>
                      </>
                    ) : (
                      <div className="mesOpsPlanModalInfoRow"><span>LOT</span><strong className="mesOpsPlanModalMuted">저장 후 「생산 LOT」 탭에서 등록</strong></div>
                    )}
                  </div>
                </section>
              </div>

              <section className="mesOpsPlanModalWorker">
                <div className="mesOpsPlanModalWorkerHead">
                  <h3 className="mesOpsPlanModalCardTitle">배정 작업자 (복수 선택)</h3>
                  <p className="mesOpsPlanModalWorkerMeta">
                    라인 {selectedWoCenter?.centerCode ?? '미지정'} · 계획 {selectedWoPlan?.planNo ?? '미선택'} · 선택 {woForm.workerIds.length}명
                  </p>
                </div>
                <div className="mesOpsPlanModalWorkerTools">
                  <div className="mesOpsPlanModalWorkerSearch">
                    <span className="mesOpsV2SearchIcon"><IconSearch /></span>
                    <input
                      className="mesOpsPlanModalInput"
                      value={woWorkerQuery}
                      onChange={(e) => setWoWorkerQuery(e.target.value)}
                      placeholder="작업자 코드/이름 검색"
                    />
                  </div>
                  <label className="mesOpsPlanModalCheck">
                    <input type="checkbox" checked={woOnlyActive} onChange={(e) => setWoOnlyActive(e.target.checked)} />
                    <span>활성만</span>
                  </label>
                  <button
                    type="button"
                    className="mesOpsPlanModalToolBtn"
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
                    className="mesOpsPlanModalToolBtn"
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
                <div className="mesOpsPlanModalWorkerGrid">
                  {woSelectableWorkers.length === 0 ? (
                    <div className="mesOpsPlanModalMuted">조건에 맞는 작업자가 없습니다.</div>
                  ) : (
                    woSelectableWorkers.map((w) => (
                      <label key={w.id} className="mesOpsPlanModalWorkerItem">
                        <input
                          type="checkbox"
                          checked={woForm.workerIds.includes(w.id)}
                          onChange={() => setWoForm((f) => ({ ...f, workerIds: toggleId(f.workerIds, w.id) }))}
                        />
                        <span>
                          <span className="mono">{w.workerCode}</span> {w.workerName}
                          {w.status !== 'ACTIVE' ? <span className="mesOpsPlanModalMuted"> ({w.status})</span> : null}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </section>
            </div>

            <footer className="mesOpsPlanModalFoot">
              <button type="button" className="mesOpsPlanModalBtn mesOpsPlanModalBtn--cancel" disabled={saving} onClick={() => setWoPanel(false)}>
                <IconX />
                취소
              </button>
              <button type="button" className="mesOpsPlanModalBtn mesOpsPlanModalBtn--save" disabled={saving} onClick={() => void saveWo()}>
                <IconSave />
                {saving ? '저장 중…' : '저장'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {lotPanel ? (
        <div className="mesOpsPlanModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setLotPanel(false)} />
          <div className="mesOpsPlanModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-lot-modal-title">
            <header className="mesOpsPlanModalHead">
              <div className="mesOpsPlanModalHeadTitle">
                <span className="mesOpsPlanModalHeadIcon"><IconBox /></span>
                <div>
                  <h2 className="mesOpsPlanModalTitle" id="mes-lot-modal-title">
                    {editingLotId == null ? 'LOT 등록' : 'LOT 수정'}
                  </h2>
                  <p className="mesOpsPlanModalSub">
                    하나의 작업지시에 여러 LOT를 나눠 등록할 수 있습니다. (예: 지시 1000 → LOT 700 + 300)
                  </p>
                </div>
              </div>
              <span className={`mesOpsPlanModalStatus ${lotStatusBadgeClass(lotForm.status)}`}>{lotStatusLabel(lotForm.status)}</span>
            </header>

            <div className="mesOpsPlanModalBody">
              <div className="mesOpsPlanModalStrip" aria-label="작업지시 참고 정보">
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">작업지시</span>
                  <strong className="mesOpsPlanModalStripVal mono">{selectedLotWorkOrder?.woNo ?? '—'}</strong>
                </div>
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">지시수량</span>
                  <strong className="mesOpsPlanModalStripVal">{lotFormAllocation?.wo.orderQty?.toLocaleString() ?? '—'}</strong>
                </div>
                <div className="mesOpsPlanModalStripItem">
                  <span className="mesOpsPlanModalStripLabel">추가 가능</span>
                  <strong className="mesOpsPlanModalStripVal">{lotFormAllocation ? lotFormAllocation.remain.toLocaleString() : '—'}</strong>
                </div>
              </div>

              <div className="mesOpsPlanModalGrid">
                <section className="mesOpsPlanModalCard">
                  <h3 className="mesOpsPlanModalCardTitle">LOT 기본정보</h3>
                  <div className="mesOpsPlanModalFieldGrid">
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">LOT번호</span>
                      <input
                        className="mesOpsPlanModalInput mono"
                        value={lotForm.lotNo}
                        onChange={(e) => setLotForm((f) => ({ ...f, lotNo: e.target.value }))}
                      />
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">LOT수량</span>
                      <input
                        className="mesOpsPlanModalInput"
                        value={lotForm.lotQty}
                        onChange={(e) => setLotForm((f) => ({ ...f, lotQty: e.target.value }))}
                      />
                      {lotFormAllocation ? (
                        <span className="mesOpsPlanModalHint">
                          추가 배정 가능: {lotFormAllocation.remain.toLocaleString()} (지시 {lotFormAllocation.wo.orderQty.toLocaleString()}, 기배정 {lotFormAllocation.allocated.toLocaleString()})
                        </span>
                      ) : null}
                    </label>
                    <label className="mesOpsPlanModalField mesOpsPlanModalField--product">
                      <span className="mesOpsPlanModalFieldLabel">작업지시</span>
                      <select
                        className="mesOpsPlanModalInput mesOpsPlanModalSelect"
                        value={lotForm.woId}
                        onChange={(e) => applyWoToLot(e.target.value)}
                      >
                        <option value="">선택</option>
                        {lotSelectableWorkOrders.map((w) => (
                          <option key={w.id} value={String(w.id)}>{w.woNo} · {w.product?.productName ?? `품목#${w.productId}`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="mesOpsPlanModalField">
                      <span className="mesOpsPlanModalFieldLabel">상태</span>
                      <select
                        className="mesOpsPlanModalInput"
                        value={lotForm.status}
                        onChange={(e) => setLotForm((f) => ({ ...f, status: e.target.value as LotStatus }))}
                      >
                        {lotStatuses.map((s) => (
                          <option key={s} value={s}>{lotStatusLabel(s)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="mesOpsPlanModalCard mesOpsPlanModalCard--summary">
                  <h3 className="mesOpsPlanModalCardTitle">LOT 정보 요약</h3>
                  <div className="mesOpsPlanModalInfoList">
                    <div className="mesOpsPlanModalInfoRow"><span>작업지시</span><strong>{selectedLotWorkOrder?.woNo ?? '미선택'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>지시수량</span><strong>{lotFormAllocation?.wo.orderQty ?? '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>기배정 LOT</span><strong>{lotFormAllocation ? lotFormAllocation.allocated.toLocaleString() : '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>추가 가능</span><strong>{lotFormAllocation ? lotFormAllocation.remain.toLocaleString() : '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>품목명</span><strong>{selectedLotWorkOrder?.product?.productName ?? '—'}</strong></div>
                    <div className="mesOpsPlanModalInfoRow"><span>상태</span><strong>{lotStatusLabel(lotForm.status)}</strong></div>
                  </div>
                </section>
              </div>
            </div>

            <footer className="mesOpsPlanModalFoot">
              <button type="button" className="mesOpsPlanModalBtn mesOpsPlanModalBtn--cancel" disabled={saving} onClick={() => setLotPanel(false)}>
                <IconX />
                취소
              </button>
              <button type="button" className="mesOpsPlanModalBtn mesOpsPlanModalBtn--save" disabled={saving} onClick={() => void saveLot()}>
                <IconSave />
                {saving ? '저장 중…' : '저장'}
              </button>
            </footer>
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
