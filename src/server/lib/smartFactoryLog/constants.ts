/** 스마트공장 로그수집 API 접속 구분 코드 (연동규격서 v1.7) */
export const USE_SE = {
  LOGIN: 'DO6001',
  LOGOUT: 'DO6002',
  READ: 'DO6003',
  CREATE: 'DO6004',
  UPDATE: 'DO6005',
  DELETE: 'DO6006',
  INOUT: 'DO6007',
  TEST: 'DO6999',
} as const

export type UseSeCode = (typeof USE_SE)[keyof typeof USE_SE]

/** 낮을수록 먼저 전송 (일일 성공 한도 144건 대비) */
export const USE_SE_PRIORITY: Record<UseSeCode, number> = {
  DO6999: 5,
  DO6001: 10,
  DO6002: 10,
  DO6006: 20,
  DO6004: 30,
  DO6007: 35,
  DO6005: 40,
  DO6003: 80,
}

export const SMART_FACTORY_LOG_URL =
  process.env.SMART_FACTORY_LOG_URL ?? 'https://log.smart-factory.kr/apisvc/sendLogData.json'

export const MIN_SEND_INTERVAL_MS = 10 * 60 * 1000
export const MAX_SUCCESS_PER_DAY = 144
export const MAX_REQUEST_PER_DAY = 5000

export const SUCCESS_RESULT_CODE = 'AP1002'
export const TEST_RESULT_CODE = 'AP1028'

/** true면 모든 전송 useSe를 DO6999(테스트)로 — 포털 통계 미반영 */
export function isSmartFactoryTestMode(): boolean {
  return process.env.SMART_FACTORY_LOG_TEST_MODE === 'true'
}

const INOUT_PATH_RE =
  /\/(material-lots|shipments|outsourcing|transactions\/|inventory|stock-movements)/i

const SKIP_PATH_RE = /\/(smart-factory-log|health|auth)(\/|$)/i

export function resolveUseSe(method: string, apiPath: string): UseSeCode | null {
  if (SKIP_PATH_RE.test(apiPath)) return null

  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD') return USE_SE.READ
  if (m === 'DELETE') return USE_SE.DELETE
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    if (INOUT_PATH_RE.test(apiPath)) return USE_SE.INOUT
    if (m === 'POST') return USE_SE.CREATE
    return USE_SE.UPDATE
  }
  return null
}
