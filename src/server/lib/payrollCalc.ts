import { prisma } from '../db/prisma'
import {
  calcEmploymentPremium,
  calcHealthPremium,
  calcLongTermCarePremium,
  calcPensionPremium,
  getInsuranceRates,
  resolvePensionIncome,
} from './payrollRates'
import { calcLocalIncomeTax, calcWithholdingIncomeTax } from './payrollWithholding'

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

export type WorkQuantities = Record<number, number>

type AllowanceItem = {
  id: number
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
  pensionBaseSalary: { toString(): string } | null
  dependants: number
  children8to20: number
  withholdingRatePct: number
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

function calcIncomeTax(
  taxableIncome: number,
  profile: { dependants: number; children8to20: number; withholdingRatePct: number },
): number {
  return calcWithholdingIncomeTax({
    monthlyTaxableWon: taxableIncome,
    familyCount: profile.dependants,
    children8to20: profile.children8to20,
    withholdingRatePct: profile.withholdingRatePct,
  })
}

function calcAllowance(item: AllowanceItem, ctx: {
  profile: Profile
  workQuantities: WorkQuantities
  yearMonth: string
  hourlyRate: number
  dailyRate: number
}): number {
  const mult = item.multiplier != null ? n(item.multiplier) : null
  const qty = ctx.workQuantities[item.id] ?? 0

  if (includesAny(item.itemName, ['기본급']) || item.itemCode === '01') {
    return roundWon(n(ctx.profile.baseSalary))
  }

  if (item.paymentType === 'FIXED') {
    return roundWon(mult ?? 0)
  }

  if (item.paymentType === 'VARIABLE_TIME') {
    const rate = mult ?? 1.5
    return roundWon(ctx.hourlyRate * qty * rate)
  }

  if (item.paymentType === 'VARIABLE_DAY') {
    const rate = mult ?? 1
    return roundWon(ctx.dailyRate * qty * rate)
  }

  return 0
}

function calcDeduction(
  item: DeductionItem,
  ctx: {
    taxableIncome: number
    profile: Profile
    yearMonth: string
    computed: Record<string, number>
  },
): number {
  const name = item.itemName
  const formula = item.calcFormula ?? ''
  const rates = getInsuranceRates(ctx.yearMonth)

  if (includesAny(name, ['국민연금']) || includesAny(formula, ['국민연금'])) {
    const reported = ctx.profile.pensionBaseSalary != null ? n(ctx.profile.pensionBaseSalary) : null
    const pensionIncome = resolvePensionIncome(ctx.taxableIncome, reported)
    return calcPensionPremium(pensionIncome, rates)
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
    const incomeTax = ctx.computed['소득세'] ?? calcIncomeTax(ctx.taxableIncome, ctx.profile)
    return calcLocalIncomeTax(incomeTax)
  }

  if (includesAny(name, ['소득세']) && !includesAny(name, ['지방', '주민'])) {
    return calcIncomeTax(ctx.taxableIncome, ctx.profile)
  }

  return 0
}

export function aggregateWorkQuantities(
  lines: { allowanceItemId: number; quantity: { toString(): string } }[],
): WorkQuantities {
  const map: WorkQuantities = {}
  for (const line of lines) {
    map[line.allowanceItemId] = (map[line.allowanceItemId] ?? 0) + n(line.quantity)
  }
  return map
}

export function calculatePayroll(input: {
  profile: Profile
  workQuantities: WorkQuantities
  yearMonth: string
  allowances: AllowanceItem[]
  deductions: DeductionItem[]
}): CalcResult {
  const warnings: string[] = []
  const { profile, workQuantities, yearMonth, allowances, deductions } = input

  const hasVariableWork = allowances.some(
    (a) => a.paymentType !== 'FIXED' && !includesAny(a.itemName, ['기본급']) && (workQuantities[a.id] ?? 0) > 0,
  )
  if (!hasVariableWork) {
    warnings.push('해당 월 변동 근무입력이 없습니다. 시간/일수 기반 수당은 0원으로 계산됩니다.')
  }

  const ordinary = n(profile.ordinaryWage) || n(profile.baseSalary)
  const hourlyRate = n(profile.hourlyWage) || ordinary / 209
  const monthDayCount = monthDays(yearMonth)
  const dailyRate = ordinary / monthDayCount

  const ctx = { profile, workQuantities, yearMonth, hourlyRate, dailyRate }

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
      profile,
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
    workDays: null,
    dept: profile.dept ?? '',
    position: profile.position ?? '',
    warnings,
  }
}

export async function loadPayrollCalcInput(userId: number, yearMonth: string) {
  const [profile, lines, allowances, deductions] = await Promise.all([
    prisma.payEmployeeProfile.findUnique({ where: { userId } }),
    prisma.payWorkRecordLine.findMany({ where: { userId, yearMonth } }),
    prisma.payAllowanceItem.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ displayOrder: 'asc' }, { itemCode: 'asc' }] }),
    prisma.payDeductionItem.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ displayOrder: 'asc' }, { itemCode: 'asc' }] }),
  ])

  const workQuantities = aggregateWorkQuantities(lines)

  return { profile, workQuantities, allowances, deductions }
}

export async function calculatePayrollForUser(userId: number, yearMonth: string): Promise<CalcResult> {
  const { profile, workQuantities, allowances, deductions } = await loadPayrollCalcInput(userId, yearMonth)

  if (!profile || profile.status !== 'ACTIVE') {
    throw Object.assign(new Error('급여 직원정보가 없거나 비활성 상태입니다.'), { status: 400 })
  }
  if (allowances.length === 0) {
    throw Object.assign(new Error('활성 수당항목이 없습니다. 수당항목을 먼저 등록하세요.'), { status: 400 })
  }
  if (deductions.length === 0) {
    throw Object.assign(new Error('활성 공제항목이 없습니다. 공제항목을 먼저 등록하세요.'), { status: 400 })
  }

  return calculatePayroll({ profile, workQuantities, yearMonth, allowances, deductions })
}
