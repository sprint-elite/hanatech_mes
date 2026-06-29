export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type LeaveDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NA'

export type LeaveRow = {
  id: number
  userId: number
  userName: string
  dept: string
  position: string
  startDate: string
  endDate: string
  days: number | null
  leaveType: string
  reason: string
  emergencyContact: string | null
  status: LeaveStatus
  managerDecision: LeaveDecision
  ceoDecision: LeaveDecision
  managerByName: string | null
  ceoByName: string | null
  rejectReason: string | null
  createdAt: string
}

export type Balance = {
  year: number
  totalDays: number
  usedDays: number
  remainingDays: number
}

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: '신청',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
}

export function canApprove(roleName: string) {
  return roleName === '실장' || roleName === '대표' || roleName === '최고관리자'
}

export function isManagerRole(roleName: string) {
  return roleName === '실장'
}

export function isCeoRole(roleName: string) {
  return roleName === '대표' || roleName === '최고관리자'
}

export function fmtYmd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function fmtKrDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

export function fmtPeriodShort(start: string, end: string) {
  return `${start.replace(/-/g, '.')}\n~ ${end.replace(/-/g, '.')}`
}

export function buildCalendarCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const pad = first.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function calcDays(start: string, end: string) {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return ''
  return String(Math.floor((e.getTime() - s.getTime()) / 86400000) + 1)
}

export function decisionMark(d: LeaveDecision) {
  if (d === 'APPROVED') return 'Y'
  if (d === 'REJECTED') return 'N'
  return '—'
}

export function canCancelOwnApproval(roleName: string, row: LeaveRow) {
  if (!canApprove(roleName)) return false
  if (row.status === 'CANCELLED' || row.status === 'REJECTED') return false
  if (isManagerRole(roleName)) return row.managerDecision === 'APPROVED'
  if (isCeoRole(roleName)) return row.ceoDecision === 'APPROVED'
  return false
}

export function canCancelOwnRejection(roleName: string, row: LeaveRow) {
  if (!canApprove(roleName)) return false
  if (row.status !== 'REJECTED') return false
  if (isManagerRole(roleName)) return row.managerDecision === 'REJECTED'
  if (isCeoRole(roleName)) return row.ceoDecision === 'REJECTED'
  return false
}
