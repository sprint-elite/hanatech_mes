/** 4대보험 근로자 부담 요율 (연도·월 기준) */

export type InsuranceRates = {
  label: string
  pensionRate: number
  pensionBaseMin: number
  pensionBaseMax: number
  healthRate: number
  longTermCareRatioOfHealth: number
  employmentRate: number
}

/** 2025.7 ~ 2025.12 (국민연금 4.5%, 건강 3.545%) */
const RATES_2025_H2: InsuranceRates = {
  label: '2025',
  pensionRate: 0.045,
  pensionBaseMin: 400_000,
  pensionBaseMax: 6_370_000,
  healthRate: 0.03545,
  longTermCareRatioOfHealth: 0.1281,
  employmentRate: 0.009,
}

/** 2026.1 ~ (국민연금 4.75%, 건강 3.595%, 장기요양 건강보험료의 13.14%) */
export const RATES_2026: InsuranceRates = {
  label: '2026',
  pensionRate: 0.0475,
  pensionBaseMin: 400_000,
  pensionBaseMax: 6_370_000,
  healthRate: 0.03595,
  longTermCareRatioOfHealth: 0.1314,
  employmentRate: 0.009,
}

export function getInsuranceRates(yearMonth: string): InsuranceRates {
  const [y, m] = yearMonth.split('-').map(Number)
  if (y > 2026 || (y === 2026 && m >= 1)) return RATES_2026
  if (y === 2025 && m >= 7) return RATES_2025_H2
  return RATES_2025_H2
}

export function pensionBase(taxableIncome: number, rates: InsuranceRates): number {
  return Math.min(Math.max(taxableIncome, rates.pensionBaseMin), rates.pensionBaseMax)
}

/** 건강·장기요양: 원 단위 절사 */
export function calcHealthPremium(taxableIncome: number, rates: InsuranceRates): number {
  return Math.floor(taxableIncome * rates.healthRate)
}

export function calcLongTermCarePremium(healthPremium: number, rates: InsuranceRates): number {
  return Math.floor(healthPremium * rates.longTermCareRatioOfHealth)
}

export function calcPensionPremium(taxableIncome: number, rates: InsuranceRates): number {
  return Math.max(0, Math.round(pensionBase(taxableIncome, rates) * rates.pensionRate))
}

export function calcEmploymentPremium(taxableIncome: number, rates: InsuranceRates): number {
  return Math.max(0, Math.round(taxableIncome * rates.employmentRate))
}
