import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../mbom-page.css'
import {
  MbomProcessFormModal,
  type MbomProcessFormState,
} from '../ui/MbomProcessFormModal'

type Product = { id: number; productCode: string; productName: string }
type Wc = { id: number; centerCode: string; centerName: string }

type Row = {
  id: number
  productId: number
  processCode: string
  processName: string
  sequence: number
  workCenterId: number | null
  standardTime: number | null
  baseQty: number | null
  remark: string | null
  isOutsourcing: 'Y' | 'N'
  useYn: 'Y' | 'N'
  product: { productCode: string; productName: string }
  workCenter: { centerCode: string; centerName: string } | null
}

const PAGE_SIZE = 20

const emptyForm = (): MbomProcessFormState => ({
  productId: '',
  processCode: '',
  processName: '',
  sequence: '10',
  workCenterId: '',
  standardTimeSec: '',
  baseQty: '',
  remark: '',
  isOutsourcing: 'N',
  useYn: 'Y',
})

function parseStandardTimeSeconds(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const sec = Number(trimmed)
  if (!Number.isFinite(sec) || sec <= 0) return NaN
  return Math.round(sec * 10000) / 10000
}

function fmtSeconds(sec: number): string {
  const rounded = Math.round(sec * 10000) / 10000
  return rounded.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
}

function fmtStandardLabel(standardTime: number | null, baseQty: number | null): string {
  if (standardTime == null || baseQty == null) return '표준 미등록'
  return `${fmtSeconds(standardTime)}초 / ${baseQty.toLocaleString('ko-KR')}개`
}

function fmtTotalStandardSeconds(rows: Row[]): string {
  const totalSec = rows.reduce((sum, r) => sum + (r.standardTime ?? 0), 0)
  if (totalSec <= 0) return '—'
  return `${fmtSeconds(totalSec)}초`
}

function suggestNextSequence(rows: Row[]) {
  if (rows.length === 0) return '10'
  const max = Math.max(...rows.map((r) => r.sequence))
  return String(max + 10)
}

function totalPages(n: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, n) / pageSize))
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </svg>
  )
}

function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h5a4 4 0 0 1 4 4v4" />
    </svg>
  )
}

function ProcessStandard({ r }: { r: Row }) {
  const hasStandard = r.standardTime != null && r.baseQty != null
  return (
    <div className={hasStandard ? 'mesMbFlowStandard' : 'mesMbFlowStandard mesMbFlowStandard--missing'}>
      <span className="mesMbFlowStandardLabel">표준</span>
      <span className="mesMbFlowStandardValue">{fmtStandardLabel(r.standardTime, r.baseQty)}</span>
      {r.remark ? <span className="mesMbFlowRemark" title={r.remark}>{r.remark}</span> : null}
    </div>
  )
}

function ProcessTags({ r }: { r: Row }) {
  return (
    <div className="mesMbFlowMeta">
      {r.workCenter ? (
        <span className="mesMbTag mesMbTag--wc">{r.workCenter.centerName}</span>
      ) : (
        <span className="mesMbTag mesMbTag--use-n">작업장 없음</span>
      )}
      {r.isOutsourcing === 'Y' ? <span className="mesMbTag mesMbTag--out">외주</span> : null}
      <span className={r.useYn === 'Y' ? 'mesMbTag mesMbTag--use-y' : 'mesMbTag mesMbTag--use-n'}>
        사용 {r.useYn}
      </span>
    </div>
  )
}

