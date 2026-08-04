import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'
import '../list-page.css'

type Row = {
  id: number
  title: string
  content: string
  noticeType: string
  priority: string
  startDate: string
  endDate: string
  isPopup: 'Y' | 'N'
  useYn: 'Y' | 'N'
}

type FormState = {
  title: string
  content: string
  noticeType: string
  priority: string
  startDate: string
  endDate: string
  isPopup: 'Y' | 'N'
  useYn: 'Y' | 'N'
}

const empty = (): FormState => ({
  title: '',
  content: '',
  noticeType: 'GENERAL',
  priority: 'NORMAL',
  startDate: '',
  endDate: '',
  isPopup: 'N',
  useYn: 'Y',
})

function toDateInput(v: string) {
  return String(v).slice(0, 10)
}

export function NoticesPage() {
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
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/notices')
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

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setForm(empty())
    setModalErr(null)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(empty())
    setModalErr(null)
    setModalOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({
      title: r.title,
      content: r.content,
      noticeType: r.noticeType,
      priority: r.priority,
      startDate: toDateInput(r.startDate),
      endDate: toDateInput(r.endDate),
      isPopup: r.isPopup,
      useYn: r.useYn,
    })
    setModalErr(null)
    setModalOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setModalErr(null)
    try {
      if (!form.title.trim() || !form.content.trim() || !form.startDate || !form.endDate) {
        setModalErr('제목·내용·기간은 필수입니다.')
        return
      }
      const body = {
        title: form.title.trim(),
        content: form.content.trim(),
        noticeType: form.noticeType.trim(),
        priority: form.priority.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        isPopup: form.isPopup,
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/notices', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/notices/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
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
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/notices/${id}`, { method: 'DELETE' })
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
          <h1 className="mesListTitle">공지</h1>
          <p className="mesListDesc">현장/사무 공지 게시를 관리합니다.</p>
        </div>
        <div className="mesListHeadActions">
          <span className="mesListCountBadge">{items.length}건</span>
          <button type="button" className="mesListBtn mesListBtn--secondary" onClick={() => void load()}>
            새로고침
          </button>
          <button type="button" className="mesListBtn mesListBtn--primary" onClick={openCreate}>
            새 공지
          </button>
        </div>
      </header>
      {err ? <div className="error mesBanner mesListNotice">{err}</div> : null}
      <div className="mesListTableCard">
        <div className="mesTableWrap mesListTableViewport">
          <table className="mesTable">
            <thead>
              <tr>
                <th>제목</th>
                <th>유형</th>
                <th>기간</th>
                <th>팝업</th>
                <th>사용</th>
                <th className="mesThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="muted">
                    로딩 중…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.noticeType}</td>
                    <td style={{ fontSize: 12 }}>
                      {toDateInput(r.startDate)} ~ {toDateInput(r.endDate)}
                    </td>
                    <td>{r.isPopup}</td>
                    <td>{r.useYn}</td>
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
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="notices-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="notices-modal-title">
                  {editingId == null ? '공지 등록' : `공지 수정 (ID ${editingId})`}
                </h2>
              </div>
            </div>
            <div className="mesModalBody">
              {modalErr ? <div className="error mesBanner">{modalErr}</div> : null}
              <div className="mesFieldRow">
                <label className="mesLabel mesLabel--wide">
                  제목
                  <input className="mesInput" value={form.title} onChange={(ev) => setForm((f) => ({ ...f, title: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  유형
                  <input className="mesInput" value={form.noticeType} onChange={(ev) => setForm((f) => ({ ...f, noticeType: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  우선순위
                  <input className="mesInput" value={form.priority} onChange={(ev) => setForm((f) => ({ ...f, priority: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel mesLabel--wide">
                  내용
                  <textarea className="mesInput" rows={4} value={form.content} onChange={(ev) => setForm((f) => ({ ...f, content: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  시작일
                  <input className="mesInput" type="date" value={form.startDate} onChange={(ev) => setForm((f) => ({ ...f, startDate: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  종료일
                  <input className="mesInput" type="date" value={form.endDate} onChange={(ev) => setForm((f) => ({ ...f, endDate: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  팝업
                  <select className="mesInput" value={form.isPopup} onChange={(ev) => setForm((f) => ({ ...f, isPopup: ev.target.value as 'Y' | 'N' }))}>
                    <option value="N">N</option>
                    <option value="Y">Y</option>
                  </select>
                </label>
                <label className="mesLabel">
                  사용
                  <select className="mesInput" value={form.useYn} onChange={(ev) => setForm((f) => ({ ...f, useYn: ev.target.value as 'Y' | 'N' }))}>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeModal}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                {saving ? '저장 중…' : editingId == null ? '등록' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
