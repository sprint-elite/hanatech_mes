import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type RoleRow = { id: number; roleName: string }
type UserRow = {
  id: number
  loginId: string
  userName: string
  roleId: number
  workerId: number | null
  email: string | null
  phone: string | null
  status: string
  lastLoginAt: string | null
  createdAt: string
  role?: { roleName: string }
}

type FormState = { loginId: string; userName: string; password: string; roleId: string; workerId: string; status: string }

const empty = (): FormState => ({ loginId: '', userName: '', password: '', roleId: '', workerId: '', status: 'ACTIVE' })

export function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, r] = await Promise.all([
        apiJson<{ ok: boolean; items: UserRow[] }>('/api/users'),
        apiJson<{ ok: boolean; items: RoleRow[] }>('/api/roles'),
      ])
      setItems(u.items)
      setRoles(r.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const roleId = Number(form.roleId)
      if (!Number.isFinite(roleId) || roleId <= 0) {
        setErr('역할을 선택하세요.')
        setSaving(false)
        return
      }
      const workerId = form.workerId.trim() === '' ? null : Number(form.workerId)
      if (form.workerId.trim() !== '' && !Number.isFinite(workerId)) {
        setErr('작업자 ID는 숫자여야 합니다.')
        setSaving(false)
        return
      }
      await apiJson('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          loginId: form.loginId.trim(),
          userName: form.userName.trim(),
          password: form.password,
          roleId,
          workerId: workerId ?? undefined,
          status: form.status,
        }),
      })
      await load()
      setForm(empty())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('사용자를 삭제할까요?')) return
    try {
      await apiJson(`/api/users/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">사용자</h1>
        <p className="mesPageDesc">로그인 계정을 등록합니다. (비밀번호는 개발용 평문 저장 — 운영 전 해시 적용)</p>
      </header>
      {err ? <div className="error mesBanner">{err}</div> : null}
      <section className="mesCard mesFormPanel">
        <div className="mesCardTitle">신규 등록</div>
        <div className="mesFieldRow">
          <label className="mesLabel">
            로그인 ID
            <input className="mesInput mono" value={form.loginId} onChange={(ev) => setForm((f) => ({ ...f, loginId: ev.target.value }))} />
          </label>
          <label className="mesLabel">
            이름
            <input className="mesInput" value={form.userName} onChange={(ev) => setForm((f) => ({ ...f, userName: ev.target.value }))} />
          </label>
        </div>
        <div className="mesFieldRow">
          <label className="mesLabel">
            비밀번호
            <input type="password" className="mesInput" value={form.password} onChange={(ev) => setForm((f) => ({ ...f, password: ev.target.value }))} />
          </label>
          <label className="mesLabel">
            역할
            <select className="mesInput" value={form.roleId} onChange={(ev) => setForm((f) => ({ ...f, roleId: ev.target.value }))}>
              <option value="">선택</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roleName}
                </option>
              ))}
            </select>
          </label>
          <label className="mesLabel">
            작업자 ID (선택)
            <input className="mesInput mono" value={form.workerId} onChange={(ev) => setForm((f) => ({ ...f, workerId: ev.target.value }))} />
          </label>
          <label className="mesLabel">
            상태
            <select className="mesInput" value={form.status} onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </label>
        </div>
        <div className="mesFormActions">
          <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
            {saving ? '저장 중…' : '등록'}
          </button>
        </div>
      </section>
      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>로그인</th>
              <th>이름</th>
              <th>역할</th>
              <th>작업자</th>
              <th>상태</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td className="mono">{r.loginId}</td>
                  <td>{r.userName}</td>
                  <td>{r.role?.roleName ?? r.roleId}</td>
                  <td>{r.workerId ?? '—'}</td>
                  <td>{r.status}</td>
                  <td className="mesTdActions">
                    <button type="button" className="mesBtnSm mesBtnDanger" onClick={() => void remove(r.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
