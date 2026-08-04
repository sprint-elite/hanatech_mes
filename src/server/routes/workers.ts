import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { dedupeProcessResultsForProductTotals } from '../lib/processResultAgg'
import { effectiveGoodQtyForProcess, groupWorkTimeEntriesByWorkerProcess } from '../lib/workerContribution'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

function kstYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

type LotQtyRow = {
  productionLotId: number | null
  workDate: string
  planNo: string | null
  woNo: string | null
  lotNo: string | null
  inputQty: number
  goodQty: number
  defectQty: number
}

async function lotRowsForWorkerProcess(workerId: number, processId: number): Promise<Map<string, LotQtyRow>> {
  const results = await prisma.processResult.findMany({
    where: { workerId, processId },
    select: {
      productionLotId: true,
      inputQty: true,
      goodQty: true,
      defectQty: true,
      createdAt: true,
      lot: {
        select: {
          lotNo: true,
          workOrder: {
            select: {
              woNo: true,
              plan: { select: { planNo: true } },
            },
          },
        },
      },
    },
  })
  const byKey = new Map<string, LotQtyRow>()
  for (const r of results) {
    const workDate = kstYmd(r.createdAt)
    const lotId = r.productionLotId
    const key = lotId != null ? `lot:${lotId}` : `date:${workDate}`
    const cur = byKey.get(key) ?? {
      productionLotId: lotId,
      workDate,
      planNo: r.lot?.workOrder?.plan?.planNo ?? null,
      woNo: r.lot?.workOrder?.woNo ?? null,
      lotNo: r.lot?.lotNo ?? null,
      inputQty: 0,
      goodQty: 0,
      defectQty: 0,
    }
    if (workDate > cur.workDate) cur.workDate = workDate
    cur.inputQty += r.inputQty
    cur.goodQty += r.goodQty
    cur.defectQty += r.defectQty
    byKey.set(key, cur)
  }
  return byKey
}

function lotEntryKey(productionLotId: number | null, workDate: string): string {
  return productionLotId != null ? `lot:${productionLotId}` : `date:${workDate}`
}

const createBody = z.object({
  workerCode: z.string().trim().min(1).max(64),
  workerName: z.string().trim().min(1).max(200),
  team: z.string().trim().max(100).optional().nullable(),
  position: z.string().trim().max(100).optional().nullable(),
  skillLevel: z.string().trim().max(50).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  hireDate: z.string().trim().optional().nullable(),
  status: z.string().trim().max(20).optional(),
})

const updateBody = createBody.partial()

export const workersRouter = Router()

const workerSelect = {
  id: true,
  workerCode: true,
  workerName: true,
  team: true,
  position: true,
  skillLevel: true,
  phone: true,
  hireDate: true,
  status: true,
  createdAt: true,
} as const

function workMinutesForProduct(
  productId: number,
  processIds: number[],
  processWtMap: Map<number, number>,
  legacyProductWt: number,
): number {
  if (processIds.length === 0) return legacyProductWt
  const sum = processIds.reduce((s, pid) => s + (processWtMap.get(pid) ?? 0), 0)
  if (sum > 0) return sum
  return legacyProductWt
}

