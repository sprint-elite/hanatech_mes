import type { NextFunction, Request, Response } from 'express'

import { resolveUseSe } from '../lib/smartFactoryLog/constants'
import { estimateByteSize } from '../lib/smartFactoryLog/format'
import { enqueueSmartFactoryLog } from '../lib/smartFactoryLog/sender'

function resolveClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim()
  }
  return req.ip || req.socket.remoteAddress || '0.0.0.0'
}

function resolveSysUser(req: Request): string {
  const header = req.headers['x-sys-user']
  if (typeof header === 'string' && header.trim()) return header.trim()
  const defaultUser = process.env.SMART_FACTORY_DEFAULT_SYS_USER?.trim()
  if (defaultUser) return defaultUser
  return 'SYSTEM'
}

/** /api 하위 요청마다 스마트공장 로그 outbox 적재 */
export function smartFactoryLogMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.SMART_FACTORY_LOG_ENABLED !== 'true') {
    next()
    return
  }

  const apiPath = req.originalUrl.split('?')[0] ?? req.path
  if (!apiPath.startsWith('/api')) {
    next()
    return
  }

  const useSe = resolveUseSe(req.method, apiPath)
  if (!useSe) {
    next()
    return
  }

  const sysUser = resolveSysUser(req)
  const conectIp = resolveClientIp(req)
  const reqBodySize = estimateByteSize(req.body)

  res.on('finish', () => {
    if (res.statusCode >= 500) return

    void enqueueSmartFactoryLog({
      useSe,
      sysUser,
      conectIp,
      dataUsgqty: reqBodySize,
      httpMethod: req.method,
      apiPath,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[smart-factory-log] enqueue error', e)
    })
  })

  next()
}
