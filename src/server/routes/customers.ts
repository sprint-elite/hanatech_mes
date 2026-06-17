import { Router } from 'express'
import { CustomerType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

const useYn = z.enum(['Y', 'N'])
const customerType = z.nativeEnum(CustomerType)

const createBody = z.object({
  customerCode: z.string().trim().min(1).max(64),
  customerName: z.string().trim().min(1).max(200),
  type: customerType,
  useYn: useYn.optional(),
  contactName: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  remark: z.string().trim().max(4000).nullable().optional(),
})

const updateBody = createBody.partial()

export const customersRouter = Router()

customersRouter.get('/customers', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined
  const useYnQ = typeof req.query.useYn === 'string' ? req.query.useYn : undefined
  try {
    const items = await prisma.customer.findMany({
      take: 2000,
      orderBy: [{ customerName: 'asc' }, { id: 'asc' }],
      where: {
        ...(type ? { type: type as CustomerType } : {}),
        ...(useYnQ === 'Y' || useYnQ === 'N' ? { useYn: useYnQ } : {}),
      },
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        type: true,
        useYn: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        remark: true,
        createdAt: true,
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

customersRouter.get('/customers/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        type: true,
        useYn: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        remark: true,
        createdAt: true,
      },
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

customersRouter.post('/customers', async (req, res) => {
  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  try {
    const item = await prisma.customer.create({
      data: {
        customerCode: b.customerCode,
        customerName: b.customerName,
        type: b.type,
        useYn: b.useYn ?? 'Y',
        contactName: b.contactName ?? undefined,
        phone: b.phone ?? undefined,
        email: b.email ?? undefined,
        address: b.address ?? undefined,
        remark: b.remark ?? undefined,
      },
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        type: true,
        useYn: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        remark: true,
        createdAt: true,
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

customersRouter.patch('/customers/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const parsed = updateBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const data = {
      ...(b.customerCode !== undefined ? { customerCode: b.customerCode } : {}),
      ...(b.customerName !== undefined ? { customerName: b.customerName } : {}),
      ...(b.type !== undefined ? { type: b.type } : {}),
      ...(b.useYn !== undefined ? { useYn: b.useYn } : {}),
      ...(b.contactName !== undefined ? { contactName: b.contactName } : {}),
      ...(b.phone !== undefined ? { phone: b.phone } : {}),
      ...(b.email !== undefined ? { email: b.email } : {}),
      ...(b.address !== undefined ? { address: b.address } : {}),
      ...(b.remark !== undefined ? { remark: b.remark } : {}),
    }
    const item = await prisma.customer.update({
      where: { id },
      data,
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        type: true,
        useYn: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        remark: true,
        createdAt: true,
      },
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

customersRouter.delete('/customers/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    // FK로 연결된 경우 삭제가 실패할 수 있습니다(운영상 안전).
    await prisma.customer.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

