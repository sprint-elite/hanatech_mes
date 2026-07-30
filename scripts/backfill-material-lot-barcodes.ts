import { prisma } from '../src/server/db/prisma'
import { syncMaterialLotBarcode } from '../src/server/lib/barcode/materialLot'

async function main() {
  const lots = await prisma.materialLot.findMany({
    where: { OR: [{ barcode: null }, { barcode: '' }] },
    select: { id: true, lotNo: true },
    orderBy: { id: 'asc' },
  })

  let ok = 0
  for (const lot of lots) {
    await prisma.$transaction(async (tx) => {
      await syncMaterialLotBarcode(tx, lot.id, lot.lotNo)
    })
    ok += 1
    console.log(`Material LOT #${lot.id} ${lot.lotNo}`)
  }

  console.log(`Done: ${ok} material lot(s) backfilled`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
