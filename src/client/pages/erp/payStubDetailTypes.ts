export type PayStubDetailEarning = {
  label: string
  paymentType: string
  paymentTypeLabel: string
  workRecord: number | null
  unitAmount: number | null
  multiplier: number | null
  amount: number
  calcDescription: string
}

export type PayStubDetailDeduction = {
  label: string
  amount: number
  calcDescription: string
}

export type PayStubDetail = {
  userId: number
  userName: string
  dept: string
  position: string
  yearMonth: string
  yearMonthLabel: string
  payDate: string | null
  payDateLabel: string
  ordinaryHourlyRate: number
  hourlyRateFormula: string
  overtimeNote: string
  dependants: number
  workDays: number | null
  earnings: PayStubDetailEarning[]
  deductions: PayStubDetailDeduction[]
  totalEarning: number
  totalDeduction: number
  netPay: number
  taxableIncome: number
  insuranceBase: number
}

export type LedgerRow = {
  no: number
  userName: string
  position: string
  residentId: string
  baseSalary: number
  positionAllowance: number
  overtimeHoliday: number
  bonus: number
  insuranceBase: number
  mealAllowance: number
  carAllowance: number
  dependants: number
  totalDeduction: number
  yearEndTax: number
  incomeTax: number
  localTax: number
  pension: number
  longTermCare: number
  health: number
  employment: number
  netPay: number
}

export type PayrollLedger = {
  companyName: string
  yearMonth: string
  yearMonthLabel: string
  payDateLabel: string
  rows: LedgerRow[]
}

export function fmtNum(n: number) {
  return n.toLocaleString('ko-KR')
}

export function fmtWorkRecord(v: number | null, paymentType: string) {
  if (v == null || v === 0) return ''
  if (paymentType === 'VARIABLE_DAY') return `${v}일`
  if (paymentType === 'VARIABLE_TIME') return `${v}시간`
  return String(v)
}
