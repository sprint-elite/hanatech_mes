import { Router } from 'express'
import { z } from 'zod'
import { InventoryStatus, InventoryTxRefType, InventoryTxType } from '@prisma/client'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

const invTxListSelect = {
  id: true,
  productId: true,
  lotId: true,
  materialLotId: true,
  locationId: true,
  transactionType: true,
  qty: true,
  refType: true,
  refId: true,
  fromLocationId: true,
  toLocationId: true,
  beforeQty: true,
  afterQty: true,
  remark: true,
  createdAt: true,
  product: { select: { productCode: true, productName: true } },
  lot: { select: { lotNo: true } },
  materialLot: { select: { lotNo: true } },
  location: { select: { locationCode: true, locationName: true } },
  fromLocation: { select: { locationCode: true, locationName: true } },
  toLocation: { select: { locationCode: true, locationName: true } },
} as const

const invStatus = z.enum(['AVAILABLE', 'HOLD', 'DEFECT'])

const createBody = z.object({
  productId: z.number().int().positive(),
  lotId: z.number().int().positive().optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  qty: z.number().int().nonnegative(),
  reservedQty: z.number().int().nonnegative().optional(),
  status: invStatus.optional(),
})

const updateBody = z.object({
  productId: z.number().int().positive().optional(),
  lotId: z.number().int().positive().optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  qty: z.number().int().nonnegative().optional(),
  reservedQty: z.number().int().nonnegative().optional(),
  status: invStatus.optional(),
})

const listSelect = {
  id: true,
  productId: true,
  lotId: true,
  locationId: true,
  qty: true,
  reservedQty: true,
  status: true,
  updatedAt: true,
  product: { select: { productCode: true, productName: true } },
  lot: { select: { lotNo: true, id: true } },
  materialLot: { select: { lotNo: true, id: true } },
} as const

export const inventoryRouter = Router()

