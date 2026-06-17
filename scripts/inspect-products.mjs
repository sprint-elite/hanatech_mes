import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [db] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS db')
  console.log('DATABASE():', db?.db ?? db)

  const cols = await prisma.$queryRawUnsafe('SHOW COLUMNS FROM products')
  const names = cols.map((c) => c.Field)
  console.log('products columns:', names)

  const want = [
    'id',
    'product_code',
    'product_name',
    'item_type',
    'category_id',
    'unit',
    'standard_pack_qty',
    'unit_weight',
    'unit_volume',
    'lead_time',
    'safety_stock',
    'barcode',
    'spec_json',
    'status',
    'created_at',
    'updated_at',
  ]
  const missing = want.filter((x) => !names.includes(x))
  console.log('missing expected columns:', missing)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

