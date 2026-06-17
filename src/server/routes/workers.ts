import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

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
    const [products, workers, results, workTimes] = await Promise.all([
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
          inputQty: true,
          goodQty: true,
          defectQty: true,
          lot: { select: { productId: true } },
        },
      }),
      prisma.workerProductWorkTime.findMany({
        select: { workerId: true, productId: true, workMinutes: true },
      }),
    ])

    type Agg = { inputQty: number; goodQty: number; defectQty: number; workMinutes: number }
    const cellMap = new Map<string, Agg>()
    const keyOf = (w: number, p: number) => `${w}:${p}`

    for (const r of results) {
      if (r.workerId == null) continue
      const k = keyOf(r.workerId, r.lot.productId)
      const cur = cellMap.get(k) ?? { inputQty: 0, goodQty: 0, defectQty: 0, workMinutes: 0 }
      cur.inputQty += r.inputQty
      cur.goodQty += r.goodQty
      cur.defectQty += r.defectQty
      cellMap.set(k, cur)
    }
    for (const wt of workTimes) {
      const k = keyOf(wt.workerId, wt.productId)
      const cur = cellMap.get(k) ?? { inputQty: 0, goodQty: 0, defectQty: 0, workMinutes: 0 }
      cur.workMinutes += wt.workMinutes
      cellMap.set(k, cur)
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

    return res.json({ ok: true, products: activeProducts, workers, cells })
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

workersRouter.get('/workers/:id/product-summary', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const worker = await prisma.worker.findUnique({
      where: { id },
      select: { id: true, workerCode: true, workerName: true },
    })
    if (!worker) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const products = await prisma.product.findMany({
      where: { itemType: { not: 'RAW' } },
      orderBy: [{ itemType: 'asc' }, { productName: 'asc' }],
      select: { id: true, productCode: true, productName: true, itemType: true },
    })

    const results = await prisma.processResult.findMany({
      where: { workerId: id },
      select: {
        inputQty: true,
        goodQty: true,
        defectQty: true,
        lot: { select: { productId: true } },
      },
    })

    const agg = new Map<number, { inputQty: number; goodQty: number; defectQty: number }>()
    for (const r of results) {
      const pid = r.lot.productId
      const cur = agg.get(pid) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
      cur.inputQty += r.inputQty
      cur.goodQty += r.goodQty
      cur.defectQty += r.defectQty
      agg.set(pid, cur)
    }

    const workTimes = await prisma.workerProductWorkTime.findMany({
      where: { workerId: id },
      select: { productId: true, workMinutes: true },
    })
    const wtMap = new Map(workTimes.map((w) => [w.productId, w.workMinutes]))

    const items = products.map((p) => {
      const a = agg.get(p.id) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
      return {
        productId: p.id,
        productCode: p.productCode,
        productName: p.productName,
        itemType: p.itemType,
        inputQty: a.inputQty,
        goodQty: a.goodQty,
        defectQty: a.defectQty,
        workMinutes: wtMap.get(p.id) ?? 0,
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