/** 입출고·이동·조정 이력 (통합 생산 운영 재고 탭 등) */
inventoryRouter.get('/inventory-transactions', async (req, res) => {
  const rawPid = req.query.productId
  const rawLimit = req.query.limit
  let productId: number | undefined
  if (rawPid !== undefined && rawPid !== null && String(rawPid).trim() !== '') {
    const n = Number(rawPid)
    if (!Number.isInteger(n) || n < 1) {
      return res.status(400).json({ ok: false, error: 'INVALID_PRODUCT_ID' })
    }
    productId = n
  }
  const lim = rawLimit != null && String(rawLimit).trim() !== '' ? Number(rawLimit) : 400
  const take = Number.isInteger(lim) && lim > 0 ? Math.min(800, lim) : 400
  try {
    const items = await prisma.inventoryTransaction.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      where: productId != null ? { productId } : undefined,
      select: invTxListSelect,
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

inventoryRouter.get('/inventory', async (_req, res) => {
  try {
    const items = await prisma.inventory.findMany({
      take: 500,
      orderBy: { id: 'desc' },
      select: listSelect,
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

inventoryRouter.get('/inventory/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.inventory.findUnique({
      where: { id },
      select: listSelect,
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

inventoryRouter.post('/inventory', async (req, res) => {
  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  try {
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${b.productId} FOR UPDATE`
      const agg = await tx.inventory.aggregate({
        where: { productId: b.productId },
        _sum: { qty: true },
      })
      const beforeQty = agg._sum.qty ?? 0
      const created = await tx.inventory.create({
        data: {
          productId: b.productId,
          lotId: b.lotId ?? undefined,
          locationId: b.locationId ?? undefined,
          qty: b.qty,
          reservedQty: b.reservedQty ?? 0,
          status: (b.status as InventoryStatus) ?? InventoryStatus.AVAILABLE,
        },
        select: listSelect,
      })
      if (b.qty > 0) {
        await tx.inventoryTransaction.create({
          data: {
            productId: b.productId,
            lotId: b.lotId ?? undefined,
            locationId: b.locationId ?? undefined,
            transactionType: InventoryTxType.IN,
            qty: b.qty,
            refType: InventoryTxRefType.ADJUST,
            refId: created.id,
            beforeQty,
            afterQty: beforeQty + b.qty,
            remark: '초기재고 등록',
          },
        })
      }
      return created
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

inventoryRouter.patch('/inventory/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const parsed = updateBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({
        where: { id },
        select: { id: true, productId: true, lotId: true, locationId: true, qty: true },
      })
      if (!existing) throw new Error('NOT_FOUND')

      const nextProductId = b.productId ?? existing.productId
      if (nextProductId !== existing.productId) {
        throw new Error('PRODUCT_CHANGE_NOT_ALLOWED')
      }
      const nextQty = b.qty ?? existing.qty
      const delta = nextQty - existing.qty

      await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${existing.productId} FOR UPDATE`
      const agg = await tx.inventory.aggregate({
        where: { productId: existing.productId },
        _sum: { qty: true },
      })
      const beforeQty = agg._sum.qty ?? 0

      const data = {
        ...(b.productId !== undefined ? { productId: b.productId } : {}),
        ...(b.lotId !== undefined ? { lotId: b.lotId } : {}),
        ...(b.locationId !== undefined ? { locationId: b.locationId } : {}),
        ...(b.qty !== undefined ? { qty: b.qty } : {}),
        ...(b.reservedQty !== undefined ? { reservedQty: b.reservedQty } : {}),
        ...(b.status !== undefined ? { status: b.status as InventoryStatus } : {}),
      }
      const updated = await tx.inventory.update({
        where: { id },
        data,
        select: listSelect,
      })

      if (delta !== 0) {
        await tx.inventoryTransaction.create({
          data: {
            productId: existing.productId,
            lotId: (b.lotId !== undefined ? b.lotId : existing.lotId) ?? undefined,
            locationId: (b.locationId !== undefined ? b.locationId : existing.locationId) ?? undefined,
            transactionType: delta > 0 ? InventoryTxType.IN : InventoryTxType.OUT,
            qty: Math.abs(delta),
            refType: InventoryTxRefType.ADJUST,
            refId: existing.id,
            beforeQty,
            afterQty: beforeQty + delta,
            remark: delta > 0 ? '재고 메뉴 수동 입고 조정' : '재고 메뉴 수동 출고 조정',
          },
        })
      }
      return updated
    })
    return res.json({ ok: true, item })
  } catch (e) {
    if (e instanceof Error && e.message === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    }
    if (e instanceof Error && e.message === 'PRODUCT_CHANGE_NOT_ALLOWED') {
      return res.status(400).json({
        ok: false,
        error: 'PRODUCT_CHANGE_NOT_ALLOWED',
        message: '재고 행의 품목 변경은 지원하지 않습니다. 삭제 후 새로 등록하세요.',
      })
    }
    return prismaFail(res, e)
  }
})

inventoryRouter.delete('/inventory/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({
        where: { id },
        select: { id: true, productId: true, lotId: true, locationId: true, qty: true },
      })
      if (!existing) throw new Error('NOT_FOUND')
      await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${existing.productId} FOR UPDATE`
      const agg = await tx.inventory.aggregate({
        where: { productId: existing.productId },
        _sum: { qty: true },
      })
      const beforeQty = agg._sum.qty ?? 0
      await tx.inventory.delete({ where: { id } })
      if (existing.qty > 0) {
        await tx.inventoryTransaction.create({
          data: {
            productId: existing.productId,
            lotId: existing.lotId ?? undefined,
            locationId: existing.locationId ?? undefined,
            transactionType: InventoryTxType.OUT,
            qty: existing.qty,
            refType: InventoryTxRefType.ADJUST,
            refId: existing.id,
            beforeQty,
            afterQty: beforeQty - existing.qty,
            remark: '재고 행 삭제로 출고 조정',
          },
        })
      }
    })
    return res.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    }
    return prismaFail(res, e)
  }
})
