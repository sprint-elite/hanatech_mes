import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import { canManagePayStubs, getRequestUser, type RequestUser } from '../lib/requestUser'
import { syncDraftStubsForUser } from '../lib/payrollStubSave'

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
  pensionBaseSalary: z.number().int().min(0).optional().nullable(),
  paymentDay: z.number().int().min(1).max(31).optional().nullable(),
  bankName: z.string().trim().max(32).optional().nullable(),
  bankAccount: z.string().trim().max(32).optional().nullable(),
  accountHolder: z.string().trim().max(64).optional().nullable(),
  dependants: z.number().int().min(1).max(11).optional(),
  children8to20: z.number().int().min(0).max(20).optional(),
  withholdingRatePct: z.union([z.literal(80), z.literal(100), z.literal(120)]).optional(),
  status: employeeStatus.optional(),
  remark: z.string().trim().max(500).optional().nullable(),
})

const workLineBody = z.object({
  workDate: dateStr,
  userId: z.number().int().positive(),
  allowanceItemId: z.number().int().positive(),
  quantity: z.number().min(0).max(9999),
})

const workLineBulkBody = z.object({
  deleteIds: z.array(z.number().int().positive()).optional(),
  lines: z.array(
    z.object({
      id: z.number().int().positive().optional(),
      workDate: dateStr,
      userId: z.number().int().positive(),
      allowanceItemId: z.number().int().positive(),
      quantity: z.number().min(0).max(9999),
    }),
  ),
})

function yearMonthFromDate(iso: string): string {
  return iso.slice(0, 7)
}

const PAYMENT_UNIT_LABEL: Record<string, string> = {
  VARIABLE_TIME: '시간',
  VARIABLE_DAY: '일',
}

const workLineInclude = {
  user: { select: userSelect },
  allowanceItem: {
    select: { id: true, itemCode: true, itemName: true, paymentType: true, multiplier: true },
  },
} as const

function serializeWorkLine(row: {
  id: number
  workDate: Date
  userId: number
  yearMonth: string
  quantity: { toString(): string }
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    loginId: string
    userName: string
    worker: { team: string | null; position: string | null } | null
  }
  allowanceItem: {
    id: number
    itemCode: string
    itemName: string
    paymentType: string
    multiplier: { toString(): string } | null
  }
}) {
  return {
    id: row.id,
    workDate: ymd(row.workDate),
    userId: row.userId,
    loginId: row.user.loginId,
    userName: row.user.userName,
    dept: row.user.worker?.team ?? '',
    position: row.user.worker?.position ?? '',
    allowanceItemId: row.allowanceItem.id,
    itemCode: row.allowanceItem.itemCode,
    itemName: row.allowanceItem.itemName,
    paymentType: row.allowanceItem.paymentType,
    unitLabel: PAYMENT_UNIT_LABEL[row.allowanceItem.paymentType] ?? '',
    multiplier: decOrNull(row.allowanceItem.multiplier),
    quantity: dec(row.quantity),
    yearMonth: row.yearMonth,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

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
  pensionBaseSalary: { toString(): string } | null
  paymentDay: number | null
  bankName: string | null
  bankAccount: string | null
  accountHolder: string | null
  dependants: number
  children8to20: number
  withholdingRatePct: number
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
    pensionBaseSalary: decOrNull(row.pensionBaseSalary),
    paymentDay: row.paymentDay,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    accountHolder: row.accountHolder,
    dependants: row.dependants,
    children8to20: row.children8to20,
    withholdingRatePct: row.withholdingRatePct,
    status: row.status,
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
        pensionBaseSalary: body.pensionBaseSalary ?? null,
        paymentDay: body.paymentDay ?? null,
        bankName: body.bankName?.trim() || null,
        bankAccount: body.bankAccount?.trim() || null,
        accountHolder: body.accountHolder?.trim() || user.userName,
        dependants: body.dependants ?? 1,
        children8to20: body.children8to20 ?? 0,
        withholdingRatePct: body.withholdingRatePct ?? 100,
        status: body.status ?? 'ACTIVE',
        remark: body.remark?.trim() || null,
      },
      include: profileInclude,
    })
    await syncDraftStubsForUser(row.userId)
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
        pensionBaseSalary: body.pensionBaseSalary !== undefined ? body.pensionBaseSalary : undefined,
        paymentDay: body.paymentDay !== undefined ? body.paymentDay : undefined,
        bankName: body.bankName !== undefined ? (body.bankName?.trim() || null) : undefined,
        bankAccount: body.bankAccount !== undefined ? (body.bankAccount?.trim() || null) : undefined,
        accountHolder: body.accountHolder !== undefined ? (body.accountHolder?.trim() || null) : undefined,
        dependants: body.dependants,
        children8to20: body.children8to20,
        withholdingRatePct: body.withholdingRatePct,
        status: body.status,
        remark: body.remark !== undefined ? (body.remark?.trim() || null) : undefined,
      },
      include: profileInclude,
    })
    await syncDraftStubsForUser(row.userId)
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