function ProcessFlow({
  steps,
  onEdit,
  onRemove,
}: {
  steps: Row[]
  onEdit: (r: Row) => void
  onRemove: (id: number, ev: MouseEvent) => void
}) {
  if (steps.length === 0) {
    return (
      <div className="mesMbEmpty mesMbEmpty--inline">
        등록된 공정이 없습니다. <strong>공정 추가</strong>로 첫 공정을 등록하세요.
      </div>
    )
  }

  return (
    <div className="mesMbFlow" role="list" aria-label="공정 순서">
      {steps.map((r) => (
        <div
          key={r.id}
          role="listitem"
          className={['mesMbFlowStep', r.useYn === 'N' ? 'mesMbFlowStep--inactive' : ''].filter(Boolean).join(' ')}
        >
          <div className="mesMbFlowStepTop">
            <div className="mesMbFlowOrd" aria-hidden>{r.sequence}</div>
            <div className="mesMbFlowBody">
              <div className="mesMbFlowCode mono">{r.processCode}</div>
              <div className="mesMbFlowName">{r.processName}</div>
            </div>
            <div className="mesMbFlowActions">
              <button type="button" className="mesMbActionBtn" onClick={() => onEdit(r)}>
                수정
              </button>
              <button
                type="button"
                className="mesMbActionBtn mesMbActionBtn--danger"
                onClick={(e) => void onRemove(r.id, e)}
              >
                삭제
              </button>
            </div>
          </div>
          <ProcessStandard r={r} />
          <ProcessTags r={r} />
        </div>
      ))}
    </div>
  )
}

