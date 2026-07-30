import { prisma } from '../src/server/db/prisma'

/** LOT 미연결(구 date-key) 작업시간 상세 제거 후 합계 재계산 */
async function main() {
  const orphans = await prisma.workerProcessWorkTimeEntry.findMany({
    where: { productionLotId: null },
    select: { id: true, workerId: true, processId: true },
  })
  if (orphans.length === 0) {
    console.log('No orphan work time entries.')
    return
  }

  await prisma.workerProcessWorkTimeEntry.deleteMany({ where: { productionLotId: null } })
  console.log(`Deleted ${orphans.length} orphan entry(ies) without production LOT`)

  const touched = new Map<string, { workerId: number; processId: number }>()
  for (const o of orphans) {
    touched.set(`${o.workerId}:${o.processId}`, o)
  }

  for (const { workerId, processId } of touched.values()) {
    const sum = await prisma.workerProcessWorkTimeEntry.aggregate({
      where: { workerId, processId },
      _sum: { workMinutes: true },
    })
    const total = sum._sum.workMinutes ?? 0
    await prisma.workerProcessWorkTime.upsert({
      where: { workerId_processId: { workerId, processId } },
      create: { workerId, processId, workMinutes: total },
      update: { workMinutes: total },
    })

    const proc = await prisma.mbomProcess.findUnique({
      where: { id: processId },
      select: { productId: true },
    })
    if (proc) {
      const siblings = await prisma.workerProcessWorkTime.findMany({
        where: { workerId, process: { productId: proc.productId } },
        select: { workMinutes: true },
      })
      const productTotal = siblings.reduce((s, r) => s + r.workMinutes, 0)
      await prisma.workerProductWorkTime.upsert({
        where: { workerId_productId: { workerId, productId: proc.productId } },
        create: { workerId, productId: proc.productId, workMinutes: productTotal },
        update: { workMinutes: productTotal },
      })
    }
  }

  console.log('Recalculated work minute totals for affected worker/process rows')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
