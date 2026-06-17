import { Router } from 'express'
import { z } from 'zod'
import { InventoryTxRefType, InventoryTxType, MaterialLotStatus, Prisma, ShipmentStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { issueMaterialInTx } from '../lib/issueMaterialInTx'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

export const mesTransactionsRouter = Router()

const issueMaterialBody = z.object({
  productionLotId: z.number().int().positive(),
  materialLotId: z.number().int().positive(),
  usedQty: z.union([z.number().positive(), z.string().trim().min(1)]),
  woId: z.number().int().positive().optional().nullable(),
  createdBy: z.number().int().positive().optional().nullable(),
})

/**
 * 자재 LOT에서 생산 LOT으로 투입: material_lot 잔량 차감, lot_material_usage, lot_history,
 * (해당 자재 LOT 재고가 있으면) inventory 차감 + inventory_transaction OUT,
 * (woId 있으면) work_order_material.issuedQty 증가.
 */
mesTransactionsRouter.post('/transactions/issue-material', async (req, res) => {
  const parsed = issueMaterialBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  const used = new Prisma.Decimal(typeof b.usedQty === 'string' ? b.usedQty : String(b.usedQty))
  if (used.lte(0)) {
    return res.status(400).json({ ok: false, error: 'INVALID_QTY', message: 'usedQty must be positive' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const issued = await issueMaterialInTx(tx, {
        productionLotId: b.productionLotId,
        materialLotId: b.materialLotId,
        usedQty: used,
        woId: b.woId,
        createdBy: b.createdBy,
        applyWorkOrderMaterial: true,
      })
      if ('code' in issued) {
        const status =
          issued.code === 'PRODUCTION_LOT_NOT_FOUND' || issued.code === 'MATERIAL_LOT_NOT_FOUND'
            ? 404
            : 400
        return { status, body: { ok: false, error: issued.code, message: issued.message } }
      }

      const mlAfter = await tx.materialLot.findUnique({
        where: { id: b.materialLotId },
        select: { remainQty: true },
      })

      return {
        status: 201 as const,
        body: {
          ok: true,
          lot_material_usage_id: issued.usageId,
          production_lot_id: b.productionLotId,
          material_lot_id: b.materialLotId,
          remain_qty: mlAfter?.remainQty.toString() ?? '',
        },
      }
    })

    return res.status(result.status).json(result.body)
  } catch (e) {
    return prismaFail(res, e)
  }
})

const receiveMaterialBody = z.object({
  materialLotId: z.number().int().positive(),
  qty: z.number().int().positive(),
  locationId: z.number().int().positive().optional().nullable(),
  createdBy: z.number().int().positive().optional().nullable(),
})

/** 자재 LOT 기준 재고 입고(IN): inventory 생성/증가 + inventory_transaction */
mesTransactionsRouter.post('/transactions/receive-material-inventory', async (req, res) => {
  const parsed = receiveMaterialBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM material_lot WHERE id = ${b.materialLotId} FOR UPDATE`

      const ml = await tx.materialLot.findUnique({
        where: { id: b.materialLotId },
        select: { id: true, productId: true, lotNo: true, remainQty: true, status: true },
      })
      if (!ml) {
        return { status: 404 as const, body: { ok: false, error: 'MATERIAL_LOT_NOT_FOUND' } }
      }

      if (b.locationId != null) {
        await tx.$queryRaw`
          SELECT id FROM inventory
          WHERE material_lot_id = ${b.materialLotId} AND location_id = ${b.locationId}
          FOR UPDATE
        `
      } else {
        await tx.$queryRaw`
          SELECT id FROM inventory
          WHERE material_lot_id = ${b.materialLotId} AND location_id IS NULL
          FOR UPDATE
        `
      }

      const invWhere: Prisma.InventoryWhereInput = {
        materialLotId: b.materialLotId,
        lotId: null,
        locationId: b.locationId == null ? null : b.locationId,
      }

      let inv = await tx.inventory.findFirst({ where: invWhere, select: { id: true, qty: true } })
      const rowAfter = (inv?.qty ?? 0) + b.qty

      // 전→후 표시는 LOT/자재LOT이 달라도 같은 품목 기준 합계로 기록
      await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${ml.productId} FOR UPDATE`
      const productQtyAgg = await tx.inventory.aggregate({
        where: { productId: ml.productId },
        _sum: { qty: true },
      })
      const before = productQtyAgg._sum.qty ?? 0
      const after = before + b.qty

      if (!inv) {
        inv = await tx.inventory.create({
          data: {
            productId: ml.productId,
            materialLotId: b.materialLotId,
            locationId: b.locationId ?? undefined,
            qty: b.qty,
            status: 'AVAILABLE',
          },
          select: { id: true, qty: true },
        })
      } else {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { qty: { increment: b.qty } },
        })
      }

      await tx.inventoryTransaction.create({
        data: {
          productId: ml.productId,
          materialLotId: b.materialLotId,
          locationId: b.locationId ?? undefined,
          transactionType: InventoryTxType.IN,
          qty: b.qty,
          refType: InventoryTxRefType.ADJUST,
          refId: b.materialLotId,
          beforeQty: before,
          afterQty: after,
          createdBy: b.createdBy ?? undefined,
        },
      })

      return {
        status: 201 as const,
        body: { ok: true, inventory_id: inv.id, qty_after: rowAfter },
      }
    })

    return res.status(result.status).json(result.body)
  } catch (e) {
    return prismaFail(res, e)
  }
})

