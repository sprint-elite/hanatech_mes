import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type ProductRef = { id: number; productCode: string; productName: string }

type Row = {
  id: number
  productId: number
  defectCode: string
  defectName: string
  defectCategory: string | null
  severity: string | null
  useYn: 'Y' | 'N'
  product?: ProductRef
}

type FormState = {
  productId: string
  defectCode: string
  defectName: string
  defectCategory: string
  severity: string
  useYn: 'Y' | 'N'
}

const empty = (): FormState => ({
  productId: '',
  defectCode: '',
  defectName: '',
  defectCategory: '',
  severity: '',
  useYn: 'Y',
})

const productLabel = (p?: ProductRef) => (p ? `${p.productCode} · ${p.productName}` : '—')

export function DefectTypesPage() {
  const [items, setItems] = useState<Row[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const loadRefs = useCallback(async () => {
    try {
      const data = await apiJson<{ ok: boolean; items: ProductRef[] }>('/api/products')
      setProducts([...data.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko')))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/defect-types')
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
    void loadRefs()
  }, [loadRefs])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    const pid = Number(form.productId)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        productId: pid,
        defectCode: form.defectCode.trim(),
        defectName: form.defectName.trim(),
        defectCategory: form.defectCategory.trim() === '' ? null : form.defectCategory.trim(),
        severity: form.severity.trim() === '' ? null : form.severity.trim(),
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/defect-types', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/defect-types/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
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
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/defect-types/${id}`, { method: 'DELETE' })
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
        <h1 className="mesPageTitle">불량 유형</h1>
        <p className="mesPageDesc">품목별 불량 코드·등급을 정의합니다.</p>
      </header>

      <div className="mesToolbar">
        <button
          type="button"
          className="mesBtnPrimary"
          onClick={() => {
            setEditingId(null)
            setForm(empty())
          }}
        >
          새 유형
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

      <section className="mesCard mesFormPanel">
        <div className="mesCardTitle">{editingId == null ? '등록' : `수정 (ID ${editingId})`}</div>
        <div className="mesFieldRow mesFieldRow3">
          <label className="mesLabel">
            품목
            <select
              className="mesInput"
              value={form.productId}
              onChange={(ev) => setForm((f) => ({ ...f, productId: ev.target.value }))}
            >
              <option value="">선택…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productCode} · {p.productName}
                </option>
              ))}
            </select>
          </label>
          <label className="mesLabel">
            코드
            <input
              className="mesInput"
              value={form.defectCode}
              onChange={(ev) => setForm((f) => ({ ...f, defectCode: ev.target.value }))}
            />
          </label>
          <label className="mesLabel">
            명칭
            <input
              className="mesInput"
              value={form.defectName}
              onChange={(ev) => setForm((f) => ({ ...f, defectName: ev.target.value }))}
            />
          </label>
        </div>
        <div className="mesFieldRow mesFieldRow3">
          <label className="mesLabel">
            카테고리
            <input
              className="mesInput"
              value={form.defectCategory}
              onChange={(ev) => setForm((f) => ({ ...f, defectCategory: ev.target.value }))}
            />
          </label>
          <label className="mesLabel">
            심각도 (LOW/MID/HIGH)
            <input
              className="mesInput"
              value={form.severity}
              onChange={(ev) => setForm((f) => ({ ...f, severity: ev.target.value }))}
            />
          </label>
          <label className="mesLabel">
            사용
            <select
              className="mesInput"
              value={form.useYn}
              onChange={(ev) => setForm((f) => ({ ...f, useYn: ev.target.value as 'Y' | 'N' }))}
            >
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
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
              <th>품목</th>
              <th>코드</th>
              <th>명칭</th>
              <th>카테고리</th>
              <th>심각도</th>
              <th>사용</th>
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
                  <td>{productLabel(r.product)}</td>
                  <td className="mono">{r.defectCode}</td>
                  <td>{r.defectName}</td>
                  <td>{r.defectCategory ?? '—'}</td>
                  <td>{r.severity ?? '—'}</td>
                  <td>{r.useYn}</td>
                  <td className="mesTdActions">
                    <button
                      type="button"
                      className="mesBtnSm"
                      onClick={() => {
                        setEditingId(r.id)
                        setForm({
                          productId: String(r.productId),
                          defectCode: r.defectCode,
                          defectName: r.defectName,
                          defectCategory: r.defectCategory ?? '',
                          severity: r.severity ?? '',
                          useYn: r.useYn,
                        })
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
