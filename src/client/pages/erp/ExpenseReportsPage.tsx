import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser, type MesAuthUser } from '../../lib/auth'
import { ExpenseReportApplyModal } from './ExpenseReportApplyModal'
import { ExpenseReportViewModal } from './ExpenseReportViewModal'
import {
  EXPENSE_STATUS_LABEL,
  canApprove,
  canCancelExpenseApproval,
  canCancelExpenseRejection,
  emptyForm,
  emptyLine,
  fmtWon,
  isCeoRole,
  isManagerRole,
  type ExpenseFormDraft,
  type ExpenseRow,
} from './expenseReportTypes'
import type { ApplicantInfo } from './ExpenseReportSheet'
import '../../annual-leave-page.css'
import '../../expense-report-page.css'

const PAGE_SIZE = 10

function canActApprove(user: MesAuthUser, r: ExpenseRow) {
  if (r.status !== 'PENDING') return false
  if (isManagerRole(user.roleName) && r.managerDecision === 'PENDING') return true
  if (isCeoRole(user.roleName) && r.ceoDecision === 'PENDING') return true
  return false
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'))
    reader.readAsDataURL(file)
  })
}

export function ExpenseReportsPage() {
  const [user] = useState<MesAuthUser | null>(() => getStoredUser())
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [applicant, setApplicant] = useState<ApplicantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExpenseRow['status']>('ALL')
  const [page, setPage] = useState(1)
  const [applyOpen, setApplyOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<ExpenseRow | null>(null)
  const [receiptRow, setReceiptRow] = useState<ExpenseRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ExpenseRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ExpenseFormDraft>(() => emptyForm(new Date().toISOString().slice(0, 10)))
  const [lineSlots, setLineSlots] = useState(24)

  const approver = user ? canApprove(user.roleName) : false

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: ExpenseRow[]; pendingCount: number }>(
        `/api/expense-reports?year=${year}${statusFilter !== 'ALL' ? `&status=${statusFilter}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
      )
      setRows(data.items)
      setPendingCount(data.pendingCount)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, year, statusFilter, search])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, year])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const openApply = () => {
    const today = new Date().toISOString().slice(0, 10)
    setForm(emptyForm(today))
    setLineSlots(24)
    setApplyOpen(true)
  }

  const loadApplicant = useCallback(async () => {
    if (!user) return
    try {
      const bal = await apiJson<{ ok: boolean; applicant: ApplicantInfo }>(`/api/annual-leave/balance?year=${year}`)
      setApplicant(bal.applicant)
    } catch {
      setApplicant({ userName: user.userName, dept: '', position: user.roleName })
    }
  }, [user, year])

  useEffect(() => {
    if (applyOpen) void loadApplicant()
  }, [applyOpen, loadApplicant])

  const onReceiptPick = async (file: File | null) => {
    if (!file) return
    if (file.size > 4_000_000) {
      setErr('영수증 이미지는 4MB 이하만 업로드할 수 있습니다.')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setForm((f) => ({ ...f, receiptDataUrl: dataUrl }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const submitApply = async () => {
    const validLines = form.lines.filter((l) => l.vendor.trim() && l.description.trim() && l.amount > 0)
    if (!form.reportDate || validLines.length === 0) {
      setErr('날짜와 사용 내역(사용처·내역·금액)을 입력하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await apiJson('/api/expense-reports', {
        method: 'POST',
        body: JSON.stringify({
          reportDate: form.reportDate,
          receiptDataUrl: form.receiptDataUrl,
          lines: validLines.map((l) => ({
            vendor: l.vendor.trim(),
            description: l.description.trim(),
            amount: l.amount,
          })),
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
          ? `/api/expense-reports/${id}/approve`
          : action === 'reject'
            ? `/api/expense-reports/${id}/reject`
            : action === 'cancel-approval'
              ? `/api/expense-reports/${id}/cancel-approval`
              : action === 'cancel-rejection'
                ? `/api/expense-reports/${id}/cancel-rejection`
                : `/api/expense-reports/${id}/cancel`
      const res = await apiJson<{ ok: boolean; item: ExpenseRow }>(path, {
        method: 'PATCH',
        body: JSON.stringify(action === 'reject' ? { rejectReason: reason ?? '' } : {}),
      })
      setRejectTarget(null)
      setRejectReason('')
      if (detailRow?.id === id) {
        const full = await apiJson<{ ok: boolean; item: ExpenseRow }>(`/api/expense-reports/${id}`)
        setDetailRow(full.item)
      }
      void res
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const openDetail = async (id: number) => {
    try {
      const data = await apiJson<{ ok: boolean; item: ExpenseRow }>(`/api/expense-reports/${id}`)
      setDetailRow(data.item)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const openReceipt = async (id: number) => {
    try {
      const data = await apiJson<{ ok: boolean; item: ExpenseRow }>(`/api/expense-reports/${id}`)
      if (!data.item.receiptDataUrl) {
        setErr('첨부된 영수증이 없습니다.')
        return
      }
      setReceiptRow(data.item)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  if (!user) {
    return (
      <div className="mesPage mesPageWide mesAlPage mesErPage">
        <div className="mesAlLoginNotice">
          지출결의서는 로그인 후 이용할 수 있습니다.
          <br />
          <Link to="/login" className="mesAlBtn mesAlBtn--green" style={{ marginTop: 14, display: 'inline-flex' }}>
            로그인
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPage mesPageWide mesAlPage mesErPage">
      <header className="mesErTopBar">
        <div>
          <p className="mesErKicker">ERP · 내역서관리</p>
          <h1 className="mesErTopTitle">지출결의서</h1>
          <p className="mesErTopSub">
            {user.userName} · {user.roleName}
          </p>
        </div>
        {approver && pendingCount > 0 ? (
          <div className="mesErPendingBadge">승인대기 {pendingCount}건</div>
        ) : null}
      </header>

      <div className="mesErToolbar">
        <button type="button" className="mesAlBtn mesAlBtn--green" onClick={openApply}>
          + 지출결의서 작성
        </button>
        <label className="mesErYearPick">
          <span>연도</span>
          <select className="mesAlInput" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mesAlBtn mesAlBtn--ghost" onClick={() => void loadAll()}>
          새로고침
        </button>
      </div>

      {err ? (
        <div className="mesNotice mesNoticeError" role="alert" style={{ marginBottom: 14 }}>
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <section className="mesAlListCard">
        <div className="mesAlListToolbar">
          <input
            type="search"
            className="mesAlInput mesAlInput--search"
            placeholder="직원명·사용처·내역 검색"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(searchDraft.trim())
            }}
          />
          <select
            className="mesAlInput"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ExpenseRow['status'])}
          >
            <option value="ALL">전체</option>
            <option value="PENDING">보류</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
            <option value="CANCELLED">취소</option>
          </select>
          <button type="button" className="mesAlBtn mesAlBtn--ghost" onClick={() => setSearch(searchDraft.trim())}>
            검색
          </button>
        </div>

        <div className="mesAlTableWrap">
          <table className="mesAlTable mesErTable">
            <thead>
              <tr>
                <th>작성자</th>
                <th>신청일</th>
                <th>지출일</th>
                <th>총금액</th>
                <th>상태</th>
                <th>결재</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="mesAlTableEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mesAlTableEmpty">
                    지출결의서 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id}>
                    <td className="mesAlTdName">{r.userName}</td>
                    <td>{r.createdAt.slice(0, 10)}</td>
                    <td>{r.reportDate}</td>
                    <td>{fmtWon(r.totalAmount)}</td>
                    <td>
                      <span className={`mesErStatusBadge mesErStatusBadge--${r.status}`}>
                        {EXPENSE_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="mesAlApprovalCell">
                      <span>
                        담당 <b>{r.managerDecision === 'APPROVED' ? 'Y' : r.managerDecision === 'REJECTED' ? 'N' : '—'}</b>
                      </span>
                      {' / '}
                      <span>
                        대표 <b>{r.ceoDecision === 'APPROVED' ? 'Y' : r.ceoDecision === 'REJECTED' ? 'N' : '—'}</b>
                      </span>
                    </td>
                    <td>
                      <div className="mesErRowActions">
                        {user && canActApprove(user, r) ? (
                          <>
                            <button type="button" className="mesErActionBtn mesErActionBtn--approve" onClick={() => void act(r.id, 'approve')}>
                              승인
                            </button>
                            <button
                              type="button"
                              className="mesErActionBtn mesErActionBtn--reject"
                              onClick={() => {
                                setRejectTarget(r)
                                setRejectReason('')
                              }}
                            >
                              반려
                            </button>
                          </>
                        ) : null}
                        {user && canCancelExpenseApproval(user.roleName, r) ? (
                          <button type="button" className="mesErActionBtn mesErActionBtn--ghost" onClick={() => void act(r.id, 'cancel-approval')}>
                            승인취소
                          </button>
                        ) : null}
                        {user && canCancelExpenseRejection(user.roleName, r) ? (
                          <button type="button" className="mesErActionBtn mesErActionBtn--ghost" onClick={() => void act(r.id, 'cancel-rejection')}>
                            반려취소
                          </button>
                        ) : null}
                        {r.status === 'PENDING' && (r.userId === user.id || approver) ? (
                          <button type="button" className="mesErActionBtn mesErActionBtn--ghost" onClick={() => void act(r.id, 'cancel')}>
                            신청취소
                          </button>
                        ) : null}
                        <button type="button" className="mesErActionBtn mesErActionBtn--view" onClick={() => void openDetail(r.id)}>
                          신청서 보기
                        </button>
                        <button
                          type="button"
                          className="mesErActionBtn mesErActionBtn--view"
                          disabled={!r.receiptDataUrl}
                          onClick={() => void openReceipt(r.id)}
                        >
                          영수증 보기
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mesAlPager">
          <span>
            페이지 {safePage} / {totalPages} · 총 {rows.length}건
          </span>
          <div className="mesAlPagerNav">
            <button type="button" className="mesAlIconBtn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              ‹
            </button>
            <button type="button" className="mesAlIconBtn" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              ›
            </button>
          </div>
        </div>
      </section>

      {applyOpen && user ? (
        <ExpenseReportApplyModal
          applicant={applicant ?? { userName: user.userName, dept: '', position: user.roleName }}
          form={form}
          lineSlots={lineSlots}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onLineChange={(index, patch) =>
            setForm((f) => {
              const lines = [...f.lines]
              while (lines.length <= index) lines.push(emptyLine())
              lines[index] = { ...lines[index], ...patch }
              return { ...f, lines }
            })
          }
          onAddLine={() => {
            setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
            setLineSlots((s) => s + 1)
          }}
          onReceiptPick={(file) => void onReceiptPick(file)}
          saving={saving}
          onClose={() => setApplyOpen(false)}
          onSubmit={() => void submitApply()}
        />
      ) : null}

      {rejectTarget ? (
        <div className="mesAlModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setRejectTarget(null)} />
          <div className="mesAlFormDialog" role="dialog" aria-modal="true">
            <header className="mesAlFormHead">
              <h2>지출결의서 반려</h2>
            </header>
            <div className="mesAlFormBody">
              <p>{rejectTarget.userName}님의 지출결의서를 반려합니다.</p>
              <label className="mesAlFormField">
                <span>반려 사유 (선택)</span>
                <textarea className="mesAlInput" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </label>
            </div>
            <footer className="mesAlFormFoot">
              <button type="button" className="mesAlBtn mesAlBtn--ghost" onClick={() => setRejectTarget(null)}>
                취소
              </button>
              <button type="button" className="mesAlActionBtn mesAlActionBtn--reject" onClick={() => void act(rejectTarget.id, 'reject', rejectReason)}>
                반려
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {detailRow ? <ExpenseReportViewModal row={detailRow} onClose={() => setDetailRow(null)} /> : null}

      {receiptRow?.receiptDataUrl ? (
        <div className="mesAlModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setReceiptRow(null)} />
          <div className="mesErReceiptDialog" role="dialog" aria-modal="true">
            <header className="mesErReceiptHead">
              <h2>영수증 — {receiptRow.userName}</h2>
              <button type="button" className="mesAlDocCloseBtn" onClick={() => setReceiptRow(null)}>
                닫기
              </button>
            </header>
            <img src={receiptRow.receiptDataUrl} alt="영수증" className="mesErReceiptFull" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
