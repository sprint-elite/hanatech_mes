import { Router } from 'express'
import { z } from 'zod'
import { LotStatus, Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import { renderCode128PngWithMeta, CODE128_LABEL, CODE128_PRINT, CODE128_SCREEN, CODE128_THUMB } from '../lib/barcode/image'
import { syncProductionLotBarcode } from '../lib/barcode/productionLot'

function normalizeScannedLotToken(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  const first = v.split(/[\s,\t|]+/)[0] ?? ''
  return first.trim()
}

const lotStatus = z.enum(['CREATED', 'IN_PROGRESS', 'DONE', 'OUTSOURCING'])

const createBody = z.object({
  lotNo: z.string().trim().min(1).max(64),
  productId: z.number().int().positive(),
  lotQty: z.number().int().positive(),
  woId: z.number().int().positive().optional().nullable(),
  workCenterId: z.number().int().positive().optional().nullable(),
  status: lotStatus.optional(),
})

const updateBody = z.object({
  lotNo: z.string().trim().min(1).max(64).optional(),
  lotQty: z.number().int().positive().optional(),
  woId: z.number().int().positive().nullable().optional(),
  workCenterId: z.number().int().positive().optional().nullable(),
  status: lotStatus.optional(),
  currentProcessId: z.number().int().positive().optional().nullable(),
  currentStatus: z.string().trim().max(100).optional().nullable(),
})

const listSelect = {
  id: true,
  lotNo: true,
  barcode: true,
  woId: true,
  productId: true,
  workCenterId: true,
  lotQty: true,
  goodQty: true,
  defectQty: true,
  status: true,
  currentProcessId: true,
  currentStatus: true,
  createdAt: true,
  product: { select: { productCode: true, productName: true } },
  workCenter: { select: { centerCode: true, centerName: true } },
  workOrder: {
    select: {
      id: true,
      woNo: true,
      orderQty: true,
      status: true,
      holdReason: true,
      plan: { select: { id: true, planNo: true } },
      product: { select: { productCode: true, productName: true } },
      assignedWorkers: {
        select: {
          worker: { select: { id: true, workerCode: true, workerName: true } },
        },
      },
      assignedProcessWorkers: {
        select: {
          processId: true,
          workerId: true,
          worker: { select: { id: true, workerCode: true, workerName: true } },
          process: { select: { id: true, processCode: true, processName: true, sequence: true } },
        },
      },
    },
  },
} as const

/** 작업지시에 연결된 LOT 수량 합이 지시수량을 넘지 않는지 검증 */
async function assertWorkOrderLotAllocation(
  woId: number,
  lotQty: number,
  excludeLotId?: number,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message: string }> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: woId },
    select: { orderQty: true },
  })
  if (!wo) {
    return {
      ok: false,
      status: 400,
      error: 'WORK_ORDER_NOT_FOUND',
      message: '작업지시를 찾을 수 없습니다.',
    }
  }
  const agg = await prisma.productionLot.aggregate({
    where: {
      woId,
      ...(excludeLotId != null ? { id: { not: excludeLotId } } : {}),
    },
    _sum: { lotQty: true },
  })
  const allocated = agg._sum.lotQty ?? 0
  if (allocated + lotQty > wo.orderQty) {
    const remain = Math.max(0, wo.orderQty - allocated)
    return {
      ok: false,
      status: 400,
      error: 'LOT_ALLOCATION_EXCEEDS_WO',
      message: `작업지시 수량(${wo.orderQty})을 초과합니다. 이미 LOT에 ${allocated}개 배정됨, 추가 가능 ${remain}개.`,
    }
  }
  return { ok: true }
}

export const productionLotsRouter = Router()

