import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type OutRow = {
  id: number
  outsourcingNo: string
  productionLotId: number
  processId: number
  vendorName: string
  requestQty: number
  status: string
  productionLot?: { lotNo: string }
  process?: { processCode: string; processName: string }
  results?: { id: number; goodQty: number; defectQty: number; inDate: string | null }[]
}

type LotOpt = { id: number; lotNo: string; productId: number }
type ProcessOpt = { id: number; processCode: string; processName: string; sequence: number }

const statuses = ['REQUEST', 'OUT', 'IN', 'DONE'] as const

type ReqForm = {
  outsourcingNo: string
  productionLotId: string
  processId: string
  vendorName: string
  requestQty: string
  status: (typeof statuses)[number]
}

const emptyReqForm = (): ReqForm => ({
  outsourcingNo: '',
  productionLotId: '',
  processId: '',
  vendorName: '',
  requestQty: '1',
  status: 'REQUEST',
})

export function OutsourcingPage() {
  const [items, setItems] = useState<OutRow[]>([])
  const [lots, setLots] = useState<LotOpt[]>([])
  const [processes, setProcesses] = useState<ProcessOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selId, setSelId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const [reqOpen, setReqOpen] = useState(false)
  const [reqEditingId, setReqEditingId] = useState<number | null>(null)
  const [reqForm, setReqForm] = useState<ReqForm>(emptyReqForm())

  const [resOpen, setResOpen] = useState(false)
  const [goodQty, setGoodQty] = useState('0')
  const [defectQty, setDefectQty] = useState('0')
  const [inDate, setInDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: OutRow[] }>('/api/outsourcing')
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLots = useCallback(async () => {
    try {
      const data = await apiJson<{ ok?: boolean; items: LotOpt[] }>('/api/lots')
      setLots(data.items ?? [])
    } catch {
      setLots([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadLots()
  }, [loadLots])

  const closeReq = useCallback(() => {
    setReqOpen(false)
    setReqEditingId(null)
    setReqForm(emptyReqForm())
    setProcesses([])
  }, [])

  const closeRes = useCallback(() => {
    setResOpen(false)
    setGoodQty('0')
    setDefectQty('0')
    setInDate('')
  }, [])

  useEffect(() => {
    if (!reqOpen && !resOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (reqOpen) closeReq()
      if (resOpen) closeRes()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reqOpen, resOpen, closeReq, closeRes])

  const lidNum = Number(reqForm.productionLotId)
  const selectedLot = Number.isInteger(lidNum) && lidNum >= 1 ? lots.find((l) => l.id === lidNum) : undefined

  useEffect(() => {
    const lid = Number(reqForm.productionLotId)
    if (!Number.isInteger(lid) || lid < 1) {
      setProcesses([])
      return
    }
    const lot = lots.find((l) => l.id === lid)
    if (!lot) {
      setProcesses([])
      return
    }
    let cancelled = false
    void apiJson<{ ok?: boolean; items: ProcessOpt[] }>(`/api/processes?productId=${lot.productId}`)
      .then((data) => {
        if (!cancelled) setProcesses(data.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setProcesses([])
      })
    return () => {
      cancelled = true
    }
  }, [reqForm.productionLotId, lots])

  const openReqNew = () => {
    setReqEditingId(null)
    setReqForm(emptyReqForm())
    setReqOpen(true)
  }

  const openReqEdit = (r: OutRow) => {
    setReqEditingId(r.id)
    setReqForm({
      outsourcingNo: r.outsourcingNo,
      productionLotId: String(r.productionLotId),
      processId: String(r.processId),
      vendorName: r.vendorName,
      requestQty: String(r.requestQty),
      status: (statuses.includes(r.status as (typeof statuses)[number]) ? r.status : 'REQUEST') as (typeof statuses)[number],
    })
    setReqOpen(true)
  }

  const saveReq = async () => {
    setSaving(true)
    setErr(null)
    try {
      const lid = Number(reqForm.productionLotId)
      const pid = Number(reqForm.processId)
      const rq = Number(reqForm.requestQty)
      if (!Number.isFinite(lid) || !Number.isFinite(pid) || !Number.isFinite(rq) || !reqForm.outsourcingNo.trim() || !reqForm.vendorName.trim()) {
        setErr('필수 항목을 확인하세요.')
        setSaving(false)
        return
      }
      if (reqEditingId == null) {
        await apiJson('/api/outsourcing', {
          method: 'POST',
          body: JSON.stringify({
            outsourcingNo: reqForm.outsourcingNo.trim(),
            productionLotId: lid,
            processId: pid,
            vendorName: reqForm.vendorName.trim(),
            requestQty: rq,
            status: reqForm.status,
          }),
        })
      } else {
        await apiJson(`/api/outsourcing/${reqEditingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            outsourcingNo: reqForm.outsourcingNo.trim(),
            productionLotId: lid,
            processId: pid,
            vendorName: reqForm.vendorName.trim(),
            requestQty: rq,
            status: reqForm.status,
          }),
        })
      }
      await load()
      closeReq()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const openRes = () => {
    setGoodQty('0')
    setDefectQty('0')
    setInDate('')
    setResOpen(true)
  }

  const addResult = async () => {
    if (selId == null) {
      setErr('목록에서 외주 행을 선택하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const g = Number(goodQty)
      if (!Number.isFinite(g) || g < 0) {
        setErr('양품 수량을 확인하세요.')
        setSaving(false)
        return
      }
      await apiJson(`/api/outsourcing/${selId}/results`, {
        method: 'POST',
        body: JSON.stringify({
          goodQty: g,
          defectQty: Number(defectQty) || 0,
          inDate: inDate || null,
        }),
      })
      await load()
      closeRes()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/outsourcing/${id}`, { method: 'DELETE' })
      await load()
      if (selId === id) setSelId(null)
      if (reqEditingId === id) closeReq()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const reqModalTitle = reqEditingId == null ? '신규 등록' : '수정'

  return (
    <div className="mesPage">
      <header className="mesPageHeadRow">
        <div>
          <h1 className="mesPageTitle">외주</h1>
          <p className="mesPageDesc">생산 LOT·공정 단위 외주 요청과 입고 실적(간단)을 등록합니다.</p>
        </div>
      </header>
      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesCrudMain">
        <div className="mesToolbar mesToolbarWrap">
          <button type="button" className="mesBtnPrimary" onClick={openReqNew}>
            새 외주
          </button>
          <button type="button" className="mesBtnSecondary" onClick={openRes}>
            입고 실적
          </button>
          <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>

        <div className="mesTableViewport">
          <table className="mesTable mesTableSticky">
            <thead>
              <tr>
                <th>외주번호</th>
                <th>LOT</th>
                <th>공정</th>
                <th>협력사</th>
                <th>수량·상태</th>
                <th>실적</th>
                <th className="mesThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="muted">
                    로딩 중…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id} className={selId === r.id ? 'mesRowSelected' : undefined}>
                    <td className="mono">
                      <button type="button" className="mesBtnSm" onClick={() => setSelId(r.id)}>
                        {r.outsourcingNo}
                      </button>
                    </td>
                    <td>{r.productionLot?.lotNo ?? r.productionLotId}</td>
                    <td>{r.process ? r.process.processCode : r.processId}</td>
                    <td>{r.vendorName}</td>
                    <td>
                      {r.requestQty} / {r.status}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {r.results?.length
                        ? r.results.map((x) => (
                            <div key={x.id}>
                              양{x.goodQty} 불량{x.defectQty}
                            </div>
                          ))
                        : '—'}
                    </td>
                    <td className="mesTdActions">
                      <button type="button" className="mesBtnSm" onClick={() => openReqEdit(r)}>
                        수정
                      </button>
                      <button type="button" className="mesBtnSm mesBtnDanger" onClick={() => void remove(r.id)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selId != null ? (
        <p className="muted" style={{ marginTop: 8 }}>
          선택됨 (입고 실적 대상): ID {selId}
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>
          입고 실적 등록 전 목록에서 외주번호를 눌러 선택하세요.
        </p>
      )}

      {reqOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeReq} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-out-req-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-out-req-title">
                  외주 요청 · {reqModalTitle}
                </h2>
                {reqEditingId != null ? <div className="mesModalMeta muted">ID {reqEditingId}</div> : null}
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  외주번호
                  <input
                    className="mesInput mono"
                    value={reqForm.outsourcingNo}
                    onChange={(ev) => setReqForm((f) => ({ ...f, outsourcingNo: ev.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  생산 LOT
                  <select
                    className="mesInput"
                    value={reqForm.productionLotId}
                    onChange={(ev) => setReqForm((f) => ({ ...f, productionLotId: ev.target.value, processId: '' }))}
                  >
                    <option value="">선택</option>
                    {lots.map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.lotNo} (품목 #{l.productId})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mesLabel">
                  공정
                  <select
                    className="mesInput"
                    value={reqForm.processId}
                    onChange={(ev) => setReqForm((f) => ({ ...f, processId: ev.target.value }))}
                    disabled={!selectedLot}
                  >
                    <option value="">{selectedLot ? '선택' : 'LOT을 먼저 선택'}</option>
                    {processes.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.sequence}. {p.processCode} — {p.processName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  협력사
                  <input className="mesInput" value={reqForm.vendorName} onChange={(ev) => setReqForm((f) => ({ ...f, vendorName: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  의뢰수량
                  <input className="mesInput" value={reqForm.requestQty} onChange={(ev) => setReqForm((f) => ({ ...f, requestQty: ev.target.value }))} />
                </label>
                <label className="mesLabel">
                  상태
                  <select
                    className="mesInput"
                    value={reqForm.status}
                    onChange={(ev) => setReqForm((f) => ({ ...f, status: ev.target.value as (typeof statuses)[number] }))}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeReq}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void saveReq()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeRes} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-out-res-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-out-res-title">
                  입고 실적
                </h2>
                <div className="mesModalMeta muted">선택 외주 ID: {selId ?? '—'}</div>
              </div>
            </div>
            <div className="mesModalBody">
              {selId == null ? <p className="muted">목록에서 외주번호를 먼저 선택하세요.</p> : null}
              <div className="mesFieldRow mesFieldRow3">
                <label className="mesLabel">
                  양품
                  <input className="mesInput" value={goodQty} onChange={(ev) => setGoodQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  불량
                  <input className="mesInput" value={defectQty} onChange={(ev) => setDefectQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  입고일
                  <input className="mesInput" type="date" value={inDate} onChange={(ev) => setInDate(ev.target.value)} />
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeRes}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving || selId == null} onClick={() => void addResult()}>
                {saving ? '저장 중…' : '실적 추가'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
