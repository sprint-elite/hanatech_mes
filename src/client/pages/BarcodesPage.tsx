import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'

type Row = {
  id: number
  barcodeValue: string
  barcodeType: string
  refTable: string
  refId: number
  isPrimary: string
  status: string
}

const types = ['PRODUCT', 'LOT', 'MATERIAL_LOT', 'LOCATION', 'WO'] as const
const statuses = ['ACTIVE', 'DISABLED'] as const
const yn = ['Y', 'N'] as const

export function BarcodesPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [barcodeValue, setBarcodeValue] = useState('')
  const [barcodeType, setBarcodeType] = useState<(typeof types)[number]>('PRODUCT')
  const [refTable, setRefTable] = useState('products')
  const [refId, setRefId] = useState('')
  const [isPrimary, setIsPrimary] = useState<(typeof yn)[number]>('N')
  const [status, setStatus] = useState<(typeof statuses)[number]>('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/barcodes')
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

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setEditingId(null)
    setBarcodeValue('')
    setBarcodeType('PRODUCT')
    setRefTable('products')
    setRefId('')
    setIsPrimary('N')
    setStatus('ACTIVE')
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  const openNew = () => {
    setEditingId(null)
    setBarcodeValue('')
    setBarcodeType('PRODUCT')
    setRefTable('products')
    setRefId('')
    setIsPrimary('N')
    setStatus('ACTIVE')
    setPanelOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setBarcodeValue(r.barcodeValue)
    setBarcodeType((types.includes(r.barcodeType as (typeof types)[number]) ? r.barcodeType : 'PRODUCT') as (typeof types)[number])
    setRefTable(r.refTable)
    setRefId(String(r.refId))
    setIsPrimary(r.isPrimary === 'Y' ? 'Y' : 'N')
    setStatus((statuses.includes(r.status as (typeof statuses)[number]) ? r.status : 'ACTIVE') as (typeof statuses)[number])
    setPanelOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const rid = Number(refId)
      if (!barcodeValue.trim() || !Number.isFinite(rid)) {
        setErr('바코드·참조 ID는 필수입니다.')
        setSaving(false)
        return
      }
      if (editingId == null) {
        await apiJson('/api/barcodes', {
          method: 'POST',
          body: JSON.stringify({
            barcodeValue: barcodeValue.trim(),
            barcodeType,
            refTable: refTable.trim(),
            refId: rid,
            isPrimary,
            status,
          }),
        })
      } else {
        await apiJson(`/api/barcodes/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            barcodeValue: barcodeValue.trim(),
            barcodeType,
            refTable: refTable.trim(),
            refId: rid,
            isPrimary,
            status,
          }),
        })
      }
      await load()
      closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number, ev: MouseEvent) => {
    ev.stopPropagation()
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/barcodes/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const modalTitle = editingId == null ? '신규 등록' : '수정'
  const selectedRowId = panelOpen && editingId != null ? editingId : null

  return (
    <div className="mesPage">
      <header className="mesPageHeadRow">
        <div>
          <h1 className="mesPageTitle">바코드</h1>
          <p className="mesPageDesc">엔티티(품목·LOT 등)와 연결된 바코드 레코드를 등록합니다.</p>
        </div>
      </header>
      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesCrudMain">
        <div className="mesToolbar mesToolbarCompact">
          <button type="button" className="mesBtnPrimary" onClick={openNew}>
            새 바코드
          </button>
          <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>

        <div className="mesTableViewport">
          <table className="mesTable mesTableSticky mesTableClick">
            <thead>
              <tr>
                <th>바코드</th>
                <th>유형</th>
                <th>참조</th>
                <th>대표</th>
                <th>상태</th>
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
                    데이터 없음. <strong>새 바코드</strong>로 추가하세요.
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.id}
                    className={selectedRowId === r.id ? 'mesRowSelected' : undefined}
                    onClick={() => openEdit(r)}
                  >
                    <td className="mono">{r.barcodeValue}</td>
                    <td>{r.barcodeType}</td>
                    <td className="mono">
                      {r.refTable}#{r.refId}
                    </td>
                    <td>{r.isPrimary}</td>
                    <td>{r.status}</td>
                    <td className="mesTdActions">
                      <button
                        type="button"
                        className="mesBtnSm mesBtnDanger"
                        onClick={(ev) => void remove(r.id, ev)}
                      >
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

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-bc-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-bc-modal-title">
                  {modalTitle}
                </h2>
                {editingId != null ? <div className="mesModalMeta muted">ID {editingId}</div> : null}
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  바코드 값
                  <input className="mesInput mono" value={barcodeValue} onChange={(ev) => setBarcodeValue(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  유형
                  <select
                    className="mesInput"
                    value={barcodeType}
                    onChange={(ev) => setBarcodeType(ev.target.value as (typeof types)[number])}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  주 바코드
                  <select className="mesInput" value={isPrimary} onChange={(ev) => setIsPrimary(ev.target.value as (typeof yn)[number])}>
                    {yn.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  참조 테이블
                  <input className="mesInput mono" value={refTable} onChange={(ev) => setRefTable(ev.target.value)} placeholder="예: products" />
                </label>
                <label className="mesLabel">
                  참조 ID
                  <input className="mesInput mono" value={refId} onChange={(ev) => setRefId(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={status}
                    onChange={(ev) => setStatus(ev.target.value as (typeof statuses)[number])}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closePanel}>
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
