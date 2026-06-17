import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'

type Row = {
  id: number
  processId: number
  materialProductId: number
  qty: string
  unit: string
  lossRate: string | null
  isKeyMaterial: 'Y' | 'N'
  process?: {
    id: number
    processCode: string
    processName: string
    productId: number
    sequence: number
    product?: { productCode: string; productName: string }
  }
  materialProduct?: { productCode: string; productName: string }
}

type MbomProcessRef = {
  id: number
  productId: number
  processCode: string
  processName: string
  sequence: number
  product?: { productCode: string; productName: string }
}

type ProductRef = {
  id: number
  productCode: string
  productName: string
}

type FormState = {
  processId: string
  materialProductId: string
  qty: string
  unit: string
  lossRate: string
  isKeyMaterial: 'Y' | 'N'
}

const empty = (): FormState => ({
  processId: '',
  materialProductId: '',
  qty: '1',
  unit: 'EA',
  lossRate: '',
  isKeyMaterial: 'N',
})

function processOptionLabel(p: MbomProcessRef) {
  const pc = p.product?.productCode ?? ''
  const pn = p.product?.productName ?? ''
  const prod = pc && pn ? `${pc} · ${pn}` : pc || pn || `품목#${p.productId}`
  return `${prod} / ${p.sequence}순 · ${p.processCode} — ${p.processName}`
}

export function MbomMaterialsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [processes, setProcesses] = useState<MbomProcessRef[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(empty())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [processNameFilter, setProcessNameFilter] = useState('')

  const filteredItems = useMemo(() => {
    const q = processNameFilter.trim().toLowerCase()
    if (!q) return items
    return items.filter((r) => {
      const name = r.process?.processName?.toLowerCase() ?? ''
      const code = r.process?.processCode?.toLowerCase() ?? ''
      return name.includes(q) || code.includes(q)
    })
  }, [items, processNameFilter])

  const loadRefs = useCallback(async () => {
    try {
      const [proc, prod] = await Promise.all([
        apiJson<{ ok: boolean; items: MbomProcessRef[] }>('/api/mbom-processes'),
        apiJson<{ ok: boolean; items: ProductRef[] }>('/api/products'),
      ])
      const procSorted = [...proc.items].sort((a, b) => {
        const ac = a.product?.productCode ?? ''
        const bc = b.product?.productCode ?? ''
        if (ac !== bc) return ac.localeCompare(bc, 'ko')
        if (a.sequence !== b.sequence) return a.sequence - b.sequence
        return a.id - b.id
      })
      setProcesses(procSorted)
      setProducts(
        [...prod.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko') || a.id - b.id),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/mbom-materials')
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
    setSaving(true)
    setErr(null)
    try {
      const pid = Number(form.processId)
      const mid = Number(form.materialProductId)
      if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(mid) || mid < 1) {
        setErr('투입 공정과 자재 품목을 선택하세요.')
        setSaving(false)
        return
      }
      const body = {
        processId: pid,
        materialProductId: mid,
        qty: form.qty,
        unit: form.unit.trim(),
        lossRate: form.lossRate.trim() === '' ? null : form.lossRate.trim(),
        isKeyMaterial: form.isKeyMaterial,
      }
      if (editingId == null) {
        await apiJson('/api/mbom-materials', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/mbom-materials/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
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
      await apiJson(`/api/mbom-materials/${id}`, { method: 'DELETE' })
      await load()
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
    setForm(empty())
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({
      processId: String(r.processId),
      materialProductId: String(r.materialProductId),
      qty: r.qty,
      unit: r.unit,
      lossRate: r.lossRate ?? '',
      isKeyMaterial: r.isKeyMaterial,
    })
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">MBOM 공정별 투입자재</h1>
        <p className="mesPageDesc">공정 단위로 투입되는 자재(BOM)를 정의합니다.</p>
      </header>
      <div className="mesToolbar mesToolbarWrap">
        <label className="mesLabel mesLabelInline">
          공정명 검색
          <input
            className="mesInput"
            style={{ minWidth: 220 }}
            value={processNameFilter}
            placeholder="공정명 또는 공정코드"
            onChange={(ev) => setProcessNameFilter(ev.target.value)}
          />
        </label>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}
      <section className="mesPanelCard" style={{ marginTop: 8 }}>
        <div className="mesPanelHead">
          <div className="mesPanelTitle">{editingId == null ? '투입자재 등록' : `투입자재 수정 (ID ${editingId})`}</div>
          <div className="mesModalHeadActions">
            <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
              {saving ? '저장 중…' : editingId == null ? '투입자재 추가' : '투입자재 수정'}
            </button>
            <button type="button" className="mesBtnSecondary" onClick={resetForm}>
              입력 초기화
            </button>
          </div>
        </div>
        <div className="mesModalBody">
          <div className="mesFieldRow">
            <label className="mesLabel">
              투입 공정 (MBOM)
              <select
                className="mesInput"
                value={form.processId}
                onChange={(ev) => setForm((f) => ({ ...f, processId: ev.target.value }))}
              >
                <option value="">선택</option>
                {processes.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {processOptionLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mesLabel">
              자재 품목
              <select
                className="mesInput"
                value={form.materialProductId}
                onChange={(ev) => setForm((f) => ({ ...f, materialProductId: ev.target.value }))}
              >
                <option value="">선택</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.productCode} · {p.productName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mesFieldRow">
            <label className="mesLabel">
              수량
              <input className="mesInput" value={form.qty} onChange={(ev) => setForm((f) => ({ ...f, qty: ev.target.value }))} />
            </label>
            <label className="mesLabel">
              단위
              <input className="mesInput" value={form.unit} onChange={(ev) => setForm((f) => ({ ...f, unit: ev.target.value }))} />
            </label>
          </div>
          <div className="mesFieldRow">
            <label className="mesLabel">
              손실율
              <input className="mesInput" value={form.lossRate} onChange={(ev) => setForm((f) => ({ ...f, lossRate: ev.target.value }))} />
            </label>
            <label className="mesLabel">
              주요자재
              <select
                className="mesInput"
                value={form.isKeyMaterial}
                onChange={(ev) => setForm((f) => ({ ...f, isKeyMaterial: ev.target.value as 'Y' | 'N' }))}
              >
                <option value="N">N</option>
                <option value="Y">Y</option>
              </select>
            </label>
          </div>
        </div>
      </section>
      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>공정명</th>
              <th>자재</th>
              <th>수량</th>
              <th>주요</th>
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
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  검색 조건에 맞는 행이 없습니다.
                </td>
              </tr>
            ) : (
              filteredItems.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.process ? (
                      <>
                        <div>{r.process.processName}</div>
                        <div className="muted small">
                          {r.process.sequence}순 · {r.process.processCode}
                          {r.process.product
                            ? ` · ${r.process.product.productCode} ${r.process.product.productName}`
                            : ` · 품목#${r.process.productId}`}
                        </div>
                      </>
                    ) : (
                      r.processId
                    )}
                  </td>
                  <td>
                    {r.materialProduct ? `${r.materialProduct.productCode} ${r.materialProduct.productName}` : r.materialProductId}
                  </td>
                  <td className="mono">
                    {r.qty} {r.unit}
                  </td>
                  <td>{r.isKeyMaterial}</td>
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
  )
}
