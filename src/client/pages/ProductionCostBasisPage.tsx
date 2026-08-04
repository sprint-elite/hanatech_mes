import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import { itemTypeLabel } from '../lib/itemType'
import '../list-page.css'
import '../production-pl-page.css'

type CostBasis = {
  basisType: string
  productId: number | null
  materialUnitCost: number | null
  productUnitCost: number | null
  sellingPrice: number | null
  laborRatePerSec: number | null
  fixedRatePerSec: number | null
  memo: string | null
}

type ProductCostRow = {
  id: number
  productCode: string
  productName: string
  itemType: string
  unit: string
  materialUnitCost: number | null
  avgInboundUnitCost: number | null
  purchasePrice: number | null
  basis: CostBasis | null
  effectiveLaborRatePerSec: number | null
  effectiveFixedRatePerSec: number | null
  productUnitCost: number | null
  sellingPrice: number | null
}

type GlobalForm = {
  laborRatePerSec: string
  fixedRatePerSec: string
  memo: string
}

type ProductForm = {
  productUnitCost: string
  sellingPrice: string
  laborRatePerSec: string
  fixedRatePerSec: string
  memo: string
}

const emptyGlobalForm = (): GlobalForm => ({
  laborRatePerSec: '',
  fixedRatePerSec: '',
  memo: '',
})

const emptyProductForm = (): ProductForm => ({
  productUnitCost: '',
  sellingPrice: '',
  laborRatePerSec: '',
  fixedRatePerSec: '',
  memo: '',
})

function fmtMoney(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('ko-KR')
}

