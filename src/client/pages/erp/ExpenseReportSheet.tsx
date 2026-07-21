import {
  calcTotal,
  fmtKrDate,
  type ExpenseFormDraft,
  type ExpenseLine,
  type ExpenseRow,
} from './expenseReportTypes'
import type { LeaveDecision } from './annualLeaveTypes'

export type ApplicantInfo = {
  userName: string
  dept: string
  position: string
}

type ViewProps = { mode: 'view'; row: ExpenseRow }
type EditProps = {
  mode: 'edit'
  applicant: ApplicantInfo
  form: ExpenseFormDraft
  lineSlots: number
  onChange: (patch: Partial<ExpenseFormDraft>) => void
  onLineChange: (index: number, patch: Partial<ExpenseLine>) => void
  onReceiptPick: (file: File | null) => void
}

export type ExpenseReportSheetProps = ViewProps | EditProps

function approvalSign(name: string | null, decision: LeaveDecision) {
  if (decision === 'APPROVED' && name) return <span className="mesErInk">{name}</span>
  if (decision === 'REJECTED') return <span className="mesErRejectMark">반려</span>
  return null
}

const BASE_ROWS = 20

function fillRows(lines: ExpenseLine[], count: number): ExpenseLine[] {
  const out = [...lines]
  while (out.length < count) out.push({ vendor: '', description: '', amount: 0 })
  return out.slice(0, count)
}

function fmtAmt(n: number) {
  if (!n || n <= 0) return ''
  return `₩ ${n.toLocaleString('ko-KR')}`
}

/**
 * 레퍼런스 1번 이미지 그대로:
 *
 *  날짜 | 일자        | 담당자 | 대표님
 *  이름 | 성명        |       |
 *  총 지출 금액 (2열) | (서명) | (서명)  ← 서명란 rowspan 이름~총액
 *  19,700     (2열)   |       |
 *  영수증 50% | 사용처 | 사용내역 | 금액
 */
export function ExpenseReportSheet(props: ExpenseReportSheetProps) {
  const isEdit = props.mode === 'edit'
  const userName = isEdit ? props.applicant.userName : props.row.userName
  const reportDate = isEdit ? props.form.reportDate : props.row.reportDate
  const sourceLines = isEdit ? props.form.lines : props.row.lines
  const total = isEdit ? calcTotal(props.form.lines) : props.row.totalAmount
  const receiptUrl = isEdit ? props.form.receiptDataUrl : props.row.receiptDataUrl
  const slotCount = isEdit ? Math.max(props.lineSlots, BASE_ROWS) : Math.max(sourceLines.length, BASE_ROWS)
  const rows = fillRows(sourceLines, slotCount)

  return (
    <article className="mesErPaper" aria-label="지출결의서">
      <table className="mesErHead">
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '60%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th className="mesErHead__lab">날짜</th>
            <td className="mesErHead__val">
              {isEdit ? (
                <label className="mesErDateWrap">
                  <span className="mesErDateText">{fmtKrDate(props.form.reportDate)}</span>
                  <input
                    type="date"
                    className="mesErDateNative"
                    value={props.form.reportDate}
                    onChange={(e) => props.onChange({ reportDate: e.target.value })}
                  />
                </label>
              ) : (
                fmtKrDate(reportDate)
              )}
            </td>
            <th className="mesErHead__signH">담당자</th>
            <th className="mesErHead__signH">대표님</th>
          </tr>
          <tr>
            <th className="mesErHead__lab">이름</th>
            <td className="mesErHead__val mesErHead__name">{userName}</td>
            <td rowSpan={3} className="mesErHead__sign">
              {isEdit ? null : approvalSign(props.row.managerByName, props.row.managerDecision)}
            </td>
            <td rowSpan={3} className="mesErHead__sign">
              {isEdit ? null : approvalSign(props.row.ceoByName, props.row.ceoDecision)}
            </td>
          </tr>
          <tr>
            <th colSpan={2} className="mesErHead__totalLab">
              총 지출 금액
            </th>
          </tr>
          <tr>
            <td colSpan={2} className="mesErHead__totalNum">
              {total.toLocaleString('ko-KR')}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mesErBody">
        <colgroup>
          <col style={{ width: '50%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td rowSpan={slotCount + 1} className="mesErBody__receipt">
              <div className="mesErBody__receiptInner">
                <span className="mesErBody__receiptTitle">영수증첨부</span>
                {receiptUrl ? <img src={receiptUrl} alt="" className="mesErBody__receiptImg" /> : null}
                {isEdit ? (
                  <div className="mesErBody__receiptActs mesAlNoPrint">
                    <label className="mesErBody__attach">
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => props.onReceiptPick(e.target.files?.[0] ?? null)}
                      />
                      {receiptUrl ? '변경' : '첨부'}
                    </label>
                    {receiptUrl ? (
                      <button
                        type="button"
                        className="mesErBody__attachDel"
                        onClick={() => props.onChange({ receiptDataUrl: null })}
                      >
                        제거
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </td>
            <th>사용처</th>
            <th>사용내역</th>
            <th>금액</th>
          </tr>
          {rows.map((line, idx) => (
            <tr key={idx} className="mesErBody__line">
              <td>
                {isEdit ? (
                  <input
                    className="mesErIn"
                    value={line.vendor}
                    onChange={(e) => props.onLineChange(idx, { vendor: e.target.value })}
                  />
                ) : (
                  line.vendor || '\u00a0'
                )}
              </td>
              <td>
                {isEdit ? (
                  <input
                    className="mesErIn"
                    value={line.description}
                    onChange={(e) => props.onLineChange(idx, { description: e.target.value })}
                  />
                ) : (
                  line.description || '\u00a0'
                )}
              </td>
              <td className="mesErBody__amt">
                {isEdit ? (
                  <input
                    type="number"
                    min={0}
                    className="mesErIn mesErIn--amt"
                    value={line.amount > 0 ? line.amount : ''}
                    onChange={(e) => props.onLineChange(idx, { amount: Number(e.target.value) || 0 })}
                  />
                ) : (
                  fmtAmt(line.amount) || '\u00a0'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!isEdit && props.row.status === 'REJECTED' && props.row.rejectReason ? (
        <div className="mesErRejectBox">
          <strong>반려 사유</strong>
          <p>{props.row.rejectReason}</p>
        </div>
      ) : null}
    </article>
  )
}
