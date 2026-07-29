import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import {
  formatMakespanKo,
  optimizeProcessWorkerAssignmentGrouped,
} from '../lib/processWorkerOptimize'

const optimizeBody = z.object({
  productId: z.number().int().positive(),
  orderQty: z.number().int().positive().default(1),
  activeOnly: z.boolean().optional().default(true),
  minGoodQty: z.number().int().nonnegative().optional().default(1),
  /** 공정 ID 묶음(순서 유지). 묶음마다 작업자 1명, 묶음 간 서로 다른 작업자 */
  processGroups: z.array(z.array(z.number().int().positive())).min(1),
})

function validateProcessGroups(orderedProcessIds: number[], groups: number[][]): boolean {
  const flat = groups.flat()
  if (flat.length !== orderedProcessIds.length) return false
  if (new Set(flat).size !== flat.length) return false
  let i = 0
  for (const g of groups) {
    if (g.length === 0) return false
    for (const id of g) {
      if (orderedProcessIds[i] !== id) return false
      i++
    }
  }
  return true
}

export const processWorkerAssignRouter = Router()

processWorkerAssignRouter.post('/process-worker-assignments/optimize', async (req, res) => {
  const parsed = optimizeBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const { productId, orderQty, activeOnly, minGoodQty, processGroups } = parsed.data

  try {
    const [processes, workers, results, processWorkTimes] = await Promise.all([
      prisma.mbomProcess.findMany({
        where: { productId, useYn: 'Y' },
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          sequence: true,
          processCode: true,
          processName: true,
          standardTime: true,
          baseQty: true,
        },
      }),
      prisma.worker.findMany({
        where: activeOnly ? { status: 'ACTIVE' } : undefined,
        orderBy: [{ workerCode: 'asc' }],
        select: { id: true, workerCode: true, workerName: true, status: true },
      }),
      prisma.processResult.findMany({
        where: { workerId: { not: null }, lot: { productId } },
        select: {
          workerId: true,
          processId: true,
          inputQty: true,
          goodQty: true,
          defectQty: true,
        },
      }),
      prisma.workerProcessWorkTime.findMany({
        where: { process: { productId } },
        select: { workerId: true, processId: true, workMinutes: true },
      }),
    ])

    const processAgg = new Map<string, { goodQty: number; inputQty: number }>()
    for (const r of results) {
      if (r.workerId == null) continue
      const k = `${r.workerId}:${r.processId}`
      const cur = processAgg.get(k) ?? { goodQty: 0, inputQty: 0 }
      cur.goodQty += r.goodQty
      cur.inputQty += r.inputQty
      processAgg.set(k, cur)
    }

    const workMinMap = new Map<string, number>()
    for (const wt of processWorkTimes) {
      workMinMap.set(`${wt.workerId}:${wt.processId}`, wt.workMinutes)
    }

    const historySec = new Map<string, number>()
    for (const [k, a] of processAgg) {
      const wm = workMinMap.get(k) ?? 0
      const qtyBasis = a.goodQty >= minGoodQty ? a.goodQty : a.inputQty >= minGoodQty ? a.inputQty : 0
      if (wm > 0 && qtyBasis >= minGoodQty) {
        const sec = Math.round(((wm * 60) / qtyBasis) * 10000) / 10000
        historySec.set(k, sec)
      }
    }

    const standardSecByProcess = new Map<number, number | null>()
    for (const p of processes) {
      const std =
        p.standardTime != null && p.baseQty != null && p.baseQty > 0
          ? Number(p.standardTime) / p.baseQty
          : null
      standardSecByProcess.set(p.id, std)
    }

    const orderedIds = processes.map((p) => p.id)
    if (!validateProcessGroups(orderedIds, processGroups)) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_GROUPS',
        message: '작업자 묶음이 공정 순서와 맞지 않습니다. 인접 공정만 같은 묶음으로 설정할 수 있습니다.',
      })
    }

    const outcome = optimizeProcessWorkerAssignmentGrouped(
      processGroups,
      workers.map((w) => ({ id: w.id })),
      historySec,
      standardSecByProcess,
      orderQty,
    )

    if ('error' in outcome) {
      const messages: Record<string, string> = {
        NO_PROCESSES: '이 품목에 MBOM 공정이 없습니다.',
        NO_WORKERS: '배정 가능한 작업자가 없습니다.',
        NOT_ENOUGH_WORKERS: `작업자 묶음 ${processGroups.length}개에 서로 다른 작업자가 필요합니다. 활성 작업자를 더 등록하거나 묶음 수를 줄이세요.`,
        INVALID_GROUPS: '작업자 묶음 설정이 올바르지 않습니다.',
      }
      return res.status(400).json({ ok: false, error: outcome.error, message: messages[outcome.error] ?? messages.INVALID_GROUPS })
    }

    const workerById = new Map(workers.map((w) => [w.id, w]))
    const processById = new Map(processes.map((p) => [p.id, p]))

    return res.json({
      ok: true,
      orderQty,
      groupCount: outcome.groupCount,
      groupPreview: processGroups.map((g) => g.map((id) => processById.get(id)?.sequence ?? id).join('·')).join(' / '),
      estimatedMakespanSeconds: outcome.estimatedMakespanSeconds,
      estimatedMakespanLabel: formatMakespanKo(outcome.estimatedMakespanSeconds),
      modelNote:
        '묶음별 라인(파이프라인): 묶음 내 공정 시간 합 + (수량−1)×가장 긴 묶음 시간',
      assignments: outcome.assignments.map((a) => {
        const w = workerById.get(a.workerId)
        const p = processById.get(a.processId)
        return {
          ...a,
          workerCode: w?.workerCode ?? '',
          workerName: w?.workerName ?? '',
          processCode: p?.processCode ?? '',
          processName: p?.processName ?? '',
        }
      }),
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})
