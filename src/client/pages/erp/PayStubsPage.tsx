import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser, type MesAuthUser } from '../../lib/auth'
import { PayStubEditModal } from './PayStubEditModal'
import { PayStubViewModal } from './PayStubViewModal'
import {
  RUN_STATUS_LABEL,
  emptyForm,
  fmtWon,
  fmtYearMonth,
  formFromRow,
  type PayStubRow,
  type PayStubRunRow,
  type UserOption,
} from './payStubTypes'
import type { PayrollLedger } from './payStubDetailTypes'
import '../../pay-stubs-page.css'

export function PayStubsPage() {
  const location = useLocation()
  const [user, setUser] = useState<MesAuthUser | null>(() => getStoredUser())
  const [runs, setRuns] = useState<PayStubRunRow[]>([])
  const [stubs, setStubs] = useState<PayStubRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewStub, setViewStub] = useState<PayStubRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const loadedRunIdRef = useRef<number | null>(null)

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null
  const now = new Date()
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    setUser(getStoredUser())
  }, [location.pathname])

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiJson<{ ok: boolean; items: UserOption[] }>('/api/pay-stubs/users-options')
      setUsers(res.items)
    } catch {
      setUsers([])
    }
  }, [])

  const loadStubsForRun = useCallback(async (runId: number) => {
    const res = await apiJson<{ ok: boolean; items: PayStubRow[]; canManage: boolean }>(
      `/api/pay-stubs/runs/${runId}/stubs`,
    )
    setStubs(res.items)
    setCanManage(res.canManage)
    loadedRunIdRef.current = runId
  }, [])

  const bootstrap = useCallback(async (preferredRunId?: number | null) => {
    if (!user) {
      setLoading(false)
      setInitialized(true)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const runsRes = await apiJson<{ ok: boolean; items: PayStubRunRow[]; canManage: boolean }>('/api/pay-stubs/runs')
      setRuns(runsRes.items)
      setCanManage(runsRes.canManage)

      const nextRunId =
        preferredRunId != null && runsRes.items.some((r) => r.id === preferredRunId)
          ? preferredRunId
          : runsRes.items[0]?.id ?? null
      setSelectedRunId(nextRunId)

      if (runsRes.canManage) {
        if (nextRunId) {
          await loadStubsForRun(nextRunId)
        } else {
          setStubs([])
          loadedRunIdRef.current = null
        }
        await loadUsers()
      } else {
        const myRes = await apiJson<{ ok: boolean; items: PayStubRow[] }>('/api/pay-stubs/my')
        setStubs(myRes.items)
        loadedRunIdRef.current = null
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [user, loadStubsForRun, loadUsers])

  useEffect(() => {
    setInitialized(false)
    void bootstrap()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps -- bootstrap on login/user change only

  useEffect(() => {
    if (!initialized || !canManage || !selectedRunId) return
    if (loadedRunIdRef.current === selectedRunId) return
    void loadStubsForRun(selectedRunId).catch((e) => {
      setErr(e instanceof Error ? e.message : 'unknown error')
    })
  }, [initialized, canManage, selectedRunId, loadStubsForRun])

  const reloadPage = useCallback(async (preferredRunId?: number | null) => {
    loadedRunIdRef.current = null
    await bootstrap(preferredRunId)
  }, [bootstrap])

  const createRun = async () => {
    const ym = window.prompt('급여 월 (YYYY-MM)', defaultYearMonth)
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return
    setSaving(true)
    setErr(null)
    try {
      const res = await apiJson<{ ok: boolean; item: PayStubRunRow }>('/api/pay-stubs/runs', {
        method: 'POST',
        body: JSON.stringify({ yearMonth: ym }),
      })
      await reloadPage(res.item.id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const publishRun = async () => {
    if (!selectedRunId || !selectedRun) return
    if (!window.confirm(`${fmtYearMonth(selectedRun.yearMonth)} 급여를 발행하시겠습니까? 발행 후 수정할 수 없습니다.`)) return
    setSaving(true)
    setErr(null)
    try {
      await apiJson(`/api/pay-stubs/runs/${selectedRunId}/publish`, { method: 'POST' })
      await reloadPage(selectedRunId)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const deleteRun = async () => {
    if (!selectedRunId || !selectedRun) return
    if (selectedRun.status === 'PUBLISHED') return
    if (!window.confirm('이 급여 배치를 삭제하시겠습니까?')) return
    setSaving(true)
    try {
      await apiJson(`/api/pay-stubs/runs/${selectedRunId}`, { method: 'DELETE' })
      await reloadPage()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const openCreateStub = () => {
    setEditId(null)
    setForm(emptyForm())
    setEditOpen(true)
  }

  const openEditStub = (row: PayStubRow) => {
    setEditId(row.id)
    setForm(formFromRow(row))
    setEditOpen(true)
  }

  const saveStub = async () => {
    if (!form.userId && !editId) {
      setErr('직원을 선택하세요.')
      return
    }
    const earnings = form.earnings.filter((l) => l.label.trim())
    const deductions = form.deductions.filter((l) => l.label.trim())
    if (earnings.length === 0) {
      setErr('지급 항목을 1개 이상 입력하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        userId: form.userId,
        dept: form.dept.trim() || null,
        position: form.position.trim() || null,
        workDays: form.workDays ? Number(form.workDays) : null,
        remark: form.remark.trim() || null,
        earnings: earnings.map((l) => ({ label: l.label.trim(), amount: Number(l.amount) || 0 })),
        deductions: deductions.map((l) => ({ label: l.label.trim(), amount: Number(l.amount) || 0 })),
      }
      if (editId) {
        await apiJson(`/api/pay-stubs/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiJson('/api/pay-stubs', {
          method: 'POST',
          body: JSON.stringify({ ...body, runId: selectedRunId }),
        })
      }
      setEditOpen(false)
      if (selectedRunId) await loadStubsForRun(selectedRunId)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const autoCalculateAll = async () => {
    if (!selectedRunId || !selectedRun) return
    if (stubs.length > 0) {
      if (!window.confirm('기존 명세가 있으면 덮어씁니다. 전체 자동 계산을 실행하시겠습니까?')) return
    } else {
      if (!window.confirm(`${fmtYearMonth(selectedRun.yearMonth)} 급여대상 직원의 명세를 자동 생성하시겠습니까?`)) return
    }
    setSaving(true)
    setErr(null)
    try {
      const res = await apiJson<{ ok: boolean; created: number; updated: number; skipped: number; errors: string[] }>(
        `/api/pay-stubs/runs/${selectedRunId}/auto-calculate`,
        { method: 'POST', body: JSON.stringify({ overwrite: stubs.length > 0 }) },
      )
      if (res.errors.length > 0) {
        setErr(`일부 실패: ${res.errors.slice(0, 3).join('; ')}`)
      } else if (res.created === 0 && res.updated === 0 && res.skipped === 0) {
        setErr('급여대상 직원이 없습니다. 직원정보(급여대상)를 먼저 등록하세요.')
      }
      await reloadPage(selectedRunId)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const recalculateStub = async (row: PayStubRow) => {
    setSaving(true)
    setErr(null)
    try {
      await apiJson(`/api/pay-stubs/${row.id}/recalculate`, { method: 'POST' })
      if (selectedRunId) await loadStubsForRun(selectedRunId)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const autoCalculateForm = async () => {
    if (!form.userId || !selectedRun?.yearMonth) return
    setSaving(true)
    setErr(null)
    try {
      const res = await apiJson<{
        ok: boolean
        earnings: { label: string; amount: number }[]
        deductions: { label: string; amount: number }[]
        workDays: number | null
        dept: string
        position: string
        warnings: string[]
      }>('/api/pay-stubs/calculate-preview', {
        method: 'POST',
        body: JSON.stringify({ userId: form.userId, yearMonth: selectedRun.yearMonth }),
      })
      setForm((f) => ({
        ...f,
        dept: res.dept || f.dept,
        position: res.position || f.position,
        workDays: res.workDays != null ? String(res.workDays) : f.workDays,
        earnings: res.earnings.map((l) => ({ lineType: 'EARNING' as const, label: l.label, amount: l.amount })),
        deductions: res.deductions.map((l) => ({ lineType: 'DEDUCTION' as const, label: l.label, amount: l.amount })),
      }))
      if (res.warnings.length > 0) {
        setErr(res.warnings.join(' '))
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const exportLedgerExcel = async () => {
    if (!selectedRunId) return
    setSaving(true)
    setErr(null)
    try {
      const res = await apiJson<{ ok: boolean } & PayrollLedger>(`/api/pay-stubs/runs/${selectedRunId}/ledger`)
      const { exportPayrollLedgerExcel } = await import('../../lib/payrollExcel')
      exportPayrollLedgerExcel(res)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const deleteStub = async (row: PayStubRow) => {
    if (!window.confirm(`${row.userName} 급여명세를 삭제하시겠습니까?`)) return
    setSaving(true)
    try {
      await apiJson(`/api/pay-stubs/${row.id}`, { method: 'DELETE' })
      if (selectedRunId) await loadStubsForRun(selectedRunId)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="mesPsPage">
        <div className="mesPsLoginNotice">
          <p>급여명세서는 로그인 후 이용할 수 있습니다.</p>
          <Link to="/login">로그인</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPsPage">
      <header className="mesPsTopBar">
        <div>
          <h1 className="mesPsTopTitle">급여명세서</h1>
          <p className="mesPsTopSub">
            {canManage
              ? '월별 급여 배치를 작성·발행하고 직원별 명세를 등록합니다.'
              : '발행된 본인 급여명세서를 조회합니다.'}
          </p>
        </div>
      </header>

      {err ? <div className="mesPsError" role="alert">{err}</div> : null}

      {!initialized ? (
        <section className="mesPsMyPanel" aria-busy="true">
          <p className="mesPsEmpty">급여명세서를 불러오는 중…</p>
        </section>
      ) : null}

      {initialized && canManage ? (
        <>
          <div className="mesPsToolbar">
            <div className="mesPsToolbarLeft">
              <button type="button" className="mesPsBtn mesPsBtn--green" onClick={createRun} disabled={saving}>
                + 월 배치
              </button>
              {selectedRun?.status === 'DRAFT' ? (
                <>
                  <button type="button" className="mesPsBtn mesPsBtn--ghost" onClick={openCreateStub} disabled={!selectedRunId || saving}>
                    + 명세 등록
                  </button>
                  <button
                    type="button"
                    className="mesPsBtn mesPsBtn--blue"
                    onClick={() => void autoCalculateAll()}
                    disabled={!selectedRunId || saving}
                  >
                    전체 자동 계산
                  </button>
                  <button
                    type="button"
                    className="mesPsBtn mesPsBtn--ghost"
                    onClick={() => void exportLedgerExcel()}
                    disabled={!selectedRunId || stubs.length === 0 || saving}
                  >
                    급여대장 Excel
                  </button>
                  <button
                    type="button"
                    className="mesPsBtn mesPsBtn--blue"
                    onClick={publishRun}
                    disabled={!selectedRunId || stubs.length === 0 || saving}
                  >
                    발행
                  </button>
                  <button type="button" className="mesPsBtn mesPsBtn--danger" onClick={deleteRun} disabled={!selectedRunId || saving}>
                    배치 삭제
                  </button>
                </>
              ) : null}
            </div>
            {selectedRun ? (
              <div className="mesPsToolbarMeta">
                {fmtYearMonth(selectedRun.yearMonth)} · {RUN_STATUS_LABEL[selectedRun.status]} · {selectedRun.stubCount}명
              </div>
            ) : null}
          </div>

          <div className="mesPsLayout">
            <aside className="mesPsRunList" aria-label="급여 월 목록">
              <h2 className="mesPsPanelTitle">급여 월</h2>
              {loading && runs.length === 0 ? <p className="mesPsEmpty">불러오는 중…</p> : null}
              {!loading && runs.length === 0 ? (
                <div className="mesPsEmptyGuide">
                  <p className="mesPsEmpty">등록된 배치가 없습니다.</p>
                  <p className="mesPsEmptyHint">상단 <strong>+ 월 배치</strong> 버튼으로 급여 월을 먼저 만든 뒤, <strong>전체 자동 계산</strong>으로 명세를 생성할 수 있습니다.</p>
                </div>
              ) : null}
              <ul className="mesPsRunItems">
                {runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      className={`mesPsRunItem${selectedRunId === run.id ? ' mesPsRunItem--active' : ''}`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <span className="mesPsRunItemYm">{fmtYearMonth(run.yearMonth)}</span>
                      <span className={`mesPsRunBadge mesPsRunBadge--${run.status.toLowerCase()}`}>
                        {RUN_STATUS_LABEL[run.status]}
                      </span>
                      <span className="mesPsRunItemCount">{run.stubCount}명</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="mesPsStubPanel" aria-label="급여명세 목록">
              <h2 className="mesPsPanelTitle">
                {selectedRun ? `${fmtYearMonth(selectedRun.yearMonth)} 명세` : '명세 목록'}
              </h2>
              {!selectedRunId ? (
                <div className="mesPsEmptyGuide">
                  <p className="mesPsEmpty">왼쪽에서 급여 월을 선택하세요.</p>
                  {runs.length === 0 ? (
                    <p className="mesPsEmptyHint">배치가 없다면 <strong>+ 월 배치</strong>로 {fmtYearMonth(defaultYearMonth)} 급여를 추가하세요.</p>
                  ) : null}
                </div>
              ) : null}
              {selectedRunId && !loading && stubs.length === 0 ? (
                <div className="mesPsEmptyGuide">
                  <p className="mesPsEmpty">등록된 명세가 없습니다.</p>
                  <p className="mesPsEmptyHint"><strong>전체 자동 계산</strong>을 실행하면 직원정보·근무입력 기준으로 명세가 생성됩니다.</p>
                </div>
              ) : null}
              {stubs.length > 0 ? (
                <div className="mesPsTableWrap">
                  <table className="mesPsTable">
                    <thead>
                      <tr>
                        <th>성명</th>
                        <th>부서</th>
                        <th>직위</th>
                        <th>지급계</th>
                        <th>공제계</th>
                        <th>실지급</th>
                        <th aria-label="작업" />
                      </tr>
                    </thead>
                    <tbody>
                      {stubs.map((row) => (
                        <tr key={row.id}>
                          <td>{row.userName}</td>
                          <td>{row.dept === '—' ? '' : row.dept}</td>
                          <td>{row.position === '—' ? '' : row.position}</td>
                          <td className="mesPsAmount">{fmtWon(row.totalEarning)}</td>
                          <td className="mesPsAmount">{fmtWon(row.totalDeduction)}</td>
                          <td className="mesPsAmount mesPsAmount--net">{fmtWon(row.netPay)}</td>
                          <td className="mesPsRowActions">
                            <button type="button" className="mesPsLinkBtn" onClick={() => setViewStub(row)}>보기</button>
                            {selectedRun?.status === 'DRAFT' ? (
                              <>
                                <button type="button" className="mesPsLinkBtn" onClick={() => void recalculateStub(row)}>재계산</button>
                                <button type="button" className="mesPsLinkBtn" onClick={() => openEditStub(row)}>수정</button>
                                <button type="button" className="mesPsLinkBtn mesPsLinkBtn--danger" onClick={() => void deleteStub(row)}>삭제</button>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </div>
        </>
      ) : initialized ? (
        <section className="mesPsMyPanel" aria-label="내 급여명세">
          {loading ? <p className="mesPsEmpty">불러오는 중…</p> : null}
          {!loading && stubs.length === 0 ? (
            <div className="mesPsEmptyGuide">
              <p className="mesPsEmpty">발행된 급여명세서가 없습니다.</p>
              <p className="mesPsEmptyHint">관리자가 급여를 발행하면 이곳에서 본인 명세를 조회할 수 있습니다.</p>
            </div>
          ) : null}
          {stubs.length > 0 ? (
            <div className="mesPsTableWrap">
              <table className="mesPsTable">
                <thead>
                  <tr>
                    <th>급여월</th>
                    <th>지급일</th>
                    <th>지급계</th>
                    <th>공제계</th>
                    <th>실지급</th>
                    <th aria-label="작업" />
                  </tr>
                </thead>
                <tbody>
                  {stubs.map((row) => (
                    <tr key={row.id}>
                      <td>{row.run ? fmtYearMonth(row.run.yearMonth) : '—'}</td>
                      <td>{row.run?.payDate ?? '—'}</td>
                      <td className="mesPsAmount">{fmtWon(row.totalEarning)}</td>
                      <td className="mesPsAmount">{fmtWon(row.totalDeduction)}</td>
                      <td className="mesPsAmount mesPsAmount--net">{fmtWon(row.netPay)}</td>
                      <td>
                        <button type="button" className="mesPsLinkBtn" onClick={() => setViewStub(row)}>명세서 보기</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {viewStub ? <PayStubViewModal stub={viewStub} onClose={() => setViewStub(null)} /> : null}

      {editOpen ? (
        <PayStubEditModal
          form={form}
          users={users}
          editMode={editId != null}
          saving={saving}
          yearMonth={selectedRun?.yearMonth ?? null}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onUpdateLines={(type, lines) =>
            setForm((f) =>
              type === 'EARNING' ? { ...f, earnings: lines } : { ...f, deductions: lines },
            )
          }
          onAutoCalculate={() => autoCalculateForm()}
          onSave={() => void saveStub()}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  )
}
