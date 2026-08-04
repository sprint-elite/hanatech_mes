import { BarcodeType, Prisma, UseYn } from '@prisma/client'

const PRODUCT_REF_TABLE = 'product'

/** 품목 바코드 문자열 — 스캔 값 = 품목코드(또는 지정 바코드) */
export function productBarcodeValue(code: string): string {
  return code.trim()
}

type Tx = Prisma.TransactionClient

/** products.barcode + barcode 마스터(PRODUCT) 동기화 */
export async function syncProductBarcode(
  tx: Tx,
  productId: number,
  barcodeText: string,
): Promise<string> {
  const barcodeValue = productBarcodeValue(barcodeText)

  await tx.product.update({
    where: { id: productId },
    data: { barcode: barcodeValue },
  })

  const existing = await tx.barcode.findFirst({
    where: { refTable: PRODUCT_REF_TABLE, refId: productId, barcodeType: BarcodeType.PRODUCT },
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
        barcodeType: BarcodeType.PRODUCT,
        refTable: PRODUCT_REF_TABLE,
        refId: productId,
        isPrimary: UseYn.Y,
      },
    })
  }

  return barcodeValue
}