productionLotsRouter.get('/lots', async (req, res) => {
  const rawQ = req.query.productId
  const raw = Array.isArray(rawQ) ? rawQ[0] : rawQ

  let productId: number | undefined
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) {
      return res.status(400).json({ ok: false, error: 'INVALID_PRODUCT_ID' })
    }
    productId = n
  }

  try {
    const items = await prisma.productionLot.findMany({
      take: 500,
      where: productId ? { productId } : undefined,
      orderBy: { id: 'desc' },
      select: listSelect,
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionLotsRouter.get('/lots/:id/barcode-image', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const view = typeof req.query.view === 'string' ? req.query.view : ''
  const legacyLarge = req.query.large === '1' || req.query.large === 'true'
  const spec =
    view === 'label'
      ? CODE128_LABEL
      : view === 'print'
        ? CODE128_PRINT
        : view === 'screen' || legacyLarge
          ? CODE128_SCREEN
          : CODE128_THUMB
  try {
    const lot = await prisma.productionLot.findUnique({
      where: { id },
      select: { barcode: true, lotNo: true },
    })
    if (!lot) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    const text = lot.barcode ?? lot.lotNo
    const img = await renderCode128PngWithMeta({ text, ...spec })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Barcode-Width-Mm', String(img.widthMm))
    res.setHeader('X-Barcode-Height-Mm', String(img.heightMm))
    res.setHeader('X-Barcode-Width-Px', String(img.widthPx))
    res.setHeader('X-Barcode-Height-Px', String(img.heightPx))
    return res.send(img.buffer)
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionLotsRouter.get('/lots/lookup', async (req, res) => {
  const rawQ = req.query.value
  const raw = Array.isArray(rawQ) ? rawQ[0] : rawQ
  const value = normalizeScannedLotToken(typeof raw === 'string' ? raw : '')
  if (!value) return res.status(400).json({ ok: false, error: 'VALUE_REQUIRED' })

  try {
    const lot = await prisma.productionLot.findFirst({
      where: { OR: [{ lotNo: value }, { barcode: value }] },
      select: {
        ...listSelect,
        results: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            processSequence: true,
            inputQty: true,
            goodQty: true,
            defectQty: true,
            startTime: true,
            endTime: true,
            createdAt: true,
            process: { select: { processCode: true, processName: true } },
            worker: { select: { workerCode: true, workerName: true } },
            workCenter: { select: { centerCode: true, centerName: true } },
          },
        },
        defects: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            qty: true,
            remark: true,
            detectedAt: true,
            createdAt: true,
            process: { select: { processCode: true, processName: true } },
            defectType: { select: { defectCode: true, defectName: true } },
            worker: { select: { workerCode: true, workerName: true } },
          },
        },
        materialUsages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            usedQty: true,
            createdAt: true,
            materialLot: { select: { id: true, lotNo: true } },
            materialProduct: { select: { id: true, productCode: true, productName: true } },
          },
        },
        histories: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          select: { id: true, eventType: true, eventDesc: true, createdAt: true },
        },
        inventory: {
          take: 20,
          orderBy: { id: 'desc' },
          select: {
            id: true,
            qty: true,
            reservedQty: true,
            status: true,
            updatedAt: true,
            location: { select: { locationCode: true, locationName: true } },
          },
        },
        inventoryTx: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            transactionType: true,
            qty: true,
            remark: true,
            createdAt: true,
            fromLocation: { select: { locationCode: true, locationName: true } },
            toLocation: { select: { locationCode: true, locationName: true } },
            location: { select: { locationCode: true, locationName: true } },
          },
        },
        shipmentDetails: {
          take: 20,
          orderBy: { id: 'desc' },
          select: {
            id: true,
            qty: true,
            shipment: { select: { shipmentNo: true, shipmentDate: true, status: true, customerName: true } },
          },
        },
        outsourcing: {
          take: 20,
          orderBy: { id: 'desc' },
          select: {
            id: true,
            outsourcingNo: true,
            vendorName: true,
            requestQty: true,
            outDate: true,
            expectedInDate: true,
            status: true,
            process: { select: { processCode: true, processName: true } },
          },
        },
      },
    })

    if (!lot) return res.status(404).json({ ok: false, error: 'NOT_FOUND', message: '생산 LOT를 찾을 수 없습니다.' })
    return res.json({ ok: true, lot })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionLotsRouter.get('/lots/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.productionLot.findUnique({
      where: { id },
      select: listSelect,
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionLotsRouter.post('/lots', async (req, res) => {
  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  try {
    if (b.woId != null) {
      const wo = await prisma.workOrder.findUnique({
        where: { id: b.woId },
        select: { id: true, productId: true, orderQty: true },
      })
      if (!wo) {
        return res.status(400).json({ ok: false, error: 'WORK_ORDER_NOT_FOUND', message: '작업지시를 찾을 수 없습니다.' })
      }
      if (wo.productId !== b.productId) {
        return res.status(400).json({
          ok: false,
          error: 'PRODUCT_MISMATCH',
          message: '품목은 선택한 작업지시의 품목과 같아야 합니다.',
        })
      }
      const alloc = await assertWorkOrderLotAllocation(b.woId, b.lotQty)
      if (!alloc.ok) {
        return res.status(alloc.status).json({ ok: false, error: alloc.error, message: alloc.message })
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      const lot = await tx.productionLot.create({
        data: {
          lotNo: b.lotNo,
          productId: b.productId,
          lotQty: b.lotQty,
          woId: b.woId ?? undefined,
          workCenterId: b.workCenterId ?? undefined,
          status: (b.status as LotStatus) ?? LotStatus.CREATED,
        },
        select: { id: true, lotNo: true },
      })
      await syncProductionLotBarcode(tx, lot.id, lot.lotNo)
      return tx.productionLot.findUniqueOrThrow({
        where: { id: lot.id },
        select: listSelect,
      })
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionLotsRouter.patch('/lots/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const parsed = updateBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const existing = await prisma.productionLot.findUnique({
      where: { id },
      select: { productId: true, lotQty: true, woId: true, goodQty: true, defectQty: true },
    })
    if (!existing) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const nextLotQty = b.lotQty ?? existing.lotQty
    const nextWoId = b.woId !== undefined ? b.woId : existing.woId

    if (nextWoId != null) {
      const wo = await prisma.workOrder.findUnique({
        where: { id: nextWoId },
        select: { id: true, productId: true, orderQty: true },
      })
      if (!wo) {
        return res.status(400).json({ ok: false, error: 'WORK_ORDER_NOT_FOUND', message: '작업지시를 찾을 수 없습니다.' })
      }
      if (wo.productId !== existing.productId) {
        return res.status(400).json({
          ok: false,
          error: 'PRODUCT_MISMATCH',
          message: '작업지시 품목이 LOT 품목과 다릅니다. 품목을 먼저 맞추거나 작업지시 연결을 해제하세요.',
        })
      }
      const alloc = await assertWorkOrderLotAllocation(nextWoId, nextLotQty, id)
      if (!alloc.ok) {
        return res.status(alloc.status).json({ ok: false, error: alloc.error, message: alloc.message })
      }
    }

    const mergedLotQty = b.lotQty ?? existing.lotQty
    const remainingAfterPatch = mergedLotQty - existing.goodQty - existing.defectQty

    const data: Prisma.ProductionLotUpdateInput = {
      ...(b.lotNo !== undefined ? { lotNo: b.lotNo } : {}),
      ...(b.lotQty !== undefined ? { lotQty: b.lotQty } : {}),
      ...(b.woId !== undefined ? { woId: b.woId } : {}),
      ...(b.workCenterId !== undefined ? { workCenterId: b.workCenterId } : {}),
      ...(b.status !== undefined ? { status: b.status as LotStatus } : {}),
      ...(b.currentProcessId !== undefined ? { currentProcessId: b.currentProcessId } : {}),
      ...(b.currentStatus !== undefined ? { currentStatus: b.currentStatus } : {}),
    }
    if (remainingAfterPatch <= 0) {
      data.status = LotStatus.DONE
    }
    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.productionLot.update({
        where: { id },
        data,
        select: { id: true, lotNo: true },
      })
      if (b.lotNo !== undefined) {
        await syncProductionLotBarcode(tx, updated.id, updated.lotNo)
      }
      return tx.productionLot.findUniqueOrThrow({
        where: { id },
        select: listSelect,
      })
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionLotsRouter.delete('/lots/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.productionLot.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
