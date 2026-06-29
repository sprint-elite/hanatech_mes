import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import { canManagePayStubs, getRequestUser, type RequestUser } from '../lib/requestUser'

const yearMonthStr = z.string().regex(/^\d{4}-\d{2}$/)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const employeeStatus = z.enum(['ACTIVE', 'INACTIVE'])

const userSelect = {
  id: true,
  loginId: true,
  userName: true,
  worker: { select: { team: true, position: true, hireDate: true, workerCode: true } },
} as const

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

const profileBody = z.object({
  userId: z.number().int().positive(),
  employeeNo: z.string().trim().max(20).optional().nullable(),
  dept: z.string().trim().max(64).optional().nullable(),
  position: z.string().trim().max(64).optional().nullable(),
  hireDate: dateStr.optional().nullable(),
  baseSalary: z.number().int().min(0).optional(),
  hourlyWage: z.number().int().min(0).optional().nullable(),
  ordinaryWage: z.number().int().min(0).optional().nullable(),
  paymentDay: z.number().int().min(1).max(31).optional().nullable(),
  bankName: z.string().trim().max(32).optional().nullable(),
  bankAccount: z.string().trim().max(32).optional().nullable(),
  accountHolder: z.string().trim().max(64).optional().nullable(),
  dependants: z.number().int().min(1).max(20).optional(),
  status: employeeStatus.optional(),
  remark: z.string().trim().max(500).optional().nullable(),
})

const workBody = z.object({
  userId: z.number().int().positive(),
  yearMonth: yearMonthStr,
  workDays: z.number().min(0).max(31).optional(),
  paidLeaveDays: z.number().min(0).max(31).optional(),
  unpaidLeaveDays: z.number().min(0).max(31).optional(),
  regularHours: z.number().min(0).max(400).optional(),
  overtimeHours: z.number().min(0).max(200).optional(),
  nightHours: z.number().min(0).max(200).optional(),
  holidayHours: z.number().min(0).max(200).optional(),
  annualLeaveDays: z.number().min(0).max(31).optional(),
  remark: z.string().trim().max(500).optional().nullable(),
})

