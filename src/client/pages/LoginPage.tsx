import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { apiJson } from '../lib/api'
import { getStoredUser, setStoredUser, type MesAuthUser } from '../lib/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const existing = getStoredUser()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (existing) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const data = await apiJson<{ ok: boolean; user: MesAuthUser; message?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ loginId, password }),
      })
      setStoredUser(data.user)
      navigate('/', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : '로그인 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mesLoginPage">
      <div className="mesLoginCard">
        <div className="mesLoginBrand">
          <div className="mesBrandTitle">HANA-TECH</div>
          <div className="mesBrandMes">MES</div>
        </div>
        <h1 className="mesLoginTitle">로그인</h1>
        <p className="mesLoginDesc muted">사용자 계정으로 로그인합니다. 활동 로그가 기록됩니다.</p>
        <form className="mesLoginForm" onSubmit={(e) => void onSubmit(e)}>
          <label className="mesLabel">
            아이디
            <input
              className="mesInput"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="mesLabel">
            비밀번호
            <input
              type="password"
              className="mesInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {err ? <p className="mesLoginError">{err}</p> : null}
          <button type="submit" className="mesBtnPrimary mesLoginSubmit" disabled={busy}>
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <p className="mesLoginFoot muted">
          계정은 <Link to="/users">시스템 → 사용자</Link> 메뉴에서 등록할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
