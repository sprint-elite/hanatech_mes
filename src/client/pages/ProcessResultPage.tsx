import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiJson } from '../lib/api'

type Product = { id: number; productCode: string; productName: string }

type LotRow = {
  id: number
  lotNo: string
  productId: number
  lotQty: number
  goodQty: number
  defectQty: number
  status: string
}

type ProcessRow = { id: number; processCode: string; processName: string; sequence: number }

type ResultRow = {
  id: number
  productionLotId: number
  processId: number
  processSequence: number
  inputQty: number
  goodQty: number
  defectQty: number
  createdAt: string
  lot: { lotNo: string }
  process: { processCode: string; processName: string }
}

function formatApiErr(e: unknown): string {
  if (e instanceof ApiError) {
    const b = e.body as Record<string, unknown> | undefined
    const details = b?.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined
    if (details?.formErrors?.length) return `${e.message}: ${details.formErrors.join(', ')}`
    if (details?.fieldErrors && Object.keys(details.fieldErrors).length > 0) {
      const parts = Object.entries(details.fieldErrors).flatMap(([k, v]) => v.map((x) => `${k}: ${x}`))
      return `${e.message} — ${parts.slice(0, 4).join('; ')}`
    }
    return e.message
  }
  return e instanceof Error ? e.message : 'unknown error'
}

