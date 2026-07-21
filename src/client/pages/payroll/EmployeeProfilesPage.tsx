import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser } from '../../lib/auth'
import {
  EMPLOYEE_STATUS_LABEL,
  employeeFormFromRow,
  emptyEmployeeForm,
  fmtWon,
  type EmployeeProfileForm,
  type EmployeeProfileRow,
  type UserOption,
} from './payEmployeeTypes'
import '../../payroll-page.css'

export function EmployeeProfilesPage() {
  const [user] = useState(() => getStoredUser())
  const [items, setItems] = useState<EmployeeProfileRow[]>([])
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [canManage, setCanManage] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<EmployeeProfileForm>(emptyEmployeeForm())

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiJson<{ ok: boolean; items: EmployeeProfileRow[]; canManage: boolean }>(
        `/api/payroll/employee-profiles${includeInactive ? '?includeInactive=1' : ''}`,
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

  const loadUserOptions = useCallback(async () => {
    if (!user || !canManage) return
    try {
      const res = await apiJson<{ ok: boolean; items: UserOption[] }>('/api/payroll/employee-profiles/user-options')
      setUserOptions(res.items)
    } catch {
      setUserOptions([])
    }
  }, [user, canManage])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    void loadUserOptions()
  }, [loadUserOptions])

  const onUserPick = (userId: number) => {
    const u = userOptions.find((x) => x.id === userId)
    setForm((f) => ({
      ...f,
      userId,
      employeeNo: u?.workerCode ?? '',
      dept: u?.dept ?? '',
      position: u?.position ?? '',
      hireDate: u?.hireDate ?? '',
      accountHolder: u?.userName ?? '',
    }))
  }

  const openCreate = () => {
    setEditId(null)
    setForm(emptyEmployeeForm())
    void loadUserOptions()
    setModalOpen(true)
  }

  const openEdit = (row: EmployeeProfileRow) => {
    setEditId(row.id)
    setForm(employeeFormFromRow(row))
    setModalOpen(true)
  }

  const saveProfile = async () => {
    if (!editId && !form.userId) {
      setErr('직원을 선택하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        userId: form.userId,
        employeeNo: form.employeeNo.trim() || null,
        dept: form.dept.trim() || null,
        position: form.position.trim() || null,
        hireDate: form.hireDate.trim() || null,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
        hourlyWage: form.hourlyWage ? Number(form.hourlyWage) : null,
        ordinaryWage: form.ordinaryWage ? Number(form.ordinaryWage) : null,
        pensionBaseSalary: form.pensionBaseSalary ? Number(form.pensionBaseSalary) : null,
        paymentDay: form.paymentDay ? Number(form.paymentDay) : null,
        bankName: form.bankName.trim() || null,
        bankAccount: form.bankAccount.trim() || null,
        accountHolder: form.accountHolder.trim() || null,
        dependants: form.dependants ? Number(form.dependants) : 1,
        children8to20: form.children8to20 ? Number(form.children8to20) : 0,
        withholdingRatePct: form.withholdingRatePct ? Number(form.withholdingRatePct) as 80 | 100 | 120 : 100,
        status: form.status,
        remark: form.remark.trim() || null,
      }
      if (editId) {
        const { userId: _u, ...patch } = body
        await apiJson(`/api/payroll/employee-profiles/${editId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      } else {
        await apiJson('/api/payroll/employee-profiles', { method: 'POST', body: JSON.stringify(body) })
      }
      setModalOpen(false)
      await loadAll()
      await loadUserOptions()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (row: EmployeeProfileRow) => {
    if (!canManage) return
    setSaving(true)
    try {
      await apiJson(`/api/payroll/employee-profiles/${row.id}`, {
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

  const deleteProfile = async (row: EmployeeProfileRow) => {
    if (!window.confirm(`"${row.userName}" 급여 직원정보를 삭제하시겠습니까?`)) return
    setSaving(true)
    try {
      await apiJson(`/api/payroll/employee-profiles/${row.id}`, { method: 'DELETE' })
      await loadAll()
      await loadUserOptions()
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
          <p>급여 직원정보는 로그인 후 이용할 수 있습니다.</p>
          <Link to="/login">로그인</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPayPage">
      <header className="mesPayTopBar">
        <div>
          <h1 className="mesPayTopTitle">급여 직원정보</h1>
          <p className="mesPayTopSub">급여 계산에 필요한 기본급·통상임금·입사일·계좌 등을 등록합니다.</p>
        </div>
      </header>

      {err ? <div className="mesPayError" role="alert">{err}</div> : null}

      <div className="mesPayToolbar">
        <div className="mesPayToolbarLeft">
          {canManage ? (
            <button type="button" className="mesPayBtn mesPayBtn--green" onClick={openCreate} disabled={saving}>
              + 직원 등록
            </button>
          ) : null}
          <label className="mesPayCheckLabel">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            중단 포함
          </label>
        </div>
        <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={() => void loadAll()} disabled={loading}>
          새로고침
        </button>
      </div>

      <div className="mesPayTableCard">
        {loading ? <p className="mesPayEmpty">불러오는 중…</p> : null}
        {!loading && items.length === 0 ? <p className="mesPayEmpty">등록된 급여 직원이 없습니다.</p> : null}
        {items.length > 0 ? (
          <div className="mesPayTableWrap">
            <table className="mesPayTable">
              <thead>
                <tr>
                  <th>사번</th>
                  <th>성명</th>
                  <th>부서</th>
                  <th>직위</th>
                  <th>입사일</th>
                  <th>기본급</th>
                  <th>통상임금</th>
                  <th>시급</th>
                  <th>지급일</th>
                  <th>가족</th>
                  <th>자녀</th>
                  <th>원천%</th>
                  <th>상태</th>
                  {canManage ? <th aria-label="작업" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={row.status === 'INACTIVE' ? 'mesPayRow--inactive' : undefined}>
                    <td className="mono">{row.employeeNo ?? '—'}</td>
                    <td>{row.userName}</td>
                    <td>{row.dept || '—'}</td>
                    <td>{row.position || '—'}</td>
                    <td>{row.hireDate ?? '—'}</td>
                    <td className="mesPayNum">{fmtWon(row.baseSalary)}</td>
                    <td className="mesPayNum">{row.ordinaryWage != null ? fmtWon(row.ordinaryWage) : '—'}</td>
                    <td className="mesPayNum">{row.hourlyWage != null ? fmtWon(row.hourlyWage) : '—'}</td>
                    <td className="mesPayNum">{row.paymentDay != null ? `${row.paymentDay}일` : '—'}</td>
                    <td className="mesPayNum">{row.dependants}</td>
                    <td className="mesPayNum">{row.children8to20}</td>
                    <td className="mesPayNum">{row.withholdingRatePct}%</td>
                    <td>
                      <span className={`mesPayStatus mesPayStatus--${row.status.toLowerCase()}`}>
                        {EMPLOYEE_STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="mesPayRowActions">
                        <button type="button" className="mesPayLinkBtn" onClick={() => openEdit(row)}>수정</button>
                        <button type="button" className="mesPayLinkBtn" onClick={() => void toggleStatus(row)}>
                          {row.status === 'ACTIVE' ? '중단' : '재사용'}
                        </button>
                        <button type="button" className="mesPayLinkBtn mesPayLinkBtn--danger" onClick={() => void deleteProfile(row)}>삭제</button>
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
          <div className="mesPayModal mesPayModal--wide" role="dialog" aria-modal="true">
            <header className="mesPayModalHead">
              <h2>{editId ? '급여 직원정보 수정' : '급여 직원 등록'}</h2>
              <button type="button" className="mesPayModalClose" onClick={() => setModalOpen(false)}>×</button>
            </header>
            <div className="mesPayModalBody">
              {!editId ? (
                <label className="mesPayFormRow mesPayFormRow--full">
                  <span>직원 선택 *</span>
                  <select
                    className="mesPayInput"
                    value={form.userId ?? ''}
                    onChange={(e) => onUserPick(Number(e.target.value))}
                  >
                    <option value="">선택</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>{u.userName} · {u.loginId}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="mesPayFormGrid mesPayFormGrid--3">
                <label className="mesPayFormRow">
                  <span>사번</span>
                  <input className="mesPayInput" value={form.employeeNo} onChange={(e) => setForm((f) => ({ ...f, employeeNo: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>부서</span>
                  <input className="mesPayInput" value={form.dept} onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>직위</span>
                  <input className="mesPayInput" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>입사일</span>
                  <input type="date" className="mesPayInput" value={form.hireDate} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>기본급</span>
                  <input type="number" min={0} className="mesPayInput" value={form.baseSalary} onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>통상임금</span>
                  <input type="number" min={0} className="mesPayInput" value={form.ordinaryWage} onChange={(e) => setForm((f) => ({ ...f, ordinaryWage: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>국민연금 기준소득월액</span>
                  <input
                    type="number"
                    min={0}
                    className="mesPayInput"
                    value={form.pensionBaseSalary}
                    onChange={(e) => setForm((f) => ({ ...f, pensionBaseSalary: e.target.value }))}
                    placeholder="4대보험 신고액 (미입력 시 과세급여)"
                    title="국민연금공단에 신고된 기준소득월액. 건강·고용보험과 다를 수 있습니다."
                  />
                </label>
                <label className="mesPayFormRow">
                  <span>시급</span>
                  <input type="number" min={0} className="mesPayInput" value={form.hourlyWage} onChange={(e) => setForm((f) => ({ ...f, hourlyWage: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>지급일</span>
                  <input type="number" min={1} max={31} className="mesPayInput" value={form.paymentDay} onChange={(e) => setForm((f) => ({ ...f, paymentDay: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>공제대상가족 수</span>
                  <input type="number" min={1} max={11} className="mesPayInput" value={form.dependants} onChange={(e) => setForm((f) => ({ ...f, dependants: e.target.value }))} title="본인·배우자 포함, 간이세액표 열(1~11)" />
                </label>
                <label className="mesPayFormRow">
                  <span>8~20세 자녀 수</span>
                  <input type="number" min={0} max={20} className="mesPayInput" value={form.children8to20} onChange={(e) => setForm((f) => ({ ...f, children8to20: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>원천징수 비율</span>
                  <select className="mesPayInput" value={form.withholdingRatePct} onChange={(e) => setForm((f) => ({ ...f, withholdingRatePct: e.target.value }))}>
                    <option value="80">80%</option>
                    <option value="100">100%</option>
                    <option value="120">120%</option>
                  </select>
                </label>
                <label className="mesPayFormRow">
                  <span>은행</span>
                  <input className="mesPayInput" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>계좌번호</span>
                  <input className="mesPayInput" value={form.bankAccount} onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>예금주</span>
                  <input className="mesPayInput" value={form.accountHolder} onChange={(e) => setForm((f) => ({ ...f, accountHolder: e.target.value }))} />
                </label>
                <label className="mesPayFormRow">
                  <span>상태</span>
                  <select className="mesPayInput" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EmployeeProfileForm['status'] }))}>
                    {Object.entries(EMPLOYEE_STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mesPayFormRow mesPayFormRow--full">
                <span>비고</span>
                <textarea className="mesPayTextarea" rows={2} value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} />
              </label>
            </div>
            <footer className="mesPayModalFoot">
              <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={() => setModalOpen(false)} disabled={saving}>취소</button>
              <button type="button" className="mesPayBtn mesPayBtn--green" onClick={() => void saveProfile()} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
