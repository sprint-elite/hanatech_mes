import type { Dispatch, SetStateAction } from 'react'

type ProductRef = { id: number; productCode: string; productName: string }

export type DefectTypeFormState = {
  productId: string
  defectCode: string
  defectName: string
  defectCategory: string
  severity: string
  useYn: 'Y' | 'N'
}

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: DefectTypeFormState
  setForm: Dispatch<SetStateAction<DefectTypeFormState>>
  products: ProductRef[]
  onSave: () => void
  onClose: () => void
}

export function severityBadgeClass(severity: string | null | undefined): string {
  const s = (severity ?? '').trim().toUpperCase()
  if (s === 'LOW') return 'mesDtSeverityBadge mesDtSeverityBadge--low'
  if (s === 'MID') return 'mesDtSeverityBadge mesDtSeverityBadge--mid'
  if (s === 'HIGH') return 'mesDtSeverityBadge mesDtSeverityBadge--high'
  return 'mesDtSeverityBadge mesDtSeverityBadge--none'
}

function productLabel(p?: ProductRef): string {
  return p ? `${p.productCode} · ${p.productName}` : '—'
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
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

export function DefectTypeFormModal({
  open,
  editingId,
  saving,
  form,
  setForm,
  products,
  onSave,
  onClose,
}: Props) {
  if (!open) return null

  const selectedProduct = products.find((p) => String(p.id) === form.productId)

  return (
    <div className="mesDtModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesDtModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-dt-modal-title">
        <header className="mesDtModalHead">
          <div className="mesDtModalHeadTitle">
            <span className="mesDtModalHeadIcon"><IconAlert /></span>
            <div>
              <h2 className="mesDtModalTitle" id="mes-dt-modal-title">
                {editingId == null ? '불량 유형 등록' : '불량 유형 수정'}
              </h2>
              <p className="mesDtModalSub">
                {editingId == null ? '품목별 불량 코드·등급을 정의합니다.' : `ID ${editingId}`}
              </p>
            </div>
          </div>
          <div className="mesDtModalHeadBadges">
            <span className={severityBadgeClass(form.severity)}>{form.severity || '—'}</span>
            <span className={form.useYn === 'Y' ? 'mesDtUseBadge mesDtUseBadge--y' : 'mesDtUseBadge mesDtUseBadge--n'}>
              {form.useYn === 'Y' ? '사용' : '미사용'}
            </span>
          </div>
        </header>

        <div className="mesDtModalBody">
          <div className="mesDtModalStrip" aria-label="기본 참고">
            <div className="mesDtModalStripItem">
              <span className="mesDtModalStripLabel">코드</span>
              <strong className="mesDtModalStripVal mono">{form.defectCode || '—'}</strong>
            </div>
            <div className="mesDtModalStripItem">
              <span className="mesDtModalStripLabel">명칭</span>
              <strong className="mesDtModalStripVal">{form.defectName || '—'}</strong>
            </div>
            <div className="mesDtModalStripItem">
              <span className="mesDtModalStripLabel">카테고리</span>
              <strong className="mesDtModalStripVal">{form.defectCategory || '—'}</strong>
            </div>
          </div>

          <div className="mesDtModalGrid">
            <section className="mesDtModalCard">
              <h3 className="mesDtModalCardTitle">불량 유형 정보</h3>
              <div className="mesDtModalFieldGrid">
                <label className="mesDtModalField mesDtModalField--full">
                  <span className="mesDtModalFieldLabel">품목</span>
                  <select
                    className="mesDtModalInput"
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  >
                    <option value="">선택하세요</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.productCode} · {p.productName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesDtModalField">
                  <span className="mesDtModalFieldLabel">코드</span>
                  <input
                    className="mesDtModalInput mono"
                    value={form.defectCode}
                    onChange={(e) => setForm((f) => ({ ...f, defectCode: e.target.value }))}
                  />
                </label>
                <label className="mesDtModalField">
                  <span className="mesDtModalFieldLabel">명칭</span>
                  <input
                    className="mesDtModalInput"
                    value={form.defectName}
                    onChange={(e) => setForm((f) => ({ ...f, defectName: e.target.value }))}
                  />
                </label>
                <label className="mesDtModalField">
                  <span className="mesDtModalFieldLabel">카테고리</span>
                  <input
                    className="mesDtModalInput"
                    value={form.defectCategory}
                    onChange={(e) => setForm((f) => ({ ...f, defectCategory: e.target.value }))}
                  />
                </label>
                <label className="mesDtModalField">
                  <span className="mesDtModalFieldLabel">심각도</span>
                  <select
                    className="mesDtModalInput"
                    value={form.severity}
                    onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                  >
                    <option value="">선택</option>
                    <option value="LOW">LOW</option>
                    <option value="MID">MID</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </label>
                <label className="mesDtModalField">
                  <span className="mesDtModalFieldLabel">사용</span>
                  <select
                    className="mesDtModalInput"
                    value={form.useYn}
                    onChange={(e) => setForm((f) => ({ ...f, useYn: e.target.value as 'Y' | 'N' }))}
                  >
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="mesDtModalCard">
              <h3 className="mesDtModalCardTitle">입력 요약</h3>
              <div className="mesDtModalInfoList">
                <div className="mesDtModalInfoRow"><span>품목</span><strong>{productLabel(selectedProduct)}</strong></div>
                <div className="mesDtModalInfoRow"><span>코드</span><strong>{form.defectCode || '—'}</strong></div>
                <div className="mesDtModalInfoRow"><span>명칭</span><strong>{form.defectName || '—'}</strong></div>
                <div className="mesDtModalInfoRow"><span>카테고리</span><strong>{form.defectCategory || '—'}</strong></div>
                <div className="mesDtModalInfoRow"><span>심각도</span><strong>{form.severity || '—'}</strong></div>
                <div className="mesDtModalInfoRow"><span>사용</span><strong>{form.useYn}</strong></div>
              </div>
            </section>
          </div>
        </div>

        <footer className="mesDtModalFoot">
          <button type="button" className="mesDtModalBtn mesDtModalBtn--cancel" disabled={saving} onClick={onClose}>
            <IconX />
            취소
          </button>
          <button type="button" className="mesDtModalBtn mesDtModalBtn--save" disabled={saving} onClick={onSave}>
            <IconSave />
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
