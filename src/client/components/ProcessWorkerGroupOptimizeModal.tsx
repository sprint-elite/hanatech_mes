import { useEffect, useMemo, useState } from 'react'
import {
  defaultMergeWithNext,
  formatGroupsPreview,
  mergeFlagsToProcessGroups,
  type ProcessGroupProc,
} from '../lib/processWorkerGroups'

type Props = {
  open: boolean
  variant: 'ops' | 'wo'
  processes: ProcessGroupProc[]
  orderQty: number
  saving: boolean
  onClose: () => void
  onSubmit: (processGroups: number[][]) => void
}

function processGroupIndex(processIndex: number, flags: boolean[]): number {
  let g = 0
  const idx: number[] = []
  for (let i = 0; i <= processIndex; i++) {
    idx.push(g)
    if (!(i < flags.length && flags[i])) g++
  }
  return idx[processIndex] ?? 0
}

export function ProcessWorkerGroupOptimizeModal({
  open,
  variant,
  processes,
  orderQty,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const ordered = useMemo(
    () => [...processes].sort((a, b) => a.sequence - b.sequence || a.id - b.id),
    [processes],
  )

  const [mergeWithNext, setMergeWithNext] = useState<boolean[]>(() => defaultMergeWithNext(ordered.length))

  useEffect(() => {
    if (open) setMergeWithNext(defaultMergeWithNext(ordered.length))
  }, [open, ordered.length])

  const syncLen = ordered.length
  const flags =
    mergeWithNext.length === Math.max(0, syncLen - 1) ? mergeWithNext : defaultMergeWithNext(syncLen)

  const { groups, groupPreview } = useMemo(() => {
    const orderedIds = ordered.map((p) => p.id)
    const g = mergeFlagsToProcessGroups(orderedIds, flags)
    return {
      groups: g,
      groupPreview: formatGroupsPreview(ordered, g),
    }
  }, [ordered, flags])

  if (!open) return null

  const isOps = variant === 'ops'

  const setFlags = (next: boolean[]) => setMergeWithNext(next)

  const presetKey =
    flags.length === 4 && flags[0] && !flags[1] && !flags[2] && flags[3] ? '52' : flags.every((f) => !f) ? 'each' : 'custom'

  const applyPreset = (key: 'each' | '52') => {
    if (key === 'each') setFlags(Array(Math.max(0, syncLen - 1)).fill(false))
    else if (syncLen === 5) setFlags(defaultMergeWithNext(5))
  }

  const toggleBoundary = (flagIndex: number) => {
    const next = [...flags]
    next[flagIndex] = !next[flagIndex]
    setFlags(next)
  }

  const rootClass = isOps ? 'mesOpsPlanModalRoot mesModalRootNested' : 'mesModalRoot mesModalRootNested'
  const dialogClass = isOps
    ? 'mesOpsPlanModalDialog mesOpsPlanModalDialog--wide mesWoGroupOptDialog'
    : 'mesModalDialog mesModalDialogWide mesWoGroupOptDialog'

  return (
    <div className={rootClass} role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => !saving && onClose()} />
      <div className={dialogClass} role="dialog" aria-modal="true" aria-labelledby="mes-process-group-opt-title">
        {isOps ? (
          <header className="mesOpsPlanModalHead">
            <div className="mesOpsPlanModalHeadTitle">
              <div>
                <h2 className="mesOpsPlanModalTitle" id="mes-process-group-opt-title">
                  작업자 묶음 설정
                </h2>
                <p className="mesOpsPlanModalSub">공정 사이에서 묶기·분리하면 필요 작업자 수가 바뀝니다.</p>
              </div>
            </div>
          </header>
        ) : (
          <div className="mesModalHead">
            <div>
              <h2 className="mesModalTitle" id="mes-process-group-opt-title">
                작업자 묶음 설정
              </h2>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                공정 사이에서 묶기·분리합니다.
              </p>
            </div>
          </div>
        )}

        <div className={`mesWoGroupOptBody ${isOps ? 'mesOpsPlanModalBody' : 'mesModalBody'}`}>
          <div className="mesOpsPlanModalStrip mesWoGroupOptStrip">
            <div className="mesOpsPlanModalStripItem">
              <span className="mesOpsPlanModalStripLabel">지시 수량</span>
              <span className="mesOpsPlanModalStripVal">{orderQty.toLocaleString()}개</span>
            </div>
            <div className="mesOpsPlanModalStripItem">
              <span className="mesOpsPlanModalStripLabel">필요 작업자</span>
              <span className="mesOpsPlanModalStripVal">{groups.length}명</span>
            </div>
            <div className="mesOpsPlanModalStripItem">
              <span className="mesOpsPlanModalStripLabel">묶음</span>
              <span className="mesOpsPlanModalStripVal mesWoGroupOptStripPreview">{groupPreview}</span>
            </div>
          </div>

          <div className="mesWoGroupOptToolbar">
            <div className="mesWoGroupOptSegment" role="group" aria-label="묶음 프리셋">
              <button
                type="button"
                className={`mesWoGroupOptSegmentBtn${presetKey === 'each' ? ' mesWoGroupOptSegmentBtn--on' : ''}`}
                disabled={saving}
                onClick={() => applyPreset('each')}
              >
                공정마다 1명
              </button>
              {syncLen === 5 ? (
                <button
                  type="button"
                  className={`mesWoGroupOptSegmentBtn${presetKey === '52' ? ' mesWoGroupOptSegmentBtn--on' : ''}`}
                  disabled={saving}
                  onClick={() => applyPreset('52')}
                >
                  1·2 / 3 / 4·5
                </button>
              ) : null}
            </div>
          </div>

          <div className="mesWoGroupOptFlow" aria-label="공정 순서">
            {ordered.map((proc, i) => {
              const tone = processGroupIndex(i, flags) % 6
              const mergedWithNext = i < flags.length && flags[i]
              const showJoin = i < ordered.length - 1
              return (
                <div key={proc.id} className="mesWoGroupOptFlowBlock">
                  <div className="mesWoGroupOptStep" data-tone={tone}>
                    <span className="mesWoGroupOptStepBadge">묶음 {processGroupIndex(i, flags) + 1}</span>
                    <div className="mesWoGroupOptStepBody">
                      <span className="mesWoGroupOptStepSeq mono">{proc.sequence}</span>
                      <div className="mesWoGroupOptStepText">
                        <span className="mesWoGroupOptStepCode mono">{proc.processCode}</span>
                        <span className="mesWoGroupOptStepName">{proc.processName}</span>
                      </div>
                    </div>
                  </div>
                  {showJoin ? (
                    <button
                      type="button"
                      className={`mesWoGroupOptJoin${mergedWithNext ? ' mesWoGroupOptJoin--on' : ''}`}
                      disabled={saving}
                      aria-pressed={mergedWithNext}
                      onClick={() => toggleBoundary(i)}
                    >
                      <span className="mesWoGroupOptJoinRail" aria-hidden />
                      <span className="mesWoGroupOptJoinLabel">
                        {mergedWithNext ? '같은 작업자 · 눌러서 분리' : '아래 공정과 같은 작업자로 묶기'}
                      </span>
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <footer className={isOps ? 'mesOpsPlanModalFoot' : 'mesModalFoot mesWoGroupOptFoot'}>
          <button
            type="button"
            className={isOps ? 'mesOpsPlanModalBtn mesOpsPlanModalBtn--cancel' : 'mesBtnSecondary'}
            disabled={saving}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className={isOps ? 'mesOpsPlanModalBtn mesOpsPlanModalBtn--save' : 'mesBtnPrimary'}
            disabled={saving || groups.length === 0}
            onClick={() => onSubmit(groups)}
          >
            {saving ? '계산 중…' : '최단 완료 배정 계산'}
          </button>
        </footer>
      </div>
    </div>
  )
}
