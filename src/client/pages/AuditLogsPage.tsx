import { ReadonlyDataPage } from '../ui/ReadonlyDataPage'

type Row = {
  id: number
  tableName: string
  recordId: number
  actionType: string
  changedAt: string
  oldValue?: unknown
  newValue?: unknown
}

const tableLabel = (name: string) => {
  const v = name.toLowerCase()
  if (v === 'product' || v === 'products') return '품목'
  if (v === 'customer' || v === 'customers') return '고객/업체'
  if (v === 'category' || v === 'categories') return '카테고리'
  if (v === 'work_center' || v === 'workcenter' || v === 'work_centers') return '작업장'
  if (v === 'worker' || v === 'workers') return '작업자'
  if (v === 'location' || v === 'locations') return '창고/위치'
  return name
}

const actionLabel = (action: string) => {
  const v = action.toUpperCase()
  if (v === 'CREATE') return '등록'
  if (v === 'UPDATE') return '수정'
  if (v === 'DELETE') return '삭제'
  return action
}

const asObj = (v: unknown): Record<string, unknown> | null => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

const firstText = (...vals: unknown[]) => {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v
    if (typeof v === 'number') return String(v)
  }
  return null
}

const recordLabel = (row: Row) => {
  const nv = asObj(row.newValue)
  const ov = asObj(row.oldValue)
  const t = row.tableName.toLowerCase()

  if (t === 'product' || t === 'products') {
    const code = firstText(nv?.productCode, ov?.productCode)
    const name = firstText(nv?.productName, ov?.productName)
    if (code && name) return `${code} · ${name}`
    if (name) return String(name)
  }
  if (t === 'customer' || t === 'customers') {
    const code = firstText(nv?.customerCode, ov?.customerCode)
    const name = firstText(nv?.customerName, ov?.customerName)
    if (code && name) return `${code} · ${name}`
    if (name) return String(name)
  }
  if (t === 'category' || t === 'categories') {
    const code = firstText(nv?.code, ov?.code)
    const name = firstText(nv?.name, ov?.name)
    if (code && name) return `${code} · ${name}`
    if (name) return String(name)
  }
  if (t === 'work_center' || t === 'workcenter' || t === 'work_centers') {
    const code = firstText(nv?.centerCode, ov?.centerCode)
    const name = firstText(nv?.centerName, ov?.centerName)
    if (code && name) return `${code} · ${name}`
    if (name) return String(name)
  }
  if (t === 'worker' || t === 'workers') {
    const code = firstText(nv?.workerCode, ov?.workerCode)
    const name = firstText(nv?.workerName, ov?.workerName)
    if (code && name) return `${code} · ${name}`
    if (name) return String(name)
  }
  if (t === 'location' || t === 'locations') {
    const code = firstText(nv?.locationCode, ov?.locationCode)
    const name = firstText(nv?.locationName, ov?.locationName)
    if (code && name) return `${code} · ${name}`
    if (name) return String(name)
  }
  return `ID ${row.recordId}`
}

const formatKst = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const p = (type: Intl.DateTimeFormatPartTypes) => parts.find((x) => x.type === type)?.value ?? ''
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`
}

export function AuditLogsPage() {
  return (
    <ReadonlyDataPage<Row>
      title="감사 로그"
      description="데이터 변경 이력(조회 전용)."
      fetchPath="/api/audit-logs"
      columns={[
        { header: '데이터', cell: (r) => tableLabel(r.tableName) },
        { header: '대상', cell: (r) => recordLabel(r) },
        { header: '동작', cell: (r) => actionLabel(r.actionType) },
        { header: '시각(KST)', cell: (r) => formatKst(r.changedAt) },
      ]}
    />
  )
}
