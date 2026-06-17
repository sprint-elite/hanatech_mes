import { Router } from 'express'
import { z } from 'zod'
import { LotHistoryEventType, LotStatus, MaterialLotStatus, Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { issueMaterialInTx } from '../lib/issueMaterialInTx'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

const defectsSchema = z.object({
  type_id: z.number().int().positive(),
  qty: z.number().int().positive(),
  remark: z.string().trim().min(1).max(200).optional(),
})

const bodySchema = z.object({
  lot_id: z.number().int().positive(),
  process_id: z.number().int().positive(),
  input_qty: z.number().int().nonnegative(),
  good_qty: z.number().int().nonnegative(),
  defect_qty: z.number().int().nonnegative(),
  worker_id: z.number().int().positive().optional(),
  work_center_id: z.number().int().positive().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  defects: z.array(defectsSchema).optional(),
})

export const processResultsRouter = Router()

processResultsRouter.get('/process-results', async (_req, res) => {
  try {
    const items = await prisma.processResult.findMany({
      take: 300,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        productionLotId: true,
        processId: true,
        processSequence: true,
        inputQty: true,
        goodQty: true,
        defectQty: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        lot: { select: { lotNo: true } },
        process: { select: { processCode: true, processName: true } },
        worker: { select: { workerCode: true, workerName: true } },
        workCenter: { select: { centerCode: true, centerName: true } },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

processResultsRouter.get('/process-results/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.processResult.findUnique({
      where: { id },
      select: {
        id: true,
        productionLotId: true,
        processId: true,
        processSequence: true,
        inputQty: true,
        goodQty: true,
        defectQty: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        lot: { select: { lotNo: true, productId: true } },
        process: { select: { processCode: true, processName: true } },
        worker: { select: { workerCode: true, workerName: true } },
        workCenter: { select: { centerCode: true, centerName: true } },
      },
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

processResultsRouter.get('/defect-histories', async (_req, res) => {
  try {
    const items = await prisma.defectHistory.findMany({
      take: 400,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        productionLotId: true,
        processId: true,
        defectTypeId: true,
        qty: true,
        workerId: true,
        workCenterId: true,
        detectedAt: true,
        processResultId: true,
        remark: true,
        createdAt: true,
        lot: {
          select: {
            lotNo: true,
            productId: true,
            createdAt: true,
            product: { select: { id: true, productCode: true, productName: true } },
            materialUsages: {
              where: { materialLotId: { not: null } },
              orderBy: { id: 'asc' },
              select: {
                id: true,
                materialLotId: true,
                usedQty: true,
                materialLot: {
                  select: {
                    id: true,
                    lotNo: true,
                    receivedDate: true,
                    product: { select: { productName: true } },
                  },
                },
              },
            },
          },
        },
        defectType: { select: { defectCode: true, defectName: true } },
        worker: { select: { workerCode: true, workerName: true } },
        workCenter: { select: { centerCode: true, centerName: true } },
        processResult: {
          select: {
            id: true,
            inputQty: true,
            goodQty: true,
            defectQty: true,
            createdAt: true,
          },
        },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

processResultsRouter.post('/process-results', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }

  const body = parsed.data

  if (body.good_qty + body.defect_qty > body.input_qty) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_QTY',
      message: 'good_qty + defect_qty must be <= input_qty',
    })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) LOT 단위 Lock (FOR UPDATE)
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM production_lot WHERE id = ${body.lot_id} FOR UPDATE
      `
      if (locked.length === 0) {
        return { ok: false as const, status: 404 as const, payload: { ok: false, error: 'LOT_NOT_FOUND' } }
      }

      const lot = await tx.productionLot.findUnique({
        where: { id: body.lot_id },
        select: {
          id: true,
          productId: true,
          status: true,
          lotQty: true,
          goodQty: true,
          defectQty: true,
          currentProcessId: true,
          woId: true,
        },
      })

      if (!lot) {
        return { ok: false as const, status: 404 as const, payload: { ok: false, error: 'LOT_NOT_FOUND' } }
      }

      // 2) 공정 정보 확인 (sequence / 마지막 공정 판단)
      const proc = await tx.mbomProcess.findUnique({
        where: { id: body.process_id },
        select: { id: true, productId: true, sequence: true, useYn: true },
      })
      if (!proc || proc.useYn !== 'Y') {
        return { ok: false as const, status: 400 as const, payload: { ok: false, error: 'PROCESS_INVALID' } }
      }
      if (proc.productId !== lot.productId) {
        return {
          ok: false as const,
          status: 400 as const,
          payload: { ok: false, error: 'PROCESS_PRODUCT_MISMATCH' },
        }
      }

      const last = await tx.mbomProcess.findFirst({
        where: { productId: lot.productId, useYn: 'Y' },
        orderBy: { sequence: 'desc' },
        select: { id: true, sequence: true },
      })
      const isLastProcess = !!last && last.sequence === proc.sequence
      /** EBOM 백플러시 기준 수량: 양품·불량 모두 자재를 소모한 것으로 본다 */
      const materialBasisQty = body.good_qty + body.defect_qty
      const matLotStatuses: MaterialLotStatus[] = [MaterialLotStatus.AVAILABLE, MaterialLotStatus.HOLD]

      // 2b) 마지막 공정: EBOM 기준 백플러시 — 자재 LOT(FIFO)으로 lot_material_usage 반영 후, 부족분은 LOT·자재LOT 없는 재고에서 차감
      if (isLastProcess && materialBasisQty > 0) {
        const ebomLines = await tx.ebom.findMany({
          where: { parentProductId: lot.productId, useYn: 'Y' },
          select: { childProductId: true, qty: true, lossRate: true },
        })

        const perFgByMat = new Map<number, Prisma.Decimal>()
        for (const line of ebomLines) {
          const loss = line.lossRate == null ? new Prisma.Decimal(0) : line.lossRate
          const mult = new Prisma.Decimal(1).add(loss)
          const perUnit = line.qty.mul(mult)
          const prev = perFgByMat.get(line.childProductId) ?? new Prisma.Decimal(0)
          perFgByMat.set(line.childProductId, prev.add(perUnit))
        }

        const backflushBomLabel = ebomLines.length > 0 ? 'EBOM' : 'MBOM'
        if (perFgByMat.size === 0) {
          const mbomLines = await tx.mbomProcessMaterial.findMany({
            where: { process: { productId: lot.productId, useYn: 'Y' } },
            select: { materialProductId: true, qty: true, lossRate: true },
          })
          for (const line of mbomLines) {
            const loss = line.lossRate == null ? new Prisma.Decimal(0) : line.lossRate
            const mult = new Prisma.Decimal(1).add(loss)
            const perUnit = line.qty.mul(mult)
            const prev = perFgByMat.get(line.materialProductId) ?? new Prisma.Decimal(0)
            perFgByMat.set(line.materialProductId, prev.add(perUnit))
          }
        }

        const materialIds = Array.from(perFgByMat.keys())
        const materialProducts = materialIds.length
          ? await tx.product.findMany({
              where: { id: { in: materialIds } },
              select: { id: true, productCode: true, productName: true },
            })
          : []
        const materialNameById = new Map<number, string>(
          materialProducts.map((p) => [p.id, p.productName]),
        )

        for (const [materialProductId, perFg] of perFgByMat) {
          const rawNeed = perFg.mul(materialBasisQty)
          const needInt = rawNeed.ceil().toNumber()
          if (!Number.isFinite(needInt) || needInt <= 0) continue

          let remaining = needInt
          let skipMatLotId = 0

          while (remaining > 0) {
            const ml = await tx.materialLot.findFirst({
              where: {
                productId: materialProductId,
                status: { in: matLotStatuses },
                remainQty: { gt: 0 },
                ...(skipMatLotId > 0 ? { id: { gt: skipMatLotId } } : {}),
              },
              orderBy: { id: 'asc' },
              select: { id: true, remainQty: true },
            })
            if (!ml) break

            const floorRem = Math.floor(ml.remainQty.toNumber())
            if (floorRem <= 0) {
              skipMatLotId = ml.id
              continue
            }

            const take = Math.min(remaining, floorRem)
            const issued = await issueMaterialInTx(tx, {
              productionLotId: body.lot_id,
              materialLotId: ml.id,
              usedQty: new Prisma.Decimal(take),
              woId: lot.woId,
              createdBy: body.worker_id,
              applyWorkOrderMaterial: false,
              skipLotHistory: true,
            })
            if ('code' in issued) {
              return {
                ok: false as const,
                status: 400 as const,
                payload: {
                  ok: false,
                  error: issued.code,
                  message: issued.message,
                  material_product_id: materialProductId,
                },
              }
            }
            remaining -= take
            skipMatLotId = 0
          }

          while (remaining > 0) {
            const inv = await tx.inventory.findFirst({
              where: {
                productId: materialProductId,
                lotId: null,
                materialLotId: null,
                qty: { gt: 0 },
              },
              orderBy: { id: 'asc' },
              select: { id: true, qty: true, locationId: true },
            })
            if (!inv) {
              return {
                ok: false as const,
                status: 400 as const,
                payload: {
                  ok: false,
                  error: 'INSUFFICIENT_RAW_STOCK',
                  message: `자재 품목 ID ${materialProductId}의 자재 LOT·LOT 미지정 재고가 부족합니다. (마지막 공정 ${backflushBomLabel} 백플러시·양품+불량 ${materialBasisQty} 기준, 필요 ${remaining}개 남음)`,
                  material_product_id: materialProductId,
                },
              }
            }

            await tx.$queryRaw`SELECT id FROM inventory WHERE id = ${inv.id} FOR UPDATE`
            const lockedInv = await tx.inventory.findUnique({
              where: { id: inv.id },
              select: { qty: true },
            })
            if (!lockedInv || lockedInv.qty <= 0) continue

            const take = Math.min(remaining, lockedInv.qty)
            const before = lockedInv.qty
            const after = before - take
            await tx.inventory.update({
              where: { id: inv.id },
              data: { qty: { decrement: take } },
            })
            await tx.inventoryTransaction.create({
              data: {
                productId: materialProductId,
                locationId: inv.locationId ?? undefined,
                transactionType: 'OUT',
                qty: take,
                refType: 'LOT',
                refId: body.lot_id,
                beforeQty: before,
                afterQty: after,
                createdBy: body.worker_id,
              },
            })
            remaining -= take
          }

          if (lot.woId != null) {
            const wom = await tx.workOrderMaterial.findFirst({
              where: { woId: lot.woId, materialProductId },
              select: { id: true },
            })
            if (wom) {
              await tx.workOrderMaterial.update({
                where: { id: wom.id },
                data: { issuedQty: { increment: new Prisma.Decimal(needInt) } },
              })
            }
          }

          await tx.lotHistory.create({
            data: {
              productionLotId: body.lot_id,
              eventType: LotHistoryEventType.MOVE,
              eventDesc: `품목 ${materialNameById.get(materialProductId) ?? `품목#${materialProductId}`} ${needInt}개 출고 (백플러시)`,
            },
          })
        }
      }

      // 3) 공정 결과 기록
      const processResult = await tx.processResult.create({
        data: {
          productionLotId: body.lot_id,
          processId: body.process_id,
          processSequence: proc.sequence,
          workerId: body.worker_id,
          workCenterId: body.work_center_id,
          inputQty: body.input_qty,
          goodQty: body.good_qty,
          defectQty: body.defect_qty,
          startTime: body.start_time ? new Date(body.start_time) : null,
          endTime: body.end_time ? new Date(body.end_time) : null,
        },
        select: { id: true },
      })

      // 4) LOT 상태 업데이트 (캐시 + 낙관적 락도 같이)
      const nextGoodTotal = lot.goodQty + body.good_qty
      const nextDefectTotal = lot.defectQty + body.defect_qty
      const remainingWork = lot.lotQty - nextGoodTotal - nextDefectTotal
      const nextLotStatus =
        remainingWork <= 0 || isLastProcess ? LotStatus.DONE : LotStatus.IN_PROGRESS

      await tx.productionLot.update({
        where: { id: body.lot_id },
        data: {
          currentProcessId: body.process_id,
          goodQty: { increment: body.good_qty },
          defectQty: { increment: body.defect_qty },
          status: nextLotStatus,
          versionNo: { increment: 1 },
        },
      })

      // 5) 불량 상세 기록
      const defects = body.defects ?? []
      if (defects.length > 0) {
        await tx.defectHistory.createMany({
          data: defects.map((d) => ({
            productionLotId: body.lot_id,
            processId: body.process_id,
            defectTypeId: d.type_id,
            qty: d.qty,
            workerId: body.worker_id,
            workCenterId: body.work_center_id,
            detectedAt: new Date(),
            processResultId: processResult.id,
            remark: d.remark,
          })),
        })
      }

      // 6) 마지막 공정이면 재고 IN + 트랜잭션 기록
      if (isLastProcess && body.good_qty > 0) {
        // 품목 기준 전량 합계를 맞추기 위해 같은 품목 재고 행을 먼저 잠근다.
        await tx.$queryRaw`
          SELECT id FROM inventory WHERE product_id = ${lot.productId} FOR UPDATE
        `

        const productQtyAgg = await tx.inventory.aggregate({
          where: { productId: lot.productId },
          _sum: { qty: true },
        })
        const beforeQty = productQtyAgg._sum.qty ?? 0
        const afterQty = beforeQty + body.good_qty

        // inventory row lock (lot 기준)
        await tx.$queryRaw`
          SELECT id FROM inventory WHERE lot_id = ${body.lot_id} FOR UPDATE
        `

        const inv = await tx.inventory.findFirst({
          where: { lotId: body.lot_id },
          select: { id: true, qty: true, productId: true },
        })

        if (!inv) {
          await tx.inventory.create({
            data: {
              productId: lot.productId,
              lotId: body.lot_id,
              qty: body.good_qty,
              status: 'AVAILABLE',
            },
          })
        } else {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { qty: { increment: body.good_qty } },
          })
        }

        await tx.inventoryTransaction.create({
          data: {
            productId: lot.productId,
            lotId: body.lot_id,
            transactionType: 'IN',
            qty: body.good_qty,
            refType: 'LOT',
            refId: body.lot_id,
            beforeQty,
            afterQty,
            createdBy: body.worker_id,
          },
        })
      }

      return {
        ok: true as const,
        status: 201 as const,
        payload: {
          ok: true,
          process_result_id: processResult.id,
          lot_id: body.lot_id,
          is_last_process: isLastProcess,
        },
      }
    })

    return res.status(result.status).json(result.payload)
  } catch (e) {
    return prismaFail(res, e)
  }
})

