import { Router } from 'express'
import { z } from 'zod'
import { UseYn } from '@prisma/client'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

const useYn = z.enum(['Y', 'N'])

export const extendedMastersRouter = Router()

/* —— locations —— */
extendedMastersRouter.get('/locations', async (_req, res) => {
  try {
    const items = await prisma.location.findMany({
      take: 500,
      orderBy: { id: 'asc' },
      include: { parent: { select: { id: true, locationCode: true, locationName: true } } },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const locBody = z.object({
  locationCode: z.string().trim().min(1).max(64),
  locationName: z.string().trim().min(1).max(200),
  parentId: z.number().int().positive().optional().nullable(),
  locationType: z.string().trim().min(1).max(40),
  useYn: useYn.optional(),
})

extendedMastersRouter.post('/locations', async (req, res) => {
  const p = locBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.location.create({
      data: {
        locationCode: b.locationCode,
        locationName: b.locationName,
        parentId: b.parentId ?? undefined,
        locationType: b.locationType,
        useYn: (b.useYn as UseYn) ?? UseYn.Y,
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.patch('/locations/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = locBody.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const item = await prisma.location.update({
      where: { id },
      data: {
        ...(b.locationCode !== undefined ? { locationCode: b.locationCode } : {}),
        ...(b.locationName !== undefined ? { locationName: b.locationName } : {}),
        ...(b.parentId !== undefined ? { parentId: b.parentId } : {}),
        ...(b.locationType !== undefined ? { locationType: b.locationType } : {}),
        ...(b.useYn !== undefined ? { useYn: b.useYn as UseYn } : {}),
      },
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.delete('/locations/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.location.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— roles —— */
extendedMastersRouter.get('/roles', async (_req, res) => {
  try {
    const items = await prisma.role.findMany({ take: 200, orderBy: { id: 'asc' } })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const roleBody = z.object({
  roleName: z.string().trim().min(1).max(100),
  description: z.string().optional().nullable(),
})

extendedMastersRouter.post('/roles', async (req, res) => {
  const p = roleBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  try {
    const item = await prisma.role.create({ data: { roleName: p.data.roleName, description: p.data.description ?? undefined } })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.patch('/roles/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = roleBody.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const item = await prisma.role.update({
      where: { id },
      data: {
        ...(b.roleName !== undefined ? { roleName: b.roleName } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
      },
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.delete('/roles/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.role.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— users (목록·간단 등록, 비밀번호 평문 저장은 개발용 — 추후 bcrypt) —— */
extendedMastersRouter.get('/users', async (_req, res) => {
  try {
    const items = await prisma.user.findMany({
      take: 300,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        loginId: true,
        userName: true,
        roleId: true,
        workerId: true,
        email: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { roleName: true } },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const userBody = z.object({
  loginId: z.string().trim().min(2).max(64),
  userName: z.string().trim().min(1).max(100),
  password: z.string().min(4).max(128),
  roleId: z.number().int().positive(),
  workerId: z.number().int().positive().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
})

extendedMastersRouter.post('/users', async (req, res) => {
  const p = userBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.user.create({
      data: {
        loginId: b.loginId,
        userName: b.userName,
        passwordHash: `[dev-plain]${b.password}`,
        roleId: b.roleId,
        workerId: b.workerId ?? undefined,
        email: b.email ?? undefined,
        phone: b.phone ?? undefined,
        status: b.status ?? 'ACTIVE',
      },
      select: {
        id: true,
        loginId: true,
        userName: true,
        roleId: true,
        workerId: true,
        status: true,
        createdAt: true,
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.delete('/users/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.user.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— EBOM —— */
extendedMastersRouter.get('/ebom', async (_req, res) => {
  try {
    const items = await prisma.ebom.findMany({
      take: 5000,
      orderBy: [{ parentProductId: 'asc' }, { sequence: 'asc' }],
      include: {
        parentProduct: { select: { id: true, productCode: true, productName: true, itemType: true } },
        childProduct: { select: { id: true, productCode: true, productName: true, itemType: true, specJson: true } },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.get('/ebom/tree', async (_req, res) => {
  try {
    const lines = await prisma.ebom.findMany({
      take: 5000,
      orderBy: [{ parentProductId: 'asc' }, { sequence: 'asc' }, { id: 'asc' }],
      include: {
        parentProduct: { select: { id: true, productCode: true, productName: true, itemType: true } },
        childProduct: { select: { id: true, productCode: true, productName: true, itemType: true, specJson: true } },
      },
    })

    const m = new Map<number, { parent: (typeof lines)[number]['parentProduct']; lines: typeof lines }>()
    for (const l of lines) {
      if (!m.has(l.parentProductId)) m.set(l.parentProductId, { parent: l.parentProduct, lines: [] as typeof lines })
      m.get(l.parentProductId)!.lines.push(l)
    }
    const parents = Array.from(m.values()).map((g) => ({
      parentProduct: g.parent,
      lines: g.lines,
      lineCount: g.lines.length,
    }))
    return res.json({ ok: true, parents })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const ebomBody = z.object({
  parentProductId: z.number().int().positive(),
  childProductId: z.number().int().positive(),
  qty: z.union([z.number().positive(), z.string()]),
  unit: z.string().trim().min(1).max(20),
  spec: z.string().trim().max(255).optional().nullable(),
  lossRate: z.union([z.number().nonnegative(), z.string()]).optional().nullable(),
  sequence: z.number().int().nonnegative().optional(),
  pathSequence: z.number().int().nonnegative().optional().nullable(),
  remark: z.string().trim().max(2000).optional().nullable(),
  inUnitPrice: z.union([z.number().nonnegative(), z.string()]).optional().nullable(),
  outUnitPrice: z.union([z.number().nonnegative(), z.string()]).optional().nullable(),
  useYn: useYn.optional(),
})

extendedMastersRouter.post('/ebom', async (req, res) => {
  const p = ebomBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.ebom.create({
      data: {
        parentProductId: b.parentProductId,
        childProductId: b.childProductId,
        qty: String(b.qty),
        unit: b.unit,
        spec: b.spec ?? undefined,
        lossRate: b.lossRate == null ? undefined : String(b.lossRate),
        sequence: b.sequence ?? 0,
        pathSequence: b.pathSequence ?? undefined,
        remark: b.remark ?? undefined,
        inUnitPrice: b.inUnitPrice == null ? undefined : String(b.inUnitPrice),
        outUnitPrice: b.outUnitPrice == null ? undefined : String(b.outUnitPrice),
        useYn: (b.useYn as UseYn) ?? UseYn.Y,
      },
      include: {
        parentProduct: { select: { id: true, productCode: true, productName: true, itemType: true } },
        childProduct: { select: { id: true, productCode: true, productName: true, itemType: true, specJson: true } },
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.patch('/ebom/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = ebomBody.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const item = await prisma.ebom.update({
      where: { id },
      data: {
        ...(b.parentProductId !== undefined ? { parentProductId: b.parentProductId } : {}),
        ...(b.childProductId !== undefined ? { childProductId: b.childProductId } : {}),
        ...(b.qty !== undefined ? { qty: String(b.qty) } : {}),
        ...(b.unit !== undefined ? { unit: b.unit } : {}),
        ...(b.spec !== undefined ? { spec: b.spec } : {}),
        ...(b.lossRate !== undefined ? { lossRate: b.lossRate == null ? null : String(b.lossRate) } : {}),
        ...(b.sequence !== undefined ? { sequence: b.sequence } : {}),
        ...(b.pathSequence !== undefined ? { pathSequence: b.pathSequence } : {}),
        ...(b.remark !== undefined ? { remark: b.remark } : {}),
        ...(b.inUnitPrice !== undefined ? { inUnitPrice: b.inUnitPrice == null ? null : String(b.inUnitPrice) } : {}),
        ...(b.outUnitPrice !== undefined ? { outUnitPrice: b.outUnitPrice == null ? null : String(b.outUnitPrice) } : {}),
        ...(b.useYn !== undefined ? { useYn: b.useYn as UseYn } : {}),
      },
      include: {
        parentProduct: { select: { id: true, productCode: true, productName: true, itemType: true } },
        childProduct: { select: { id: true, productCode: true, productName: true, itemType: true, specJson: true } },
      },
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.delete('/ebom/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.ebom.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— MBOM 공정별 투입 자재 —— */
extendedMastersRouter.get('/mbom-materials', async (_req, res) => {
  try {
    const items = await prisma.mbomProcessMaterial.findMany({
      take: 500,
      orderBy: { id: 'desc' },
      include: {
        process: {
          select: {
            id: true,
            processCode: true,
            processName: true,
            productId: true,
            sequence: true,
            product: { select: { productCode: true, productName: true } },
          },
        },
        materialProduct: { select: { productCode: true, productName: true } },
      },
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const mmBody = z.object({
  processId: z.number().int().positive(),
  materialProductId: z.number().int().positive(),
  qty: z.union([z.number().positive(), z.string()]),
  unit: z.string().trim().min(1).max(20),
  lossRate: z.union([z.number().nonnegative(), z.string()]).optional().nullable(),
  isKeyMaterial: useYn.optional(),
})

extendedMastersRouter.post('/mbom-materials', async (req, res) => {
  const p = mmBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.mbomProcessMaterial.create({
      data: {
        processId: b.processId,
        materialProductId: b.materialProductId,
        qty: String(b.qty),
        unit: b.unit,
        lossRate: b.lossRate == null ? undefined : String(b.lossRate),
        isKeyMaterial: (b.isKeyMaterial as UseYn) ?? UseYn.N,
      },
      include: {
        process: { select: { processCode: true, processName: true } },
        materialProduct: { select: { productCode: true, productName: true } },
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.patch('/mbom-materials/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = mmBody.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  if (Object.keys(b).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })
  try {
    const item = await prisma.mbomProcessMaterial.update({
      where: { id },
      data: {
        ...(b.processId !== undefined ? { processId: b.processId } : {}),
        ...(b.materialProductId !== undefined ? { materialProductId: b.materialProductId } : {}),
        ...(b.qty !== undefined ? { qty: String(b.qty) } : {}),
        ...(b.unit !== undefined ? { unit: b.unit } : {}),
        ...(b.lossRate !== undefined ? { lossRate: b.lossRate == null ? null : String(b.lossRate) } : {}),
        ...(b.isKeyMaterial !== undefined ? { isKeyMaterial: b.isKeyMaterial as UseYn } : {}),
      },
      include: {
        process: {
          select: {
            id: true,
            processCode: true,
            processName: true,
            productId: true,
            sequence: true,
            product: { select: { productCode: true, productName: true } },
          },
        },
        materialProduct: { select: { productCode: true, productName: true } },
      },
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.delete('/mbom-materials/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.mbomProcessMaterial.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

/* —— 공지 —— */
extendedMastersRouter.get('/notices', async (_req, res) => {
  try {
    const items = await prisma.notice.findMany({ take: 200, orderBy: { id: 'desc' } })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const noticeBody = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1),
  noticeType: z.string().trim().min(1).max(40),
  priority: z.string().trim().max(20).optional(),
  startDate: z.string().min(8).max(32),
  endDate: z.string().min(8).max(32),
  isPopup: useYn.optional(),
  useYn: useYn.optional(),
})

extendedMastersRouter.post('/notices', async (req, res) => {
  const p = noticeBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const item = await prisma.notice.create({
      data: {
        title: b.title,
        content: b.content,
        noticeType: b.noticeType,
        priority: b.priority ?? 'NORMAL',
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        isPopup: (b.isPopup as UseYn) ?? UseYn.N,
        useYn: (b.useYn as UseYn) ?? UseYn.Y,
      },
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

extendedMastersRouter.delete('/notices/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.notice.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