function serializeProfile(row: {
  id: number
  userId: number
  employeeNo: string | null
  dept: string | null
  position: string | null
  hireDate: Date | null
  baseSalary: { toString(): string }
  hourlyWage: { toString(): string } | null
  ordinaryWage: { toString(): string } | null
  paymentDay: number | null
  bankName: string | null
  bankAccount: string | null
  accountHolder: string | null
  dependants: number
  status: string
  remark: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    loginId: string
    userName: string
    worker: { team: string | null; position: string | null; hireDate: Date | null; workerCode: string } | null
  }
}) {
  return {
    id: row.id,
    userId: row.userId,
    loginId: row.user.loginId,
    userName: row.user.userName,
    workerCode: row.user.worker?.workerCode ?? null,
    employeeNo: row.employeeNo,
    dept: row.dept ?? row.user.worker?.team ?? '',
    position: row.position ?? row.user.worker?.position ?? '',
    hireDate: row.hireDate ? ymd(row.hireDate) : (row.user.worker?.hireDate ? ymd(row.user.worker.hireDate) : null),
    baseSalary: dec(row.baseSalary),
    hourlyWage: decOrNull(row.hourlyWage),
    ordinaryWage: decOrNull(row.ordinaryWage),
    paymentDay: row.paymentDay,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    accountHolder: row.accountHolder,
    dependants: row.dependants,
    status: row.status,
    remark: row.remark,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeWork(row: {
  id: number
  userId: number
  yearMonth: string
  workDays: { toString(): string }
  paidLeaveDays: { toString(): string }
  unpaidLeaveDays: { toString(): string }
  regularHours: { toString(): string }
  overtimeHours: { toString(): string }
  nightHours: { toString(): string }
  holidayHours: { toString(): string }
  annualLeaveDays: { toString(): string }
  remark: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    loginId: string
    userName: string
    worker: { team: string | null; position: string | null } | null
  }
}) {
  return {
    id: row.id,
    userId: row.userId,
    loginId: row.user.loginId,
    userName: row.user.userName,
    dept: row.user.worker?.team ?? '',
    position: row.user.worker?.position ?? '',
    yearMonth: row.yearMonth,
    workDays: dec(row.workDays),
    paidLeaveDays: dec(row.paidLeaveDays),
    unpaidLeaveDays: dec(row.unpaidLeaveDays),
    regularHours: dec(row.regularHours),
    overtimeHours: dec(row.overtimeHours),
    nightHours: dec(row.nightHours),
    holidayHours: dec(row.holidayHours),
    annualLeaveDays: dec(row.annualLeaveDays),
    remark: row.remark,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function requireUser(req: Request, res: Response): Promise<RequestUser | null> {
  const me = await getRequestUser(req)
  if (!me) {
    res.status(401).json({ ok: false, error: 'LOGIN_REQUIRED' })
    return null
  }
  return me
}

const profileInclude = { user: { select: userSelect } } as const
const workInclude = { user: { select: userSelect } } as const

export const payrollEmployeesRouter = Router()

payrollEmployeesRouter.get('/payroll/employee-profiles/user-options', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const existing = await prisma.payEmployeeProfile.findMany({ select: { userId: true } })
    const existingIds = new Set(existing.map((e) => e.userId))
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', id: { notIn: [...existingIds] } },
      select: userSelect,
      orderBy: { userName: 'asc' },
    })
    res.json({
      ok: true,
      items: users.map((u) => ({
        id: u.id,
        loginId: u.loginId,
        userName: u.userName,
        dept: u.worker?.team ?? '',
        position: u.worker?.position ?? '',
        hireDate: u.worker?.hireDate ? ymd(u.worker.hireDate) : null,
        workerCode: u.worker?.workerCode ?? null,
      })),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.get('/payroll/employee-profiles', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const includeInactive = req.query.includeInactive === '1'
    const rows = await prisma.payEmployeeProfile.findMany({
      where: includeInactive ? undefined : { status: 'ACTIVE' },
      include: profileInclude,
      orderBy: [{ user: { userName: 'asc' } }],
    })
    res.json({
      ok: true,
      canManage: canManagePayStubs(me.roleName),
      items: rows.map(serializeProfile),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.post('/payroll/employee-profiles', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = profileBody.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: userSelect,
    })
    if (!user) {
      res.status(400).json({ ok: false, error: 'invalid user' })
      return
    }
    const row = await prisma.payEmployeeProfile.create({
      data: {
        userId: body.userId,
        employeeNo: body.employeeNo?.trim() || user.worker?.workerCode || null,
        dept: body.dept?.trim() || user.worker?.team || null,
        position: body.position?.trim() || user.worker?.position || null,
        hireDate: body.hireDate ? parseYmd(body.hireDate) : user.worker?.hireDate ?? null,
        baseSalary: body.baseSalary ?? 0,
        hourlyWage: body.hourlyWage ?? null,
        ordinaryWage: body.ordinaryWage ?? body.baseSalary ?? null,
        paymentDay: body.paymentDay ?? null,
        bankName: body.bankName?.trim() || null,
        bankAccount: body.bankAccount?.trim() || null,
        accountHolder: body.accountHolder?.trim() || user.userName,
        dependants: body.dependants ?? 1,
        status: body.status ?? 'ACTIVE',
        remark: body.remark?.trim() || null,
      },
      include: profileInclude,
    })
    res.status(201).json({ ok: true, item: serializeProfile(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.patch('/payroll/employee-profiles/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const body = profileBody.omit({ userId: true }).partial().parse(req.body)
    const existing = await prisma.payEmployeeProfile.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    const row = await prisma.payEmployeeProfile.update({
      where: { id },
      data: {
        employeeNo: body.employeeNo !== undefined ? (body.employeeNo?.trim() || null) : undefined,
        dept: body.dept !== undefined ? (body.dept?.trim() || null) : undefined,
        position: body.position !== undefined ? (body.position?.trim() || null) : undefined,
        hireDate: body.hireDate !== undefined ? (body.hireDate ? parseYmd(body.hireDate) : null) : undefined,
        baseSalary: body.baseSalary,
        hourlyWage: body.hourlyWage !== undefined ? body.hourlyWage : undefined,
        ordinaryWage: body.ordinaryWage !== undefined ? body.ordinaryWage : undefined,
        paymentDay: body.paymentDay !== undefined ? body.paymentDay : undefined,
        bankName: body.bankName !== undefined ? (body.bankName?.trim() || null) : undefined,
        bankAccount: body.bankAccount !== undefined ? (body.bankAccount?.trim() || null) : undefined,
        accountHolder: body.accountHolder !== undefined ? (body.accountHolder?.trim() || null) : undefined,
        dependants: body.dependants,
        status: body.status,
        remark: body.remark !== undefined ? (body.remark?.trim() || null) : undefined,
      },
      include: profileInclude,
    })
    res.json({ ok: true, item: serializeProfile(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.delete('/payroll/employee-profiles/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const existing = await prisma.payEmployeeProfile.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    await prisma.payEmployeeProfile.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.get('/payroll/work-records', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const ymParsed = yearMonthStr.safeParse(req.query.yearMonth)
    if (!ymParsed.success) {
      res.status(400).json({ ok: false, error: 'yearMonth required (YYYY-MM)' })
      return
    }
    const yearMonth = ymParsed.data
    const rows = await prisma.payWorkRecord.findMany({
      where: { yearMonth },
      include: workInclude,
      orderBy: [{ user: { userName: 'asc' } }],
    })
    res.json({
      ok: true,
      yearMonth,
      canManage: canManagePayStubs(me.roleName),
      items: rows.map(serializeWork),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.post('/payroll/work-records/init', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = z.object({ yearMonth: yearMonthStr }).parse(req.body)
    const profiles = await prisma.payEmployeeProfile.findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true },
    })
    const existing = await prisma.payWorkRecord.findMany({
      where: { yearMonth: body.yearMonth },
      select: { userId: true },
    })
    const existingIds = new Set(existing.map((e) => e.userId))
    const toCreate = profiles.filter((p) => !existingIds.has(p.userId))
    if (toCreate.length > 0) {
      await prisma.payWorkRecord.createMany({
        data: toCreate.map((p) => ({ userId: p.userId, yearMonth: body.yearMonth })),
      })
    }
    const rows = await prisma.payWorkRecord.findMany({
      where: { yearMonth: body.yearMonth },
      include: workInclude,
      orderBy: [{ user: { userName: 'asc' } }],
    })
    res.json({ ok: true, created: toCreate.length, items: rows.map(serializeWork) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.post('/payroll/work-records', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = workBody.parse(req.body)
    const profile = await prisma.payEmployeeProfile.findUnique({ where: { userId: body.userId } })
    if (!profile || profile.status !== 'ACTIVE') {
      res.status(400).json({ ok: false, error: 'pay employee profile required' })
      return
    }
    const row = await prisma.payWorkRecord.create({
      data: {
        userId: body.userId,
        yearMonth: body.yearMonth,
        workDays: body.workDays ?? 0,
        paidLeaveDays: body.paidLeaveDays ?? 0,
        unpaidLeaveDays: body.unpaidLeaveDays ?? 0,
        regularHours: body.regularHours ?? 0,
        overtimeHours: body.overtimeHours ?? 0,
        nightHours: body.nightHours ?? 0,
        holidayHours: body.holidayHours ?? 0,
        annualLeaveDays: body.annualLeaveDays ?? 0,
        remark: body.remark?.trim() || null,
      },
      include: workInclude,
    })
    res.status(201).json({ ok: true, item: serializeWork(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.patch('/payroll/work-records/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const body = workBody.omit({ userId: true, yearMonth: true }).partial().parse(req.body)
    const existing = await prisma.payWorkRecord.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    const row = await prisma.payWorkRecord.update({
      where: { id },
      data: {
        workDays: body.workDays,
        paidLeaveDays: body.paidLeaveDays,
        unpaidLeaveDays: body.unpaidLeaveDays,
        regularHours: body.regularHours,
        overtimeHours: body.overtimeHours,
        nightHours: body.nightHours,
        holidayHours: body.holidayHours,
        annualLeaveDays: body.annualLeaveDays,
        remark: body.remark !== undefined ? (body.remark?.trim() || null) : undefined,
      },
      include: workInclude,
    })
    res.json({ ok: true, item: serializeWork(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.delete('/payroll/work-records/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const existing = await prisma.payWorkRecord.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    await prisma.payWorkRecord.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    prismaFail(res, e)
  }
})
