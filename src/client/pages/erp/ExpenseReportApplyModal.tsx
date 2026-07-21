import { ExpenseReportSheet } from './ExpenseReportSheet'
import type { ApplicantInfo } from './ExpenseReportSheet'
import type { ExpenseFormDraft } from './expenseReportTypes'

type Props = {
  applicant: ApplicantInfo
  form: ExpenseFormDraft
  lineSlots: number
  onChange: (patch: Partial<ExpenseFormDraft>) => void
  onLineChange: (index: number, patch: Partial<ExpenseFormDraft['lines'][number]>) => void
  onAddLine: () => void
  onReceiptPick: (file: File | null) => void
  saving: boolean
  onClose: () => void
  onSubmit: () => void
}

export function ExpenseReportApplyModal({
  applicant,
  form,
  lineSlots,
  onChange,
  onLineChange,
  onAddLine,
  onReceiptPick,
  saving,
  onClose,
  onSubmit,
}: Props) {
  return (
    <div className="mesAlModalRoot mesAlModalRoot--doc" role="presentation">
      <button type="button" className="mesModalBackdrop mesAlNoPrint" aria-label="닫기" onClick={onClose} />
      <div className="mesAlDocDialog mesErDocDialog" role="dialog" aria-modal="true" aria-labelledby="mes-er-apply-title">
        <header className="mesAlDocHeadBar mesAlNoPrint">
          <h2 className="mesAlDocHeadTitle" id="mes-er-apply-title">
            지출결의서 작성
          </h2>
          <div className="mesAlDocHeadActions">
            <button type="button" className="mesAlDocCloseBtn" onClick={onAddLine}>
              + 항목 추가
            </button>
            <button type="button" className="mesAlDocPrintBtn" disabled={saving} onClick={onSubmit}>
              {saving ? '저장 중…' : '신청'}
            </button>
            <button type="button" className="mesAlDocCloseBtn" onClick={onClose}>
              닫기
            </button>
          </div>
        </header>

        <ExpenseReportSheet
          mode="edit"
          applicant={applicant}
          form={form}
          lineSlots={lineSlots}
          onChange={onChange}
          onLineChange={onLineChange}
          onReceiptPick={onReceiptPick}
        />
      </div>
    </div>
  )
}
