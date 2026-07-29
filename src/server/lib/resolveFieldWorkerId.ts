import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

async function loginWorkerCandidates(
  tx: Tx,
  loginId: string | null,
  woId: number | null,
): Promise<number[]> {
  if (!loginId?.trim()) return []
  const login = loginId.trim()
  const candidates: number[] = []

  const user = await tx.user.findUnique({
    where: { loginId: login },
    select: { workerId: true, userName: true },
  })

  if (user?.workerId != null && user.workerId > 0) {
    candidates.push(user.workerId)
  }

  const byCode = await tx.worker.findUnique({
    where: { workerCode: login },
    select: { id: true },
  })
  if (byCode) candidates.push(byCode.id)

  if (user?.userName?.trim()) {
    const name = user.userName.trim()
    if (woId != null) {
      const rows = await tx.workOrderProcessWorker.findMany({
        where: { woId },
        select: { workerId: true, worker: { select: { workerName: true } } },
      })
      for (const row of rows) {
        if (row.worker.workerName === name) candidates.push(row.workerId)
      }
    } else {
      const byName = await tx.worker.findFirst({
        where: { workerName: name },
        select: { id: true },
      })
      if (byName) candidates.push(byName.id)
    }
  }

  return [...new Set(candidates.filter((id) => id > 0))]
}

/** 현장 실적용 작업자 ID — 로그인·작업지시 배정 우선 */
export async function resolveFieldWorkerId(
  tx: Tx,
  opts: {
    woId: number | null
    bodyWorkerId: number | undefined
    loginId: string | null
  },
): Promise<number | null> {
  let assignedSet = new Set<number>()
  if (opts.woId != null) {
    const assigned = await tx.workOrderProcessWorker.findMany({
      where: { woId: opts.woId },
      select: { workerId: true },
    })
    assignedSet = new Set(assigned.map((a) => a.workerId))
  }

  const loginCandidates = await loginWorkerCandidates(tx, opts.loginId, opts.woId)
  for (const id of loginCandidates) {
    if (assignedSet.size === 0 || assignedSet.has(id)) return id
  }

  if (opts.bodyWorkerId != null && opts.bodyWorkerId > 0) {
    if (assignedSet.size === 0 || assignedSet.has(opts.bodyWorkerId)) {
      return opts.bodyWorkerId
    }
  }

  return null
}
