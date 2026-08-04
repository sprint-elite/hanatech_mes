import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'

type Tx = Prisma.TransactionClient

export function dec(v: Prisma.Decimal | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v.toString())
  return Number.isFinite(n) ? n : null
}

/** 입고 수량 가중 평균 단가 병합 */
export function mergeWeightedUnitPrice(
  oldQty: Prisma.Decimal,
  oldPrice: Prisma.Decimal | null,
  addQty: Prisma.Decimal,
  addPrice: Prisma.Decimal | null,
): Prisma.Decimal | null {
  const aq = Number(addQty.toString())
  const ap = addPrice != null ? dec(addPrice) : null
  if (aq <= 0) return oldPrice
  if (ap == null || ap < 0) return oldPrice

  const oq = Number(oldQty.toString())
  const op = oldPrice != null ? dec(oldPrice) : null
  if (oq <= 0 || op == null) return new Prisma.Decimal(ap)

  const merged = (oq * op + aq * ap) / (oq + aq)
  return new Prisma.Decimal(Math.round(merged * 10000) / 10000)
}

/** 자재 LOT 입고 이력 기준 가중 평균 단가 */
export async function computeWeightedAvgFromLots(productId: number, tx?: Tx) {
  const db = tx ?? prisma
  const lots = await db.materialLot.findMany({
    where: { productId, unitPrice: { not: null } },
    select: { receivedQty: true, unitPrice: true },
  })
  let totalValue = 0
  let totalQty = 0
  for (const lot of lots) {
    const price = dec(lot.unitPrice)
    const qty = Number(lot.receivedQty.toString())
    if (price != null && price >= 0 && qty > 0) {
      totalValue += qty * price
      totalQty += qty
    }
  }
  if (totalQty <= 0) return null
  return Math.round((totalValue / totalQty) * 10000) / 10000
}

/** 입고 단가 미입력 시: 기존 평균 → 구매 기본단가 */
export async function resolveInboundUnitPrice(
  productId: number,
  userPrice?: number | null,
  tx?: Tx,
): Promise<number | null> {
  if (userPrice != null && Number.isFinite(userPrice) && userPrice >= 0) {
    return Math.round(userPrice * 10000) / 10000
  }

  const avg = await computeWeightedAvgFromLots(productId, tx)
  if (avg != null) return avg

  const db = tx ?? prisma
  const purchase = await db.productPurchase.findUnique({
    where: { productId },
    select: { purchasePrice: true },
  })
  const fromPurchase = dec(purchase?.purchasePrice ?? null)
  if (fromPurchase != null && fromPurchase >= 0) return fromPurchase

  return null
}

/** 품목 마스터에 계산된 평균 입고단가 캐시 */
export async function syncProductMaterialUnitCost(productId: number, tx?: Tx) {
  const db = tx ?? prisma
  const avg = await computeWeightedAvgFromLots(productId, tx)
  await db.product.update({
    where: { id: productId },
    data: { materialUnitCost: avg != null ? new Prisma.Decimal(avg) : null },
  })
  return avg
}

/** LOT별 단가 조회 (생산 투입 원가 산정용) */
export async function getMaterialLotUnitPrice(materialLotId: number, tx?: Tx): Promise<number | null> {
  const db = tx ?? prisma
  const lot = await db.materialLot.findUnique({
    where: { id: materialLotId },
    select: { unitPrice: true, productId: true },
  })
  if (!lot) return null
  const lotPrice = dec(lot.unitPrice)
  if (lotPrice != null && lotPrice >= 0) return lotPrice
  return resolveInboundUnitPrice(lot.productId, null, tx)
}
