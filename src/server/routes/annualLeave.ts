import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import {
  canApproveLeave,
  canViewAllLeave,
  getRequestUser,
  isCeoRole,
  isManagerRole,
  isStaffRole,
} from '../lib/requestUser'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

function dec(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null
  return Number(v.toString())
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

function calcInclusiveDays(start: string, end: string): number {
  const s = parseYmd(start).getTime()
  const e = parseYmd(end).getTime()
  if (e < s) return NaN
  return Math.floor((e - s) / 86400000) + 1
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  return { start, end }
}

const listSelect = {
  id: true,
  userId: true,
  startDate: true,
  endDate: true,
  days: true,
  leaveType: true,
  reason: true,
  emergencyContact: true,
  status: true,
  managerDecision: true,
  ceoDecision: true,
  managerAt: true,
  ceoAt: true,
  rejectReason: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      userName: true,
      worker: { select: { team: true, position: true } },
    },
  },
  managerBy: { select: { userName: true } },
  ceoBy: { select: { userName: true } },
} as const

function serializeRequest(row: {
  id: number
  userId: number
  startDate: Date
  endDate: Date
  days: { toString(): string }
  leaveType: string
  reason: string
  emergencyContact: string | null
  status: string
  managerDecision: string
  ceoDecision: string
  managerAt: Date | null
  ceoAt: Date | null
  rejectReason: string | null
  createdAt: Date
  user: { id: number; userName: string; worker: { team: string | null; position: string | null } | null }
  managerBy: { userName: string } | null
  ceoBy: { userName: string } | null
}) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.userName,
    dept: row.user.worker?.team ?? '—',
    position: row.user.worker?.position ?? '—',
    startDate: ymd(row.startDate),
    endDate: ymd(row.endDate),
    days: dec(row.days),
    leaveType: row.leaveType,
    reason: row.reason,
    emergencyContact: row.emergencyContact,
    status: row.status,
    managerDecision: row.managerDecision,
    ceoDecision: row.ceoDecision,
    managerAt: row.managerAt?.toISOString() ?? null,
    ceoAt: row.ceoAt?.toISOString() ?? null,
    managerByName: row.managerBy?.userName ?? null,
    ceoByName: row.ceoBy?.userName ?? null,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt.toISOString(),
  }
}

async function syncUsedDays(userId: number, year: number) {
  const { start, end } = { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) }
  const approved = await prisma.annualLeaveRequest.findMany({
    where: {
      userId,
      status: 'APPROVED',
      startDate: { gte: start, lte: end },
    },
    select: { days: true },
  })
  const used = approved.reduce((sum, r) => sum + Number(r.days.toString()), 0)
  await prisma.annualLeaveBalance.upsert({
    where: { userId_year: { userId, year } },
    create: { userId, year, totalDays: 15, usedDays: used },
    update: { usedDays: used },
  })
}

export const annualLeaveRouter = Router()

annualLeaveRouter.get('/annual-leave/balance', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const yearParsed = z.coerce.number().int().min(2000).max(2100).safeParse(req.query.year)
  const year = yearParsed.success ? yearParsed.data : new Date().getFullYear()

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        userName: true,
        worker: { select: { team: true, position: true } },
      },
    })

    let balance = await prisma.annualLeaveBalance.findUnique({
      where: { userId_year: { userId: user.id, year } },
    })
    if (!balance) {
      balance = await prisma.annualLeaveBalance.create({
        data: { userId: user.id, year, totalDays: 15, usedDays: 0 },
      })
    }
    const total = dec(balance.totalDays) ?? 0
    const used = dec(balance.usedDays) ?? 0
    return res.json({
      ok: true,
      balance: {
        year,
        totalDays: total,
        usedDays: used,
        remainingDays: Math.round((total - used) * 10) / 10,
      },
      applicant: {
        userName: dbUser?.userName ?? user.userName,
        dept: dbUser?.worker?.team ?? '',
        position: dbUser?.worker?.position ?? user.roleName,
      },
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})

annualLeaveRouter.get('/annual-leave/requests', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const yearQ = z.coerce.number().int().optional().safeParse(req.query.year)
  const statusQ = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL']).optional().safeParse(req.query.status)
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  try {
    const where: Record<string, unknown> = {}
    if (!canViewAllLeave(user.roleName)) {
      where.userId = user.id
    }
    if (yearQ.success && yearQ.data) {
      where.startDate = {
        gte: new Date(Date.UTC(yearQ.data, 0, 1)),
        lte: new Date(Date.UTC(yearQ.data, 11, 31)),
      }
    }
    if (statusQ.success && statusQ.data && statusQ.data !== 'ALL') {
      where.status = statusQ.data
    }

    let items = await prisma.annualLeaveRequest.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      select: listSelect,
    })

    if (qRaw) {
      const q = qRaw.toLowerCase()
      items = items.filter((r) => {
        const hay = `${r.user.userName} ${r.reason} ${ymd(r.startDate)} ${ymd(r.endDate)}`.toLowerCase()
        return hay.includes(q)
      })
    }

    return res.json({ ok: true, items: items.map(serializeRequest), viewerRole: user.roleName })
  } catch (e) {
    return prismaFail(res, e)
  }
})

