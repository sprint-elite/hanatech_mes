import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiJson } from '../lib/api'
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

const STEPS = ['LOT 선택', '실적 입력', '불량 상세', '확인'] as const

function formatApiErr(e: unknown): string {
  if (e instanceof ApiError) {
    const b = e.body as Record<string, unknown> | undefined
    const msg = (b?.message as string | undefined) ?? e.message
    return msg
  }
  return e instanceof Error ? e.message : 'unknown error'
}

const workersLabel = (lot: LotRow) => {
  const list = lot.workOrder?.assignedWorkers ?? []
  if (list.length === 0) return '배정 없음'
  return list.map((a) => a.worker.workerName).join(', ')
}

const lineLabel = (lot: LotRow) => {
  if (lot.workCenter) return lot.workCenter.centerName
  return '라인 미지정'
}

function QtyStepper({
  label,
  value,
  onChange,
  tone,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  tone?: 'good' | 'defect'
}) {
  const cls = tone ? `wi__qtyInput wi__qtyInput--${tone}` : 'wi__qtyInput'
  return (
    <div className="wi__qtyBlock">
      <div className="wi__qtyLabel">{label}</div>
      <div className="wi__qtyControl">
        <button type="button" className="wi__qtyBtn" aria-label={`${label} 감소`} onClick={() => onChange(Math.max(0, value - 1))}>
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
        <button type="button" className="wi__qtyBtn" aria-label={`${label} 증가`} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  )
}

