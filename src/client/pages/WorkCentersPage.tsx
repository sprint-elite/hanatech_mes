import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type Row = {
  id: number
  centerCode: string
  centerName: string
  centerType: string
  parentId: number | null
  location: string | null
  capacityPerHour: number | null
  useYn: 'Y' | 'N'
  createdAt: string
  parent?: { id: number; centerCode: string; centerName: string } | null
}

type FormState = {
  centerCode: string
  centerName: string
  centerType: 'LINE' | 'EQUIPMENT' | 'OUTSOURCE'
  parentId: string
  location: string
  capacityPerHour: string
  useYn: 'Y' | 'N'
}

const empty = (): FormState => ({
  centerCode: '',
  centerName: '',
  centerType: 'LINE',
  parentId: '',
  location: '',
  capacityPerHour: '',
  useYn: 'Y',
})

export function WorkCentersPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/work-centers')
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
      const parentId = form.parentId.trim() === '' ? null : Number(form.parentId.trim())
      if (form.parentId.trim() !== '' && (!Number.isFinite(parentId) || (parentId as number) < 1)) {
        setErr('상위 작업장 ID는 빈 값 또는 1 이상의 숫자여야 합니다.')
        setSaving(false)
        return
      }
      const cap = form.capacityPerHour.trim() === '' ? null : Number(form.capacityPerHour.trim())
      if (form.capacityPerHour.trim() !== '' && (!Number.isFinite(cap) || (cap as number) < 0)) {
        setErr('시간당 생산능력은 빈 값 또는 0 이상의 숫자여야 합니다.')
        setSaving(false)
        return
      }
      const body = {
        centerCode: form.centerCode.trim(),
        centerName: form.centerName.trim(),
        centerType: form.centerType.trim(),
        parentId: parentId ?? undefined,
        location: form.location.trim() === '' ? null : form.location.trim(),
        capacityPerHour: cap ?? undefined,
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/work-centers', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/work-centers/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await load()
      setEditingId(null)
      setForm(empty())
      setPanelOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/work-centers/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) {
        setEditingId(null)
        setForm(empty())
        setPanelOpen(false)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">작업장</h1>
        <p className="mesPageDesc">라인·설비·외주 단위 작업장 코드를 관리합니다.</p>
      </header>

      <div className="mesToolbar">
        <button
          type="button"
          className="mesBtnPrimary"
          onClick={() => {
            setEditingId(null)
            setForm(empty())
            setPanelOpen(true)
          }}
        >
          새 작업장
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>코드</th>
              <th>명칭</th>
              <th>유형</th>
              <th>상위</th>
              <th>위치</th>
              <th>시간당 생산능력</th>
              <th>사용</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td className="mono">{r.centerCode}</td>
                  <td>{r.centerName}</td>
                  <td>{r.centerType}</td>
                  <td>{r.parent ? `${r.parent.centerCode} · ${r.parent.centerName}` : r.parentId ?? '—'}</td>
                  <td>{r.location ?? '—'}</td>
                  <td className="mono">{r.capacityPerHour ?? '—'}</td>
                  <td>{r.useYn}</td>
                  <td className="mesTdActions">
                    <button
                      type="button"
                      className="mesBtnSm"
                      onClick={() => {
                        setEditingId(r.id)
                        setForm({
                          centerCode: r.centerCode,
                          centerName: r.centerName,
                          centerType: (r.centerType as FormState['centerType']) ?? 'LINE',
                          parentId: r.parentId != null ? String(r.parentId) : '',
                          location: r.location ?? '',
                          capacityPerHour: r.capacityPerHour != null ? String(r.capacityPerHour) : '',
                          useYn: r.useYn,
                        })
                        setPanelOpen(true)
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

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button
            type="button"
            className="mesModalBackdrop"
            aria-label="닫기"
            onClick={() => {
              setEditingId(null)
              setForm(empty())
              setPanelOpen(false)
            }}
          />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-workcenter-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-workcenter-modal-title">
                  {editingId == null ? '작업장 등록' : `작업장 수정 (ID ${editingId})`}
                </h2>
              </div>
              <div className="mesModalHeadActions">
                <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button
                  type="button"
                  className="mesBtnSecondary"
                  onClick={() => {
                    setEditingId(null)
                    setForm(empty())
                    setPanelOpen(false)
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="mesBtnGhost"
                  onClick={() => {
                    setEditingId(null)
                    setForm(empty())
                    setPanelOpen(false)
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  코드 (center_code)
                  <input className="mesInput" value={form.centerCode} onChange={(ev) => setForm((f) => ({ ...f, centerCode: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  명칭 (center_name)
                  <input className="mesInput" value={form.centerName} onChange={(ev) => setForm((f) => ({ ...f, centerName: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  유형 (center_type)
                  <select
                    className="mesInput"
                    value={form.centerType}
                    onChange={(ev) => setForm((f) => ({ ...f, centerType: ev.target.value as FormState['centerType'] }))}
                  >
                    <option value="LINE">LINE</option>
                    <option value="EQUIPMENT">EQUIPMENT</option>
                    <option value="OUTSOURCE">OUTSOURCE</option>
                  </select>
                </label>
                <label className="mesLabel">
                  상위 작업장 ID (parent_id)
                  <input className="mesInput mono" value={form.parentId} onChange={(ev) => setForm((f) => ({ ...f, parentId: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  위치 (location)
                  <input className="mesInput" value={form.location} onChange={(ev) => setForm((f) => ({ ...f, location: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  시간당 생산능력 (capacity_per_hour)
                  <input
                    className="mesInput mono"
                    value={form.capacityPerHour}
                    onChange={(ev) => setForm((f) => ({ ...f, capacityPerHour: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  사용 (use_yn)
                  <select className="mesInput" value={form.useYn} onChange={(ev) => setForm((f) => ({ ...f, useYn: ev.target.value as 'Y' | 'N' }))}>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
