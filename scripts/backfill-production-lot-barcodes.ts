import { prisma } from '../src/server/db/prisma'
import { syncProductionLotBarcode } from '../src/server/lib/barcode/productionLot'

async function main() {
  const lots = await prisma.productionLot.findMany({
    where: { OR: [{ barcode: null }, { barcode: '' }] },
    select: { id: true, lotNo: true },
    orderBy: { id: 'asc' },
  })

  let ok = 0
  for (const lot of lots) {
    await prisma.$transaction(async (tx) => {
      await syncProductionLotBarcode(tx, lot.id, lot.lotNo)
    })
    ok += 1
    console.log(`LOT #${lot.id} ${lot.lotNo}`)
  }

  console.log(`Done: ${ok} production lot(s) backfilled`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
