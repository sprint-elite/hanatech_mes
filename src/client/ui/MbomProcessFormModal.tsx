import type { Dispatch, SetStateAction } from 'react'

type Wc = { id: number; centerCode: string; centerName: string }

export type MbomProcessFormState = {
  productId: string
  processCode: string
  processName: string
  sequence: string
  workCenterId: string
  standardTimeSec: string
  baseQty: string
  remark: string
  isOutsourcing: 'Y' | 'N'
  useYn: 'Y' | 'N'
}

type ProductRef = { id: number; productCode: string; productName: string }

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: MbomProcessFormState
  setForm: Dispatch<SetStateAction<MbomProcessFormState>>
  product?: ProductRef | null
  workCenters: Wc[]
  onSave: () => void
  onClose: () => void
}

function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h5a4 4 0 0 1 4 4v4" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4M12 16V8M17 16v-6" />
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

export function MbomProcessFormModal({
  open,
  editingId,
  saving,
  form,
  setForm,
  product,
  workCenters,
  onSave,
  onClose,
}: Props) {
  if (!open) return null

  return (
    <div className="mesMbModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesMbModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-mb-modal-title">
        <header className="mesMbModalHead">
          <div className="mesMbModalHeadTitle">
            <span className="mesMbModalHeadIcon"><IconRoute /></span>
            <div>
              <h2 className="mesMbModalTitle" id="mes-mb-modal-title">
                {editingId == null ? '공정 등록' : '공정 수정'}
              </h2>
              <p className="mesMbModalSub">
                {product ? `${product.productCode} · ${product.productName}` : '품목을 선택하세요'}
                {editingId != null ? ` · ID ${editingId}` : ''}
              </p>
            </div>
          </div>
          <button type="button" className="mesMbModalClose" onClick={onClose} aria-label="닫기">
            <IconX />
          </button>
        </header>

        <div className="mesMbModalBody">
          <section className="mesMbModalSection">
            <h3 className="mesMbModalSectionTitle">
              <span className="mesMbModalSectionIcon"><IconRoute /></span>
              공정 정의
            </h3>
            <div className="mesMbModalFieldGrid">
              <label className="mesMbModalField">
                <span className="mesMbModalFieldLabel">순서</span>
                <input
                  className="mesMbModalInput mono"
                  value={form.sequence}
                  onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))}
                />
              </label>
              <label className="mesMbModalField">
                <span className="mesMbModalFieldLabel">공정코드</span>
                <input
                  className="mesMbModalInput mono"
                  placeholder="예: 0001"
                  value={form.processCode}
                  onChange={(e) => setForm((f) => ({ ...f, processCode: e.target.value }))}
                />
              </label>
              <label className="mesMbModalField mesMbModalField--full">
                <span className="mesMbModalFieldLabel">공정명</span>
                <input
                  className="mesMbModalInput"
                  placeholder="공정 설명"
                  value={form.processName}
                  onChange={(e) => setForm((f) => ({ ...f, processName: e.target.value }))}
                />
              </label>
              <label className="mesMbModalField mesMbModalField--full">
                <span className="mesMbModalFieldLabel">작업장</span>
                <select
                  className="mesMbModalInput"
                  value={form.workCenterId}
                  onChange={(e) => setForm((f) => ({ ...f, workCenterId: e.target.value }))}
                >
                  <option value="">없음</option>
                  {workCenters.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.centerCode} · {w.centerName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mesMbModalField">
                <span className="mesMbModalFieldLabel">외주</span>
                <select
                  className="mesMbModalInput"
                  value={form.isOutsourcing}
                  onChange={(e) => setForm((f) => ({ ...f, isOutsourcing: e.target.value as 'Y' | 'N' }))}
                >
                  <option value="N">N</option>
                  <option value="Y">Y</option>
                </select>
              </label>
              <label className="mesMbModalField">
                <span className="mesMbModalFieldLabel">사용</span>
                <select
                  className="mesMbModalInput"
                  value={form.useYn}
                  onChange={(e) => setForm((f) => ({ ...f, useYn: e.target.value as 'Y' | 'N' }))}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </label>
            </div>
          </section>

          <section className="mesMbModalSection">
            <h3 className="mesMbModalSectionTitle">
              <span className="mesMbModalSectionIcon"><IconChart /></span>
              공정분석표
            </h3>
            <p className="mesMbModalSectionHint">
              품목·공정별 표준 생산시간과 기준 생산수량을 입력합니다. (시간 단위: 초)
            </p>
            <div className="mesMbModalFieldGrid">
              <label className="mesMbModalField">
                <span className="mesMbModalFieldLabel">표준 생산시간 (초)</span>
                <input
                  className="mesMbModalInput mono"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="예: 600.5"
                  value={form.standardTimeSec}
                  onChange={(e) => setForm((f) => ({ ...f, standardTimeSec: e.target.value }))}
                />
              </label>
              <label className="mesMbModalField">
                <span className="mesMbModalFieldLabel">기준 생산수량</span>
                <input
                  className="mesMbModalInput mono"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="예: 100"
                  value={form.baseQty}
                  onChange={(e) => setForm((f) => ({ ...f, baseQty: e.target.value }))}
                />
              </label>
              <label className="mesMbModalField mesMbModalField--full">
                <span className="mesMbModalFieldLabel">비고</span>
                <textarea
                  className="mesMbModalInput mesMbModalTextarea"
                  rows={2}
                  placeholder="특이사항, 측정 기준 등"
                  value={form.remark}
                  onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                />
              </label>
            </div>
          </section>
        </div>

        <footer className="mesMbModalFoot">
          <button type="button" className="mesMbModalBtn mesMbModalBtn--cancel" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="mesMbModalBtn mesMbModalBtn--save"
            disabled={saving || !form.productId}
            onClick={onSave}
          >
            <IconSave />
            {saving ? '저장 중…' : editingId == null ? '등록' : '수정 저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
