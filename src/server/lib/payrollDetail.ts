import { prisma } from '../db/prisma'
import { calculatePayrollForUser, loadPayrollCalcInput } from './payrollCalc'

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  FIXED: '고정급',
  VARIABLE_TIME: '시간',
  VARIABLE_DAY: '일',
}

function n(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0
  return Number(v.toString())
}

function includesAny(text: string, keys: string[]) {
  return keys.some((k) => text.includes(k))
}

function fmtYmSlash(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}/${m}`
}

function fmtYmdSlash(iso: string | null | undefined) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${y}/${m}/${d}`
}

type Work = {
  workDays: { toString(): string }
  overtimeHours: { toString(): string }
  nightHours: { toString(): string }
  holidayHours: { toString(): string }
  annualLeaveDays: { toString(): string }
}

function workRecordForItem(name: string, work: Work | null): number | null {
  if (!work) return null
  if (includesAny(name, ['연장'])) return n(work.overtimeHours)
  if (includesAny(name, ['야간'])) return n(work.nightHours)
  if (includesAny(name, ['휴일'])) return n(work.holidayHours)
  if (includesAny(name, ['연차'])) return n(work.annualLeaveDays)
  return null
}

function unitAmountForItem(
  name: string,
  paymentType: string,
  profile: { baseSalary: { toString(): string }; ordinaryWage: { toString(): string } | null; hourlyWage: { toString(): string } | null },
  hourlyRate: number,
  itemMultiplier: number | null,
) {
  if (includesAny(name, ['기본급'])) return n(profile.baseSalary)
  if (paymentType === 'VARIABLE_TIME') return Math.round(hourlyRate)
  if (paymentType === 'FIXED' && itemMultiplier != null) return Math.round(itemMultiplier)
  return null
}

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

