import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import { canApproveLeave, getRequestUser } from '../lib/requestUser'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeStr = z.string().regex(/^\d{2}:\d{2}$/)

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

function canManageSchedules(roleName: string) {
  return canApproveLeave(roleName)
}

const listSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  startDate: true,
  endDate: true,
  allDay: true,
  startTime: true,
  endTime: true,
  status: true,
  priority: true,
  assignee: true,
  color: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { userName: true } },
} as const

function serializeSchedule(row: {
  id: number
  title: string
  description: string | null
  category: string | null
  startDate: Date
  endDate: Date | null
  allDay: boolean
  startTime: string | null
  endTime: string | null
  status: string
  priority: string
  assignee: string | null
  color: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  createdBy: { userName: string }
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    startDate: ymd(row.startDate),
    endDate: row.endDate ? ymd(row.endDate) : null,
    allDay: row.allDay,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    color: row.color,
    sortOrder: row.sortOrder,
    createdByName: row.createdBy.userName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const createBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().max(64).optional().nullable(),
  startDate: dateStr,
  endDate: dateStr.optional().nullable(),
  allDay: z.boolean().optional(),
  startTime: timeStr.optional().nullable(),
  endTime: timeStr.optional().nullable(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'HOLD']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  assignee: z.string().trim().max(64).optional().nullable(),
  color: z.string().trim().max(16).optional().nullable(),
})

const updateBody = createBody.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
})

export const erpSchedulesRouter = Router()

erpSchedulesRouter.get('/erp-schedules', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const yearParsed = z.coerce.number().int().safeParse(req.query.year)
  const monthParsed = z.coerce.number().int().min(1).max(12).safeParse(req.query.month)

  try {
    const where: Record<string, unknown> = {}

    if (yearParsed.success && monthParsed.success) {
      const { start, end } = monthRange(yearParsed.data, monthParsed.data)
      where.AND = [
        { startDate: { lte: end } },
        {
          OR: [
            { endDate: { gte: start } },
            { endDate: null, startDate: { gte: start, lte: end } },
          ],
        },
      ]
    }

    const items = await prisma.erpSchedule.findMany({
      where,
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
      select: listSelect,
    })

    return res.json({
      ok: true,
      items: items.map(serializeSchedule),
      canManage: canManageSchedules(user.roleName),
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})

erpSchedulesRouter.post('/erp-schedules', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canManageSchedules(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const parsed = createBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' })
  }

  const b = parsed.data
  const endDate = b.endDate ?? b.startDate
  if (parseYmd(endDate).getTime() < parseYmd(b.startDate).getTime()) {
    return res.status(400).json({ ok: false, error: 'INVALID_DATE_RANGE' })
  }

  try {
    const maxSort = await prisma.erpSchedule.aggregate({
      where: { status: b.status ?? 'PLANNED' },
      _max: { sortOrder: true },
    })

    const item = await prisma.erpSchedule.create({
      data: {
        title: b.title,
        description: b.description ?? null,
        category: b.category ?? null,
        startDate: parseYmd(b.startDate),
        endDate: parseYmd(endDate),
        allDay: b.allDay ?? true,
        startTime: b.allDay === false ? (b.startTime ?? null) : null,
        endTime: b.allDay === false ? (b.endTime ?? null) : null,
        status: b.status ?? 'PLANNED',
        priority: b.priority ?? 'NORMAL',
        assignee: b.assignee ?? null,
        color: b.color ?? null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        createdById: user.id,
      },
      select: listSelect,
    })

    return res.status(201).json({ ok: true, item: serializeSchedule(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

erpSchedulesRouter.patch('/erp-schedules/:id', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canManageSchedules(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  const parsed = updateBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' })
  }

  try {
    const existing = await prisma.erpSchedule.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const b = parsed.data
    const startDate = b.startDate ?? ymd(existing.startDate)
    const endDate = b.endDate ?? (existing.endDate ? ymd(existing.endDate) : startDate)
    if (parseYmd(endDate).getTime() < parseYmd(startDate).getTime()) {
      return res.status(400).json({ ok: false, error: 'INVALID_DATE_RANGE' })
    }

    const nextStatus = b.status ?? existing.status
    let sortOrder = b.sortOrder
    if (b.status && b.status !== existing.status && sortOrder == null) {
      const maxSort = await prisma.erpSchedule.aggregate({
        where: { status: b.status },
        _max: { sortOrder: true },
      })
      sortOrder = (maxSort._max.sortOrder ?? -1) + 1
    }

    const allDay = b.allDay ?? existing.allDay

    const item = await prisma.erpSchedule.update({
      where: { id },
      data: {
        title: b.title,
        description: b.description,
        category: b.category,
        startDate: b.startDate ? parseYmd(b.startDate) : undefined,
        endDate: b.endDate !== undefined || b.startDate
          ? parseYmd(endDate)
          : undefined,
        allDay,
        startTime: allDay ? null : (b.startTime !== undefined ? b.startTime : existing.startTime),
        endTime: allDay ? null : (b.endTime !== undefined ? b.endTime : existing.endTime),
        status: nextStatus,
        priority: b.priority,
        assignee: b.assignee,
        color: b.color,
        sortOrder: sortOrder ?? undefined,
      },
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeSchedule(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

erpSchedulesRouter.delete('/erp-schedules/:id', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canManageSchedules(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    await prisma.erpSchedule.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
