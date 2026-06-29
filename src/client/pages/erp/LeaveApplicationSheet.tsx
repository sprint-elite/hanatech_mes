import type { LeaveDecision, LeaveRow } from './annualLeaveTypes'
import { fmtKrDate } from './annualLeaveTypes'

export type LeaveFormDraft = {
  startDate: string
  endDate: string
  days: string
  leaveType: string
  reason: string
  emergencyContact: string
}

export type ApplicantInfo = {
  userName: string
  dept: string
  position: string
}

type ViewProps = {
  mode: 'view'
  row: LeaveRow
}

type EditProps = {
  mode: 'edit'
  applicant: ApplicantInfo
  form: LeaveFormDraft
  onChange: (patch: Partial<LeaveFormDraft>) => void
  appliedDate?: string
}

export type LeaveApplicationSheetProps = ViewProps | EditProps

function approvalSign(name: string | null, decision: LeaveDecision, fallback?: string) {
  if (decision === 'APPROVED' && name) {
    return <span className="mesAlDocSignName">{name}</span>
  }
  if (decision === 'REJECTED') {
    return <span className="mesAlDocSignReject">반려</span>
  }
  if (fallback) {
    return <span className="mesAlDocSignName">{fallback}</span>
  }
  return null
}

function displayDept(v: string) {
  return v === '—' || !v ? '' : v
}

