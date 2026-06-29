import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { isStandardItemType, normalizeItemTypeToCode } from '../lib/itemType'

export type ProductFormState = {
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
  isPurchasable: 'Y' | 'N'
  defaultSupplierId: string
  purchaseUnit: string
  purchasePrice: string
  moq: string
  inspectionRequiredYn: 'Y' | 'N'
  inspectionType: 'MANUAL' | 'VISION' | 'SAMPLING'
  defectToleranceRate: string
  lotControlYn: 'Y' | 'N'
  purchaserCustomerId: string
  isOutsourcing: 'Y' | 'N'
  defaultVendorId: string
}

type Customer = { id: number; customerCode: string; customerName: string; type: string }

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: ProductFormState
  setForm: Dispatch<SetStateAction<ProductFormState>>
  customers: Customer[]
  editingTimestamps?: { createdAt: string; updatedAt: string } | null
  onSave: () => void
  onClose: () => void
}

function IconBoxPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M12 8v8M8 12h8" />
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

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </svg>
  )
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M2 3h2l2.4 12.4a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L20 8H6" />
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

function IconWarehouse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9l9-5 9 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M22 20a5 5 0 0 0-6-4" />
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

function ProdField({
  label,
  field,
  span,
  children,
}: {
  label: string
  field: string
  span?: 'full'
  children: ReactNode
}) {
  return (
    <label className={`mesProdModalField${span === 'full' ? ' mesProdModalField--full' : ''}`}>
      <span className="mesProdModalFieldLabel">
        {label} <span className="mesProdModalFieldKey">({field})</span>
      </span>
      {children}
    </label>
  )
}

function ProdSection({
  num,
  icon,
  title,
  children,
}: {
  num: number
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="mesProdModalSection">
      <h3 className="mesProdModalSectionTitle">
        <span className="mesProdModalSectionIcon">{icon}</span>
        <span>
          {num}. {title}
        </span>
      </h3>
      <div className="mesProdModalSectionBody">{children}</div>
    </section>
  )
}