payrollEmployeesRouter.get('/payroll/work-records/options', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const profiles = await prisma.payEmployeeProfile.findMany({
      where: { status: 'ACTIVE' },
      include: profileInclude,
      orderBy: [{ user: { userName: 'asc' } }],
    })
    const allowanceItems = await prisma.payAllowanceItem.findMany({
      where: { status: 'ACTIVE', paymentType: { not: 'FIXED' } },
      orderBy: [{ displayOrder: 'asc' }, { itemCode: 'asc' }],
    })
    res.json({
      ok: true,
      canManage: canManagePayStubs(me.roleName),
      employees: profiles.map((p) => ({
        id: p.userId,
        loginId: p.user.loginId,
        userName: p.user.userName,
        dept: p.dept ?? p.user.worker?.team ?? '',
        position: p.position ?? p.user.worker?.position ?? '',
      })),
      allowanceItems: allowanceItems.map((a) => ({
        id: a.id,
        itemCode: a.itemCode,
        itemName: a.itemName,
        paymentType: a.paymentType,
        unitLabel: PAYMENT_UNIT_LABEL[a.paymentType] ?? '',
        multiplier: decOrNull(a.multiplier),
      })),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.get('/payroll/work-records', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const canManage = canManagePayStubs(me.roleName)

    const workDateParsed = dateStr.safeParse(req.query.workDate)
    const ymParsed = yearMonthStr.safeParse(req.query.yearMonth)
    const userIdParsed = z.coerce.number().int().positive().safeParse(req.query.userId)

    if (!workDateParsed.success && !ymParsed.success) {
      res.status(400).json({ ok: false, error: 'workDate (YYYY-MM-DD) or yearMonth (YYYY-MM) required' })
      return
    }

    const where: {
      workDate?: Date
      yearMonth?: string
      userId?: number
    } = {}

    if (workDateParsed.success) {
      where.workDate = parseYmd(workDateParsed.data)
    } else if (ymParsed.success) {
      where.yearMonth = ymParsed.data
    }

    if (userIdParsed.success) {
      where.userId = userIdParsed.data
    } else if (!canManage) {
      where.userId = me.id
    }

    const rows = await prisma.payWorkRecordLine.findMany({
      where,
      include: workLineInclude,
      orderBy: [{ workDate: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    })

    res.json({
      ok: true,
      workDate: workDateParsed.success ? workDateParsed.data : null,
      yearMonth: ymParsed.success ? ymParsed.data : null,
      canManage,
      items: rows.map(serializeWorkLine),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollEmployeesRouter.post('/payroll/work-records/bulk-save', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = workLineBulkBody.parse(req.body)

    const affectedUserIds = new Set<number>()
    if (body.deleteIds?.length) {
      const deleted = await prisma.payWorkRecordLine.findMany({
        where: { id: { in: body.deleteIds } },
        select: { userId: true },
      })
      deleted.forEach((r) => affectedUserIds.add(r.userId))
      await prisma.payWorkRecordLine.deleteMany({ where: { id: { in: body.deleteIds } } })
    }

    const savedIds: number[] = []
    for (let i = 0; i < body.lines.length; i++) {
      const line = body.lines[i]
      const profile = await prisma.payEmployeeProfile.findUnique({ where: { userId: line.userId } })
      if (!profile || profile.status !== 'ACTIVE') {
        res.status(400).json({ ok: false, error: `user ${line.userId}: 급여대상 직원이 아닙니다.` })
        return
      }
      const item = await prisma.payAllowanceItem.findUnique({ where: { id: line.allowanceItemId } })
      if (!item || item.status !== 'ACTIVE' || item.paymentType === 'FIXED') {
        res.status(400).json({ ok: false, error: `수당항목 ${line.allowanceItemId}: 변동 항목이 아닙니다.` })
        return
      }

      const data = {
        workDate: parseYmd(line.workDate),
        userId: line.userId,
        allowanceItemId: line.allowanceItemId,
        yearMonth: yearMonthFromDate(line.workDate),
        quantity: line.quantity,
        sortOrder: i,
      }

      if (line.id) {
        const updated = await prisma.payWorkRecordLine.update({ where: { id: line.id }, data })
        savedIds.push(updated.id)
      } else {
        const created = await prisma.payWorkRecordLine.create({ data })
        savedIds.push(created.id)
      }
      affectedUserIds.add(line.userId)
    }

    for (const userId of affectedUserIds) {
      await syncDraftStubsForUser(userId)
    }

    const rows = savedIds.length
      ? await prisma.payWorkRecordLine.findMany({
          where: { id: { in: savedIds } },
          include: workLineInclude,
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        })
      : []

    res.json({ ok: true, items: rows.map(serializeWorkLine) })
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
    const body = workLineBody.parse(req.body)
    const profile = await prisma.payEmployeeProfile.findUnique({ where: { userId: body.userId } })
    if (!profile || profile.status !== 'ACTIVE') {
      res.status(400).json({ ok: false, error: 'pay employee profile required' })
      return
    }
    const item = await prisma.payAllowanceItem.findUnique({ where: { id: body.allowanceItemId } })
    if (!item || item.status !== 'ACTIVE' || item.paymentType === 'FIXED') {
      res.status(400).json({ ok: false, error: 'variable allowance item required' })
      return
    }
    const row = await prisma.payWorkRecordLine.create({
      data: {
        workDate: parseYmd(body.workDate),
        userId: body.userId,
        allowanceItemId: body.allowanceItemId,
        yearMonth: yearMonthFromDate(body.workDate),
        quantity: body.quantity,
      },
      include: workLineInclude,
    })
    await syncDraftStubsForUser(row.userId)
    res.status(201).json({ ok: true, item: serializeWorkLine(row) })
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
    const body = workLineBody.partial().parse(req.body)
    const existing = await prisma.payWorkRecordLine.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    const workDate = body.workDate ?? ymd(existing.workDate)
    const row = await prisma.payWorkRecordLine.update({
      where: { id },
      data: {
        workDate: body.workDate ? parseYmd(body.workDate) : undefined,
        userId: body.userId,
        allowanceItemId: body.allowanceItemId,
        yearMonth: yearMonthFromDate(workDate),
        quantity: body.quantity,
      },
      include: workLineInclude,
    })
    await syncDraftStubsForUser(row.userId)
    res.json({ ok: true, item: serializeWorkLine(row) })
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
    const existing = await prisma.payWorkRecordLine.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    await prisma.payWorkRecordLine.delete({ where: { id } })
    await syncDraftStubsForUser(existing.userId)
    res.json({ ok: true })
  } catch (e) {
    prismaFail(res, e)
  }
})
