import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  WorkerInputI18nProvider,
  WorkerInputLanguageBar,
  useWorkerInputI18n,
} from '../i18n/WorkerInputI18n'
import { ApiError, apiJson } from '../lib/api'
import { getStoredUser, isGuestRole, setStoredUser, type MesAuthUser } from '../lib/auth'
import './worker-input.css'

type LotRow = {
  id: number
  lotNo: string
  productId: number
  workCenterId: number | null
  currentProcessId: number | null
  lotQty: number
  goodQty: number
  defectQty: number
  status: string
  product?: { productCode: string; productName: string }
  workCenter?: { centerCode: string; centerName: string } | null
  workOrder?: {
    woNo: string
    orderQty: number
    status?: string
    holdReason?: string | null
    plan?: { planNo: string }
    assignedWorkers?: { worker: { id: number; workerCode: string; workerName: string } }[]
    assignedProcessWorkers?: {
      processId: number
      workerId: number
      worker?: { id: number; workerCode: string; workerName: string }
      process?: { id: number; processCode: string; processName: string; sequence: number }
    }[]
  }
}

type ProcessRow = { id: number; processCode: string; processName: string; sequence: number }

type DefectTypeRow = {
  id: number
  defectCode: string
  defectName: string
  severity: string | null
  useYn: 'Y' | 'N'
}

type DefectLine = { typeId: number; qty: number }

function formatApiErr(e: unknown): string {
  if (e instanceof ApiError) {
    const b = e.body as Record<string, unknown> | undefined
    const msg = (b?.message as string | undefined) ?? e.message
    return msg
  }
  return e instanceof Error ? e.message : 'unknown error'
}

function QtyStepper({
  label,
  value,
  onChange,
  tone,
  decreaseAria,
  increaseAria,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  tone?: 'good' | 'defect'
  decreaseAria: string
  increaseAria: string
}) {
  const cls = tone ? `wi__qtyInput wi__qtyInput--${tone}` : 'wi__qtyInput'
  return (
    <div className="wi__qtyBlock">
      <div className="wi__qtyLabel">{label}</div>
      <div className="wi__qtyControl">
        <button type="button" className="wi__qtyBtn" aria-label={decreaseAria} onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <input
          className={cls}
          inputMode="numeric"
          value={value}
          onChange={(ev) => {
            const n = Number(ev.target.value.replace(/\D/g, ''))
            onChange(Number.isFinite(n) ? n : 0)
          }}
        />
        <button type="button" className="wi__qtyBtn" aria-label={increaseAria} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  )
}

