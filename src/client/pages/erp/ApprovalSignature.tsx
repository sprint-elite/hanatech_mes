import type { LeaveDecision } from './annualLeaveTypes'

type ApprovalSignProps = {
  name: string | null
  signatureUrl: string | null
  decision: LeaveDecision
  /** 신청자 등 승인 전에도 서명을 보여줄 때 */
  showWhenPending?: boolean
}

export function ApprovalSignature({ name, signatureUrl, decision, showWhenPending }: ApprovalSignProps) {
  if (decision === 'REJECTED') {
    return <span className="mesApprovalSignReject">반려</span>
  }

  const show = decision === 'APPROVED' || showWhenPending
  if (!show) return null

  if (signatureUrl) {
    return <img src={signatureUrl} alt="" className="mesApprovalSignImg" />
  }

  if (name) {
    return <span className="mesApprovalSignName">{name}</span>
  }

  return null
}
