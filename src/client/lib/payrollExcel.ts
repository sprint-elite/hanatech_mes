import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import type { PayStubDetail, PayrollLedger } from '../pages/erp/payStubDetailTypes'

const COL_COUNT = 21
const HEADER_ROW = 3
const SUB_HEADER_ROW = 4
const DATA_START_ROW = 5

/** 헤더 분홍 */
const FILL_HEADER = 'FFF2DCDB'
/** 합계·4대보험급여·지급액 열 연보라 */
const FILL_HIGHLIGHT = 'FFE4DFEC'

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
}

const BORDER_BOTTOM_MEDIUM: Partial<ExcelJS.Borders> = {
  ...BORDER_THIN,
  bottom: { style: 'medium', color: { argb: 'FF000000' } },
}

const NUM_FMT = '#,##0'
const HIGHLIGHT_COLS = new Set([9, 13, 21])
const MONEY_COLS = new Set([5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21])

function colLetter(n: number) {
  return String.fromCharCode(64 + n)
}

async function downloadWorkbook(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function applyBorder(cell: ExcelJS.Cell, borders: Partial<ExcelJS.Borders> = BORDER_THIN) {
  cell.border = borders as ExcelJS.Borders
}

function styleHeaderCell(cell: ExcelJS.Cell, value: string) {
  cell.value = value
  cell.font = { bold: true, size: 10, name: '맑은 고딕' }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_HEADER } }
  applyBorder(cell)
}

function styleDataCell(
  cell: ExcelJS.Cell,
  value: string | number,
  col: number,
  { bold = false, bottomMedium = false } = {},
) {
  cell.value = value
  cell.font = { size: 10, name: '맑은 고딕', bold }
  const isMoney = MONEY_COLS.has(col)
  const isText = col <= 4
  cell.alignment = {
    vertical: 'middle',
    horizontal: isText ? 'center' : 'right',
  }
  if (isMoney && typeof value === 'number') {
    cell.numFmt = NUM_FMT
  }
  if (HIGHLIGHT_COLS.has(col)) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_HIGHLIGHT } }
  }
  applyBorder(cell, bottomMedium ? BORDER_BOTTOM_MEDIUM : BORDER_THIN)
}

function mergeTitle(ws: ExcelJS.Worksheet, row: number, colFrom: number, colTo: number, value: string, fontSize: number) {
  ws.mergeCells(row, colFrom, row, colTo)
  const cell = ws.getCell(row, colFrom)
  cell.value = value
  cell.font = { bold: true, size: fontSize, name: '맑은 고딕' }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
}

function mergeHeader(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, value: string) {
  ws.mergeCells(r1, c1, r2, c2)
  styleHeaderCell(ws.getCell(r1, c1), value)
}

function setupLedgerHeaders(ws: ExcelJS.Worksheet) {
  const singleHeaders: [number, string][] = [
    [1, '순번'],
    [2, '성명'],
    [3, '직책'],
    [4, '주민번호'],
    [5, '기본급'],
    [6, '직책수당'],
    [7, '연장, 휴일\n근무수당'],
    [8, '상여금'],
    [9, '4대보험\n해당급여 합계'],
    [12, '가족수'],
    [13, '공제합계'],
    [21, '지급액'],
  ]
  for (const [col, label] of singleHeaders) {
    mergeHeader(ws, HEADER_ROW, col, SUB_HEADER_ROW, col, label)
  }

  mergeHeader(ws, HEADER_ROW, 10, HEADER_ROW, 11, '비과세')
  styleHeaderCell(ws.getCell(SUB_HEADER_ROW, 10), '식대')
  styleHeaderCell(ws.getCell(SUB_HEADER_ROW, 11), '자가운전\n보조금')

  mergeHeader(ws, HEADER_ROW, 14, HEADER_ROW, 20, '4대보험(근로자공제)')
  const insuranceSubs = [
    [14, '연말정산\n소득세'],
    [15, '소득세'],
    [16, '지방세'],
    [17, '국민연금\n(4.75%)'],
    [18, '장기요양\n(13.14%)'],
    [19, '건강보험\n(3.595%)'],
    [20, '고용보험\n(0.9%)'],
  ]
  for (const [col, label] of insuranceSubs) {
    styleHeaderCell(ws.getCell(SUB_HEADER_ROW, col), label)
  }

  ws.getRow(HEADER_ROW).height = 22
  ws.getRow(SUB_HEADER_ROW).height = 36
}

function setColumnWidths(ws: ExcelJS.Worksheet) {
  const widths = [5, 9, 8, 14, 11, 10, 13, 9, 13, 9, 12, 7, 11, 11, 9, 9, 12, 12, 12, 11, 12]
  widths.forEach((wch, i) => {
    ws.getColumn(i + 1).width = wch
  })
}

export async function exportPayrollLedgerExcel(ledger: PayrollLedger) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MESNEW'
  const ws = wb.addWorksheet('급여대장', {
    views: [{ state: 'frozen', ySplit: DATA_START_ROW - 1, xSplit: 4 }],
    properties: { defaultRowHeight: 18 },
  })

  mergeTitle(ws, 1, 1, COL_COUNT, '급여대장', 18)

  ws.mergeCells(2, 1, 2, 6)
  const companyCell = ws.getCell(2, 1)
  companyCell.value = `회사명 : ${ledger.companyName}`
  companyCell.font = { size: 11, name: '맑은 고딕' }
  companyCell.alignment = { vertical: 'middle', horizontal: 'left' }

  ws.mergeCells(2, 14, 2, COL_COUNT)
  const periodCell = ws.getCell(2, 14)
  periodCell.value = `${ledger.yearMonthLabel} 급여${ledger.payDateLabel ? `  (지급일 ${ledger.payDateLabel})` : ''}`
  periodCell.font = { size: 10, name: '맑은 고딕' }
  periodCell.alignment = { vertical: 'middle', horizontal: 'right' }

  setupLedgerHeaders(ws)
  setColumnWidths(ws)

  let rowIdx = DATA_START_ROW
  for (const r of ledger.rows) {
    const values: (string | number)[] = [
      r.no, r.userName, r.position, r.residentId || '',
      r.baseSalary, r.positionAllowance, r.overtimeHoliday, r.bonus,
      r.insuranceBase, r.mealAllowance, r.carAllowance, r.dependants, r.totalDeduction,
      r.yearEndTax, r.incomeTax, r.localTax, r.pension, r.longTermCare, r.health, r.employment, r.netPay,
    ]
    for (let c = 1; c <= COL_COUNT; c++) {
      styleDataCell(ws.getCell(rowIdx, c), values[c - 1], c)
    }
    rowIdx++
  }

  const totals: (string | number)[] = [
    '', '합 계', '', '',
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
  for (let c = 1; c <= COL_COUNT; c++) {
    styleDataCell(ws.getCell(rowIdx, c), totals[c - 1], c, {
      bold: true,
      bottomMedium: c === COL_COUNT,
    })
  }
  ws.getRow(rowIdx).height = 22

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }
  ws.pageSetup.printArea = `A1:${colLetter(COL_COUNT)}${rowIdx}`

  const buffer = await wb.xlsx.writeBuffer()
  await downloadWorkbook(buffer, `급여대장_${ledger.yearMonth}.xlsx`)
}

function downloadXlsxWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
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
  downloadXlsxWorkbook(wb, `급여명세표_${detail.yearMonth}_${safeName}.xlsx`)
}
