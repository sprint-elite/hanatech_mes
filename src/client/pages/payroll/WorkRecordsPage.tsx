import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser } from '../../lib/auth'
import {
  currentYearMonth,
  emptyWorkForm,
  fmtYearMonth,
  workFormFromRow,
  type WorkRecordForm,
  type WorkRecordRow,
} from './payEmployeeTypes'
import '../../payroll-page.css'

export function WorkRecordsPage() {
  const [user] = useState(() => getStoredUser())
  const [yearMonth, setYearMonth] = useState(currentYearMonth)
  const [items, setItems] = useState<WorkRecordRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<WorkRecordRow | null>(null)
  const [form, setForm] = useState<WorkRecordForm>(emptyWorkForm())

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiJson<{ ok: boolean; items: WorkRecordRow[]; canManage: boolean; yearMonth: string }>(
        `/api/payroll/work-records?yearMonth=${encodeURIComponent(yearMonth)}`,
      )
      setItems(res.items)
      setCanManage(res.canManage)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, yearMonth])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const initMonth = async () => {
    if (!window.confirm(`${fmtYearMonth(yearMonth)} 급여대상 직원 근무표를 생성하시겠습니까?`)) return
    setSaving(true)
    setErr(null)
    try {
      await apiJson('/api/payroll/work-records/init', {
        method: 'POST',
        body: JSON.stringify({ yearMonth }),
      })
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (row: WorkRecordRow) => {
    setEditRow(row)
    setForm(workFormFromRow(row))
    setModalOpen(true)
  }

  const saveWork = async () => {
    if (!editRow) return
    setSaving(true)
    setErr(null)
    try {
      const body = {
        workDays: form.workDays ? Number(form.workDays) : 0,
        paidLeaveDays: form.paidLeaveDays ? Number(form.paidLeaveDays) : 0,
        unpaidLeaveDays: form.unpaidLeaveDays ? Number(form.unpaidLeaveDays) : 0,
        regularHours: form.regularHours ? Number(form.regularHours) : 0,
        overtimeHours: form.overtimeHours ? Number(form.overtimeHours) : 0,
        nightHours: form.nightHours ? Number(form.nightHours) : 0,
        holidayHours: form.holidayHours ? Number(form.holidayHours) : 0,
        annualLeaveDays: form.annualLeaveDays ? Number(form.annualLeaveDays) : 0,
        remark: form.remark.trim() || null,
      }
      await apiJson(`/api/payroll/work-records/${editRow.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      setModalOpen(false)
      setEditRow(null)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const deleteWork = async (row: WorkRecordRow) => {
    if (!window.confirm(`${row.userName} ${fmtYearMonth(row.yearMonth)} 근무 기록을 삭제하시겠습니까?`)) return
    setSaving(true)
    try {
      await apiJson(`/api/payroll/work-records/${row.id}`, { method: 'DELETE' })
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
          <p>근무입력은 로그인 후 이용할 수 있습니다.</p>
          <Link to="/login">로그인</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPayPage">
      <header className="mesPayTopBar">
        <div>
          <h1 className="mesPayTopTitle">근무입력</h1>
          <p className="mesPayTopSub">월별 근무일수·연장·야간·휴일·연차 등을 입력합니다. (급여 계산용)</p>
        </div>
      </header>

      {err ? <div className="mesPayError" role="alert">{err}</div> : null}

      <div className="mesPayToolbar">
        <div className="mesPayToolbarLeft">
          <label className="mesPayMonthPick">
            <span>급여월</span>
            <input
              type="month"
              className="mesPayMonthInput"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
          </label>
          {canManage ? (
            <button type="button" className="mesPayBtn mesPayBtn--green" onClick={() => void initMonth()} disabled={saving}>
              + 직원 불러오기
            </button>
          ) : null}
        </div>
        <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={() => void loadAll()} disabled={loading}>
          새로고침
        </button>
      </div>

      <div className="mesPayTableCard">
        {loading ? <p className="mesPayEmpty">불러오는 중…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="mesPayEmpty">
            {fmtYearMonth(yearMonth)} 근무 데이터가 없습니다.
            {canManage ? ' 「직원 불러오기」로 급여대상 직원을 생성하세요.' : ''}
          </p>
        ) : null}
        {items.length > 0 ? (
          <div className="mesPayTableWrap">
            <table className="mesPayTable mesPayTable--work">
              <thead>
                <tr>
                  <th>성명</th>
                  <th>부서</th>
                  <th>근무일</th>
                  <th>유급휴</th>
                  <th>무급휴</th>
                  <th>정규(h)</th>
                  <th>연장(h)</th>
                  <th>야간(h)</th>
                  <th>휴일(h)</th>
                  <th>연차(일)</th>
                  <th>비고</th>
                  {canManage ? <th aria-label="작업" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.userName}</td>
                    <td>{row.dept || '—'}</td>
                    <td className="mesPayNum">{row.workDays || ''}</td>
                    <td className="mesPayNum">{row.paidLeaveDays || ''}</td>
                    <td className="mesPayNum">{row.unpaidLeaveDays || ''}</td>
                    <td className="mesPayNum">{row.regularHours || ''}</td>
                    <td className="mesPayNum">{row.overtimeHours || ''}</td>
                    <td className="mesPayNum">{row.nightHours || ''}</td>
                    <td className="mesPayNum">{row.holidayHours || ''}</td>
                    <td className="mesPayNum">{row.annualLeaveDays || ''}</td>
                    <td className="mesPayFormula">{row.remark ?? ''}</td>
                    {canManage ? (
                      <td className="mesPayRowActions">
                        <button type="button" className="mesPayLinkBtn" onClick={() => openEdit(row)}>입력</button>
                        <button type="button" className="mesPayLinkBtn mesPayLinkBtn--danger" onClick={() => void deleteWork(row)}>삭제</button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {modalOpen && editRow ? (
        <div className="mesPayModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setModalOpen(false)} />
          <div className="mesPayModal mesPayModal--wide" role="dialog" aria-modal="true">
            <header className="mesPayModalHead">
              <h2>{editRow.userName} — {fmtYearMonth(editRow.yearMonth)} 근무입력</h2>
              <button type="button" className="mesPayModalClose" onClick={() => setModalOpen(false)}>×</button>
            </header>
            <div className="mesPayModalBody">
              <div className="mesPayFormGrid mesPayFormGrid--3">
                <label className="mesPayFormRow">
                  <span>근무일수</span>
                  <input type="number" step="0.5" min={0} max={31} className="mesPayInput" value={form.workDays} onChange={(e) => setForm((f) => ({ ...f, workDays: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>유급휴일</span>
                  <input type="number" step="0.5" min={0} max={31} className="mesPayInput" value={form.paidLeaveDays} onChange={(e) => setForm((f) => ({ ...f, paidLeaveDays: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>무급휴일</span>
                  <input type="number" step="0.5" min={0} max={31} className="mesPayInput" value={form.unpaidLeaveDays} onChange={(e) => setForm((f) => ({ ...f, unpaidLeaveDays: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>정규근무(h)</span>
                  <input type="number" step="0.5" min={0} className="mesPayInput" value={form.regularHours} onChange={(e) => setForm((f) => ({ ...f, regularHours: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>연장근무(h)</span>
                  <input type="number" step="0.5" min={0} className="mesPayInput" value={form.overtimeHours} onChange={(e) => setForm((f) => ({ ...f, overtimeHours: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>야간근무(h)</span>
                  <input type="number" step="0.5" min={0} className="mesPayInput" value={form.nightHours} onChange={(e) => setForm((f) => ({ ...f, nightHours: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>휴일근무(h)</span>
                  <input type="number" step="0.5" min={0} className="mesPayInput" value={form.holidayHours} onChange={(e) => setForm((f) => ({ ...f, holidayHours: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>연차사용(일)</span>
                  <input type="number" step="0.5" min={0} max={31} className="mesPayInput" value={form.annualLeaveDays} onChange={(e) => setForm((f) => ({ ...f, annualLeaveDays: e.target.value }))} />
                </label>
              </div>
              <label className="mesPayFormRow mesPayFormRow--full">
                <span>비고</span>
                <textarea className="mesPayTextarea" rows={2} value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} />
              </label>
            </div>
            <footer className="mesPayModalFoot">
              <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={() => setModalOpen(false)} disabled={saving}>취소</button>
              <button type="button" className="mesPayBtn mesPayBtn--green" onClick={() => void saveWork()} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
