export type PayEmployeeStatus = 'ACTIVE' | 'INACTIVE'

export type EmployeeProfileRow = {
  id: number
  userId: number
  loginId: string
  userName: string
  workerCode: string | null
  employeeNo: string | null
  dept: string
  position: string
  hireDate: string | null
  baseSalary: number
  hourlyWage: number | null
  ordinaryWage: number | null
  pensionBaseSalary: number | null
  paymentDay: number | null
  bankName: string | null
  bankAccount: string | null
  accountHolder: string | null
  dependants: number
  children8to20: number
  withholdingRatePct: number
  status: PayEmployeeStatus
  remark: string | null
  createdAt: string
  updatedAt: string
}

export type WorkRecordLineRow = {
  id: number
  workDate: string
  userId: number
  loginId: string
  userName: string
  dept: string
  position: string
  allowanceItemId: number
  itemCode: string
  itemName: string
  paymentType: string
  unitLabel: string
  multiplier: number | null
  quantity: number
  yearMonth: string
  sortOrder: number
}

export type WorkRecordEmployeeOption = {
  id: number
  loginId: string
  userName: string
  dept: string
  position: string
}

export type WorkRecordAllowanceOption = {
  id: number
  itemCode: string
  itemName: string
  paymentType: string
  unitLabel: string
  multiplier: number | null
}

export type WorkRecordDraft = {
  key: string
  id?: number
  workDate: string
  userId: number | null
  allowanceItemId: number | null
  quantity: string
  unitLabel: string
  selected: boolean
}

export function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function emptyWorkDraft(workDate: string): WorkRecordDraft {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    workDate,
    userId: null,
    allowanceItemId: null,
    quantity: '',
    unitLabel: '',
    selected: false,
  }
}

export function draftFromRow(row: WorkRecordLineRow): WorkRecordDraft {
  return {
    key: `row-${row.id}`,
    id: row.id,
    workDate: row.workDate,
    userId: row.userId,
    allowanceItemId: row.allowanceItemId,
    quantity: row.quantity ? String(row.quantity) : '',
    unitLabel: row.unitLabel,
    selected: false,
  }
}

export type UserOption = {
  id: number
  loginId: string
  userName: string
  dept: string
  position: string
  hireDate: string | null
  workerCode: string | null
}

export const EMPLOYEE_STATUS_LABEL: Record<PayEmployeeStatus, string> = {
  ACTIVE: '급여대상',
  INACTIVE: '중단',
}

export type EmployeeProfileForm = {
  userId: number | null
  employeeNo: string
  dept: string
  position: string
  hireDate: string
  baseSalary: string
  hourlyWage: string
  ordinaryWage: string
  pensionBaseSalary: string
  paymentDay: string
  bankName: string
  bankAccount: string
  accountHolder: string
  dependants: string
  children8to20: string
  withholdingRatePct: string
  status: PayEmployeeStatus
  remark: string
}


export function fmtWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

export function fmtYearMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}년 ${Number(m)}월`
}

export function currentYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function emptyEmployeeForm(): EmployeeProfileForm {
  return {
    userId: null,
    employeeNo: '',
    dept: '',
    position: '',
    hireDate: '',
    baseSalary: '',
    hourlyWage: '',
    ordinaryWage: '',
    pensionBaseSalary: '',
    paymentDay: '25',
    bankName: '',
    bankAccount: '',
    accountHolder: '',
    dependants: '1',
    children8to20: '0',
    withholdingRatePct: '100',
    status: 'ACTIVE',
    remark: '',
  }
}

export function employeeFormFromRow(row: EmployeeProfileRow): EmployeeProfileForm {
  return {
    userId: row.userId,
    employeeNo: row.employeeNo ?? '',
    dept: row.dept,
    position: row.position,
    hireDate: row.hireDate ?? '',
    baseSalary: String(row.baseSalary),
    hourlyWage: row.hourlyWage != null ? String(row.hourlyWage) : '',
    ordinaryWage: row.ordinaryWage != null ? String(row.ordinaryWage) : '',
    pensionBaseSalary: row.pensionBaseSalary != null ? String(row.pensionBaseSalary) : '',
    paymentDay: row.paymentDay != null ? String(row.paymentDay) : '',
    bankName: row.bankName ?? '',
    bankAccount: row.bankAccount ?? '',
    accountHolder: row.accountHolder ?? '',
    dependants: String(row.dependants),
    children8to20: String(row.children8to20),
    withholdingRatePct: String(row.withholdingRatePct),
    status: row.status,
    remark: row.remark ?? '',
  }
}
