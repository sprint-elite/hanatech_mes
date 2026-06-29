import type { Request } from 'express'
import { prisma } from '../db/prisma'

export type RequestUser = {
  id: number
  loginId: string
  userName: string
  roleId: number
  workerId: number | null
  roleName: string
}

export async function getRequestUser(req: Request): Promise<RequestUser | null> {
  const raw = req.headers['x-sys-user']
  const loginId = typeof raw === 'string' ? raw.trim() : ''
  if (!loginId) return null

  const user = await prisma.user.findUnique({
    where: { loginId },
    select: {
      id: true,
      loginId: true,
      userName: true,
      roleId: true,
      workerId: true,
      status: true,
      role: { select: { roleName: true } },
    },
  })

  if (!user || user.status !== 'ACTIVE') return null

  return {
    id: user.id,
    loginId: user.loginId,
    userName: user.userName,
    roleId: user.roleId,
    workerId: user.workerId,
    roleName: user.role.roleName,
  }
}

export function isStaffRole(roleName: string) {
  return roleName === '직원'
}

export function isManagerRole(roleName: string) {
  return roleName === '실장'
}

export function isCeoRole(roleName: string) {
  return roleName === '대표' || roleName === '최고관리자'
}

export function canApproveLeave(roleName: string) {
  return isManagerRole(roleName) || isCeoRole(roleName)
}

export function canViewAllLeave(roleName: string) {
  return canApproveLeave(roleName)
}

export function canManagePayStubs(roleName: string) {
  return canApproveLeave(roleName)
}
