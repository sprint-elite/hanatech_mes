import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import type { Prisma } from '@prisma/client'

const useYn = z.enum(['Y', 'N'])

const positiveSeconds = z.number().finite().positive()

const createBody = z.object({
  productId: z.number().int().positive(),
  processCode: z.string().trim().min(1).max(64),
  processName: z.string().trim().min(1).max(200),
  sequence: z.number().int().positive(),
  workCenterId: z.number().int().positive().optional().nullable(),
  standardTime: positiveSeconds.optional().nullable(),
  baseQty: z.number().int().positive().optional().nullable(),
  remark: z.string().trim().max(500).optional().nullable(),
  isOutsourcing: useYn.optional(),
  useYn: useYn.optional(),
})

const updateBody = createBody.partial()

const listSelect = {
  id: true,
  productId: true,
  processCode: true,
  processName: true,
  sequence: true,
  workCenterId: true,
  standardTime: true,
  baseQty: true,
  remark: true,
  isOutsourcing: true,
  useYn: true,
  product: { select: { productCode: true, productName: true } },
  workCenter: { select: { centerCode: true, centerName: true } },
} as const

type MbomProcessRow = Prisma.MbomProcessGetPayload<{ select: typeof listSelect }>

function toStandardTimeInput(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return String(value)
}

function serializeMbomProcess(item: MbomProcessRow) {
  return {
    ...item,
    standardTime: item.standardTime == null ? null : Number(item.standardTime.toString()),
  }
}

export const mbomProcessesRouter = Router()

async function listForProduct(productId: number) {
  return prisma.mbomProcess.findMany({
    where: { productId, useYn: 'Y' },
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      processCode: true,
      processName: true,
      sequence: true,
      workCenter: { select: { centerCode: true, centerName: true } },
    },
  })
}

/** 공정 실적 화면용: 품목별 사용 중 공정만 */
mbomProcessesRouter.get('/processes', async (req, res) => {
  const rawQ = req.query.productId
  const raw = Array.isArray(rawQ) ? rawQ[0] : rawQ
  const parsed = z.coerce.number().int().positive().safeParse(raw)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'productId required (positive int)' })
  }
  try {
    const items = await listForProduct(parsed.data)
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

mbomProcessesRouter.get('/mbom-processes', async (req, res) => {
  const rawQ = req.query.productId
  const raw = Array.isArray(rawQ) ? rawQ[0] : rawQ

  try {
    if (raw !== undefined && raw !== '') {
      const parsed = z.coerce.number().int().positive().safeParse(raw)
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'INVALID_PRODUCT_ID' })
      }
      const items = await prisma.mbomProcess.findMany({
        where: { productId: parsed.data },
        orderBy: [{ productId: 'asc' }, { sequence: 'asc' }],
        select: listSelect,
      })
      return res.json({ ok: true, items: items.map(serializeMbomProcess) })
    }
    const items = await prisma.mbomProcess.findMany({
      take: 500,
      orderBy: [{ id: 'desc' }],
      select: listSelect,
    })
    return res.json({ ok: true, items: items.map(serializeMbomProcess) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

mbomProcessesRouter.get('/mbom-processes/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.mbomProcess.findUnique({
      where: { id },
      select: listSelect,
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item: serializeMbomProcess(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

mbomProcessesRouter.post('/mbom-processes', async (req, res) => {
  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  try {
    const item = await prisma.mbomProcess.create({
      data: {
        productId: b.productId,
        processCode: b.processCode,
        processName: b.processName,
        sequence: b.sequence,
        workCenterId: b.workCenterId ?? undefined,
        standardTime: toStandardTimeInput(b.standardTime),
        baseQty: b.baseQty ?? undefined,
        remark: b.remark ?? undefined,
        isOutsourcing: b.isOutsourcing ?? 'N',
        useYn: b.useYn ?? 'Y',
      },
      select: listSelect,
    })
    return res.status(201).json({ ok: true, item: serializeMbomProcess(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

mbomProcessesRouter.patch('/mbom-processes/:id', async (req, res) => {
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
      ...(b.productId !== undefined ? { productId: b.productId } : {}),
      ...(b.processCode !== undefined ? { processCode: b.processCode } : {}),
      ...(b.processName !== undefined ? { processName: b.processName } : {}),
      ...(b.sequence !== undefined ? { sequence: b.sequence } : {}),
      ...(b.workCenterId !== undefined ? { workCenterId: b.workCenterId } : {}),
      ...(b.standardTime !== undefined ? { standardTime: toStandardTimeInput(b.standardTime) } : {}),
      ...(b.baseQty !== undefined ? { baseQty: b.baseQty } : {}),
      ...(b.remark !== undefined ? { remark: b.remark } : {}),
      ...(b.isOutsourcing !== undefined ? { isOutsourcing: b.isOutsourcing } : {}),
      ...(b.useYn !== undefined ? { useYn: b.useYn } : {}),
    }
    const item = await prisma.mbomProcess.update({
      where: { id },
      data,
      select: listSelect,
    })
    return res.json({ ok: true, item: serializeMbomProcess(item) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

mbomProcessesRouter.delete('/mbom-processes/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.mbomProcess.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
