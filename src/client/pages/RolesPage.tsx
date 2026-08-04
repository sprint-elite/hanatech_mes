import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'
import '../list-page.css'

type Row = { id: number; roleName: string; description: string | null }
type FormState = { roleName: string; description: string }

const empty = (): FormState => ({ roleName: '', description: '' })

export function RolesPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalErr, setModalErr] = useState<string | null>(null)
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

  const openCreate = () => {
    setEditingId(null)
    setForm(empty())
    setModalErr(null)
    setModalOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({ roleName: r.roleName, description: r.description ?? '' })
    setModalErr(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setForm(empty())
    setModalErr(null)
  }

  const save = async () => {
    setSaving(true)
    setModalErr(null)
    try {
      const body = { roleName: form.roleName.trim(), description: form.description.trim() || null }
      if (!body.roleName) {
        setModalErr('역할명을 입력하세요.')
        return
      }
      if (editingId == null) {
        await apiJson('/api/roles', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/roles/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await load()
      closeModal()
    } catch (e) {
      setModalErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요? (연결된 사용자가 있으면 실패할 수 있습니다)')) return
    try {
      await apiJson(`/api/roles/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) closeModal()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage mesPageWide mesListPage">
      <header className="mesListHead">
        <div className="mesListHeadMain">
          <h1 className="mesListTitle">역할</h1>
          <p className="mesListDesc">사용자 권한 그룹(역할)을 정의합니다.</p>
        </div>
        <div className="mesListHeadActions">
          <span className="mesListCountBadge">{items.length}건</span>
          <button type="button" className="mesListBtn mesListBtn--secondary" onClick={() => void load()}>
            새로고침
          </button>
          <button type="button" className="mesListBtn mesListBtn--primary" onClick={openCreate}>
            새 역할
          </button>
        </div>
      </header>
      {err ? <div className="error mesBanner mesListNotice">{err}</div> : null}
      <div className="mesListTableCard">
        <div className="mesTableWrap mesListTableViewport">
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

      {modalOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeModal} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="roles-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="roles-modal-title">
                  {editingId == null ? '역할 등록' : `역할 수정 (ID ${editingId})`}
                </h2>
              </div>
            </div>
            <div className="mesModalBody">
              {modalErr ? <div className="error mesBanner">{modalErr}</div> : null}
              <div className="mesFieldRow">
                <label className="mesLabel">
                  역할명
                  <input className="mesInput" value={form.roleName} onChange={(ev) => setForm((f) => ({ ...f, roleName: ev.target.value }))} />
                </label>
                <label className="mesLabel mesLabel--wide">
                  설명
                  <input className="mesInput" value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} />
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeModal}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
