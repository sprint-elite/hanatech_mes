import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import { canManagePayStubs, getRequestUser, type RequestUser } from '../lib/requestUser'

const yearMonthStr = z.string().regex(/^\d{4}-\d{2}$/)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

function dec(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0
  return Number(v.toString())
}

function decOrNull(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null
  return Number(v.toString())
}

const lineInput = z.object({
  label: z.string().trim().min(1).max(64),
  amount: z.number().int().min(0),
})

const stubInput = z.object({
  userId: z.number().int().positive(),
  dept: z.string().trim().max(64).optional().nullable(),
  position: z.string().trim().max(64).optional().nullable(),
  workDays: z.number().min(0).max(31).optional().nullable(),
  remark: z.string().trim().max(500).optional().nullable(),
  earnings: z.array(lineInput).default([]),
  deductions: z.array(lineInput).default([]),
})

const userSelect = {
  id: true,
  userName: true,
  worker: { select: { team: true, position: true, hireDate: true } },
} as const

function calcTotals(earnings: { amount: number }[], deductions: { amount: number }[]) {
  const totalEarning = earnings.reduce((s, l) => s + l.amount, 0)
  const totalDeduction = deductions.reduce((s, l) => s + l.amount, 0)
  return { totalEarning, totalDeduction, netPay: totalEarning - totalDeduction }
}

function serializeLine(row: {
  id: number
  lineType: string
  label: string
  amount: { toString(): string }
  sortOrder: number
}) {
  return {
    id: row.id,
    lineType: row.lineType,
    label: row.label,
    amount: dec(row.amount),
    sortOrder: row.sortOrder,
  }
}

function serializeStub(row: {
  id: number
  runId: number
  userId: number
  dept: string | null
  position: string | null
  workDays: { toString(): string } | null
  totalEarning: { toString(): string }
  totalDeduction: { toString(): string }
  netPay: { toString(): string }
  remark: string | null
  createdAt: Date
  updatedAt: Date
  user: { id: number; userName: string; worker: { team: string | null; position: string | null; hireDate: Date | null } | null }
  lines?: Array<{
    id: number
    lineType: string
    label: string
    amount: { toString(): string }
    sortOrder: number
  }>
  run?: { id: number; yearMonth: string; title: string | null; payDate: Date | null; status: string; publishedAt: Date | null }
}) {
  const earnings = (row.lines ?? []).filter((l) => l.lineType === 'EARNING').map(serializeLine)
  const deductions = (row.lines ?? []).filter((l) => l.lineType === 'DEDUCTION').map(serializeLine)
  return {
    id: row.id,
    runId: row.runId,
    userId: row.userId,
    userName: row.user.userName,
    dept: row.dept ?? row.user.worker?.team ?? '—',
    position: row.position ?? row.user.worker?.position ?? '—',
    hireDate: row.user.worker?.hireDate ? ymd(row.user.worker.hireDate) : null,
    workDays: decOrNull(row.workDays),
    totalEarning: dec(row.totalEarning),
    totalDeduction: dec(row.totalDeduction),
    netPay: dec(row.netPay),
    remark: row.remark,
    earnings,
    deductions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    run: row.run
      ? {
          id: row.run.id,
          yearMonth: row.run.yearMonth,
          title: row.run.title,
          payDate: row.run.payDate ? ymd(row.run.payDate) : null,
          status: row.run.status,
          publishedAt: row.run.publishedAt?.toISOString() ?? null,
        }
      : undefined,
  }
}

function serializeRun(row: {
  id: number
  yearMonth: string
  title: string | null
  payDate: Date | null
  status: string
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: { userName: string }
  _count?: { payStubs: number }
}) {
  return {
    id: row.id,
    yearMonth: row.yearMonth,
    title: row.title,
    payDate: row.payDate ? ymd(row.payDate) : null,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    stubCount: row._count?.payStubs ?? 0,
    createdByName: row.createdBy.userName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadUserDefaults(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  })
  if (!user) return null
  return {
    userId: user.id,
    userName: user.userName,
    dept: user.worker?.team ?? '',
    position: user.worker?.position ?? '',
    hireDate: user.worker?.hireDate ? ymd(user.worker.hireDate) : null,
  }
}

async function assertCanViewStub(
  stub: { userId: number; run: { status: string } },
  userId: number,
  roleName: string,
) {
  if (canManagePayStubs(roleName)) return
  if (stub.run.status !== 'PUBLISHED') throw Object.assign(new Error('forbidden'), { status: 403 })
  if (stub.userId !== userId) throw Object.assign(new Error('forbidden'), { status: 403 })
}

export const payStubsRouter = Router()

async function requireUser(req: Request, res: Response): Promise<RequestUser | null> {
  const me = await getRequestUser(req)
  if (!me) {
    res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
    return null
  }
  return me
}

