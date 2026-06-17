import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type Row = {
  id: number
  locationCode: string
  locationName: string
  parentId: number | null
  locationType: string
  useYn: 'Y' | 'N'
  parent?: { id: number; locationCode: string; locationName: string } | null
}

type FormState = { locationCode: string; locationName: string; parentId: string; locationType: string; useYn: 'Y' | 'N' }

const empty = (): FormState => ({ locationCode: '', locationName: '', parentId: '', locationType: 'WAREHOUSE', useYn: 'Y' })

const locationTypeOptions = [
  { value: 'WAREHOUSE', label: '창고' },
  { value: 'RACK', label: '랙' },
  { value: 'ZONE', label: '구역' },
] as const

const locationTypeLabel = (value: string) => locationTypeOptions.find((x) => x.value === value)?.label ?? value

export function LocationsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/locations')
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
      const parentId = form.parentId.trim() === '' ? null : Number(form.parentId)
      if (form.parentId.trim() !== '' && !Number.isFinite(parentId)) {
        setErr('상위 ID는 숫자여야 합니다.')
        setSaving(false)
        return
      }
      const body = {
        locationCode: form.locationCode.trim(),
        locationName: form.locationName.trim(),
        parentId: parentId ?? undefined,
        locationType: form.locationType.trim(),
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/locations', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/locations/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
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
      await apiJson(`/api/locations/${id}`, { method: 'DELETE' })
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

  const closePanel = () => {
    setEditingId(null)
    setForm(empty())
    setPanelOpen(false)
  }

  const openNew = () => {
    setEditingId(null)
    setForm(empty())
    setPanelOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({
      locationCode: r.locationCode,
      locationName: r.locationName,
      parentId: r.parentId != null ? String(r.parentId) : '',
      locationType: r.locationType,
      useYn: r.useYn,
    })
    setPanelOpen(true)
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">창고·위치</h1>
        <p className="mesPageDesc">창고·랙·구역 등 재고 위치를 관리합니다.</p>
      </header>
      <div className="mesToolbar">
        <button type="button" className="mesBtnPrimary" onClick={openNew}>
          새 위치
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}
      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-location-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-location-modal-title">
                  {editingId == null ? '창고·위치 등록' : `창고·위치 수정 (ID ${editingId})`}
                </h2>
              </div>
              <div className="mesModalHeadActions">
                <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button type="button" className="mesBtnSecondary" onClick={closePanel}>
                  취소
                </button>
                <button type="button" className="mesBtnGhost" onClick={closePanel}>
                  닫기
                </button>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  위치 코드
                  <input className="mesInput mono" value={form.locationCode} onChange={(ev) => setForm((f) => ({ ...f, locationCode: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  명칭
                  <input className="mesInput" value={form.locationName} onChange={(ev) => setForm((f) => ({ ...f, locationName: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  유형
                  <select className="mesInput" value={form.locationType} onChange={(ev) => setForm((f) => ({ ...f, locationType: ev.target.value }))}>
                    {locationTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  상위 ID
                  <input className="mesInput mono" value={form.parentId} onChange={(ev) => setForm((f) => ({ ...f, parentId: ev.target.value }))} />
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
          </div>
        </div>
      ) : null}
      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>코드</th>
              <th>명칭</th>
              <th>유형</th>
              <th>상위</th>
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
                  <td className="mono">{r.locationCode}</td>
                  <td>{r.locationName}</td>
                  <td>{locationTypeLabel(r.locationType)}</td>
                  <td>{r.parent ? r.parent.locationCode : '—'}</td>
                  <td>{r.useYn}</td>
                  <td className="mesTdActions">
                    <button
                      type="button"
                      className="mesBtnSm"
                      onClick={() => openEdit(r)}
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
