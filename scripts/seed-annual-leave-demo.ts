/**
 * 연차관리 데모 계정 시드
 * 실행: npx tsx scripts/seed-annual-leave-demo.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const YEAR = new Date().getFullYear()
const DEV_PW = (p: string) => `[dev-plain]${p}`

async function upsertRole(name: string, description: string) {
  const existing = await prisma.role.findFirst({ where: { roleName: name } })
  if (existing) return existing
  return prisma.role.create({ data: { roleName: name, description } })
}

async function upsertWorker(code: string, name: string, team: string, position: string) {
  return prisma.worker.upsert({
    where: { workerCode: code },
    create: { workerCode: code, workerName: name, team, position, status: 'ACTIVE' },
    update: { workerName: name, team, position, status: 'ACTIVE' },
  })
}

async function upsertUser(
  loginId: string,
  userName: string,
  password: string,
  roleId: number,
  workerId: number,
) {
  return prisma.user.upsert({
    where: { loginId },
    create: {
      loginId,
      userName,
      passwordHash: DEV_PW(password),
      roleId,
      workerId,
      status: 'ACTIVE',
    },
    update: {
      userName,
      passwordHash: DEV_PW(password),
      roleId,
      workerId,
      status: 'ACTIVE',
    },
  })
}

async function main() {
  const roleStaff = await upsertRole('직원', '연차 신청 및 조회')
  const roleManager = await upsertRole('실장', '연차 승인·반려 (실장)')
  const roleCeo = await upsertRole('대표', '연차 승인·반려 (대표)')

  const wStaff = await upsertWorker('LV-STAFF', '김직원', '생산팀', '주입')
  const wManager = await upsertWorker('LV-MGR', '박실장', '생산팀', '실장')
  const wCeo = await upsertWorker('LV-CEO', '이대표', '경영', '대표')

  const uStaff = await upsertUser('leave.staff@demo.com', '김직원', 'staff1234', roleStaff.id, wStaff.id)
  const uManager = await upsertUser('leave.manager@demo.com', '박실장', 'mgr1234', roleManager.id, wManager.id)
  const uCeo = await upsertUser('leave.ceo@demo.com', '이대표', 'ceo1234', roleCeo.id, wCeo.id)

  for (const uid of [uStaff.id, uManager.id, uCeo.id]) {
    await prisma.annualLeaveBalance.upsert({
      where: { userId_year: { userId: uid, year: YEAR } },
      create: { userId: uid, year: YEAR, totalDays: 15, usedDays: 0 },
      update: { totalDays: 15 },
    })
  }

  console.log('연차관리 데모 계정 준비 완료')
  console.log('')
  console.log('| 역할 | 로그인 ID | 비밀번호 |')
  console.log('|------|-----------|----------|')
  console.log('| 직원 | leave.staff@demo.com | staff1234 |')
  console.log('| 실장 | leave.manager@demo.com | mgr1234 |')
  console.log('| 대표 | leave.ceo@demo.com | ceo1234 |')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
