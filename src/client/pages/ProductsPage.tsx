import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'

import { apiJson } from '../lib/api'
import '../products-page.css'
import { ProductFormModal } from '../ui/ProductFormModal'

import { isStandardItemType, itemTypeLabel, normalizeItemTypeToCode } from '../lib/itemType'



function itemTypeBadgeClass(code: string): string {
  const c = normalizeItemTypeToCode(code)
  if (c === 'FG') return 'mesProdTypeBadge mesProdTypeBadge--fg'
  if (c === 'WIP') return 'mesProdTypeBadge mesProdTypeBadge--wip'
  if (c === 'RAW') return 'mesProdTypeBadge mesProdTypeBadge--raw'
  return 'mesProdTypeBadge'
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
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

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}

function IconPackage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3 3 8v8l9 5 9-5V8l-9-5Z" />
      <path d="M12 12v9" />
      <path d="M3 8l9 5 9-5" />
    </svg>
  )
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l6.59-6.59a1 1 0 0 0 0-1.41L12 2Z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}



type Product = {

  id: number

  productCode: string

  productName: string

  itemType: string

  itemNumber: string | null

  unit: string

  standardPackQty: number | null

  unitWeight: string | null

  unitVolume: string | null

  safetyStock: number | null

  maxStock: number | null

  barcode: string | null

  specJson: unknown

  status: string

  createdAt: string

  updatedAt: string

  productionProfile: {

    isProduction: 'Y' | 'N'

  } | null

  purchaseProfile: {

    isPurchasable: 'Y' | 'N'

    defaultSupplierId: number | null

    defaultSupplierRef: { id: number; customerCode: string; customerName: string; type: string } | null

    purchaseUnit: string | null

    purchasePrice: string | null

    moq: number | null

  } | null

  qualityProfile: {

    inspectionRequiredYn: 'Y' | 'N'

    inspectionType: 'MANUAL' | 'VISION' | 'SAMPLING' | null

    defectToleranceRate: string | null

  } | null

  inventoryProfile: {

    lotControlYn: 'Y' | 'N'

    purchaserCustomerId: number | null

    purchaserCustomer: { id: number; customerCode: string; customerName: string; type: string } | null

  } | null

  outsourcingProfile: {

    isOutsourcing: 'Y' | 'N'

    defaultVendorId: number | null

    defaultVendorRef: { id: number; customerCode: string; customerName: string; type: string } | null

  } | null

}



type FormState = {

  productCode: string

  productName: string

  itemNumber: string

  itemType: string

  unit: string

  standardPackQty: string

  unitWeight: string

  spec: string

  safetyStock: string

  maxStock: string

  barcode: string

  status: string

  isProduction: 'Y' | 'N'

  // purchase

  isPurchasable: 'Y' | 'N'

  defaultSupplierId: string

  purchaseUnit: string

  purchasePrice: string

  moq: string

  // quality

  inspectionRequiredYn: 'Y' | 'N'

  inspectionType: 'MANUAL' | 'VISION' | 'SAMPLING'

  defectToleranceRate: string

  // inventory

  lotControlYn: 'Y' | 'N'

  purchaserCustomerId: string

  // outsourcing

  isOutsourcing: 'Y' | 'N'

  defaultVendorId: string

}



const emptyForm = (): FormState => ({

  productCode: '',

  productName: '',

  itemNumber: '',

  itemType: 'FG',

  unit: 'EA',

  standardPackQty: '',

  unitWeight: '',

  spec: '',

  safetyStock: '',

  maxStock: '',

  barcode: '',

  status: 'ACTIVE',

  isProduction: 'Y',

  isPurchasable: 'N',

  defaultSupplierId: '',

  purchaseUnit: '',

  purchasePrice: '',

  moq: '',

  inspectionRequiredYn: 'N',

  inspectionType: 'MANUAL',

  defectToleranceRate: '',

  lotControlYn: 'Y',

  purchaserCustomerId: '',

  isOutsourcing: 'N',

  defaultVendorId: '',

})



