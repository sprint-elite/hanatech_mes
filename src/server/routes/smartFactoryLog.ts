import { Router } from 'express'
import { z } from 'zod'

import { USE_SE } from '../lib/smartFactoryLog/constants'
import {
  enqueueSmartFactoryLog,
  flushSmartFactoryLogQueue,
  getSmartFactoryLogStatus,
} from '../lib/smartFactoryLog/sender'

export const smartFactoryLogRouter = Router()

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim().slice(0, 30)
  }
  return (req.ip ?? '0.0.0.0').slice(0, 30)
}

smartFactoryLogRouter.get('/smart-factory-log/status', async (_req, res) => {
  try {
    const status = await getSmartFactoryLogStatus()
    res.json({ ok: true, ...status })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'error' })
  }
})

smartFactoryLogRouter.post('/smart-factory-log/flush', async (_req, res) => {
  try {
    const result = await flushSmartFactoryLogQueue()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'error' })
  }
})

const eventSchema = z.object({
  sysUser: z.string().trim().min(1).max(60).optional(),
  conectIp: z.string().trim().max(30).optional(),
  dataUsgqty: z.number().int().min(0).optional(),
})

smartFactoryLogRouter.post('/smart-factory-log/login', async (req, res) => {
  try {
    const body = eventSchema.parse(req.body ?? {})
    await enqueueSmartFactoryLog({
      useSe: USE_SE.LOGIN,
      sysUser: body.sysUser ?? 'SYSTEM',
      conectIp: body.conectIp ?? clientIp(req),
      dataUsgqty: body.dataUsgqty ?? 0,
      apiPath: '/auth/login',
      httpMethod: 'POST',
    })
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ ok: false, message: e.issues[0]?.message })
      return
    }
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'error' })
  }
})

smartFactoryLogRouter.post('/smart-factory-log/logout', async (req, res) => {
  try {
    const body = eventSchema.parse(req.body ?? {})
    await enqueueSmartFactoryLog({
      useSe: USE_SE.LOGOUT,
      sysUser: body.sysUser ?? 'SYSTEM',
      conectIp: body.conectIp ?? clientIp(req),
      dataUsgqty: body.dataUsgqty ?? 0,
      apiPath: '/auth/logout',
      httpMethod: 'POST',
    })
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ ok: false, message: e.issues[0]?.message })
      return
    }
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'error' })
  }
})

smartFactoryLogRouter.post('/smart-factory-log/test', async (req, res) => {
  try {
    const body = eventSchema.parse(req.body ?? {})
    await enqueueSmartFactoryLog({
      useSe: USE_SE.TEST,
      sysUser: body.sysUser ?? 'TEST',
      conectIp: body.conectIp ?? clientIp(req),
      dataUsgqty: body.dataUsgqty ?? 0,
      apiPath: '/smart-factory-log/test',
      httpMethod: 'POST',
    })
    const flush = await flushSmartFactoryLogQueue()
    res.json({ ok: true, enqueued: true, flush })
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ ok: false, message: e.issues[0]?.message })
      return
    }
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'error' })
  }
})

smartFactoryLogRouter.get('/smart-factory-log/outbox', async (req, res) => {
  try {
    const { prisma } = await import('../db/prisma')
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const items = await prisma.smartFactoryLogOutbox.findMany({
      orderBy: { id: 'desc' },
      take: limit,
    })
    res.json({ ok: true, items })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'error' })
  }
})
