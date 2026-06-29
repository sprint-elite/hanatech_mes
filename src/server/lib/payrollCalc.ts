import { prisma } from '../db/prisma'
import {
  calcEmploymentPremium,
  calcHealthPremium,
  calcLongTermCarePremium,
  calcPensionPremium,
  getInsuranceRates,
} from './payrollRates'

export type CalcLine = { label: string; amount: number; itemCode: string }

export type CalcResult = {
  earnings: CalcLine[]
  deductions: CalcLine[]
  totalEarning: number
  totalDeduction: number
  netPay: number
  workDays: number | null
  dept: string
  position: string
  warnings: string[]
}

type AllowanceItem = {
  itemCode: string
  itemName: string
  paymentType: string
  multiplier: { toString(): string } | null
  taxExemptType: string | null
  calcFormula: string | null
  calcDescription: string | null
}

type DeductionItem = {
  itemCode: string
  itemName: string
  calcFormula: string | null
  calcDescription: string | null
}

type Profile = {
  userId: number
  dept: string | null
  position: string | null
  baseSalary: { toString(): string }
  hourlyWage: { toString(): string } | null
  ordinaryWage: { toString(): string } | null
  dependants: number
}

type Work = {
  workDays: { toString(): string }
  overtimeHours: { toString(): string }
  nightHours: { toString(): string }
  holidayHours: { toString(): string }
  annualLeaveDays: { toString(): string }
}

function n(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0
  return Number(v.toString())
}

function roundWon(v: number) {
  return Math.max(0, Math.round(v))
}

