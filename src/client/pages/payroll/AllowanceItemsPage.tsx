import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser } from '../../lib/auth'
import {
  PAYMENT_TYPE_LABEL,
  STATUS_LABEL,
  TAX_EXEMPT_OPTIONS,
  allowanceFormFromRow,
  emptyAllowanceForm,
  type AllowanceFormDraft,
  type AllowanceItemRow,
} from './payItemTypes'
import '../../payroll-page.css'

export function AllowanceItemsPage() {
  const [user] = useState(() => getStoredUser())
  const [items, setItems] = useState<AllowanceItemRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<AllowanceFormDraft>(emptyAllowanceForm)

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiJson<{ ok: boolean; items: AllowanceItemRow[]; canManage: boolean }>(
        `/api/payroll/allowance-items${includeInactive ? '?includeInactive=1' : ''}`,
      )
      setItems(res.items)
      setCanManage(res.canManage)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, includeInactive])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const openCreate = () => {
    setEditId(null)
    setForm(emptyAllowanceForm())
    setModalOpen(true)
  }

  const openEdit = (row: AllowanceItemRow) => {
    setEditId(row.id)
    setForm(allowanceFormFromRow(row))
    setModalOpen(true)
  }

  const saveItem = async () => {
    if (!form.itemCode.trim() || !form.itemName.trim()) {
      setErr('항목코드와 항목명을 입력하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        itemCode: form.itemCode.trim(),
        itemName: form.itemName.trim(),
        displayOrder: form.displayOrder ? Number(form.displayOrder) : 0,
        multiplier: form.multiplier ? Number(form.multiplier) : null,
        taxExemptType: form.taxExemptType.trim() || null,
        paymentType: form.paymentType,
        calcFormula: form.calcFormula.trim() || null,
        calcDescription: form.calcDescription.trim() || null,
        status: form.status,
      }
      if (editId) {
        await apiJson(`/api/payroll/allowance-items/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiJson('/api/payroll/allowance-items', { method: 'POST', body: JSON.stringify(body) })
      }
      setModalOpen(false)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (row: AllowanceItemRow) => {
    if (!canManage) return
    setSaving(true)
    try {
      await apiJson(`/api/payroll/allowance-items/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
      })
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (row: AllowanceItemRow) => {
    if (!window.confirm(`"${row.itemName}" 수당항목을 삭제하시겠습니까?`)) return
    setSaving(true)
    try {
      await apiJson(`/api/payroll/allowance-items/${row.id}`, { method: 'DELETE' })
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="mesPayPage">
        <div className="mesPayLoginNotice">
          <p>수당항목은 로그인 후 이용할 수 있습니다.</p>
          <Link to="/login">로그인</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPayPage">
      <header className="mesPayTopBar">
        <div>
          <h1 className="mesPayTopTitle">수당항목</h1>
          <p className="mesPayTopSub">급여 지급 항목(기본급·수당 등)을 등록·관리합니다.</p>
        </div>
      </header>

      {err ? <div className="mesPayError" role="alert">{err}</div> : null}

      <div className="mesPayToolbar">
        <div className="mesPayToolbarLeft">
          {canManage ? (
            <button type="button" className="mesPayBtn mesPayBtn--green" onClick={openCreate} disabled={saving}>
              + 항목 등록
            </button>
          ) : null}
          <label className="mesPayCheckLabel">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            사용중단 포함
          </label>
        </div>
        <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={() => void loadAll()} disabled={loading}>
          새로고침
        </button>
      </div>

      <div className="mesPayTableCard">
        {loading ? <p className="mesPayEmpty">불러오는 중…</p> : null}
        {!loading && items.length === 0 ? <p className="mesPayEmpty">등록된 수당항목이 없습니다.</p> : null}
        {items.length > 0 ? (
          <div className="mesPayTableWrap">
            <table className="mesPayTable">
              <thead>
                <tr>
                  <th>코드</th>
                  <th>수당항목명</th>
                  <th>표시순서</th>
                  <th>배율</th>
                  <th>비과세유형</th>
                  <th>지급유형</th>
                  <th>계산식</th>
                  <th>산출방법</th>
                  <th>상태</th>
                  {canManage ? <th aria-label="작업" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={row.status === 'INACTIVE' ? 'mesPayRow--inactive' : undefined}>
                    <td className="mono">{row.itemCode}</td>
                    <td>{row.itemName}</td>
                    <td className="mesPayNum">{row.displayOrder}</td>
                    <td className="mesPayNum">{row.multiplier ?? ''}</td>
                    <td>{row.taxExemptType ?? ''}</td>
                    <td>{PAYMENT_TYPE_LABEL[row.paymentType]}</td>
                    <td className="mesPayFormula">{row.calcFormula ?? ''}</td>
                    <td className="mesPayFormula">{row.calcDescription ?? ''}</td>
                    <td>
                      <span className={`mesPayStatus mesPayStatus--${row.status.toLowerCase()}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="mesPayRowActions">
                        <button type="button" className="mesPayLinkBtn" onClick={() => openEdit(row)}>수정</button>
                        <button type="button" className="mesPayLinkBtn" onClick={() => void toggleStatus(row)}>
                          {row.status === 'ACTIVE' ? '중단' : '재사용'}
                        </button>
                        <button type="button" className="mesPayLinkBtn mesPayLinkBtn--danger" onClick={() => void deleteItem(row)}>삭제</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="mesPayModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setModalOpen(false)} />
          <div className="mesPayModal" role="dialog" aria-modal="true">
            <header className="mesPayModalHead">
              <h2>{editId ? '수당항목 수정' : '수당항목 등록'}</h2>
              <button type="button" className="mesPayModalClose" onClick={() => setModalOpen(false)}>×</button>
            </header>
            <div className="mesPayModalBody">
              <div className="mesPayFormGrid">
                <label className="mesPayFormRow">
                  <span>항목코드 *</span>
                  <input className="mesPayInput" value={form.itemCode} onChange={(e) => setForm((f) => ({ ...f, itemCode: e.target.value }))} placeholder="01" />
                </label>
                <label className="mesPayFormRow">
                  <span>수당항목명 *</span>
                  <input className="mesPayInput" value={form.itemName} onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))} placeholder="기본급" />
                </label>
                <label className="mesPayFormRow">
                  <span>표시순서</span>
                  <input className="mesPayInput" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>배율</span>
                  <input className="mesPayInput" type="number" step="0.0001" min={0} value={form.multiplier} onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>비과세유형</span>
                  <select className="mesPayInput" value={form.taxExemptType} onChange={(e) => setForm((f) => ({ ...f, taxExemptType: e.target.value }))}>
                    {TAX_EXEMPT_OPTIONS.map((o) => (
                      <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="mesPayFormRow">
                  <span>지급유형</span>
                  <select className="mesPayInput" value={form.paymentType} onChange={(e) => setForm((f) => ({ ...f, paymentType: e.target.value as AllowanceFormDraft['paymentType'] }))}>
                    {Object.entries(PAYMENT_TYPE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mesPayFormRow mesPayFormRow--full">
                <span>계산식</span>
                <input className="mesPayInput" value={form.calcFormula} onChange={(e) => setForm((f) => ({ ...f, calcFormula: e.target.value }))} placeholder="R(기본급(급여지급사항), 0)" />
              </label>
              <label className="mesPayFormRow mesPayFormRow--full">
                <span>산출방법</span>
                <textarea className="mesPayTextarea" rows={2} value={form.calcDescription} onChange={(e) => setForm((f) => ({ ...f, calcDescription: e.target.value }))} placeholder="통상임금 * 야간근로시간수 * 1.5" />
              </label>
              <label className="mesPayFormRow">
                <span>상태</span>
                <select className="mesPayInput" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AllowanceFormDraft['status'] }))}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <footer className="mesPayModalFoot">
              <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={() => setModalOpen(false)} disabled={saving}>취소</button>
              <button type="button" className="mesPayBtn mesPayBtn--green" onClick={() => void saveItem()} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
