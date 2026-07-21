/**
 * 급여 기본 수당/공제 항목 시드 (eCount 기본 구조 참고)
 * 실행: npx tsx scripts/seed-payroll-items.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ALLOWANCES = [
  { itemCode: '01', itemName: '기본급', displayOrder: 1, paymentType: 'FIXED' as const, taxExemptType: '완전과세', calcDescription: '직원정보 월 고정 기본급' },
  { itemCode: '02', itemName: '야간수당', displayOrder: 2, paymentType: 'VARIABLE_TIME' as const, multiplier: 1.5, calcDescription: '통상시급 × 야간근로시간 × 1.5' },
  { itemCode: '03', itemName: '연장수당', displayOrder: 3, paymentType: 'VARIABLE_TIME' as const, multiplier: 1.5, calcDescription: '통상시급 × 연장근로시간 × 1.5' },
  { itemCode: '04', itemName: '연차수당', displayOrder: 4, paymentType: 'VARIABLE_DAY' as const, calcDescription: '일 통상임금 × 연차사용일' },
  { itemCode: '05', itemName: '휴일수당', displayOrder: 5, paymentType: 'VARIABLE_TIME' as const, multiplier: 1.5, calcDescription: '통상시급 × 휴일근로시간 × 1.5' },
  { itemCode: '15', itemName: '식대', displayOrder: 7, paymentType: 'FIXED' as const, multiplier: 200000, taxExemptType: '식대' },
  { itemCode: '16', itemName: '차량유지비', displayOrder: 8, paymentType: 'FIXED' as const, multiplier: 200000, taxExemptType: '차량유지비' },
]

const DEDUCTIONS = [
  { itemCode: '01', itemName: '소득세', displayOrder: 1, calcFormula: '간이세액표(2026.03)', calcDescription: '월 과세급여·공제대상가족 수·자녀공제·원천징수비율(80/100/120%)' },
  { itemCode: '02', itemName: '지방소득세', displayOrder: 2, calcFormula: '소득세 × 10%', calcDescription: '소득세의 10% (원 단위 절사)' },
  { itemCode: '03', itemName: '국민연금', displayOrder: 3, calcFormula: '기준소득월액 × 4.75%', calcDescription: '직원정보 국민연금 기준소득월액(미입력 시 과세급여)·천원 미만 절사·상하한 적용 × 4.75%' },
  { itemCode: '04', itemName: '건강보험', displayOrder: 4, calcFormula: '보수월액 × 3.595%', calcDescription: '과세급여 × 3.595% (원 단위 절사)' },
  { itemCode: '05', itemName: '고용보험', displayOrder: 5, calcFormula: '보수월액 × 0.9%', calcDescription: '과세급여 × 0.9%' },
  { itemCode: '20', itemName: '장기요양보험', displayOrder: 6, calcFormula: '건강보험 × 13.14%', calcDescription: '건강보험료 × 13.14% (원 단위 절사)' },
]

async function main() {
  for (const a of ALLOWANCES) {
    await prisma.payAllowanceItem.upsert({
      where: { itemCode: a.itemCode },
      create: { ...a, status: 'ACTIVE' },
      update: { ...a, status: 'ACTIVE' },
    })
  }
  for (const d of DEDUCTIONS) {
    await prisma.payDeductionItem.upsert({
      where: { itemCode: d.itemCode },
      create: { ...d, status: 'ACTIVE' },
      update: { ...d, status: 'ACTIVE' },
    })
  }
  console.log(`수당 ${ALLOWANCES.length}건, 공제 ${DEDUCTIONS.length}건 시드 완료`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
