import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { parsePositiveIntParam } from '../lib/params'
import {
  getGlobalCostBasis,
  getProductCostBasis,
  rollupMaterialUnitCost,
  serializeCostBasis,
} from '../lib/productCostCalc'

const optionalMoney = z.number().finite().gte(0).nullable().optional()
const optionalRate = z.number().finite().gte(0).nullable().optional()

const globalBody = z.object({
  laborRatePerSec: optionalRate,
  fixedRatePerSec: optionalRate,
  memo: z.string().trim().max(500).nullable().optional(),
})

const productBody = z.object({
  productUnitCost: optionalMoney,
  sellingPrice: optionalMoney,
  laborRatePerSec: optionalRate,
  fixedRatePerSec: optionalRate,
  memo: z.string().trim().max(500).nullable().optional(),
})

export const productionCostBasisRouter = Router()

productionCostBasisRouter.get('/production-cost-basis/config', async (_req, res) => {
  try {
    const row = await getGlobalCostBasis()
    return res.json({ ok: true, config: serializeCostBasis(row) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionCostBasisRouter.put('/production-cost-basis/config', async (req, res) => {
  const p = globalBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const existing = await getGlobalCostBasis()
    const row = await prisma.productionCostBasis.update({
      where: { id: existing.id },
      data: {
        laborRatePerSec: b.laborRatePerSec ?? null,
        fixedRatePerSec: b.fixedRatePerSec ?? null,
        ...(b.memo !== undefined ? { memo: b.memo } : {}),
      },
    })
    return res.json({ ok: true, config: serializeCostBasis(row) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionCostBasisRouter.get('/production-cost-basis/products', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const itemType = typeof req.query.itemType === 'string' ? req.query.itemType.trim() : ''
  try {
    const globalBasis = await getGlobalCostBasis()
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        ...(itemType ? { itemType } : {}),
        ...(q
          ? {
              OR: [
                { productCode: { contains: q } },
                { productName: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ itemType: 'asc' }, { productCode: 'asc' }],
      take: 500,
      select: {
        id: true,
        productCode: true,
        productName: true,
        itemType: true,
        unit: true,
        materialUnitCost: true,
        purchaseProfile: { select: { purchasePrice: true } },
        costBasis: true,
      },
    })

    const items = products.map((p) => {
      const basis = p.costBasis ? serializeCostBasis(p.costBasis) : null
      const purchasePrice = p.purchaseProfile?.purchasePrice != null ? Number(p.purchaseProfile.purchasePrice.toString()) : null
      const materialOnProduct = p.materialUnitCost != null ? Number(p.materialUnitCost.toString()) : null
      return {
        id: p.id,
        productCode: p.productCode,
        productName: p.productName,
        itemType: p.itemType,
        unit: p.unit,
        materialUnitCost: materialOnProduct,
        avgInboundUnitCost: materialOnProduct,
        purchasePrice,
        basis,
        effectiveLaborRatePerSec: basis?.laborRatePerSec ?? serializeCostBasis(globalBasis).laborRatePerSec,
        effectiveFixedRatePerSec: basis?.fixedRatePerSec ?? serializeCostBasis(globalBasis).fixedRatePerSec,
        productUnitCost: basis?.productUnitCost ?? null,
        sellingPrice: basis?.sellingPrice ?? null,
      }
    })
    return res.json({ ok: true, items, global: serializeCostBasis(globalBasis) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionCostBasisRouter.get('/production-cost-basis/products/:productId', async (req, res) => {
  const productId = parsePositiveIntParam(req.params.productId)
  if (!productId) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const detail = await getProductCostBasis(productId)
    if (!detail) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
    return res.json({
      ok: true,
      product: {
        ...detail.product,
        materialUnitCost: detail.materialUnitCost,
      },
      rolledMaterialUnitCost: detail.rolledMaterialUnitCost,
      basis: detail.basis,
      global: detail.global,
      effective: detail.effective,
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionCostBasisRouter.put('/production-cost-basis/products/:productId', async (req, res) => {
  const productId = parsePositiveIntParam(req.params.productId)
  if (!productId) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  const p = productBody.safeParse(req.body)
  if (!p.success) return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: p.error.flatten() })
  const b = p.data
  try {
    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!exists) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const row = await prisma.productionCostBasis.upsert({
      where: { productId },
      create: {
        basisType: 'PRODUCT',
        productId,
        productUnitCost: b.productUnitCost ?? null,
        sellingPrice: b.sellingPrice ?? null,
        laborRatePerSec: b.laborRatePerSec ?? null,
        fixedRatePerSec: b.fixedRatePerSec ?? null,
        memo: b.memo ?? null,
      },
      update: {
        productUnitCost: b.productUnitCost ?? null,
        sellingPrice: b.sellingPrice ?? null,
        laborRatePerSec: b.laborRatePerSec ?? null,
        fixedRatePerSec: b.fixedRatePerSec ?? null,
        ...(b.memo !== undefined ? { memo: b.memo } : {}),
      },
    })
    return res.json({ ok: true, basis: serializeCostBasis(row) })
  } catch (e) {
    return prismaFail(res, e)
  }
})

productionCostBasisRouter.post('/production-cost-basis/products/:productId/rollup-material', async (req, res) => {
  const productId = parsePositiveIntParam(req.params.productId)
  if (!productId) return res.status(400).json({ ok: false, error: 'INVALID_ID' })
  try {
    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!exists) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    const materialUnitCost = await rollupMaterialUnitCost(productId)
    const row = await prisma.productionCostBasis.upsert({
      where: { productId },
      create: {
        basisType: 'PRODUCT',
        productId,
        materialUnitCost,
      },
      update: { materialUnitCost },
    })
    return res.json({ ok: true, materialUnitCost, basis: serializeCostBasis(row) })
  } catch (e) {
    return prismaFail(res, e)
  }
})
