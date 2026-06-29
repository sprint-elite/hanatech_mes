import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { getStoredUser, type MesAuthUser } from '../../lib/auth'
import {
  CATEGORY_PRESETS,
  COLOR_PRESETS,
  KANBAN_COLUMNS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  buildCalendarCells,
  cardColor,
  emptyForm,
  fmtCalBadge,
  fmtPeriod,
  fmtTimeRange,
  fmtYmd,
  formFromRow,
  getKanbanAlertBadge,
  scheduleOnDate,
  sortDaySchedules,
  type ScheduleFormDraft,
  type ScheduleRow,
  type ScheduleStatus,
} from './scheduleTypes'
import { getCalendarDayMeta, getKrHolidayName } from './krHolidays'
import '../../erp-schedules-page.css'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function useLiveClock(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function SchedulesPage() {
  const [user] = useState<MesAuthUser | null>(() => getStoredUser())
  const liveNow = useLiveClock()
  const [year, setYear] = useState(liveNow.getFullYear())
  const [month, setMonth] = useState(liveNow.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(
    fmtYmd(liveNow.getFullYear(), liveNow.getMonth() + 1, liveNow.getDate()),
  )
  const [items, setItems] = useState<ScheduleRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<ScheduleFormDraft>(() => emptyForm(selectedDate))
  const [dragId, setDragId] = useState<number | null>(null)

  const monthValue = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = `${year}년 ${month}월`
  const cells = buildCalendarCells(year, month)

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiJson<{ ok: boolean; items: ScheduleRow[]; canManage: boolean }>(
        `/api/erp-schedules?year=${year}&month=${month}`,
      )
      setItems(res.items)
      setCanManage(res.canManage)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, year, month])

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

  const openCreate = (dateKey = selectedDate) => {
    setEditId(null)
    setForm(emptyForm(dateKey))
    setModalOpen(true)
  }

  const openEdit = (row: ScheduleRow) => {
    setEditId(row.id)
    setForm(formFromRow(row))
    setModalOpen(true)
  }

  const saveSchedule = async () => {
    if (!form.title.trim()) {
      setErr('제목을 입력하세요.')
      return
    }
    if (form.endDate < form.startDate) {
      setErr('종료일이 시작일보다 빠릅니다.')
      return
    }
    if (!form.allDay && form.startDate === form.endDate && form.endTime <= form.startTime) {
      setErr('같은 날짜면 종료 시간이 시작 시간보다 늦어야 합니다.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate,
        allDay: form.allDay,
        startTime: form.allDay ? null : form.startTime,
        endTime: form.allDay ? null : form.endTime,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee.trim() || null,
        color: form.color,
      }
      if (editId) {
        await apiJson(`/api/erp-schedules/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiJson('/api/erp-schedules', { method: 'POST', body: JSON.stringify(body) })
      }
      setModalOpen(false)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const deleteSchedule = async () => {
    if (!editId) return
    if (!window.confirm('이 일정을 삭제할까요?')) return
    setSaving(true)
    try {
      await apiJson(`/api/erp-schedules/${editId}`, { method: 'DELETE' })
      setModalOpen(false)
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const moveStatus = async (id: number, status: ScheduleStatus) => {
    try {
      await apiJson(`/api/erp-schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const itemsByStatus = useMemo(() => {
    const map: Record<ScheduleStatus, ScheduleRow[]> = {
      PLANNED: [],
      IN_PROGRESS: [],
      DONE: [],
      HOLD: [],
    }
    for (const row of items) map[row.status].push(row)
    return map
  }, [items])

  const selectedDayItems = useMemo(
    () => sortDaySchedules(items.filter((it) => scheduleOnDate(it, selectedDate))),
    [items, selectedDate],
  )
  const selectedHoliday = getKrHolidayName(selectedDate)

  if (!user) {
    return (
      <div className="mesPage mesPageWide mesSchPage">
        <div className="mesSchLoginNotice">
          일정관리는 로그인 후 이용할 수 있습니다.
          <br />
          <Link to="/login" className="mesSchBtn mesSchBtn--green" style={{ marginTop: 14, display: 'inline-flex' }}>
            로그인
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mesPage mesPageWide mesSchPage">
      <header className="mesSchTopBar">
        <div>
          <h1 className="mesSchTopTitle">일정관리</h1>
          <p className="mesSchTopSub">관리자 일정 조율 · {user.userName} · {user.roleName}</p>
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

      <div className="mesSchToolbar">
        <div className="mesSchToolbarLeft">
          <button type="button" className="mesSchIconBtn" onClick={() => shiftMonth(-1)} aria-label="이전 달">‹</button>
          <strong className="mesSchMonthLabel">{monthLabel}</strong>
          <button type="button" className="mesSchIconBtn" onClick={() => shiftMonth(1)} aria-label="다음 달">›</button>
          <input
            type="month"
            className="mesSchMonthInput"
            value={monthValue}
            onChange={(e) => onMonthPick(e.target.value)}
            aria-label="월 선택"
          />
        </div>
        <div className="mesSchToolbarRight">
          <span className="mesSchToolbarMeta">{loading ? '로딩 중…' : `이번 달 ${items.length}건`}</span>
          {canManage ? (
            <button type="button" className="mesSchBtn mesSchBtn--green" onClick={() => openCreate()}>
              + 일정 추가
            </button>
          ) : null}
        </div>
      </div>

      <section className="mesSchCalendarCard">
        <div className="mesSchCalendarBody">
          <div className="mesSchCalendarMain">
            <div className="mesSchCalGrid" role="grid" aria-label="일정 캘린더">
              {DOW.map((d, i) => (
                <div
                  key={d}
                  className={`mesSchCalDow${i === 0 ? ' mesSchCalDow--sun' : ''}${i === 6 ? ' mesSchCalDow--sat' : ''}`}
                  role="columnheader"
                >
                  {d}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day == null) {
                  return <div key={`e-${i}`} className="mesSchCalCell mesSchCalCell--empty" aria-hidden />
                }
                const calMeta = getCalendarDayMeta(year, month, day)
                const key = calMeta.ymd
                const dayItems = sortDaySchedules(items.filter((it) => scheduleOnDate(it, key)))
                const selected = key === selectedDate
                const isToday = key === fmtYmd(liveNow.getFullYear(), liveNow.getMonth() + 1, liveNow.getDate())
                const dayClass = calMeta.isHoliday
                  ? ' mesSchCalCell--holiday'
                  : calMeta.isSunday
                    ? ' mesSchCalCell--sun'
                    : calMeta.isSaturday
                      ? ' mesSchCalCell--sat'
                      : ''
                return (
                  <button
                    key={key}
                    type="button"
                    className={`mesSchCalCell${dayClass}${selected ? ' mesSchCalCell--selected' : ''}${isToday ? ' mesSchCalCell--today' : ''}`}
                    onClick={() => setSelectedDate(key)}
                    onDoubleClick={() => { if (canManage) openCreate(key) }}
                  >
                    <div className="mesSchCalDayNum">{day}</div>
                    {calMeta.holidayName ? (
                      <span className="mesSchCalHoliday" title={calMeta.holidayName}>{calMeta.holidayName}</span>
                    ) : null}
                    <div className="mesSchCalBadges">
                      {dayItems.slice(0, 4).map((it) => (
                        <span
                          key={it.id}
                          className="mesSchCalBadge"
                          style={{ backgroundColor: `${cardColor(it)}20`, color: cardColor(it), borderColor: `${cardColor(it)}44` }}
                          title={fmtCalBadge(it)}
                        >
                          {!it.allDay && it.startTime ? (
                            <em className="mesSchCalBadgeTime">{it.startTime}</em>
                          ) : (
                            <em className="mesSchCalBadgeTime">종일</em>
                          )}
                          <span>{it.title}</span>
                        </span>
                      ))}
                      {dayItems.length > 4 ? (
                        <span className="mesSchCalMore">+{dayItems.length - 4}</span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="mesSchAgenda">
            <div className="mesSchAgendaHead">
              <div>
                <h2>{selectedDate.replace(/-/g, '.')}</h2>
                {selectedHoliday ? (
                  <span className="mesSchAgendaHoliday">{selectedHoliday}</span>
                ) : null}
              </div>
              <span>{selectedDayItems.length}건</span>
            </div>
            {selectedDayItems.length === 0 ? (
              <p className="mesSchAgendaEmpty">선택한 날짜에 일정이 없습니다.</p>
            ) : (
              <div className="mesSchAgendaList">
                {selectedDayItems.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="mesSchAgendaItem"
                    onClick={() => (canManage ? openEdit(row) : undefined)}
                    style={{ borderLeftColor: cardColor(row) }}
                  >
                    <div className="mesSchAgendaTime">{fmtTimeRange(row)}</div>
                    <div className="mesSchAgendaMain">
                      <strong>{row.title}</strong>
                      <span className={`mesSchStatusChip mesSchStatusChip--${row.status.toLowerCase()}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </div>
                    {(row.category || row.assignee) ? (
                      <p className="mesSchAgendaSub">{[row.category, row.assignee].filter(Boolean).join(' · ')}</p>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            {canManage ? (
              <button type="button" className="mesSchAgendaAdd" onClick={() => openCreate(selectedDate)}>
                + 이 날짜에 일정 추가
              </button>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="mesSchKanbanCard">
        <div className="mesSchKanbanHead">
          <h2>진행 보드</h2>
          <p>카드를 드래그해 상태를 변경합니다.</p>
        </div>
        <div className="mesSchKanban">
          {KANBAN_COLUMNS.map((status) => (
            <div
              key={status}
              className={`mesSchKanbanCol mesSchKanbanCol--${status.toLowerCase()}`}
              onDragOver={(e) => { if (canManage) e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                if (!canManage || dragId == null) return
                void moveStatus(dragId, status)
                setDragId(null)
              }}
            >
              <div className="mesSchKanbanColHead">
                <span>{STATUS_LABEL[status]}</span>
                <em>{itemsByStatus[status].length}</em>
              </div>
              <div className="mesSchKanbanColBody">
                {itemsByStatus[status].map((row) => {
                  const alertBadge = getKanbanAlertBadge(row, liveNow)
                  return (
                  <article
                    key={row.id}
                    className={`mesSchCard${selectedDayItems.some((d) => d.id === row.id) ? ' mesSchCard--highlight' : ''}${alertBadge ? ' mesSchCard--alert' : ''}`}
                    draggable={canManage}
                    onDragStart={() => setDragId(row.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => (canManage ? openEdit(row) : undefined)}
                    style={{ borderLeftColor: cardColor(row) }}
                  >
                    {alertBadge ? (
                      <span className={`mesSchCardAlert mesSchCardAlert--${alertBadge === '지연' ? 'delay' : 'overdue'}`}>
                        {alertBadge}
                      </span>
                    ) : null}
                    <div className="mesSchCardTime">{fmtTimeRange(row)}</div>
                    <div className="mesSchCardHead">
                      <strong>{row.title}</strong>
                      <span className={`mesSchPriority mesSchPriority--${row.priority}`}>
                        {PRIORITY_LABEL[row.priority]}
                      </span>
                    </div>
                    <p className="mesSchCardMeta">{fmtPeriod(row)}</p>
                    {row.category || row.assignee ? (
                      <p className="mesSchCardSub">{[row.category, row.assignee].filter(Boolean).join(' · ')}</p>
                    ) : null}
                  </article>
                  )
                })}
                {itemsByStatus[status].length === 0 ? (
                  <p className="mesSchKanbanEmpty">일정 없음</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {modalOpen && canManage ? (
        <div className="mesSchModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={() => setModalOpen(false)} />
          <div className="mesSchModal" role="dialog" aria-modal="true">
            <header className="mesSchModalHead">
              <h2>{editId ? '일정 수정' : '일정 추가'}</h2>
              <button type="button" className="mesSchIconBtn" onClick={() => setModalOpen(false)} aria-label="닫기">×</button>
            </header>
            <div className="mesSchModalBody">
              <label className="mesSchField">
                <span>제목</span>
                <input className="mesSchInput" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </label>

              <div className="mesSchWhenBlock">
                <div className="mesSchWhenRow">
                  <span className="mesSchWhenLabel">시작</span>
                  <input
                    type="date"
                    className="mesSchInput"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
                  />
                  <input
                    type="time"
                    className="mesSchInput mesSchInput--time"
                    value={form.startTime}
                    disabled={form.allDay}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="mesSchWhenRow">
                  <span className="mesSchWhenLabel">종료</span>
                  <input
                    type="date"
                    className="mesSchInput"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                  <input
                    type="time"
                    className="mesSchInput mesSchInput--time"
                    value={form.endTime}
                    disabled={form.allDay}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
                <label className="mesSchCheck">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                  />
                  종일 일정 (시간 없음)
                </label>
              </div>

              <div className="mesSchFieldRow">
                <label className="mesSchField">
                  <span>분류</span>
                  <select className="mesSchInput" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORY_PRESETS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="mesSchField">
                  <span>상태</span>
                  <select className="mesSchInput" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ScheduleStatus }))}>
                    {KANBAN_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
              </div>
              <div className="mesSchFieldRow">
                <label className="mesSchField">
                  <span>우선순위</span>
                  <select className="mesSchInput" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ScheduleFormDraft['priority'] }))}>
                    {(['LOW', 'NORMAL', 'HIGH'] as const).map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                    ))}
                  </select>
                </label>
                <label className="mesSchField">
                  <span>담당</span>
                  <input className="mesSchInput" value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} placeholder="담당자" />
                </label>
              </div>
              <label className="mesSchField">
                <span>색상</span>
                <div className="mesSchColorPick">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`mesSchColorDot${form.color === c ? ' mesSchColorDot--on' : ''}`}
                      style={{ backgroundColor: c }}
                      aria-label={`색상 ${c}`}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                    />
                  ))}
                </div>
              </label>
              <label className="mesSchField">
                <span>메모</span>
                <textarea className="mesSchInput" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </label>
            </div>
            <footer className="mesSchModalFoot">
              {editId ? (
                <button type="button" className="mesSchBtn mesSchBtn--danger" disabled={saving} onClick={() => void deleteSchedule()}>
                  삭제
                </button>
              ) : <span />}
              <div className="mesSchModalFootActions">
                <button type="button" className="mesSchBtn mesSchBtn--ghost" onClick={() => setModalOpen(false)}>취소</button>
                <button type="button" className="mesSchBtn mesSchBtn--green" disabled={saving} onClick={() => void saveSchedule()}>
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
