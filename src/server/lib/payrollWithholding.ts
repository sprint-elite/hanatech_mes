import { WITHHOLDING_BRACKETS } from '../data/withholding-tax-2026-03'
import { truncateTenWon } from './payrollRates'

/** 공제대상가족 수 1~11 (간이세액표 열) */
export function clampFamilyCount(n: number): number {
  return Math.min(11, Math.max(1, Math.round(n)))
}

/** 소득령 별표2 — 8세 이상 20세 이하 자녀 세액공제 */
export function childTaxCredit(children8to20: number): number {
  const n = Math.max(0, Math.round(children8to20))
  if (n === 0) return 0
  if (n === 1) return 20_830
  if (n === 2) return 45_830
  return 45_830 + (n - 2) * 33_330
}

export function clampWithholdingRatePct(n: number): 80 | 100 | 120 {
  if (n <= 80) return 80
  if (n >= 120) return 120
  return 100
}

/** 월 과세급여(원, 비과세 제외) → 간이세액표 기본 소득세 */
export function lookupTableIncomeTax(monthlyTaxableWon: number, familyCount: number): number {
  if (monthlyTaxableWon <= 0) return 0

  const payThousand = monthlyTaxableWon / 1000
  const col = clampFamilyCount(familyCount) - 1

  let bracket = WITHHOLDING_BRACKETS.find(
    (b) => payThousand >= b.minThousand && payThousand < b.maxThousand,
  )

  if (!bracket) {
    if (payThousand < WITHHOLDING_BRACKETS[0].minThousand) return 0
    bracket = WITHHOLDING_BRACKETS[WITHHOLDING_BRACKETS.length - 1]
  }

  return bracket.taxes[col] ?? 0
}

export function calcWithholdingIncomeTax(input: {
  monthlyTaxableWon: number
  familyCount: number
  children8to20: number
  withholdingRatePct: number
}): number {
  const tableTax = lookupTableIncomeTax(input.monthlyTaxableWon, input.familyCount)
  const afterChild = Math.max(0, tableTax - childTaxCredit(input.children8to20))
  const rate = clampWithholdingRatePct(input.withholdingRatePct)
  return Math.max(0, Math.round(afterChild * (rate / 100)))
}

export function calcLocalIncomeTax(incomeTax: number): number {
  return truncateTenWon(incomeTax * 0.1)
}
