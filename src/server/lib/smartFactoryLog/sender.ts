import { prisma } from '../../db/prisma'
import {
  MAX_REQUEST_PER_DAY,
  MAX_SUCCESS_PER_DAY,
  MIN_SEND_INTERVAL_MS,
  SMART_FACTORY_LOG_URL,
  SUCCESS_RESULT_CODE,
  TEST_RESULT_CODE,
  USE_SE,
  USE_SE_PRIORITY,
  isSmartFactoryTestMode,
  type UseSeCode,
} from './constants'
import { formatLogDt, kstDateString, kstDayBounds } from './format'

export type EnqueueSmartFactoryLogInput = {
  useSe: UseSeCode
  sysUser: string
  conectIp: string
  dataUsgqty?: number
  logDt?: Date
  httpMethod?: string
  apiPath?: string
}

function isEnabled(): boolean {
  return process.env.SMART_FACTORY_LOG_ENABLED === 'true'
}

function getCrtfcKey(): string | null {
  const key = process.env.SMART_FACTORY_LOG_KEY?.trim()
  return key || null
}

function trimSysUser(raw: string): string {
  return raw.trim().slice(0, 60) || 'SYSTEM'
}

function trimIp(raw: string): string {
  return raw.trim().slice(0, 30) || '0.0.0.0'
}

async function getSenderState() {
  return prisma.smartFactoryLogSenderState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
}

async function resetDailyCountersIfNeeded(state: {
  requestCountDate: string | null
  requestCount: number
  successCountDate: string | null
  successCount: number
}) {
  const today = kstDateString()
  const patch: {
    requestCountDate?: string
    requestCount?: number
    successCountDate?: string
    successCount?: number
  } = {}

  if (state.requestCountDate !== today) {
    patch.requestCountDate = today
    patch.requestCount = 0
  }
  if (state.successCountDate !== today) {
    patch.successCountDate = today
    patch.successCount = 0
  }

  if (Object.keys(patch).length > 0) {
    return prisma.smartFactoryLogSenderState.update({
      where: { id: 1 },
      data: patch,
    })
  }
  return prisma.smartFactoryLogSenderState.findUniqueOrThrow({ where: { id: 1 } })
}

export async function enqueueSmartFactoryLog(input: EnqueueSmartFactoryLogInput): Promise<void> {
  if (!isEnabled()) return

  const sysUser = trimSysUser(input.sysUser)
  const conectIp = trimIp(input.conectIp)
  const dataUsgqty = Math.max(0, Math.min(input.dataUsgqty ?? 0, 999_999_999))
  const logDt = input.logDt ?? new Date()
  const useSe = isSmartFactoryTestMode() ? USE_SE.TEST : input.useSe
  const priority = USE_SE_PRIORITY[useSe] ?? 50

  await prisma.smartFactoryLogOutbox.create({
    data: {
      useSe,
      sysUser,
      conectIp,
      dataUsgqty,
      logDt,
      priority,
      httpMethod: input.httpMethod,
      apiPath: input.apiPath,
      status: 'PENDING',
    },
  })
}

type SendPayload = {
  crtfcKey: string
  logDt: string
  useSe: string
  sysUser: string
  conectIp: string
  dataUsgqty: number
}

type SendResult = {
  recptnRsltCd?: string
  recptnRslt?: string
  recptnRsltDtl?: string
  recptnDt?: string
}

async function postLog(payload: SendPayload): Promise<SendResult> {
  const res = await fetch(SMART_FACTORY_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })

  const text = await res.text()
  let json: { result?: SendResult } | null = null
  try {
    json = JSON.parse(text) as { result?: SendResult }
  } catch {
    throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`)
  }

  return json?.result ?? {}
}

export async function flushSmartFactoryLogQueue(): Promise<{ sent: boolean; reason?: string }> {
  if (!isEnabled()) return { sent: false, reason: 'disabled' }

  const crtfcKey = getCrtfcKey()
  if (!crtfcKey) return { sent: false, reason: 'no_key' }

  let state = await getSenderState()
  state = await resetDailyCountersIfNeeded(state)

  if (state.requestCount >= MAX_REQUEST_PER_DAY) {
    return { sent: false, reason: 'request_limit' }
  }
  if (state.successCount >= MAX_SUCCESS_PER_DAY) {
    return { sent: false, reason: 'success_limit' }
  }

  if (state.lastSentAt) {
    const elapsed = Date.now() - state.lastSentAt.getTime()
    if (elapsed < MIN_SEND_INTERVAL_MS) {
      return { sent: false, reason: 'interval' }
    }
  }

  const { start, end } = kstDayBounds()
  const row = await prisma.smartFactoryLogOutbox.findFirst({
    where: {
      status: 'PENDING',
      logDt: { gte: start, lt: end },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  if (!row) return { sent: false, reason: 'empty' }

  const payload: SendPayload = {
    crtfcKey,
    logDt: formatLogDt(row.logDt),
    useSe: isSmartFactoryTestMode() ? USE_SE.TEST : row.useSe,
    sysUser: row.sysUser,
    conectIp: row.conectIp,
    dataUsgqty: row.dataUsgqty,
  }

  const now = new Date()
  let result: SendResult = {}
  let status = 'FAILED'

  try {
    result = await postLog(payload)
    const code = result.recptnRsltCd ?? ''
    const okCodes = isSmartFactoryTestMode()
      ? [TEST_RESULT_CODE, 'AP1001', 'AP1029']
      : [SUCCESS_RESULT_CODE, 'AP1001', 'AP1028', 'AP1029']
    status = okCodes.includes(code) ? 'SENT' : 'FAILED'
  } catch (e) {
    result = {
      recptnRsltCd: 'LOCAL_ERR',
      recptnRslt: '전송 예외',
      recptnRsltDtl: e instanceof Error ? e.message : String(e),
    }
    status = 'FAILED'
  }

  const isSuccess = status === 'SENT'

  await prisma.$transaction([
    prisma.smartFactoryLogOutbox.update({
      where: { id: row.id },
      data: {
        status,
        sentAt: now,
        recptnRsltCd: result.recptnRsltCd ?? null,
        recptnRslt: result.recptnRslt ?? null,
        recptnRsltDtl: result.recptnRsltDtl ?? null,
      },
    }),
    prisma.smartFactoryLogSenderState.update({
      where: { id: 1 },
      data: {
        lastSentAt: now,
        requestCount: { increment: 1 },
        ...(isSuccess ? { successCount: { increment: 1 } } : {}),
      },
    }),
  ])

  return { sent: true, reason: result.recptnRsltCd }
}

let flushTimer: ReturnType<typeof setInterval> | null = null

export function startSmartFactoryLogFlusher(intervalMs = 60_000): void {
  if (flushTimer) return
  flushTimer = setInterval(() => {
    void flushSmartFactoryLogQueue().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[smart-factory-log] flush error', e)
    })
  }, intervalMs)
  flushTimer.unref?.()
}

export async function getSmartFactoryLogStatus() {
  const state = await getSenderState()
  const pending = await prisma.smartFactoryLogOutbox.count({ where: { status: 'PENDING' } })
  const sentToday = await prisma.smartFactoryLogOutbox.count({
    where: {
      status: 'SENT',
      sentAt: { gte: kstDayBounds().start, lt: kstDayBounds().end },
    },
  })
  return {
    enabled: isEnabled(),
    testMode: isSmartFactoryTestMode(),
    hasKey: !!getCrtfcKey(),
    pending,
    sentToday,
    requestCount: state.requestCount,
    successCount: state.successCount,
    lastSentAt: state.lastSentAt,
  }
}
