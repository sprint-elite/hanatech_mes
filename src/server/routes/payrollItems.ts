import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import { canManagePayStubs, getRequestUser, type RequestUser } from '../lib/requestUser'

const itemStatus = z.enum(['ACTIVE', 'INACTIVE'])
const paymentType = z.enum(['FIXED', 'VARIABLE_TIME', 'VARIABLE_DAY'])

const allowanceBody = z.object({
  itemCode: z.string().trim().min(1).max(10),
  itemName: z.string().trim().min(1).max(64),
  displayOrder: z.number().int().min(0).optional(),
  multiplier: z.number().min(0).optional().nullable(),
  taxExemptType: z.string().trim().max(32).optional().nullable(),
  paymentType: paymentType.optional(),
  calcFormula: z.string().trim().max(500).optional().nullable(),
  calcDescription: z.string().trim().max(500).optional().nullable(),
  status: itemStatus.optional(),
})

const deductionBody = z.object({
  itemCode: z.string().trim().min(1).max(10),
  itemName: z.string().trim().min(1).max(64),
  displayOrder: z.number().int().min(0).optional(),
  calcFormula: z.string().trim().max(500).optional().nullable(),
  calcDescription: z.string().trim().max(500).optional().nullable(),
  status: itemStatus.optional(),
})

function decOrNull(v: { toString(): string } | null | undefined): number | null {
  if (v == null) return null
  return Number(v.toString())
}

function serializeAllowance(row: {
  id: number
  itemCode: string
  itemName: string
  displayOrder: number
  multiplier: { toString(): string } | null
  taxExemptType: string | null
  paymentType: string
  calcFormula: string | null
  calcDescription: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    itemCode: row.itemCode,
    itemName: row.itemName,
    displayOrder: row.displayOrder,
    multiplier: decOrNull(row.multiplier),
    taxExemptType: row.taxExemptType,
    paymentType: row.paymentType,
    calcFormula: row.calcFormula,
    calcDescription: row.calcDescription,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeDeduction(row: {
  id: number
  itemCode: string
  itemName: string
  displayOrder: number
  calcFormula: string | null
  calcDescription: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    itemCode: row.itemCode,
    itemName: row.itemName,
    displayOrder: row.displayOrder,
    calcFormula: row.calcFormula,
    calcDescription: row.calcDescription,
    status: row.status,
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

export const payrollItemsRouter = Router()

payrollItemsRouter.get('/payroll/allowance-items', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const includeInactive = req.query.includeInactive === '1'
    const rows = await prisma.payAllowanceItem.findMany({
      where: includeInactive ? undefined : { status: 'ACTIVE' },
      orderBy: [{ displayOrder: 'asc' }, { itemCode: 'asc' }],
    })
    res.json({
      ok: true,
      canManage: canManagePayStubs(me.roleName),
      items: rows.map(serializeAllowance),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollItemsRouter.post('/payroll/allowance-items', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = allowanceBody.parse(req.body)
    const row = await prisma.payAllowanceItem.create({
      data: {
        itemCode: body.itemCode,
        itemName: body.itemName,
        displayOrder: body.displayOrder ?? 0,
        multiplier: body.multiplier ?? null,
        taxExemptType: body.taxExemptType?.trim() || null,
        paymentType: body.paymentType ?? 'FIXED',
        calcFormula: body.calcFormula?.trim() || null,
        calcDescription: body.calcDescription?.trim() || null,
        status: body.status ?? 'ACTIVE',
      },
    })
    res.status(201).json({ ok: true, item: serializeAllowance(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollItemsRouter.patch('/payroll/allowance-items/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const body = allowanceBody.partial().parse(req.body)
    const existing = await prisma.payAllowanceItem.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    const row = await prisma.payAllowanceItem.update({
      where: { id },
      data: {
        itemCode: body.itemCode,
        itemName: body.itemName,
        displayOrder: body.displayOrder,
        multiplier: body.multiplier !== undefined ? body.multiplier : undefined,
        taxExemptType: body.taxExemptType !== undefined ? (body.taxExemptType?.trim() || null) : undefined,
        paymentType: body.paymentType,
        calcFormula: body.calcFormula !== undefined ? (body.calcFormula?.trim() || null) : undefined,
        calcDescription: body.calcDescription !== undefined ? (body.calcDescription?.trim() || null) : undefined,
        status: body.status,
      },
    })
    res.json({ ok: true, item: serializeAllowance(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollItemsRouter.delete('/payroll/allowance-items/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const existing = await prisma.payAllowanceItem.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    await prisma.payAllowanceItem.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollItemsRouter.get('/payroll/deduction-items', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    const includeInactive = req.query.includeInactive === '1'
    const rows = await prisma.payDeductionItem.findMany({
      where: includeInactive ? undefined : { status: 'ACTIVE' },
      orderBy: [{ displayOrder: 'asc' }, { itemCode: 'asc' }],
    })
    res.json({
      ok: true,
      canManage: canManagePayStubs(me.roleName),
      items: rows.map(serializeDeduction),
    })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollItemsRouter.post('/payroll/deduction-items', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const body = deductionBody.parse(req.body)
    const row = await prisma.payDeductionItem.create({
      data: {
        itemCode: body.itemCode,
        itemName: body.itemName,
        displayOrder: body.displayOrder ?? 0,
        calcFormula: body.calcFormula?.trim() || null,
        calcDescription: body.calcDescription?.trim() || null,
        status: body.status ?? 'ACTIVE',
      },
    })
    res.status(201).json({ ok: true, item: serializeDeduction(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollItemsRouter.patch('/payroll/deduction-items/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const body = deductionBody.partial().parse(req.body)
    const existing = await prisma.payDeductionItem.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    const row = await prisma.payDeductionItem.update({
      where: { id },
      data: {
        itemCode: body.itemCode,
        itemName: body.itemName,
        displayOrder: body.displayOrder,
        calcFormula: body.calcFormula !== undefined ? (body.calcFormula?.trim() || null) : undefined,
        calcDescription: body.calcDescription !== undefined ? (body.calcDescription?.trim() || null) : undefined,
        status: body.status,
      },
    })
    res.json({ ok: true, item: serializeDeduction(row) })
  } catch (e) {
    prismaFail(res, e)
  }
})

payrollItemsRouter.delete('/payroll/deduction-items/:id', async (req, res) => {
  try {
    const me = await requireUser(req, res)
    if (!me) return
    if (!canManagePayStubs(me.roleName)) {
      res.status(403).json({ ok: false, error: 'forbidden' })
      return
    }
    const id = parsePositiveIntParam(req.params.id)
    const existing = await prisma.payDeductionItem.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ ok: false, error: 'not found' })
      return
    }
    await prisma.payDeductionItem.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    prismaFail(res, e)
  }
})
