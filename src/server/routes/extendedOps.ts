import { Router } from 'express'
import { z } from 'zod'
import {
  BarcodeRecordStatus,
  BarcodeType,
  MaterialLotStatus,
  OutsourcingStatus,
  PlanStatus,
  Prisma,
  ShipmentStatus,
  UseYn,
  WorkOrderStatus,
} from '@prisma/client'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

const woListInclude = {
  product: { select: { productCode: true, productName: true } },
  plan: { select: { planNo: true } },
  workCenter: { select: { centerCode: true, centerName: true } },
  assignedWorkers: {
    include: {
      worker: { select: { id: true, workerCode: true, workerName: true } },
    },
  },
} as const satisfies Prisma.WorkOrderInclude

/** 유효한 작업자 ID만 남긴 배열. 존재하지 않는 ID가 있으면 null. */
async function normalizeWorkerIds(workerIds: number[] | undefined): Promise<number[] | null> {
  if (workerIds == null || workerIds.length === 0) return []
  const unique = [...new Set(workerIds)].filter((id) => Number.isInteger(id) && id > 0)
  if (unique.length === 0) return []
  const cnt = await prisma.worker.count({ where: { id: { in: unique } } })
  if (cnt !== unique.length) return null
  return unique
}

export const extendedOpsRouter = Router()

