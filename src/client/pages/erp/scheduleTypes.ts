export type ScheduleStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'HOLD'
export type SchedulePriority = 'LOW' | 'NORMAL' | 'HIGH'

export type ScheduleRow = {
  id: number
  title: string
  description: string | null
  category: string | null
  startDate: string
  endDate: string | null
  allDay: boolean
  startTime: string | null
  endTime: string | null
  status: ScheduleStatus
  priority: SchedulePriority
  assignee: string | null
  color: string | null
  sortOrder: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

export const STATUS_LABEL: Record<ScheduleStatus, string> = {
  PLANNED: '예정',
  IN_PROGRESS: '진행',
  DONE: '완료',
  HOLD: '보류',
}

export const PRIORITY_LABEL: Record<SchedulePriority, string> = {
  LOW: '낮음',
  NORMAL: '보통',
  HIGH: '높음',
}

export const KANBAN_COLUMNS: ScheduleStatus[] = ['PLANNED', 'IN_PROGRESS', 'DONE', 'HOLD']

export const CATEGORY_PRESETS = ['회의', '점검', '행정', '외부', '기타']

export const COLOR_PRESETS = ['#3dba72', '#3b82f6', '#f0a030', '#e85d5d', '#8b5cf6', '#64748b']

export function fmtYmd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function fmtKrDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

export function fmtPeriod(row: ScheduleRow) {
  const end = row.endDate ?? row.startDate
  if (row.startDate === end) return fmtKrDate(row.startDate)
  return `${fmtKrDate(row.startDate)} ~ ${fmtKrDate(end)}`
}

export function fmtTimeRange(row: ScheduleRow) {
  if (row.allDay) return '종일'
  if (row.startTime && row.endTime) return `${row.startTime} ~ ${row.endTime}`
  if (row.startTime) return row.startTime
  return '시간 미지정'
}

export function fmtCalBadge(row: ScheduleRow) {
  const prefix = row.allDay ? '종일' : (row.startTime ?? '--:--')
  return `${prefix} ${row.title}`
}

export function sortDaySchedules(rows: ScheduleRow[]) {
  return [...rows].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? 1 : -1
    const ta = a.startTime ?? '99:99'
    const tb = b.startTime ?? '99:99'
    if (ta !== tb) return ta.localeCompare(tb)
    return a.title.localeCompare(b.title, 'ko')
  })
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

export function scheduleOnDate(row: ScheduleRow, dateKey: string) {
  const end = row.endDate ?? row.startDate
  return row.startDate <= dateKey && end >= dateKey
}

export function cardColor(row: ScheduleRow) {
  return row.color ?? '#3b82f6'
}

export type KanbanAlertBadge = '지연' | '기한 초과'

function scheduleStartAt(row: ScheduleRow): Date {
  if (row.allDay) {
    return new Date(`${row.startDate}T00:00:00`)
  }
  const t = row.startTime ?? '00:00'
  return new Date(`${row.startDate}T${t}:00`)
}

function scheduleEndAt(row: ScheduleRow): Date {
  const endDate = row.endDate ?? row.startDate
  if (row.allDay) {
    return new Date(`${endDate}T23:59:59`)
  }
  const t = row.endTime ?? '23:59'
  return new Date(`${endDate}T${t}:00`)
}

export function isScheduleStartPast(row: ScheduleRow, now = new Date()): boolean {
  return now.getTime() > scheduleStartAt(row).getTime()
}

export function isScheduleEndPast(row: ScheduleRow, now = new Date()): boolean {
  return now.getTime() > scheduleEndAt(row).getTime()
}

/** 예정 + 시작 시각 경과 → 지연, 진행 + 종료 시각 경과 → 기한 초과 */
export function getKanbanAlertBadge(row: ScheduleRow, now = new Date()): KanbanAlertBadge | null {
  if (row.status === 'PLANNED' && isScheduleStartPast(row, now)) return '지연'
  if (row.status === 'IN_PROGRESS' && isScheduleEndPast(row, now)) return '기한 초과'
  return null
}

export type ScheduleFormDraft = {
  title: string
  description: string
  category: string
  startDate: string
  endDate: string
  allDay: boolean
  startTime: string
  endTime: string
  status: ScheduleStatus
  priority: SchedulePriority
  assignee: string
  color: string
}

export function emptyForm(dateKey: string): ScheduleFormDraft {
  return {
    title: '',
    description: '',
    category: '회의',
    startDate: dateKey,
    endDate: dateKey,
    allDay: false,
    startTime: '09:00',
    endTime: '10:00',
    status: 'PLANNED',
    priority: 'NORMAL',
    assignee: '',
    color: COLOR_PRESETS[0],
  }
}

export function formFromRow(row: ScheduleRow): ScheduleFormDraft {
  return {
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? '기타',
    startDate: row.startDate,
    endDate: row.endDate ?? row.startDate,
    allDay: row.allDay,
    startTime: row.startTime ?? '09:00',
    endTime: row.endTime ?? '10:00',
    status: row.status,
    priority: row.priority,
    assignee: row.assignee ?? '',
    color: row.color ?? COLOR_PRESETS[0],
  }
}
