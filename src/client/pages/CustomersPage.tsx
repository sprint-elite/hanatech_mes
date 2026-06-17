import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type CustomerType = 'CUSTOMER' | 'SUPPLIER' | 'OUTSOURCING'

type Row = {
  id: number
  customerCode: string
  customerName: string
  type: CustomerType
  useYn: 'Y' | 'N'
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  remark: string | null
  createdAt: string
}

type FormState = {
  customerCode: string
  customerName: string
  type: CustomerType
  useYn: 'Y' | 'N'
  contactName: string
  phone: string
  email: string
  address: string
  remark: string
}

const empty = (): FormState => ({
  customerCode: '',
  customerName: '',
  type: 'CUSTOMER',
  useYn: 'Y',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  remark: '',
})

function typeLabel(t: CustomerType) {
  switch (t) {
    case 'CUSTOMER':
      return '고객사(발주처)'
    case 'SUPPLIER':
      return '공급업체(구매처)'
    case 'OUTSOURCING':
      return '외주업체'
    default:
      return t
  }
}

export function CustomersPage() {
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
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/customers')
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

  const reset = () => {
    setEditingId(null)
    setForm(empty())
    setPanelOpen(false)
  }

  const openNew = () => {
    setEditingId(null)
    setForm(empty())
    setPanelOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const body = {
        customerCode: form.customerCode.trim(),
        customerName: form.customerName.trim(),
        type: form.type,
        useYn: form.useYn,
        contactName: form.contactName.trim() === '' ? null : form.contactName.trim(),
        phone: form.phone.trim() === '' ? null : form.phone.trim(),
        email: form.email.trim() === '' ? null : form.email.trim(),
        address: form.address.trim() === '' ? null : form.address.trim(),
        remark: form.remark.trim() === '' ? null : form.remark.trim(),
      }
      if (!body.customerCode || !body.customerName) {
        setErr('코드/명칭은 필수입니다.')
        setSaving(false)
        return
      }
      if (editingId == null) {
        await apiJson('/api/customers', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/customers/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await load()
      reset()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요? 품목의 기본업체로 연결된 경우 삭제가 실패할 수 있습니다.')) return
    setErr(null)
    try {
      await apiJson(`/api/customers/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) reset()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">고객/업체</h1>
        <p className="mesPageDesc">고객사(발주처)·공급업체(구매처)·외주업체 기준정보를 통합 관리합니다.</p>
      </header>

      <div className="mesToolbar">
        <button type="button" className="mesBtnPrimary" onClick={openNew}>
          새로 등록
        </button>
        <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
          새로고침
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
              <th>구분</th>
              <th>담당자</th>
              <th>전화</th>
              <th>사용</th>
              <th className="mesThActions">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td className="mono">{r.customerCode}</td>
                  <td>{r.customerName}</td>
                  <td>{typeLabel(r.type)}</td>
                  <td>{r.contactName ?? '—'}</td>
                  <td className="mono">{r.phone ?? '—'}</td>
                  <td>{r.useYn}</td>
                  <td className="mesTdActions">
                    <button
                      type="button"
                      className="mesBtnSm"
                      onClick={() => {
                        setEditingId(r.id)
                        setForm({
                          customerCode: r.customerCode,
                          customerName: r.customerName,
                          type: r.type,
                          useYn: r.useYn,
                          contactName: r.contactName ?? '',
                          phone: r.phone ?? '',
                          email: r.email ?? '',
                          address: r.address ?? '',
                          remark: r.remark ?? '',
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
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={reset} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-customer-modal-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-customer-modal-title">
                  {editingId == null ? '고객/업체 등록' : `고객/업체 수정 (ID ${editingId})`}
                </h2>
              </div>
              <div className="mesModalHeadActions">
                <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void save()}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button type="button" className="mesBtnSecondary" onClick={reset}>
                  취소
                </button>
                <button type="button" className="mesBtnGhost" onClick={reset}>
                  닫기
                </button>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  코드
                  <input
                    className="mesInput mono"
                    value={form.customerCode}
                    onChange={(ev) => setForm((f) => ({ ...f, customerCode: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  명칭
                  <input
                    className="mesInput"
                    value={form.customerName}
                    onChange={(ev) => setForm((f) => ({ ...f, customerName: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  구분
                  <select className="mesInput" value={form.type} onChange={(ev) => setForm((f) => ({ ...f, type: ev.target.value as CustomerType }))}>
                    <option value="CUSTOMER">고객사(발주처)</option>
                    <option value="SUPPLIER">공급업체(구매처)</option>
                    <option value="OUTSOURCING">외주업체</option>
                  </select>
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  담당자
                  <input className="mesInput" value={form.contactName} onChange={(ev) => setForm((f) => ({ ...f, contactName: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  전화
                  <input className="mesInput" value={form.phone} onChange={(ev) => setForm((f) => ({ ...f, phone: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  이메일
                  <input className="mesInput" value={form.email} onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))} />
                </label>
              </div>
              <div className="mesFieldRow">
                <label className="mesLabel">
                  주소
                  <input className="mesInput" value={form.address} onChange={(ev) => setForm((f) => ({ ...f, address: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  사용
                  <select className="mesInput" value={form.useYn} onChange={(ev) => setForm((f) => ({ ...f, useYn: ev.target.value as 'Y' | 'N' }))}>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </label>
              </div>
              <label className="mesLabel">
                비고
                <input className="mesInput" value={form.remark} onChange={(ev) => setForm((f) => ({ ...f, remark: ev.target.value }))} />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

