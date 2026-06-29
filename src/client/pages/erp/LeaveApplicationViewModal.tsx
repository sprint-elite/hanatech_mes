import { LeaveApplicationSheet } from './LeaveApplicationSheet'
import type { LeaveRow } from './annualLeaveTypes'

type Props = {
  row: LeaveRow
  onClose: () => void
}

export function LeaveApplicationViewModal({ row, onClose }: Props) {
  const printForm = () => {
    window.print()
  }

  return (
    <div className="mesAlModalRoot mesAlModalRoot--doc" role="presentation">
      <button type="button" className="mesModalBackdrop mesAlNoPrint" aria-label="닫기" onClick={onClose} />
      <div className="mesAlDocDialog" role="dialog" aria-modal="true" aria-labelledby="mes-al-doc-title">
        <header className="mesAlDocHeadBar mesAlNoPrint">
          <h2 className="mesAlDocHeadTitle" id="mes-al-doc-title">연차신청서 보기</h2>
          <div className="mesAlDocHeadActions">
            <button type="button" className="mesAlDocPrintBtn" onClick={printForm}>인쇄</button>
            <button type="button" className="mesAlDocCloseBtn" onClick={onClose}>닫기</button>
          </div>
        </header>

        <LeaveApplicationSheet mode="view" row={row} />
      </div>
    </div>
  )
}
