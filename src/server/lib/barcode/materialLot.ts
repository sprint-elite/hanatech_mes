import { BarcodeType, Prisma, UseYn } from '@prisma/client'

const MAT_LOT_REF_TABLE = 'material_lot'

/** 자재 LOT 바코드 문자열 — 스캔 값 = LOT 번호 */
export function materialLotBarcodeValue(lotNo: string): string {
  return lotNo.trim()
}

type Tx = Prisma.TransactionClient

/** material_lot.barcode + barcode 마스터(MATERIAL_LOT) 동기화 */
export async function syncMaterialLotBarcode(
  tx: Tx,
  lotId: number,
  lotNo: string,
): Promise<string> {
  const barcodeValue = materialLotBarcodeValue(lotNo)

  await tx.materialLot.update({
    where: { id: lotId },
    data: { barcode: barcodeValue },
  })

  const existing = await tx.barcode.findFirst({
    where: { refTable: MAT_LOT_REF_TABLE, refId: lotId, barcodeType: BarcodeType.MATERIAL_LOT },
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
        barcodeType: BarcodeType.MATERIAL_LOT,
        refTable: MAT_LOT_REF_TABLE,
        refId: lotId,
        isPrimary: UseYn.Y,
      },
    })
  }

  return barcodeValue
}
