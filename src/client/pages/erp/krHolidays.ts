/** 한국 공휴일 (양력 고정 + 연도별 대표 음력 연휴). yyyy-mm-dd → 이름 */
const KR_HOLIDAYS: Record<string, string> = {
  // 공통 고정
  '2025-01-01': '신정',
  '2025-03-01': '삼일절',
  '2025-05-05': '어린이날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',
  '2025-01-28': '설날',
  '2025-01-29': '설날',
  '2025-01-30': '설날',
  '2025-10-05': '추석',
  '2025-10-06': '추석',
  '2025-10-07': '추석',
  '2025-10-08': '추석',

  '2026-01-01': '신정',
  '2026-02-16': '설날',
  '2026-02-17': '설날',
  '2026-02-18': '설날',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절',
  '2026-09-24': '추석',
  '2026-09-25': '추석',
  '2026-09-26': '추석',
  '2026-10-03': '개천절',
  '2026-10-05': '개천절',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',

  '2027-01-01': '신정',
  '2027-02-06': '설날',
  '2027-02-07': '설날',
  '2027-02-08': '설날',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '광복절',
  '2027-09-14': '추석',
  '2027-09-15': '추석',
  '2027-09-16': '추석',
  '2027-10-03': '개천절',
  '2027-10-04': '개천절',
  '2027-10-09': '한글날',
  '2027-10-11': '한글날',
  '2027-12-25': '성탄절',
}

export function getKrHolidayName(ymd: string): string | null {
  return KR_HOLIDAYS[ymd] ?? null
}

export function isKrHoliday(ymd: string): boolean {
  return ymd in KR_HOLIDAYS
}

export type CalendarDayMeta = {
  ymd: string
  dow: number
  isSunday: boolean
  isSaturday: boolean
  holidayName: string | null
  isHoliday: boolean
}

export function getCalendarDayMeta(year: number, month: number, day: number): CalendarDayMeta {
  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const dow = new Date(year, month - 1, day).getDay()
  const holidayName = getKrHolidayName(ymd)
  return {
    ymd,
    dow,
    isSunday: dow === 0,
    isSaturday: dow === 6,
    holidayName,
    isHoliday: holidayName != null,
  }
}
