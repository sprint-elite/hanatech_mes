import {
  InventoryTxRefType,
  InventoryTxType,
  LotHistoryEventType,
  MaterialLotStatus,
  Prisma,
} from '@prisma/client'

export type IssueMaterialInTxParams = {
  productionLotId: number
  materialLotId: number
  usedQty: Prisma.Decimal
  woId: number | null | undefined
  createdBy: number | null | undefined
  /** false면 work_order_material.issuedQty 는 건드리지 않음(호출 측에서 일괄 반영) */
  applyWorkOrderMaterial?: boolean
  /** true면 lot_history 생성 생략(백플러시 등에서 상위에서 한 줄로 남길 때) */
  skipLotHistory?: boolean
}

export type IssueMaterialInTxError = { code: string; message: string }

/**
 * 트랜잭션 안에서 자재 LOT 투입 1건: material_lot, lot_material_usage, lot_history,
 * (자재 LOT에 재고 1행이면) inventory OUT + inventory_transaction,
 * (옵션) work_order_material.issuedQty 증가.
 */
export async function issueMaterialInTx(
  tx: Prisma.TransactionClient,
  p: IssueMaterialInTxParams,
): Promise<IssueMaterialInTxError | { usageId: number }> {
  const applyWo = p.applyWorkOrderMaterial !== false
  const skipHist = p.skipLotHistory === true

  await tx.$queryRaw`SELECT id FROM production_lot WHERE id = ${p.productionLotId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM material_lot WHERE id = ${p.materialLotId} FOR UPDATE`

  const pl = await tx.productionLot.findUnique({
    where: { id: p.productionLotId },
    select: { id: true, lotNo: true, status: true },
  })
  if (!pl) return { code: 'PRODUCTION_LOT_NOT_FOUND', message: '생산 LOT 없음' }
  if (pl.status === 'DONE') {
    return { code: 'LOT_ALREADY_DONE', message: '완료된 생산 LOT에는 투입할 수 없습니다.' }
  }

  const ml = await tx.materialLot.findUnique({
    where: { id: p.materialLotId },
    select: {
      id: true,
      lotNo: true,
      productId: true,
      remainQty: true,
      status: true,
      product: { select: { productCode: true, productName: true } },
    },
  })
  if (!ml) return { code: 'MATERIAL_LOT_NOT_FOUND', message: '자재 LOT 없음' }
  if (ml.status !== MaterialLotStatus.AVAILABLE && ml.status !== MaterialLotStatus.HOLD) {
    return { code: 'MATERIAL_LOT_NOT_AVAILABLE', message: '자재 LOT 상태가 투입 가능하지 않습니다.' }
  }
  if (ml.remainQty.lt(p.usedQty)) {
    return {
      code: 'INSUFFICIENT_MATERIAL_QTY',
      message: `잔량(${ml.remainQty.toString()})보다 투입량(${p.usedQty.toString()})이 큽니다.`,
    }
  }

  const newRemain = ml.remainQty.minus(p.usedQty)

  await tx.materialLot.update({
    where: { id: p.materialLotId },
    data: {
      remainQty: newRemain,
      status: newRemain.lte(0) ? MaterialLotStatus.USED : ml.status,
    },
  })

  const usage = await tx.lotMaterialUsage.create({
    data: {
      productionLotId: p.productionLotId,
      materialLotId: p.materialLotId,
      usedQty: p.usedQty,
    },
    select: { id: true },
  })

  if (!skipHist) {
    const matLabel = ml.product ? ml.product.productName : `품목#${ml.productId}`
    await tx.lotHistory.create({
      data: {
        productionLotId: p.productionLotId,
        eventType: LotHistoryEventType.MOVE,
        eventDesc: `품목 ${matLabel}, 자재LOT ${ml.lotNo}에서 ${p.usedQty.toString()}개 사용`,
      },
    })
  }

  const invList = await tx.inventory.findMany({
    where: { materialLotId: p.materialLotId },
    select: { id: true, qty: true, locationId: true, productId: true },
  })
  for (const inv of invList) {
    await tx.$queryRaw`SELECT id FROM inventory WHERE id = ${inv.id} FOR UPDATE`
  }

  if (invList.length > 0) {
    if (!p.usedQty.mod(1).isZero()) {
      return {
        code: 'INVENTORY_REQUIRES_INTEGER_QTY',
        message: '자재 LOT에 연결된 재고가 있을 때는 투입 수량이 정수(소수 없음)여야 합니다.',
      }
    }
    const qInt = p.usedQty.toNumber()
    const inv = invList[0]
    if (invList.length > 1) {
      return {
        code: 'MULTIPLE_INVENTORY_ROWS',
        message: '동일 자재 LOT에 재고 행이 여러 개입니다. 수동으로 정리한 뒤 다시 시도하세요.',
      }
    }
    if (inv.qty < qInt) {
      return {
        code: 'INSUFFICIENT_INVENTORY',
        message: `재고 수량(${inv.qty})이 투입 정수 수량(${qInt})보다 작습니다.`,
      }
    }
    const before = inv.qty
    const after = before - qInt
    await tx.inventory.update({
      where: { id: inv.id },
      data: { qty: { decrement: qInt } },
    })
    await tx.inventoryTransaction.create({
      data: {
        productId: inv.productId,
        materialLotId: p.materialLotId,
        locationId: inv.locationId ?? undefined,
        transactionType: InventoryTxType.OUT,
        qty: qInt,
        refType: InventoryTxRefType.LOT,
        refId: p.productionLotId,
        beforeQty: before,
        afterQty: after,
        createdBy: p.createdBy ?? undefined,
      },
    })
  }

  if (applyWo && p.woId != null) {
    const wom = await tx.workOrderMaterial.findFirst({
      where: { woId: p.woId, materialProductId: ml.productId },
      select: { id: true },
    })
    if (wom) {
      await tx.workOrderMaterial.update({
        where: { id: wom.id },
        data: { issuedQty: { increment: p.usedQty } },
      })
    }
  }

  return { usageId: usage.id }
}
