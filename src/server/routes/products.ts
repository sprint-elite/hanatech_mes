import { Router } from 'express'

import { Prisma, UseYn } from '@prisma/client'

import { z } from 'zod'

import { prisma } from '../db/prisma'

import { prismaFail } from '../lib/prismaError'

import { parsePositiveIntParam } from '../lib/params'



function toPrismaJson(v: unknown): Prisma.InputJsonValue {

  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

}



const specJsonSchema = z.preprocess((val) => {

  if (val === undefined) return undefined

  if (val === null || val === '') return null

  if (typeof val === 'string') {

    try {

      return JSON.parse(val) as unknown

    } catch {

      return val

    }

  }

  return val

}, z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullable().optional())



const productFields = {

  productCode: z.string().trim().min(1).max(64),

  productName: z.string().trim().min(1).max(200),

  itemType: z.string().trim().min(1).max(20),

  itemNumber: z.string().trim().max(64).nullable().optional(),

  unit: z.string().trim().min(1).max(20),

  standardPackQty: z.number().int().positive().nullable().optional(),

  unitWeight: z.number().finite().gte(0).nullable().optional(),

  unitVolume: z.number().finite().gte(0).nullable().optional(),

  safetyStock: z.number().int().min(0).nullable().optional(),

  maxStock: z.number().int().min(0).nullable().optional(),

  barcode: z.string().trim().max(64).nullable().optional(),

  specJson: specJsonSchema,

  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),

}



const ynSchema = z.enum(['Y', 'N'])

const productionFields = z.object({

  isProduction: ynSchema.default('Y'),

})

const purchaseFields = z.object({

  isPurchasable: ynSchema.default('N'),

  defaultSupplierId: z.number().int().positive().nullable().optional(),

  purchaseUnit: z.string().trim().max(20).nullable().optional(),

  purchasePrice: z.number().finite().gte(0).nullable().optional(),

  moq: z.number().int().positive().nullable().optional(),

})

const qualityFields = z.object({

  inspectionRequiredYn: ynSchema.default('N'),

  inspectionType: z.enum(['MANUAL', 'VISION', 'SAMPLING']).nullable().optional(),

  defectToleranceRate: z.number().finite().gte(0).lte(100).nullable().optional(),

})

const inventoryFields = z.object({

  lotControlYn: ynSchema.default('Y'),

  purchaserCustomerId: z.number().int().positive().nullable().optional(),

})

const outsourcingFields = z.object({

  isOutsourcing: ynSchema.default('N'),

  defaultVendorId: z.number().int().positive().nullable().optional(),

})



const createBody = z.object({

  ...productFields,

  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),

  production: productionFields.optional(),

  purchase: purchaseFields.optional(),

  quality: qualityFields.optional(),

  inventory: inventoryFields.optional(),

  outsourcing: outsourcingFields.optional(),

})



const updateBody = z

  .object({

    ...productFields,

    production: productionFields.partial().optional(),

    purchase: purchaseFields.partial().optional(),

    quality: qualityFields.partial().optional(),

    inventory: inventoryFields.partial().optional(),

    outsourcing: outsourcingFields.partial().optional(),

  })

  .partial()

  .superRefine((data, ctx) => {

    if (data.specJson !== undefined && data.specJson !== null && typeof data.specJson !== 'object') {

      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'specJson must be object, array, or null', path: ['specJson'] })

    }

  })



const productSelect = {

  id: true,

  productCode: true,

  productName: true,

  itemType: true,

  itemNumber: true,

  unit: true,

  standardPackQty: true,

  unitWeight: true,

  unitVolume: true,

  safetyStock: true,

  maxStock: true,

  barcode: true,

  specJson: true,

  status: true,

  createdAt: true,

  updatedAt: true,

  productionProfile: {

    select: { isProduction: true },

  },

  purchaseProfile: {

    select: {

      isPurchasable: true,

      defaultSupplierId: true,

      defaultSupplierRef: { select: { id: true, customerCode: true, customerName: true, type: true } },

      purchaseUnit: true,

      purchasePrice: true,

      moq: true,

    },

  },

  qualityProfile: {

    select: { inspectionRequiredYn: true, inspectionType: true, defectToleranceRate: true },

  },

  inventoryProfile: {

    select: {

      lotControlYn: true,

      purchaserCustomerId: true,

      purchaserCustomer: {

        select: { id: true, customerCode: true, customerName: true, type: true },

      },

    },

  },

  outsourcingProfile: {

    select: {

      isOutsourcing: true,

      defaultVendorId: true,

      defaultVendorRef: { select: { id: true, customerCode: true, customerName: true, type: true } },

    },

  },

} satisfies Prisma.ProductSelect



type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>



