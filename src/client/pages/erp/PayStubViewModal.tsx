import { PayStubSheet } from './PayStubSheet'
import type { PayStubRow } from './payStubTypes'

type Props = {
  stub: PayStubRow
  onClose: () => void
}

export function PayStubViewModal({ stub, onClose }: Props) {
  const printForm = () => {
    window.print()
  }

  return (
    <div className="mesPsModalRoot mesPsModalRoot--doc" role="presentation">
      <button type="button" className="mesModalBackdrop mesPsNoPrint" aria-label="닫기" onClick={onClose} />
      <div className="mesPsDocDialog" role="dialog" aria-modal="true" aria-labelledby="mes-ps-doc-title">
        <header className="mesPsDocHeadBar mesPsNoPrint">
          <h2 className="mesPsDocHeadTitle" id="mes-ps-doc-title">급여명세서</h2>
          <div className="mesPsDocHeadActions">
            <button type="button" className="mesPsDocPrintBtn" onClick={printForm}>인쇄</button>
            <button type="button" className="mesPsDocCloseBtn" onClick={onClose}>닫기</button>
          </div>
        </header>

        <PayStubSheet stub={stub} />
      </div>
    </div>
  )
}