annualLeaveRouter.get('/annual-leave/calendar', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const yearParsed = z.coerce.number().int().safeParse(req.query.year)
  const monthParsed = z.coerce.number().int().min(1).max(12).safeParse(req.query.month)
  if (!yearParsed.success || !monthParsed.success) {
    return res.status(400).json({ ok: false, error: 'year and month required' })
  }

  const { start, end } = monthRange(yearParsed.data, monthParsed.data)

  try {
    const where: Record<string, unknown> = {
      status: { in: ['PENDING', 'APPROVED', 'REJECTED'] },
      startDate: { lte: end },
      endDate: { gte: start },
    }
    if (!canViewAllLeave(user.roleName)) {
      where.userId = user.id
    }

    const rows = await prisma.annualLeaveRequest.findMany({
      where,
      select: listSelect,
    })

    const days: Record<string, ReturnType<typeof serializeRequest>[]> = {}
    for (const row of rows) {
      const item = serializeRequest(row)
      const cur = new Date(row.startDate)
      const last = new Date(row.endDate)
      while (cur <= last) {
        const key = ymd(cur)
        if (key.slice(0, 7) === `${yearParsed.data}-${String(monthParsed.data).padStart(2, '0')}`) {
          if (!days[key]) days[key] = []
          days[key].push(item)
        }
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }

    return res.json({ ok: true, year: yearParsed.data, month: monthParsed.data, days })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const createBody = z.object({
  startDate: dateStr,
  endDate: dateStr,
  days: z.number().finite().positive().optional(),
  leaveType: z.string().trim().min(1).max(32).optional(),
  reason: z.string().trim().min(1).max(500),
  emergencyContact: z.string().trim().max(64).optional().nullable(),
})

annualLeaveRouter.post('/annual-leave/requests', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!isStaffRole(user.roleName) && !canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }

  const b = parsed.data
  const days = b.days ?? calcInclusiveDays(b.startDate, b.endDate)
  if (!Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_DAYS' })
  }

  try {
    const year = Number(b.startDate.slice(0, 4))
    const balance = await prisma.annualLeaveBalance.findUnique({
      where: { userId_year: { userId: user.id, year } },
    })
    const total = dec(balance?.totalDays) ?? 15
    const used = dec(balance?.usedDays) ?? 0
    if (used + days > total) {
      return res.status(400).json({ ok: false, error: 'INSUFFICIENT_BALANCE' })
    }

    const item = await prisma.annualLeaveRequest.create({
      data: {
        userId: user.id,
        startDate: parseYmd(b.startDate),
        endDate: parseYmd(b.endDate),
        days: String(days),
        leaveType: b.leaveType ?? '연차',
        reason: b.reason,
        emergencyContact: b.emergencyContact ?? undefined,
      },
      select: listSelect,
    })

    return res.status(201).json({ ok: true, item: serializeRequest(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const rejectBody = z.object({
  rejectReason: z.string().trim().max(500).optional(),
})

function calcRequestStatus(
  managerDecision: string,
  ceoDecision: string,
): 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (managerDecision === 'REJECTED' || ceoDecision === 'REJECTED') return 'REJECTED'
  if (managerDecision === 'APPROVED' && ceoDecision === 'APPROVED') return 'APPROVED'
  return 'PENDING'
}

annualLeaveRouter.patch('/annual-leave/requests/:id/approve', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.annualLeaveRequest.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: 'NOT_PENDING' })
    }

    const now = new Date()
    const data: Record<string, unknown> = { rejectReason: null }

    if (isManagerRole(user.roleName)) {
      if (existing.managerDecision !== 'PENDING') {
        return res.status(400).json({ ok: false, error: 'ALREADY_DECIDED' })
      }
      data.managerDecision = 'APPROVED'
      data.managerById = user.id
      data.managerAt = now
      data.status = calcRequestStatus('APPROVED', existing.ceoDecision)
    } else if (isCeoRole(user.roleName)) {
      if (existing.ceoDecision !== 'PENDING') {
        return res.status(400).json({ ok: false, error: 'ALREADY_DECIDED' })
      }
      data.ceoDecision = 'APPROVED'
      data.ceoById = user.id
      data.ceoAt = now
      data.status = calcRequestStatus(existing.managerDecision, 'APPROVED')
    } else {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const item = await prisma.annualLeaveRequest.update({
      where: { id },
      data,
      select: listSelect,
    })

    if (data.status === 'APPROVED') {
      await syncUsedDays(existing.userId, existing.startDate.getUTCFullYear())
    }

    return res.json({ ok: true, item: serializeRequest(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

annualLeaveRouter.patch('/annual-leave/requests/:id/reject', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  const parsed = rejectBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR' })
  }

  try {
    const existing = await prisma.annualLeaveRequest.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: 'NOT_PENDING' })
    }

    const now = new Date()
    const data: Record<string, unknown> = {
      status: 'REJECTED',
      rejectReason: parsed.data.rejectReason ?? null,
    }

    if (isManagerRole(user.roleName)) {
      if (existing.managerDecision !== 'PENDING') {
        return res.status(400).json({ ok: false, error: 'ALREADY_DECIDED' })
      }
      data.managerDecision = 'REJECTED'
      data.managerById = user.id
      data.managerAt = now
    } else if (isCeoRole(user.roleName)) {
      if (existing.ceoDecision !== 'PENDING') {
        return res.status(400).json({ ok: false, error: 'ALREADY_DECIDED' })
      }
      data.ceoDecision = 'REJECTED'
      data.ceoById = user.id
      data.ceoAt = now
    } else {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const item = await prisma.annualLeaveRequest.update({
      where: { id },
      data,
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeRequest(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

annualLeaveRouter.patch('/annual-leave/requests/:id/cancel-approval', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.annualLeaveRequest.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (existing.status === 'CANCELLED' || existing.status === 'REJECTED') {
      return res.status(400).json({ ok: false, error: 'CANNOT_CANCEL_APPROVAL' })
    }

    const wasApproved = existing.status === 'APPROVED'
    const data: Record<string, unknown> = {}

    if (isManagerRole(user.roleName)) {
      if (existing.managerDecision !== 'APPROVED') {
        return res.status(400).json({ ok: false, error: 'NOT_APPROVED_BY_YOU' })
      }
      data.managerDecision = 'PENDING'
      data.managerById = null
      data.managerAt = null
    } else if (isCeoRole(user.roleName)) {
      if (existing.ceoDecision !== 'APPROVED') {
        return res.status(400).json({ ok: false, error: 'NOT_APPROVED_BY_YOU' })
      }
      data.ceoDecision = 'PENDING'
      data.ceoById = null
      data.ceoAt = null
    } else {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const nextManager = (data.managerDecision as string | undefined) ?? existing.managerDecision
    const nextCeo = (data.ceoDecision as string | undefined) ?? existing.ceoDecision
    data.status = calcRequestStatus(nextManager, nextCeo)

    const item = await prisma.annualLeaveRequest.update({
      where: { id },
      data,
      select: listSelect,
    })

    if (wasApproved && data.status !== 'APPROVED') {
      await syncUsedDays(existing.userId, existing.startDate.getUTCFullYear())
    }

    return res.json({ ok: true, item: serializeRequest(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

annualLeaveRouter.patch('/annual-leave/requests/:id/cancel-rejection', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.annualLeaveRequest.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (existing.status !== 'REJECTED') {
      return res.status(400).json({ ok: false, error: 'NOT_REJECTED' })
    }

    const data: Record<string, unknown> = {
      status: 'PENDING',
      rejectReason: null,
    }

    if (isManagerRole(user.roleName)) {
      if (existing.managerDecision !== 'REJECTED') {
        return res.status(400).json({ ok: false, error: 'NOT_REJECTED_BY_YOU' })
      }
      data.managerDecision = 'PENDING'
      data.managerById = null
      data.managerAt = null
    } else if (isCeoRole(user.roleName)) {
      if (existing.ceoDecision !== 'REJECTED') {
        return res.status(400).json({ ok: false, error: 'NOT_REJECTED_BY_YOU' })
      }
      data.ceoDecision = 'PENDING'
      data.ceoById = null
      data.ceoAt = null
    } else {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const item = await prisma.annualLeaveRequest.update({
      where: { id },
      data,
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeRequest(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

annualLeaveRouter.patch('/annual-leave/requests/:id/cancel', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.annualLeaveRequest.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (existing.userId !== user.id && !canApproveLeave(user.roleName)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: 'NOT_PENDING' })
    }

    const item = await prisma.annualLeaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeRequest(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})
