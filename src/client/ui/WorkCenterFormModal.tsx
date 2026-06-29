import type { Dispatch, SetStateAction } from 'react'

export type CenterType = 'LINE' | 'EQUIPMENT' | 'OUTSOURCE'

export type WorkCenterFormState = {
  centerCode: string
  centerName: string
  centerType: CenterType
  parentId: string
  location: string
  capacityPerHour: string
  useYn: 'Y' | 'N'
}

type ParentOption = { id: number; centerCode: string; centerName: string }

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: WorkCenterFormState
  setForm: Dispatch<SetStateAction<WorkCenterFormState>>
  parentOptions: ParentOption[]
  onSave: () => void
  onClose: () => void
}

export function typeLabel(t: CenterType): string {
  if (t === 'LINE') return '라인'
  if (t === 'EQUIPMENT') return '설비'
  return '외주'
}

export function typeBadgeClass(t: string): string {
  if (t === 'LINE') return 'mesWcTypeBadge mesWcTypeBadge--line'
  if (t === 'EQUIPMENT') return 'mesWcTypeBadge mesWcTypeBadge--equip'
  if (t === 'OUTSOURCE') return 'mesWcTypeBadge mesWcTypeBadge--out'
  return 'mesWcTypeBadge'
}

function useBadgeClass(y: 'Y' | 'N') {
  return y === 'Y' ? 'mesWcUseBadge mesWcUseBadge--y' : 'mesWcUseBadge mesWcUseBadge--n'
}

function IconFactory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h.01M15 9h.01" />
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

export function WorkCenterFormModal({
  open,
  editingId,
  saving,
  form,
  setForm,
  parentOptions,
  onSave,
  onClose,
}: Props) {
  if (!open) return null

  const parentLabel = parentOptions.find((p) => String(p.id) === form.parentId)

  return (
    <div className="mesWcModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesWcModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-wc-modal-title">
        <header className="mesWcModalHead">
          <div className="mesWcModalHeadTitle">
            <span className="mesWcModalHeadIcon"><IconFactory /></span>
            <div>
              <h2 className="mesWcModalTitle" id="mes-wc-modal-title">
                {editingId == null ? '작업장 등록' : '작업장 수정'}
              </h2>
              <p className="mesWcModalSub">
                {editingId == null ? '라인·설비·외주 작업장을 등록합니다.' : `ID ${editingId}`}
              </p>
            </div>
          </div>
          <div className="mesWcModalHeadBadges">
            <span className={typeBadgeClass(form.centerType)}>{typeLabel(form.centerType)}</span>
            <span className={useBadgeClass(form.useYn)}>{form.useYn === 'Y' ? '사용' : '미사용'}</span>
          </div>
        </header>

        <div className="mesWcModalBody">
          <div className="mesWcModalStrip" aria-label="기본 참고">
            <div className="mesWcModalStripItem">
              <span className="mesWcModalStripLabel">코드</span>
              <strong className="mesWcModalStripVal mono">{form.centerCode || '—'}</strong>
            </div>
            <div className="mesWcModalStripItem">
              <span className="mesWcModalStripLabel">명칭</span>
              <strong className="mesWcModalStripVal">{form.centerName || '—'}</strong>
            </div>
            <div className="mesWcModalStripItem">
              <span className="mesWcModalStripLabel">유형</span>
              <strong className="mesWcModalStripVal">{typeLabel(form.centerType)}</strong>
            </div>
          </div>

          <div className="mesWcModalGrid">
            <section className="mesWcModalCard">
              <h3 className="mesWcModalCardTitle">기본 정보</h3>
              <div className="mesWcModalFieldGrid">
                <label className="mesWcModalField">
                  <span className="mesWcModalFieldLabel">코드</span>
                  <input
                    className="mesWcModalInput mono"
                    value={form.centerCode}
                    onChange={(e) => setForm((f) => ({ ...f, centerCode: e.target.value }))}
                  />
                </label>
                <label className="mesWcModalField">
                  <span className="mesWcModalFieldLabel">명칭</span>
                  <input
                    className="mesWcModalInput"
                    value={form.centerName}
                    onChange={(e) => setForm((f) => ({ ...f, centerName: e.target.value }))}
                  />
                </label>
                <label className="mesWcModalField">
                  <span className="mesWcModalFieldLabel">유형</span>
                  <select
                    className="mesWcModalInput"
                    value={form.centerType}
                    onChange={(e) => setForm((f) => ({ ...f, centerType: e.target.value as CenterType }))}
                  >
                    <option value="LINE">LINE (라인)</option>
                    <option value="EQUIPMENT">EQUIPMENT (설비)</option>
                    <option value="OUTSOURCE">OUTSOURCE (외주)</option>
                  </select>
                </label>
                <label className="mesWcModalField">
                  <span className="mesWcModalFieldLabel">사용</span>
                  <select
                    className="mesWcModalInput"
                    value={form.useYn}
                    onChange={(e) => setForm((f) => ({ ...f, useYn: e.target.value as 'Y' | 'N' }))}
                  >
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>
                <label className="mesWcModalField mesWcModalField--full">
                  <span className="mesWcModalFieldLabel">상위 작업장</span>
                  <select
                    className="mesWcModalInput"
                    value={form.parentId}
                    onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  >
                    <option value="">없음</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.centerCode} · {p.centerName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesWcModalField">
                  <span className="mesWcModalFieldLabel">위치</span>
                  <input
                    className="mesWcModalInput"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </label>
                <label className="mesWcModalField">
                  <span className="mesWcModalFieldLabel">시간당 생산능력</span>
                  <input
                    className="mesWcModalInput mono"
                    inputMode="numeric"
                    value={form.capacityPerHour}
                    onChange={(e) => setForm((f) => ({ ...f, capacityPerHour: e.target.value }))}
                  />
                </label>
              </div>
            </section>

            <section className="mesWcModalCard">
              <h3 className="mesWcModalCardTitle">입력 요약</h3>
              <div className="mesWcModalInfoList">
                <div className="mesWcModalInfoRow"><span>명칭</span><strong>{form.centerName || '—'}</strong></div>
                <div className="mesWcModalInfoRow"><span>유형</span><strong>{typeLabel(form.centerType)}</strong></div>
                <div className="mesWcModalInfoRow"><span>상위</span><strong>{parentLabel ? `${parentLabel.centerCode} · ${parentLabel.centerName}` : '—'}</strong></div>
                <div className="mesWcModalInfoRow"><span>위치</span><strong>{form.location || '—'}</strong></div>
                <div className="mesWcModalInfoRow"><span>생산능력</span><strong>{form.capacityPerHour || '—'}</strong></div>
                <div className="mesWcModalInfoRow"><span>사용</span><strong>{form.useYn}</strong></div>
              </div>
            </section>
          </div>
        </div>

        <footer className="mesWcModalFoot">
          <button type="button" className="mesWcModalBtn mesWcModalBtn--cancel" disabled={saving} onClick={onClose}>
            <IconX />
            취소
          </button>
          <button type="button" className="mesWcModalBtn mesWcModalBtn--save" disabled={saving} onClick={onSave}>
            <IconSave />
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
