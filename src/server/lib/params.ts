export function parsePositiveIntParam(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}
