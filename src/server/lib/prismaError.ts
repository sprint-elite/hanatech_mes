import type { Response } from 'express'
import { Prisma } from '@prisma/client'

export const DB_AUTH_MESSAGE =
  'MySQL 로그인에 실패했습니다. 프로젝트 루트 `.env`의 DATABASE_URL(사용자·비밀번호·호스트·DB명)을 실제 MySQL에 맞게 고친 뒤 `npm run dev`로 API를 다시 띄우세요.'

export function prismaFail(res: Response, e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2003') {
      return res.status(409).json({
        ok: false,
        error: 'FK_CONSTRAINT',
        message: '다른 데이터가 참조 중이라 삭제할 수 없습니다.',
      })
    }
    if (e.code === 'P2002') {
      return res.status(409).json({
        ok: false,
        error: 'DUPLICATE',
        message: '이미 같은 코드(또는 유니크 값)가 존재합니다.',
      })
    }
  }

  const message = e instanceof Error ? e.message : String(e)
  if (
    message.includes('Authentication failed against database server') ||
    message.includes('Access denied for user') ||
    /\(P1000\)/i.test(message)
  ) {
    return res.status(503).json({ ok: false, error: 'DB_AUTH_FAILED', message: DB_AUTH_MESSAGE })
  }
  if (message.includes('Unknown database') || /\(P1003\)/i.test(message)) {
    return res.status(503).json({
      ok: false,
      error: 'DB_NOT_FOUND',
      message:
        'DATABASE_URL에 적은 데이터베이스가 MySQL에 없습니다. DB를 만든 뒤 `npx prisma migrate dev` 또는 `npx prisma db push`로 스키마를 반영하세요.',
    })
  }
  return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message })
}
