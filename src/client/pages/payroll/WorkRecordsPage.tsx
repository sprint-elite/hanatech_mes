import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser } from '../../lib/auth'
import {
  draftFromRow,
  emptyWorkDraft,
  fmtYearMonth,
  todayYmd,
  type WorkRecordAllowanceOption,
  type WorkRecordDraft,
  type WorkRecordEmployeeOption,
  type WorkRecordLineRow,
} from './payEmployeeTypes'
import '../../payroll-page.css'

function fmtQty(n: number) {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function WorkRecordsPage() {
  const [user] = useState(() => getStoredUser())
  const [filterDate, setFilterDate] = useState(todayYmd)
  const [rows, setRows] = useState<WorkRecordDraft[]>([])
  const [deletedIds, setDeletedIds] = useState<number[]>([])
  const [employees, setEmployees] = useState<WorkRecordEmployeeOption[]>([])
  const [allowanceItems, setAllowanceItems] = useState<WorkRecordAllowanceOption[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loadMonthOpen, setLoadMonthOpen] = useState(false)
  const [loadMonth, setLoadMonth] = useState(filterDate.slice(0, 7))
  const [loadUserId, setLoadUserId] = useState<number | ''>('')

  const totalQty = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
    [rows],
  )

  const loadOptions = useCallback(async () => {
    const res = await apiJson<{
      ok: boolean
      employees: WorkRecordEmployeeOption[]
      allowanceItems: WorkRecordAllowanceOption[]
      canManage: boolean
    }>('/api/payroll/work-records/options')
    setEmployees(res.employees)
    setAllowanceItems(res.allowanceItems)
    setCanManage(res.canManage)
  }, [])

  const loadByDate = useCallback(async (workDate: string) => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiJson<{ ok: boolean; items: WorkRecordLineRow[]; canManage: boolean }>(
        `/api/payroll/work-records?workDate=${encodeURIComponent(workDate)}`,
      )
      setRows(res.items.map(draftFromRow))
      setDeletedIds([])
      setCanManage(res.canManage)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void loadOptions().then(() => loadByDate(filterDate))
  }, [user, filterDate, loadOptions, loadByDate])

  const updateRow = (key: string, patch: Partial<WorkRecordDraft>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const onAllowanceChange = (key: string, allowanceItemId: number) => {
    const item = allowanceItems.find((a) => a.id === allowanceItemId)
    updateRow(key, { allowanceItemId, unitLabel: item?.unitLabel ?? '' })
  }

  const addRow = () => {
    setRows((prev) => [...prev, emptyWorkDraft(filterDate)])
  }

  const removeSelected = () => {
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) return
    if (!window.confirm(`선택한 ${selected.length}건을 삭제하시겠습니까?`)) return
    const removeKeys = new Set(selected.map((r) => r.key))
    const ids = selected.map((r) => r.id).filter((id): id is number => id != null)
    setDeletedIds((prev) => [...prev, ...ids])
    setRows((prev) => prev.filter((r) => !removeKeys.has(r.key)))
  }

  const sortByEmployee = () => {
    setRows((prev) => {
      const label = (r: WorkRecordDraft) => {
        const emp = employees.find((e) => e.id === r.userId)
        return emp?.userName ?? ''
      }
      return [...prev].sort((a, b) => label(a).localeCompare(label(b), 'ko'))
    })
  }

  const loadByCondition = async () => {
    setLoading(true)
    setErr(null)
    try {
      const params = new URLSearchParams({ yearMonth: loadMonth })
      if (loadUserId) params.set('userId', String(loadUserId))
      const res = await apiJson<{ ok: boolean; items: WorkRecordLineRow[] }>(
        `/api/payroll/work-records?${params.toString()}`,
      )
      setRows(res.items.map(draftFromRow))
      setDeletedIds([])
      setLoadMonthOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  const saveAll = async () => {
    if (!canManage) return
    const lines = rows
      .filter((r) => r.userId && r.allowanceItemId)
      .map((r) => ({
        id: r.id,
        workDate: r.workDate,
        userId: r.userId as number,
        allowanceItemId: r.allowanceItemId as number,
        quantity: Number(r.quantity) || 0,
      }))

    const incomplete = rows.some((r) => (r.userId || r.allowanceItemId || r.quantity) && (!r.userId || !r.allowanceItemId))
    if (incomplete) {
      setErr('사원과 수당항목을 모두 선택하세요.')
      return
    }

    setSaving(true)
    setErr(null)
    try {
      const res = await apiJson<{ ok: boolean; items: WorkRecordLineRow[] }>(
        '/api/payroll/work-records/bulk-save',
        {
          method: 'POST',
          body: JSON.stringify({ deleteIds: deletedIds, lines }),
        },
      )
      setRows(res.items.length ? res.items.map(draftFromRow) : [emptyWorkDraft(filterDate)])
      setDeletedIds([])
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
    <div className="mesPayPage mesPayWorkPage">
      <header className="mesPayTopBar">
        <div>
          <h1 className="mesPayTopTitle">근무입력</h1>
          <p className="mesPayTopSub">일자·사원·수당항목별 근무기록을 입력합니다. 급여 계산 시 해당 월 합계가 반영됩니다.</p>
        </div>
      </header>

      {err ? <div className="mesPayError" role="alert">{err}</div> : null}

      <div className="mesPayWorkDateBar">
        <label className="mesPayWorkDatePick">
          <span className="mesPayWorkDateLabel">일자</span>
          <input
            type="date"
            className="mesPayWorkDateInput"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </label>
        <div className="mesPayWorkDateActions">
          <button type="button" className="mesPayBtn mesPayBtn--ghost mesPayBtn--sm" onClick={() => void loadByDate(filterDate)} disabled={loading}>
            찾기(F3)
          </button>
          <button type="button" className="mesPayBtn mesPayBtn--ghost mesPayBtn--sm" onClick={sortByEmployee} disabled={rows.length === 0}>
            정렬
          </button>
          <button type="button" className="mesPayBtn mesPayBtn--ghost mesPayBtn--sm" onClick={() => setLoadMonthOpen(true)}>
            조건별 불러오기
          </button>
        </div>
      </div>

      <div className="mesPayWorkGridCard">
        {loading ? <p className="mesPayEmpty">불러오는 중…</p> : null}
        {!loading ? (
          <div className="mesPayWorkGridWrap">
            <table className="mesPayWorkGrid">
              <thead>
                <tr>
                  <th className="mesPayWorkColCheck" aria-label="선택">
                    <input
                      type="checkbox"
                      aria-label="전체 선택"
                      checked={rows.length > 0 && rows.every((r) => r.selected)}
                      onChange={(e) => setRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))}
                      disabled={!canManage || rows.length === 0}
                    />
                  </th>
                  <th className="mesPayWorkColNo">#</th>
                  <th>근무일자</th>
                  <th>사원</th>
                  <th>수당항목</th>
                  <th className="mesPayWorkColUnit">단위</th>
                  <th className="mesPayWorkColQty">근무기록</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="mesPayWorkEmptyCell">
                      {filterDate} 근무기록이 없습니다. 아래 「행 추가」로 입력하세요.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row, idx) => (
                  <tr key={row.key} className={row.selected ? 'mesPayWorkRow--selected' : undefined}>
                    <td className="mesPayWorkColCheck">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
                        disabled={!canManage}
                      />
                    </td>
                    <td className="mesPayWorkColNo">{idx + 1}</td>
                    <td>
                      <input
                        type="date"
                        className="mesPayWorkCellInput"
                        value={row.workDate}
                        onChange={(e) => updateRow(row.key, { workDate: e.target.value })}
                        disabled={!canManage}
                      />
                    </td>
                    <td>
                      <select
                        className="mesPayWorkCellSelect"
                        value={row.userId ?? ''}
                        onChange={(e) => updateRow(row.key, { userId: e.target.value ? Number(e.target.value) : null })}
                        disabled={!canManage}
                      >
                        <option value="">선택</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.userName}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="mesPayWorkCellSelect"
                        value={row.allowanceItemId ?? ''}
                        onChange={(e) => onAllowanceChange(row.key, Number(e.target.value))}
                        disabled={!canManage}
                      >
                        <option value="">선택</option>
                        {allowanceItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.itemName}</option>
                        ))}
                      </select>
                    </td>
                    <td className="mesPayWorkColUnit">{row.unitLabel}</td>
                    <td className="mesPayWorkColQty">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="mesPayWorkCellInput mesPayWorkCellInput--num"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        disabled={!canManage}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="mesPayWorkFootLabel">합계</td>
                  <td className="mesPayWorkColQty mesPayWorkFootTotal">{fmtQty(totalQty)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <div className="mesPayWorkFootBar">
          <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={addRow} disabled={saving}>
            + 행 추가
          </button>
          <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={removeSelected} disabled={saving || !rows.some((r) => r.selected)}>
            선택 삭제
          </button>
          <button type="button" className="mesPayBtn mesPayBtn--green" onClick={() => void saveAll()} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      ) : null}

      {loadMonthOpen ? (
        <div className="mesPayModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setLoadMonthOpen(false)} />
          <div className="mesPayModal" role="dialog" aria-modal="true">
            <header className="mesPayModalHead">
              <h2>조건별 불러오기</h2>
              <button type="button" className="mesPayModalClose" onClick={() => setLoadMonthOpen(false)}>×</button>
            </header>
            <div className="mesPayModalBody">
              <label className="mesPayFormRow">
                <span>급여월</span>
                <input type="month" className="mesPayInput" value={loadMonth} onChange={(e) => setLoadMonth(e.target.value)} />
              </label>
              <label className="mesPayFormRow">
                <span>사원 (선택)</span>
                <select className="mesPayInput" value={loadUserId} onChange={(e) => setLoadUserId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">전체</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.userName}</option>
                  ))}
                </select>
              </label>
              <p className="mesPayWorkLoadHint">{fmtYearMonth(loadMonth)} 전체 근무기록을 불러옵니다.</p>
            </div>
            <footer className="mesPayModalFoot">
              <button type="button" className="mesPayBtn mesPayBtn--ghost" onClick={() => setLoadMonthOpen(false)}>취소</button>
              <button type="button" className="mesPayBtn mesPayBtn--green" onClick={() => void loadByCondition()}>불러오기</button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
