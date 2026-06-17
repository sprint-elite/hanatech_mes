import { useCallback, useEffect, useState, type MouseEvent } from 'react'

import { apiJson } from '../lib/api'

import { isStandardItemType, itemTypeLabel, normalizeItemTypeToCode } from '../lib/itemType'



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

  const modalTitle = editingId == null ? '신규 등록' : '수정'

  const editingRow = editingId != null ? items.find((x) => x.id === editingId) : null



  return (

    <div className="mesPage mesPageWide">

      <header className="mesPageHeadRow">

        <div>

          <h1 className="mesPageTitle">품목</h1>

          <p className="mesPageDesc">

            제품 마스터(products)와 생산·구매·품질·재고·외주 확장 프로필을 함께 관리합니다.

          </p>

        </div>

        <span className="mesCountPill">{loading ? '…' : `${items.length}건`}</span>

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



      <div className="mesCrudMain">

        <div className="mesToolbar mesToolbarCompact">

          <button type="button" className="mesBtnPrimary" onClick={openNew}>

            새 품목

          </button>

          <button type="button" className="mesBtnSecondary" onClick={() => void load()}>

            새로고침

          </button>

        </div>



        <div className="mesToolbar mesToolbarCompact" style={{ gap: 8, flexWrap: 'wrap' }}>

          <input

            className="mesInput"

            style={{ minWidth: 240 }}

            placeholder="검색: 코드/품명/품번/바코드"

            value={filters.q}

            onChange={(ev) => setFilters((f) => ({ ...f, q: ev.target.value }))}

            onKeyDown={(ev) => {

              if (ev.key === 'Enter') void load()

            }}

          />

          <select

            className="mesInput"

            value={filters.itemType}

            onChange={(ev) => setFilters((f) => ({ ...f, itemType: ev.target.value }))}

            aria-label="품목 유형 필터"

          >

            <option value="">유형(전체)</option>

            <option value="FG">완제품</option>

            <option value="WIP">반제품</option>

            <option value="RAW">원자재</option>

          </select>

          <select

            className="mesInput"

            value={filters.status}

            onChange={(ev) => setFilters((f) => ({ ...f, status: ev.target.value }))}

            aria-label="상태 필터"

          >

            <option value="">상태(전체)</option>

            <option value="ACTIVE">ACTIVE</option>

            <option value="INACTIVE">INACTIVE</option>

          </select>

          <button

            type="button"

            className="mesBtnSecondary"

            onClick={() =>

              setFilters({

                q: '',

                itemType: '',

                status: '',

              })

            }

          >

            필터 초기화

          </button>

          <button type="button" className="mesBtnPrimary" onClick={() => void load()}>

            필터 적용

          </button>

        </div>



        <div className="mesTableViewport">

          <table className="mesTable mesTableSticky mesTableClick">

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

                <th className="mesThActions">작업</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td colSpan={13} className="muted">

                    로딩 중…

                  </td>

                </tr>

              ) : items.length === 0 ? (

                <tr>

                  <td colSpan={13} className="muted">

                    데이터가 없습니다. <strong>새 품목</strong>으로 모달에서 추가하세요.

                  </td>

                </tr>

              ) : (

                items.map((p) => (

                  <tr

                    key={p.id}

                    className={selectedRowId === p.id ? 'mesRowSelected' : undefined}

                    onClick={() => openEdit(p)}

                  >

                    <td className="mono">{p.productCode}</td>

                    <td>{p.productName}</td>

                    <td className="mono">{p.itemNumber ?? '—'}</td>

                    <td>{itemTypeLabel(p.itemType)}</td>

                    <td>{p.unit}</td>

                    <td>{p.standardPackQty ?? '—'}</td>

                    <td className="mono">{p.unitWeight ?? '—'}</td>

                    <td>{specTextFromJson(p.specJson) || '—'}</td>

                    <td>{p.safetyStock ?? '—'}</td>

                    <td>{p.maxStock ?? '—'}</td>

                    <td className="mono">{p.barcode ?? '—'}</td>

                    <td>{p.status}</td>

                    <td className="mesTdActions">

                      <button

                        type="button"

                        className="mesBtnSm mesBtnDanger"

                        onClick={(ev) => void remove(p.id, ev)}

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

      </div>



      {panelOpen ? (

        <div className="mesModalRoot" role="presentation">

          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />

          <div

            className="mesModalDialog"

            role="dialog"

            aria-modal="true"

            aria-labelledby="mes-product-modal-title"

          >

            <div className="mesModalHead">

              <div>

                <h2 className="mesModalTitle" id="mes-product-modal-title">

                  {modalTitle}

                </h2>

                {editingId != null ? (

                  <div className="mesModalMeta muted">ID {editingId}</div>

                ) : null}

              </div>

              <div className="mesModalHeadActions">

                <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>

                  {saving ? '저장 중…' : '저장'}

                </button>

                <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closePanel}>

                  취소

                </button>

                <button type="button" className="mesBtnGhost" onClick={closePanel}>

                  닫기

                </button>

              </div>

            </div>

            <div className="mesModalBody mesProductModalBody">

              <div className="mesProductFormGrid">

                <section className="mesProductCard">

                  <h3 className="mesProductCardTitle">기본정보</h3>

                  <div className="mesFieldRow">

                    <label className="mesLabel">

                      품목코드 (product_code)

                      <input

                        className="mesInput"

                        value={form.productCode}

                        onChange={(ev) => setForm((f) => ({ ...f, productCode: ev.target.value }))}

                      />

                    </label>

                    <label className="mesLabel">

                      품목명 (product_name)

                      <input

                        className="mesInput"

                        value={form.productName}

                        onChange={(ev) => setForm((f) => ({ ...f, productName: ev.target.value }))}

                      />

                    </label>

                  </div>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      품번 (item_number)

                      <input

                        className="mesInput"

                        placeholder="내부 품번 등"

                        value={form.itemNumber}

                        onChange={(ev) => setForm((f) => ({ ...f, itemNumber: ev.target.value }))}

                      />

                    </label>

                    <label className="mesLabel">

                      품목 유형 (item_type)

                      <select

                        className="mesInput"

                        value={isStandardItemType(form.itemType) ? normalizeItemTypeToCode(form.itemType)! : form.itemType}

                        onChange={(ev) => setForm((f) => ({ ...f, itemType: ev.target.value }))}

                      >

                        <option value="FG">완제품</option>

                        <option value="WIP">반제품</option>

                        <option value="RAW">원자재</option>

                        {!isStandardItemType(form.itemType) && form.itemType.trim() !== '' ? (

                          <option value={form.itemType}>기타 (현재: {form.itemType})</option>

                        ) : null}

                      </select>

                    </label>

                    <label className="mesLabel">

                      생산 가능 (is_production)

                      <select

                        className="mesInput"

                        value={form.isProduction}

                        onChange={(ev) => setForm((f) => ({ ...f, isProduction: ev.target.value as 'Y' | 'N' }))}

                      >

                        <option value="Y">Y</option>

                        <option value="N">N</option>

                      </select>

                    </label>

                  </div>

                  <div className="mesFieldRow">

                    <label className="mesLabel">

                      상태 (status)

                      <select

                        className="mesInput"

                        value={form.status}

                        onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))}

                      >

                        <option value="ACTIVE">ACTIVE</option>

                        <option value="INACTIVE">INACTIVE</option>

                      </select>

                    </label>

                    <div />

                  </div>

                </section>



                <section className="mesProductCard">

                  <h3 className="mesProductCardTitle">포장/물류</h3>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      기본 단위 (unit)

                      <input

                        className="mesInput"

                        value={form.unit}

                        onChange={(ev) => setForm((f) => ({ ...f, unit: ev.target.value }))}

                      />

                    </label>

                    <label className="mesLabel">

                      표준 포장 수량

                      <input

                        className="mesInput"

                        placeholder="예: 12"

                        value={form.standardPackQty}

                        onChange={(ev) => setForm((f) => ({ ...f, standardPackQty: ev.target.value }))}

                      />

                    </label>

                    <label className="mesLabel">

                      바코드 (barcode)

                      <input

                        className="mesInput"

                        value={form.barcode}

                        onChange={(ev) => setForm((f) => ({ ...f, barcode: ev.target.value }))}

                      />

                    </label>

                  </div>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      단위 중량 (unit_weight)

                      <input

                        className="mesInput"

                        placeholder="예: 0.25"

                        value={form.unitWeight}

                        onChange={(ev) => setForm((f) => ({ ...f, unitWeight: ev.target.value }))}

                      />

                    </label>

                    <label className="mesLabel">

                      규격 (spec_json.spec)

                      <input

                        className="mesInput"

                        placeholder="예: 10A / SCH40 / 316L"

                        value={form.spec}

                        onChange={(ev) => setForm((f) => ({ ...f, spec: ev.target.value }))}

                      />

                    </label>

                    <label className="mesLabel">

                      안전재고 / 최대재고

                      <div className="mesFieldRow mesFieldRowTight">

                        <input

                          className="mesInput"

                          placeholder="safety_stock"

                          value={form.safetyStock}

                          onChange={(ev) => setForm((f) => ({ ...f, safetyStock: ev.target.value }))}

                        />

                        <input

                          className="mesInput"

                          placeholder="max_stock"

                          value={form.maxStock}

                          onChange={(ev) => setForm((f) => ({ ...f, maxStock: ev.target.value }))}

                        />

                      </div>

                    </label>

                  </div>

                </section>



                <section className="mesProductCard">

                  <h3 className="mesProductCardTitle">구매/자재</h3>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      구매 가능 (is_purchasable)

                      <select

                        className="mesInput"

                        value={form.isPurchasable}

                        onChange={(ev) => setForm((f) => ({ ...f, isPurchasable: ev.target.value as 'Y' | 'N' }))}

                      >

                        <option value="Y">Y</option>

                        <option value="N">N</option>

                      </select>

                    </label>

                    <label className="mesLabel">

                      기본 공급업체 (default_supplier)

                      <select

                        className="mesInput"

                        value={form.defaultSupplierId}

                        onChange={(ev) => setForm((f) => ({ ...f, defaultSupplierId: ev.target.value }))}

                      >

                        <option value="">(없음)</option>

                        {customers

                          .filter((c) => c.type === 'SUPPLIER')

                          .map((c) => (

                            <option key={c.id} value={String(c.id)}>

                              {c.customerCode} · {c.customerName}

                            </option>

                          ))}

                      </select>

                    </label>

                    <label className="mesLabel">

                      구매 단위 (purchase_unit)

                      <input

                        className="mesInput"

                        placeholder="BOX / KG ..."

                        value={form.purchaseUnit}

                        onChange={(ev) => setForm((f) => ({ ...f, purchaseUnit: ev.target.value }))}

                      />

                    </label>

                  </div>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      단가 (purchase_price)

                      <input

                        className="mesInput"

                        placeholder="예: 1200"

                        value={form.purchasePrice}

                        onChange={(ev) => setForm((f) => ({ ...f, purchasePrice: ev.target.value }))}

                      />

                    </label>

                    <label className="mesLabel">

                      MOQ (moq)

                      <input

                        className="mesInput"

                        placeholder="예: 100"

                        value={form.moq}

                        onChange={(ev) => setForm((f) => ({ ...f, moq: ev.target.value }))}

                      />

                    </label>

                    <div />

                  </div>

                </section>



                <section className="mesProductCard">

                  <h3 className="mesProductCardTitle">품질</h3>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      검사 필수 (inspection_required_yn)

                      <select

                        className="mesInput"

                        value={form.inspectionRequiredYn}

                        onChange={(ev) =>

                          setForm((f) => ({ ...f, inspectionRequiredYn: ev.target.value as 'Y' | 'N' }))

                        }

                      >

                        <option value="Y">Y</option>

                        <option value="N">N</option>

                      </select>

                    </label>

                    <label className="mesLabel">

                      검사 방식 (inspection_type)

                      <select

                        className="mesInput"

                        value={form.inspectionType}

                        onChange={(ev) =>

                          setForm((f) => ({ ...f, inspectionType: ev.target.value as FormState['inspectionType'] }))

                        }

                      >

                        <option value="MANUAL">MANUAL</option>

                        <option value="VISION">VISION</option>

                        <option value="SAMPLING">SAMPLING</option>

                      </select>

                    </label>

                    <label className="mesLabel">

                      허용 불량률 % (defect_tolerance_rate)

                      <input

                        className="mesInput"

                        placeholder="예: 1.5"

                        value={form.defectToleranceRate}

                        onChange={(ev) => setForm((f) => ({ ...f, defectToleranceRate: ev.target.value }))}

                      />

                    </label>

                  </div>

                </section>



                <section className="mesProductCard">

                  <h3 className="mesProductCardTitle">재고/물류</h3>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      LOT 관리 (lot_control_yn)

                      <select

                        className="mesInput"

                        value={form.lotControlYn}

                        onChange={(ev) => setForm((f) => ({ ...f, lotControlYn: ev.target.value as 'Y' | 'N' }))}

                      >

                        <option value="Y">Y</option>

                        <option value="N">N</option>

                      </select>

                    </label>

                    <label className="mesLabel">

                      매입처 (고객사)

                      <select

                        className="mesInput"

                        value={form.purchaserCustomerId}

                        onChange={(ev) => setForm((f) => ({ ...f, purchaserCustomerId: ev.target.value }))}

                      >

                        <option value="">(없음)</option>

                        {customers

                          .filter((c) => c.type === 'CUSTOMER')

                          .map((c) => (

                            <option key={c.id} value={String(c.id)}>

                              {c.customerCode} · {c.customerName}

                            </option>

                          ))}

                      </select>

                    </label>

                    <div />

                  </div>

                </section>



                <section className="mesProductCard">

                  <h3 className="mesProductCardTitle">외주</h3>

                  <div className="mesFieldRow mesFieldRow3">

                    <label className="mesLabel">

                      외주 여부 (is_outsourcing)

                      <select

                        className="mesInput"

                        value={form.isOutsourcing}

                        onChange={(ev) => setForm((f) => ({ ...f, isOutsourcing: ev.target.value as 'Y' | 'N' }))}

                      >

                        <option value="Y">Y</option>

                        <option value="N">N</option>

                      </select>

                    </label>

                    <label className="mesLabel">

                      기본 외주업체 (default_vendor)

                      <select

                        className="mesInput"

                        value={form.defaultVendorId}

                        onChange={(ev) => setForm((f) => ({ ...f, defaultVendorId: ev.target.value }))}

                      >

                        <option value="">(없음)</option>

                        {customers

                          .filter((c) => c.type === 'OUTSOURCING')

                          .map((c) => (

                            <option key={c.id} value={String(c.id)}>

                              {c.customerCode} · {c.customerName}

                            </option>

                          ))}

                      </select>

                    </label>

                    <div />

                  </div>

                </section>

              </div>



              {editingRow ? (

                <div className="muted mesModalMeta">

                  생성 {new Date(editingRow.createdAt).toLocaleString()} · 수정 {new Date(editingRow.updatedAt).toLocaleString()}

                </div>

              ) : null}

            </div>

          </div>

        </div>

      ) : null}

    </div>

  )

}