export function WorkerInputPage() {
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

  const selectedLot = useMemo(() => lots.find((l) => l.id === selectedLotId) ?? null, [lots, selectedLotId])

  const activeLots = useMemo(
    () =>
      lots.filter(
        (l) => l.status === 'IN_PROGRESS' && l.workOrder?.status !== 'HOLD',
      ),
    [lots],
  )

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeLots
    return activeLots.filter((l) => {
      const hay = [
        l.lotNo,
        l.product?.productName,
        l.workOrder?.woNo,
        lineLabel(l),
        workersLabel(l),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activeLots, search])

  const remainingQty = selectedLot ? Math.max(0, selectedLot.lotQty - selectedLot.goodQty - selectedLot.defectQty) : 0

  const resolvedWorkerId = useMemo(() => {
    const workers = selectedLot?.workOrder?.assignedWorkers ?? []
    return workers[0]?.worker.id ?? undefined
  }, [selectedLot])

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
        const lastProcess = [...processList].sort((a, b) => b.sequence - a.sequence)[0]
        setAutoProcessId(selectedLot.currentProcessId ?? lastProcess?.id ?? null)
        setDefectTypes((dt.items ?? []).filter((d) => d.useYn === 'Y'))
      } catch {
        setAutoProcessId(null)
        setDefectTypes([])
      }
    }
    void run()
  }, [selectedLot])

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

  const fillRemaining = () => {
    if (!selectedLot || remainingQty <= 0) return
    setInputQty(remainingQty)
    setGoodQty(remainingQty)
    setDefectQty(0)
  }

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!selectedLotId) return '생산 LOT를 선택하세요.'
      if (selectedLot?.workOrder?.status === 'HOLD') return '보류 중인 작업지시입니다. 보류 해제 후 입력하세요.'
      return null
    }
    if (s === 1) {
      if (autoProcessId == null) return '이 품목에 등록된 공정이 없습니다. 관리자에게 MBOM 공정 등록을 요청하세요.'
      if (inputQty <= 0) return '투입 수량을 입력하세요.'
      if (goodQty + defectQty > inputQty) return '양품 + 불량은 투입 수량 이하여야 합니다.'
      if (goodQty + defectQty <= 0) return '양품 또는 불량 수량을 입력하세요.'
      return null
    }
    if (s === 2) {
      if (defectQty <= 0) return null
      if (defectTypes.length === 0) return '등록된 불량유형이 없습니다. 관리자에게 불량유형 등록을 요청하세요.'
      if (defectLines.some((d) => d.qty > 0 && !d.typeId)) return '불량 유형을 선택하세요.'
      if (defectLineSum !== defectQty) return `유형별 합계(${defectLineSum})가 불량 수량(${defectQty})과 일치해야 합니다.`
      return null
    }
    return null
  }

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
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
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
          worker_id: resolvedWorkerId,
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
    if (!dt) return `유형 #${typeId}`
    return `${dt.defectName} (${dt.defectCode})`
  }

  if (success) {
    return (
      <div className="wi">
        <header className="wi__header">
          <p className="wi__brand">HANA-TECH MES</p>
          <h1 className="wi__title">현장 실적 입력</h1>
        </header>
        <main className="wi__main">
          <div className="wi__success">
            <div className="wi__successIcon" aria-hidden>
              ✓
            </div>
            <h2 className="wi__successTitle">실적이 저장되었습니다</h2>
            <p className="wi__successDesc">
              투입 {inputQty.toLocaleString()} · 양품 {goodQty.toLocaleString()} · 불량 {defectQty.toLocaleString()}
              {defectQty > 0 ? ' (불량 이력 반영)' : ''}
            </p>
            <button type="button" className="wi__btn wi__btn--primary" style={{ width: '100%', maxWidth: 320 }} onClick={resetAll}>
              다음 실적 등록
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="wi">
      <header className="wi__header">
        <p className="wi__brand">HANA-TECH MES</p>
        <h1 className="wi__title">현장 실적 입력</h1>
        <div className="wi__steps" aria-hidden>
          {STEPS.map((_, i) => (
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
          <div className="wi__loading">데이터 불러오는 중…</div>
        ) : step === 0 ? (
          <>
            <h2 className="wi__sectionTitle">생산 LOT 선택</h2>
            <input
              className="wi__search"
              type="search"
              placeholder="LOT / 품목 / 라인 / 작업자 검색"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            />
            <div className="wi__lotList">
              {filteredLots.length === 0 ? (
                <div className="wi__empty">진행 중인 LOT가 없습니다.</div>
              ) : (
                filteredLots.map((l) => {
                  const selected = selectedLotId === l.id
                  const productName = l.product?.productName ?? `품목 #${l.productId}`
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
                        <span className="wi__badge wi__badge--progress">진행</span>
                        <span className="wi__lotTitle">{productName}</span>
                      </div>
                      <div className="wi__lotSub">
                        {lineLabel(l)}
                        <span className="wi__lotSubSep">·</span>
                        {workersLabel(l)}
                        <span className="wi__lotSubSep">·</span>
                        <span className="wi__lotSubNo">{l.lotNo}</span>
                      </div>
                      <div className="wi__lotProgress" aria-label={`진행 ${done}/${total}, ${pct}%`}>
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
              <span>라인</span>
              <span>{lineLabel(selectedLot)}</span>
            </div>
            <div className="wi__infoRow">
              <span>작업자</span>
              <span>{workersLabel(selectedLot)}</span>
            </div>
            <div className="wi__infoRow">
              <span>LOT</span>
              <span>{selectedLot.lotNo}</span>
            </div>
            <div className="wi__infoRow">
              <span>품목</span>
              <span>{selectedLot.product?.productName ?? `#${selectedLot.productId}`}</span>
            </div>
            <div className="wi__infoRow">
              <span>잔여 수량</span>
              <span>{remainingQty.toLocaleString()}</span>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="wi__sectionTitle">실적 수량 입력</h2>
            {selectedLot?.workOrder?.status === 'HOLD' ? (
              <div className="wi__banner wi__banner--warn">
                이 LOT의 작업지시가 보류(HOLD) 상태입니다.
                {selectedLot.workOrder.holdReason ? ` 사유: ${selectedLot.workOrder.holdReason}` : ''}
              </div>
            ) : null}

            {remainingQty > 0 ? (
              <button type="button" className="wi__btn wi__btn--ghost" style={{ width: '100%', marginBottom: 14 }} onClick={fillRemaining}>
                잔여 수량 한 번에 입력 ({remainingQty.toLocaleString()})
              </button>
            ) : null}

            <div className="wi__qtyGrid">
              <QtyStepper label="투입" value={inputQty} onChange={setInputQty} />
              <QtyStepper label="양품" value={goodQty} onChange={setGoodQty} tone="good" />
              <QtyStepper label="불량" value={defectQty} onChange={setDefectQty} tone="defect" />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="wi__sectionTitle">불량 유형별 수량</h2>
            <p className={`wi__hint${defectLineSum !== defectQty ? ' wi__hint--warn' : ''}`}>
              불량 {defectQty.toLocaleString()}개 · 합계 {defectLineSum.toLocaleString()}
              {defectLineSum !== defectQty ? ` (${defectQty - defectLineSum > 0 ? `${defectQty - defectLineSum}개 부족` : `${defectLineSum - defectQty}개 초과`})` : ' ✓'}
            </p>
            {defectTypes.length === 0 ? (
              <div className="wi__banner wi__banner--warn">이 품목에 등록된 불량유형이 없습니다.</div>
            ) : (
              <div className="wi__defectList">
                {defectLines.map((line, idx) => (
                  <div key={idx} className="wi__defectRow">
                    <select
                      className="wi__defectSelect"
                      aria-label="불량 유형"
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
                      aria-label="불량 수량"
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
                        aria-label="행 삭제"
                        onClick={() => removeDefectLine(idx)}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
                {defectLines.length < defectTypes.length ? (
                  <button type="button" className="wi__defectAdd" onClick={addDefectLine}>
                    + 유형 추가
                  </button>
                ) : null}
              </div>
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="wi__sectionTitle">입력 내용 확인</h2>
            <div className="wi__summary">
              <div className="wi__summaryRow">
                <span>라인</span>
                <span>{selectedLot ? lineLabel(selectedLot) : '—'}</span>
              </div>
              <div className="wi__summaryRow">
                <span>작업자</span>
                <span>{selectedLot ? workersLabel(selectedLot) : '—'}</span>
              </div>
              <div className="wi__summaryRow">
                <span>LOT</span>
                <span>{selectedLot?.lotNo}</span>
              </div>
              <div className="wi__summaryRow">
                <span>투입</span>
                <span>{inputQty.toLocaleString()}</span>
              </div>
              <div className="wi__summaryRow">
                <span>양품</span>
                <span>{goodQty.toLocaleString()}</span>
              </div>
              <div className="wi__summaryRow">
                <span>불량</span>
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
                <span>합계 검증</span>
                <span>{goodQty + defectQty <= inputQty ? 'OK' : '오류'}</span>
              </div>
            </div>
            <div className="wi__banner wi__banner--ok">저장 시 LOT 실적·불량 이력·재고에 반영됩니다.</div>
          </>
        ) : null}
      </main>

      <footer className="wi__footer">
        <div className="wi__footerInner">
          {step > 0 ? (
            <button type="button" className="wi__btn wi__btn--ghost" onClick={goBack} disabled={submitting}>
              이전
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button type="button" className="wi__btn wi__btn--primary" onClick={goNext} disabled={loading}>
              다음
            </button>
          ) : (
            <button type="button" className="wi__btn wi__btn--primary" disabled={submitting} onClick={() => void submit()}>
              {submitting ? '저장 중…' : '실적 저장'}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