function parseOptionalNum(raw: string): number | null | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function ProductionCostBasisPage() {
  const [globalConfig, setGlobalConfig] = useState<CostBasis | null>(null)
  const [items, setItems] = useState<ProductCostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [itemType, setItemType] = useState('')
  const [draftQ, setDraftQ] = useState('')
  const [draftItemType, setDraftItemType] = useState('')
  const [globalModalOpen, setGlobalModalOpen] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<ProductCostRow | null>(null)
  const [globalForm, setGlobalForm] = useState<GlobalForm>(emptyGlobalForm)
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm)
  const [modalErr, setModalErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (itemType) params.set('itemType', itemType)
      const [cfg, list] = await Promise.all([
        apiJson<{ ok: boolean; config: CostBasis }>('/api/production-cost-basis/config'),
        apiJson<{ ok: boolean; items: ProductCostRow[]; global: CostBasis }>(
          `/api/production-cost-basis/products?${params.toString()}`,
        ),
      ])
      setGlobalConfig(cfg.config)
      setItems(list.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q, itemType])

  useEffect(() => {
    void load()
  }, [load])

  const openGlobalModal = () => {
    setGlobalForm({
      laborRatePerSec: globalConfig?.laborRatePerSec != null ? String(globalConfig.laborRatePerSec) : '',
      fixedRatePerSec: globalConfig?.fixedRatePerSec != null ? String(globalConfig.fixedRatePerSec) : '',
      memo: globalConfig?.memo ?? '',
    })
    setModalErr(null)
    setGlobalModalOpen(true)
  }

  const openProductModal = (row: ProductCostRow) => {
    setEditingRow(row)
    setProductForm({
      productUnitCost: row.basis?.productUnitCost != null ? String(row.basis.productUnitCost) : '',
      sellingPrice: row.basis?.sellingPrice != null ? String(row.basis.sellingPrice) : '',
      laborRatePerSec: row.basis?.laborRatePerSec != null ? String(row.basis.laborRatePerSec) : '',
      fixedRatePerSec: row.basis?.fixedRatePerSec != null ? String(row.basis.fixedRatePerSec) : '',
      memo: row.basis?.memo ?? '',
    })
    setModalErr(null)
    setProductModalOpen(true)
  }

  const closeGlobalModal = () => {
    setGlobalModalOpen(false)
    setModalErr(null)
  }

  const closeProductModal = () => {
    setProductModalOpen(false)
    setEditingRow(null)
    setModalErr(null)
  }

  const saveGlobal = async () => {
    setSaving(true)
    setModalErr(null)
    try {
      const laborRatePerSec = parseOptionalNum(globalForm.laborRatePerSec)
      const fixedRatePerSec = parseOptionalNum(globalForm.fixedRatePerSec)
      if (laborRatePerSec === null || fixedRatePerSec === null) {
        setModalErr('초당 입률·고정입률은 0 이상 숫자여야 합니다.')
        setSaving(false)
        return
      }
      await apiJson('/api/production-cost-basis/config', {
        method: 'PUT',
        body: JSON.stringify({
          laborRatePerSec: laborRatePerSec ?? null,
          fixedRatePerSec: fixedRatePerSec ?? null,
          memo: globalForm.memo.trim() || null,
        }),
      })
      await load()
      closeGlobalModal()
    } catch (e) {
      setModalErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const saveProduct = async () => {
    if (editingRow == null) return
    setSaving(true)
    setModalErr(null)
    try {
      const productUnitCost = parseOptionalNum(productForm.productUnitCost)
      const sellingPrice = parseOptionalNum(productForm.sellingPrice)
      const laborRatePerSec = parseOptionalNum(productForm.laborRatePerSec)
      const fixedRatePerSec = parseOptionalNum(productForm.fixedRatePerSec)
      if (productUnitCost === null || sellingPrice === null || laborRatePerSec === null || fixedRatePerSec === null) {
        setModalErr('금액·요율은 빈 칸이거나 0 이상 숫자여야 합니다.')
        setSaving(false)
        return
      }
      await apiJson(`/api/production-cost-basis/products/${editingRow.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productUnitCost: productUnitCost ?? null,
          sellingPrice: sellingPrice ?? null,
          laborRatePerSec: laborRatePerSec ?? null,
          fixedRatePerSec: fixedRatePerSec ?? null,
          memo: productForm.memo.trim() || null,
        }),
      })
      await load()
      closeProductModal()
    } catch (e) {
      setModalErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const rollupMaterial = async () => {
    if (editingRow == null) return
    setSaving(true)
    setModalErr(null)
    try {
      await apiJson(`/api/production-cost-basis/products/${editingRow.id}/rollup-material`, { method: 'POST' })
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (itemType) params.set('itemType', itemType)
      const list = await apiJson<{ ok: boolean; items: ProductCostRow[] }>(
        `/api/production-cost-basis/products?${params.toString()}`,
      )
      setItems(list.items)
      const refreshed = list.items.find((x) => x.id === editingRow.id)
      if (refreshed) setEditingRow(refreshed)
    } catch (e) {
      setModalErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const applySearch = () => {
    setQ(draftQ)
    setItemType(draftItemType)
  }

  const configuredCount = useMemo(() => items.filter((r) => r.basis != null).length, [items])

  return (
    <div className="mesPage mesPageWide mesListPage">
      <header className="mesListHead">
        <div className="mesListHeadMain">
          <h1 className="mesListTitle">생산 원가 기준</h1>
          <p className="mesListDesc">
            당일 생산 손익 산정에 쓰이는 전사 요율과 품목별 원가·판매단가를 관리합니다. 초당 입률·고정입률은 수동 등록값이며, 품목별로
            비워두면 전사 기본값이 적용됩니다.
          </p>
        </div>
        <div className="mesListHeadActions">
          <span className="mesListCountBadge">기준 등록 {configuredCount}건</span>
          <button type="button" className="mesListBtn mesListBtn--secondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>
      </header>

      {err ? <div className="error mesBanner mesListNotice">{err}</div> : null}

      <section className="mesPlGlobalCard">
        <div>
          <div className="mesCardTitle">전사 기본 요율</div>
          <div className="mesPlGlobalStats">
            <div className="mesPlGlobalStat">
              <span className="mesPlGlobalStatLabel">초당 입률</span>
              <span className="mesPlGlobalStatValue mono">{fmtMoney(globalConfig?.laborRatePerSec)}원/초</span>
            </div>
            <div className="mesPlGlobalStat">
              <span className="mesPlGlobalStatLabel">고정입률</span>
              <span className="mesPlGlobalStatValue mono">{fmtMoney(globalConfig?.fixedRatePerSec)}원/초</span>
            </div>
            {globalConfig?.memo ? (
              <div className="mesPlGlobalStat">
                <span className="mesPlGlobalStatLabel">메모</span>
                <span className="mesPlGlobalStatValue">{globalConfig.memo}</span>
              </div>
            ) : null}
          </div>
          <p className="muted mesPlBasisHint">
            인건비 = 생산시간(초) × 초당 입률 · 고정비 = 생산시간(초) × 고정입률
          </p>
        </div>
        <button type="button" className="mesListBtn mesListBtn--primary" onClick={openGlobalModal}>
          전사 요율 설정
        </button>
      </section>

      <section className="mesPlToolbar">
        <label className="mesListField">
          <span className="mesListFieldLabel">품목 검색</span>
          <input
            className="mesListInput"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="코드·품명"
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          />
        </label>
        <label className="mesListField">
          <span className="mesListFieldLabel">유형</span>
          <select className="mesListInput" value={draftItemType} onChange={(e) => setDraftItemType(e.target.value)}>
            <option value="">전체</option>
            <option value="FG">완제품</option>
            <option value="WIP">반제품</option>
            <option value="RAW">원자재</option>
          </select>
        </label>
        <button type="button" className="mesListBtn mesListBtn--primary" onClick={applySearch}>
          조회
        </button>
      </section>

      <div className="mesListTableCard">
        <div className="mesTableWrap mesListTableViewport">
          <table className="mesTable mesPlTable">
            <thead>
              <tr>
                <th>코드</th>
                <th>품명</th>
                <th>유형</th>
                <th>평균 입고단가</th>
                <th>구매단가</th>
                <th>제품원가</th>
                <th>판매단가</th>
                <th>적용 초당입률</th>
                <th>적용 고정입률</th>
                <th className="mesThActions">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="muted">
                    로딩 중…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.productCode}</td>
                    <td>{r.productName}</td>
                    <td>{itemTypeLabel(r.itemType)}</td>
                    <td className="mono">{fmtMoney(r.avgInboundUnitCost ?? r.materialUnitCost)}</td>
                    <td className="mono">{fmtMoney(r.purchasePrice)}</td>
                    <td className="mono">{fmtMoney(r.productUnitCost)}</td>
                    <td className="mono">{fmtMoney(r.sellingPrice)}</td>
                    <td className="mono">{fmtMoney(r.effectiveLaborRatePerSec)}</td>
                    <td className="mono">{fmtMoney(r.effectiveFixedRatePerSec)}</td>
                    <td className="mesTdActions">
                      <button type="button" className="mesBtnSm" onClick={() => openProductModal(r)}>
                        수정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {globalModalOpen ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeGlobalModal} />
          <div className="mesModalDialog" role="dialog" aria-modal="true" aria-labelledby="mes-pl-global-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-pl-global-title">
                  전사 기본 요율 설정
                </h2>
                <div className="mesModalMeta muted">당일 생산 손익 산정 시 기본값으로 사용</div>
              </div>
            </div>
            <div className="mesModalBody">
              {modalErr ? <div className="error mesBanner">{modalErr}</div> : null}
              <div className="mesPlFormulaBox">
                <strong>계산 방식</strong>
                <br />
                인건비 = 생산시간(분) × 60 × <code>초당 입률</code>
                <br />
                고정비 = 생산시간(분) × 60 × <code>고정입률</code>
                <br />
                <span className="muted">급여에서 자동 산출되지 않으며, 관리자가 직접 등록합니다.</span>
              </div>
              <div className="mesFieldRow" style={{ marginTop: 14 }}>
                <label className="mesLabel">
                  초당 입률 (원/초)
                  <input
                    className="mesInput mono"
                    value={globalForm.laborRatePerSec}
                    onChange={(e) => setGlobalForm((f) => ({ ...f, laborRatePerSec: e.target.value }))}
                    placeholder="예: 0.015"
                  />
                </label>
                <label className="mesLabel">
                  고정입률 (원/초)
                  <input
                    className="mesInput mono"
                    value={globalForm.fixedRatePerSec}
                    onChange={(e) => setGlobalForm((f) => ({ ...f, fixedRatePerSec: e.target.value }))}
                    placeholder="예: 0.005"
                  />
                </label>
                <label className="mesLabel mesLabel--wide">
                  메모
                  <input className="mesInput" value={globalForm.memo} onChange={(e) => setGlobalForm((f) => ({ ...f, memo: e.target.value }))} />
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeGlobalModal}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void saveGlobal()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productModalOpen && editingRow ? (
        <div className="mesModalRoot" role="presentation">
          <button type="button" className="mesModalBackdrop" aria-label="닫기" onClick={closeProductModal} />
          <div className="mesModalDialog mesModalDialogWide" role="dialog" aria-modal="true" aria-labelledby="mes-pl-product-title">
            <div className="mesModalHead">
              <div>
                <h2 className="mesModalTitle" id="mes-pl-product-title">
                  품목 원가 설정
                </h2>
                <div className="mesModalMeta muted">
                  {editingRow.productCode} · {editingRow.productName}
                </div>
              </div>
            </div>
            <div className="mesModalBody">
              {modalErr ? <div className="error mesBanner">{modalErr}</div> : null}
              <div className="mesPlReadonlyMeta">
                <span>
                  평균 입고단가 <strong>{fmtMoney(editingRow.avgInboundUnitCost ?? editingRow.materialUnitCost)}원</strong>
                </span>
                <span>
                  구매단가 <strong>{fmtMoney(editingRow.purchasePrice)}원</strong>
                </span>
                <span>
                  적용 초당입률 <strong>{fmtMoney(editingRow.effectiveLaborRatePerSec)}원/초</strong>
                </span>
                <span>
                  적용 고정입률 <strong>{fmtMoney(editingRow.effectiveFixedRatePerSec)}원/초</strong>
                </span>
              </div>
              {(editingRow.itemType === 'FG' || editingRow.itemType === 'WIP') && (
                <div className="mesFormActions" style={{ marginBottom: 14 }}>
                  <button type="button" className="mesBtnSecondary" disabled={saving} onClick={() => void rollupMaterial()}>
                    EBOM 자재비 합산
                  </button>
                </div>
              )}
              <div className="mesFieldRow">
                <label className="mesLabel">
                  제품원가
                  <input
                    className="mesInput mono"
                    value={productForm.productUnitCost}
                    onChange={(e) => setProductForm((f) => ({ ...f, productUnitCost: e.target.value }))}
                    placeholder="품목당 가공·간접비 등"
                  />
                </label>
                <label className="mesLabel">
                  판매단가
                  <input
                    className="mesInput mono"
                    value={productForm.sellingPrice}
                    onChange={(e) => setProductForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                  />
                </label>
                <label className="mesLabel">
                  초당 입률 (품목별)
                  <input
                    className="mesInput mono"
                    value={productForm.laborRatePerSec}
                    onChange={(e) => setProductForm((f) => ({ ...f, laborRatePerSec: e.target.value }))}
                    placeholder="비우면 전사 기본"
                  />
                </label>
                <label className="mesLabel">
                  고정입률 (품목별)
                  <input
                    className="mesInput mono"
                    value={productForm.fixedRatePerSec}
                    onChange={(e) => setProductForm((f) => ({ ...f, fixedRatePerSec: e.target.value }))}
                    placeholder="비우면 전사 기본"
                  />
                </label>
                <label className="mesLabel mesLabel--wide">
                  메모
                  <input className="mesInput" value={productForm.memo} onChange={(e) => setProductForm((f) => ({ ...f, memo: e.target.value }))} />
                </label>
              </div>
            </div>
            <div className="mesModalFoot">
              <button type="button" className="mesBtnSecondary" disabled={saving} onClick={closeProductModal}>
                취소
              </button>
              <button type="button" className="mesBtnPrimary" disabled={saving} onClick={() => void saveProduct()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