export async function buildPayStubDetail(
  userId: number,
  yearMonth: string,
  payDate?: string | null,
  userName?: string,
  savedLines?: { earnings: { label: string; amount: number }[]; deductions: { label: string; amount: number }[] },
): Promise<PayStubDetail> {
  const { profile, work, allowances, deductions } = await loadPayrollCalcInput(userId, yearMonth)
  if (!profile) throw Object.assign(new Error('급여 직원정보가 없습니다.'), { status: 400 })

  const calc = await calculatePayrollForUser(userId, yearMonth)
  const ordinary = n(profile.ordinaryWage) || n(profile.baseSalary)
  const hourlyRate = n(profile.hourlyWage) || ordinary / 209

  const amountByLabel = (label: string, type: 'EARNING' | 'DEDUCTION') => {
    const saved = type === 'EARNING'
      ? savedLines?.earnings.find((l) => l.label === label)
      : savedLines?.deductions.find((l) => l.label === label)
    if (saved) return saved.amount
    const calcLine = type === 'EARNING'
      ? calc.earnings.find((l) => l.label === label)
      : calc.deductions.find((l) => l.label === label)
    return calcLine?.amount ?? 0
  }

  let taxableIncome = 0
  const earnings: PayStubDetailEarning[] = allowances.map((item) => {
    const amount = amountByLabel(item.itemName, 'EARNING')
    const mult = item.multiplier != null ? n(item.multiplier) : null
    const cap = item.taxExemptType === '식대' || item.taxExemptType === '차량유지비' ? 200_000 : 0
    taxableIncome += cap > 0 ? Math.max(0, amount - cap) : amount
    return {
      label: item.itemName,
      paymentType: item.paymentType,
      paymentTypeLabel: PAYMENT_TYPE_LABEL[item.paymentType] ?? item.paymentType,
      workRecord: workRecordForItem(item.itemName, work),
      unitAmount: unitAmountForItem(item.itemName, item.paymentType, profile, hourlyRate, mult),
      multiplier:
        item.paymentType === 'VARIABLE_TIME'
          ? (mult ?? 1.5)
          : item.paymentType === 'VARIABLE_DAY'
            ? (mult ?? 1)
            : null,
      amount,
      calcDescription: includesAny(item.itemName, ['기본급'])
        ? (item.calcDescription ?? item.calcFormula ?? '직원정보 월 고정 기본급')
        : (item.calcDescription ?? item.calcFormula ?? ''),
    }
  })

  const deductionsOut: PayStubDetailDeduction[] = deductions.map((item) => ({
    label: item.itemName,
    amount: amountByLabel(item.itemName, 'DEDUCTION'),
    calcDescription: item.calcDescription ?? item.calcFormula ?? '',
  }))

  const totalEarning = earnings.reduce((s, l) => s + l.amount, 0)
  const totalDeduction = deductionsOut.reduce((s, l) => s + l.amount, 0)
  const insuranceBase = Math.min(taxableIncome, 6_370_000)

  const user = userName ?? ''

  return {
    userId,
    userName: user,
    dept: profile.dept ?? '',
    position: profile.position ?? '',
    yearMonth,
    yearMonthLabel: `${fmtYmSlash(yearMonth)} 급여`,
    payDate: payDate ?? null,
    payDateLabel: fmtYmdSlash(payDate),
    ordinaryHourlyRate: Math.round(hourlyRate),
    hourlyRateFormula: `(기본급 + 비과세 수당 등) / 209시간 → 통상시급 ${Math.round(hourlyRate).toLocaleString('ko-KR')}원`,
    overtimeNote: '초과수당 대상: 1.평일연장 2.평일야간 3.휴일근무 4.휴일야간 / 통상시급 × 근무시간 × 배율',
    dependants: profile.dependants,
    workDays: work ? n(work.workDays) : calc.workDays,
    earnings,
    deductions: deductionsOut,
    totalEarning,
    totalDeduction,
    netPay: totalEarning - totalDeduction,
    taxableIncome,
    insuranceBase,
  }
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

function sumByLabels(lines: { label: string; amount: number }[], keys: string[]) {
  return lines.filter((l) => includesAny(l.label, keys)).reduce((s, l) => s + l.amount, 0)
}

function amountByLabel(lines: { label: string; amount: number }[], keys: string[]) {
  const line = lines.find((l) => includesAny(l.label, keys))
  return line?.amount ?? 0
}

export async function buildPayrollLedger(runId: number) {
  const run = await prisma.payStubRun.findUnique({
    where: { id: runId },
    include: {
      payStubs: {
        include: {
          user: { select: { id: true, userName: true } },
          lines: true,
        },
        orderBy: [{ user: { userName: 'asc' } }],
      },
    },
  })
  if (!run) throw Object.assign(new Error('run not found'), { status: 404 })

  const rows: LedgerRow[] = []
  for (let i = 0; i < run.payStubs.length; i++) {
    const stub = run.payStubs[i]
    const earnings = stub.lines.filter((l) => l.lineType === 'EARNING').map((l) => ({ label: l.label, amount: n(l.amount) }))
    const deductions = stub.lines.filter((l) => l.lineType === 'DEDUCTION').map((l) => ({ label: l.label, amount: n(l.amount) }))

    const profile = await prisma.payEmployeeProfile.findUnique({
      where: { userId: stub.userId },
    })

    let insuranceBase = 0
    try {
      const detail = await buildPayStubDetail(stub.userId, run.yearMonth, run.payDate ? run.payDate.toISOString().slice(0, 10) : null, stub.user.userName, { earnings, deductions })
      insuranceBase = detail.insuranceBase
    } catch {
      insuranceBase = stub.totalEarning ? n(stub.totalEarning) : 0
    }

    rows.push({
      no: i + 1,
      userName: stub.user.userName,
      position: stub.position ?? profile?.position ?? '',
      residentId: '',
      baseSalary: amountByLabel(earnings, ['기본급']),
      positionAllowance: amountByLabel(earnings, ['직책']),
      overtimeHoliday: sumByLabels(earnings, ['연장', '야간', '휴일']),
      bonus: amountByLabel(earnings, ['상여']),
      insuranceBase,
      mealAllowance: amountByLabel(earnings, ['식대']),
      carAllowance: sumByLabels(earnings, ['차량', '자가']),
      dependants: profile?.dependants ?? 1,
      totalDeduction: n(stub.totalDeduction),
      yearEndTax: amountByLabel(deductions, ['연말']),
      incomeTax: amountByLabel(deductions, ['소득세']),
      localTax: sumByLabels(deductions, ['지방', '주민']),
      pension: amountByLabel(deductions, ['국민연금']),
      longTermCare: amountByLabel(deductions, ['장기']),
      health: deductions.find((l) => l.label.includes('건강') && !l.label.includes('장기'))?.amount ?? 0,
      employment: amountByLabel(deductions, ['고용']),
      netPay: n(stub.netPay),
    })
  }

  return {
    companyName: '하나테크',
    yearMonth: run.yearMonth,
    yearMonthLabel: fmtYmSlash(run.yearMonth),
    payDateLabel: fmtYmdSlash(run.payDate ? run.payDate.toISOString().slice(0, 10) : null),
    rows,
  }
}
