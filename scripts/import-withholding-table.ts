/**
 * 국세청 근로소득 간이세액표 Excel → TypeScript 데이터
 * 실행: npx tsx scripts/import-withholding-table.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import XLSX from 'xlsx'

const SRC = resolve('근로소득 간이세액표_2026.03.01.xlsx')
const OUT = resolve('src/server/data/withholding-tax-2026-03.ts')

type Bracket = { minThousand: number; maxThousand: number; taxes: number[] }

function parseTax(v: unknown): number {
  if (v === '-' || v === '' || v == null) return 0
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function main() {
  const wb = XLSX.readFile(SRC)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['근로소득간이세액표'], { header: 1, defval: '' }) as unknown[][]

  const brackets: Bracket[] = []
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i]
    const minThousand = r[0]
    const maxThousand = r[1]
    if (typeof minThousand !== 'number' || typeof maxThousand !== 'number') continue
    const taxes: number[] = []
    for (let c = 2; c <= 12; c++) taxes.push(parseTax(r[c]))
    brackets.push({ minThousand, maxThousand, taxes })
  }

  const content = `/** 자동 생성 — scripts/import-withholding-table.ts (근로소득 간이세액표_2026.03.01.xlsx) */
export const WITHHOLDING_TABLE_META = {
  effectiveFrom: '2026-03-01',
  source: '근로소득 간이세액표_2026.03.01.xlsx',
  bracketCount: ${brackets.length},
} as const

export type WithholdingBracket = {
  minThousand: number
  maxThousand: number
  taxes: number[]
}

export const WITHHOLDING_BRACKETS: WithholdingBracket[] = ${JSON.stringify(brackets, null, 2)}
`

  writeFileSync(OUT, content, 'utf8')
  console.log(`Wrote ${brackets.length} brackets → ${OUT}`)
}

main()
