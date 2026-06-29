import { useMemo } from 'react'
import {
  calcFormTotals,
  fmtWon,
  type PayStubFormDraft,
  type PayStubLine,
  type UserOption,
} from './payStubTypes'

type Props = {
  form: PayStubFormDraft
  users: UserOption[]
  editMode: boolean
  saving: boolean
  onChange: (patch: Partial<PayStubFormDraft>) => void
  onUpdateLines: (type: 'EARNING' | 'DEDUCTION', lines: PayStubLine[]) => void
  onSave: () => void
  onClose: () => void
}

function LineEditor({
  title,
  lines,
  onChange,
}: {
  title: string
  lines: PayStubLine[]
  onChange: (lines: PayStubLine[]) => void
}) {
  const updateRow = (idx: number, patch: Partial<PayStubLine>) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const addRow = () => {
    onChange([...lines, { lineType: lines[0]?.lineType ?? 'EARNING', label: '', amount: 0 }])
  }

  const removeRow = (idx: number) => {
    if (lines.length <= 1) return
    onChange(lines.filter((_, i) => i !== idx))
  }

  return (
    <fieldset className="mesPsLineFieldset">
      <legend>{title}</legend>
      <div className="mesPsLineTableWrap">
        <table className="mesPsEditLineTable">
          <thead>
            <tr>
              <th>항목</th>
              <th>금액</th>
              <th aria-label="행 삭제" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    className="mesPsFieldInput"
                    value={line.label}
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    placeholder="항목명"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="mesPsFieldInput mesPsFieldInput--amount"
                    min={0}
                    step={1}
                    value={line.amount || ''}
                    onChange={(e) => updateRow(i, { amount: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <button type="button" className="mesPsLineRemoveBtn" onClick={() => removeRow(i)} aria-label="삭제">
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="mesPsLineAddBtn" onClick={addRow}>+ 항목 추가</button>
    </fieldset>
  )
}

export function PayStubEditModal({
  form,
  users,
  editMode,
  saving,
  onChange,
  onUpdateLines,
  onSave,
  onClose,
}: Props) {
  const totals = useMemo(
    () => calcFormTotals(form.earnings, form.deductions),
    [form.earnings, form.deductions],
  )

  const onUserPick = (userId: number) => {
    const u = users.find((x) => x.id === userId)
    onChange({
      userId,
      dept: u?.dept ?? '',
      position: u?.position ?? '',
    })
  }

  return (
    <div className="mesPsModalRoot" role="presentation">
      <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={onClose} />
      <div className="mesPsEditDialog" role="dialog" aria-modal="true" aria-labelledby="mes-ps-edit-title">
        <header className="mesPsEditHead">
          <h2 id="mes-ps-edit-title">{editMode ? '급여명세 수정' : '급여명세 등록'}</h2>
          <button type="button" className="mesPsDocCloseBtn" onClick={onClose}>닫기</button>
        </header>

        <div className="mesPsEditBody">
          {!editMode ? (
            <label className="mesPsFormRow">
              <span>직원</span>
              <select
                className="mesPsFieldSelect"
                value={form.userId ?? ''}
                onChange={(e) => onUserPick(Number(e.target.value))}
              >
                <option value="">선택</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.userName}{u.dept ? ` · ${u.dept}` : ''}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="mesPsFormGrid">
            <label className="mesPsFormRow">
              <span>부서</span>
              <input
                type="text"
                className="mesPsFieldInput"
                value={form.dept}
                onChange={(e) => onChange({ dept: e.target.value })}
              />
            </label>
            <label className="mesPsFormRow">
              <span>직위</span>
              <input
                type="text"
                className="mesPsFieldInput"
                value={form.position}
                onChange={(e) => onChange({ position: e.target.value })}
              />
            </label>
            <label className="mesPsFormRow">
              <span>근무일수</span>
              <input
                type="number"
                className="mesPsFieldInput"
                min={0}
                max={31}
                step={0.5}
                value={form.workDays}
                onChange={(e) => onChange({ workDays: e.target.value })}
              />
            </label>
          </div>

          <LineEditor
            title="지급"
            lines={form.earnings}
            onChange={(lines) => onUpdateLines('EARNING', lines)}
          />
          <LineEditor
            title="공제"
            lines={form.deductions}
            onChange={(lines) => onUpdateLines('DEDUCTION', lines)}
          />

          <div className="mesPsTotalsBar">
            <span>지급계 {fmtWon(totals.totalEarning)}</span>
            <span>공제계 {fmtWon(totals.totalDeduction)}</span>
            <strong>실지급 {fmtWon(totals.netPay)}</strong>
          </div>

          <label className="mesPsFormRow mesPsFormRow--full">
            <span>비고</span>
            <textarea
              className="mesPsFieldTextarea"
              rows={2}
              value={form.remark}
              onChange={(e) => onChange({ remark: e.target.value })}
            />
          </label>
        </div>

        <footer className="mesPsEditFoot">
          <button type="button" className="mesPsSecondaryBtn" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="mesPsPrimaryBtn" onClick={onSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  )
}
