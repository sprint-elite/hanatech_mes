import { prisma } from '../src/server/db/prisma'
import { syncProductBarcode } from '../src/server/lib/barcode/product'

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, productCode: true, barcode: true },
    orderBy: { id: 'asc' },
  })

  let ok = 0
  for (const p of products) {
    const text = (p.barcode?.trim() || p.productCode).trim()
    if (!text) continue
    await prisma.$transaction(async (tx) => {
      await syncProductBarcode(tx, p.id, text)
    })
    ok += 1
    console.log(`Product #${p.id} ${p.productCode} → ${text}`)
  }

  console.log(`Done: ${ok} product(s) backfilled`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
