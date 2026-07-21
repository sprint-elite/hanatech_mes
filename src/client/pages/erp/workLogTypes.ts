export type WorkLogStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'HOLD'

export type WorkLogRow = {
  id: number
  userId: number
  userName: string
  loginId: string
  workDate: string
  workTime: string | null
  title: string
  content: string | null
  category: string | null
  status: WorkLogStatus
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type WorkLogUserOption = {
  id: number
  userName: string
  loginId: string
}

export const STATUS_LABEL: Record<WorkLogStatus, string> = {
  PLANNED: '대기',
  IN_PROGRESS: '진행',
  DONE: '완료',
  HOLD: '특이',
}

export const KANBAN_COLUMNS: WorkLogStatus[] = ['PLANNED', 'IN_PROGRESS', 'DONE', 'HOLD']

export const CATEGORY_PRESETS = ['생산', '품질', '설비', '행정', '기타']

export const STATUS_COLOR: Record<WorkLogStatus, string> = {
  PLANNED: '#3b82f6',
  IN_PROGRESS: '#f0a030',
  DONE: '#3dba72',
  HOLD: '#64748b',
}

export function fmtYmd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function fmtKrDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

/** KST 현재 시각 HH:mm */
export function nowKstTime(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).formatToParts(new Date())
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/** 업무일 + 사용자가 지정한 시각 */
export function fmtWorkLogDateTime(row: WorkLogRow): string {
  const [y, m, d] = row.workDate.split('-').map(Number)
  const datePart = `${y}년 ${m}월 ${d}일`
  if (!row.workTime) return datePart
  return `${datePart} ${row.workTime}`
}

export function buildCalendarCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const pad = first.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function workLogOnDate(row: WorkLogRow, dateKey: string) {
  return row.workDate === dateKey
}

export function cardColor(row: WorkLogRow) {
  return STATUS_COLOR[row.status]
}

export function sortDayLogs(rows: WorkLogRow[]) {
  const order = Object.fromEntries(KANBAN_COLUMNS.map((s, i) => [s, i])) as Record<WorkLogStatus, number>
  return [...rows].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return a.title.localeCompare(b.title, 'ko')
  })
}

export function fmtCalBadge(row: WorkLogRow) {
  const time = row.workTime ?? '--:--'
  return `${time} ${row.title}`
}

export function contentPreview(content: string | null, max = 60) {
  if (!content) return ''
  const one = content.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max)}…` : one
}

export type WorkLogFormDraft = {
  workDate: string
  workTime: string
  title: string
  content: string
  category: string
  status: WorkLogStatus
  userId: number | null
}

export function emptyForm(workDate: string, userId: number | null = null): WorkLogFormDraft {
  return {
    workDate,
    workTime: nowKstTime(),
    title: '',
    content: '',
    category: CATEGORY_PRESETS[0],
    status: 'PLANNED',
    userId,
  }
}

export function formFromRow(row: WorkLogRow): WorkLogFormDraft {
  return {
    workDate: row.workDate,
    workTime: row.workTime ?? nowKstTime(),
    title: row.title,
    content: row.content ?? '',
    category: row.category ?? CATEGORY_PRESETS[0],
    status: row.status,
    userId: row.userId,
  }
}
