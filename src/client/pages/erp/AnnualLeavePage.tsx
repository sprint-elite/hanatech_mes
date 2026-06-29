import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser, type MesAuthUser } from '../../lib/auth'
import { LeaveApplicationApplyModal } from './LeaveApplicationApplyModal'
import { LeaveApplicationViewModal } from './LeaveApplicationViewModal'
import {
  STATUS_LABEL,
  buildCalendarCells,
  calcDays,
  canApprove,
  canCancelOwnApproval,
  canCancelOwnRejection,
  decisionMark,
  fmtKrDate,
  fmtPeriodShort,
  fmtYmd,
  isCeoRole,
  isManagerRole,
  type Balance,
  type LeaveRow,
  type LeaveStatus,
} from './annualLeaveTypes'
import type { ApplicantInfo } from './LeaveApplicationSheet'
import '../../annual-leave-page.css'

const PAGE_SIZE = 10
const DOW = ['일', '월', '화', '수', '목', '금', '토']

function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function canActApprove(user: MesAuthUser, r: LeaveRow) {
  if (r.status !== 'PENDING') return false
  if (isManagerRole(user.roleName) && r.managerDecision === 'PENDING') return true
  if (isCeoRole(user.roleName) && r.ceoDecision === 'PENDING') return true
  return false
}

