export type PayItemStatus = 'ACTIVE' | 'INACTIVE'
export type PayPaymentType = 'FIXED' | 'VARIABLE_TIME' | 'VARIABLE_DAY'

export type AllowanceItemRow = {
  id: number
  itemCode: string
  itemName: string
  displayOrder: number
  multiplier: number | null
  taxExemptType: string | null
  paymentType: PayPaymentType
  calcFormula: string | null
  calcDescription: string | null
  status: PayItemStatus
  createdAt: string
  updatedAt: string
}

export type DeductionItemRow = {
  id: number
  itemCode: string
  itemName: string
  displayOrder: number
  calcFormula: string | null
  calcDescription: string | null
  status: PayItemStatus
  createdAt: string
  updatedAt: string
}

export const STATUS_LABEL: Record<PayItemStatus, string> = {
  ACTIVE: '사용',
  INACTIVE: '사용중단',
}

export const PAYMENT_TYPE_LABEL: Record<PayPaymentType, string> = {
  FIXED: '고정',
  VARIABLE_TIME: '변동(시간)',
  VARIABLE_DAY: '변동(일)',
}

export const TAX_EXEMPT_OPTIONS = [
  { value: '', label: '—' },
  { value: '완전과세', label: '완전과세' },
  { value: '야간수당', label: '야간수당' },
  { value: '식대', label: '식대' },
  { value: '차량유지비', label: '차량유지비' },
]

export type AllowanceFormDraft = {
  itemCode: string
  itemName: string
  displayOrder: string
  multiplier: string
  taxExemptType: string
  paymentType: PayPaymentType
  calcFormula: string
  calcDescription: string
  status: PayItemStatus
}

export type DeductionFormDraft = {
  itemCode: string
  itemName: string
  displayOrder: string
  calcFormula: string
  calcDescription: string
  status: PayItemStatus
}

export function emptyAllowanceForm(): AllowanceFormDraft {
  return {
    itemCode: '',
    itemName: '',
    displayOrder: '',
    multiplier: '',
    taxExemptType: '',
    paymentType: 'FIXED',
    calcFormula: '',
    calcDescription: '',
    status: 'ACTIVE',
  }
}

export function emptyDeductionForm(): DeductionFormDraft {
  return {
    itemCode: '',
    itemName: '',
    displayOrder: '',
    calcFormula: '',
    calcDescription: '',
    status: 'ACTIVE',
  }
}

export function allowanceFormFromRow(row: AllowanceItemRow): AllowanceFormDraft {
  return {
    itemCode: row.itemCode,
    itemName: row.itemName,
    displayOrder: String(row.displayOrder),
    multiplier: row.multiplier != null ? String(row.multiplier) : '',
    taxExemptType: row.taxExemptType ?? '',
    paymentType: row.paymentType,
    calcFormula: row.calcFormula ?? '',
    calcDescription: row.calcDescription ?? '',
    status: row.status,
  }
}

export function deductionFormFromRow(row: DeductionItemRow): DeductionFormDraft {
  return {
    itemCode: row.itemCode,
    itemName: row.itemName,
    displayOrder: String(row.displayOrder),
    calcFormula: row.calcFormula ?? '',
    calcDescription: row.calcDescription ?? '',
    status: row.status,
  }
}

export function canManagePayroll(roleName: string) {
  return ['실장', '대표', '최고관리자'].includes(roleName)
}