workersRouter.get('/workers', async (_req, res) => {
  try {
    const items = await prisma.worker.findMany({
      take: 2000,
      orderBy: [{ workerCode: 'asc' }, { id: 'asc' }],
      select: workerSelect,
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.get('/workers/stats/comparison', async (_req, res) => {
  try {
    const [products, workers, results, productWorkTimes, processWorkTimes, workTimeEntries, mbomProcesses] =
      await Promise.all([
      prisma.product.findMany({
        where: { itemType: { not: 'RAW' } },
        orderBy: [{ productName: 'asc' }],
        select: { id: true, productCode: true, productName: true, itemType: true },
      }),
      prisma.worker.findMany({
        orderBy: [{ workerName: 'asc' }],
        select: { id: true, workerCode: true, workerName: true },
      }),
      prisma.processResult.findMany({
        where: { workerId: { not: null } },
        select: {
          workerId: true,
          processId: true,
          productionLotId: true,
          processSequence: true,
          inputQty: true,
          goodQty: true,
          defectQty: true,
          createdAt: true,
          lot: { select: { productId: true } },
        },
      }),
      prisma.workerProductWorkTime.findMany({
        select: { workerId: true, productId: true, workMinutes: true },
      }),
      prisma.workerProcessWorkTime.findMany({
        select: { workerId: true, processId: true, workMinutes: true },
      }),
      prisma.workerProcessWorkTimeEntry.findMany({
        select: {
          workerId: true,
          processId: true,
          goodQty: true,
          inputQty: true,
          workMinutes: true,
          contributionPct: true,
        },
      }),
      prisma.mbomProcess.findMany({
        where: { useYn: 'Y' },
        select: {
          id: true,
          productId: true,
          processCode: true,
          processName: true,
          sequence: true,
          standardTime: true,
          baseQty: true,
        },
      }),
    ])

    const processMetaById = new Map(mbomProcesses.map((p) => [p.id, p]))
    const processToProduct = new Map(mbomProcesses.map((p) => [p.id, p.productId]))

    const legacyWtMap = new Map<string, number>()
    for (const wt of productWorkTimes) {
      legacyWtMap.set(`${wt.workerId}:${wt.productId}`, wt.workMinutes)
    }

    const processWtByWorkerProduct = new Map<string, number>()
    for (const wt of processWorkTimes) {
      const productId = processToProduct.get(wt.processId)
      if (productId == null) continue
      const k = `${wt.workerId}:${productId}`
      processWtByWorkerProduct.set(k, (processWtByWorkerProduct.get(k) ?? 0) + wt.workMinutes)
    }

    type Agg = { inputQty: number; goodQty: number; defectQty: number; workMinutes: number }
    const cellMap = new Map<string, Agg>()
    const keyOf = (w: number, p: number) => `${w}:${p}`

    for (const r of dedupeProcessResultsForProductTotals(results)) {
      if (r.workerId == null) continue
      const k = keyOf(r.workerId, r.lot.productId)
      const cur = cellMap.get(k) ?? { inputQty: 0, goodQty: 0, defectQty: 0, workMinutes: 0 }
      cur.inputQty += r.inputQty
      cur.goodQty += r.goodQty
      cur.defectQty += r.defectQty
      cellMap.set(k, cur)
    }

    for (const [k, a] of cellMap) {
      const [ws, ps] = k.split(':')
      const workerId = Number(ws)
      const productId = Number(ps)
      const legacy = legacyWtMap.get(k) ?? 0
      const processSum = processWtByWorkerProduct.get(k) ?? 0
      a.workMinutes = processSum > 0 ? processSum : legacy
    }

    for (const wt of productWorkTimes) {
      const k = keyOf(wt.workerId, wt.productId)
      if (cellMap.has(k)) continue
      const processSum = processWtByWorkerProduct.get(k) ?? 0
      const minutes = processSum > 0 ? processSum : wt.workMinutes
      if (minutes <= 0) continue
      cellMap.set(k, { inputQty: 0, goodQty: 0, defectQty: 0, workMinutes: minutes })
    }

    for (const [k, minutes] of processWtByWorkerProduct) {
      if (cellMap.has(k)) continue
      if (minutes <= 0) continue
      cellMap.set(k, { inputQty: 0, goodQty: 0, defectQty: 0, workMinutes: minutes })
    }

    const workerById = new Map(workers.map((w) => [w.id, w]))
    const productById = new Map(products.map((p) => [p.id, p]))

    const cells: {
      workerId: number
      workerCode: string
      workerName: string
      productId: number
      productName: string
      inputQty: number
      goodQty: number
      defectQty: number
      workMinutes: number
      yieldPct: number
      defectPct: number
      perHour: number | null
    }[] = []

    for (const [k, a] of cellMap) {
      const [ws, ps] = k.split(':')
      const workerId = Number(ws)
      const productId = Number(ps)
      const w = workerById.get(workerId)
      const p = productById.get(productId)
      if (!w || !p) continue
      if (a.inputQty <= 0 && a.goodQty <= 0 && a.defectQty <= 0 && a.workMinutes <= 0) continue

      const yieldPct = a.inputQty > 0 ? Math.round((a.goodQty / a.inputQty) * 1000) / 10 : 0
      const defectPct = a.inputQty > 0 ? Math.round((a.defectQty / a.inputQty) * 1000) / 10 : 0
      const hours = a.workMinutes / 60
      const perHour = hours > 0 && a.goodQty > 0 ? Math.round((a.goodQty / hours) * 10) / 10 : null

      cells.push({
        workerId,
        workerCode: w.workerCode,
        workerName: w.workerName,
        productId,
        productName: p.productName,
        inputQty: a.inputQty,
        goodQty: a.goodQty,
        defectQty: a.defectQty,
        workMinutes: a.workMinutes,
        yieldPct,
        defectPct,
        perHour,
      })
    }

    const activeProductIds = new Set(cells.filter((c) => c.inputQty > 0).map((c) => c.productId))
    const activeProducts = products.filter((p) => activeProductIds.has(p.id))

    type ProcessAgg = { inputQty: number; goodQty: number; defectQty: number }
    const processAggMap = new Map<string, ProcessAgg>()
    for (const r of results) {
      if (r.workerId == null) continue
      const k = `${r.workerId}:${r.processId}`
      const cur = processAggMap.get(k) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
      cur.inputQty += r.inputQty
      cur.goodQty += r.goodQty
      cur.defectQty += r.defectQty
      processAggMap.set(k, cur)
    }

    const processWtByWorkerProcess = new Map<string, number>()
    for (const wt of processWorkTimes) {
      processWtByWorkerProcess.set(`${wt.workerId}:${wt.processId}`, wt.workMinutes)
    }

    const entriesByWorkerProcess = groupWorkTimeEntriesByWorkerProcess(workTimeEntries)

    const processCells: {
      workerId: number
      workerName: string
      productId: number
      processId: number
      processCode: string
      processName: string
      sequence: number
      inputQty: number
      goodQty: number
      defectQty: number
      workMinutes: number
      secPerUnit: number | null
      standardSecPerUnit: number | null
      efficiencyPct: number | null
    }[] = []

    for (const [k, a] of processAggMap) {
      const [ws, ps] = k.split(':')
      const workerId = Number(ws)
      const processId = Number(ps)
      const w = workerById.get(workerId)
      const meta = processMetaById.get(processId)
      if (!w || !meta) continue
      if (a.inputQty <= 0 && a.goodQty <= 0 && a.defectQty <= 0) continue

      const workMinutes = processWtByWorkerProcess.get(k) ?? 0
      const entryList = entriesByWorkerProcess.get(k) ?? []
      const qtyBasis = effectiveGoodQtyForProcess(a.goodQty, a.inputQty, entryList)
      const secPerUnit =
        workMinutes > 0 && qtyBasis > 0 ? Math.round(((workMinutes * 60) / qtyBasis) * 10000) / 10000 : null
      const standardSecPerUnit =
        meta.standardTime != null && meta.baseQty != null && meta.baseQty > 0
          ? Number(meta.standardTime) / meta.baseQty
          : null
      const efficiencyPct =
        secPerUnit != null && standardSecPerUnit != null && secPerUnit > 0
          ? Math.round((standardSecPerUnit / secPerUnit) * 1000) / 10
          : null

      processCells.push({
        workerId,
        workerName: w.workerName,
        productId: meta.productId,
        processId,
        processCode: meta.processCode,
        processName: meta.processName,
        sequence: meta.sequence,
        inputQty: a.inputQty,
        goodQty: a.goodQty,
        defectQty: a.defectQty,
        workMinutes,
        secPerUnit,
        standardSecPerUnit,
        efficiencyPct,
      })
    }

    return res.json({ ok: true, products: activeProducts, workers, cells, processCells })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.get('/workers/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.worker.findUnique({
      where: { id },
      select: workerSelect,
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.post('/workers', async (req, res) => {
  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  try {
    const item = await prisma.worker.create({
      data: {
        workerCode: b.workerCode,
        workerName: b.workerName,
        team: b.team ?? undefined,
        position: b.position ?? undefined,
        skillLevel: b.skillLevel ?? undefined,
        phone: b.phone ?? undefined,
        hireDate: b.hireDate == null || b.hireDate.trim() === '' ? undefined : new Date(b.hireDate),
        status: b.status ?? 'ACTIVE',
      },
      select: workerSelect,
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.patch('/workers/:id', async (req, res) => {
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
      ...(b.workerCode !== undefined ? { workerCode: b.workerCode } : {}),
      ...(b.workerName !== undefined ? { workerName: b.workerName } : {}),
      ...(b.team !== undefined ? { team: b.team } : {}),
      ...(b.position !== undefined ? { position: b.position } : {}),
      ...(b.skillLevel !== undefined ? { skillLevel: b.skillLevel } : {}),
      ...(b.phone !== undefined ? { phone: b.phone } : {}),
      ...(b.hireDate !== undefined
        ? { hireDate: b.hireDate == null || b.hireDate.trim() === '' ? null : new Date(b.hireDate) }
        : {}),
      ...(b.status !== undefined ? { status: b.status } : {}),
    }
    const item = await prisma.worker.update({
      where: { id },
      data,
      select: workerSelect,
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.delete('/workers/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.worker.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const workTimesBody = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      workMinutes: z.number().int().nonnegative(),
    }),
  ),
})

const processWorkTimesBody = z.object({
  items: z.array(
    z.object({
      processId: z.number().int().positive(),
      workMinutes: z.number().int().nonnegative(),
    }),
  ),
})

workersRouter.get('/workers/:id/product-summary', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const worker = await prisma.worker.findUnique({
      where: { id },
      select: { id: true, workerCode: true, workerName: true },
    })
    if (!worker) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const [products, mbomProcesses, results, productWorkTimes, processWorkTimes, workTimeEntries] = await Promise.all([
      prisma.product.findMany({
        where: { itemType: { not: 'RAW' } },
        orderBy: [{ itemType: 'asc' }, { productName: 'asc' }],
        select: { id: true, productCode: true, productName: true, itemType: true },
      }),
      prisma.mbomProcess.findMany({
        where: { useYn: 'Y' },
        orderBy: [{ productId: 'asc' }, { sequence: 'asc' }],
        select: {
          id: true,
          productId: true,
          processCode: true,
          processName: true,
          sequence: true,
          standardTime: true,
          baseQty: true,
        },
      }),
      prisma.processResult.findMany({
        where: { workerId: id },
        select: {
          productionLotId: true,
          processId: true,
          processSequence: true,
          inputQty: true,
          goodQty: true,
          defectQty: true,
          createdAt: true,
          lot: { select: { productId: true } },
        },
      }),
      prisma.workerProductWorkTime.findMany({
        where: { workerId: id },
        select: { productId: true, workMinutes: true },
      }),
      prisma.workerProcessWorkTime.findMany({
        where: { workerId: id },
        select: { processId: true, workMinutes: true },
      }),
      prisma.workerProcessWorkTimeEntry.findMany({
        where: { workerId: id },
        select: {
          processId: true,
          goodQty: true,
          inputQty: true,
          workMinutes: true,
          contributionPct: true,
        },
      }),
    ])

    const productAgg = new Map<number, { inputQty: number; goodQty: number; defectQty: number }>()
    const processAgg = new Map<number, { inputQty: number; goodQty: number; defectQty: number }>()

    for (const r of dedupeProcessResultsForProductTotals(results)) {
      const pid = r.lot.productId
      const pcur = productAgg.get(pid) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
      pcur.inputQty += r.inputQty
      pcur.goodQty += r.goodQty
      pcur.defectQty += r.defectQty
      productAgg.set(pid, pcur)
    }

    for (const r of results) {
      const pr = processAgg.get(r.processId) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
      pr.inputQty += r.inputQty
      pr.goodQty += r.goodQty
      pr.defectQty += r.defectQty
      processAgg.set(r.processId, pr)
    }

    const legacyWtMap = new Map(productWorkTimes.map((w) => [w.productId, w.workMinutes]))
    const processWtMap = new Map(processWorkTimes.map((w) => [w.processId, w.workMinutes]))
    const entriesByProcess = new Map<number, typeof workTimeEntries>()
    for (const e of workTimeEntries) {
      const list = entriesByProcess.get(e.processId) ?? []
      list.push(e)
      entriesByProcess.set(e.processId, list)
    }

    const processesByProduct = new Map<number, typeof mbomProcesses>()
    for (const mp of mbomProcesses) {
      const list = processesByProduct.get(mp.productId) ?? []
      list.push(mp)
      processesByProduct.set(mp.productId, list)
    }

    const items = products.map((p) => {
      const a = productAgg.get(p.id) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
      const procs = processesByProduct.get(p.id) ?? []
      const processIds = procs.map((x) => x.id)
      const legacy = legacyWtMap.get(p.id) ?? 0

      const processes = procs.map((mp) => {
        const pa = processAgg.get(mp.id) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
        let wm = processWtMap.get(mp.id) ?? 0
        if (wm === 0 && procs.length === 1 && legacy > 0) {
          wm = legacy
        }
        const entryList = entriesByProcess.get(mp.id) ?? []
        const efficiencyGoodQty = effectiveGoodQtyForProcess(pa.goodQty, pa.inputQty, entryList)
        return {
          processId: mp.id,
          processCode: mp.processCode,
          processName: mp.processName,
          sequence: mp.sequence,
          standardTime: mp.standardTime != null ? Number(mp.standardTime) : null,
          baseQty: mp.baseQty ?? null,
          inputQty: pa.inputQty,
          goodQty: pa.goodQty,
          defectQty: pa.defectQty,
          efficiencyGoodQty,
          workMinutes: wm,
        }
      })

      const workMinutes = workMinutesForProduct(p.id, processIds, processWtMap, legacy)

      return {
        productId: p.id,
        productCode: p.productCode,
        productName: p.productName,
        itemType: p.itemType,
        inputQty: a.inputQty,
        goodQty: a.goodQty,
        defectQty: a.defectQty,
        workMinutes,
        processes,
      }
    })

    return res.json({ ok: true, worker, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.put('/workers/:id/product-work-times', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const parsed = workTimesBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  try {
    const worker = await prisma.worker.findUnique({ where: { id }, select: { id: true } })
    if (!worker) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const productIds = parsed.data.items.map((i) => i.productId)
    const validProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, itemType: { not: 'RAW' } },
      select: { id: true },
    })
    const validSet = new Set(validProducts.map((p) => p.id))

    await prisma.$transaction(
      parsed.data.items
        .filter((i) => validSet.has(i.productId))
        .map((i) =>
          prisma.workerProductWorkTime.upsert({
            where: { workerId_productId: { workerId: id, productId: i.productId } },
            create: { workerId: id, productId: i.productId, workMinutes: i.workMinutes },
            update: { workMinutes: i.workMinutes },
          }),
        ),
    )

    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const processWorkTimeEntriesBody = z.object({
  processId: z.number().int().positive(),
  entries: z.array(
    z.object({
      productionLotId: z.number().int().positive().nullable().optional(),
      workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      workMinutes: z.number().int().nonnegative(),
      contributionPct: z.number().int().min(1).max(100).optional(),
    }),
  ),
})

workersRouter.get('/workers/:id/process-work-time-entries', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const processId = req.query.processId != null ? Number(req.query.processId) : NaN
  if (!Number.isFinite(processId) || processId <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_PROCESS_ID' })
  }
  try {
    const worker = await prisma.worker.findUnique({ where: { id }, select: { id: true } })
    if (!worker) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const [lotQty, savedEntries] = await Promise.all([
      lotRowsForWorkerProcess(id, processId),
      prisma.workerProcessWorkTimeEntry.findMany({
        where: { workerId: id, processId },
        select: { productionLotId: true, workDate: true, workMinutes: true, contributionPct: true },
      }),
    ])

    const minutesByKey = new Map(
      savedEntries.map((e) => [
        lotEntryKey(e.productionLotId, kstYmd(e.workDate)),
        { workMinutes: e.workMinutes, contributionPct: e.contributionPct },
      ]),
    )

    const items = [...lotQty.entries()]
      .filter(([, q]) => q.inputQty > 0 || q.goodQty > 0 || q.defectQty > 0)
      .map(([key, q]) => {
        const saved = minutesByKey.get(key)
        return {
          productionLotId: q.productionLotId,
          workDate: q.workDate,
          planNo: q.planNo,
          woNo: q.woNo,
          lotNo: q.lotNo,
          inputQty: q.inputQty,
          goodQty: q.goodQty,
          defectQty: q.defectQty,
          workMinutes: saved?.workMinutes ?? 0,
          contributionPct: saved?.contributionPct ?? 100,
        }
      })
      .sort((a, b) => b.workDate.localeCompare(a.workDate) || (a.lotNo ?? '').localeCompare(b.lotNo ?? ''))

    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.put('/workers/:id/process-work-time-entries', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const parsed = processWorkTimeEntriesBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const { processId, entries } = parsed.data
  try {
    const worker = await prisma.worker.findUnique({ where: { id }, select: { id: true } })
    if (!worker) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const proc = await prisma.mbomProcess.findFirst({
      where: { id: processId, useYn: 'Y' },
      select: { id: true, productId: true },
    })
    if (!proc) return res.status(400).json({ ok: false, error: 'PROCESS_INVALID' })

    const lotQty = await lotRowsForWorkerProcess(id, processId)

    const toStore = entries
      .map((e) => {
        const lookupKey =
          e.productionLotId != null
            ? `lot:${e.productionLotId}`
            : e.workDate
              ? `date:${e.workDate}`
              : null
        const q = lookupKey ? lotQty.get(lookupKey) : undefined
        const workDate = q?.workDate ?? e.workDate ?? ''
        if (!workDate) return null
        return {
          productionLotId: e.productionLotId ?? q?.productionLotId ?? null,
          workDate,
          inputQty: q?.inputQty ?? 0,
          goodQty: q?.goodQty ?? 0,
          defectQty: q?.defectQty ?? 0,
          workMinutes: e.workMinutes,
          contributionPct: e.contributionPct ?? 100,
          keep: Boolean(q),
        }
      })
      .filter((e): e is NonNullable<typeof e> => e != null && e.keep)
      .map(({ keep: _k, ...rest }) => rest)

    const totalMinutes = toStore.reduce((s, e) => s + e.workMinutes, 0)

    await prisma.$transaction(async (tx) => {
      await tx.workerProcessWorkTimeEntry.deleteMany({ where: { workerId: id, processId } })
      if (toStore.length > 0) {
        await tx.workerProcessWorkTimeEntry.createMany({
          data: toStore.map((e) => ({
            workerId: id,
            processId,
            productionLotId: e.productionLotId,
            workDate: new Date(`${e.workDate}T00:00:00.000Z`),
            inputQty: e.inputQty,
            goodQty: e.goodQty,
            defectQty: e.defectQty,
            workMinutes: e.workMinutes,
            contributionPct: e.contributionPct,
          })),
        })
      }

      await tx.workerProcessWorkTime.upsert({
        where: { workerId_processId: { workerId: id, processId } },
        create: { workerId: id, processId, workMinutes: totalMinutes },
        update: { workMinutes: totalMinutes },
      })

      const siblings = await tx.workerProcessWorkTime.findMany({
        where: { workerId: id, process: { productId: proc.productId } },
        select: { workMinutes: true },
      })
      const productTotal = siblings.reduce((s, r) => s + r.workMinutes, 0)
      await tx.workerProductWorkTime.upsert({
        where: { workerId_productId: { workerId: id, productId: proc.productId } },
        create: { workerId: id, productId: proc.productId, workMinutes: productTotal },
        update: { workMinutes: productTotal },
      })
    })

    return res.json({ ok: true, workMinutes: totalMinutes })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workersRouter.put('/workers/:id/process-work-times', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const parsed = processWorkTimesBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  try {
    const worker = await prisma.worker.findUnique({ where: { id }, select: { id: true } })
    if (!worker) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const processIds = [...new Set(parsed.data.items.map((i) => i.processId))]
    const validProcesses = await prisma.mbomProcess.findMany({
      where: { id: { in: processIds }, useYn: 'Y' },
      select: { id: true, productId: true },
    })
    const validSet = new Set(validProcesses.map((p) => p.id))
    const productByProcess = new Map(validProcesses.map((p) => [p.id, p.productId]))

    const filtered = parsed.data.items.filter((i) => validSet.has(i.processId))

    await prisma.$transaction(async (tx) => {
      for (const i of filtered) {
        await tx.workerProcessWorkTime.upsert({
          where: { workerId_processId: { workerId: id, processId: i.processId } },
          create: { workerId: id, processId: i.processId, workMinutes: i.workMinutes },
          update: { workMinutes: i.workMinutes },
        })
      }

      const sumByProduct = new Map<number, number>()
      for (const i of filtered) {
        const productId = productByProcess.get(i.processId)
        if (productId == null) continue
        sumByProduct.set(productId, (sumByProduct.get(productId) ?? 0) + i.workMinutes)
      }
      for (const [productId, workMinutes] of sumByProduct) {
        await tx.workerProductWorkTime.upsert({
          where: { workerId_productId: { workerId: id, productId } },
          create: { workerId: id, productId, workMinutes },
          update: { workMinutes },
        })
      }
    })

    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