function serializeProduct(p: ProductRow) {

  return {

    ...p,

    unitWeight: p.unitWeight != null ? p.unitWeight.toString() : null,

    unitVolume: p.unitVolume != null ? p.unitVolume.toString() : null,

    purchaseProfile: p.purchaseProfile

      ? {

          ...p.purchaseProfile,

          purchasePrice: p.purchaseProfile.purchasePrice?.toString() ?? null,

        }

      : null,

    qualityProfile: p.qualityProfile

      ? { ...p.qualityProfile, defectToleranceRate: p.qualityProfile.defectToleranceRate?.toString() ?? null }

      : null,

  }

}



function yn(v: 'Y' | 'N' | undefined, fallback: UseYn): UseYn {

  if (v === 'Y') return UseYn.Y

  if (v === 'N') return UseYn.N

  return fallback

}



export const productsRouter = Router()



async function writeAuditLog(

  tx: Prisma.TransactionClient,

  params: {

    tableName: string

    recordId: number

    actionType: 'CREATE' | 'UPDATE' | 'DELETE'

    oldValue?: unknown

    newValue?: unknown

    changedBy?: number

    ipAddress?: string

  },

) {

  await tx.auditLog.create({

    data: {

      tableName: params.tableName,

      recordId: params.recordId,

      actionType: params.actionType,

      oldValue: params.oldValue === undefined ? undefined : toPrismaJson(params.oldValue),

      newValue: params.newValue === undefined ? undefined : toPrismaJson(params.newValue),

      changedBy: params.changedBy,

      ipAddress: params.ipAddress,

    },

  })

}



const listQuery = z.object({

  q: z

    .string()

    .trim()

    .min(1)

    .max(200)

    .optional(),

  itemType: z

    .string()

    .trim()

    .min(1)

    .max(20)

    .optional(),

  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),

})



productsRouter.get('/products', async (req, res) => {

  const parsedQ = listQuery.safeParse(req.query)

  if (!parsedQ.success) {

    return res.status(400).json({ ok: false, error: 'INVALID_QUERY', details: parsedQ.error.flatten() })

  }

  const q = parsedQ.data

  try {

    const where: Prisma.ProductWhereInput = {}

    const and: Prisma.ProductWhereInput[] = []



    if (q.q) {

      const term = q.q

      and.push({

        OR: [

          { productCode: { contains: term } },

          { productName: { contains: term } },

          { itemNumber: { contains: term } },

          { barcode: { contains: term } },

        ],

      })

    }

    if (q.itemType) {

      and.push({ itemType: q.itemType })

    }

    if (q.status) {

      and.push({ status: q.status })

    }



    if (and.length) where.AND = and

    const items = await prisma.product.findMany({

      take: 2000,

      orderBy: { id: 'desc' },

      where,

      select: productSelect,

    })

    return res.json({ ok: true, items: items.map(serializeProduct) })

  } catch (e) {

    return prismaFail(res, e)

  }

})



productsRouter.get('/products/:id', async (req, res) => {

  const id = parsePositiveIntParam(req.params.id)

  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  try {

    const item = await prisma.product.findUnique({

      where: { id },

      select: productSelect,

    })

    if (!item) return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    return res.json({ ok: true, item: serializeProduct(item) })

  } catch (e) {

    return prismaFail(res, e)

  }

})



