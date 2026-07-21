import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser, type MesAuthUser } from '../../lib/auth'
import { getCalendarDayMeta } from './krHolidays'
import {
  CATEGORY_PRESETS,
  KANBAN_COLUMNS,
  STATUS_LABEL,
  buildCalendarCells,
  cardColor,
  contentPreview,
  emptyForm,
  fmtCalBadge,
  fmtWorkLogDateTime,
  fmtYmd,
  formFromRow,
  sortDayLogs,
  workLogOnDate,
  type WorkLogFormDraft,
  type WorkLogRow,
  type WorkLogStatus,
  type WorkLogUserOption,
} from './workLogTypes'
import '../../work-logs-page.css'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function useLiveClock(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function sortListRows(rows: WorkLogRow[]) {
  return [...rows].sort((a, b) => {
    if (a.workDate !== b.workDate) return b.workDate.localeCompare(a.workDate)
    const ta = a.workTime ?? '99:99'
    const tb = b.workTime ?? '99:99'
    if (ta !== tb) return tb.localeCompare(ta)
    return b.id - a.id
  })
}

type KanbanBoardProps = {
  itemsByStatus: Record<WorkLogStatus, WorkLogRow[]>
  canEditRow: (row: WorkLogRow) => boolean
  highlightLogId: number | null
  dragId: number | null
  setDragId: (id: number | null) => void
  onMoveStatus: (id: number, status: WorkLogStatus) => void
  onCardClick: (row: WorkLogRow) => void
}

function KanbanBoard({
  itemsByStatus,
  canEditRow,
  highlightLogId,
  dragId,
  setDragId,
  onMoveStatus,
  onCardClick,
}: KanbanBoardProps) {
  return (
    <div className="mesWlKanban mesWlKanban--modal">
      {KANBAN_COLUMNS.map((status) => (
        <div
          key={status}
          className={`mesWlKanbanCol mesWlKanbanCol--${status.toLowerCase()}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (dragId == null) return
            onMoveStatus(dragId, status)
            setDragId(null)
          }}
        >
          <div className="mesWlKanbanColHead">
            <span>{STATUS_LABEL[status]}</span>
            <em>{itemsByStatus[status].length}</em>
          </div>
          <div className="mesWlKanbanColBody">
            {itemsByStatus[status].map((row) => (
              <article
                key={row.id}
                className={`mesWlCard${highlightLogId === row.id ? ' mesWlCard--highlight' : ''}`}
                draggable={canEditRow(row)}
                onDragStart={() => { if (canEditRow(row)) setDragId(row.id) }}
                onDragEnd={() => setDragId(null)}
                onClick={() => { if (canEditRow(row)) onCardClick(row) }}
                style={{
                  borderLeftColor: cardColor(row),
                  cursor: canEditRow(row) ? 'grab' : 'default',
                }}
              >
                <div className="mesWlCardTop">
                  {row.category ? (
                    <span className="mesWlCardLabel mesWlCardLabel--cat">{row.category}</span>
                  ) : null}
                  <span className={`mesWlCardLabel mesWlCardLabel--${row.status.toLowerCase()}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                  <strong className="mesWlCardTitle">{row.title}</strong>
                </div>
                <p className="mesWlCardMeta">
                  <span className="mesWlCardMetaDate">{fmtWorkLogDateTime(row)}</span>
                  <span className="mesWlCardMetaSep" aria-hidden>·</span>
                  <span className="mesWlCardMetaName">{row.userName}</span>
                </p>
                {row.content ? (
                  <p className="mesWlCardSub">{contentPreview(row.content, 48)}</p>
                ) : null}
              </article>
            ))}
            {itemsByStatus[status].length === 0 ? (
              <p className="mesWlKanbanEmpty">항목 없음</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SchedulesPage() {
  const [user] = useState<MesAuthUser | null>(() => getStoredUser())
  const liveNow = useLiveClock()
  const todayKey = fmtYmd(liveNow.getFullYear(), liveNow.getMonth() + 1, liveNow.getDate())
  const [year, setYear] = useState(liveNow.getFullYear())
  const [month, setMonth] = useState(liveNow.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [filterUserId, setFilterUserId] = useState<number | ''>('')
  const [items, setItems] = useState<WorkLogRow[]>([])
  const [userOptions, setUserOptions] = useState<WorkLogUserOption[]>([])
  const [canViewAll, setCanViewAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [kanbanModalOpen, setKanbanModalOpen] = useState(false)
  const [highlightLogId, setHighlightLogId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<WorkLogFormDraft>(() => emptyForm(todayKey, user?.id ?? null))
  const [dragId, setDragId] = useState<number | null>(null)

  const monthValue = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = `${year}년 ${month}월`
  const cells = buildCalendarCells(year, month)

  const canEditRow = useCallback(
    (row: WorkLogRow) => canViewAll || row.userId === user?.id,
    [canViewAll, user?.id],
  )

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const q = new URLSearchParams({ year: String(year), month: String(month) })
      if (filterUserId) q.set('userId', String(filterUserId))
      const res = await apiJson<{
        ok: boolean
        items: WorkLogRow[]
        canViewAll: boolean
        users: WorkLogUserOption[]
      }>(`/api/erp-work-logs?${q}`)
      setItems(res.items)
      setCanViewAll(res.canViewAll)
      setUserOptions(res.users)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, year, month, filterUserId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

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

  const openKanban = (highlightId?: number) => {
    setHighlightLogId(highlightId ?? null)
    setKanbanModalOpen(true)
  }

  const closeKanban = () => {
    setKanbanModalOpen(false)
    setDragId(null)
    setHighlightLogId(null)
  }

  const openCreate = (dateKey = selectedDate) => {
    setEditId(null)
    setForm(emptyForm(dateKey, canViewAll ? (filterUserId || user?.id || null) : (user?.id ?? null)))
    setFormModalOpen(true)
  }

  const openEdit = (row: WorkLogRow) => {
    if (!canEditRow(row)) return
    setEditId(row.id)
    setForm(formFromRow(row))
    setHighlightLogId(row.id)
    setFormModalOpen(true)
  }

  const closeFormModal = () => {
    setFormModalOpen(false)
    setEditId(null)
  }

  const saveLog = async () => {
    if (!form.title.trim()) {
      setErr('제목을 입력하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        workDate: form.workDate,
        workTime: form.workTime,
        title: form.title.trim(),
        content: form.content.trim() || null,
        category: form.category.trim() || null,
        status: form.status,
        userId: canViewAll && form.userId ? form.userId : undefined,
      }
      if (editId) {
        await apiJson(`/api/erp-work-logs/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiJson('/api/erp-work-logs', { method: 'POST', body: JSON.stringify(body) })
      }
      setFormModalOpen(false)
      setEditId(null)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const deleteLog = async () => {
    if (!editId) return
    if (!window.confirm('이 일정을 삭제할까요?')) return
    setSaving(true)
    try {
      await apiJson(`/api/erp-work-logs/${editId}`, { method: 'DELETE' })
      setFormModalOpen(false)
      setEditId(null)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const moveStatus = async (id: number, status: WorkLogStatus) => {
    const row = items.find((it) => it.id === id)
    if (!row || !canEditRow(row)) return
    try {
      await apiJson(`/api/erp-work-logs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const itemsByStatus = useMemo(() => {
    const map: Record<WorkLogStatus, WorkLogRow[]> = {
      PLANNED: [],
      IN_PROGRESS: [],
      DONE: [],
      HOLD: [],
    }
    for (const row of items) map[row.status].push(row)
    return map
  }, [items])

  const listRows = useMemo(() => sortListRows(items), [items])

  if (!user) {
    return (
      <div className="mesPage mesPageWide mesWlPage">
        <div className="mesWlLoginNotice">
          일정관리는 로그인 후 이용할 수 있습니다.
          <br />
          <Link to="/login" className="mesWlBtn mesWlBtn--green" style={{ marginTop: 14, display: 'inline-flex' }}>
            로그인
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPage mesPageWide mesWlPage">
      <header className="mesWlTopBar">
        <div>
          <h1 className="mesWlTopTitle">일정관리</h1>
          <p className="mesWlTopSub">
            업무 일정 · {user.userName} · {user.roleName}
            {canViewAll ? ' · 전체 조회' : ' · 본인 일정'}
          </p>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError" role="alert" style={{ marginBottom: 14 }}>
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">×</button>
        </div>
      ) : null}

      <div className="mesWlToolbar">
        <div className="mesWlToolbarLeft">
          <button type="button" className="mesWlIconBtn" onClick={() => shiftMonth(-1)} aria-label="이전 달">‹</button>
          <strong className="mesWlMonthLabel">{monthLabel}</strong>
          <button type="button" className="mesWlIconBtn" onClick={() => shiftMonth(1)} aria-label="다음 달">›</button>
          <input
            type="month"
            className="mesWlMonthInput"
            value={monthValue}
            onChange={(e) => onMonthPick(e.target.value)}
            aria-label="월 선택"
          />
          {canViewAll ? (
            <select
              className="mesWlMonthInput"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value ? Number(e.target.value) : '')}
              aria-label="직원 필터"
            >
              <option value="">전체 직원</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.userName}</option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="mesWlToolbarRight">
          <span className="mesWlToolbarMeta">{loading ? '로딩 중…' : `이번 달 ${items.length}건`}</span>
          <button type="button" className="mesWlBtn mesWlBtn--ghost" onClick={() => openKanban()}>
            진행 보드
          </button>
          <button type="button" className="mesWlBtn mesWlBtn--green" onClick={() => openCreate()}>
            + 일정 추가
          </button>
        </div>
      </div>

      <div className="mesWlSplitLayout mesWlSplitLayout--3to1">
        <section className="mesWlCalendarCard mesWlSplitCalendar">
          <div className="mesWlCalendarSideHead">
            <h2>{monthLabel}</h2>
            <span>{items.length}건 · {selectedDate.replace(/-/g, '.')} 선택</span>
          </div>
          <div className="mesWlCalGrid" role="grid" aria-label="일정 캘린더">
          {DOW.map((d, i) => (
            <div
              key={d}
              className={`mesWlCalDow${i === 0 ? ' mesWlCalDow--sun' : ''}${i === 6 ? ' mesWlCalDow--sat' : ''}`}
              role="columnheader"
            >
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day == null) {
              return <div key={`e-${i}`} className="mesWlCalCell mesWlCalCell--empty" aria-hidden />
            }
            const calMeta = getCalendarDayMeta(year, month, day)
            const key = calMeta.ymd
            const dayItems = sortDayLogs(items.filter((it) => workLogOnDate(it, key)))
            const selected = key === selectedDate
            const isToday = key === todayKey
            const dayClass = calMeta.isHoliday
              ? ' mesWlCalCell--holiday'
              : calMeta.isSunday
                ? ' mesWlCalCell--sun'
                : calMeta.isSaturday
                  ? ' mesWlCalCell--sat'
                  : ''
            return (
              <button
                key={key}
                type="button"
                className={`mesWlCalCell${dayClass}${selected ? ' mesWlCalCell--selected' : ''}${isToday ? ' mesWlCalCell--today' : ''}`}
                onClick={() => setSelectedDate(key)}
                onDoubleClick={() => openCreate(key)}
              >
                <div className="mesWlCalDayNum">{day}</div>
                {calMeta.holidayName ? (
                  <span className="mesWlCalHoliday" title={calMeta.holidayName}>{calMeta.holidayName}</span>
                ) : null}
                <div className="mesWlCalBadges">
                  {dayItems.slice(0, 4).map((it) => (
                    <span
                      key={it.id}
                      className="mesWlCalBadge"
                      style={{ backgroundColor: `${cardColor(it)}20`, color: cardColor(it), borderColor: `${cardColor(it)}44` }}
                      title={fmtCalBadge(it)}
                    >
                      {it.workTime ? (
                        <em className="mesWlCalBadgeTime">{it.workTime}</em>
                      ) : null}
                      <span>{it.title}</span>
                    </span>
                  ))}
                  {dayItems.length > 4 ? (
                    <span className="mesWlCalMore">+{dayItems.length - 4}</span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
          <button type="button" className="mesWlCalendarSideAdd" onClick={() => openCreate(selectedDate)}>
            + {selectedDate.replace(/-/g, '.')} 일정 추가
          </button>
        </section>

        <section className="mesWlListCard mesWlListCard--side">
          <div className="mesWlListHead">
            <h2>일정 목록</h2>
            <p>{selectedDate.replace(/-/g, '.')} · {listRows.filter((r) => r.workDate === selectedDate).length}건</p>
          </div>
          {loading ? (
            <p className="mesWlListEmpty">불러오는 중…</p>
          ) : listRows.length === 0 ? (
            <p className="mesWlListEmpty">이번 달 일정이 없습니다.</p>
          ) : (
            <div className="mesWlSideListBody">
              {listRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`mesWlSideListItem${row.workDate === selectedDate ? ' mesWlSideListItem--selected' : ''}`}
                  onClick={() => openKanban(row.id)}
                  style={{ borderLeftColor: cardColor(row) }}
                >
                  <div className="mesWlCardTop">
                    {row.category ? (
                      <span className="mesWlCardLabel mesWlCardLabel--cat">{row.category}</span>
                    ) : null}
                    <span className={`mesWlCardLabel mesWlCardLabel--${row.status.toLowerCase()}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    <strong className="mesWlCardTitle">{row.title}</strong>
                  </div>
                  <p className="mesWlCardMeta">
                    <span className="mesWlCardMetaDate">{fmtWorkLogDateTime(row)}</span>
                    <span className="mesWlCardMetaSep" aria-hidden>·</span>
                    <span className="mesWlCardMetaName">{row.userName}</span>
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {kanbanModalOpen ? (
        <div className="mesWlModalRoot" role="presentation">
          <button
            type="button"
            className="mesModalBackdrop"
            aria-label="닫기"
            onClick={closeKanban}
          />
          <div className="mesWlModal mesWlModal--wide" role="dialog" aria-modal="true" aria-label="진행 보드">
            <header className="mesWlModalHead">
              <div>
                <h2>진행 보드</h2>
                <p className="mesWlModalSub">
                  카드를 클릭해 수정 · 드래그로 상태 변경 · {monthLabel}
                </p>
              </div>
              <button
                type="button"
                className="mesWlIconBtn"
                onClick={closeKanban}
                aria-label="닫기"
              >
                ×
              </button>
            </header>
            <div className="mesWlModalBody mesWlModalBody--kanban">
              <KanbanBoard
                itemsByStatus={itemsByStatus}
                canEditRow={canEditRow}
                highlightLogId={highlightLogId}
                dragId={dragId}
                setDragId={setDragId}
                onMoveStatus={(id, status) => void moveStatus(id, status)}
                onCardClick={(row) => openEdit(row)}
              />
            </div>
            <footer className="mesWlModalFoot">
              <span className="mesWlModalFootHint">본인 일정 또는 관리자만 드래그·수정 가능</span>
              <button type="button" className="mesWlBtn mesWlBtn--ghost" onClick={closeKanban}>
                닫기
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {formModalOpen ? (
        <div className={`mesWlModalRoot${kanbanModalOpen ? ' mesWlModalRoot--stack' : ''}`} role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeFormModal} />
          <div className="mesWlModal" role="dialog" aria-modal="true">
            <header className="mesWlModalHead">
              <h2>{editId ? '일정 수정' : '일정 추가'}</h2>
              <button type="button" className="mesWlIconBtn" onClick={closeFormModal} aria-label="닫기">×</button>
            </header>
            <div className="mesWlModalBody">
              {canViewAll && !editId ? (
                <label className="mesWlField">
                  <span>작성자</span>
                  <select
                    className="mesWlInput"
                    value={form.userId ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, userId: Number(e.target.value) }))}
                  >
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>{u.userName}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="mesWlFieldRow">
                <label className="mesWlField">
                  <span>일자</span>
                  <input
                    type="date"
                    className="mesWlInput"
                    value={form.workDate}
                    onChange={(e) => setForm((f) => ({ ...f, workDate: e.target.value }))}
                  />
                </label>
                <label className="mesWlField">
                  <span>시간</span>
                  <input
                    type="time"
                    className="mesWlInput"
                    value={form.workTime}
                    onChange={(e) => setForm((f) => ({ ...f, workTime: e.target.value }))}
                  />
                </label>
              </div>

              <label className="mesWlField">
                <span>제목</span>
                <input
                  className="mesWlInput"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="업무 제목"
                />
              </label>

              <div className="mesWlFieldRow">
                <label className="mesWlField">
                  <span>분류</span>
                  <select className="mesWlInput" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORY_PRESETS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="mesWlField">
                  <span>상태</span>
                  <select className="mesWlInput" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as WorkLogStatus }))}>
                    {KANBAN_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
              </div>

              <label className="mesWlField">
                <span>내용</span>
                <textarea
                  className="mesWlInput"
                  rows={6}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="세부 내용, 특이사항, 진행 결과 등"
                />
              </label>

              {!kanbanModalOpen ? (
                <div className="mesWlFormKanbanLink">
                  <button
                    type="button"
                    className="mesWlBtn mesWlBtn--ghost mesWlBtn--block"
                    onClick={() => { closeFormModal(); openKanban() }}
                  >
                    진행 보드 열기 (드래그로 상태 변경)
                  </button>
                </div>
              ) : null}
            </div>
            <footer className="mesWlModalFoot">
              {editId ? (
                <button type="button" className="mesWlBtn mesWlBtn--danger" disabled={saving} onClick={() => void deleteLog()}>
                  삭제
                </button>
              ) : <span />}
              <div className="mesWlModalFootActions">
                <button type="button" className="mesWlBtn mesWlBtn--ghost" onClick={closeFormModal}>취소</button>
                <button type="button" className="mesWlBtn mesWlBtn--green" disabled={saving} onClick={() => void saveLog()}>
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