payStubsRouter.get('/pay-stubs/users-options', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: userSelect,
      orderBy: { userName: 'asc' },
    })
    res.json({
      ok: true,
      items: users.map((u) => ({
        id: u.id,
        userName: u.userName,
        dept: u.worker?.team ?? '',
        position: u.worker?.position ?? '',
        hireDate: u.worker?.hireDate ? ymd(u.worker.hireDate) : null,
      })),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.get('/pay-stubs/runs', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const manage = canManagePayStubs(me.roleName)

    if (manage) {
      const rows = await prisma.payStubRun.findMany({
        orderBy: { yearMonth: 'desc' },
        include: {
          createdBy: { select: { userName: true } },
          _count: { select: { payStubs: true } },
        },
      })
      res.json({ ok: true, canManage: true, items: rows.map(serializeRun) })
      return
    }

    const rows = await prisma.payStubRun.findMany({
      where: {
        status: 'PUBLISHED',
        payStubs: { some: { userId: me.id } },
      },
      orderBy: { yearMonth: 'desc' },
      include: {
        createdBy: { select: { userName: true } },
        _count: { select: { payStubs: true } },
      },
    })
    res.json({ ok: true, canManage: false, items: rows.map(serializeRun) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.post('/pay-stubs/runs', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = z
      .object({
        yearMonth: yearMonthStr,
        title: z.string().trim().max(100).optional().nullable(),
        payDate: dateStr.optional().nullable(),
      })
      .parse(req.body)

    const row = await prisma.payStubRun.create({
      data: {
        yearMonth: body.yearMonth,
        title: body.title ?? `${body.yearMonth.replace('-', '년 ')}월분`,
        payDate: body.payDate ? parseYmd(body.payDate) : null,
        createdById: me.id,
      },
      include: {
        createdBy: { select: { userName: true } },
        _count: { select: { payStubs: true } },
      },
    })
    res.status(201).json({ ok: true, item: serializeRun(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.patch('/pay-stubs/runs/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const body = z
      .object({
        title: z.string().trim().max(100).optional().nullable(),
        payDate: dateStr.optional().nullable(),
      })
      .parse(req.body)

    const existing = await prisma.payStubRun.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    if (existing.status === 'PUBLISHED') {
      res.status(400).json({ ok: false, error: 'published run cannot be edited' })
      return
    }

    const row = await prisma.payStubRun.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        payDate: body.payDate !== undefined ? (body.payDate ? parseYmd(body.payDate) : null) : undefined,
      },
      include: {
        createdBy: { select: { userName: true } },
        _count: { select: { payStubs: true } },
      },
    })
    res.json({ ok: true, item: serializeRun(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.post('/pay-stubs/runs/:id/publish', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const existing = await prisma.payStubRun.findUnique({
      where: { id },
      include: { _count: { select: { payStubs: true } } },
    })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    if (existing.status === 'PUBLISHED') {
      res.status(400).json({ ok: false, error: 'already published' })
      return
    }
    if (existing._count.payStubs === 0) {
      res.status(400).json({ ok: false, error: 'no pay stubs in run' })
      return
    }

    const row = await prisma.payStubRun.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: {
        createdBy: { select: { userName: true } },
        _count: { select: { payStubs: true } },
      },
    })
    res.json({ ok: true, item: serializeRun(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.delete('/pay-stubs/runs/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const existing = await prisma.payStubRun.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    if (existing.status === 'PUBLISHED') {
      res.status(400).json({ ok: false, error: 'published run cannot be deleted' })
      return
    }
    await prisma.payStubRun.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.get('/pay-stubs/runs/:runId/stubs', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const runId = parsePositiveIntParam(req.params.runId)
    const manage = canManagePayStubs(me.roleName)

    const run = await prisma.payStubRun.findUnique({ where: { id: runId } })
    if (!run) {
      res.status(404).json({ ok: false, error: 'run not found' })
      return
    }
    if (!manage && run.status !== 'PUBLISHED') {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }

    const rows = await prisma.payStub.findMany({
      where: {
        runId,
        ...(manage ? {} : { userId: me.id }),
      },
      include: {
        user: { select: userSelect },
        lines: { orderBy: [{ lineType: 'asc' }, { sortOrder: 'asc' }] },
        run: true,
      },
      orderBy: [{ user: { userName: 'asc' } }],
    })
    res.json({
      ok: true,
      canManage: manage,
      run: serializeRun({
        ...run,
        createdBy: { userName: '' },
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      }),
      items: rows.map(serializeStub),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.get('/pay-stubs/my', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const rows = await prisma.payStub.findMany({
      where: {
        userId: me.id,
        run: { status: 'PUBLISHED' },
      },
      include: {
        user: { select: userSelect },
        lines: { orderBy: [{ lineType: 'asc' }, { sortOrder: 'asc' }] },
        run: true,
      },
      orderBy: [{ run: { yearMonth: 'desc' } }],
    })
    res.json({ ok: true, items: rows.map(serializeStub) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.get('/pay-stubs/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const id = parsePositiveIntParam(req.params.id)
    const row = await prisma.payStub.findUnique({
      where: { id },
      include: {
        user: { select: userSelect },
        lines: { orderBy: [{ lineType: 'asc' }, { sortOrder: 'asc' }] },
        run: true,
      },
    })
    if (!row) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    await assertCanViewStub(row, me.id, me.roleName)
    res.json({ ok: true, item: serializeStub(row) })
  } catch (e) {
    if ((e as { status?: number }).status === 403) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    prismaFail(res, e)
  }
})

payStubsRouter.post('/pay-stubs', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = stubInput.extend({ runId: z.number().int().positive() }).parse(req.body)

    const run = await prisma.payStubRun.findUnique({ where: { id: body.runId } })
    if (!run) {
      res.status(404).json({ ok: false, error: 'run not found' })
      return
    }
    if (run.status === 'PUBLISHED') {
      res.status(400).json({ ok: false, error: 'published run cannot be edited' })
      return
    }

    const defaults = await loadUserDefaults(body.userId)
    if (!defaults) {
      res.status(400).json({ ok: false, error: 'invalid user' })
      return
    }

    const totals = calcTotals(body.earnings, body.deductions)
    const row = await prisma.payStub.create({
      data: {
        runId: body.runId,
        userId: body.userId,
        dept: body.dept?.trim() || defaults.dept || null,
        position: body.position?.trim() || defaults.position || null,
        workDays: body.workDays ?? null,
        totalEarning: totals.totalEarning,
        totalDeduction: totals.totalDeduction,
        netPay: totals.netPay,
        remark: body.remark?.trim() || null,
        lines: {
          create: [
            ...body.earnings.map((l, i) => ({
              lineType: 'EARNING' as const,
              label: l.label,
              amount: l.amount,
              sortOrder: i,
            })),
            ...body.deductions.map((l, i) => ({
              lineType: 'DEDUCTION' as const,
              label: l.label,
              amount: l.amount,
              sortOrder: i,
            })),
          ],
        },
      },
      include: {
        user: { select: userSelect },
        lines: { orderBy: [{ lineType: 'asc' }, { sortOrder: 'asc' }] },
        run: true,
      },
    })
    res.status(201).json({ ok: true, item: serializeStub(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.patch('/pay-stubs/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const body = stubInput.partial().parse(req.body)

    const existing = await prisma.payStub.findUnique({
      where: { id },
      include: { run: true },
    })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    if (existing.run.status === 'PUBLISHED') {
      res.status(400).json({ ok: false, error: 'published run cannot be edited' })
      return
    }

    const earnings = body.earnings
    const deductions = body.deductions
    const totals =
      earnings && deductions
        ? calcTotals(earnings, deductions)
        : null

    const row = await prisma.$transaction(async (tx) => {
      if (earnings && deductions) {
        await tx.payStubLine.deleteMany({ where: { payStubId: id } })
        await tx.payStubLine.createMany({
          data: [
            ...earnings.map((l, i) => ({
              payStubId: id,
              lineType: 'EARNING' as const,
              label: l.label,
              amount: l.amount,
              sortOrder: i,
            })),
            ...deductions.map((l, i) => ({
              payStubId: id,
              lineType: 'DEDUCTION' as const,
              label: l.label,
              amount: l.amount,
              sortOrder: i,
            })),
          ],
        })
      }

      return tx.payStub.update({
        where: { id },
        data: {
          dept: body.dept !== undefined ? (body.dept?.trim() || null) : undefined,
          position: body.position !== undefined ? (body.position?.trim() || null) : undefined,
          workDays: body.workDays !== undefined ? body.workDays : undefined,
          remark: body.remark !== undefined ? (body.remark?.trim() || null) : undefined,
          ...(totals
            ? {
                totalEarning: totals.totalEarning,
                totalDeduction: totals.totalDeduction,
                netPay: totals.netPay,
              }
            : {}),
        },
        include: {
          user: { select: userSelect },
          lines: { orderBy: [{ lineType: 'asc' }, { sortOrder: 'asc' }] },
          run: true,
        },
      })
    })

    res.json({ ok: true, item: serializeStub(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payStubsRouter.delete('/pay-stubs/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const existing = await prisma.payStub.findUnique({
      where: { id },
      include: { run: true },
    })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    if (existing.run.status === 'PUBLISHED') {
      res.status(400).json({ ok: false, error: 'published run cannot be edited' })
      return
    }
    await prisma.payStub.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    prismaFail(res, e)
  }
})