export function LeaveApplicationSheet(props: LeaveApplicationSheetProps) {
  const isEdit = props.mode === 'edit'

  const userName = isEdit ? props.applicant.userName : props.row.userName
  const dept = isEdit ? props.applicant.dept : props.row.dept
  const position = isEdit ? props.applicant.position : props.row.position
  const emergencyContact = isEdit ? props.form.emergencyContact : (props.row.emergencyContact ?? '')
  const leaveType = isEdit ? props.form.leaveType : props.row.leaveType
  const startDate = isEdit ? props.form.startDate : props.row.startDate
  const endDate = isEdit ? props.form.endDate : props.row.endDate
  const days = isEdit ? props.form.days : String(props.row.days ?? '')
  const reason = isEdit ? props.form.reason : props.row.reason

  const applied = isEdit
    ? (props.appliedDate ?? fmtKrDate(new Date().toISOString().slice(0, 10)))
    : fmtKrDate(props.row.createdAt.slice(0, 10))

  const periodText =
    startDate && endDate
      ? `${fmtKrDate(startDate)} ~ ${fmtKrDate(endDate)}${days ? ` (${days}일간)` : ''}`
      : ''

  return (
    <article className="mesAlDocSheet" aria-label="연차신청서 A4 양식">
      <table className="mesAlDocHeaderTable" aria-label="연차신청서 헤더">
        <colgroup>
          <col className="mesAlDocHeaderTable__titleCol" />
          <col className="mesAlDocHeaderTable__labelCol" />
          <col className="mesAlDocHeaderTable__signCol" />
          <col className="mesAlDocHeaderTable__signCol" />
          <col className="mesAlDocHeaderTable__signCol" />
        </colgroup>
        <tbody>
          <tr>
            <td rowSpan={2} className="mesAlDocTitleCell">
              <h1 className="mesAlDocFormTitle">연차신청서</h1>
            </td>
            <td rowSpan={2} className="mesAlDocApprovalLabel">결재</td>
            <th scope="col">신청자</th>
            <th scope="col">실장</th>
            <th scope="col">대표</th>
          </tr>
          <tr>
            <td className="mesAlDocSignCell">
              {isEdit
                ? approvalSign(userName, 'APPROVED', userName)
                : approvalSign(props.row.userName, 'APPROVED', props.row.userName)}
            </td>
            <td className="mesAlDocSignCell">
              {isEdit ? null : approvalSign(props.row.managerByName, props.row.managerDecision)}
            </td>
            <td className="mesAlDocSignCell">
              {isEdit ? null : approvalSign(props.row.ceoByName, props.row.ceoDecision)}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mesAlDocFormTable">
        <tbody>
          <tr>
            <th scope="row">부　　서</th>
            <td>{displayDept(dept)}</td>
            <th scope="row">직　　급</th>
            <td>{displayDept(position)}</td>
          </tr>
          <tr>
            <th scope="row">성　　명</th>
            <td>{userName}</td>
            <th scope="row">비상연락망</th>
            <td>
              {isEdit ? (
                <input
                  type="tel"
                  className="mesAlDocFieldInput"
                  value={props.form.emergencyContact}
                  onChange={(e) => props.onChange({ emergencyContact: e.target.value })}
                  placeholder="010-0000-0000"
                />
              ) : (
                emergencyContact
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">유　　형</th>
            <td colSpan={3}>
              {isEdit ? (
                <select
                  className="mesAlDocFieldInput mesAlDocFieldInput--select"
                  value={props.form.leaveType}
                  onChange={(e) => props.onChange({ leaveType: e.target.value })}
                >
                  <option value="연차">연차</option>
                  <option value="반차">반차</option>
                  <option value="반반차">반반차</option>
                  <option value="경조">경조</option>
                </select>
              ) : (
                leaveType
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">기　　간</th>
            <td colSpan={3}>
              {isEdit ? (
                <div className="mesAlDocPeriodEdit">
                  <input
                    type="date"
                    className="mesAlDocFieldInput mesAlDocFieldInput--date"
                    value={props.form.startDate}
                    onChange={(e) => props.onChange({ startDate: e.target.value })}
                  />
                  <span className="mesAlDocPeriodSep">~</span>
                  <input
                    type="date"
                    className="mesAlDocFieldInput mesAlDocFieldInput--date"
                    value={props.form.endDate}
                    onChange={(e) => props.onChange({ endDate: e.target.value })}
                  />
                  <span className="mesAlDocPeriodSep">(</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    className="mesAlDocFieldInput mesAlDocFieldInput--days"
                    value={props.form.days}
                    onChange={(e) => props.onChange({ days: e.target.value })}
                  />
                  <span className="mesAlDocPeriodSep">일간)</span>
                </div>
              ) : (
                periodText
              )}
            </td>
          </tr>
          <tr className="mesAlDocFormTable__detail">
            <th scope="row">세부 사항</th>
            <td colSpan={3} className="mesAlDocDetailCell">
              {isEdit ? (
                <textarea
                  className="mesAlDocFieldInput mesAlDocFieldInput--textarea"
                  rows={5}
                  value={props.form.reason}
                  onChange={(e) => props.onChange({ reason: e.target.value })}
                  placeholder="개인: 여름휴가"
                />
              ) : (
                reason
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {!isEdit && props.row.status === 'REJECTED' ? (
        <div className="mesAlDocRejectBox" role="note">
          <strong>반려 사유</strong>
          <p>{props.row.rejectReason?.trim() || '사유 없음'}</p>
        </div>
      ) : null}

      <div className="mesAlDocFooterBlock">
        <p className="mesAlDocClosing">위와 같이 휴가를 신청하오니 허락하여 주시기 바랍니다.</p>
        <p className="mesAlDocDateLine">{applied}</p>
        <p className="mesAlDocApplicantLine">
          신청자&nbsp;&nbsp;:&nbsp;&nbsp;{userName}
          <span className="mesAlDocApplicantSignWrap">
            <span className="mesAlDocApplicantSign">{userName}</span>
            <span className="mesAlDocApplicantSeal" aria-hidden>(인)</span>
          </span>
        </p>
        <div className="mesAlDocWatermark" aria-hidden>HANA-TECH</div>
      </div>

      <aside className="mesAlDocNotes">
        <strong>[유의사항]</strong>
        <ol>
          <li>휴가(연차·반차 등)는 사전에 신청·승인을 받은 후 사용하시기 바랍니다. (병가 등 부득이한 경우 제외)</li>
          <li>유형: 해당 항목에 표시합니다. (1년 미만 근로자의 월차는 별도 관리)</li>
          <li>결재: 본인 서명 및 부서장 확인 후 인사 담당자에게 제출합니다.</li>
        </ol>
      </aside>
    </article>
  )
}
