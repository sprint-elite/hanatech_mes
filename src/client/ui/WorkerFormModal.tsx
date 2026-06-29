import type { Dispatch, SetStateAction } from 'react'

export type WorkerFormState = {
  workerCode: string
  workerName: string
  team: string
  position: string
  skillLevel: string
  phone: string
  hireDate: string
  status: string
}

type Props = {
  open: boolean
  editingId: number | null
  saving: boolean
  form: WorkerFormState
  setForm: Dispatch<SetStateAction<WorkerFormState>>
  onSave: () => void
  onClose: () => void
}

export function statusBadgeClass(status: string): string {
  const s = status.trim().toUpperCase()
  if (s === 'ACTIVE' || s === 'Y') return 'mesWrStatusBadge mesWrStatusBadge--active'
  return 'mesWrStatusBadge mesWrStatusBadge--inactive'
}

function statusLabel(status: string): string {
  const s = status.trim().toUpperCase()
  if (s === 'ACTIVE') return '재직'
  if (s === 'INACTIVE') return '퇴사'
  return status || '—'
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
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

export function WorkerFormModal({ open, editingId, saving, form, setForm, onSave, onClose }: Props) {
  if (!open) return null

  return (
    <div className="mesWrModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesWrModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-worker-modal-title">
        <header className="mesWrModalHead">
          <div className="mesWrModalHeadTitle">
            <span className="mesWrModalHeadIcon"><IconUser /></span>
            <div>
              <h2 className="mesWrModalTitle" id="mes-worker-modal-title">
                {editingId == null ? '작업자 등록' : '작업자 수정'}
              </h2>
              <p className="mesWrModalSub">
                {editingId == null ? '현장 작업자 기준정보를 입력합니다.' : `ID ${editingId}`}
              </p>
            </div>
          </div>
          <div className="mesWrModalHeadBadges">
            <span className={statusBadgeClass(form.status)}>{statusLabel(form.status)}</span>
          </div>
        </header>

        <div className="mesWrModalBody">
          <div className="mesWrModalStrip" aria-label="기본 참고">
            <div className="mesWrModalStripItem">
              <span className="mesWrModalStripLabel">코드</span>
              <strong className="mesWrModalStripVal mono">{form.workerCode || '—'}</strong>
            </div>
            <div className="mesWrModalStripItem">
              <span className="mesWrModalStripLabel">이름</span>
              <strong className="mesWrModalStripVal">{form.workerName || '—'}</strong>
            </div>
            <div className="mesWrModalStripItem">
              <span className="mesWrModalStripLabel">팀</span>
              <strong className="mesWrModalStripVal">{form.team || '—'}</strong>
            </div>
          </div>

          <div className="mesWrModalGrid">
            <section className="mesWrModalCard">
              <h3 className="mesWrModalCardTitle">기본 정보</h3>
              <div className="mesWrModalFieldGrid">
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">사번/코드</span>
                  <input
                    className="mesWrModalInput mono"
                    value={form.workerCode}
                    onChange={(e) => setForm((f) => ({ ...f, workerCode: e.target.value }))}
                  />
                </label>
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">이름</span>
                  <input
                    className="mesWrModalInput"
                    value={form.workerName}
                    onChange={(e) => setForm((f) => ({ ...f, workerName: e.target.value }))}
                  />
                </label>
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">팀</span>
                  <input
                    className="mesWrModalInput"
                    value={form.team}
                    onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
                  />
                </label>
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">직급</span>
                  <input
                    className="mesWrModalInput"
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  />
                </label>
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">숙련도</span>
                  <input
                    className="mesWrModalInput"
                    value={form.skillLevel}
                    onChange={(e) => setForm((f) => ({ ...f, skillLevel: e.target.value }))}
                  />
                </label>
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">상태</span>
                  <select
                    className="mesWrModalInput"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="ACTIVE">ACTIVE (재직)</option>
                    <option value="INACTIVE">INACTIVE (퇴사)</option>
                  </select>
                </label>
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">전화</span>
                  <input
                    className="mesWrModalInput"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </label>
                <label className="mesWrModalField">
                  <span className="mesWrModalFieldLabel">입사일</span>
                  <input
                    className="mesWrModalInput"
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
                  />
                </label>
              </div>
            </section>

            <section className="mesWrModalCard">
              <h3 className="mesWrModalCardTitle">입력 요약</h3>
              <div className="mesWrModalInfoList">
                <div className="mesWrModalInfoRow"><span>이름</span><strong>{form.workerName || '—'}</strong></div>
                <div className="mesWrModalInfoRow"><span>팀</span><strong>{form.team || '—'}</strong></div>
                <div className="mesWrModalInfoRow"><span>직급</span><strong>{form.position || '—'}</strong></div>
                <div className="mesWrModalInfoRow"><span>숙련도</span><strong>{form.skillLevel || '—'}</strong></div>
                <div className="mesWrModalInfoRow"><span>전화</span><strong>{form.phone || '—'}</strong></div>
                <div className="mesWrModalInfoRow"><span>입사일</span><strong>{form.hireDate || '—'}</strong></div>
              </div>
            </section>
          </div>
        </div>

        <footer className="mesWrModalFoot">
          <button type="button" className="mesWrModalBtn mesWrModalBtn--cancel" disabled={saving} onClick={onClose}>
            <IconX />
            취소
          </button>
          <button type="button" className="mesWrModalBtn mesWrModalBtn--save" disabled={saving} onClick={onSave}>
            <IconSave />
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