productsRouter.post('/products', async (req, res) => {

  const parsed = createBody.safeParse(req.body)

  if (!parsed.success) {

    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })

  }

  const b = parsed.data

  const changedByRaw = req.header('x-user-id')

  const changedBy = changedByRaw ? Number(changedByRaw) : undefined

  const actorId = Number.isInteger(changedBy) && (changedBy as number) > 0 ? (changedBy as number) : undefined

  const ipAddress = req.ip

  try {

    const item = await prisma.$transaction(async (tx) => {

      const created = await tx.product.create({

        data: {

          productCode: b.productCode,

          productName: b.productName,

          itemType: b.itemType,

          itemNumber:
            b.itemNumber === undefined
              ? undefined
              : b.itemNumber === null || b.itemNumber.trim() === ''
                ? null
                : b.itemNumber.trim(),

          unit: b.unit,

          standardPackQty: b.standardPackQty ?? undefined,

          unitWeight: b.unitWeight ?? undefined,

          unitVolume: b.unitVolume ?? undefined,

          safetyStock: b.safetyStock ?? undefined,

          maxStock: b.maxStock ?? undefined,

          barcode: b.barcode ?? undefined,

          specJson:

            b.specJson === undefined

              ? undefined

              : b.specJson === null

                ? Prisma.DbNull

                : toPrismaJson(b.specJson),

          status: b.status ?? 'ACTIVE',

        },

      })



      await tx.productProduction.create({

        data: {

          productId: created.id,

          isProduction: yn(b.production?.isProduction, UseYn.Y),

        },

      })

      await tx.productPurchase.create({

        data: {

          productId: created.id,

          isPurchasable: yn(b.purchase?.isPurchasable, UseYn.N),

          defaultSupplierId: b.purchase?.defaultSupplierId ?? undefined,

          purchaseUnit: b.purchase?.purchaseUnit ?? undefined,

          purchasePrice: b.purchase?.purchasePrice ?? undefined,

          moq: b.purchase?.moq ?? undefined,

        },

      })

      await tx.productQuality.create({

        data: {

          productId: created.id,

          inspectionRequiredYn: yn(b.quality?.inspectionRequiredYn, UseYn.N),

          inspectionType: b.quality?.inspectionType ?? undefined,

          defectToleranceRate: b.quality?.defectToleranceRate ?? undefined,

        },

      })

      await tx.productInventory.create({

        data: {

          productId: created.id,

          lotControlYn: yn(b.inventory?.lotControlYn, UseYn.Y),

          purchaserCustomerId: b.inventory?.purchaserCustomerId ?? undefined,

        },

      })

      await tx.productOutsourcing.create({

        data: {

          productId: created.id,

          isOutsourcing: yn(b.outsourcing?.isOutsourcing, UseYn.N),

          defaultVendorId: b.outsourcing?.defaultVendorId ?? undefined,

        },

      })



      const row = await tx.product.findUniqueOrThrow({ where: { id: created.id }, select: productSelect })

      const serialized = serializeProduct(row)

      await writeAuditLog(tx, {

        tableName: 'product',

        recordId: created.id,

        actionType: 'CREATE',

        newValue: serialized,

        changedBy: actorId,

        ipAddress,

      })

      return row

    })

    return res.status(201).json({ ok: true, item: serializeProduct(item) })

  } catch (e) {

    return prismaFail(res, e)

  }

})



