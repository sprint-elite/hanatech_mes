import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../db/prisma'
import { prismaFail } from '../lib/prismaError'
import { USE_SE } from '../lib/smartFactoryLog/constants'
import { enqueueSmartFactoryLog } from '../lib/smartFactoryLog/sender'

export const authRouter = Router()

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim().slice(0, 30)
  }
  return (req.ip ?? '0.0.0.0').slice(0, 30)
}

function checkDevPassword(stored: string, input: string): boolean {
  if (stored.startsWith('[dev-plain]')) {
    return stored === `[dev-plain]${input}`
  }
  return stored === input
}

const loginSchema = z.object({
  loginId: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
})

authRouter.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: '아이디와 비밀번호를 입력하세요.' })
  }

  const { loginId, password } = parsed.data
  const ip = clientIp(req)

  try {
    const user = await prisma.user.findUnique({
      where: { loginId },
      select: {
        id: true,
        loginId: true,
        userName: true,
        passwordHash: true,
        roleId: true,
        workerId: true,
        status: true,
        role: { select: { roleName: true } },
      },
    })

    if (!user || !checkDevPassword(user.passwordHash, password)) {
      return res.status(401).json({ ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ ok: false, message: '사용할 수 없는 계정입니다.' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await enqueueSmartFactoryLog({
      useSe: USE_SE.LOGIN,
      sysUser: user.loginId,
      conectIp: ip,
      dataUsgqty: 0,
      httpMethod: 'POST',
      apiPath: '/auth/login',
    })

    return res.json({
      ok: true,
      user: {
        id: user.id,
        loginId: user.loginId,
        userName: user.userName,
        roleId: user.roleId,
        workerId: user.workerId,
        roleName: user.role.roleName,
      },
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})

const logoutSchema = z.object({
  loginId: z.string().trim().min(1).max(64).optional(),
})

authRouter.post('/auth/logout', async (req, res) => {
  const parsed = logoutSchema.safeParse(req.body ?? {})
  const headerUser = typeof req.headers['x-sys-user'] === 'string' ? req.headers['x-sys-user'].trim() : ''
  const loginId = parsed.success && parsed.data.loginId ? parsed.data.loginId : headerUser

  if (!loginId) {
    return res.status(400).json({ ok: false, message: '로그아웃할 사용자 정보가 없습니다.' })
  }

  const ip = clientIp(req)

  try {
    await enqueueSmartFactoryLog({
      useSe: USE_SE.LOGOUT,
      sysUser: loginId.slice(0, 60),
      conectIp: ip,
      dataUsgqty: 0,
      httpMethod: 'POST',
      apiPath: '/auth/logout',
    })

    return res.json({ ok: true })
  } catch (e) {
    return prismaFail(res, e)
  }
})

authRouter.get('/auth/session', async (req, res) => {
  const loginId = typeof req.headers['x-sys-user'] === 'string' ? req.headers['x-sys-user'].trim() : ''
  if (!loginId) {
    return res.json({ ok: true, user: null })
  }

  try {
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

    if (!user || user.status !== 'ACTIVE') {
      return res.json({ ok: true, user: null })
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        loginId: user.loginId,
        userName: user.userName,
        roleId: user.roleId,
        workerId: user.workerId,
        roleName: user.role.roleName,
      },
    })
  } catch (e) {
    return prismaFail(res, e)
  }
})
