const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** KST 기준 날짜 문자열 YYYY-MM-DD */
export function kstDateString(d = new Date()): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** 연동규격서: YYYY-MM-DD HH:MI:SS.SSS (24시간, 밀리초) */
export function formatLogDt(d = new Date()): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const mi = String(kst.getUTCMinutes()).padStart(2, '0')
  const s = String(kst.getUTCSeconds()).padStart(2, '0')
  const ms = String(kst.getUTCMilliseconds()).padStart(3, '0')
  return `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`
}

/** KST 당일 00:00 ~ 익일 00:00 (UTC 저장용) */
export function kstDayBounds(dateStr = kstDateString()): { start: Date; end: Date } {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const startUtcMs = Date.UTC(y!, mo! - 1, d!, 0, 0, 0, 0) - KST_OFFSET_MS
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) }
}

export function estimateByteSize(body: unknown, responseBody?: unknown): number {
  let n = 0
  try {
    if (body != null) n += Buffer.byteLength(JSON.stringify(body), 'utf8')
    if (responseBody != null) n += Buffer.byteLength(JSON.stringify(responseBody), 'utf8')
  } catch {
    /* ignore */
  }
  return Math.min(n, 999_999_999)
}