/* —— 공정 라우팅 (조회) —— */
extendedOpsRouter.get('/process-routings', async (_req, res) => {
  try {
    const items = await prisma.processRouting.findMany({
      take: 500,
      orderBy: { id: 'asc' },
      include: {
        product: { select: { productCode: true, productName: true } },
        fromProcess: { select: { processCode: true, processName: true } },
        toProcess: { select: { processCode: true, processName: true } },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 생산 계획 —— */
extendedOpsRouter.get('/production-plans', async (_req, res) => {
  try {
    const items = await prisma.productionPlan.findMany({
      take: 300,
      orderBy: { id: 'desc' },
      include: { product: { select: { productCode: true, productName: true } } },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const planBody = z.object({
  planNo: z.string().trim().min(1).max(64),
  productId: z.number().int().positive(),
  planQty: z.number().int().positive(),
  startDate: z.string().min(8).max(32),
  endDate: z.string().min(8).max(32),
  priority: z.string().optional().nullable(),
  status: z.nativeEnum(PlanStatus).optional(),
  remark: z.string().optional().nullable(),
})

extendedOpsRouter.post('/production-plans', async (req, res) => {
  const p = planBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.productionPlan.create({
      data: {
        planNo: b.planNo,
        productId: b.productId,
        planQty: b.planQty,
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        priority: b.priority ?? undefined,
        status: b.status ?? PlanStatus.PLANNED,
        remark: b.remark ?? undefined,
      },
      include: { product: { select: { productCode: true, productName: true } } },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.patch('/production-plans/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = planBody.partial().omit({ planNo: true }).safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const item = await prisma.productionPlan.update({
      where: { id },
      data: {
        ...(b.productId !== undefined ? { productId: b.productId } : {}),
        ...(b.planQty !== undefined ? { planQty: b.planQty } : {}),
        ...(b.startDate !== undefined ? { startDate: new Date(b.startDate) } : {}),
        ...(b.endDate !== undefined ? { endDate: new Date(b.endDate) } : {}),
        ...(b.priority !== undefined ? { priority: b.priority } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.remark !== undefined ? { remark: b.remark } : {}),
      },
      include: { product: { select: { productCode: true, productName: true } } },
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.delete('/production-plans/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.productionPlan.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 작업 지시 —— */
extendedOpsRouter.get('/work-orders', async (_req, res) => {
  try {
    const items = await prisma.workOrder.findMany({
      take: 400,
      orderBy: { id: 'desc' },
      include: woListInclude,
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const woBody = z.object({
  woNo: z.string().trim().min(1).max(64),
  planId: z.number().int().positive().optional().nullable(),
  productId: z.number().int().positive(),
  orderQty: z.number().int().positive(),
  workCenterId: z.number().int().positive().optional().nullable(),
  status: z.nativeEnum(WorkOrderStatus).optional(),
  holdReason: z.string().trim().max(2000).optional().nullable(),
  priority: z.string().optional().nullable(),
  remark: z.string().optional().nullable(),
  workerIds: z.array(z.number().int().positive()).max(50).optional(),
})

function resolveWorkOrderHoldFields(
  status: WorkOrderStatus,
  holdReason: string | null | undefined,
): { holdReason: string | null } | { error: string } {
  if (status === WorkOrderStatus.HOLD) {
    const reason = holdReason?.trim() ?? ''
    if (!reason) return { error: '보류 상태일 때 보류 사유를 입력해야 합니다.' }
    return { holdReason: reason }
  }
  return { holdReason: null }
}

extendedOpsRouter.post('/work-orders', async (req, res) => {
  const p = woBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  const workerIds = b.workerIds ?? []
  const status = b.status ?? WorkOrderStatus.READY
  const holdFields = resolveWorkOrderHoldFields(status, b.holdReason)
  if ('error' in holdFields) {
    return res.status(400).json({ ok: false, error: 'HOLD_REASON_REQUIRED', message: holdFields.error })
  }
  try {
    const uniqueWorkers = await normalizeWorkerIds(workerIds)
    if (uniqueWorkers === null) {
      return res.status(400).json({ ok: false, error: 'INVALID_WORKER_IDS', message: '존재하지 않는 작업자가 포함되어 있습니다.' })
    }
    const item = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          woNo: b.woNo,
          planId: b.planId ?? undefined,
          productId: b.productId,
          orderQty: b.orderQty,
          workCenterId: b.workCenterId ?? undefined,
          status,
          holdReason: holdFields.holdReason,
          priority: b.priority ?? undefined,
          remark: b.remark ?? undefined,
        },
        select: { id: true },
      })
      if (uniqueWorkers.length > 0) {
        await tx.workOrderWorker.createMany({
          data: uniqueWorkers.map((workerId) => ({ woId: wo.id, workerId })),
        })
      }
      return tx.workOrder.findUniqueOrThrow({
        where: { id: wo.id },
        include: woListInclude,
      })
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.patch('/work-orders/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = woBody.partial().omit({ woNo: true }).safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  const workerIds = b.workerIds
  try {
    const current = await prisma.workOrder.findUnique({
      where: { id },
      select: { status: true, holdReason: true },
    })
    if (!current) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const nextStatus = b.status ?? current.status
    const holdReasonInput =
      b.holdReason !== undefined
        ? b.holdReason
        : nextStatus === WorkOrderStatus.HOLD && current.status === WorkOrderStatus.HOLD
          ? current.holdReason
          : undefined
    const holdFields = resolveWorkOrderHoldFields(nextStatus, holdReasonInput)
    if ('error' in holdFields) {
      return res.status(400).json({ ok: false, error: 'HOLD_REASON_REQUIRED', message: holdFields.error })
    }

    let uniqueWorkers: number[] | null | undefined
    if (workerIds !== undefined) {
      uniqueWorkers = await normalizeWorkerIds(workerIds)
      if (uniqueWorkers === null) {
        return res.status(400).json({ ok: false, error: 'INVALID_WORKER_IDS', message: '존재하지 않는 작업자가 포함되어 있습니다.' })
      }
    }
    const item = await prisma.$transaction(async (tx) => {
      const data: Prisma.WorkOrderUpdateInput = {
        ...(b.planId !== undefined ? { planId: b.planId } : {}),
        ...(b.productId !== undefined ? { productId: b.productId } : {}),
        ...(b.orderQty !== undefined ? { orderQty: b.orderQty } : {}),
        ...(b.workCenterId !== undefined ? { workCenterId: b.workCenterId } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.status !== undefined || b.holdReason !== undefined ? { holdReason: holdFields.holdReason } : {}),
        ...(b.priority !== undefined ? { priority: b.priority } : {}),
        ...(b.remark !== undefined ? { remark: b.remark } : {}),
      }
      if (Object.keys(data).length > 0) {
        await tx.workOrder.update({ where: { id }, data })
      }
      if (uniqueWorkers !== undefined) {
        await tx.workOrderWorker.deleteMany({ where: { woId: id } })
        if (uniqueWorkers.length > 0) {
          await tx.workOrderWorker.createMany({
            data: uniqueWorkers.map((workerId) => ({ woId: id, workerId })),
          })
        }
      }
      return tx.workOrder.findUniqueOrThrow({
        where: { id },
        include: woListInclude,
      })
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.delete('/work-orders/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.workOrder.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.get('/work-orders/:id/materials', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const items = await prisma.workOrderMaterial.findMany({
      where: { woId: id },
      orderBy: { id: 'asc' },
      include: { materialProduct: { select: { productCode: true, productName: true } } },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 자재 LOT —— */
extendedOpsRouter.get('/material-lots', async (_req, res) => {
  try {
    const items = await prisma.materialLot.findMany({
      take: 400,
      orderBy: { id: 'desc' },
      include: { product: { select: { productCode: true, productName: true } } },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const matLotBody = z.object({
  lotNo: z.string().trim().min(1).max(64),
  productId: z.number().int().positive(),
  supplier: z.string().optional().nullable(),
  receivedQty: z.union([z.number().positive(), z.string()]),
  remainQty: z.union([z.number().nonnegative(), z.string()]).optional(),
  receivedDate: z.string().min(8).max(32),
  status: z.nativeEnum(MaterialLotStatus).optional(),
})

extendedOpsRouter.post('/material-lots', async (req, res) => {
  const p = matLotBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  const rq = String(b.receivedQty)
  const rem = b.remainQty != null ? String(b.remainQty) : rq
  try {
    const item = await prisma.materialLot.create({
      data: {
        lotNo: b.lotNo,
        productId: b.productId,
        supplier: b.supplier ?? undefined,
        receivedQty: rq,
        remainQty: rem,
        receivedDate: new Date(b.receivedDate),
        status: b.status ?? MaterialLotStatus.AVAILABLE,
      },
      include: { product: { select: { productCode: true, productName: true } } },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.delete('/material-lots/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.materialLot.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 출하 —— */
extendedOpsRouter.get('/shipments', async (_req, res) => {
  try {
    const items = await prisma.shipment.findMany({
      take: 200,
      orderBy: { id: 'desc' },
      include: {
        details: {
          take: 50,
          include: {
            product: { select: { productCode: true, productName: true } },
            lot: { select: { lotNo: true } },
          },
        },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const shipBody = z.object({
  shipmentNo: z.string().trim().min(1).max(64),
  customerName: z.string().trim().min(1).max(200),
  shipmentDate: z.string().optional().nullable(),
  status: z.nativeEnum(ShipmentStatus).optional(),
})

extendedOpsRouter.post('/shipments', async (req, res) => {
  const p = shipBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.shipment.create({
      data: {
        shipmentNo: b.shipmentNo,
        customerName: b.customerName,
        shipmentDate: b.shipmentDate ? new Date(b.shipmentDate) : undefined,
        status: b.status ?? ShipmentStatus.READY,
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const shipDetailBody = z.object({
  productId: z.number().int().positive(),
  lotId: z.number().int().positive().optional().nullable(),
  qty: z.number().int().positive(),
})

extendedOpsRouter.post('/shipments/:id/details', async (req, res) => {
  const shipmentId = parsePositiveIntParam(req.params.id)
  if (!shipmentId) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = shipDetailBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.shipmentDetail.create({
      data: {
        shipmentId,
        productId: b.productId,
        lotId: b.lotId ?? undefined,
        qty: b.qty,
      },
      include: {
        product: { select: { productCode: true, productName: true } },
        lot: { select: { lotNo: true } },
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.delete('/shipments/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.shipment.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 외주 —— */
extendedOpsRouter.get('/outsourcing', async (_req, res) => {
  try {
    const items = await prisma.outsourcing.findMany({
      take: 200,
      orderBy: { id: 'desc' },
      include: {
        productionLot: { select: { lotNo: true } },
        process: { select: { processCode: true, processName: true } },
        outLocation: { select: { locationCode: true } },
        inLocation: { select: { locationCode: true } },
        results: true,
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const outBody = z.object({
  outsourcingNo: z.string().trim().min(1).max(64),
  productionLotId: z.number().int().positive(),
  processId: z.number().int().positive(),
  vendorName: z.string().trim().min(1).max(200),
  requestQty: z.number().int().positive(),
  outDate: z.string().optional().nullable(),
  expectedInDate: z.string().optional().nullable(),
  status: z.nativeEnum(OutsourcingStatus).optional(),
  outLocationId: z.number().int().positive().optional().nullable(),
  inLocationId: z.number().int().positive().optional().nullable(),
})

extendedOpsRouter.post('/outsourcing', async (req, res) => {
  const p = outBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.outsourcing.create({
      data: {
        outsourcingNo: b.outsourcingNo,
        productionLotId: b.productionLotId,
        processId: b.processId,
        vendorName: b.vendorName,
        requestQty: b.requestQty,
        outDate: b.outDate ? new Date(b.outDate) : undefined,
        expectedInDate: b.expectedInDate ? new Date(b.expectedInDate) : undefined,
        status: b.status ?? OutsourcingStatus.REQUEST,
        outLocationId: b.outLocationId ?? undefined,
        inLocationId: b.inLocationId ?? undefined,
      },
      include: {
        productionLot: { select: { lotNo: true } },
        process: { select: { processCode: true, processName: true } },
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const outPatchBody = outBody.partial().refine((o) => Object.keys(o).length > 0, { message: 'EMPTY_PATCH' })

extendedOpsRouter.patch('/outsourcing/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = outPatchBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const data: Prisma.OutsourcingUpdateInput = {}
    if (b.outsourcingNo !== undefined) data.outsourcingNo = b.outsourcingNo
    if (b.productionLotId !== undefined) data.productionLot = { connect: { id: b.productionLotId } }
    if (b.processId !== undefined) data.process = { connect: { id: b.processId } }
    if (b.vendorName !== undefined) data.vendorName = b.vendorName
    if (b.requestQty !== undefined) data.requestQty = b.requestQty
    if (b.outDate !== undefined) data.outDate = b.outDate ? new Date(b.outDate) : null
    if (b.expectedInDate !== undefined) data.expectedInDate = b.expectedInDate ? new Date(b.expectedInDate) : null
    if (b.status !== undefined) data.status = b.status
    if (b.outLocationId !== undefined) {
      data.outLocation = b.outLocationId ? { connect: { id: b.outLocationId } } : { disconnect: true }
    }
    if (b.inLocationId !== undefined) {
      data.inLocation = b.inLocationId ? { connect: { id: b.inLocationId } } : { disconnect: true }
    }
    const item = await prisma.outsourcing.update({
      where: { id },
      data,
      include: {
        productionLot: { select: { lotNo: true } },
        process: { select: { processCode: true, processName: true } },
        results: true,
      },
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const outResBody = z.object({
  goodQty: z.number().int().nonnegative(),
  defectQty: z.number().int().nonnegative().optional(),
  inDate: z.string().optional().nullable(),
})

extendedOpsRouter.post('/outsourcing/:id/results', async (req, res) => {
  const outsourcingId = parsePositiveIntParam(req.params.id)
  if (!outsourcingId) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = outResBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.outsourcingResult.create({
      data: {
        outsourcingId,
        goodQty: b.goodQty,
        defectQty: b.defectQty ?? 0,
        inDate: b.inDate ? new Date(b.inDate) : undefined,
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.delete('/outsourcing/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.outsourcing.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 바코드 —— */
extendedOpsRouter.get('/barcodes', async (_req, res) => {
  try {
    const items = await prisma.barcode.findMany({
      take: 400,
      orderBy: { id: 'desc' },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const barcodeBody = z.object({
  barcodeValue: z.string().trim().min(1).max(128),
  barcodeType: z.nativeEnum(BarcodeType),
  refTable: z.string().trim().min(1).max(64),
  refId: z.number().int().positive(),
  isPrimary: z.nativeEnum(UseYn).optional(),
  status: z.nativeEnum(BarcodeRecordStatus).optional(),
})

extendedOpsRouter.post('/barcodes', async (req, res) => {
  const p = barcodeBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.barcode.create({
      data: {
        barcodeValue: b.barcodeValue,
        barcodeType: b.barcodeType,
        refTable: b.refTable,
        refId: b.refId,
        isPrimary: b.isPrimary ?? UseYn.N,
        status: b.status ?? BarcodeRecordStatus.ACTIVE,
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const barcodePatchBody = barcodeBody.partial().refine((o) => Object.keys(o).length > 0, { message: 'EMPTY_PATCH' })

extendedOpsRouter.patch('/barcodes/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = barcodePatchBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const data: Prisma.BarcodeUpdateInput = {}
    if (b.barcodeValue !== undefined) data.barcodeValue = b.barcodeValue
    if (b.barcodeType !== undefined) data.barcodeType = b.barcodeType
    if (b.refTable !== undefined) data.refTable = b.refTable
    if (b.refId !== undefined) data.refId = b.refId
    if (b.isPrimary !== undefined) data.isPrimary = b.isPrimary
    if (b.status !== undefined) data.status = b.status
    const item = await prisma.barcode.update({ where: { id }, data })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.delete('/barcodes/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.barcode.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— LOT 이력 / 자재 투입 (조회만) —— */
function simplifyLotHistoryDesc(raw: string | null, productLabelById: Map<number, string>): string | null {
  if (!raw) return raw

  const resolveProductToken = (token: string): string => {
    const clean = token.trim()
    const id = Number(clean)
    if (Number.isInteger(id) && id > 0) return productLabelById.get(id) ?? `품목ID ${id}`
    return clean
  }

  const withProductName = raw
    .replace(/품목#(\d+)/g, (_, idText: string) => {
      const id = Number(idText)
      const label = Number.isFinite(id) ? productLabelById.get(id) : null
      return label ? `품목 ${label}` : `품목ID ${idText}`
    })
    .replace(/품목ID\s*(\d+)/g, (_, idText: string) => {
      const id = Number(idText)
      const label = Number.isFinite(id) ? productLabelById.get(id) : null
      return label ? `품목 ${label}` : `품목ID ${idText}`
    })
    .replace(/\b자재품목\s+(\d+)\b/g, (_m, idText: string) => `자재품목 ${resolveProductToken(idText)}`)

  const legacyBackflush = withProductName.match(
    /^마지막공정\s+(EBOM|MBOM)\s+백플러시\s+자재품목\s+(.+?)\s+수량\s+(\d+)\s+\(양품\+불량\s+(\d+)×(EBOM|MBOM)\)$/,
  )
  if (legacyBackflush) {
    const material = resolveProductToken(legacyBackflush[2])
    const qty = legacyBackflush[3]
    return `품목 ${material} ${qty}개 자동 출고`
  }

  const legacyNamedBackflush = withProductName.match(/^자재\s+(.+?)\s+백플러시\s+출고\s+(\d+)\s+\(기준\s+(\d+),\s*(EBOM|MBOM)\)$/)
  if (legacyNamedBackflush) {
    const material = resolveProductToken(legacyNamedBackflush[1])
    const qty = legacyNamedBackflush[2]
    return `품목 ${material} ${qty}개 자동 출고`
  }

  const currentBackflush = withProductName.match(/^품목\s+(.+?)\s+(\d+)개\s+출고(?:됨)?\s+\(백플러시\)$/)
  if (currentBackflush) {
    const material = resolveProductToken(currentBackflush[1])
    const qty = currentBackflush[2]
    return `품목 ${material} ${qty}개 자동 출고`
  }

  const numericBackflush =
    withProductName.match(/^(\d+)\s+(\d+)개\s+자동\s+출고$/) ??
    withProductName.match(/^(\d+)\s+(\d+)개\s+출고(?:됨)?$/) ??
    withProductName.match(/^품목\s+(\d+)\s+(\d+)개\s+자동\s+출고$/)
  if (numericBackflush) {
    const material = resolveProductToken(numericBackflush[1])
    const qty = numericBackflush[2]
    return `품목 ${material} ${qty}개 자동 출고`
  }

  const legacyInput = withProductName.match(/^자재투입\s+ML\s+(.+)\s+수량\s+(.+)$/)
  if (legacyInput) {
    const lotNo = legacyInput[1]
    const qty = legacyInput[2]
    return `자재LOT ${lotNo}에서 ${qty}개 사용`
  }

  return withProductName
}

extendedOpsRouter.get('/lot-histories', async (_req, res) => {
  try {
    const items = await prisma.lotHistory.findMany({
      take: 400,
      orderBy: { id: 'desc' },
      include: { productionLot: { select: { lotNo: true } } },
    })
    const productIds = new Set<number>()
    for (const it of items) {
      const text = it.eventDesc ?? ''
      for (const m of text.matchAll(/품목#(\d+)/g)) {
        const id = Number(m[1])
        if (Number.isInteger(id) && id > 0) productIds.add(id)
      }
      for (const m of text.matchAll(/품목ID\s*(\d+)/g)) {
        const id = Number(m[1])
        if (Number.isInteger(id) && id > 0) productIds.add(id)
      }
      const legacy = text.match(/^마지막공정\s+(EBOM|MBOM)\s+백플러시\s+자재품목\s+(\d+)\s+/)
      if (legacy) {
        const id = Number(legacy[2])
        if (Number.isInteger(id) && id > 0) productIds.add(id)
      }
      const numericLine =
        text.match(/^(\d+)\s+\d+개\s+자동\s+출고$/) ??
        text.match(/^(\d+)\s+\d+개\s+출고(?:됨)?$/) ??
        text.match(/^품목\s+(\d+)\s+\d+개\s+자동\s+출고$/)
      if (numericLine) {
        const id = Number(numericLine[1])
        if (Number.isInteger(id) && id > 0) productIds.add(id)
      }
    }

    const products =
      productIds.size > 0
        ? await prisma.product.findMany({
            where: { id: { in: Array.from(productIds) } },
            select: { id: true, productCode: true, productName: true },
          })
        : []
    const productLabelById = new Map<number, string>(products.map((p) => [p.id, p.productName]))

    const mapped = items.map((it) => ({
      ...it,
      eventDesc: simplifyLotHistoryDesc(it.eventDesc, productLabelById),
    }))
    return res.json({ ok: true, items: mapped })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.get('/lot-material-usages', async (_req, res) => {
  try {
    const items = await prisma.lotMaterialUsage.findMany({
      take: 400,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        productionLotId: true,
        materialLotId: true,
        usedQty: true,
        createdAt: true,
        productionLot: { select: { lotNo: true } },
        materialLot: { select: { lotNo: true, productId: true } },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 로그 (조회) —— */
extendedOpsRouter.get('/audit-logs', async (_req, res) => {
  try {
    const items = await prisma.auditLog.findMany({ take: 300, orderBy: { id: 'desc' } })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.get('/system-logs', async (_req, res) => {
  try {
    const items = await prisma.systemLog.findMany({ take: 300, orderBy: { id: 'desc' } })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedOpsRouter.get('/vision-raw-logs', async (_req, res) => {
  try {
    const items = await prisma.visionRawLog.findMany({
      take: 200,
      orderBy: { id: 'desc' },
      include: {
        lot: { select: { lotNo: true } },
        process: { select: { processCode: true, processName: true } },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})
