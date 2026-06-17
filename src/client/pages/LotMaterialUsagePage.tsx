import { useCallback, useEffect, useState } from 'react'

import { apiJson } from '../lib/api'

type Row = {
  id: number
  productionLotId: number
  materialLotId: number | null
  materialProductId?: number | null
  usedQty: string
  createdAt: string
  productionLot?: { lotNo: string }
  materialLot?: { lotNo: string; productId: number } | null
  materialProduct?: { productCode: string; productName: string } | null
}

export function LotMaterialUsagePage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [productionLotId, setProductionLotId] = useState('')
  const [materialLotId, setMaterialLotId] = useState('')
  const [usedQty, setUsedQty] = useState('1')
  const [woId, setWoId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/lot-material-usages')
      setItems(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setProductionLotId('')
    setMaterialLotId('')
    setUsedQty('1')
    setWoId('')
  }, [])

  const openPanel = useCallback(() => {
    setProductionLotId('')
    setMaterialLotId('')
    setUsedQty('1')
    setWoId('')
    setPanelOpen(true)
  }, [])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, closePanel])

  const issue = async () => {
    setSaving(true)
    setErr(null)
    try {
      const pl = Number(productionLotId)
      const ml = Number(materialLotId)
      if (!Number.isFinite(pl) || !Number.isFinite(ml)) {
        setErr('생산 LOT ID·자재 LOT ID는 숫자여야 합니다.')
        setSaving(false)
        return
      }
      const body: Record<string, unknown> = {
        productionLotId: pl,
        materialLotId: ml,
        usedQty,
      }
      if (woId.trim() !== '') {
        const w = Number(woId)
        if (!Number.isFinite(w)) {
          setErr('작업지시 ID는 숫자여야 합니다.')
          setSaving(false)
          return
        }
        body.woId = w
      }
      await apiJson('/api/transactions/issue-material', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await load()
      closePanel()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">자재 투입</h1>
        <p className="mesPageDesc">
          트랜잭션: 자재 LOT 잔량 차감·투입 이력·LOT 이력·(재고 연동 시) 재고 OUT·작업지시 소요량 반영(선택). 마지막 공정 실적(백플러시)에서 LOT
          미지정 재고만 쓴 경우에도 품목 기준으로 투입 행이 남습니다.
        </p>
      </header>

      {err ? <div className="error mesBanner">{err}</div> : null}

      <div className="mesToolbar mesToolbarWrap">
        <button type="button" className="mesBtnPrimary" onClick={openPanel}>
          자재 투입
        </button>
        <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
          이력 새로고침
        </button>
      </div>

      <div className="mesTableWrap mesTableScroll" style={{ marginTop: 16 }}>
        <table className="mesTable">
          <thead>
            <tr>
              <th>생산 LOT</th>
              <th>자재 LOT / 품목</th>
              <th>투입량</th>
              <th>시각</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="muted">
                  로딩 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  데이터 없음
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td>{r.productionLot?.lotNo ?? r.productionLotId}</td>
                  <td>
                    {r.materialLot?.lotNo ??
                      (r.materialProduct
                        ? `${r.materialProduct.productCode} · ${r.materialProduct.productName} (LOT 미지정)`
                        : r.materialLotId ?? '—')}
                  </td>
                  <td className="mono">{r.usedQty}</td>
                  <td>{String(r.createdAt).replace('T', ' ').slice(0, 19)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {panelOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closePanel} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-lmu-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-lmu-title">
                  신규 등록
                </h2>
                <div className="mesModalMeta muted">자재 투입 실행</div>
              </div>
            </div>
            <div className="mesModalBody">
              <div className="mesFieldRow">
                <label className="mesLabel">
                  생산 LOT ID
                  <input className="mesInput mono" value={productionLotId} onChange={(ev) => setProductionLotId(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  자재 LOT ID
                  <input className="mesInput mono" value={materialLotId} onChange={(ev) => setMaterialLotId(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  투입 수량
                  <input className="mesInput" value={usedQty} onChange={(ev) => setUsedQty(ev.target.value)} />
                </label>
                <label className="mesLabel">
                  작업지시 ID (선택, 품목 일치 시 issued 증가)
                  <input className="mesInput mono" value={woId} onChange={(ev) => setWoId(ev.target.value)} />
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closePanel}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void issue()}>
                {saving ? '처리 중…' : '투입 반영'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
