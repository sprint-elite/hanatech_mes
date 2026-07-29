#!/usr/bin/env node
/**
 * 운영 데이터 초기화 + 작업자 마스터 삭제 + 사용자는 test@naver.com 만 유지
 */
import { PrismaClient } from '@prisma/client'

const opsTables = [
  'defect_history',
  'process_result',
  'lot_history',
  'lot_material_usage',
  'inventory_transaction',
  'inventory',
  'inventory_snapshot',
  'shipment_detail',
  'shipment',
  'outsourcing_result',
  'outsourcing',
  'vision_raw_log',
  'barcode',
  'production_hourly',
  'process_status',
  'production_status',
  'production_lot',
  'material_lot',
  'work_order_process_worker',
  'work_order_worker',
  'work_order_material',
  'work_order',
  'production_plan',
]

const workerTables = ['worker_process_work_time', 'worker_product_work_time', 'worker_process', 'workers']

const KEEP_LOGIN = 'test@naver.com'

const prisma = new PrismaClient()

async function main() {
  const keep = await prisma.user.findUnique({
    where: { loginId: KEEP_LOGIN },
    select: { id: true },
  })
  if (!keep) {
    throw new Error(`사용자 ${KEEP_LOGIN} 이(가) 없습니다.`)
  }

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0')

  for (const t of opsTables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``)
    console.log(`truncated ${t}`)
  }

  await prisma.$executeRawUnsafe(`UPDATE products SET created_by = ${keep.id} WHERE created_by IS NOT NULL AND created_by <> ${keep.id}`)
  await prisma.$executeRawUnsafe(`UPDATE products SET updated_by = ${keep.id} WHERE updated_by IS NOT NULL AND updated_by <> ${keep.id}`)

  const payCleanup = [
    `DELETE FROM pay_stub_line WHERE pay_stub_id IN (SELECT id FROM pay_stub WHERE run_id IN (SELECT id FROM pay_stub_run WHERE created_by_id NOT IN (SELECT id FROM users)))`,
    `DELETE FROM pay_stub WHERE run_id IN (SELECT id FROM pay_stub_run WHERE created_by_id NOT IN (SELECT id FROM users))`,
    `DELETE FROM pay_stub_run WHERE created_by_id NOT IN (SELECT id FROM users)`,
    `DELETE FROM pay_stub_line WHERE pay_stub_id IN (SELECT id FROM pay_stub WHERE user_id NOT IN (SELECT id FROM users))`,
    `DELETE FROM pay_stub WHERE user_id NOT IN (SELECT id FROM users)`,
    `DELETE FROM pay_work_record_line WHERE user_id NOT IN (SELECT id FROM users)`,
    `DELETE FROM pay_work_record WHERE user_id NOT IN (SELECT id FROM users)`,
    `DELETE FROM pay_employee_profile WHERE user_id NOT IN (SELECT id FROM users)`,
  ]
  for (const sql of payCleanup) {
    await prisma.$executeRawUnsafe(sql)
  }
  console.log('cleaned orphan payroll rows')

  await prisma.$executeRawUnsafe('UPDATE users SET worker_id = NULL')
  const deleted = await prisma.$executeRawUnsafe(`DELETE FROM users WHERE user_id <> '${KEEP_LOGIN}'`)
  console.log(`deleted other users (${deleted} rows affected)`)

  for (const t of workerTables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``)
    console.log(`truncated ${t}`)
  }

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1')
  console.log('done')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
