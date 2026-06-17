import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type Row = { id: number; roleName: string; description: string | null }
type FormState = { roleName: string; description: string }

const empty = (): FormState => ({ roleName: '', description: '' })

export function RolesPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/roles')
      setItems(data.items)
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
      const body = { roleName: form.roleName.trim(), description: form.description.trim() || null }
      if (editingId == null) {
        await apiJson('/api/roles', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/roles/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await load()
      setEditingId(null)
      setForm(empty())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요? (연결된 사용자가 있으면 실패할 수 있습니다)')) return
    try {
      await apiJson(`/api/roles/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) {
        setEditingId(null)
        setForm(empty())
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">역할</h1>
        <p className="mesPageDesc">사용자 권한 그룹(역할)을 정의합니다.</p>
      </header>
      <div className="mesToolbar">
        <button type="button" className="mesBtnPrimary" onClick={() => { setEditingId(null); setForm(empty()) }}>
          새 역할
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}
      <section className="mesCard mesFormPanel">
        <div className="mesCardTitle">{editingId == null ? '등록' : `수정 (ID ${editingId})`}</div>
        <div className="mesFieldRow">
          <label className="mesLabel">
            역할명
            <input className="mesInput" value={form.roleName} onChange={(ev) => setForm((f) => ({ ...f, roleName: ev.target.value }))} />
          </label>
          <label className="mesLabel">
            설명
            <input className="mesInput" value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} />
          </label>
        </div>
        <div className="mesFormActions">
          <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </section>
      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>역할명</th>
              <th>설명</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{r.roleName}</td>
                  <td>{r.description ?? '—'}</td>
                  <td className="mesTdActions">
                    <button
                      type="button"
                      className="mesBtnSm"
                      onClick={() => {
                        setEditingId(r.id)
                        setForm({ roleName: r.roleName, description: r.description ?? '' })
                      }}
                    >
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
  )
}
