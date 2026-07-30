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

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

const lineBody = z.object({
  vendor: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(500),
  amount: z.number().int().positive(),
})

const createBody = z.object({
  reportDate: dateStr,
  receiptDataUrl: z.string().max(6_000_000).optional().nullable(),
  lines: z.array(lineBody).min(1).max(50),
})

const rejectBody = z.object({
  rejectReason: z.string().trim().max(500).optional(),
})

const listSelect = {
  id: true,
  userId: true,
  reportDate: true,
  totalAmount: true,
  receiptDataUrl: true,
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
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      vendor: true,
      description: true,
      amount: true,
      sortOrder: true,
    },
  },
} as const

type ListRow = {
  id: number
  userId: number
  reportDate: Date
  totalAmount: number
  receiptDataUrl: string | null
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
  lines: { id: number; vendor: string; description: string; amount: number; sortOrder: number }[]
}

function serializeReport(row: ListRow, includeReceipt = false) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.userName,
    dept: row.user.worker?.team ?? '—',
    position: row.user.worker?.position ?? '—',
    reportDate: ymd(row.reportDate),
    totalAmount: row.totalAmount,
    receiptDataUrl: includeReceipt ? row.receiptDataUrl : row.receiptDataUrl ? 'attached' : null,
    status: row.status,
    managerDecision: row.managerDecision,
    ceoDecision: row.ceoDecision,
    managerAt: row.managerAt?.toISOString() ?? null,
    ceoAt: row.ceoAt?.toISOString() ?? null,
    managerByName: row.managerBy?.userName ?? null,
    ceoByName: row.ceoBy?.userName ?? null,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt.toISOString(),
    lines: row.lines.map((l) => ({
      id: l.id,
      vendor: l.vendor,
      description: l.description,
      amount: l.amount,
      sortOrder: l.sortOrder,
    })),
  }
}

function calcRequestStatus(managerDecision: string, ceoDecision: string): 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (managerDecision === 'REJECTED' || ceoDecision === 'REJECTED') return 'REJECTED'
  if (managerDecision === 'APPROVED' && ceoDecision === 'APPROVED') return 'APPROVED'
  return 'PENDING'
}

export const expenseReportsRouter = Router()

expenseReportsRouter.get('/expense-reports', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const yearQ = z.coerce.number().int().optional().safeParse(req.query.year)
  const statusQ = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL']).optional().safeParse(req.query.status)
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  try {
    const where: Record<string, unknown> = {
      user: { is: {} },
    }
    if (!canViewAllLeave(user.roleName)) {
      where.userId = user.id
    }
    if (yearQ.success && yearQ.data) {
      where.reportDate = {
        gte: new Date(Date.UTC(yearQ.data, 0, 1)),
        lte: new Date(Date.UTC(yearQ.data, 11, 31)),
      }
    }
    if (statusQ.success && statusQ.data && statusQ.data !== 'ALL') {
      where.status = statusQ.data
    }

    let items = await prisma.expenseReport.findMany({
      where,
      orderBy: [{ reportDate: 'desc' }, { id: 'desc' }],
      select: listSelect,
    })

    if (qRaw) {
      const q = qRaw.toLowerCase()
      items = items.filter((r) => {
        const lineHay = r.lines.map((l) => `${l.vendor} ${l.description}`).join(' ')
        const hay = `${r.user.userName} ${ymd(r.reportDate)} ${lineHay}`.toLowerCase()
        return hay.includes(q)
      })
    }

    const pendingCount = canViewAllLeave(user.roleName)
      ? await prisma.expenseReport.count({ where: { status: 'PENDING' } })
      : 0

    return res.json({
      ok: true,
      items: items.map((r) => serializeReport(r)),
      pendingCount,
      viewerRole: user.roleName,
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})

expenseReportsRouter.get('/expense-reports/:id', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const row = await prisma.expenseReport.findUnique({
      where: { id },
      select: listSelect,
    })
    if (!row) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (!canViewAllLeave(user.roleName) && row.userId !== user.id) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }
    return res.json({ ok: true, item: serializeReport(row, true) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

expenseReportsRouter.post('/expense-reports', async (req, res) => {
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
  const totalAmount = b.lines.reduce((s, l) => s + l.amount, 0)

  try {
    const item = await prisma.expenseReport.create({
      data: {
        userId: user.id,
        reportDate: parseYmd(b.reportDate),
        totalAmount,
        receiptDataUrl: b.receiptDataUrl ?? undefined,
        lines: {
          create: b.lines.map((l, i) => ({
            vendor: l.vendor,
            description: l.description,
            amount: l.amount,
            sortOrder: i,
          })),
        },
      },
      select: listSelect,
    })

    return res.status(201).json({ ok: true, item: serializeReport(item, true) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

expenseReportsRouter.patch('/expense-reports/:id/approve', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.expenseReport.findUnique({ where: { id } })
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

    const item = await prisma.expenseReport.update({
      where: { id },
      data,
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeReport(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

expenseReportsRouter.patch('/expense-reports/:id/reject', async (req, res) => {
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
    const existing = await prisma.expenseReport.findUnique({ where: { id } })
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

    const item = await prisma.expenseReport.update({
      where: { id },
      data,
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeReport(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

expenseReportsRouter.patch('/expense-reports/:id/cancel-approval', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.expenseReport.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (existing.status === 'CANCELLED' || existing.status === 'REJECTED') {
      return res.status(400).json({ ok: false, error: 'CANNOT_CANCEL_APPROVAL' })
    }

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

    const item = await prisma.expenseReport.update({
      where: { id },
      data,
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeReport(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

expenseReportsRouter.patch('/expense-reports/:id/cancel-rejection', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
  if (!canApproveLeave(user.roleName)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.expenseReport.findUnique({ where: { id } })
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

    const item = await prisma.expenseReport.update({
      where: { id },
      data,
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeReport(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

expenseReportsRouter.patch('/expense-reports/:id/cancel', async (req, res) => {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })

  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const existing = await prisma.expenseReport.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    if (existing.userId !== user.id && !canApproveLeave(user.roleName)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: 'NOT_PENDING' })
    }

    const item = await prisma.expenseReport.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: listSelect,
    })

    return res.json({ ok: true, item: serializeReport(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})