export function MbomPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [workCenters, setWorkCenters] = useState<Wc[]>([])
  const [allProcesses, setAllProcesses] = useState<Row[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [processSearch, setProcessSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<MbomProcessFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, w, data] = await Promise.all([
        apiJson<{ items: Product[] }>('/api/products'),
        apiJson<{ items: Wc[] }>('/api/work-centers'),
        apiJson<{ ok: boolean; items: Row[] }>('/api/mbom-processes'),
      ])
      const sortedProducts = [...p.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko'))
      setProducts(sortedProducts)
      setWorkCenters(w.items)
      setAllProcesses([...data.items].sort((a, b) => a.sequence - b.sequence || a.id - b.id))
      setSelectedProductId((prev) => {
        if (prev && sortedProducts.some((x) => String(x.id) === prev)) return prev
        return sortedProducts[0] ? String(sortedProducts[0].id) : ''
      })
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setProducts([])
      setAllProcesses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const processCountByProduct = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of allProcesses) {
      map.set(r.productId, (map.get(r.productId) ?? 0) + 1)
    }
    return map
  }, [allProcesses])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => `${p.productCode} ${p.productName}`.toLowerCase().includes(q))
  }, [products, productSearch])

  const productPages = totalPages(filteredProducts.length, PAGE_SIZE)
  const productSafePage = Math.min(Math.max(1, productPage), productPages)
  const productPageSlice = useMemo(() => {
    const start = (productSafePage - 1) * PAGE_SIZE
    return filteredProducts.slice(start, start + PAGE_SIZE)
  }, [filteredProducts, productSafePage])

  useEffect(() => {
    setProductPage(1)
  }, [productSearch])

  useEffect(() => {
    const list = filteredProducts
    if (!selectedProductId) return
    if (list.some((p) => String(p.id) === selectedProductId)) return
    setSelectedProductId(list[0] ? String(list[0].id) : '')
  }, [filteredProducts, selectedProductId])

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null
    return products.find((p) => p.id === Number(selectedProductId)) ?? null
  }, [products, selectedProductId])

  const productProcesses = useMemo(() => {
    if (!selectedProductId) return []
    const pid = Number(selectedProductId)
    return allProcesses.filter((r) => r.productId === pid)
  }, [allProcesses, selectedProductId])

  const filteredProcesses = useMemo(() => {
    const q = processSearch.trim().toLowerCase()
    if (!q) return productProcesses
    return productProcesses.filter((r) => {
      const hay = `${r.processCode} ${r.processName} ${r.workCenter?.centerName ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [productProcesses, processSearch])

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  const openCreate = () => {
    if (!selectedProductId) return
    setEditingId(null)
    setForm({
      ...emptyForm(),
      productId: selectedProductId,
      sequence: suggestNextSequence(productProcesses),
    })
    setModalOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({
      productId: String(r.productId),
      processCode: r.processCode,
      processName: r.processName,
      sequence: String(r.sequence),
      workCenterId: r.workCenterId != null ? String(r.workCenterId) : '',
      standardTimeSec: r.standardTime != null ? String(r.standardTime) : '',
      baseQty: r.baseQty != null ? String(r.baseQty) : '',
      remark: r.remark ?? '',
      isOutsourcing: r.isOutsourcing,
      useYn: r.useYn,
    })
    setModalOpen(true)
  }

  const save = async () => {
    const pid = Number(form.productId)
    const seq = Number(form.sequence)
    if (!Number.isInteger(pid) || pid < 1) {
      setErr('품목을 선택하세요.')
      return
    }
    if (!Number.isInteger(seq) || seq < 1) {
      setErr('공정 순서는 1 이상 숫자여야 합니다.')
      return
    }
    const standardTime = parseStandardTimeSeconds(form.standardTimeSec)
    if (Number.isNaN(standardTime)) {
      setErr('표준 생산시간은 0보다 큰 숫자(초)여야 합니다.')
      return
    }
    const baseQtyRaw = form.baseQty.trim()
    const baseQty = baseQtyRaw === '' ? null : Number(baseQtyRaw)
    if (baseQtyRaw !== '' && (!Number.isInteger(baseQty) || (baseQty as number) < 1)) {
      setErr('기준 생산수량은 1 이상 정수여야 합니다.')
      return
    }
    if ((standardTime != null && baseQty == null) || (standardTime == null && baseQty != null)) {
      setErr('표준 생산시간과 기준 생산수량은 함께 입력해야 합니다.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const wc = form.workCenterId.trim() === '' ? null : Number(form.workCenterId)
      if (form.workCenterId.trim() !== '' && (!Number.isInteger(wc) || (wc as number) < 1)) {
        setErr('작업장이 올바르지 않습니다.')
        setSaving(false)
        return
      }
      const body = {
        productId: pid,
        processCode: form.processCode.trim(),
        processName: form.processName.trim(),
        sequence: seq,
        workCenterId: wc,
        standardTime,
        baseQty,
        remark: form.remark.trim() === '' ? null : form.remark.trim(),
        isOutsourcing: form.isOutsourcing,
        useYn: form.useYn,
      }
      if (editingId == null) {
        await apiJson('/api/mbom-processes', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/mbom-processes/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      await loadAll()
      closeModal()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number, ev: MouseEvent) => {
    ev.stopPropagation()
    if (!confirm('이 공정 정의를 삭제할까요? 실적이 있으면 실패할 수 있습니다.')) return
    try {
      await apiJson(`/api/mbom-processes/${id}`, { method: 'DELETE' })
      await loadAll()
      if (editingId === id) closeModal()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const unregisteredStandardCount = useMemo(
    () => productProcesses.filter((r) => r.standardTime == null || r.baseQty == null).length,
    [productProcesses],
  )

  const totalProcessCount = allProcesses.length
  const productWithProcessCount = processCountByProduct.size

  return (
    <div className="mesPage mesPageWide mesMbomPage">
      <header className="mesMbHead">
        <div>
          <h1 className="mesMbTitle">MBOM 공정 · 공정분석표</h1>
          <p className="mesMbDesc">
            품목별 공정 흐름과 표준 생산시간·기준 생산수량을 관리합니다.
          </p>
        </div>
        <div className="mesMbHeadActions">
          <span className="mesMbCountBadge">
            {loading ? '…' : `${productWithProcessCount}개 품목 · ${totalProcessCount}개 공정`}
          </span>
          <button type="button" className="mesMbBtn mesMbBtn--secondary" onClick={() => void loadAll()}>
            <IconRefresh />
            새로고침
          </button>
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

      <div className="mesMbSplit">
        <aside className="mesMbSidePanel" aria-label="품목 목록">
          <div className="mesMbSideHead">
            <IconBox />
            품목
          </div>
          <div className="mesMbSideTools">
            <div className="mesMbSearchWrap">
              <span className="mesMbSearchIcon"><IconSearch /></span>
              <input
                type="search"
                className="mesMbInput mesMbInput--search"
                placeholder="코드·품명 검색"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                aria-label="품목 검색"
              />
            </div>
            <button
              type="button"
              className="mesMbResetBtn"
              onClick={() => setProductSearch('')}
            >
              <IconRefresh />
              초기화
            </button>
          </div>
          <div className="mesMbSideBody">
            {loading ? (
              <div className="mesMbSideEmpty">로딩 중…</div>
            ) : products.length === 0 ? (
              <div className="mesMbSideEmpty">등록된 품목이 없습니다.</div>
            ) : filteredProducts.length === 0 ? (
              <div className="mesMbSideEmpty">조건에 맞는 품목이 없습니다.</div>
            ) : (
              productPageSlice.map((p) => {
                const count = processCountByProduct.get(p.id) ?? 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`mesMbProductRow${selectedProductId === String(p.id) ? ' mesMbProductRow--active' : ''}`}
                    onClick={() => setSelectedProductId(String(p.id))}
                  >
                    <div className="mesMbProductRowTop">
                      <span className="mesMbProductCode">{p.productCode}</span>
                      <span className="mesMbProcessCountBadge">{count}공정</span>
                    </div>
                    <span className="mesMbProductName">{p.productName}</span>
                  </button>
                )
              })
            )}
          </div>
          <div className="mesMbSidePager">
            <span>총 {filteredProducts.length}건</span>
            <div className="mesMbPagerNav">
              <button
                type="button"
                className="mesMbPagerBtn"
                disabled={productSafePage <= 1}
                onClick={() => setProductPage(productSafePage - 1)}
              >
                ‹
              </button>
              <span>{productSafePage} / {productPages}</span>
              <button
                type="button"
                className="mesMbPagerBtn"
                disabled={productSafePage >= productPages}
                onClick={() => setProductPage(productSafePage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </aside>

        <section className="mesMbMainPanel">
          <div className="mesMbMainHead">
            <div className="mesMbMainTitleRow">
              <span className="mesMbMainTitle">
                <IconRoute />
                공정 흐름
              </span>
              {selectedProduct ? (
                <span className="mesMbContextChip" title={`${selectedProduct.productCode} · ${selectedProduct.productName}`}>
                  {selectedProduct.productName}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="mesMbBtn mesMbBtn--primary"
              disabled={!selectedProductId || loading}
              onClick={openCreate}
            >
              <IconPlus />
              공정 추가
            </button>
          </div>

          <div className="mesMbMainToolbar">
            <div className="mesMbSearchWrap">
              <span className="mesMbSearchIcon"><IconSearch /></span>
              <input
                type="search"
                className="mesMbInput mesMbInput--search"
                placeholder="공정코드·공정명·작업장 검색"
                value={processSearch}
                onChange={(e) => setProcessSearch(e.target.value)}
                disabled={!selectedProductId}
                aria-label="공정 검색"
              />
            </div>
            {selectedProduct ? (
              <span className="mesMbMainMeta">
                {filteredProcesses.length}개 공정
                · 합계 {fmtTotalStandardSeconds(productProcesses)}
                {unregisteredStandardCount > 0 ? ` · 미등록 ${unregisteredStandardCount}` : ''}
              </span>
            ) : null}
          </div>

          <div className="mesMbMainBody">
            {!selectedProductId ? (
              <div className="mesMbEmpty">왼쪽에서 품목을 선택하세요.</div>
            ) : loading ? (
              <div className="mesMbEmpty">로딩 중…</div>
            ) : (
              <ProcessFlow
                steps={filteredProcesses}
                onEdit={openEdit}
                onRemove={remove}
              />
            )}
          </div>
        </section>
      </div>

      <MbomProcessFormModal
        open={modalOpen}
        editingId={editingId}
        saving={saving}
        form={form}
        setForm={setForm}
        product={selectedProduct}
        workCenters={workCenters}
        onSave={() => void save()}
        onClose={closeModal}
      />
    </div>
  )
}
