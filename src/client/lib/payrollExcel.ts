import * as XLSX from 'xlsx'
import type { PayStubDetail, PayrollLedger } from '../pages/erp/payStubDetailTypes'

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

export function exportPayrollLedgerExcel(ledger: PayrollLedger) {
  const header1 = [
    '순번', '성명', '직책', '주민번호', '기본급', '직책수당', '연장, 휴일 근무수당', '상여금',
    '4대보험 해당급여 합계', '식대', '자가운전보조금', '가족수', '공제합계',
    '연말정산 소득세', '소득세', '지방세', '국민연금(4.75%)', '장기요양(13.14%)', '건강보험(3.595%)', '고용보험(0.9%)', '지급액',
  ]

  const dataRows = ledger.rows.map((r) => [
    r.no, r.userName, r.position, r.residentId, r.baseSalary, r.positionAllowance, r.overtimeHoliday, r.bonus,
    r.insuranceBase, r.mealAllowance, r.carAllowance, r.dependants, r.totalDeduction,
    r.yearEndTax, r.incomeTax, r.localTax, r.pension, r.longTermCare, r.health, r.employment, r.netPay,
  ])

  const totals: (string | number)[] = [
    '합계', '', '', '',
    ledger.rows.reduce((s, r) => s + r.baseSalary, 0),
    ledger.rows.reduce((s, r) => s + r.positionAllowance, 0),
    ledger.rows.reduce((s, r) => s + r.overtimeHoliday, 0),
    ledger.rows.reduce((s, r) => s + r.bonus, 0),
    ledger.rows.reduce((s, r) => s + r.insuranceBase, 0),
    ledger.rows.reduce((s, r) => s + r.mealAllowance, 0),
    ledger.rows.reduce((s, r) => s + r.carAllowance, 0),
    '',
    ledger.rows.reduce((s, r) => s + r.totalDeduction, 0),
    ledger.rows.reduce((s, r) => s + r.yearEndTax, 0),
    ledger.rows.reduce((s, r) => s + r.incomeTax, 0),
    ledger.rows.reduce((s, r) => s + r.localTax, 0),
    ledger.rows.reduce((s, r) => s + r.pension, 0),
    ledger.rows.reduce((s, r) => s + r.longTermCare, 0),
    ledger.rows.reduce((s, r) => s + r.health, 0),
    ledger.rows.reduce((s, r) => s + r.employment, 0),
    ledger.rows.reduce((s, r) => s + r.netPay, 0),
  ]

  const aoa: (string | number)[][] = [
    [`회사명 : ${ledger.companyName}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '급여대장'],
    [`${ledger.yearMonthLabel} 급여`],
    [],
    header1,
    ...dataRows,
    totals,
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 0, c: 20 }, e: { r: 0, c: 20 } },
  ]
  ws['!cols'] = header1.map((h) => ({ wch: Math.max(10, Math.min(18, h.length + 2)) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '급여대장')
  downloadWorkbook(wb, `급여대장_${ledger.yearMonth}.xlsx`)
}

export function exportPayStubDetailExcel(detail: PayStubDetail) {
  const aoa: (string | number)[][] = [
    ['급여명세표'],
    [detail.yearMonthLabel],
    [],
    ['지급일자', detail.payDateLabel, '성명', detail.userName],
    ['부서', detail.dept, '직위', detail.position],
    [],
    ['통상시급', detail.hourlyRateFormula],
    ['초과수당', detail.overtimeNote],
    [],
    ['수당항목명', '지급유형', '근무기록', '수당금액', '배율', '금액', '산출방법'],
  ]

  for (const line of detail.earnings) {
    if (!line.amount && !line.label) continue
    aoa.push([
      line.label,
      line.paymentTypeLabel,
      line.workRecord ?? '',
      line.unitAmount ?? '',
      line.multiplier ?? '',
      line.amount,
      line.calcDescription,
    ])
  }
  aoa.push(['합계', '', '', '', '', detail.totalEarning, ''])

  aoa.push([])
  aoa.push(['공제항목명', '', '', '금액', '', '', '산출방법'])
  for (const line of detail.deductions) {
    if (!line.amount && !line.label) continue
    aoa.push([line.label, '', '', line.amount, '', '', line.calcDescription])
  }
  aoa.push(['합계', '', '', detail.totalDeduction, '', '', ''])
  aoa.push([])
  aoa.push(['실지급액', detail.netPay])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 8 },
    { wch: 14 },
    { wch: 28 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '급여명세표')
  const safeName = detail.userName.replace(/[/\\?*[\]]/g, '_')
  downloadWorkbook(wb, `급여명세표_${detail.yearMonth}_${safeName}.xlsx`)
}
