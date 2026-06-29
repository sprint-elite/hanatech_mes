import { calcDays } from './annualLeaveTypes'
import {
  LeaveApplicationSheet,
  type ApplicantInfo,
  type LeaveFormDraft,
} from './LeaveApplicationSheet'

type Props = {
  applicant: ApplicantInfo
  form: LeaveFormDraft
  onChange: (patch: Partial<LeaveFormDraft>) => void
  saving: boolean
  onClose: () => void
  onSubmit: () => void
}

export function LeaveApplicationApplyModal({
  applicant,
  form,
  onChange,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const handleChange = (patch: Partial<LeaveFormDraft>) => {
    let nextPatch = { ...patch }
    if ('startDate' in patch || 'endDate' in patch) {
      const startDate = patch.startDate ?? form.startDate
      const endDate = patch.endDate ?? form.endDate
      if (startDate && endDate) {
        const autoDays = calcDays(startDate, endDate)
        if (autoDays) nextPatch = { ...nextPatch, days: autoDays }
      }
    }
    onChange(nextPatch)
  }

  return (
    <div className="mesAlModalRoot mesAlModalRoot--doc" role="presentation">
      <button type="button" className="mesModalBackdrop mesAlNoPrint" aria-label="닫기" onClick={onClose} />
      <div className="mesAlDocDialog" role="dialog" aria-modal="true" aria-labelledby="mes-al-apply-title">
        <header className="mesAlDocHeadBar mesAlNoPrint">
          <h2 className="mesAlDocHeadTitle" id="mes-al-apply-title">연차 신청</h2>
          <div className="mesAlDocHeadActions">
            <button
              type="button"
              className="mesAlDocPrintBtn"
              disabled={saving}
              onClick={onSubmit}
            >
              {saving ? '저장 중…' : '신청'}
            </button>
            <button type="button" className="mesAlDocCloseBtn" onClick={onClose}>닫기</button>
          </div>
        </header>

        <LeaveApplicationSheet
          mode="edit"
          applicant={applicant}
          form={form}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
