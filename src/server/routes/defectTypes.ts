import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

const useYn = z.enum(['Y', 'N'])

const productSelect = { productCode: true, productName: true } as const

const createBody = z.object({
  productId: z.number().int().positive(),
  defectCode: z.string().trim().min(1).max(64),
  defectName: z.string().trim().min(1).max(200),
  defectCategory: z.string().trim().max(100).optional().nullable(),
  severity: z.string().trim().max(20).optional().nullable(),
  useYn: useYn.optional(),
})

const updateBody = createBody.partial()

const listSelect = {
  id: true,
  productId: true,
  defectCode: true,
  defectName: true,
  defectCategory: true,
  severity: true,
  useYn: true,
  product: { select: productSelect },
} as const

export const defectTypesRouter = Router()

defectTypesRouter.get('/defect-types', async (req, res) => {
  const productId = parsePositiveIntParam(req.query.productId as string | undefined)
  if (req.query.productId != null && req.query.productId !== '' && !productId) {
    return res.status(400).json({ ok: false, error: 'INVALID_PRODUCT_ID' })
  }
  try {
    const items = await prisma.defectType.findMany({
      take: 500,
      orderBy: [{ productId: 'asc' }, { id: 'desc' }],
      where: productId ? { productId } : undefined,
      select: listSelect,
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

defectTypesRouter.get('/defect-types/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.defectType.findUnique({
      where: { id },
      select: listSelect,
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

defectTypesRouter.post('/defect-types', async (req, res) => {
  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  try {
    const item = await prisma.defectType.create({
      data: {
        productId: b.productId,
        defectCode: b.defectCode,
        defectName: b.defectName,
        defectCategory: b.defectCategory ?? undefined,
        severity: b.severity ?? undefined,
        useYn: b.useYn ?? 'Y',
      },
      select: listSelect,
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

defectTypesRouter.patch('/defect-types/:id', async (req, res) => {
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
      ...(b.defectCode !== undefined ? { defectCode: b.defectCode } : {}),
      ...(b.defectName !== undefined ? { defectName: b.defectName } : {}),
      ...(b.defectCategory !== undefined ? { defectCategory: b.defectCategory } : {}),
      ...(b.severity !== undefined ? { severity: b.severity } : {}),
      ...(b.useYn !== undefined ? { useYn: b.useYn } : {}),
    }
    const item = await prisma.defectType.update({
      where: { id },
      data,
      select: listSelect,
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

defectTypesRouter.delete('/defect-types/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.defectType.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
