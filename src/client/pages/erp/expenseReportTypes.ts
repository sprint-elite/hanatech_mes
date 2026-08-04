import type { LeaveDecision } from './annualLeaveTypes'
import {
  canApprove,
  isCeoRole,
  isManagerRole,
} from './annualLeaveTypes'

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type ExpenseLine = {
  id?: number
  vendor: string
  description: string
  amount: number
}

export type ExpenseRow = {
  id: number
  userId: number
  userName: string
  userSignatureUrl: string | null
  dept: string
  position: string
  reportDate: string
  totalAmount: number
  receiptDataUrl: string | null
  status: ExpenseStatus
  managerDecision: LeaveDecision
  ceoDecision: LeaveDecision
  managerByName: string | null
  managerSignatureUrl: string | null
  ceoByName: string | null
  ceoSignatureUrl: string | null
  rejectReason: string | null
  createdAt: string
  lines: ExpenseLine[]
}

export type ExpenseFormDraft = {
  reportDate: string
  lines: ExpenseLine[]
  receiptDataUrl: string | null
}

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  PENDING: '보류',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
}

export function emptyLine(): ExpenseLine {
  return { vendor: '', description: '', amount: 0 }
}

export function emptyForm(reportDate: string): ExpenseFormDraft {
  return {
    reportDate,
    lines: [emptyLine()],
    receiptDataUrl: null,
  }
}

export function calcTotal(lines: ExpenseLine[]): number {
  return lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0)
}

export function fmtKrDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

export function fmtWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

export { canApprove, isCeoRole, isManagerRole }

export function canCancelExpenseApproval(roleName: string, row: ExpenseRow) {
  if (!canApprove(roleName)) return false
  if (row.status === 'CANCELLED' || row.status === 'REJECTED') return false
  if (isManagerRole(roleName)) return row.managerDecision === 'APPROVED'
  if (isCeoRole(roleName)) return row.ceoDecision === 'APPROVED'
  return false
}

export function canCancelExpenseRejection(roleName: string, row: ExpenseRow) {
  if (!canApprove(roleName)) return false
  if (row.status !== 'REJECTED') return false
  if (isManagerRole(roleName)) return row.managerDecision === 'REJECTED'
  if (isCeoRole(roleName)) return row.ceoDecision === 'REJECTED'
  return false
}
