import { prisma } from '../db/prisma'
import { calculatePayrollForUser } from './payrollCalc'

const stubInclude = {
  user: { select: { id: true, userName: true, worker: { select: { team: true, position: true, hireDate: true } } } },
  lines: { orderBy: [{ lineType: 'asc' as const }, { sortOrder: 'asc' as const }] },
  run: true,
} as const

function calcTotals(earnings: { amount: number }[], deductions: { amount: number }[]) {
  const totalEarning = earnings.reduce((s, l) => s + l.amount, 0)
  const totalDeduction = deductions.reduce((s, l) => s + l.amount, 0)
  return { totalEarning, totalDeduction, netPay: totalEarning - totalDeduction }
}

export async function saveStubFromCalc(
  runId: number,
  userId: number,
  calc: Awaited<ReturnType<typeof calculatePayrollForUser>>,
  existingId?: number,
) {
  const earnings = calc.earnings.filter((l) => l.amount > 0 || l.label)
  const deductions = calc.deductions.filter((l) => l.amount > 0 || l.label)
  const totals = calcTotals(earnings, deductions)
  const lineData = [
    ...earnings.map((l, i) => ({
      lineType: 'EARNING' as const,
      label: l.label,
      amount: l.amount,
      sortOrder: i,
    })),
    ...deductions.map((l, i) => ({
      lineType: 'DEDUCTION' as const,
      label: l.label,
      amount: l.amount,
      sortOrder: i,
    })),
  ]

  if (existingId) {
    return prisma.$transaction(async (tx) => {
      await tx.payStubLine.deleteMany({ where: { payStubId: existingId } })
      if (lineData.length > 0) {
        await tx.payStubLine.createMany({
          data: lineData.map((l) => ({ ...l, payStubId: existingId })),
        })
      }
      return tx.payStub.update({
        where: { id: existingId },
        data: {
          dept: calc.dept || null,
          position: calc.position || null,
          workDays: calc.workDays,
          totalEarning: totals.totalEarning,
          totalDeduction: totals.totalDeduction,
          netPay: totals.netPay,
        },
        include: stubInclude,
      })
    })
  }

  return prisma.payStub.create({
    data: {
      runId,
      userId,
      dept: calc.dept || null,
      position: calc.position || null,
      workDays: calc.workDays,
      totalEarning: totals.totalEarning,
      totalDeduction: totals.totalDeduction,
      netPay: totals.netPay,
      lines: { create: lineData },
    },
    include: stubInclude,
  })
}

/** 직원정보·근무 변경 후 작성중(DRAFT) 명세 금액 동기화 */
export async function syncDraftStubsForUser(userId: number): Promise<number> {
  const stubs = await prisma.payStub.findMany({
    where: { userId, run: { status: 'DRAFT' } },
    select: { id: true, runId: true, userId: true, run: { select: { yearMonth: true } } },
  })
  for (const stub of stubs) {
    const calc = await calculatePayrollForUser(stub.userId, stub.run.yearMonth)
    await saveStubFromCalc(stub.runId, stub.userId, calc, stub.id)
  }
  return stubs.length
}
