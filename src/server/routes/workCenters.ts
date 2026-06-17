import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'

const useYn = z.enum(['Y', 'N'])

const createBody = z.object({
  centerCode: z.string().trim().min(1).max(64),
  centerName: z.string().trim().min(1).max(200),
  centerType: z.enum(['LINE', 'EQUIPMENT', 'OUTSOURCE']),
  parentId: z.number().int().positive().optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  capacityPerHour: z.number().int().min(0).optional().nullable(),
  useYn: useYn.optional(),
})

const updateBody = createBody.partial()

export const workCentersRouter = Router()

const wcSelect = {
  id: true,
  centerCode: true,
  centerName: true,
  centerType: true,
  parentId: true,
  location: true,
  capacityPerHour: true,
  useYn: true,
  createdAt: true,
  parent: { select: { id: true, centerCode: true, centerName: true } },
} as const

workCentersRouter.get('/work-centers', async (_req, res) => {
  try {
    const items = await prisma.workCenter.findMany({
      take: 2000,
      orderBy: [{ centerType: 'asc' }, { centerCode: 'asc' }, { id: 'asc' }],
      select: wcSelect,
    })
    return res.json({ ok: true, items })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workCentersRouter.get('/work-centers/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const item = await prisma.workCenter.findUnique({
      where: { id },
      select: wcSelect,
    })
    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workCentersRouter.post('/work-centers', async (req, res) => {
  const parsed = createBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }
  const b = parsed.data
  try {
    const item = await prisma.workCenter.create({
      data: {
        centerCode: b.centerCode,
        centerName: b.centerName,
        centerType: b.centerType,
        parentId: b.parentId ?? undefined,
        location: b.location ?? undefined,
        capacityPerHour: b.capacityPerHour ?? undefined,
        useYn: b.useYn ?? 'Y',
      },
      select: wcSelect,
    })
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workCentersRouter.patch('/work-centers/:id', async (req, res) => {
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
      ...(b.centerCode !== undefined ? { centerCode: b.centerCode } : {}),
      ...(b.centerName !== undefined ? { centerName: b.centerName } : {}),
      ...(b.centerType !== undefined ? { centerType: b.centerType } : {}),
      ...(b.parentId !== undefined ? { parentId: b.parentId } : {}),
      ...(b.location !== undefined ? { location: b.location } : {}),
      ...(b.capacityPerHour !== undefined ? { capacityPerHour: b.capacityPerHour } : {}),
      ...(b.useYn !== undefined ? { useYn: b.useYn } : {}),
    }
    const item = await prisma.workCenter.update({
      where: { id },
      data,
      select: wcSelect,
    })
    return res.json({ ok: true, item })
  } catch (e) {
    return prismaFail(res, e)
  }
})

workCentersRouter.delete('/work-centers/:id', async (req, res) => {
  const id = parsePositiveIntParam(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    await prisma.workCenter.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})