function specTextFromJson(specJson: unknown): string {

  if (!specJson || typeof specJson !== 'object') return ''

  if (Array.isArray(specJson)) return ''

  const v = (specJson as Record<string, unknown>).spec

  return typeof v === 'string' ? v : ''

}



function parseOptionalInt(raw: string): number | null | undefined {

  const t = raw.trim()

  if (t === '') return undefined

  const n = Number(t)

  if (!Number.isFinite(n) || !Number.isInteger(n)) return null

  return n

}



function parseOptionalNonNegInt(raw: string): number | null | undefined {

  const v = parseOptionalInt(raw)

  if (v === null) return null

  if (v === undefined) return undefined

  if (v < 0) return null

  return v

}



function parseOptionalDecimal(raw: string): number | null | undefined {

  const t = raw.trim()

  if (t === '') return undefined

  const n = Number(t)

  if (!Number.isFinite(n)) return null

  if (n < 0) return null

  return n

}



export function ProductsPage() {

  const [items, setItems] = useState<Product[]>([])

  const [customers, setCustomers] = useState<{ id: number; customerCode: string; customerName: string; type: string; useYn: 'Y' | 'N' }[]>(

    [],

  )

  const [loading, setLoading] = useState(true)

  const [err, setErr] = useState<string | null>(null)

  const [filters, setFilters] = useState<{ q: string; itemType: string; status: string }>({

    q: '',

    itemType: '',

    status: '',

  })

  const [draftFilters, setDraftFilters] = useState<{ q: string; itemType: string; status: string }>({

    q: '',

    itemType: '',

    status: '',

  })

  const [page, setPage] = useState(1)

  const [pageSize, setPageSize] = useState(20)

  const [form, setForm] = useState<FormState>(emptyForm())

  const [editingId, setEditingId] = useState<number | null>(null)

  const [panelOpen, setPanelOpen] = useState(false)

  const [saving, setSaving] = useState(false)



  const load = useCallback(async () => {

    setLoading(true)

    try {

      const params = new URLSearchParams()

      const q = filters.q.trim()

      if (q) params.set('q', q)



      const itRaw = filters.itemType.trim()

      if (itRaw) params.set('itemType', normalizeItemTypeToCode(itRaw) ?? itRaw)



      const status = filters.status.trim()

      if (status) params.set('status', status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')



      const qs = params.toString()

      const [prodRes, custRes] = await Promise.all([

        apiJson<{ ok: boolean; items: Product[] }>(qs ? `/api/products?${qs}` : '/api/products'),

        apiJson<{ ok: boolean; items: { id: number; customerCode: string; customerName: string; type: string; useYn: 'Y' | 'N' }[] }>(

          '/api/customers?useYn=Y',

        ),

      ])

      setItems(prodRes.items)

      setCustomers(custRes.items)

      setErr(null)

    } catch (e) {

      setErr(e instanceof Error ? e.message : 'unknown error')

      setItems([])

      setCustomers([])

    } finally {

      setLoading(false)

    }

  }, [filters.itemType, filters.q, filters.status])



  const stats = useMemo(() => {

    let wip = 0

    let raw = 0

    let fg = 0

    let safety = 0

    for (const p of items) {

      const c = normalizeItemTypeToCode(p.itemType)

      if (c === 'WIP') wip += 1

      else if (c === 'RAW') raw += 1

      else if (c === 'FG') fg += 1

      if (p.safetyStock != null && p.safetyStock > 0) safety += 1

    }

    return { total: items.length, wip, raw, fg, safety }

  }, [items])



  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))



  useEffect(() => {

    if (page > totalPages) setPage(totalPages)

  }, [page, totalPages])



  const pageItems = useMemo(() => {

    const start = (page - 1) * pageSize

    return items.slice(start, start + pageSize)

  }, [items, page, pageSize])



  const applyFilters = () => {

    setFilters({ ...draftFilters })

    setPage(1)

  }



  const resetFilters = () => {

    const empty = { q: '', itemType: '', status: '' }

    setDraftFilters(empty)

    setFilters(empty)

    setPage(1)

  }



  useEffect(() => {

    void load()

  }, [load])



  const openNew = () => {

    setEditingId(null)

    setForm(emptyForm())

    setPanelOpen(true)

  }



  const openEdit = (p: Product) => {

    setEditingId(p.id)

    const code = normalizeItemTypeToCode(p.itemType)

    setForm({

      productCode: p.productCode,

      productName: p.productName,

      itemNumber: p.itemNumber ?? '',

      itemType: code ?? p.itemType,

      unit: p.unit,

      standardPackQty: p.standardPackQty != null ? String(p.standardPackQty) : '',

      unitWeight: p.unitWeight ?? '',

      spec: specTextFromJson(p.specJson),

      safetyStock: p.safetyStock != null ? String(p.safetyStock) : '',

      maxStock: p.maxStock != null ? String(p.maxStock) : '',

      barcode: p.barcode ?? '',

      status: p.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',

      isProduction: p.productionProfile?.isProduction ?? 'Y',

      isPurchasable: p.purchaseProfile?.isPurchasable ?? 'N',

      defaultSupplierId:

        p.purchaseProfile?.defaultSupplierId != null ? String(p.purchaseProfile.defaultSupplierId) : '',

      purchaseUnit: p.purchaseProfile?.purchaseUnit ?? '',

      purchasePrice: p.purchaseProfile?.purchasePrice ?? '',

      moq: p.purchaseProfile?.moq != null ? String(p.purchaseProfile.moq) : '',

      inspectionRequiredYn: p.qualityProfile?.inspectionRequiredYn ?? 'N',

      inspectionType: p.qualityProfile?.inspectionType ?? 'MANUAL',

      defectToleranceRate: p.qualityProfile?.defectToleranceRate ?? '',

      lotControlYn: p.inventoryProfile?.lotControlYn ?? 'Y',

      purchaserCustomerId:

        p.inventoryProfile?.purchaserCustomerId != null ? String(p.inventoryProfile.purchaserCustomerId) : '',

      isOutsourcing: p.outsourcingProfile?.isOutsourcing ?? 'N',

      defaultVendorId: p.outsourcingProfile?.defaultVendorId != null ? String(p.outsourcingProfile.defaultVendorId) : '',

    })

    setPanelOpen(true)

  }



  const closePanel = useCallback(() => {

    setPanelOpen(false)

    setEditingId(null)

    setForm(emptyForm())

  }, [])



  useEffect(() => {

    if (!panelOpen) return

    const onKey = (e: KeyboardEvent) => {

      if (e.key === 'Escape') closePanel()

    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)

  }, [panelOpen, closePanel])



  const save = async () => {

    setSaving(true)

    setErr(null)

    try {

      const pack = parseOptionalInt(form.standardPackQty)

      if (pack === null) {

        setErr('표준포장수량은 빈 칸이거나 0 이상 정수여야 합니다.')

        setSaving(false)

        return

      }

      if (pack !== undefined && pack < 1) {

        setErr('표준포장수량을 입력할 때는 1 이상이어야 합니다.')

        setSaving(false)

        return

      }



      const safety = parseOptionalNonNegInt(form.safetyStock)

      const maxStock = parseOptionalNonNegInt(form.maxStock)

      const moq = parseOptionalInt(form.moq)

      if (safety === null || maxStock === null) {

        setErr('안전재고·최대재고는 빈 칸이거나 0 이상 정수여야 합니다.')

        setSaving(false)

        return

      }

      if (moq === null) {

        setErr('MOQ는 빈 칸이거나 올바른 정수여야 합니다.')

        setSaving(false)

        return

      }



      const uw = parseOptionalDecimal(form.unitWeight)

      if (uw === null) {

        setErr('단위 중량은 빈 칸이거나 0 이상 숫자여야 합니다.')

        setSaving(false)

        return

      }

      const purchasePrice = parseOptionalDecimal(form.purchasePrice)

      const defectToleranceRate = parseOptionalDecimal(form.defectToleranceRate)

      if (purchasePrice === null || defectToleranceRate === null) {

        setErr('구매단가/허용불량률은 빈 칸이거나 0 이상 숫자여야 합니다.')

        setSaving(false)

        return

      }



      let specJson: unknown = undefined

      if (form.spec.trim() !== '') {

        specJson = { spec: form.spec.trim() }

      } else if (editingId != null) {

        specJson = null

      }



      const it = form.itemType.trim()

      const itemTypeCode = normalizeItemTypeToCode(it) ?? it

      const body: Record<string, unknown> = {

        productCode: form.productCode.trim(),

        productName: form.productName.trim(),

        itemType: itemTypeCode,

        itemNumber: form.itemNumber.trim() === '' ? null : form.itemNumber.trim(),

        unit: form.unit.trim(),

        standardPackQty: pack === undefined ? null : pack,

        unitWeight: uw === undefined ? null : uw,

        unitVolume: null,

        safetyStock: safety === undefined ? null : safety,

        maxStock: maxStock === undefined ? null : maxStock,

        barcode: form.barcode.trim() === '' ? null : form.barcode.trim(),

        status: form.status.trim() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',

        production: {

          isProduction: form.isProduction,

        },

        purchase: {

          isPurchasable: form.isPurchasable,

          defaultSupplierId:

            form.defaultSupplierId.trim() === '' ? null : Number(form.defaultSupplierId.trim()),

          purchaseUnit: form.purchaseUnit.trim() === '' ? null : form.purchaseUnit.trim(),

          purchasePrice: purchasePrice === undefined ? null : purchasePrice,

          moq: moq === undefined ? null : moq,

        },

        quality: {

          inspectionRequiredYn: form.inspectionRequiredYn,

          inspectionType: form.inspectionType,

          defectToleranceRate: defectToleranceRate === undefined ? null : defectToleranceRate,

        },

        inventory: {

          lotControlYn: form.lotControlYn,

          purchaserCustomerId:

            form.purchaserCustomerId.trim() === '' ? null : Number(form.purchaserCustomerId.trim()),

        },

        outsourcing: {

          isOutsourcing: form.isOutsourcing,

          defaultVendorId: form.defaultVendorId.trim() === '' ? null : Number(form.defaultVendorId.trim()),

        },

      }

      if (specJson !== undefined) {

        body.specJson = specJson

      }



      if (editingId == null) {

        await apiJson('/api/products', { method: 'POST', body: JSON.stringify(body) })

      } else {

        await apiJson(`/api/products/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })

      }

      await load()

      closePanel()

    } catch (e) {

      setErr(e instanceof Error ? e.message : 'unknown error')

    } finally {

      setSaving(false)

    }

  }



  const remove = async (id: number, ev: MouseEvent) => {

    ev.stopPropagation()

    if (!confirm('이 품목을 삭제할까요? 연결된 LOT/MBOM이 있으면 삭제되지 않습니다.')) return

    setErr(null)

    try {

      await apiJson(`/api/products/${id}`, { method: 'DELETE' })

      await load()

      if (editingId === id) closePanel()

    } catch (e) {

      setErr(e instanceof Error ? e.message : 'unknown error')

    }

  }



  const selectedRowId = panelOpen && editingId != null ? editingId : null



  return (

    <div className="mesPage mesPageWide mesProductsPage">

      <header className="mesProdHead">

        <div className="mesProdHeadMain">

          <h1 className="mesProdTitle">품목</h1>

          <p className="mesProdDesc">

            제품 마스터(products)와 생산·구매·품질·재고·외주 확장 프로필을 함께 관리합니다.

          </p>

        </div>

        <div className="mesProdHeadActions">

          <span className="mesProdCountBadge">{loading ? '…' : `${items.length}건`}</span>

          <button type="button" className="mesProdBtn mesProdBtn--primary" onClick={openNew}>

            <IconPlus />

            새 품목

          </button>

          <button type="button" className="mesProdBtn mesProdBtn--secondary" onClick={() => void load()}>

            <IconRefresh />

            새로고침

          </button>

        </div>

      </header>



      {err ? (

        <div className="mesNotice mesNoticeError" role="alert">

          <div className="mesNoticeBody">

            <span className="mesNoticeTitle">오류</span>

            <span className="mesNoticeText">{err}</span>

          </div>

          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">

            ×

          </button>

        </div>

      ) : null}



      <div className="mesProdFilterCard">

        <div className="mesProdField mesProdField--search">

          <span className="mesProdFieldLabel">검색</span>

          <div className="mesProdInputWrap">

            <span className="mesProdInputIcon"><IconSearch /></span>

            <input

              className="mesProdInput mesProdInput--search"

              placeholder="코드 / 품명 / 품번 / 바코드"

              value={draftFilters.q}

              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}

              onKeyDown={(ev) => {

                if (ev.key === 'Enter') applyFilters()

              }}

            />

          </div>

        </div>

        <div className="mesProdField mesProdField--select">

          <span className="mesProdFieldLabel">유형</span>

          <select

            className="mesProdSelect"

            value={draftFilters.itemType}

            onChange={(ev) => setDraftFilters((f) => ({ ...f, itemType: ev.target.value }))}

            aria-label="품목 유형 필터"

          >

            <option value="">유형(전체)</option>

            <option value="FG">완제품</option>

            <option value="WIP">반제품</option>

            <option value="RAW">원자재</option>

          </select>

        </div>

        <div className="mesProdField mesProdField--select">

          <span className="mesProdFieldLabel">상태</span>

          <select

            className="mesProdSelect"

            value={draftFilters.status}

            onChange={(ev) => setDraftFilters((f) => ({ ...f, status: ev.target.value }))}

            aria-label="상태 필터"

          >

            <option value="">상태(전체)</option>

            <option value="ACTIVE">ACTIVE</option>

            <option value="INACTIVE">INACTIVE</option>

          </select>

        </div>

        <div className="mesProdFilterActions">

          <button type="button" className="mesProdBtn mesProdBtn--secondary" onClick={resetFilters}>

            <IconReset />

            필터 초기화

          </button>

          <button type="button" className="mesProdBtn mesProdBtn--primary" onClick={applyFilters}>

            <IconFilter />

            필터 적용

          </button>

        </div>

      </div>



      <div className="mesProdStatsStrip" aria-label="품목 요약">

        <div className="mesProdStatItem">

          <div className="mesProdStatIcon mesProdStatIcon--gold"><IconBox /></div>

          <div className="mesProdStatMeta">

            <p className="mesProdStatLabel">전체 품목</p>

            <p className="mesProdStatValue">

              {loading ? '…' : <><span className="mesProdStatValueNum">{stats.total}</span><span className="mesProdStatValueUnit">건</span></>}

            </p>

          </div>

        </div>

        <div className="mesProdStatItem">

          <div className="mesProdStatIcon mesProdStatIcon--gold"><IconTag /></div>

          <div className="mesProdStatMeta">

            <p className="mesProdStatLabel">반제품</p>

            <p className="mesProdStatValue">

              {loading ? '…' : <><span className="mesProdStatValueNum">{stats.wip}</span><span className="mesProdStatValueUnit">건</span></>}

            </p>

          </div>

        </div>

        <div className="mesProdStatItem">

          <div className="mesProdStatIcon mesProdStatIcon--gold"><IconPackage /></div>

          <div className="mesProdStatMeta">

            <p className="mesProdStatLabel">원자재</p>

            <p className="mesProdStatValue">

              {loading ? '…' : <><span className="mesProdStatValueNum">{stats.raw}</span><span className="mesProdStatValueUnit">건</span></>}

            </p>

          </div>

        </div>

        <div className="mesProdStatItem">

          <div className="mesProdStatIcon mesProdStatIcon--green"><IconGrid /></div>

          <div className="mesProdStatMeta">

            <p className="mesProdStatLabel">완제품</p>

            <p className="mesProdStatValue">

              {loading ? '…' : <><span className="mesProdStatValueNum">{stats.fg}</span><span className="mesProdStatValueUnit">건</span></>}

            </p>

          </div>

        </div>

        <div className="mesProdStatItem">

          <div className="mesProdStatIcon mesProdStatIcon--gold"><IconShield /></div>

          <div className="mesProdStatMeta">

            <p className="mesProdStatLabel">안전재고 보유</p>

            <p className="mesProdStatValue">

              {loading ? '…' : <><span className="mesProdStatValueNum">{stats.safety}</span><span className="mesProdStatValueUnit">건</span></>}

            </p>

          </div>

        </div>

      </div>



      <div className="mesProdTableCard">

        <div className="mesProdTableViewport">

          <table className="mesProdTable">

            <thead>

              <tr>

                <th>코드</th>

                <th>품명</th>

                <th>품번</th>

                <th>유형</th>

                <th>단위</th>

                <th>포장</th>

                <th>중량</th>

                <th>규격</th>

                <th>안전재고</th>

                <th>최대재고</th>

                <th>바코드</th>

                <th>상태</th>

                <th className="mesProdThActions">작업</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td colSpan={13} className="mesProdEmpty">

                    로딩 중…

                  </td>

                </tr>

              ) : items.length === 0 ? (

                <tr>

                  <td colSpan={13} className="mesProdEmpty">

                    데이터가 없습니다. <strong>새 품목</strong>으로 추가하세요.

                  </td>

                </tr>

              ) : (

                pageItems.map((p) => (

                  <tr

                    key={p.id}

                    className={selectedRowId === p.id ? 'mesProdRowSelected' : undefined}

                    onClick={() => openEdit(p)}

                  >

                    <td className="mono">{p.productCode}</td>

                    <td>{p.productName}</td>

                    <td className="mono">{p.itemNumber ?? '—'}</td>

                    <td>

                      <span className={itemTypeBadgeClass(p.itemType)}>{itemTypeLabel(p.itemType)}</span>

                    </td>

                    <td>{p.unit}</td>

                    <td>{p.standardPackQty ?? '—'}</td>

                    <td className="mono">{p.unitWeight ?? '—'}</td>

                    <td>{specTextFromJson(p.specJson) || '—'}</td>

                    <td>{p.safetyStock ?? '—'}</td>

                    <td>{p.maxStock ?? '—'}</td>

                    <td className="mono">{p.barcode ?? '—'}</td>

                    <td>

                      <span

                        className={`mesProdStatusBadge ${p.status === 'INACTIVE' ? 'mesProdStatusBadge--inactive' : 'mesProdStatusBadge--active'}`}

                      >

                        {p.status}

                      </span>

                    </td>

                    <td className="mesProdTdActions">

                      <button

                        type="button"

                        className="mesProdBtn mesProdBtn--danger"

                        onClick={(ev) => void remove(p.id, ev)}

                      >

                        <IconTrash />

                        삭제

                      </button>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>



        <footer className="mesProdPager">

          <span className="mesProdPagerTotal">전체 {items.length}건</span>

          <nav className="mesProdPagerNav" aria-label="페이지">

            <button

              type="button"

              className="mesProdPagerBtn"

              disabled={page <= 1}

              onClick={() => setPage(1)}

              aria-label="첫 페이지"

            >

              «

            </button>

            <button

              type="button"

              className="mesProdPagerBtn"

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

                    {showEllipsis ? <span className="mesProdPagerBtn" style={{ border: 'none', background: 'transparent' }}>…</span> : null}

                    <button

                      type="button"

                      className={`mesProdPagerBtn${n === page ? ' mesProdPagerBtn--active' : ''}`}

                      onClick={() => setPage(n)}

                    >

                      {n}

                    </button>

                  </span>

                )

              })}

            <button

              type="button"

              className="mesProdPagerBtn"

              disabled={page >= totalPages}

              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}

              aria-label="다음 페이지"

            >

              ›

            </button>

            <button

              type="button"

              className="mesProdPagerBtn"

              disabled={page >= totalPages}

              onClick={() => setPage(totalPages)}

              aria-label="마지막 페이지"

            >

              »

            </button>

          </nav>

          <div className="mesProdPageSize">

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

      </div>



      <ProductFormModal
        open={panelOpen}
        editingId={editingId}
        saving={saving}
        form={form}
        setForm={setForm}
        customers={customers}
        editingTimestamps={(() => {
          const row = editingId != null ? items.find((x) => x.id === editingId) : null
          return row ? { createdAt: row.createdAt, updatedAt: row.updatedAt } : null
        })()}
        onSave={() => void save()}
        onClose={closePanel}
      />

    </div>

  )

}