const stockMovementBody = z
  .object({
    productId: z.number().int().positive(),
    movementType: z.enum(['IN', 'OUT']),
    qty: z.number().int().positive(),
    locationId: z.number().int().positive().optional().nullable(),
    lotId: z.number().int().positive().optional().nullable(),
    materialLotId: z.number().int().positive().optional().nullable(),
    materialLotNo: z.string().trim().max(64).optional().nullable(),
    remark: z.string().trim().max(200).optional().nullable(),
    createdBy: z.number().int().positive().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.lotId != null && v.materialLotId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lotId와 materialLotId는 동시에 지정할 수 없습니다.',
        path: ['lotId'],
      })
    }
  })

/**
 * 범용 입출고: 원자재/반제품/완제품 공용.
 * - LOT / 자재LOT 지정 가능(선택)
 * - 재고 행 증감 + inventory_transaction(IN/OUT, ADJUST) 기록
 */
mesTransactionsRouter.post('/transactions/stock-movements', async (req, res) => {
  const parsed = stockMovementBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const manualRemark = (b.remark ?? '').trim() || (b.movementType === 'IN' ? '수동 입고 등록' : '수동 출고 등록')
      const product = await tx.product.findUnique({
        where: { id: b.productId },
        select: { id: true, itemType: true },
      })
      if (!product) return { status: 404 as const, body: { ok: false, error: 'PRODUCT_NOT_FOUND' } }
      const itemType = product.itemType.trim().toUpperCase()
      const isRaw = itemType === 'RAW'
      const qtyDec = new Prisma.Decimal(b.qty)

      if (b.lotId != null) {
        const lot = await tx.productionLot.findUnique({
          where: { id: b.lotId },
          select: { id: true, productId: true },
        })
        if (!lot) return { status: 404 as const, body: { ok: false, error: 'LOT_NOT_FOUND' } }
        if (lot.productId !== b.productId) {
          return {
            status: 400 as const,
            body: { ok: false, error: 'PRODUCT_MISMATCH', message: '선택한 생산 LOT의 품목이 다릅니다.' },
          }
        }
      }
      let resolvedMaterialLotId = b.materialLotId ?? null

      if (resolvedMaterialLotId != null) {
        const ml = await tx.materialLot.findUnique({
          where: { id: resolvedMaterialLotId },
          select: { id: true, productId: true },
        })
        if (!ml) return { status: 404 as const, body: { ok: false, error: 'MATERIAL_LOT_NOT_FOUND' } }
        if (ml.productId !== b.productId) {
          return {
            status: 400 as const,
            body: { ok: false, error: 'PRODUCT_MISMATCH', message: '선택한 자재 LOT의 품목이 다릅니다.' },
          }
        }
      }

      // 원자재 입고: LOT번호 입력 시 material_lot 생성/연결 + received/remain 증가
      if (isRaw && b.movementType === 'IN') {
        const lotNo = (b.materialLotNo ?? '').trim()
        if (!lotNo && resolvedMaterialLotId == null) {
          return {
            status: 400 as const,
            body: { ok: false, error: 'MATERIAL_LOT_REQUIRED', message: '원자재 입고 시 자재 LOT 번호를 입력하세요.' },
          }
        }

        if (lotNo) {
          const found = await tx.materialLot.findFirst({
            where: { productId: b.productId, lotNo },
            orderBy: { id: 'asc' },
            select: { id: true, receivedQty: true, remainQty: true },
          })
          if (!found) {
            const created = await tx.materialLot.create({
              data: {
                lotNo,
                productId: b.productId,
                receivedQty: qtyDec,
                remainQty: qtyDec,
                receivedDate: new Date(),
                status: MaterialLotStatus.AVAILABLE,
              },
              select: { id: true },
            })
            resolvedMaterialLotId = created.id
          } else {
            resolvedMaterialLotId = found.id
            await tx.materialLot.update({
              where: { id: found.id },
              data: {
                receivedQty: found.receivedQty.add(qtyDec),
                remainQty: found.remainQty.add(qtyDec),
                status: MaterialLotStatus.AVAILABLE,
              },
            })
          }
        } else if (resolvedMaterialLotId != null) {
          const lock = await tx.materialLot.findUnique({
            where: { id: resolvedMaterialLotId },
            select: { receivedQty: true, remainQty: true },
          })
          if (!lock) return { status: 404 as const, body: { ok: false, error: 'MATERIAL_LOT_NOT_FOUND' } }
          await tx.materialLot.update({
            where: { id: resolvedMaterialLotId },
            data: {
              receivedQty: lock.receivedQty.add(qtyDec),
              remainQty: lock.remainQty.add(qtyDec),
              status: MaterialLotStatus.AVAILABLE,
            },
          })
        }
      }

      // 품목 기준 합계 전/후 계산용 lock
      await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${b.productId} FOR UPDATE`
      const totalAgg = await tx.inventory.aggregate({
        where: { productId: b.productId },
        _sum: { qty: true },
      })
      const beforeQty = totalAgg._sum.qty ?? 0
      let runningQty = beforeQty

      const baseWhere: Prisma.InventoryWhereInput = {
        productId: b.productId,
        lotId: b.lotId ?? null,
        materialLotId: resolvedMaterialLotId ?? null,
      }
      const targetWhere: Prisma.InventoryWhereInput =
        b.locationId == null ? baseWhere : { ...baseWhere, locationId: b.locationId }

      let inv = await tx.inventory.findFirst({
        where: targetWhere,
        orderBy: { id: 'asc' },
        select: { id: true, qty: true, locationId: true },
      })

      if (b.movementType === 'OUT') {
        if (isRaw && resolvedMaterialLotId == null) {
          // 원자재 출고에서 LOT 미지정이면 자재LOT FIFO 소진
          const fifoLots = await tx.materialLot.findMany({
            where: {
              productId: b.productId,
              status: { in: [MaterialLotStatus.AVAILABLE, MaterialLotStatus.HOLD] },
              remainQty: { gt: new Prisma.Decimal(0) },
            },
            orderBy: [{ receivedDate: 'asc' }, { id: 'asc' }],
            select: { id: true, remainQty: true },
          })
          let totalUsable = 0
          const lotInvAvail = new Map<number, number>()
          for (const ml of fifoLots) {
            const invAgg = await tx.inventory.aggregate({
              where: {
                productId: b.productId,
                materialLotId: ml.id,
                ...(b.locationId == null ? {} : { locationId: b.locationId }),
              },
              _sum: { qty: true },
            })
            const invAvail = invAgg._sum.qty ?? 0
            lotInvAvail.set(ml.id, invAvail)
            totalUsable += Math.min(ml.remainQty.toNumber(), invAvail)
          }
          if (totalUsable < b.qty) {
            return {
              status: 400 as const,
              body: { ok: false, error: 'INSUFFICIENT_STOCK', message: `자재 LOT 가용량 부족: 현재 ${totalUsable}, 요청 ${b.qty}` },
            }
          }
          let need = b.qty
          for (const ml of fifoLots) {
            if (need <= 0) break
            const take = Math.min(need, ml.remainQty.toNumber(), lotInvAvail.get(ml.id) ?? 0)
            if (take <= 0) continue
            const afterRemain = ml.remainQty.minus(take)
            await tx.materialLot.update({
              where: { id: ml.id },
              data: {
                remainQty: afterRemain,
                status: afterRemain.lte(0) ? MaterialLotStatus.USED : MaterialLotStatus.AVAILABLE,
              },
            })
            const invRows = await tx.inventory.findMany({
              where: {
                productId: b.productId,
                materialLotId: ml.id,
                ...(b.locationId == null ? {} : { locationId: b.locationId }),
              },
              orderBy: { id: 'asc' },
              select: { id: true, qty: true, locationId: true },
            })
            let left = take
            for (const row of invRows) {
              if (left <= 0) break
              const dec = Math.min(left, row.qty)
              if (dec <= 0) continue
              await tx.inventory.update({
                where: { id: row.id },
                data: { qty: { decrement: dec } },
              })
              await tx.inventoryTransaction.create({
                data: {
                  productId: b.productId,
                  materialLotId: ml.id,
                  locationId: row.locationId ?? undefined,
                  transactionType: InventoryTxType.OUT,
                  qty: dec,
                  refType: InventoryTxRefType.ADJUST,
                  refId: ml.id,
                  beforeQty: runningQty,
                  afterQty: runningQty - dec,
                  remark: manualRemark,
                  createdBy: b.createdBy ?? undefined,
                },
              })
              runningQty -= dec
              left -= dec
            }
            if (left > 0) {
              return {
                status: 400 as const,
                body: {
                  ok: false,
                  error: 'INSUFFICIENT_STOCK',
                  message: '자재 LOT 잔량은 충분하지만 재고 행이 부족합니다. 재고 정합성을 확인하세요.',
                },
              }
            }
            need -= take
          }
          return {
            status: 201 as const,
            body: {
              ok: true,
              movementType: b.movementType,
              productId: b.productId,
              qty: b.qty,
              beforeQty,
              afterQty: runningQty,
            },
          }
        }

        if (!inv) {
          return {
            status: 400 as const,
            body: {
              ok: false,
              error: 'INSUFFICIENT_STOCK',
              message: '출고 대상 재고 행이 없습니다. LOT/위치 조건을 확인하세요.',
            },
          }
        }
        if (inv.qty < b.qty) {
          return {
            status: 400 as const,
            body: {
              ok: false,
              error: 'INSUFFICIENT_STOCK',
              message: `재고 부족: 현재 ${inv.qty}, 요청 ${b.qty}`,
            },
          }
        }
        if (resolvedMaterialLotId != null) {
          const ml = await tx.materialLot.findUnique({
            where: { id: resolvedMaterialLotId },
            select: { id: true, remainQty: true },
          })
          if (!ml) return { status: 404 as const, body: { ok: false, error: 'MATERIAL_LOT_NOT_FOUND' } }
          if (ml.remainQty.lt(qtyDec)) {
            return {
              status: 400 as const,
              body: {
                ok: false,
                error: 'INSUFFICIENT_STOCK',
                message: `자재 LOT 잔량 부족: 현재 ${ml.remainQty.toString()}, 요청 ${qtyDec.toString()}`,
              },
            }
          }
        }
        await tx.inventory.update({
          where: { id: inv.id },
          data: { qty: { decrement: b.qty } },
        })
        if (resolvedMaterialLotId != null) {
          const ml = await tx.materialLot.findUnique({
            where: { id: resolvedMaterialLotId },
            select: { id: true, remainQty: true },
          })
          if (!ml) return { status: 404 as const, body: { ok: false, error: 'MATERIAL_LOT_NOT_FOUND' } }
          const nextRemain = ml.remainQty.minus(qtyDec)
          await tx.materialLot.update({
            where: { id: resolvedMaterialLotId },
            data: {
              remainQty: nextRemain,
              status: nextRemain.lte(0) ? MaterialLotStatus.USED : MaterialLotStatus.AVAILABLE,
            },
          })
        }
      } else if (!inv) {
        inv = await tx.inventory.create({
          data: {
            productId: b.productId,
            lotId: b.lotId ?? undefined,
            materialLotId: resolvedMaterialLotId ?? undefined,
            locationId: b.locationId ?? undefined,
            qty: b.qty,
            status: 'AVAILABLE',
          },
          select: { id: true, qty: true, locationId: true },
        })
      } else {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { qty: { increment: b.qty } },
        })
      }

      const afterQty = b.movementType === 'IN' ? beforeQty + b.qty : beforeQty - b.qty
      await tx.inventoryTransaction.create({
        data: {
          productId: b.productId,
          lotId: b.lotId ?? undefined,
          materialLotId: resolvedMaterialLotId ?? undefined,
          locationId: inv?.locationId ?? b.locationId ?? undefined,
          transactionType: b.movementType === 'IN' ? InventoryTxType.IN : InventoryTxType.OUT,
          qty: b.qty,
          refType: InventoryTxRefType.ADJUST,
          refId: b.lotId ?? resolvedMaterialLotId ?? b.productId,
          beforeQty,
          afterQty,
          remark: manualRemark,
          createdBy: b.createdBy ?? undefined,
        },
      })

      return {
        status: 201 as const,
        body: {
          ok: true,
          movementType: b.movementType,
          productId: b.productId,
          qty: b.qty,
          beforeQty,
          afterQty,
        },
      }
    })

    return res.status(result.status).json(result.body)
  } catch (e) {
    return prismaFail(res, e)
  }
})

async function recomputeInventoryTxRunningByProduct(tx: Prisma.TransactionClient, productId: number) {
  const rows = await tx.inventoryTransaction.findMany({
    where: { productId, transactionType: { in: [InventoryTxType.IN, InventoryTxType.OUT] } },
    select: { id: true, transactionType: true, qty: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  let running = 0
  for (const r of rows) {
    const before = running
    running += r.transactionType === InventoryTxType.IN ? r.qty : -r.qty
    await tx.inventoryTransaction.update({
      where: { id: r.id },
      data: { beforeQty: before, afterQty: running },
    })
  }
}

mesTransactionsRouter.delete('/transactions/stock-movements/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const result = await prisma.$transaction(async (tx) => {
      const t = await tx.inventoryTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          productId: true,
          lotId: true,
          materialLotId: true,
          locationId: true,
          transactionType: true,
          qty: true,
          refType: true,
        },
      })
      if (!t) return { status: 404 as const, body: { ok: false, error: 'NOT_FOUND' } }
      if (t.refType !== InventoryTxRefType.ADJUST || (t.transactionType !== InventoryTxType.IN && t.transactionType !== InventoryTxType.OUT)) {
        return {
          status: 400 as const,
          body: { ok: false, error: 'NOT_DELETABLE', message: '입출고관리 수동(ADJUST) IN/OUT 이력만 삭제할 수 있습니다.' },
        }
      }

      await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${t.productId} FOR UPDATE`
      const invRows = await tx.inventory.findMany({
        where: {
          productId: t.productId,
          lotId: t.lotId ?? null,
          materialLotId: t.materialLotId ?? null,
          locationId: t.locationId ?? null,
        },
        orderBy: { id: 'asc' },
        select: { id: true, qty: true },
      })

      if (t.transactionType === InventoryTxType.IN) {
        let needOut = t.qty
        for (const row of invRows) {
          if (needOut <= 0) break
          const dec = Math.min(needOut, row.qty)
          if (dec <= 0) continue
          await tx.inventory.update({ where: { id: row.id }, data: { qty: { decrement: dec } } })
          needOut -= dec
        }
        if (needOut > 0) {
          return {
            status: 400 as const,
            body: { ok: false, error: 'INSUFFICIENT_STOCK', message: '삭제하려는 입고 이력을 되돌릴 재고가 부족합니다.' },
          }
        }
      } else {
        const row = invRows[0]
        if (!row) {
          await tx.inventory.create({
            data: {
              productId: t.productId,
              lotId: t.lotId ?? undefined,
              materialLotId: t.materialLotId ?? undefined,
              locationId: t.locationId ?? undefined,
              qty: t.qty,
              status: 'AVAILABLE',
            },
          })
        } else {
          await tx.inventory.update({ where: { id: row.id }, data: { qty: { increment: t.qty } } })
        }
      }

      if (t.materialLotId != null) {
        const ml = await tx.materialLot.findUnique({
          where: { id: t.materialLotId },
          select: { id: true, receivedQty: true, remainQty: true },
        })
        if (!ml) return { status: 404 as const, body: { ok: false, error: 'MATERIAL_LOT_NOT_FOUND' } }
        const q = new Prisma.Decimal(t.qty)
        if (t.transactionType === InventoryTxType.IN) {
          if (ml.receivedQty.lt(q) || ml.remainQty.lt(q)) {
            return {
              status: 400 as const,
              body: { ok: false, error: 'INVALID_ROLLBACK', message: '자재 LOT 수량이 부족하여 입고 삭제를 되돌릴 수 없습니다.' },
            }
          }
          const nextReceived = ml.receivedQty.minus(q)
          const nextRemain = ml.remainQty.minus(q)
          await tx.materialLot.update({
            where: { id: t.materialLotId },
            data: {
              receivedQty: nextReceived,
              remainQty: nextRemain,
              status: nextRemain.lte(0) ? MaterialLotStatus.USED : MaterialLotStatus.AVAILABLE,
            },
          })
        } else {
          await tx.materialLot.update({
            where: { id: t.materialLotId },
            data: {
              remainQty: ml.remainQty.add(q),
              status: MaterialLotStatus.AVAILABLE,
            },
          })
        }
      }

      await tx.inventoryTransaction.delete({ where: { id: t.id } })
      await recomputeInventoryTxRunningByProduct(tx, t.productId)
      return { status: 200 as const, body: { ok: true } }
    })
    return res.status(result.status).json(result.body)
  } catch (e) {
    return prismaFail(res, e)
  }
})

