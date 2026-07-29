import {
  WorkOrderProcessWorkerAssign,
  type ProcessWorkerMap,
  type WorkerPickRef,
} from './WorkOrderProcessWorkerAssign'

type Variant = 'ops' | 'wo'

type Props = {
  open: boolean
  onClose: () => void
  variant: Variant
  productId: number | null
  workers: WorkerPickRef[]
  value: ProcessWorkerMap
  onChange: (next: ProcessWorkerMap) => void
  metaExtra?: string
  legacyWorkerIds?: number[]
  /** 작업지시 수량 — 자동 배정 시 완료 예상 시간 계산에 사용 */
  orderQty?: number
}

export function WorkOrderProcessWorkerModal({
  open,
  onClose,
  variant,
  productId,
  workers,
  value,
  onChange,
  metaExtra,
  legacyWorkerIds,
  orderQty = 1,
}: Props) {
  if (!open) return null

  if (variant === 'ops') {
    return (
      <div className="mesOpsPlanModalRoot mesModalRootNested" role="presentation">
        <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
        <div
          className="mesOpsPlanModalDialog mesOpsPlanModalDialog--wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mes-wo-worker-assign-title"
        >
          <header className="mesOpsPlanModalHead">
            <div className="mesOpsPlanModalHeadTitle">
              <div>
                <h2 className="mesOpsPlanModalTitle" id="mes-wo-worker-assign-title">
                  공정별 작업 배정
                </h2>
                <p className="mesOpsPlanModalSub">작업자를 공정 카드로 끌어다 놓거나, 공정 선택 후 작업자를 클릭하세요.</p>
              </div>
            </div>
          </header>
          <div className="mesOpsPlanModalBody mesOpsPlanModalBody--workerAssign">
            <WorkOrderProcessWorkerAssign
              variant="ops"
              productId={productId}
              workers={workers}
              value={value}
              onChange={onChange}
              metaExtra={metaExtra}
              legacyWorkerIds={legacyWorkerIds}
              orderQty={orderQty}
              embedded
            />
          </div>
          <footer className="mesOpsPlanModalFoot">
            <button type="button" className="mesOpsPlanModalBtn mesOpsPlanModalBtn--save" onClick={onClose}>
              확인
            </button>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="mesModalRoot mesModalRootNested" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-wo-worker-assign-title-wo">
        <div className="mesModalHead">
          <div>
            <h2 className="mesModalTitle" id="mes-wo-worker-assign-title-wo">
              공정별 작업 배정
            </h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              작업자를 공정 카드로 끌어다 놓거나, 공정 선택 후 작업자를 클릭하세요.
            </p>
          </div>
          <button type="button" className="mesBtnPrimary" onClick={onClose}>
            확인
          </button>
        </div>
        <div className="mesModalBody">
          <WorkOrderProcessWorkerAssign
            variant="wo"
            productId={productId}
            workers={workers}
            value={value}
            onChange={onChange}
            legacyWorkerIds={legacyWorkerIds}
            orderQty={orderQty}
            embedded
          />
        </div>
      </div>
    </div>
  )
}
