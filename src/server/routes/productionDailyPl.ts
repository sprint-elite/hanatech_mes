import { Router } from 'express'
import { z } from 'zod'
import { prismaFail } from '../lib/prismaError'
import {
  computeDailyProductionPl,
  computeDailyProductionPlTrend,
  todayKstYmd,
} from '../lib/productionDailyPl'

const dateQuery = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()

export const productionDailyPlRouter = Router()

productionDailyPlRouter.get('/production-daily-pl/trend', async (req, res) => {
  const fromParsed = dateQuery.safeParse(typeof req.query.from === 'string' ? req.query.from : undefined)
  const toParsed = dateQuery.safeParse(typeof req.query.to === 'string' ? req.query.to : undefined)
  if (!fromParsed.success || !toParsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_DATE',
      message: 'from, to는 YYYY-MM-DD 형식이어야 합니다.',
    })
  }
  const today = todayKstYmd()
  const from = fromParsed.data ?? today
  const to = toParsed.data ?? today
  const start = from <= to ? from : to
  const end = from <= to ? to : from
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const daySpan = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000) + 1
  if (daySpan > 90) {
    return res.status(400).json({
      ok: false,
      error: 'RANGE_TOO_LARGE',
      message: '조회 기간은 최대 90일입니다.',
    })
  }
  try {
    const days = await computeDailyProductionPlTrend(start, end)
    return res.json({ ok: true, from: start, to: end, days })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionDailyPlRouter.get('/production-daily-pl', async (req, res) => {
  const parsed = dateQuery.safeParse(typeof req.query.date === 'string' ? req.query.date : undefined)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_DATE', message: 'date는 YYYY-MM-DD 형식이어야 합니다.' })
  }
  const dateYmd = parsed.data ?? todayKstYmd()
  try {
    const result = await computeDailyProductionPl(dateYmd)
    return res.json({ ok: true, ...result })
  } catch (e) {
    return prismaFail(res, e)
  }
})