/**
 * 출하 확정: READY만 가능, 라인별 재고 차감 + inventory_transaction OUT(SHIPMENT),
 * shipment 상태 SHIPPED.
 */
mesTransactionsRouter.post('/transactions/shipments/:id/confirm', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shipment WHERE id = ${id} FOR UPDATE`

      const ship = await tx.shipment.findUnique({
        where: { id },
        include: {
          details: {
            include: {
              product: { select: { productName: true } },
              lot: { select: { lotNo: true, productId: true } },
            },
          },
        },
      })
      if (!ship) {
        return { status: 404 as const, body: { ok: false, error: 'SHIPMENT_NOT_FOUND' } }
      }
      if (ship.status !== ShipmentStatus.READY) {
        return {
          status: 400 as const,
          body: { ok: false, error: 'SHIPMENT_NOT_READY', message: 'READY 상태의 출하만 확정할 수 있습니다.' },
        }
      }
      if (ship.details.length === 0) {
        return { status: 400 as const, body: { ok: false, error: 'NO_LINES', message: '출하 라인이 없습니다.' } }
      }

      const lockedProducts = new Set<number>()
      const runningQtyByProduct = new Map<number, number>()
      const ensureProductRunning = async (productId: number) => {
        if (!lockedProducts.has(productId)) {
          await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${productId} FOR UPDATE`
          lockedProducts.add(productId)
        }
        if (!runningQtyByProduct.has(productId)) {
          const agg = await tx.inventory.aggregate({
            where: { productId },
            _sum: { qty: true },
          })
          runningQtyByProduct.set(productId, agg._sum.qty ?? 0)
        }
        return runningQtyByProduct.get(productId) ?? 0
      }

      for (const d of ship.details) {
        await ensureProductRunning(d.productId)

        // 출하는 생산 LOT를 수동 선택하지 않고, LOT FIFO로 자동 배정한다.
        // 1) 생산 LOT 재고(LOT 있는 행) FIFO
        // 2) 보조로 LOT 없는 일반 재고 행
        const lotRows = await tx.inventory.findMany({
          where: {
            productId: d.productId,
            lotId: { not: null },
            materialLotId: null,
            qty: { gt: 0 },
          },
          orderBy: [{ lotId: 'asc' }, { id: 'asc' }],
          select: { id: true, qty: true, locationId: true, lotId: true, materialLotId: true },
        })
        const looseRows = await tx.inventory.findMany({
          where: {
            productId: d.productId,
            lotId: null,
            materialLotId: null,
            qty: { gt: 0 },
          },
          orderBy: { id: 'asc' },
          select: { id: true, qty: true, locationId: true, lotId: true, materialLotId: true },
        })
        const invRows = [...lotRows, ...looseRows]
        const totalAvail = invRows.reduce((acc, r) => acc + r.qty, 0)
        if (totalAvail < d.qty) {
          return {
            status: 400 as const,
            body: {
              ok: false,
              error: 'INSUFFICIENT_STOCK',
              message: `라인 ${d.id}: 품목 ${d.product?.productName ?? d.productId} 재고 부족`,
              detail_id: d.id,
            },
          }
        }

        let need = d.qty
        for (const row of invRows) {
          if (need <= 0) break
          const dec = Math.min(need, row.qty)
          if (dec <= 0) continue
          await tx.inventory.update({
            where: { id: row.id },
            data: { qty: { decrement: dec } },
          })

          const beforeQty = runningQtyByProduct.get(d.productId) ?? 0
          const afterQty = beforeQty - dec
          await tx.inventoryTransaction.create({
            data: {
              productId: d.productId,
              lotId: row.lotId ?? undefined,
              materialLotId: row.materialLotId ?? undefined,
              locationId: row.locationId ?? undefined,
              transactionType: InventoryTxType.OUT,
              qty: dec,
              refType: InventoryTxRefType.SHIPMENT,
              refId: ship.id,
              beforeQty,
              afterQty,
              remark: `출하 ${ship.shipmentNo} · ${ship.customerName}`,
            },
          })
          runningQtyByProduct.set(d.productId, afterQty)
          need -= dec
        }
      }

      await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.SHIPPED,
          shipmentDate: new Date(),
        },
      })

      return { status: 200 as const, body: { ok: true, shipment_id: id, status: 'SHIPPED' } }
    })

    return res.status(result.status).json(result.body)
  } catch (e) {
    return prismaFail(res, e)
  }
})