function monthDays(yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function includesAny(text: string, keys: string[]) {
  return keys.some((k) => text.includes(k))
}

function nonTaxableCap(type: string | null): number {
  if (type === '식대') return 200_000
  if (type === '차량유지비') return 200_000
  return 0
}

function calcIncomeTax(taxable: number, dependants: number): number {
  const allowance = Math.max(0, dependants - 1) * 150_000
  const base = Math.max(0, taxable - allowance)
  if (base <= 1_060_000) return 0
  if (base <= 3_000_000) return roundWon((base - 1_060_000) * 0.06)
  if (base <= 5_000_000) return roundWon(116_400 + (base - 3_000_000) * 0.15)
  return roundWon(416_400 + (base - 5_000_000) * 0.24)
}

function calcAllowance(item: AllowanceItem, ctx: {
  profile: Profile
  work: Work | null
  yearMonth: string
  hourlyRate: number
  dailyRate: number
  monthDayCount: number
}): number {
  const name = item.itemName
  const mult = item.multiplier != null ? n(item.multiplier) : null
  const work = ctx.work

  if (includesAny(name, ['기본급']) || item.itemCode === '01') {
    return roundWon(n(ctx.profile.baseSalary))
  }

  if (includesAny(name, ['연장'])) {
    const hours = work ? n(work.overtimeHours) : 0
    const rate = mult ?? 1.5
    return roundWon(ctx.hourlyRate * hours * rate)
  }

  if (includesAny(name, ['야간'])) {
    const hours = work ? n(work.nightHours) : 0
    const rate = mult ?? 1.5
    return roundWon(ctx.hourlyRate * hours * rate)
  }

  if (includesAny(name, ['휴일'])) {
    const hours = work ? n(work.holidayHours) : 0
    const rate = mult ?? 1.5
    return roundWon(ctx.hourlyRate * hours * rate)
  }

  if (includesAny(name, ['연차'])) {
    const days = work ? n(work.annualLeaveDays) : 0
    return roundWon(ctx.dailyRate * days)
  }

  if (item.paymentType === 'FIXED') {
    return roundWon(mult ?? 0)
  }

  if (item.paymentType === 'VARIABLE_TIME') {
    const hours = work ? n(work.regularHours) : 0
    return roundWon(ctx.hourlyRate * hours * (mult ?? 1))
  }

  if (item.paymentType === 'VARIABLE_DAY') {
    const days = work ? n(work.workDays) : 0
    return roundWon(ctx.dailyRate * days * (mult ?? 1))
  }

  return 0
}

function calcDeduction(
  item: DeductionItem,
  ctx: {
    taxableIncome: number
    dependants: number
    yearMonth: string
    computed: Record<string, number>
  },
): number {
  const name = item.itemName
  const formula = item.calcFormula ?? ''
  const rates = getInsuranceRates(ctx.yearMonth)

  if (includesAny(name, ['국민연금']) || includesAny(formula, ['국민연금'])) {
    return calcPensionPremium(ctx.taxableIncome, rates)
  }

  if (includesAny(name, ['건강보험']) && !includesAny(name, ['장기'])) {
    return calcHealthPremium(ctx.taxableIncome, rates)
  }

  if (includesAny(name, ['장기요양', '장기'])) {
    const health =
      ctx.computed['건강보험'] ?? calcHealthPremium(ctx.taxableIncome, rates)
    return calcLongTermCarePremium(health, rates)
  }

  if (includesAny(name, ['고용보험'])) {
    return calcEmploymentPremium(ctx.taxableIncome, rates)
  }

  if (includesAny(name, ['주민세', '지방소득', '지방'])) {
    const incomeTax = ctx.computed['소득세'] ?? calcIncomeTax(ctx.taxableIncome, ctx.dependants)
    return roundWon(incomeTax * 0.1)
  }

  if (includesAny(name, ['소득세']) && !includesAny(name, ['지방', '주민'])) {
    return calcIncomeTax(ctx.taxableIncome, ctx.dependants)
  }

  return 0
}

export function calculatePayroll(input: {
  profile: Profile
  work: Work | null
  yearMonth: string
  allowances: AllowanceItem[]
  deductions: DeductionItem[]
}): CalcResult {
  const warnings: string[] = []
  const { profile, work, yearMonth, allowances, deductions } = input

  if (!work) {
    warnings.push('해당 월 근무입력이 없습니다. 시간/일수 기반 수당은 0원으로 계산됩니다.')
  }

  const ordinary = n(profile.ordinaryWage) || n(profile.baseSalary)
  const hourlyRate = n(profile.hourlyWage) || ordinary / 209
  const monthDayCount = monthDays(yearMonth)
  const dailyRate = ordinary / monthDayCount

  const ctx = { profile, work, yearMonth, hourlyRate, dailyRate, monthDayCount }

  const earnings: CalcLine[] = allowances.map((item) => ({
    itemCode: item.itemCode,
    label: item.itemName,
    amount: calcAllowance(item, ctx),
  }))

  let taxableIncome = 0
  for (let i = 0; i < earnings.length; i++) {
    const item = allowances[i]
    const amount = earnings[i].amount
    const cap = nonTaxableCap(item.taxExemptType)
    taxableIncome += cap > 0 ? Math.max(0, amount - cap) : amount
  }

  const computed: Record<string, number> = {}
  for (const e of earnings) {
    computed[e.label] = e.amount
  }

  const deductionsOut: CalcLine[] = []
  for (const item of deductions) {
    const amount = calcDeduction(item, {
      taxableIncome,
      dependants: profile.dependants,
      yearMonth,
      computed,
    })
    deductionsOut.push({ itemCode: item.itemCode, label: item.itemName, amount })
    computed[item.itemName] = amount
    if (includesAny(item.itemName, ['소득세'])) computed['소득세'] = amount
    if (includesAny(item.itemName, ['건강보험']) && !includesAny(item.itemName, ['장기'])) {
      computed['건강보험'] = amount
    }
  }

  const totalEarning = earnings.reduce((s, l) => s + l.amount, 0)
  const totalDeduction = deductionsOut.reduce((s, l) => s + l.amount, 0)

  return {
    earnings,
    deductions: deductionsOut,
    totalEarning,
    totalDeduction,
    netPay: totalEarning - totalDeduction,
    workDays: work ? n(work.workDays) : null,
    dept: profile.dept ?? '',
    position: profile.position ?? '',
    warnings,
  }
}

export async function loadPayrollCalcInput(userId: number, yearMonth: string) {
  const [profile, work, allowances, deductions] = await Promise.all([
    prisma.payEmployeeProfile.findUnique({ where: { userId } }),
    prisma.payWorkRecord.findUnique({ where: { userId_yearMonth: { userId, yearMonth } } }),
    prisma.payAllowanceItem.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ displayOrder: 'asc' }, { itemCode: 'asc' }] }),
    prisma.payDeductionItem.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ displayOrder: 'asc' }, { itemCode: 'asc' }] }),
  ])

  return { profile, work, allowances, deductions }
}

export async function calculatePayrollForUser(userId: number, yearMonth: string): Promise<CalcResult> {
  const { profile, work, allowances, deductions } = await loadPayrollCalcInput(userId, yearMonth)

  if (!profile || profile.status !== 'ACTIVE') {
    throw Object.assign(new Error('급여 직원정보가 없거나 비활성 상태입니다.'), { status: 400 })
  }
  if (allowances.length === 0) {
    throw Object.assign(new Error('활성 수당항목이 없습니다. 수당항목을 먼저 등록하세요.'), { status: 400 })
  }
  if (deductions.length === 0) {
    throw Object.assign(new Error('활성 공제항목이 없습니다. 공제항목을 먼저 등록하세요.'), { status: 400 })
  }

  return calculatePayroll({ profile, work, yearMonth, allowances, deductions })
}