export function ProductFormModal({
  open,
  editingId,
  saving,
  form,
  setForm,
  customers,
  editingTimestamps,
  onSave,
  onClose,
}: Props) {
  if (!open) return null

  const title = editingId == null ? '신규 등록' : '품목 수정'

  return (
    <div className="mesModalRoot mesProdModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div
        className="mesModalDialog mesProdModalDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mes-product-modal-title"
      >
        <header className="mesProdModalHead">
          <div className="mesProdModalHeadTitle">
            <span className="mesProdModalHeadIcon">
              <IconBoxPlus />
            </span>
            <div>
              <h2 className="mesProdModalTitle" id="mes-product-modal-title">
                {title}
              </h2>
              {editingId != null ? <p className="mesProdModalSub">ID {editingId}</p> : null}
            </div>
          </div>
          <div className="mesProdModalHeadActions">
            <button type="button" className="mesProdModalBtn mesProdModalBtn--save" disabled={saving} onClick={onSave}>
              <IconSave />
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" className="mesProdModalBtn mesProdModalBtn--cancel" disabled={saving} onClick={onClose}>
              <IconX />
              취소
            </button>
            <button type="button" className="mesProdModalBtn mesProdModalBtn--close" onClick={onClose}>
              <IconX />
              닫기
            </button>
          </div>
        </header>

        <div className="mesProdModalBody">
          <div className="mesProdModalGrid">
            <ProdSection num={1} icon={<IconDoc />} title="기본 정보">
              <ProdField label="품목코드" field="PRODUCT_CODE">
                <input
                  className="mesProdModalInput"
                  placeholder="예: P-00001"
                  value={form.productCode}
                  onChange={(ev) => setForm((f) => ({ ...f, productCode: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="품목명" field="PRODUCT_NAME">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 스테인리스 파이프"
                  value={form.productName}
                  onChange={(ev) => setForm((f) => ({ ...f, productName: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="품번" field="ITEM_NUMBER">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 내부 품번 등"
                  value={form.itemNumber}
                  onChange={(ev) => setForm((f) => ({ ...f, itemNumber: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="품목 유형" field="ITEM_TYPE">
                <select
                  className="mesProdModalInput"
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
              </ProdField>
              <ProdField label="생산 가능" field="IS_PRODUCTION">
                <select
                  className="mesProdModalInput"
                  value={form.isProduction}
                  onChange={(ev) => setForm((f) => ({ ...f, isProduction: ev.target.value as 'Y' | 'N' }))}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </ProdField>
              <ProdField label="상태" field="STATUS">
                <select
                  className="mesProdModalInput"
                  value={form.status}
                  onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </ProdField>
            </ProdSection>

            <ProdSection num={2} icon={<IconBox />} title="포장 / 물류">
              <ProdField label="기본 단위" field="UNIT">
                <input
                  className="mesProdModalInput"
                  placeholder="예: EA"
                  value={form.unit}
                  onChange={(ev) => setForm((f) => ({ ...f, unit: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="표준 포장 수량" field="STANDARD_PACK_QTY">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 12"
                  value={form.standardPackQty}
                  onChange={(ev) => setForm((f) => ({ ...f, standardPackQty: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="바코드" field="BARCODE">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 8801234567890"
                  value={form.barcode}
                  onChange={(ev) => setForm((f) => ({ ...f, barcode: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="규격" field="SPEC_JSON.SPEC">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 10A / SCH40 / 316L"
                  value={form.spec}
                  onChange={(ev) => setForm((f) => ({ ...f, spec: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="단위 중량" field="UNIT_WEIGHT" span="full">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 0.25"
                  value={form.unitWeight}
                  onChange={(ev) => setForm((f) => ({ ...f, unitWeight: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="안전재고" field="SAFETY_STOCK">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 5"
                  value={form.safetyStock}
                  onChange={(ev) => setForm((f) => ({ ...f, safetyStock: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="최대재고" field="MAX_STOCK">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 100"
                  value={form.maxStock}
                  onChange={(ev) => setForm((f) => ({ ...f, maxStock: ev.target.value }))}
                />
              </ProdField>
            </ProdSection>

            <ProdSection num={3} icon={<IconCart />} title="구매 / 자재">
              <ProdField label="구매 가능" field="IS_PURCHASABLE">
                <select
                  className="mesProdModalInput"
                  value={form.isPurchasable}
                  onChange={(ev) => setForm((f) => ({ ...f, isPurchasable: ev.target.value as 'Y' | 'N' }))}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </ProdField>
              <ProdField label="기본 공급업체" field="DEFAULT_SUPPLIER">
                <select
                  className="mesProdModalInput"
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
              </ProdField>
              <ProdField label="구매 단위" field="PURCHASE_UNIT">
                <input
                  className="mesProdModalInput"
                  placeholder="예: BOX / KG / EA"
                  value={form.purchaseUnit}
                  onChange={(ev) => setForm((f) => ({ ...f, purchaseUnit: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="단가" field="PURCHASE_PRICE">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 1200"
                  value={form.purchasePrice}
                  onChange={(ev) => setForm((f) => ({ ...f, purchasePrice: ev.target.value }))}
                />
              </ProdField>
              <ProdField label="MOQ" field="MOQ">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 100"
                  value={form.moq}
                  onChange={(ev) => setForm((f) => ({ ...f, moq: ev.target.value }))}
                />
              </ProdField>
            </ProdSection>

            <ProdSection num={4} icon={<IconShield />} title="품질">
              <ProdField label="검사 필수" field="INSPECTION_REQUIRED_YN">
                <select
                  className="mesProdModalInput"
                  value={form.inspectionRequiredYn}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, inspectionRequiredYn: ev.target.value as 'Y' | 'N' }))
                  }
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </ProdField>
              <ProdField label="검사 방식" field="INSPECTION_TYPE">
                <select
                  className="mesProdModalInput"
                  value={form.inspectionType}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, inspectionType: ev.target.value as ProductFormState['inspectionType'] }))
                  }
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="VISION">VISION</option>
                  <option value="SAMPLING">SAMPLING</option>
                </select>
              </ProdField>
              <ProdField label="허용 불량률 %" field="DEFECT_TOLERANCE_RATE" span="full">
                <input
                  className="mesProdModalInput"
                  placeholder="예: 1.5"
                  value={form.defectToleranceRate}
                  onChange={(ev) => setForm((f) => ({ ...f, defectToleranceRate: ev.target.value }))}
                />
              </ProdField>
            </ProdSection>

            <ProdSection num={5} icon={<IconWarehouse />} title="재고 / 물류">
              <ProdField label="LOT 관리" field="LOT_CONTROL_YN">
                <select
                  className="mesProdModalInput"
                  value={form.lotControlYn}
                  onChange={(ev) => setForm((f) => ({ ...f, lotControlYn: ev.target.value as 'Y' | 'N' }))}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </ProdField>
              <ProdField label="매입처 (고객사)" field="PURCHASER_CUSTOMER">
                <select
                  className="mesProdModalInput"
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
              </ProdField>
            </ProdSection>

            <ProdSection num={6} icon={<IconUsers />} title="외주">
              <ProdField label="외주 여부" field="IS_OUTSOURCING">
                <select
                  className="mesProdModalInput"
                  value={form.isOutsourcing}
                  onChange={(ev) => setForm((f) => ({ ...f, isOutsourcing: ev.target.value as 'Y' | 'N' }))}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </ProdField>
              <ProdField label="기본 외주업체" field="DEFAULT_VENDOR">
                <select
                  className="mesProdModalInput"
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
              </ProdField>
            </ProdSection>
          </div>

          {editingTimestamps ? (
            <p className="mesProdModalFootMeta">
              생성 {new Date(editingTimestamps.createdAt).toLocaleString()} · 수정{' '}
              {new Date(editingTimestamps.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
