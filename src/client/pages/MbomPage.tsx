import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type Product = { id: number; productCode: string; productName: string }
type Wc = { id: number; centerCode: string; centerName: string }

type Row = {
  id: number
  productId: number
  processCode: string
  processName: string
  sequence: number
  workCenterId: number | null
  isOutsourcing: 'Y' | 'N'
  useYn: 'Y' | 'N'
  product: { productCode: string; productName: string }
  workCenter: { centerCode: string; centerName: string } | null
}

type FormState = {
  productId: string
  processCode: string
  processName: string
  sequence: string
  workCenterId: string
  isOutsourcing: 'Y' | 'N'
  useYn: 'Y' | 'N'
}

const empty = (): FormState => ({
  productId: '',
  processCode: '',
  processName: '',
  sequence: '10',
  workCenterId: '',
  isOutsourcing: 'N',
  useYn: 'Y',
})

export function MbomPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [workCenters, setWorkCenters] = useState<Wc[]>([])
  const [items, setItems] = useState<Row[]>([])
  const [filterProductId, setFilterProductId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const loadRefs = useCallback(async () => {
    const [p, w] = await Promise.all([
      apiJson<{ items: Product[] }>('/api/products'),
      apiJson<{ items: Wc[] }>('/api/work-centers'),
    ])
    setProducts(p.items)
    setWorkCenters(w.items)
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const q = filterProductId === '' ? '' : `?productId=${encodeURIComponent(filterProductId)}`
      const data = await apiJson<{ ok: boolean; items: Row[] }>(`/api/mbom-processes${q}`)
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filterProductId])

  useEffect(() => {
    void loadRefs().catch((e) => setErr(e instanceof Error ? e.message : 'unknown error'))
  }, [loadRefs])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const save = async () => {
    const pid = Number(form.productId)
    const seq = Number(form.sequence)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    if (!Number.isInteger(seq) || seq < 1) {
      setErr('공정 순서는 1 이상 숫자여야 합니다.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const wc =
        form.workCenterId.trim() === '' ? null : Number(form.workCenterId)
      if (form.workCenterId.trim() !== '' && (!Number.isInteger(wc) || (wc as number) < 1)) {
        setErr('작업장 ID가 올바르지 않습니다.')
        setSaving(false)
        return
      }
      const body = {
        productId: pid,
        processCode: form.processCode.trim(),
        processName: form.processName.trim(),
        sequence: seq,
        workCenterId: wc,
        isOutsourcing: form.isOutsourcing,
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/mbom-processes', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/mbom-processes/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await loadRows()
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
    if (!confirm('이 공정 정의를 삭제할까요? 실적이 있으면 실패할 수 있습니다.')) return
    try {
      await apiJson(`/api/mbom-processes/${id}`, { method: 'DELETE' })
      await loadRows()
      if (editingId === id) {
        setEditingId(null)
        setForm(empty())
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(empty())
  }

  const openNew = () => {
    setEditingId(null)
    setForm({
      ...empty(),
      productId: filterProductId || '',
    })
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({
      productId: String(r.productId),
      processCode: r.processCode,
      processName: r.processName,
      sequence: String(r.sequence),
      workCenterId: r.workCenterId != null ? String(r.workCenterId) : '',
      isOutsourcing: r.isOutsourcing,
      useYn: r.useYn,
    })
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">MBOM 공정</h1>
        <p className="mesPageDesc">품목별 공정 순서·작업장·외주 여부를 정의합니다.</p>
      </header>

      <div className="mesToolbar mesToolbarWrap">
        <label className="mesLabel mesLabelInline">
          품목 필터
          <select
            className="mesInput mesInputShort"
            value={filterProductId}
            onChange={(ev) => setFilterProductId(ev.target.value)}
          >
            <option value="">전체</option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.productCode} — {p.productName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}
      <section className="mesPanelCard" style={{ marginTop: 8 }}>
        <div className="mesPanelHead">
          <div className="mesPanelTitle">{editingId == null ? 'MBOM 공정 등록' : `MBOM 공정 수정 (ID ${editingId})`}</div>
          <div className="mesModalHeadActions">
            <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
              {saving ? '저장 중…' : editingId == null ? '공정 추가' : '공정 수정'}
            </button>
            <button type="button" className="mesBtnSecondary" onClick={resetForm}>
              입력 초기화
            </button>
          </div>
        </div>
        <div className="mesModalBody">
          <div className="mesFieldRow">
            <label className="mesLabel">
              품목
              <select
                className="mesInput"
                value={form.productId}
                onChange={(ev) => setForm((f) => ({ ...f, productId: ev.target.value }))}
              >
                <option value="">선택</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.productCode} — {p.productName}
                  </option>
                ))}
              </select>
            </label>
            <label className="mesLabel">
              순서
              <input
                className="mesInput"
                value={form.sequence}
                onChange={(ev) => setForm((f) => ({ ...f, sequence: ev.target.value }))}
              />
            </label>
          </div>
          <div className="mesFieldRow">
            <label className="mesLabel">
              공정코드
              <input
                className="mesInput"
                value={form.processCode}
                onChange={(ev) => setForm((f) => ({ ...f, processCode: ev.target.value }))}
              />
            </label>
            <label className="mesLabel">
              공정명
              <input
                className="mesInput"
                value={form.processName}
                onChange={(ev) => setForm((f) => ({ ...f, processName: ev.target.value }))}
              />
            </label>
          </div>
          <div className="mesFieldRow mesFieldRow3">
            <label className="mesLabel">
              작업장
              <select
                className="mesInput"
                value={form.workCenterId}
                onChange={(ev) => setForm((f) => ({ ...f, workCenterId: ev.target.value }))}
              >
                <option value="">없음</option>
                {workCenters.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.centerCode} — {w.centerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="mesLabel">
              외주
              <select
                className="mesInput"
                value={form.isOutsourcing}
                onChange={(ev) => setForm((f) => ({ ...f, isOutsourcing: ev.target.value as 'Y' | 'N' }))}
              >
                <option value="N">N</option>
                <option value="Y">Y</option>
              </select>
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
        </div>
      </section>

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>품목</th>
              <th>순서</th>
              <th>공정</th>
              <th>작업장</th>
              <th>외주</th>
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
                  <td>
                    <span className="mono">{r.product.productCode}</span>
                    <div className="muted small">{r.product.productName}</div>
                  </td>
                  <td>{r.sequence}</td>
                  <td>
                    <span className="mono">{r.processCode}</span>
                    <div className="muted small">{r.processName}</div>
                  </td>
                  <td>
                    {r.workCenter
                      ? `${r.workCenter.centerCode} · ${r.workCenter.centerName}`
                      : '—'}
                  </td>
                  <td>{r.isOutsourcing}</td>
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