function WorkerInputPageInner() {
  const navigate = useNavigate()
  const { t, steps } = useWorkerInputI18n()
  const authUser = getStoredUser()
  const guestUser = isGuestRole(authUser?.roleName) ? authUser : null
  const [step, setStep] = useState(0)
  const [lots, setLots] = useState<LotRow[]>([])
  const [autoProcessId, setAutoProcessId] = useState<number | null>(null)
  const [defectTypes, setDefectTypes] = useState<DefectTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null)
  const [inputQty, setInputQty] = useState(0)
  const [goodQty, setGoodQty] = useState(0)
  const [defectQty, setDefectQty] = useState(0)
  const [defectLines, setDefectLines] = useState<DefectLine[]>([])

  const workersLabel = useCallback(
    (lot: LotRow) => {
      const list = lot.workOrder?.assignedWorkers ?? []
      if (list.length === 0) return t('noAssignment')
      return list.map((a) => a.worker.workerName).join(', ')
    },
    [t],
  )

  const lineLabel = useCallback(
    (lot: LotRow) => {
      if (lot.workCenter) return lot.workCenter.centerName
      return t('lineUnassigned')
    },
    [t],
  )

  const selectedLot = useMemo(() => lots.find((l) => l.id === selectedLotId) ?? null, [lots, selectedLotId])

  const assignableWorkersOnLot = useMemo(() => {
    const rows = selectedLot?.workOrder?.assignedProcessWorkers ?? []
    const map = new Map<number, { id: number; workerCode: string; workerName: string }>()
    for (const r of rows) {
      if (r.worker) map.set(r.worker.id, r.worker)
      else map.set(r.workerId, { id: r.workerId, workerCode: String(r.workerId), workerName: t('workerHash', { id: r.workerId }) })
    }
    return [...map.values()].sort((a, b) => a.workerCode.localeCompare(b.workerCode, 'ko'))
  }, [selectedLot, t])

  const activeLots = useMemo(
    () => lots.filter((l) => l.status === 'IN_PROGRESS' && l.workOrder?.status !== 'HOLD'),
    [lots],
  )

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeLots
    return activeLots.filter((l) => {
      const hay = [l.lotNo, l.product?.productName, l.workOrder?.woNo, lineLabel(l), workersLabel(l)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activeLots, search, lineLabel, workersLabel])

  const remainingQty = selectedLot ? Math.max(0, selectedLot.lotQty - selectedLot.goodQty - selectedLot.defectQty) : 0

  const woProcessAssignments = useMemo(
    () =>
      [...(selectedLot?.workOrder?.assignedProcessWorkers ?? [])].sort(
        (a, b) => (a.process?.sequence ?? 0) - (b.process?.sequence ?? 0),
      ),
    [selectedLot],
  )

  const hasWoAssignments = woProcessAssignments.length > 0

  const assignmentSummaryLabel = useMemo(() => {
    if (!hasWoAssignments) return null
    const names = [...new Set(woProcessAssignments.map((a) => a.worker?.workerName ?? t('workerHash', { id: a.workerId })))]
    return t('assignSummary', {
      workers: names.length,
      processes: woProcessAssignments.length,
      names: names.join(', '),
    })
  }, [hasWoAssignments, woProcessAssignments, t])

  const defectLineSum = useMemo(() => defectLines.reduce((s, d) => s + d.qty, 0), [defectLines])

  const loadLots = useCallback(async () => {
    const data = await apiJson<{ ok: boolean; items: LotRow[] }>('/api/lots')
    setLots(data.items ?? [])
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setErr(null)
      try {
        const lt = await apiJson<{ ok: boolean; items: LotRow[] }>('/api/lots')
        setLots(lt.items ?? [])
      } catch (e) {
        setErr(formatApiErr(e))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  useEffect(() => {
    if (!selectedLot) {
      setAutoProcessId(null)
      setDefectTypes([])
      return
    }
    const run = async () => {
      try {
        const [proc, dt] = await Promise.all([
          apiJson<{ ok?: boolean; items?: ProcessRow[] }>(`/api/processes?productId=${selectedLot.productId}`),
          apiJson<{ ok: boolean; items: DefectTypeRow[] }>(`/api/defect-types?productId=${selectedLot.productId}`),
        ])
        const processList = proc.items ?? []
        if (woProcessAssignments.length > 0) {
          setAutoProcessId(woProcessAssignments[0]!.processId)
        } else {
          const lastProcess = [...processList].sort((a, b) => b.sequence - a.sequence)[0]
          setAutoProcessId(selectedLot.currentProcessId ?? lastProcess?.id ?? null)
        }
        setDefectTypes((dt.items ?? []).filter((d) => d.useYn === 'Y'))
      } catch {
        setAutoProcessId(null)
        setDefectTypes([])
      }
    }
    void run()
  }, [selectedLot, woProcessAssignments])

  useEffect(() => {
    if (defectQty <= 0) {
      setDefectLines([])
      return
    }
    setDefectLines((prev) => {
      const sum = prev.reduce((s, d) => s + d.qty, 0)
      if (prev.length > 0 && sum === defectQty) return prev
      const firstId = defectTypes[0]?.id
      return firstId != null ? [{ typeId: firstId, qty: defectQty }] : []
    })
  }, [defectQty, defectTypes])

  const resetAll = () => {
    setStep(0)
    setSearch('')
    setSelectedLotId(null)
    setAutoProcessId(null)
    setInputQty(0)
    setGoodQty(0)
    setDefectQty(0)
    setDefectLines([])
    setErr(null)
    setSuccess(false)
  }

  const logoutGuest = async () => {
    if (!guestUser) return
    try {
      await apiJson('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ loginId: guestUser.loginId }),
      })
    } catch {
      /* ignore */
    }
    setStoredUser(null)
    navigate('/login', { replace: true })
  }

  const fillRemaining = () => {
    if (!selectedLot || remainingQty <= 0) return
    setInputQty(remainingQty)
    setGoodQty(remainingQty)
    setDefectQty(0)
  }

  const validateStep = useCallback(
    (s: number): string | null => {
      if (s === 0) {
        if (!selectedLotId) return t('errSelectLot')
        if (selectedLot?.workOrder?.status === 'HOLD') return t('errHold')
        if (!hasWoAssignments && assignableWorkersOnLot.length === 0) return t('errNoWorkerAssign')
        return null
      }
      if (s === 1) {
        if (!hasWoAssignments) return t('errNoWorkerAssign')
        if (autoProcessId == null) return t('errNoProcess')
        if (inputQty <= 0) return t('errInputQty')
        if (goodQty + defectQty > inputQty) return t('errQtyOver')
        if (goodQty + defectQty <= 0) return t('errQtyZero')
        return null
      }
      if (s === 2) {
        if (defectQty <= 0) return null
        if (defectTypes.length === 0) return t('errNoDefectTypeReg')
        if (defectLines.some((d) => d.qty > 0 && !d.typeId)) return t('errSelectDefectType')
        if (defectLineSum !== defectQty) return t('errDefectSum', { sum: defectLineSum, defect: defectQty })
        return null
      }
      return null
    },
    [
      assignableWorkersOnLot.length,
      autoProcessId,
      defectLineSum,
      defectLines,
      defectQty,
      defectTypes.length,
      goodQty,
      hasWoAssignments,
      inputQty,
      selectedLot?.workOrder?.status,
      selectedLotId,
      t,
    ],
  )

  const goNext = () => {
    const v = validateStep(step)
    if (v) {
      setErr(v)
      return
    }
    setErr(null)
    if (step === 1 && defectQty <= 0) {
      setStep(3)
      return
    }
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const goBack = () => {
    setErr(null)
    if (step === 3 && defectQty <= 0) {
      setStep(1)
      return
    }
    setStep((s) => Math.max(s - 1, 0))
  }

  const submit = async () => {
    const v = validateStep(1) ?? validateStep(2)
    if (v) {
      setErr(v)
      return
    }
    if (!selectedLotId || autoProcessId == null) return

    setSubmitting(true)
    setErr(null)
    try {
      const defects =
        defectQty > 0
          ? Array.from(
              defectLines
                .filter((d) => d.qty > 0)
                .reduce((map, d) => map.set(d.typeId, (map.get(d.typeId) ?? 0) + d.qty), new Map<number, number>()),
            ).map(([type_id, qty]) => ({ type_id, qty }))
          : undefined

      await apiJson('/api/process-results', {
        method: 'POST',
        body: JSON.stringify({
          lot_id: selectedLotId,
          process_id: autoProcessId,
          input_qty: inputQty,
          good_qty: goodQty,
          defect_qty: defectQty,
          work_center_id: selectedLot?.workCenterId ?? undefined,
          defects,
        }),
      })
      await loadLots()
      setSuccess(true)
    } catch (e) {
      setErr(formatApiErr(e))
    } finally {
      setSubmitting(false)
    }
  }

  const updateDefectLine = (index: number, patch: Partial<DefectLine>) => {
    setDefectLines((lines) => lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const addDefectLine = () => {
    const remain = Math.max(0, defectQty - defectLineSum)
    const used = new Set(defectLines.map((d) => d.typeId))
    const nextType = defectTypes.find((dt) => !used.has(dt.id))?.id ?? defectTypes[0]?.id ?? 0
    setDefectLines((lines) => [...lines, { typeId: nextType, qty: remain }])
  }

  const removeDefectLine = (index: number) => {
    setDefectLines((lines) => (lines.length <= 1 ? lines : lines.filter((_, i) => i !== index)))
  }

  const defectTypeLabel = (typeId: number) => {
    const dt = defectTypes.find((t) => t.id === typeId)
    if (!dt) return t('defectTypeHash', { id: typeId })
    return `${dt.defectName} (${dt.defectCode})`
  }

  const qtyDec = (label: string) => `${label} ${t('decrease')}`
  const qtyInc = (label: string) => `${label} ${t('increase')}`

  const headerBlock = (
    <>
      <p className="wi__brand">HANA-TECH MES</p>
      <h1 className="wi__title">{t('pageTitle')}</h1>
      <WorkerInputLanguageBar />
      {guestUser ? (
        <div className="wi__authBar">
          <span className="wi__authName">{guestUser.userName}</span>
          <button type="button" className="wi__btn wi__btn--ghost wi__btn--sm" onClick={() => void logoutGuest()}>
            {t('logout')}
          </button>
        </div>
      ) : null}
    </>
  )

  if (success) {
    return (
      <div className="wi">
        <header className="wi__header">{headerBlock}</header>
        <main className="wi__main">
          <div className="wi__success">
            <div className="wi__successIcon" aria-hidden>
              ✓
            </div>
            <h2 className="wi__successTitle">{t('savedTitle')}</h2>
            <p className="wi__successDesc">
              {t('savedDesc', {
                input: inputQty.toLocaleString(),
                good: goodQty.toLocaleString(),
                defect: defectQty.toLocaleString(),
              })}
              {defectQty > 0 ? t('savedDefectNote') : ''}
            </p>
            <button type="button" className="wi__btn wi__btn--primary" style={{ width: '100%', maxWidth: 320 }} onClick={resetAll}>
              {t('nextEntry')}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="wi">
      <header className="wi__header">
        {headerBlock}
        <div className="wi__steps" aria-hidden>
          {steps.map((_, i) => (
            <div key={i} className={`wi__step${i <= step ? ' wi__step--active' : ''}${i < step ? ' wi__step--done' : ''}`} />
          ))}
        </div>
      </header>

      <main className="wi__main">
        {err ? (
          <div className="wi__banner wi__banner--error" role="alert">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="wi__loading">{t('loading')}</div>
        ) : step === 0 ? (
          <>
            <h2 className="wi__sectionTitle">{t('selectLotTitle')}</h2>
            <input
              className="wi__search"
              type="search"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            />
            <div className="wi__lotList">
              {filteredLots.length === 0 ? (
                <div className="wi__empty">{t('noActiveLots')}</div>
              ) : (
                filteredLots.map((l) => {
                  const selected = selectedLotId === l.id
                  const productName = l.product?.productName ?? t('productHash', { id: l.productId })
                  const done = l.goodQty + l.defectQty
                  const total = l.lotQty
                  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className={`wi__lotCard${selected ? ' wi__lotCard--selected' : ''}`}
                      onClick={() => {
                        setSelectedLotId(l.id)
                        setErr(null)
                      }}
                    >
                      <div className="wi__lotCardHead">
                        <span className="wi__badge wi__badge--progress">{t('inProgress')}</span>
                        <span className="wi__lotTitle">{productName}</span>
                      </div>
                      <div className="wi__lotSub">
                        {lineLabel(l)}
                        <span className="wi__lotSubSep">·</span>
                        {workersLabel(l)}
                        <span className="wi__lotSubSep">·</span>
                        <span className="wi__lotSubNo">{l.lotNo}</span>
                      </div>
                      <div
                        className="wi__lotProgress"
                        aria-label={t('progressAria', { done, total, pct })}
                      >
                        <div className="wi__lotProgressFill" style={{ width: `${pct}%` }} />
                        <span className="wi__lotProgressText">
                          {done.toLocaleString()}/{total.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        ) : null}

        {step >= 1 && selectedLot ? (
          <div className="wi__infoCard">
            <div className="wi__infoRow">
              <span>{t('line')}</span>
              <span>{lineLabel(selectedLot)}</span>
            </div>
            <div className="wi__infoRow">
              <span>{t('worker')}</span>
              <span>{assignmentSummaryLabel ?? workersLabel(selectedLot)}</span>
            </div>
            <div className="wi__infoRow">
              <span>{t('lot')}</span>
              <span>{selectedLot.lotNo}</span>
            </div>
            <div className="wi__infoRow">
              <span>{t('product')}</span>
              <span>{selectedLot.product?.productName ?? `#${selectedLot.productId}`}</span>
            </div>
            <div className="wi__infoRow">
              <span>{t('remainingQty')}</span>
              <span>{remainingQty.toLocaleString()}</span>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="wi__sectionTitle">{t('qtyInputTitle')}</h2>
            {selectedLot?.workOrder?.status === 'HOLD' ? (
              <div className="wi__banner wi__banner--warn">
                {t('holdBanner')}
                {selectedLot.workOrder.holdReason ? t('holdReason', { reason: selectedLot.workOrder.holdReason }) : ''}
              </div>
            ) : null}

            {remainingQty > 0 ? (
              <button type="button" className="wi__btn wi__btn--ghost" style={{ width: '100%', marginBottom: 14 }} onClick={fillRemaining}>
                {t('fillRemaining', { qty: remainingQty.toLocaleString() })}
              </button>
            ) : null}

            <div className="wi__qtyGrid">
              <QtyStepper
                label={t('input')}
                value={inputQty}
                onChange={setInputQty}
                decreaseAria={qtyDec(t('input'))}
                increaseAria={qtyInc(t('input'))}
              />
              <QtyStepper
                label={t('good')}
                value={goodQty}
                onChange={setGoodQty}
                tone="good"
                decreaseAria={qtyDec(t('good'))}
                increaseAria={qtyInc(t('good'))}
              />
              <QtyStepper
                label={t('defect')}
                value={defectQty}
                onChange={setDefectQty}
                tone="defect"
                decreaseAria={qtyDec(t('defect'))}
                increaseAria={qtyInc(t('defect'))}
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="wi__sectionTitle">{t('defectDetailTitle')}</h2>
            <p className={`wi__hint${defectLineSum !== defectQty ? ' wi__hint--warn' : ''}`}>
              {t('defectTotal', { defect: defectQty.toLocaleString(), sum: defectLineSum.toLocaleString() })}
              {defectLineSum !== defectQty
                ? ` (${defectQty - defectLineSum > 0 ? t('defectShort', { n: defectQty - defectLineSum }) : t('defectOver', { n: defectLineSum - defectQty })})`
                : ' ✓'}
            </p>
            {defectTypes.length === 0 ? (
              <div className="wi__banner wi__banner--warn">{t('noDefectTypes')}</div>
            ) : (
              <div className="wi__defectList">
                {defectLines.map((line, idx) => (
                  <div key={idx} className="wi__defectRow">
                    <select
                      className="wi__defectSelect"
                      aria-label={t('defectTypeAria')}
                      value={line.typeId}
                      onChange={(ev) => updateDefectLine(idx, { typeId: Number(ev.target.value) })}
                    >
                      {defectTypes.map((dt) => (
                        <option key={dt.id} value={dt.id}>
                          {dt.defectName}
                          {dt.severity ? ` · ${dt.severity}` : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      className="wi__defectQty"
                      inputMode="numeric"
                      aria-label={t('defectQtyAria')}
                      value={line.qty}
                      onChange={(ev) => {
                        const n = Number(ev.target.value.replace(/\D/g, ''))
                        updateDefectLine(idx, { qty: Number.isFinite(n) ? n : 0 })
                      }}
                    />
                    {defectLines.length > 1 ? (
                      <button
                        type="button"
                        className="wi__defectRemove"
                        aria-label={t('removeRow')}
                        onClick={() => removeDefectLine(idx)}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
                {defectLines.length < defectTypes.length ? (
                  <button type="button" className="wi__defectAdd" onClick={addDefectLine}>
                    {t('addDefectType')}
                  </button>
                ) : null}
              </div>
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="wi__sectionTitle">{t('confirmTitle')}</h2>
            <div className="wi__summary">
              <div className="wi__summaryRow">
                <span>{t('line')}</span>
                <span>{selectedLot ? lineLabel(selectedLot) : '—'}</span>
              </div>
              <div className="wi__summaryRow">
                <span>{t('worker')}</span>
                <span>{selectedLot ? workersLabel(selectedLot) : '—'}</span>
              </div>
              <div className="wi__summaryRow">
                <span>{t('lot')}</span>
                <span>{selectedLot?.lotNo}</span>
              </div>
              <div className="wi__summaryRow">
                <span>{t('input')}</span>
                <span>{inputQty.toLocaleString()}</span>
              </div>
              <div className="wi__summaryRow">
                <span>{t('good')}</span>
                <span>{goodQty.toLocaleString()}</span>
              </div>
              <div className="wi__summaryRow">
                <span>{t('defect')}</span>
                <span>{defectQty.toLocaleString()}</span>
              </div>
              {defectQty > 0
                ? defectLines
                    .filter((d) => d.qty > 0)
                    .map((d, i) => (
                      <div key={`${d.typeId}-${i}`} className="wi__summaryRow">
                        <span>{defectTypeLabel(d.typeId)}</span>
                        <span>{d.qty.toLocaleString()}</span>
                      </div>
                    ))
                : null}
              <div className="wi__summaryRow wi__summaryRow--total">
                <span>{t('sumCheck')}</span>
                <span>{goodQty + defectQty <= inputQty ? t('ok') : t('error')}</span>
              </div>
            </div>
            <div className="wi__banner wi__banner--ok">{t('saveNote')}</div>
          </>
        ) : null}
      </main>

      <footer className="wi__footer">
        <div className="wi__footerInner">
          {step > 0 ? (
            <button type="button" className="wi__btn wi__btn--ghost" onClick={goBack} disabled={submitting}>
              {t('back')}
            </button>
          ) : null}
          {step < steps.length - 1 ? (
            <button type="button" className="wi__btn wi__btn--primary" onClick={goNext} disabled={loading}>
              {t('next')}
            </button>
          ) : (
            <button type="button" className="wi__btn wi__btn--primary" disabled={submitting} onClick={() => void submit()}>
              {submitting ? t('saving') : t('save')}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

export function WorkerInputPage() {
  return (
    <WorkerInputI18nProvider>
      <WorkerInputPageInner />
    </WorkerInputI18nProvider>
  )
}
