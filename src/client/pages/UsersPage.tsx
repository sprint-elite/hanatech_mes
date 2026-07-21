import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../list-page.css'

type RoleRow = { id: number; roleName: string }
type WorkerRef = { id: number; workerCode: string; workerName: string; status: string }
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
  const [workers, setWorkers] = useState<WorkerRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, r, w] = await Promise.all([
        apiJson<{ ok: boolean; items: UserRow[] }>('/api/users'),
        apiJson<{ ok: boolean; items: RoleRow[] }>('/api/roles'),
        apiJson<{ ok: boolean; items: WorkerRef[] }>('/api/workers'),
      ])
      setItems(u.items)
      setRoles(r.items)
      setWorkers([...w.items].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko')))
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

  const workerLabel = (workerId: number | null) => {
    if (workerId == null) return '—'
    const w = workers.find((x) => x.id === workerId)
    return w ? w.workerName : String(workerId)
  }

  const workerOptions = useMemo(() => {
    const selectedId = form.workerId === '' ? null : Number(form.workerId)
    const list = workers.filter((w) => w.status === 'ACTIVE' || w.id === selectedId)
    return list
  }, [workers, form.workerId])

  const resetForm = () => {
    setEditingId(null)
    setForm(empty())
    setErr(null)
  }

  const openEdit = (r: UserRow) => {
    setEditingId(r.id)
    setForm({
      loginId: r.loginId,
      userName: r.userName,
      password: '',
      roleId: String(r.roleId),
      workerId: r.workerId == null ? '' : String(r.workerId),
      status: r.status,
    })
    setErr(null)
  }

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
      const workerId = form.workerId === '' ? null : Number(form.workerId)
      if (form.workerId !== '' && !Number.isFinite(workerId)) {
        setErr('작업자를 선택하세요.')
        setSaving(false)
        return
      }

      if (editingId == null) {
        if (form.password.length < 4) {
          setErr('비밀번호는 4자 이상이어야 합니다.')
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
            workerId,
            status: form.status,
          }),
        })
      } else {
        if (form.password !== '' && form.password.length < 4) {
          setErr('비밀번호를 바꿀 경우 4자 이상이어야 합니다.')
          setSaving(false)
          return
        }
        await apiJson(`/api/users/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            loginId: form.loginId.trim(),
            userName: form.userName.trim(),
            ...(form.password !== '' ? { password: form.password } : {}),
            roleId,
            workerId,
            status: form.status,
          }),
        })
      }
      await load()
      resetForm()
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
      if (editingId === id) resetForm()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage mesPageWide mesListPage">
      <header className="mesListHead">
        <div className="mesListHeadMain">
          <h1 className="mesListTitle">사용자</h1>
          <p className="mesListDesc">로그인 계정을 등록·수정합니다. (비밀번호는 개발용 평문 저장 — 운영 전 해시 적용)</p>
        </div>
        <div className="mesListHeadActions">
          <span className="mesListCountBadge">{items.length}건</span>
          <button type="button" className="mesListBtn mesListBtn--secondary" onClick={() => void load()}>
            새로고침
          </button>
          <button type="button" className="mesListBtn mesListBtn--primary" onClick={resetForm}>
            새 사용자
          </button>
        </div>
      </header>
      {err ? <div className="error mesBanner mesListNotice">{err}</div> : null}
      <section className="mesListFormCard">
        <div className="mesCardTitle">{editingId == null ? '신규 등록' : `수정 (ID ${editingId})`}</div>
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
            비밀번호{editingId != null ? ' (변경 시에만 입력)' : ''}
            <input
              type="password"
              className="mesInput"
              value={form.password}
              placeholder={editingId != null ? '비워두면 유지' : undefined}
              onChange={(ev) => setForm((f) => ({ ...f, password: ev.target.value }))}
            />
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
            작업자 (선택)
            <select className="mesInput" value={form.workerId} onChange={(ev) => setForm((f) => ({ ...f, workerId: ev.target.value }))}>
              <option value="">선택 안 함</option>
              {workerOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.workerName}
                </option>
              ))}
            </select>
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
            {saving ? '저장 중…' : editingId == null ? '등록' : '저장'}
          </button>
          {editingId != null ? (
            <button type="button" className="mesBtnSecondary" disabled={saving} onClick={resetForm}>
              취소
            </button>
          ) : null}
        </div>
      </section>
      <div className="mesListTableCard">
        <div className="mesTableWrap mesListTableViewport">
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
                    <td>{workerLabel(r.workerId)}</td>
                    <td>{r.status}</td>
                    <td className="mesTdActions">
                      <button type="button" className="mesBtnSm" onClick={() => openEdit(r)}>
                        수정
                      </button>
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
    </div>
  )
}
