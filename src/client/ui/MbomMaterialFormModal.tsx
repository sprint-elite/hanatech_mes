import type { Dispatch, SetStateAction } from 'react'

export type MbomMaterialFormState = {
  processId: string
  materialProductId: string
  qty: string
  unit: string
  lossRate: string
  isKeyMaterial: 'Y' | 'N'
}

type ProcessRef = {
  id: number
  productId: number
  processCode: string
  processName: string
  sequence: number
  product?: { productCode: string; productName: string }
}

type ProductRef = { id: number; productCode: string; productName: string }

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: MbomMaterialFormState
  setForm: Dispatch<SetStateAction<MbomMaterialFormState>>
  processes: ProcessRef[]
  products: ProductRef[]
  productLabel?: string
  onSave: () => void
  onClose: () => void
}

function processOptionLabel(p: ProcessRef) {
  return `${p.sequence}순 · ${p.processCode} — ${p.processName}`
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
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

export function keyMaterialBadgeClass(y: 'Y' | 'N') {
  return y === 'Y' ? 'mesMmKeyBadge mesMmKeyBadge--y' : 'mesMmKeyBadge mesMmKeyBadge--n'
}

export function MbomMaterialFormModal({
  open,
  editingId,
  saving,
  form,
  setForm,
  processes,
  products,
  productLabel,
  onSave,
  onClose,
}: Props) {
  if (!open) return null

  return (
    <div className="mesMmModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesMmModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-mm-modal-title">
        <header className="mesMmModalHead">
          <div className="mesMmModalHeadTitle">
            <span className="mesMmModalHeadIcon"><IconBox /></span>
            <div>
              <h2 className="mesMmModalTitle" id="mes-mm-modal-title">
                {editingId == null ? '투입자재 등록' : '투입자재 수정'}
              </h2>
              <p className="mesMmModalSub">
                {productLabel ?? '품목을 선택하세요'}
                {editingId != null ? ` · ID ${editingId}` : ''}
              </p>
            </div>
          </div>
          <span className={keyMaterialBadgeClass(form.isKeyMaterial)}>
            {form.isKeyMaterial === 'Y' ? '주요자재' : '일반'}
          </span>
        </header>

        <div className="mesMmModalBody">
          <div className="mesMmModalFieldGrid">
            <label className="mesMmModalField mesMmModalField--full">
              <span className="mesMmModalFieldLabel">투입 공정</span>
              <select
                className="mesMmModalInput"
                value={form.processId}
                onChange={(e) => setForm((f) => ({ ...f, processId: e.target.value }))}
              >
                <option value="">선택</option>
                {processes.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {processOptionLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mesMmModalField mesMmModalField--full">
              <span className="mesMmModalFieldLabel">자재 품목</span>
              <select
                className="mesMmModalInput"
                value={form.materialProductId}
                onChange={(e) => setForm((f) => ({ ...f, materialProductId: e.target.value }))}
              >
                <option value="">선택</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.productCode} · {p.productName}
                  </option>
                ))}
              </select>
            </label>
            <label className="mesMmModalField">
              <span className="mesMmModalFieldLabel">수량</span>
              <input
                className="mesMmModalInput mono"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              />
            </label>
            <label className="mesMmModalField">
              <span className="mesMmModalFieldLabel">단위</span>
              <input
                className="mesMmModalInput"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </label>
            <label className="mesMmModalField">
              <span className="mesMmModalFieldLabel">손실율</span>
              <input
                className="mesMmModalInput mono"
                placeholder="선택"
                value={form.lossRate}
                onChange={(e) => setForm((f) => ({ ...f, lossRate: e.target.value }))}
              />
            </label>
            <label className="mesMmModalField">
              <span className="mesMmModalFieldLabel">주요자재</span>
              <select
                className="mesMmModalInput"
                value={form.isKeyMaterial}
                onChange={(e) => setForm((f) => ({ ...f, isKeyMaterial: e.target.value as 'Y' | 'N' }))}
              >
                <option value="N">N</option>
                <option value="Y">Y</option>
              </select>
            </label>
          </div>
        </div>

        <footer className="mesMmModalFoot">
          <button type="button" className="mesMmModalBtn mesMmModalBtn--cancel" disabled={saving} onClick={onClose}>
            <IconX />
            취소
          </button>
          <button type="button" className="mesMmModalBtn mesMmModalBtn--save" disabled={saving} onClick={onSave}>
            <IconSave />
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
