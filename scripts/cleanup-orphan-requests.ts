import { prisma } from '../src/server/db/prisma'

async function main() {
  const orphanExpenseIds = await prisma.$queryRaw<{ id: number }[]>`
    SELECT er.id FROM expense_report er
    LEFT JOIN users u ON u.id = er.user_id WHERE u.id IS NULL
  `
  const orphanLeaveIds = await prisma.$queryRaw<{ id: number }[]>`
    SELECT al.id FROM annual_leave_request al
    LEFT JOIN users u ON u.id = al.user_id WHERE u.id IS NULL
  `

  if (orphanExpenseIds.length > 0) {
    const ids = orphanExpenseIds.map((r) => r.id)
    await prisma.expenseReportLine.deleteMany({ where: { expenseReportId: { in: ids } } })
    const deleted = await prisma.expenseReport.deleteMany({ where: { id: { in: ids } } })
    console.log('deleted orphan expense reports:', deleted.count)
  }

  if (orphanLeaveIds.length > 0) {
    const ids = orphanLeaveIds.map((r) => r.id)
    const deleted = await prisma.annualLeaveRequest.deleteMany({ where: { id: { in: ids } } })
    console.log('deleted orphan annual leave requests:', deleted.count)
  }

  if (orphanExpenseIds.length === 0 && orphanLeaveIds.length === 0) {
    console.log('no orphan records')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
