export type AssignConfirmRow = {
  processId: number
  workerId: number
  processCode: string
  processName: string
  workerCode: string
  workerName: string
  efficiencyPct: number | null
  dataSource: 'history' | 'standard'
}

type Props = {
  open: boolean
  variant: 'ops' | 'wo'
  groupPreview: string
  orderQty: number
  makespanLabel: string
  assignments: AssignConfirmRow[]
  applying: boolean
  onCancel: () => void
  onApply: () => void
}

export function ProcessWorkerAssignConfirmModal({
  open,
  variant,
  groupPreview,
  orderQty,
  makespanLabel,
  assignments,
  applying,
  onCancel,
  onApply,
}: Props) {
  if (!open) return null

  const isOps = variant === 'ops'
  const rootClass = isOps ? 'mesOpsPlanModalRoot mesModalRootNested' : 'mesModalRoot mesModalRootNested'
  const dialogClass = isOps
    ? 'mesOpsPlanModalDialog mesOpsPlanModalDialog--wide mesWoAssignConfirmDialog'
    : 'mesModalDialog mesModalDialogWide mesWoAssignConfirmDialog'

  return (
    <div className={rootClass} role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => !applying && onCancel()} />
      <div className={dialogClass} role="dialog" aria-modal="true" aria-labelledby="mes-assign-confirm-title">
        {isOps ? (
          <header className="mesOpsPlanModalHead">
            <div className="mesOpsPlanModalHeadTitle">
              <div>
                <h2 className="mesOpsPlanModalTitle" id="mes-assign-confirm-title">
                  자동 배정 결과
                </h2>
                <p className="mesOpsPlanModalSub">아래 내용으로 공정별 작업자를 채웁니다.</p>
              </div>
            </div>
          </header>
        ) : (
          <div className="mesModalHead">
            <div>
              <h2 className="mesModalTitle" id="mes-assign-confirm-title">
                자동 배정 결과
              </h2>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                확인 후 적용하면 공정 카드에 반영됩니다.
              </p>
            </div>
          </div>
        )}

        <div className={`mesWoAssignConfirmBody ${isOps ? 'mesOpsPlanModalBody' : 'mesModalBody'}`}>
          <div className="mesOpsPlanModalStrip mesWoAssignConfirmStrip">
            <div className="mesOpsPlanModalStripItem">
              <span className="mesOpsPlanModalStripLabel">묶음</span>
              <span className="mesOpsPlanModalStripVal">{groupPreview || '—'}</span>
            </div>
            <div className="mesOpsPlanModalStripItem">
              <span className="mesOpsPlanModalStripLabel">지시 수량</span>
              <span className="mesOpsPlanModalStripVal">{orderQty.toLocaleString()}개</span>
            </div>
            <div className="mesOpsPlanModalStripItem">
              <span className="mesOpsPlanModalStripLabel">완료 예상</span>
              <span className="mesOpsPlanModalStripVal mesWoAssignConfirmMakespan">{makespanLabel}</span>
            </div>
          </div>

          <div className="mesWoAssignConfirmTableWrap">
            <table className="mesWoAssignConfirmTable">
              <thead>
                <tr>
                  <th>공정</th>
                  <th>배정 작업자</th>
                  <th>근거</th>
                  <th className="mesWoAssignConfirmThNum">효율</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.processId}>
                    <td>
                      <div className="mesWoAssignConfirmProc">
                        <span className="mono mesWoAssignConfirmCode">{a.processCode}</span>
                        <span className="mesWoAssignConfirmProcName">{a.processName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="mono">{a.workerCode}</span> {a.workerName}
                    </td>
                    <td>
                      <span
                        className={`mesWoAssignConfirmSrc mesWoAssignConfirmSrc--${a.dataSource}`}
                      >
                        {a.dataSource === 'history' ? '실적' : '표준'}
                      </span>
                    </td>
                    <td className="mesWoAssignConfirmTdNum">
                      {a.efficiencyPct != null ? `${a.efficiencyPct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className={isOps ? 'mesOpsPlanModalFoot' : 'mesModalFoot mesWoGroupOptFoot'}>
          <button
            type="button"
            className={isOps ? 'mesOpsPlanModalBtn mesOpsPlanModalBtn--cancel' : 'mesBtnSecondary'}
            disabled={applying}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className={isOps ? 'mesOpsPlanModalBtn mesOpsPlanModalBtn--save' : 'mesBtnPrimary'}
            disabled={applying}
            onClick={onApply}
          >
            {applying ? '적용 중…' : '이 배정 적용'}
          </button>
        </footer>
      </div>
    </div>
  )
}
