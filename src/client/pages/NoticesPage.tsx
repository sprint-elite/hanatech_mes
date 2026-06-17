import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

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

export function NoticesPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [noticeType, setNoticeType] = useState('GENERAL')
  const [priority, setPriority] = useState('NORMAL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isPopup, setIsPopup] = useState<'Y' | 'N'>('N')
  const [useYn, setUseYn] = useState<'Y' | 'N'>('Y')
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

  const add = async () => {
    setSaving(true)
    setErr(null)
    try {
      if (!title.trim() || !content.trim() || !startDate || !endDate) {
        setErr('제목·내용·기간은 필수입니다.')
        setSaving(false)
        return
      }
      await apiJson('/api/notices', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          noticeType: noticeType.trim(),
          priority: priority.trim(),
          startDate,
          endDate,
          isPopup,
          useYn,
        }),
      })
      await load()
      setTitle('')
      setContent('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/notices/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">공지</h1>
        <p className="mesPageDesc">현장/사무 공지 게시를 관리합니다.</p>
      </header>
      {err ? <div className="error mesBanner">{err}</div> : null}
      <section className="mesCard mesFormPanel">
        <div className="mesCardTitle">등록</div>
        <div className="mesFieldRow">
          <label className="mesLabel">
            제목
            <input className="mesInput" value={title} onChange={(ev) => setTitle(ev.target.value)} />
          </label>
          <label className="mesLabel">
            유형
            <input className="mesInput" value={noticeType} onChange={(ev) => setNoticeType(ev.target.value)} />
          </label>
          <label className="mesLabel">
            우선순위
            <input className="mesInput" value={priority} onChange={(ev) => setPriority(ev.target.value)} />
          </label>
        </div>
        <div className="mesFieldRow">
          <label className="mesLabel" style={{ flex: 1 }}>
            내용
            <textarea className="mesInput" rows={3} value={content} onChange={(ev) => setContent(ev.target.value)} />
          </label>
        </div>
        <div className="mesFieldRow">
          <label className="mesLabel">
            시작일
            <input className="mesInput" type="date" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} />
          </label>
          <label className="mesLabel">
            종료일
            <input className="mesInput" type="date" value={endDate} onChange={(ev) => setEndDate(ev.target.value)} />
          </label>
          <label className="mesLabel">
            팝업
            <select className="mesInput" value={isPopup} onChange={(ev) => setIsPopup(ev.target.value as 'Y' | 'N')}>
              <option value="N">N</option>
              <option value="Y">Y</option>
            </select>
          </label>
          <label className="mesLabel">
            사용
            <select className="mesInput" value={useYn} onChange={(ev) => setUseYn(ev.target.value as 'Y' | 'N')}>
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
          </label>
        </div>
        <div className="mesFormActions">
          <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void add()}>
            {saving ? '저장 중…' : '등록'}
          </button>
        </div>
      </section>
      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>제목</th>
              <th>유형</th>
              <th>기간</th>
              <th>팝업</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.noticeType}</td>
                  <td style={{ fontSize: 12 }}>
                    {String(r.startDate).slice(0, 10)} ~ {String(r.endDate).slice(0, 10)}
                  </td>
                  <td>{r.isPopup}</td>
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
