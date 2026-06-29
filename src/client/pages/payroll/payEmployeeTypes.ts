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
  paymentDay: number | null
  bankName: string | null
  bankAccount: string | null
  accountHolder: string | null
  dependants: number
  status: PayEmployeeStatus
  remark: string | null
  createdAt: string
  updatedAt: string
}

export type WorkRecordRow = {
  id: number
  userId: number
  loginId: string
  userName: string
  dept: string
  position: string
  yearMonth: string
  workDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  regularHours: number
  overtimeHours: number
  nightHours: number
  holidayHours: number
  annualLeaveDays: number
  remark: string | null
  createdAt: string
  updatedAt: string
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
  paymentDay: string
  bankName: string
  bankAccount: string
  accountHolder: string
  dependants: string
  status: PayEmployeeStatus
  remark: string
}

export type WorkRecordForm = {
  workDays: string
  paidLeaveDays: string
  unpaidLeaveDays: string
  regularHours: string
  overtimeHours: string
  nightHours: string
  holidayHours: string
  annualLeaveDays: string
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
    paymentDay: '25',
    bankName: '',
    bankAccount: '',
    accountHolder: '',
    dependants: '1',
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
    paymentDay: row.paymentDay != null ? String(row.paymentDay) : '',
    bankName: row.bankName ?? '',
    bankAccount: row.bankAccount ?? '',
    accountHolder: row.accountHolder ?? '',
    dependants: String(row.dependants),
    status: row.status,
    remark: row.remark ?? '',
  }
}

export function workFormFromRow(row: WorkRecordRow): WorkRecordForm {
  return {
    workDays: String(row.workDays),
    paidLeaveDays: String(row.paidLeaveDays),
    unpaidLeaveDays: String(row.unpaidLeaveDays),
    regularHours: String(row.regularHours),
    overtimeHours: String(row.overtimeHours),
    nightHours: String(row.nightHours),
    holidayHours: String(row.holidayHours),
    annualLeaveDays: String(row.annualLeaveDays),
    remark: row.remark ?? '',
  }
}

export function emptyWorkForm(): WorkRecordForm {
  return {
    workDays: '',
    paidLeaveDays: '',
    unpaidLeaveDays: '',
    regularHours: '',
    overtimeHours: '',
    nightHours: '',
    holidayHours: '',
    annualLeaveDays: '',
    remark: '',
  }
}