productsRouter.patch('/products/:id', async (req, res) => {

  const id = parsePositiveIntParam(req.params.id)

  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  const parsed = updateBody.safeParse(req.body)

  if (!parsed.success) {

    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() })

  }

  const b = parsed.data

  if (Object.keys(b).length === 0) {

    return res.status(400).json({ ok: false, error: 'EMPTY_BODY' })

  }

  const changedByRaw = req.header('x-user-id')

  const changedBy = changedByRaw ? Number(changedByRaw) : undefined

  const actorId = Number.isInteger(changedBy) && (changedBy as number) > 0 ? (changedBy as number) : undefined

  const ipAddress = req.ip

  try {

    const data: Prisma.ProductUpdateInput = {

      ...(b.productCode !== undefined ? { productCode: b.productCode } : {}),

      ...(b.productName !== undefined ? { productName: b.productName } : {}),

      ...(b.itemType !== undefined ? { itemType: b.itemType } : {}),

      ...(b.itemNumber !== undefined

        ? { itemNumber: b.itemNumber === null ? null : b.itemNumber.trim() === '' ? null : b.itemNumber.trim() }

        : {}),

      ...(b.unit !== undefined ? { unit: b.unit } : {}),

      ...(b.standardPackQty !== undefined ? { standardPackQty: b.standardPackQty } : {}),

      ...(b.unitWeight !== undefined ? { unitWeight: b.unitWeight } : {}),

      ...(b.unitVolume !== undefined ? { unitVolume: b.unitVolume } : {}),

      ...(b.safetyStock !== undefined ? { safetyStock: b.safetyStock } : {}),

      ...(b.maxStock !== undefined ? { maxStock: b.maxStock } : {}),

      ...(b.barcode !== undefined ? { barcode: b.barcode } : {}),

      ...(b.specJson !== undefined

        ? {

            specJson: b.specJson === null ? Prisma.DbNull : toPrismaJson(b.specJson),

          }

        : {}),

      ...(b.status !== undefined ? { status: b.status } : {}),

    }

    const item = await prisma.$transaction(async (tx) => {

      const before = await tx.product.findUnique({

        where: { id },

        select: productSelect,

      })

      if (!before) {

        throw new Error('PRODUCT_NOT_FOUND')

      }

      await tx.product.update({ where: { id }, data })

      if (b.production !== undefined) {

        const p = b.production

        await tx.productProduction.upsert({

          where: { productId: id },

          create: {

            productId: id,

            isProduction: yn(p.isProduction, UseYn.Y),

          },

          update: {

            ...(p.isProduction !== undefined ? { isProduction: yn(p.isProduction, UseYn.Y) } : {}),

          },

        })

      }

      if (b.purchase !== undefined) {

        const p = b.purchase

        await tx.productPurchase.upsert({

          where: { productId: id },

          create: {

            productId: id,

            isPurchasable: yn(p.isPurchasable, UseYn.N),

            defaultSupplierId: p.defaultSupplierId ?? undefined,

            purchaseUnit: p.purchaseUnit ?? undefined,

            purchasePrice: p.purchasePrice ?? undefined,

            moq: p.moq ?? undefined,

          },

          update: {

            ...(p.isPurchasable !== undefined ? { isPurchasable: yn(p.isPurchasable, UseYn.N) } : {}),

            ...(p.defaultSupplierId !== undefined ? { defaultSupplierId: p.defaultSupplierId } : {}),

            ...(p.purchaseUnit !== undefined ? { purchaseUnit: p.purchaseUnit } : {}),

            ...(p.purchasePrice !== undefined ? { purchasePrice: p.purchasePrice } : {}),

            ...(p.moq !== undefined ? { moq: p.moq } : {}),

          },

        })

      }

      if (b.quality !== undefined) {

        const q = b.quality

        await tx.productQuality.upsert({

          where: { productId: id },

          create: {

            productId: id,

            inspectionRequiredYn: yn(q.inspectionRequiredYn, UseYn.N),

            inspectionType: q.inspectionType ?? undefined,

            defectToleranceRate: q.defectToleranceRate ?? undefined,

          },

          update: {

            ...(q.inspectionRequiredYn !== undefined

              ? { inspectionRequiredYn: yn(q.inspectionRequiredYn, UseYn.N) }

              : {}),

            ...(q.inspectionType !== undefined ? { inspectionType: q.inspectionType } : {}),

            ...(q.defectToleranceRate !== undefined ? { defectToleranceRate: q.defectToleranceRate } : {}),

          },

        })

      }

      if (b.inventory !== undefined) {

        const i = b.inventory

        await tx.productInventory.upsert({

          where: { productId: id },

          create: {

            productId: id,

            lotControlYn: yn(i.lotControlYn, UseYn.Y),

            purchaserCustomerId: i.purchaserCustomerId ?? undefined,

          },

          update: {

            ...(i.lotControlYn !== undefined ? { lotControlYn: yn(i.lotControlYn, UseYn.Y) } : {}),

            ...(i.purchaserCustomerId !== undefined ? { purchaserCustomerId: i.purchaserCustomerId } : {}),

          },

        })

      }

      if (b.outsourcing !== undefined) {

        const o = b.outsourcing

        await tx.productOutsourcing.upsert({

          where: { productId: id },

          create: {

            productId: id,

            isOutsourcing: yn(o.isOutsourcing, UseYn.N),

            defaultVendorId: o.defaultVendorId ?? undefined,

          },

          update: {

            ...(o.isOutsourcing !== undefined ? { isOutsourcing: yn(o.isOutsourcing, UseYn.N) } : {}),

            ...(o.defaultVendorId !== undefined ? { defaultVendorId: o.defaultVendorId } : {}),

          },

        })

      }

      const after = await tx.product.findUniqueOrThrow({ where: { id }, select: productSelect })

      await writeAuditLog(tx, {

        tableName: 'product',

        recordId: id,

        actionType: 'UPDATE',

        oldValue: serializeProduct(before),

        newValue: serializeProduct(after),

        changedBy: actorId,

        ipAddress,

      })

      return after

    })

    return res.json({ ok: true, item: serializeProduct(item) })

  } catch (e) {

    if (e instanceof Error && e.message === 'PRODUCT_NOT_FOUND') {

      return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    }

    return prismaFail(res, e)

  }

})



productsRouter.delete('/products/:id', async (req, res) => {

  const id = parsePositiveIntParam(req.params.id)

  if (!id) return res.status(400).json({ ok: false, error: 'INVALID_ID' })

  const changedByRaw = req.header('x-user-id')

  const changedBy = changedByRaw ? Number(changedByRaw) : undefined

  const actorId = Number.isInteger(changedBy) && (changedBy as number) > 0 ? (changedBy as number) : undefined

  const ipAddress = req.ip

  try {

    await prisma.$transaction(async (tx) => {

      const before = await tx.product.findUnique({

        where: { id },

        select: productSelect,

      })

      if (!before) {

        throw new Error('PRODUCT_NOT_FOUND')

      }

      await tx.productOutsourcing.deleteMany({ where: { productId: id } })

      await tx.productInventory.deleteMany({ where: { productId: id } })

      await tx.productQuality.deleteMany({ where: { productId: id } })

      await tx.productPurchase.deleteMany({ where: { productId: id } })

      await tx.productProduction.deleteMany({ where: { productId: id } })

      await tx.product.delete({ where: { id } })

      await writeAuditLog(tx, {

        tableName: 'product',

        recordId: id,

        actionType: 'DELETE',

        oldValue: serializeProduct(before),

        changedBy: actorId,

        ipAddress,

      })

    })

    return res.json({ ok: true })

  } catch (e) {

    if (e instanceof Error && e.message === 'PRODUCT_NOT_FOUND') {

      return res.status(404).json({ ok: false, error: 'NOT_FOUND' })

    }

    return prismaFail(res, e)

  }

})

