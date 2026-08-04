import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'

export type CostBasisRow = {
  basisType: string
  productId: number | null
  materialUnitCost: number | null
  productUnitCost: number | null
  sellingPrice: number | null
  laborRatePerSec: number | null
  fixedRatePerSec: number | null
  memo: string | null
}

function dec(v: Prisma.Decimal | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v.toString())
  return Number.isFinite(n) ? n : null
}

export function serializeCostBasis(row: {
  basisType: string
  productId: number | null
  materialUnitCost: Prisma.Decimal | null
  productUnitCost: Prisma.Decimal | null
  sellingPrice: Prisma.Decimal | null
  laborRatePerSec: Prisma.Decimal | null
  fixedRatePerSec: Prisma.Decimal | null
  memo: string | null
}): CostBasisRow {
  return {
    basisType: row.basisType,
    productId: row.productId,
    materialUnitCost: dec(row.materialUnitCost),
    productUnitCost: dec(row.productUnitCost),
    sellingPrice: dec(row.sellingPrice),
    laborRatePerSec: dec(row.laborRatePerSec),
    fixedRatePerSec: dec(row.fixedRatePerSec),
    memo: row.memo,
  }
}

/** 자식 품목 단가: EBOM 입고단가 → 입고 평균단가(캐시) → 구매단가 */
export function resolveMaterialUnitPrice(input: {
  ebomInUnitPrice: Prisma.Decimal | null
  productMaterialUnitCost: Prisma.Decimal | null
  purchasePrice: Prisma.Decimal | null
}): number {
  const fromEbom = dec(input.ebomInUnitPrice)
  if (fromEbom != null && fromEbom > 0) return fromEbom
  const fromProduct = dec(input.productMaterialUnitCost)
  if (fromProduct != null && fromProduct > 0) return fromProduct
  const fromPurchase = dec(input.purchasePrice)
  if (fromPurchase != null && fromPurchase > 0) return fromPurchase
  return 0
}

/** EBOM 기준 완제품 1단위당 원자재비 합산 */
export async function rollupMaterialUnitCost(productId: number): Promise<number> {
  const lines = await prisma.ebom.findMany({
    where: { parentProductId: productId, useYn: 'Y' },
    orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
    include: {
      childProduct: {
        select: {
          materialUnitCost: true,
          purchaseProfile: { select: { purchasePrice: true } },
        },
      },
    },
  })

  let total = 0
  for (const line of lines) {
    const qty = Number(line.qty.toString())
    const lossPct = dec(line.lossRate) ?? 0
    const unitPrice = resolveMaterialUnitPrice({
      ebomInUnitPrice: line.inUnitPrice,
      productMaterialUnitCost: line.childProduct.materialUnitCost,
      purchasePrice: line.childProduct.purchaseProfile?.purchasePrice ?? null,
    })
    total += qty * (1 + lossPct / 100) * unitPrice
  }
  return Math.round(total * 10000) / 10000
}

export async function getGlobalCostBasis() {
  const row = await prisma.productionCostBasis.findFirst({
    where: { basisType: 'GLOBAL' },
    orderBy: { id: 'asc' },
  })
  if (!row) {
    return await prisma.productionCostBasis.create({
      data: { basisType: 'GLOBAL', memo: '전사 기본 손익 산정 요율' },
    })
  }
  return row
}

export async function getProductCostBasis(productId: number) {
  const [globalBasis, productBasis, product] = await Promise.all([
    getGlobalCostBasis(),
    prisma.productionCostBasis.findFirst({ where: { basisType: 'PRODUCT', productId } }),
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        productCode: true,
        productName: true,
        itemType: true,
        unit: true,
        materialUnitCost: true,
      },
    }),
  ])
  if (!product) return null

  const rolledMaterial = await rollupMaterialUnitCost(productId).catch(() => null)

  return {
    product,
    materialUnitCost: dec(product.materialUnitCost),
    rolledMaterialUnitCost: rolledMaterial,
    basis: productBasis ? serializeCostBasis(productBasis) : null,
    global: serializeCostBasis(globalBasis),
    effective: {
      materialUnitCost:
        dec(productBasis?.materialUnitCost) ??
        rolledMaterial ??
        dec(product.materialUnitCost),
      productUnitCost: dec(productBasis?.productUnitCost),
      sellingPrice: dec(productBasis?.sellingPrice),
      laborRatePerSec: dec(productBasis?.laborRatePerSec) ?? dec(globalBasis.laborRatePerSec),
      fixedRatePerSec: dec(productBasis?.fixedRatePerSec) ?? dec(globalBasis.fixedRatePerSec),
    },
  }
}
