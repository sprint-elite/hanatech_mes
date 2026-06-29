export type PayStubRunStatus = 'DRAFT' | 'PUBLISHED'
export type PayStubLineType = 'EARNING' | 'DEDUCTION'

export type PayStubLine = {
  id?: number
  lineType: PayStubLineType
  label: string
  amount: number
  sortOrder?: number
}

export type PayStubRunRow = {
  id: number
  yearMonth: string
  title: string | null
  payDate: string | null
  status: PayStubRunStatus
  publishedAt: string | null
  stubCount: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

export type PayStubRow = {
  id: number
  runId: number
  userId: number
  userName: string
  dept: string
  position: string
  hireDate: string | null
  workDays: number | null
  totalEarning: number
  totalDeduction: number
  netPay: number
  remark: string | null
  earnings: PayStubLine[]
  deductions: PayStubLine[]
  createdAt: string
  updatedAt: string
  run?: {
    id: number
    yearMonth: string
    title: string | null
    payDate: string | null
    status: PayStubRunStatus
    publishedAt: string | null
  }
}

export type UserOption = {
  id: number
  userName: string
  dept: string
  position: string
  hireDate: string | null
}

export type PayStubFormDraft = {
  userId: number | null
  dept: string
  position: string
  workDays: string
  remark: string
  earnings: PayStubLine[]
  deductions: PayStubLine[]
}

export const RUN_STATUS_LABEL: Record<PayStubRunStatus, string> = {
  DRAFT: '작성중',
  PUBLISHED: '발행',
}

export const DEFAULT_EARNINGS: PayStubLine[] = [
  { lineType: 'EARNING', label: '기본급', amount: 0 },
  { lineType: 'EARNING', label: '연장수당', amount: 0 },
  { lineType: 'EARNING', label: '기타수당', amount: 0 },
]

export const DEFAULT_DEDUCTIONS: PayStubLine[] = [
  { lineType: 'DEDUCTION', label: '국민연금', amount: 0 },
  { lineType: 'DEDUCTION', label: '건강보험', amount: 0 },
  { lineType: 'DEDUCTION', label: '고용보험', amount: 0 },
  { lineType: 'DEDUCTION', label: '소득세', amount: 0 },
  { lineType: 'DEDUCTION', label: '지방소득세', amount: 0 },
]

export function fmtYearMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}년 ${Number(m)}월`
}

export function fmtKrDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

export function fmtWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

export function calcFormTotals(earnings: PayStubLine[], deductions: PayStubLine[]) {
  const totalEarning = earnings.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const totalDeduction = deductions.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  return { totalEarning, totalDeduction, netPay: totalEarning - totalDeduction }
}

export function emptyForm(): PayStubFormDraft {
  return {
    userId: null,
    dept: '',
    position: '',
    workDays: '',
    remark: '',
    earnings: DEFAULT_EARNINGS.map((l) => ({ ...l })),
    deductions: DEFAULT_DEDUCTIONS.map((l) => ({ ...l })),
  }
}

export function formFromRow(row: PayStubRow): PayStubFormDraft {
  return {
    userId: row.userId,
    dept: row.dept === '—' ? '' : row.dept,
    position: row.position === '—' ? '' : row.position,
    workDays: row.workDays != null ? String(row.workDays) : '',
    remark: row.remark ?? '',
    earnings: row.earnings.length
      ? row.earnings.map((l) => ({ ...l, lineType: 'EARNING' as const }))
      : DEFAULT_EARNINGS.map((l) => ({ ...l })),
    deductions: row.deductions.length
      ? row.deductions.map((l) => ({ ...l, lineType: 'DEDUCTION' as const }))
      : DEFAULT_DEDUCTIONS.map((l) => ({ ...l })),
  }
}

export function canManagePayStubs(roleName: string) {
  return ['실장', '대표', '최고관리자'].includes(roleName)
}
