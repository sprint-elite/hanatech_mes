import { BarcodeType, Prisma, UseYn } from '@prisma/client'

const LOT_REF_TABLE = 'production_lot'

/** 생산 LOT 바코드 문자열 — 스캔 값 = LOT 번호 */
export function productionLotBarcodeValue(lotNo: string): string {
  return lotNo.trim()
}

type Tx = Prisma.TransactionClient

/** production_lot.barcode + barcode 마스터(LOT) 동기화 */
export async function syncProductionLotBarcode(
  tx: Tx,
  lotId: number,
  lotNo: string,
): Promise<string> {
  const barcodeValue = productionLotBarcodeValue(lotNo)

  await tx.productionLot.update({
    where: { id: lotId },
    data: { barcode: barcodeValue },
  })

  const existing = await tx.barcode.findFirst({
    where: { refTable: LOT_REF_TABLE, refId: lotId, barcodeType: BarcodeType.LOT },
    select: { id: true },
  })

  if (existing) {
    await tx.barcode.update({
      where: { id: existing.id },
      data: { barcodeValue, status: 'ACTIVE' },
    })
  } else {
    await tx.barcode.create({
      data: {
        barcodeValue,
        barcodeType: BarcodeType.LOT,
        refTable: LOT_REF_TABLE,
        refId: lotId,
        isPrimary: UseYn.Y,
      },
    })
  }

  return barcodeValue
}
