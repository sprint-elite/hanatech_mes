import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import { canApproveLeave, getRequestUser } from '../lib/requestUser'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeStr = z.string().regex(/^\d{2}:\d{2}$/)
const workLogStatus = z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'HOLD'])

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  return { start, end }
}

function canViewAllWorkLogs(roleName: string) {
  return canApproveLeave(roleName)
}

function canEditWorkLog(userId: number, ownerId: number, roleName: string) {
  return userId === ownerId || canViewAllWorkLogs(roleName)
}

const listSelect = {
  id: true,
  userId: true,
  workDate: true,
  workTime: true,
  title: true,
  content: true,
  category: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { userName: true, loginId: true } },
} as const

function serializeWorkLog(row: {
  id: number
  userId: number
  workDate: Date
  workTime: string | null
  title: string
  content: string | null
  category: string | null
  status: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  user: { userName: string; loginId: string }
}) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.userName,
    loginId: row.user.loginId,
    workDate: ymd(row.workDate),
    workTime: row.workTime,
    title: row.title,
    content: row.content,
    category: row.category,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const createBody = z.object({
  workDate: dateStr,
  workTime: timeStr,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().max(5000).optional().nullable(),
  category: z.string().trim().max(64).optional().nullable(),
  status: workLogStatus.optional(),
  userId: z.number().int().positive().optional(),
})

const updateBody = createBody.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
})

export const erpWorkLogsRouter = Router()

erpWorkLogsRouter.get('/erp-work-logs', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const yearParsed = z.coerce.number().int().safeParse(req.query.year)
  const monthParsed = z.coerce.number().int().min(1).max(12).safeParse(req.query.month)
  const userIdParsed = z.coerce.number().int().positive().safeParse(req.query.userId)

  try {
    const viewAll = canViewAllWorkLogs(user.roleName)
    const where: Record<string, unknown> = {}

    if (!viewAll) {
      where.userId = user.id
    } else if (userIdParsed.success) {
      where.userId = userIdParsed.data
    }

    if (yearParsed.success && monthParsed.success) {
      const { start, end } = monthRange(yearParsed.data, monthParsed.data)
      where.workDate = { gte: start, lte: end }
    }

    const [items, users] = await Promise.all([
      prisma.erpWorkLog.findMany({
        where,
        orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { workDate: 'desc' }, { id: 'desc' }],
        select: listSelect,
      }),
      viewAll
        ? prisma.user.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, userName: true, loginId: true },
            orderBy: { userName: 'asc' },
          })
        : Promise.resolve([]),
    ])

    return res.json({
      ok: true,
      items: items.map(serializeWorkLog),
      canViewAll: viewAll,
      users,
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})

erpWorkLogsRouter.post('/erp-work-logs', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const parsed = createBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' })
  }

  const b = parsed.data
  const ownerId = b.userId ?? user.id
  if (ownerId !== user.id && !canViewAllWorkLogs(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  try {
    const status = b.status ?? 'PLANNED'
    const maxSort = await prisma.erpWorkLog.aggregate({
      where: { status, userId: ownerId },
      _max: { sortOrder: true },
    })

    const item = await prisma.erpWorkLog.create({
      data: {
        userId: ownerId,
        workDate: parseYmd(b.workDate),
        workTime: b.workTime,
        title: b.title,
        content: b.content ?? null,
        category: b.category ?? null,
        status,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      select: listSelect,
    })

    return res.status(201).json({ ok: true, item: serializeWorkLog(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

erpWorkLogsRouter.patch('/erp-work-logs/:id', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  const parsed = updateBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' })
  }

  try {
    const existing = await prisma.erpWorkLog.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (!canEditWorkLog(user.id, existing.userId, user.roleName)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const b = parsed.data
    if (b.userId != null && b.userId !== existing.userId && !canViewAllWorkLogs(user.roleName)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const nextStatus = b.status ?? existing.status
    let sortOrder = b.sortOrder
    if (b.status && b.status !== existing.status && sortOrder == null) {
      const maxSort = await prisma.erpWorkLog.aggregate({
        where: { status: b.status, userId: existing.userId },
        _max: { sortOrder: true },
      })
      sortOrder = (maxSort._max.sortOrder ?? -1) + 1
    }

    const item = await prisma.erpWorkLog.update({
      where: { id },
      data: {
        userId: b.userId,
        workDate: b.workDate ? parseYmd(b.workDate) : undefined,
        workTime: b.workTime,
        title: b.title,
        content: b.content,
        category: b.category,
        status: nextStatus,
        sortOrder: sortOrder ?? undefined,
      },
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeWorkLog(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

erpWorkLogsRouter.delete('/erp-work-logs/:id', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.erpWorkLog.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (!canEditWorkLog(user.id, existing.userId, user.roleName)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    await prisma.erpWorkLog.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