export function AnnualLeavePage() {
  const liveNow = useLiveClock()
  const [user] = useState<MesAuthUser | null>(() => getStoredUser())
  const [year, setYear] = useState(liveNow.getFullYear())
  const [month, setMonth] = useState(liveNow.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(
    fmtYmd(liveNow.getFullYear(), liveNow.getMonth() + 1, liveNow.getDate()),
  )
  const [balance, setBalance] = useState<Balance | null>(null)
  const [applicant, setApplicant] = useState<ApplicantInfo | null>(null)
  const [calendarDays, setCalendarDays] = useState<Record<string, LeaveRow[]>>({})
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeaveStatus>('ALL')
  const [page, setPage] = useState(1)
  const [applyOpen, setApplyOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<LeaveRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<LeaveRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    days: '',
    leaveType: '연차',
    reason: '',
    emergencyContact: '',
  })

  const approver = user ? canApprove(user.roleName) : false
  const monthValue = `${year}-${String(month).padStart(2, '0')}`

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [bal, cal, list] = await Promise.all([
        apiJson<{ ok: boolean; balance: Balance; applicant: ApplicantInfo }>(`/api/annual-leave/balance?year=${year}`),
        apiJson<{ ok: boolean; days: Record<string, LeaveRow[]> }>(
          `/api/annual-leave/calendar?year=${year}&month=${month}`,
        ),
        apiJson<{ ok: boolean; items: LeaveRow[] }>(
          `/api/annual-leave/requests?year=${year}${statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
        ),
      ])
      setBalance(bal.balance)
      setApplicant(bal.applicant)
      setCalendarDays(cal.days)
      setRows(list.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, year, month, statusFilter, search])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, year])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selectedDayItems = calendarDays[selectedDate] ?? []
  const cells = buildCalendarCells(year, month)

  const clockStr = liveNow.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = liveNow.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const shiftMonth = (delta: number) => {
    let m = month + delta
    let y = year
    while (m < 1) { m += 12; y -= 1 }
    while (m > 12) { m -= 12; y += 1 }
    setYear(y)
    setMonth(m)
  }

  const onMonthPick = (value: string) => {
    if (!value) return
    const [y, m] = value.split('-').map(Number)
    setYear(y)
    setMonth(m)
  }

  const openApply = () => {
    setForm({
      startDate: selectedDate,
      endDate: selectedDate,
      days: '1',
      leaveType: '연차',
      reason: '',
      emergencyContact: '',
    })
    setApplyOpen(true)
  }

  const submitApply = async () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      setErr('기간과 세부 사항을 입력하세요.')
      return
    }
    const days = form.days.trim() === '' ? Number(calcDays(form.startDate, form.endDate)) : Number(form.days)
    if (!Number.isFinite(days) || days <= 0) {
      setErr('일수가 올바르지 않습니다.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await apiJson('/api/annual-leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          startDate: form.startDate,
          endDate: form.endDate,
          days,
          leaveType: form.leaveType,
          reason: form.reason.trim(),
          emergencyContact: form.emergencyContact.trim() || null,
        }),
      })
      setApplyOpen(false)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const act = async (
    id: number,
    action: 'approve' | 'reject' | 'cancel-approval' | 'cancel-rejection' | 'cancel',
    reason?: string,
  ) => {
    setErr(null)
    try {
      const path =
        action === 'approve'
          ? `/api/annual-leave/requests/${id}/approve`
          : action === 'reject'
            ? `/api/annual-leave/requests/${id}/reject`
            : action === 'cancel-approval'
              ? `/api/annual-leave/requests/${id}/cancel-approval`
              : action === 'cancel-rejection'
                ? `/api/annual-leave/requests/${id}/cancel-rejection`
                : `/api/annual-leave/requests/${id}/cancel`
      const res = await apiJson<{ ok: boolean; item: LeaveRow }>(path, {
        method: 'PATCH',
        body: JSON.stringify(action === 'reject' ? { rejectReason: reason ?? '' } : {}),
      })
      setRejectTarget(null)
      setRejectReason('')
      if (detailRow?.id === id) setDetailRow(res.item)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  if (!user) {
    return (
      <div className="mesPage mesPageWide mesAlPage">
        <div className="mesAlLoginNotice">
          연차관리는 로그인 후 이용할 수 있습니다.
          <br />
          <Link to="/login" className="mesAlBtn mesAlBtn--green" style={{ marginTop: 14, display: 'inline-flex' }}>
            로그인
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPage mesPageWide mesAlPage">
      <header className="mesAlTopBar">
        <div>
          <h1 className="mesAlTopTitle">연차관리</h1>
          <p className="mesAlTopSub">{user.userName} · {user.roleName}</p>
        </div>
        <div className="mesAlTopClock">
          <div className="mesAlTopDate">{dateStr}</div>
          <div className="mesAlTopTime">{clockStr}</div>
        </div>
      </header>

      {balance ? (
        <div className="mesAlSummaryRow">
          <div className="mesAlSummaryItem">
            <span>총 연차</span>
            <strong>{balance.totalDays}일</strong>
          </div>
          <div className="mesAlSummaryItem">
            <span>사용</span>
            <strong>{balance.usedDays}일</strong>
          </div>
          <div className="mesAlSummaryItem mesAlSummaryItem--accent">
            <span>잔여</span>
            <strong>{balance.remainingDays}일</strong>
          </div>
          <button type="button" className="mesAlBtn mesAlBtn--green" onClick={openApply}>
            + 연차 신청
          </button>
        </div>
      ) : null}

      {err ? (
        <div className="mesNotice mesNoticeError" role="alert" style={{ marginBottom: 14 }}>
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">×</button>
        </div>
      ) : null}

      <section className="mesAlCalendarCard">
        <div className="mesAlCalendarToolbar">
          <label className="mesAlMonthPick">
            <span>월별 보기</span>
            <input type="month" value={monthValue} onChange={(e) => onMonthPick(e.target.value)} />
          </label>
          <div className="mesAlMonthNav">
            <button type="button" className="mesAlIconBtn" onClick={() => shiftMonth(-1)} aria-label="이전 달">‹</button>
            <button type="button" className="mesAlIconBtn" onClick={() => shiftMonth(1)} aria-label="다음 달">›</button>
          </div>
          <div className="mesAlLegendPills">
            <span className="mesAlLegendPill mesAlLegendPill--pending">요청</span>
            <span className="mesAlLegendPill mesAlLegendPill--approved">승인</span>
            <span className="mesAlLegendPill mesAlLegendPill--rejected">반려</span>
          </div>
        </div>

        <div className="mesAlCalendarBody">
          <div className="mesAlCalendarMain">
            <div className="mesAlCalGrid" role="grid" aria-label="연차 캘린더">
              {DOW.map((d) => (
                <div key={d} className="mesAlCalDow" role="columnheader">{d}</div>
              ))}
              {cells.map((day, i) => {
                if (day == null) {
                  return <div key={`e-${i}`} className="mesAlCalCell mesAlCalCell--empty" aria-hidden />
                }
                const key = fmtYmd(year, month, day)
                const items = calendarDays[key] ?? []
                const selected = key === selectedDate
                return (
                  <button
                    key={key}
                    type="button"
                    className={`mesAlCalCell${selected ? ' mesAlCalCell--selected' : ''}`}
                    onClick={() => setSelectedDate(key)}
                  >
                    <div className="mesAlCalDayNum">{day}</div>
                    <div className="mesAlCalBadges">
                      {items.slice(0, 4).map((it) => (
                        <span
                          key={`${it.id}-${key}`}
                          className={`mesAlCalBadge mesAlCalBadge--${it.status}`}
                        >
                          {STATUS_LABEL[it.status]} {it.userName}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="mesAlDaySide">
            <h3 className="mesAlDaySideTitle">
              {selectedDate.replace(/-/g, '.')} · {selectedDayItems.length}건
            </h3>
            {selectedDayItems.length === 0 ? (
              <p className="mesAlDaySideEmpty">선택한 날짜에 연차 신청이 없습니다.</p>
            ) : (
              selectedDayItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="mesAlDaySideCard"
                  onClick={() => setDetailRow(it)}
                >
                  <div className="mesAlDaySideCardHead">
                    <strong>{it.userName} · {it.position}</strong>
                    <span className={`mesAlStatusBadge mesAlStatusBadge--${it.status}`}>
                      {STATUS_LABEL[it.status]}
                    </span>
                  </div>
                  <p className="mesAlDaySidePeriod">
                    {fmtKrDate(it.startDate)} ~ {fmtKrDate(it.endDate)} ({it.days}일)
                  </p>
                  <p className="mesAlDaySideReason">{it.reason}</p>
                </button>
              ))
            )}
          </aside>
        </div>
      </section>

      <section className="mesAlListCard">
        <div className="mesAlListToolbar">
          <input
            type="search"
            className="mesAlInput mesAlInput--search"
            placeholder="직원명·직급·사유·기간 검색"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchDraft.trim()) }}
          />
          <select
            className="mesAlInput"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | LeaveStatus)}
          >
            <option value="ALL">전체</option>
            <option value="PENDING">신청</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
          </select>
          <button type="button" className="mesAlBtn mesAlBtn--ghost" onClick={() => setSearch(searchDraft.trim())}>검색</button>
        </div>

        <div className="mesAlTableWrap">
          <table className="mesAlTable">
            <thead>
              <tr>
                <th>직원</th>
                <th>부서/직급</th>
                <th>연차기간</th>
                <th>일수</th>
                <th>상태</th>
                <th>결재상태</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="mesAlTableEmpty">로딩 중…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={7} className="mesAlTableEmpty">연차 내역이 없습니다.</td></tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id}>
                    <td className="mesAlTdName">{r.userName}</td>
                    <td>{r.dept}<br /><span className="mesAlTdSub">{r.position}</span></td>
                    <td className="mesAlTdPeriod">{fmtPeriodShort(r.startDate, r.endDate)}</td>
                    <td>{r.days}일</td>
                    <td>
                      <span className={`mesAlStatusBadge mesAlStatusBadge--${r.status}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.status === 'REJECTED' && r.rejectReason ? (
                        <div className="mesAlRejectReason" title={r.rejectReason}>
                          {r.rejectReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="mesAlApprovalCell">
                      <span>실장 <b className={r.managerDecision === 'APPROVED' ? 'mesAlY' : r.managerDecision === 'REJECTED' ? 'mesAlN' : 'mesAlDash'}>{decisionMark(r.managerDecision)}</b></span>
                      {' / '}
                      <span>대표 <b className={r.ceoDecision === 'APPROVED' ? 'mesAlY' : r.ceoDecision === 'REJECTED' ? 'mesAlN' : 'mesAlDash'}>{decisionMark(r.ceoDecision)}</b></span>
                    </td>
                    <td>
                      <div className="mesAlRowActions">
                        {user && canActApprove(user, r) ? (
                          <>
                            <button type="button" className="mesAlActionBtn mesAlActionBtn--approve" onClick={() => void act(r.id, 'approve')}>승인</button>
                            <button type="button" className="mesAlActionBtn mesAlActionBtn--reject" onClick={() => { setRejectTarget(r); setRejectReason('') }}>반려</button>
                          </>
                        ) : null}
                        {user && canCancelOwnApproval(user.roleName, r) ? (
                          <button type="button" className="mesAlActionBtn mesAlActionBtn--ghost" onClick={() => void act(r.id, 'cancel-approval')}>승인취소</button>
                        ) : null}
                        {user && canCancelOwnRejection(user.roleName, r) ? (
                          <button type="button" className="mesAlActionBtn mesAlActionBtn--ghost" onClick={() => void act(r.id, 'cancel-rejection')}>반려취소</button>
                        ) : null}
                        {r.status === 'PENDING' && (r.userId === user.id || approver) ? (
                          <button type="button" className="mesAlActionBtn mesAlActionBtn--ghost" onClick={() => void act(r.id, 'cancel')}>신청취소</button>
                        ) : null}
                        <button type="button" className="mesAlActionBtn mesAlActionBtn--view" onClick={() => setDetailRow(r)}>신청서 보기</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mesAlPager">
          <span>페이지 {safePage} / {totalPages} · 총 {rows.length}건</span>
          <div className="mesAlPagerNav">
            <button type="button" className="mesAlIconBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
            <button type="button" className="mesAlIconBtn" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>›</button>
          </div>
        </div>
      </section>

      {applyOpen && user ? (
        <LeaveApplicationApplyModal
          applicant={applicant ?? { userName: user.userName, dept: '', position: user.roleName }}
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          saving={saving}
          onClose={() => setApplyOpen(false)}
          onSubmit={() => void submitApply()}
        />
      ) : null}

      {rejectTarget ? (
        <div className="mesAlModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setRejectTarget(null)} />
          <div className="mesAlFormDialog" role="dialog" aria-modal="true">
            <header className="mesAlFormHead"><h2>연차 반려</h2></header>
            <div className="mesAlFormBody">
              <p>{rejectTarget.userName}님의 연차 신청을 반려합니다.</p>
              <label className="mesAlFormField">
                <span>반려 사유 (선택)</span>
                <textarea className="mesAlInput" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </label>
            </div>
            <footer className="mesAlFormFoot">
              <button type="button" className="mesAlBtn mesAlBtn--ghost" onClick={() => setRejectTarget(null)}>취소</button>
              <button type="button" className="mesAlActionBtn mesAlActionBtn--reject" onClick={() => void act(rejectTarget.id, 'reject', rejectReason)}>반려</button>
            </footer>
          </div>
        </div>
      ) : null}

      {detailRow ? <LeaveApplicationViewModal row={detailRow} onClose={() => setDetailRow(null)} /> : null}
    </div>
  )
}
