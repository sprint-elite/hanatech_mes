import { ExpenseReportSheet } from './ExpenseReportSheet'
import type { ExpenseRow } from './expenseReportTypes'

type Props = {
  row: ExpenseRow
  onClose: () => void
}

export function ExpenseReportViewModal({ row, onClose }: Props) {
  const printForm = () => {
    window.print()
  }

  return (
    <div className="mesAlModalRoot mesAlModalRoot--doc" role="presentation">
      <button type="button" className="mesModalBackdrop mesAlNoPrint" aria-label="닫기" onClick={onClose} />
      <div className="mesAlDocDialog mesErDocDialog" role="dialog" aria-modal="true" aria-labelledby="mes-er-doc-title">
        <header className="mesAlDocHeadBar mesAlNoPrint">
          <h2 className="mesAlDocHeadTitle" id="mes-er-doc-title">
            지출결의서 보기
          </h2>
          <div className="mesAlDocHeadActions">
            <button type="button" className="mesAlDocPrintBtn" onClick={printForm}>
              인쇄
            </button>
            <button type="button" className="mesAlDocCloseBtn" onClick={onClose}>
              닫기
            </button>
          </div>
        </header>

        <ExpenseReportSheet mode="view" row={row} />
      </div>
    </div>
  )
}
