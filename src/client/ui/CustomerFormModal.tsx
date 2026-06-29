import type { Dispatch, SetStateAction } from 'react'

export type CustomerType = 'CUSTOMER' | 'SUPPLIER' | 'OUTSOURCING'

export type CustomerFormState = {
  customerCode: string
  customerName: string
  type: CustomerType
  useYn: 'Y' | 'N'
  contactName: string
  phone: string
  email: string
  address: string
  remark: string
}

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: CustomerFormState
  setForm: Dispatch<SetStateAction<CustomerFormState>>
  onSave: () => void
  onClose: () => void
}

function typeLabel(t: CustomerType) {
  if (t === 'CUSTOMER') return '고객사(발주처)'
  if (t === 'SUPPLIER') return '공급업체(구매처)'
  return '외주업체'
}

export function typeBadgeClass(t: CustomerType): string {
  if (t === 'CUSTOMER') return 'mesCustTypeBadge mesCustTypeBadge--customer'
  if (t === 'SUPPLIER') return 'mesCustTypeBadge mesCustTypeBadge--supplier'
  return 'mesCustTypeBadge mesCustTypeBadge--outsourcing'
}

function useBadgeClass(y: 'Y' | 'N') {
  return y === 'Y' ? 'mesCustUseBadge mesCustUseBadge--y' : 'mesCustUseBadge mesCustUseBadge--n'
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

export function CustomerFormModal({ open, editingId, saving, form, setForm, onSave, onClose }: Props) {
  if (!open) return null

  return (
    <div className="mesCustModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesCustModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-customer-modal-title">
        <header className="mesCustModalHead">
          <div className="mesCustModalHeadTitle">
            <span className="mesCustModalHeadIcon"><IconUsers /></span>
            <div>
              <h2 className="mesCustModalTitle" id="mes-customer-modal-title">
                {editingId == null ? '고객/업체 등록' : '고객/업체 수정'}
              </h2>
              <p className="mesCustModalSub">
                {editingId == null ? '거래처 기준정보를 입력합니다.' : `ID ${editingId}`}
              </p>
            </div>
          </div>
          <div className="mesCustModalHeadBadges">
            <span className={typeBadgeClass(form.type)}>{typeLabel(form.type)}</span>
            <span className={useBadgeClass(form.useYn)}>{form.useYn === 'Y' ? '사용' : '미사용'}</span>
          </div>
        </header>

        <div className="mesCustModalBody">
          <div className="mesCustModalStrip" aria-label="기본 참고">
            <div className="mesCustModalStripItem">
              <span className="mesCustModalStripLabel">코드</span>
              <strong className="mesCustModalStripVal mono">{form.customerCode || '—'}</strong>
            </div>
            <div className="mesCustModalStripItem">
              <span className="mesCustModalStripLabel">구분</span>
              <strong className="mesCustModalStripVal">{typeLabel(form.type)}</strong>
            </div>
            <div className="mesCustModalStripItem">
              <span className="mesCustModalStripLabel">사용</span>
              <strong className="mesCustModalStripVal">{form.useYn === 'Y' ? 'Y' : 'N'}</strong>
            </div>
          </div>

          <div className="mesCustModalGrid">
            <section className="mesCustModalCard">
              <h3 className="mesCustModalCardTitle">기본 정보</h3>
              <div className="mesCustModalFieldGrid">
                <label className="mesCustModalField">
                  <span className="mesCustModalFieldLabel">코드</span>
                  <input
                    className="mesCustModalInput mono"
                    value={form.customerCode}
                    onChange={(e) => setForm((f) => ({ ...f, customerCode: e.target.value }))}
                  />
                </label>
                <label className="mesCustModalField">
                  <span className="mesCustModalFieldLabel">명칭</span>
                  <input
                    className="mesCustModalInput"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  />
                </label>
                <label className="mesCustModalField">
                  <span className="mesCustModalFieldLabel">구분</span>
                  <select
                    className="mesCustModalInput"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CustomerType }))}
                  >
                    <option value="CUSTOMER">고객사(발주처)</option>
                    <option value="SUPPLIER">공급업체(구매처)</option>
                    <option value="OUTSOURCING">외주업체</option>
                  </select>
                </label>
                <label className="mesCustModalField">
                  <span className="mesCustModalFieldLabel">사용</span>
                  <select
                    className="mesCustModalInput"
                    value={form.useYn}
                    onChange={(e) => setForm((f) => ({ ...f, useYn: e.target.value as 'Y' | 'N' }))}
                  >
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>
                <label className="mesCustModalField">
                  <span className="mesCustModalFieldLabel">담당자</span>
                  <input
                    className="mesCustModalInput"
                    value={form.contactName}
                    onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  />
                </label>
                <label className="mesCustModalField">
                  <span className="mesCustModalFieldLabel">전화</span>
                  <input
                    className="mesCustModalInput"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </label>
                <label className="mesCustModalField mesCustModalField--full">
                  <span className="mesCustModalFieldLabel">이메일</span>
                  <input
                    className="mesCustModalInput"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </label>
                <label className="mesCustModalField mesCustModalField--full">
                  <span className="mesCustModalFieldLabel">주소</span>
                  <input
                    className="mesCustModalInput"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </label>
                <label className="mesCustModalField mesCustModalField--full">
                  <span className="mesCustModalFieldLabel">비고</span>
                  <textarea
                    className="mesCustModalInput mesCustModalTextarea"
                    rows={3}
                    value={form.remark}
                    onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                  />
                </label>
              </div>
            </section>

            <section className="mesCustModalCard">
              <h3 className="mesCustModalCardTitle">정보 요약</h3>
              <div className="mesCustModalInfoList">
                <div className="mesCustModalInfoRow"><span>명칭</span><strong>{form.customerName || '—'}</strong></div>
                <div className="mesCustModalInfoRow"><span>담당자</span><strong>{form.contactName || '—'}</strong></div>
                <div className="mesCustModalInfoRow"><span>전화</span><strong>{form.phone || '—'}</strong></div>
                <div className="mesCustModalInfoRow"><span>이메일</span><strong>{form.email || '—'}</strong></div>
                <div className="mesCustModalInfoRow"><span>주소</span><strong>{form.address || '—'}</strong></div>
                <div className="mesCustModalInfoRow"><span>비고</span><strong>{form.remark || '—'}</strong></div>
              </div>
            </section>
          </div>
        </div>

        <footer className="mesCustModalFoot">
          <button type="button" className="mesCustModalBtn mesCustModalBtn--cancel" disabled={saving} onClick={onClose}>
            <IconX />
            취소
          </button>
          <button type="button" className="mesCustModalBtn mesCustModalBtn--save" disabled={saving} onClick={onSave}>
            <IconSave />
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
