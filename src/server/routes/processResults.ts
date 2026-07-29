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
      take: 1000,
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
        lot: {
          select: {
            lotNo: true,
            productId: true,
            product: { select: { id: true, productCode: true, productName: true } },
          },
        },
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

      type ResultTarget = { processId: number; sequence: number; workerId: number }
      let resultTargets: ResultTarget[] = []

      if (lot.woId != null) {
        const assigned = await tx.workOrderProcessWorker.findMany({
          where: { woId: lot.woId },
          select: {
            workerId: true,
            processId: true,
            process: { select: { productId: true, sequence: true, useYn: true } },
          },
        })
        resultTargets = assigned
          .filter((a) => a.process.useYn === 'Y' && a.process.productId === lot.productId)
          .map((a) => ({
            processId: a.processId,
            sequence: a.process.sequence,
            workerId: a.workerId,
          }))
          .sort((a, b) => a.sequence - b.sequence)
      }

      if (resultTargets.length === 0) {
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
        const fallbackWorkerId = body.worker_id ?? null
        if (fallbackWorkerId == null) {
          return {
            ok: false as const,
            status: 400 as const,
            payload: {
              ok: false,
              error: 'NO_WO_ASSIGNMENT',
              message: '작업지시에 공정별 작업자 배정이 없습니다. 관리자에게 배정을 요청하세요.',
            },
          }
        }
        resultTargets = [{ processId: proc.id, sequence: proc.sequence, workerId: fallbackWorkerId }]
      } else {
        const hint = await tx.mbomProcess.findUnique({
          where: { id: body.process_id },
          select: { productId: true, useYn: true },
        })
        if (!hint || hint.useYn !== 'Y' || hint.productId !== lot.productId) {
          return { ok: false as const, status: 400 as const, payload: { ok: false, error: 'PROCESS_INVALID' } }
        }
      }

      const processRows = resultTargets
      if (processRows.length === 0) {
        return {
          ok: false as const,
          status: 400 as const,
          payload: {
            ok: false,
            error: 'NO_ASSIGNED_PROCESS',
            message: '이 작업지시에 배정된 공정이 없습니다. 관리자에게 공정별 작업자 배정을 요청하세요.',
          },
        }
      }

      const lastProductProcess = await tx.mbomProcess.findFirst({
        where: { productId: lot.productId, useYn: 'Y' },
        orderBy: { sequence: 'desc' },
        select: { id: true, sequence: true },
      })
      const maxTargetSequence = Math.max(...processRows.map((p) => p.sequence))
      const isLastProcess = !!lastProductProcess && lastProductProcess.sequence === maxTargetSequence
      const currentProcessId = processRows[processRows.length - 1]!.processId
      const auditWorkerId = processRows[0]!.workerId

      /** EBOM 백플러시 기준 수량: 양품·불량 모두 자재를 소모한 것으로 본다 */
      const materialBasisQty = body.good_qty + body.defect_qty
      const matLotStatuses: MaterialLotStatus[] = [MaterialLotStatus.AVAILABLE, MaterialLotStatus.HOLD]

      // 2b) 마지막 공정 실적 시 EBOM 백플러시만 (MBOM 투입자재와 분리)
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
              createdBy: auditWorkerId,
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
                  message: `자재 품목 ID ${materialProductId}의 자재 LOT·LOT 미지정 재고가 부족합니다. (EBOM 백플러시·양품+불량 ${materialBasisQty} 기준, 필요 ${remaining}개 남음)`,
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
                createdBy: auditWorkerId,
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
              eventDesc: `품목 ${materialNameById.get(materialProductId) ?? `품목#${materialProductId}`} ${needInt}개 출고 (EBOM 백플러시)`,
            },
          })
        }
      }

      const recordedAt = new Date()
      const defects = body.defects ?? []
      const processResultIds: number[] = []

      for (let i = 0; i < processRows.length; i++) {
        const procRow = processRows[i]!
        const processResult = await tx.processResult.create({
          data: {
            productionLotId: body.lot_id,
            processId: procRow.processId,
            processSequence: procRow.sequence,
            workerId: procRow.workerId,
            workCenterId: body.work_center_id,
            inputQty: body.input_qty,
            goodQty: body.good_qty,
            defectQty: body.defect_qty,
            startTime: body.start_time ? new Date(body.start_time) : null,
            endTime: body.end_time ? new Date(body.end_time) : null,
            createdAt: recordedAt,
          },
          select: { id: true },
        })
        processResultIds.push(processResult.id)

        if (defects.length > 0 && i === 0) {
          await tx.defectHistory.createMany({
            data: defects.map((d) => ({
              productionLotId: body.lot_id,
              processId: procRow.processId,
              defectTypeId: d.type_id,
              qty: d.qty,
              workerId: procRow.workerId,
              workCenterId: body.work_center_id,
              detectedAt: recordedAt,
              processResultId: processResult.id,
              remark: d.remark,
            })),
          })
        }
      }

      const nextGoodTotal = lot.goodQty + body.good_qty
      const nextDefectTotal = lot.defectQty + body.defect_qty
      const remainingWork = lot.lotQty - nextGoodTotal - nextDefectTotal
      const nextLotStatus =
        remainingWork <= 0 || isLastProcess ? LotStatus.DONE : LotStatus.IN_PROGRESS

      await tx.productionLot.update({
        where: { id: body.lot_id },
        data: {
          currentProcessId,
          goodQty: { increment: body.good_qty },
          defectQty: { increment: body.defect_qty },
          status: nextLotStatus,
          versionNo: { increment: 1 },
        },
      })

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
            createdBy: auditWorkerId,
          },
        })
      }

      return {
        ok: true as const,
        status: 201 as const,
        payload: {
          ok: true,
          process_result_id: processResultIds[0],
          process_result_ids: processResultIds,
          process_ids: processRows.map((p) => p.processId),
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