export function ProcessResultPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [lotsAll, setLotsAll] = useState<LotRow[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [recent, setRecent] = useState<ResultRow[]>([])
  const [productId, setProductId] = useState<number | ''>('')
  const [lotId, setLotId] = useState<number | ''>('')
  const [processId, setProcessId] = useState<number | ''>('')
  const [inputQty, setInputQty] = useState('')
  const [goodQty, setGoodQty] = useState('')
  const [defectQty, setDefectQty] = useState('')
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [loadingRecent, setLoadingRecent] = useState(true)

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true)
    try {
      const data = await apiJson<{ ok: boolean; items: ResultRow[] }>('/api/process-results')
      setRecent(data.items ?? [])
    } catch (e) {
      setRecent([])
      setLoadErr((prev) => prev ?? formatApiErr(e))
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoadingRefs(true)
      setLoadErr(null)
      try {
        const [prData, ltData] = await Promise.all([
          apiJson<{ ok?: boolean; items?: Product[] }>('/api/products'),
          apiJson<{ ok?: boolean; items?: LotRow[] }>('/api/lots'),
        ])
        if (!prData.ok) throw new Error('품목 조회 실패')
        if (!ltData.ok) throw new Error('LOT 조회 실패')
        setProducts(prData.items ?? [])
        setLotsAll(ltData.items ?? [])
      } catch (e) {
        setLoadErr(formatApiErr(e))
        setProducts([])
        setLotsAll([])
      } finally {
        setLoadingRefs(false)
      }
    }
    void run()
    void loadRecent()
  }, [loadRecent])

  const lotsForProduct = useMemo(() => {
    if (productId === '') return []
    return lotsAll.filter((l) => l.productId === productId)
  }, [lotsAll, productId])

  useEffect(() => {
    if (productId === '') {
      setProcesses([])
      setProcessId('')
      return
    }
    const run = async () => {
      try {
        const data = await apiJson<{ ok?: boolean; items?: ProcessRow[] }>(`/api/processes?productId=${productId}`)
        if (!data.ok) throw new Error('공정 조회 실패')
        setProcesses(data.items ?? [])
        setProcessId('')
      } catch {
        setProcesses([])
        setProcessId('')
      }
    }
    void run()
  }, [productId])

  useEffect(() => {
    if (lotId === '') return
    const lot = lotsAll.find((l) => l.id === lotId)
    if (lot && lot.productId !== productId) {
      setProductId(lot.productId)
    }
  }, [lotId, lotsAll, productId])

  const resetForm = () => {
    setProductId('')
    setLotId('')
    setProcessId('')
    setInputQty('')
    setGoodQty('')
    setDefectQty('')
    setSubmitErr(null)
  }

  const submit = async () => {
    setSubmitErr(null)
    if (lotId === '' || processId === '') {
      setSubmitErr('LOT와 공정을 선택하세요.')
      return
    }
    const input_qty = Number(inputQty)
    const good_qty = Number(goodQty)
    const defect_qty = Number(defectQty)
    if (!Number.isFinite(input_qty) || !Number.isFinite(good_qty) || !Number.isFinite(defect_qty)) {
      setSubmitErr('수량은 숫자로 입력하세요.')
      return
    }
    if (!Number.isInteger(input_qty) || !Number.isInteger(good_qty) || !Number.isInteger(defect_qty)) {
      setSubmitErr('수량은 정수로 입력하세요. (서버 검증)')
      return
    }
    setSubmitting(true)
    try {
      await apiJson<{ ok: boolean }>('/api/process-results', {
        method: 'POST',
        body: JSON.stringify({
          lot_id: lotId,
          process_id: processId,
          input_qty,
          good_qty,
          defect_qty,
        }),
      })
      const ltData = await apiJson<{ ok?: boolean; items?: LotRow[] }>('/api/lots')
      if (ltData.ok) setLotsAll(ltData.items ?? [])
      await loadRecent()
      resetForm()
    } catch (e) {
      setSubmitErr(formatApiErr(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mesPage mesPageWide">
      <header className="mesPageHeadRow">
        <div>
          <h1 className="mesPageTitle">공정 실적 등록</h1>
          <p className="mesPageDesc">LOT·공정·투입·양품·불량 수량을 등록합니다. 등록 후 아래 목록·생산 LOT에 반영됩니다.</p>
        </div>
        <button type="button" className="mesBtnSecondary" onClick={() => void loadRecent()} disabled={loadingRecent}>
          실적 목록 새로고침
        </button>
      </header>

      {loadErr ? (
        <div className="error mesBanner" role="alert">
          초기 데이터 오류: {loadErr}
        </div>
      ) : null}
      {submitErr ? (
        <div className="error mesBanner" role="alert">
          등록 실패: {submitErr}
        </div>
      ) : null}

      <section className="mesCard" style={{ marginTop: 12 }}>
        <div className="mesCardTitle">실적 입력</div>
        {loadingRefs ? (
          <p className="muted">품목·LOT 목록 불러오는 중…</p>
        ) : (
          <>
            <div className="mesFieldRow">
              <label className="mesLabel">
                품목
                <select
                  className="mesInput"
                  value={productId === '' ? '' : String(productId)}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setProductId(v === '' ? '' : Number(v))
                    setLotId('')
                  }}
                >
                  <option value="">선택</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productCode} — {p.productName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mesLabel">
                생산 LOT
                <select
                  className="mesInput"
                  value={lotId === '' ? '' : String(lotId)}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setLotId(v === '' ? '' : Number(v))
                  }}
                  disabled={productId === ''}
                >
                  <option value="">{productId === '' ? '품목을 먼저 선택' : '선택'}</option>
                  {lotsForProduct.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lotNo} ({l.status}) 지시수량 {l.lotQty} / 누적 양품 {l.goodQty}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mesLabel">
              공정 (MBOM 순서)
              <select
                className="mesInput"
                value={processId === '' ? '' : String(processId)}
                onChange={(ev) => {
                  const v = ev.target.value
                  setProcessId(v === '' ? '' : Number(v))
                }}
                disabled={productId === ''}
              >
                <option value="">{productId === '' ? '품목을 먼저 선택' : '선택'}</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sequence}. {p.processCode} — {p.processName}
                  </option>
                ))}
              </select>
            </label>
            <div className="mesFieldRow mesFieldRow3">
              <label className="mesLabel">
                투입 수량
                <input className="mesInput" inputMode="numeric" value={inputQty} onChange={(ev) => setInputQty(ev.target.value)} />
              </label>
              <label className="mesLabel">
                양품
                <input className="mesInput" inputMode="numeric" value={goodQty} onChange={(ev) => setGoodQty(ev.target.value)} />
              </label>
              <label className="mesLabel">
                불량
                <input className="mesInput" inputMode="numeric" value={defectQty} onChange={(ev) => setDefectQty(ev.target.value)} />
              </label>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              양품+불량 ≤ 투입, 수량은 <strong>정수</strong>여야 합니다. 해당 품목에 MBOM 공정이 없으면 공정 목록이 비어 있습니다.
            </p>
            <div className="mesToolbar mesToolbarWrap" style={{ marginTop: 12 }}>
              <button type="button" className="mesBtnPrimary" disabled={submitting} onClick={() => void submit()}>
                {submitting ? '등록 중…' : '실적 저장'}
              </button>
              <button type="button" className="mesBtnSecondary" disabled={submitting} onClick={resetForm}>
                입력 초기화
              </button>
            </div>
          </>
        )}
      </section>

      <section className="mesCard" style={{ marginTop: 16 }}>
        <div className="mesCardTitle">최근 등록 실적</div>
        <div className="mesTableWrap mesTableScroll">
          <table className="mesTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>LOT</th>
                <th>공정</th>
                <th>순서</th>
                <th>투입</th>
                <th>양품</th>
                <th>불량</th>
                <th>등록 시각</th>
              </tr>
            </thead>
            <tbody>
              {loadingRecent ? (
                <tr>
                  <td colSpan={8} className="muted">
                    불러오는 중…
                  </td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    아직 실적이 없습니다. 위 폼에서 저장하면 여기에 표시됩니다.
                  </td>
                </tr>
              ) : (
                recent.slice(0, 80).map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td className="mono">{r.lot.lotNo}</td>
                    <td>
                      <span className="mono">{r.process.processCode}</span>
                      <div className="muted small">{r.process.processName}</div>
                    </td>
                    <td>{r.processSequence}</td>
                    <td>{r.inputQty}</td>
                    <td>{r.goodQty}</td>
                    <td>{r.defectQty}</td>
                    <td className="small muted">{new Date(r.createdAt).toLocaleString('ko-KR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
