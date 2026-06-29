import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import '../mbom-materials-page.css'
import {
  MbomMaterialFormModal,
  keyMaterialBadgeClass,
  type MbomMaterialFormState,
} from '../ui/MbomMaterialFormModal'

type Row = {
  id: number
  processId: number
  materialProductId: number
  qty: string
  unit: string
  lossRate: string | null
  isKeyMaterial: 'Y' | 'N'
  process?: {
    id: number
    processCode: string
    processName: string
    productId: number
    sequence: number
    product?: { productCode: string; productName: string }
  }
  materialProduct?: { productCode: string; productName: string }
}

type MbomProcessRef = {
  id: number
  productId: number
  processCode: string
  processName: string
  sequence: number
  product?: { productCode: string; productName: string }
}

type ProductRef = { id: number; productCode: string; productName: string }

const PAGE_SIZE = 20
const TABLE_PAGE_SIZE = 20

const emptyForm = (): MbomMaterialFormState => ({
  processId: '',
  materialProductId: '',
  qty: '1',
  unit: 'EA',
  lossRate: '',
  isKeyMaterial: 'N',
})

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
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}

export function MbomMaterialsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [processes, setProcesses] = useState<MbomProcessRef[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [tablePage, setTablePage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(TABLE_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<MbomMaterialFormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [mat, proc, prod] = await Promise.all([
        apiJson<{ ok: boolean; items: Row[] }>('/api/mbom-materials'),
        apiJson<{ ok: boolean; items: MbomProcessRef[] }>('/api/mbom-processes'),
        apiJson<{ ok: boolean; items: ProductRef[] }>('/api/products'),
      ])
      setItems(mat.items)
      const procSorted = [...proc.items].sort((a, b) => {
        const ac = a.product?.productCode ?? ''
        const bc = b.product?.productCode ?? ''
        if (ac !== bc) return ac.localeCompare(bc, 'ko')
        return a.sequence - b.sequence || a.id - b.id
      })
      setProcesses(procSorted)
      const sortedProducts = [...prod.items].sort((a, b) => a.productCode.localeCompare(b.productCode, 'ko'))
      setProducts(sortedProducts)
      setSelectedProductId((prev) => {
        if (prev && sortedProducts.some((p) => String(p.id) === prev)) return prev
        const withMat = sortedProducts.find((p) => mat.items.some((r) => r.process?.productId === p.id))
        return withMat ? String(withMat.id) : sortedProducts[0] ? String(sortedProducts[0].id) : ''
      })
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const materialCountByProduct = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of items) {
      const pid = r.process?.productId
      if (pid == null) continue
      map.set(pid, (map.get(pid) ?? 0) + 1)
    }
    return map
  }, [items])

  const productList = useMemo(() => {
    const ids = new Set<number>()
    for (const p of processes) ids.add(p.productId)
    for (const r of items) {
      if (r.process?.productId != null) ids.add(r.process.productId)
    }
    return products.filter((p) => ids.has(p.id))
  }, [products, processes, items])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    const base = productList.length > 0 ? productList : products
    if (!q) return base
    return base.filter((p) => `${p.productCode} ${p.productName}`.toLowerCase().includes(q))
  }, [productList, products, productSearch])

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
    setTablePage(1)
  }, [selectedProductId, materialSearch])

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null
    return products.find((p) => p.id === Number(selectedProductId)) ?? null
  }, [products, selectedProductId])

  const productProcesses = useMemo(() => {
    if (!selectedProductId) return []
    const pid = Number(selectedProductId)
    return processes.filter((p) => p.productId === pid)
  }, [processes, selectedProductId])

  const productMaterials = useMemo(() => {
    if (!selectedProductId) return []
    const pid = Number(selectedProductId)
    return items.filter((r) => r.process?.productId === pid)
  }, [items, selectedProductId])

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    if (!q) return productMaterials
    return productMaterials.filter((r) => {
      const hay = [
        r.process?.processCode ?? '',
        r.process?.processName ?? '',
        r.materialProduct?.productCode ?? '',
        r.materialProduct?.productName ?? '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [productMaterials, materialSearch])

  const tablePages = totalPages(filteredMaterials.length, tablePageSize)
  const tableSafePage = Math.min(Math.max(1, tablePage), tablePages)
  const tablePageSlice = useMemo(() => {
    const start = (tableSafePage - 1) * tablePageSize
    return filteredMaterials.slice(start, start + tablePageSize)
  }, [filteredMaterials, tableSafePage, tablePageSize])

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  const openCreate = () => {
    const firstProcess = productProcesses[0]
    setEditingId(null)
    setForm({
      ...emptyForm(),
      processId: firstProcess ? String(firstProcess.id) : '',
    })
    setModalOpen(true)
  }

  const openEdit = (r: Row) => {
    setEditingId(r.id)
    setForm({
      processId: String(r.processId),
      materialProductId: String(r.materialProductId),
      qty: r.qty,
      unit: r.unit,
      lossRate: r.lossRate ?? '',
      isKeyMaterial: r.isKeyMaterial,
    })
    setModalOpen(true)
  }

  const save = async () => {
    const pid = Number(form.processId)
    const mid = Number(form.materialProductId)
    if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(mid) || mid < 1) {
      setErr('투입 공정과 자재 품목을 선택하세요.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        processId: pid,
        materialProductId: mid,
        qty: form.qty,
        unit: form.unit.trim(),
        lossRate: form.lossRate.trim() === '' ? null : form.lossRate.trim(),
        isKeyMaterial: form.isKeyMaterial,
      }
      if (editingId == null) {
        await apiJson('/api/mbom-materials', { method: 'POST', body: JSON.stringify(body) })
      } else {
        await apiJson(`/api/mbom-materials/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
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
    if (!confirm('삭제할까요?')) return
    try {
      await apiJson(`/api/mbom-materials/${id}`, { method: 'DELETE' })
      await loadAll()
      if (editingId === id) closeModal()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  const productLabel = selectedProduct
    ? `${selectedProduct.productCode} · ${selectedProduct.productName}`
    : undefined

  return (
    <div className="mesPage mesPageWide mesMmMaterialsPage">
      <header className="mesMmHead">
        <div>
          <h1 className="mesMmTitle">MBOM 투입자재</h1>
          <p className="mesMmDesc">왼쪽에서 품목을 선택하고, 공정별 투입 자재를 관리합니다.</p>
        </div>
        <div className="mesMmHeadActions">
          <span className="mesMmCountBadge">{loading ? '…' : `${items.length}건`}</span>
          <button type="button" className="mesMmBtn mesMmBtn--secondary" onClick={() => void loadAll()}>
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

      <div className="mesMmSplit">
        <aside className="mesMmSidePanel" aria-label="품목 목록">
          <div className="mesMmSideHead">
            <IconBox />
            품목
          </div>
          <div className="mesMmSideTools">
            <div className="mesMmSearchWrap">
              <span className="mesMmSearchIcon"><IconSearch /></span>
              <input
                type="search"
                className="mesMmInput mesMmInput--search"
                placeholder="코드·품명 검색"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                aria-label="품목 검색"
              />
            </div>
            <button type="button" className="mesMmResetBtn" onClick={() => setProductSearch('')}>
              <IconRefresh />
              초기화
            </button>
          </div>
          <div className="mesMmSideBody">
            {loading ? (
              <div className="mesMmSideEmpty">로딩 중…</div>
            ) : filteredProducts.length === 0 ? (
              <div className="mesMmSideEmpty">표시할 품목이 없습니다.</div>
            ) : (
              productPageSlice.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`mesMmProductRow${selectedProductId === String(p.id) ? ' mesMmProductRow--active' : ''}`}
                  onClick={() => setSelectedProductId(String(p.id))}
                >
                  <div className="mesMmProductRowTop">
                    <span className="mesMmProductCode">{p.productCode}</span>
                    <span className="mesMmProcessCountBadge">{materialCountByProduct.get(p.id) ?? 0}자재</span>
                  </div>
                  <span className="mesMmProductName">{p.productName}</span>
                </button>
              ))
            )}
          </div>
          <div className="mesMmSidePager">
            <span>총 {filteredProducts.length}건</span>
            <div className="mesMmPagerNav">
              <button type="button" className="mesMmPagerBtn" disabled={productSafePage <= 1} onClick={() => setProductPage(productSafePage - 1)}>‹</button>
              <span>{productSafePage} / {productPages}</span>
              <button type="button" className="mesMmPagerBtn" disabled={productSafePage >= productPages} onClick={() => setProductPage(productSafePage + 1)}>›</button>
            </div>
          </div>
        </aside>

        <section className="mesMmMainPanel">
          <div className="mesMmMainHead">
            <div className="mesMmMainTitleRow">
              <span className="mesMmMainTitle">
                <IconBox />
                투입자재
              </span>
              {selectedProduct ? (
                <span className="mesMmContextChip" title={productLabel}>
                  {selectedProduct.productName}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="mesMmBtn mesMmBtn--primary"
              disabled={!selectedProductId || loading || productProcesses.length === 0}
              onClick={openCreate}
            >
              <IconPlus />
              투입자재 추가
            </button>
          </div>

          <div className="mesMmMainToolbar">
            <div className="mesMmSearchWrap">
              <span className="mesMmSearchIcon"><IconSearch /></span>
              <input
                type="search"
                className="mesMmInput mesMmInput--search"
                placeholder="공정·자재 검색"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                disabled={!selectedProductId}
                aria-label="투입자재 검색"
              />
            </div>
            {selectedProduct ? (
              <span className="mesMmMainMeta">{filteredMaterials.length}건</span>
            ) : null}
          </div>

          <div className="mesMmMainBody mesMmMainBody--table">
            {!selectedProductId ? (
              <div className="mesMmEmpty">왼쪽에서 품목을 선택하세요.</div>
            ) : loading ? (
              <div className="mesMmEmpty">로딩 중…</div>
            ) : productProcesses.length === 0 ? (
              <div className="mesMmEmpty">이 품목에 등록된 MBOM 공정이 없습니다. <strong>MBOM 공정</strong>에서 먼저 공정을 등록하세요.</div>
            ) : (
              <div className="mesMmTableCard">
                <div className="mesMmTableViewport">
                  <table className="mesMmTable">
                    <thead>
                      <tr>
                        <th>공정</th>
                        <th>자재</th>
                        <th>수량</th>
                        <th>손실율</th>
                        <th>주요</th>
                        <th className="mesMmThActions">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.length === 0 ? (
                        <tr><td colSpan={6} className="mesMmEmpty">투입자재가 없습니다. <strong>투입자재 추가</strong>로 등록하세요.</td></tr>
                      ) : (
                        tablePageSlice.map((r) => (
                          <tr key={r.id} onClick={() => openEdit(r)}>
                            <td>
                              {r.process ? (
                                <>
                                  <div className="mesMmCellTitle">{r.process.processName}</div>
                                  <div className="mesMmCellSub mono">
                                    {r.process.sequence}순 · {r.process.processCode}
                                  </div>
                                </>
                              ) : (
                                r.processId
                              )}
                            </td>
                            <td>
                              {r.materialProduct ? (
                                <>
                                  <div className="mesMmCellTitle">{r.materialProduct.productName}</div>
                                  <div className="mesMmCellSub mono">{r.materialProduct.productCode}</div>
                                </>
                              ) : (
                                r.materialProductId
                              )}
                            </td>
                            <td className="mono">{r.qty} {r.unit}</td>
                            <td className="mono">{r.lossRate ?? '—'}</td>
                            <td>
                              <span className={keyMaterialBadgeClass(r.isKeyMaterial)}>{r.isKeyMaterial}</span>
                            </td>
                            <td className="mesMmTdActions">
                              <div className="mesMmRowActions">
                                <button type="button" className="mesMmActionBtn" onClick={(e) => { e.stopPropagation(); openEdit(r) }}>
                                  <IconEdit />
                                  수정
                                </button>
                                <button type="button" className="mesMmActionBtn mesMmActionBtn--danger" onClick={(e) => void remove(r.id, e)}>
                                  <IconTrash />
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredMaterials.length > 0 ? (
                  <footer className="mesMmPager">
                    <span>총 {filteredMaterials.length}건</span>
                    <nav className="mesMmPagerNav" aria-label="페이지">
                      <button type="button" className="mesMmPagerBtn" disabled={tableSafePage <= 1} onClick={() => setTablePage(1)}>«</button>
                      <button type="button" className="mesMmPagerBtn" disabled={tableSafePage <= 1} onClick={() => setTablePage(tableSafePage - 1)}>‹</button>
                      <button type="button" className="mesMmPagerBtn" disabled={tableSafePage >= tablePages} onClick={() => setTablePage(tableSafePage + 1)}>›</button>
                      <button type="button" className="mesMmPagerBtn" disabled={tableSafePage >= tablePages} onClick={() => setTablePage(tablePages)}>»</button>
                    </nav>
                    <select
                      className="mesMmSelect"
                      style={{ width: 'auto', minWidth: '120px' }}
                      value={tablePageSize}
                      onChange={(e) => { setTablePageSize(Number(e.target.value)); setTablePage(1) }}
                      aria-label="페이지당 표시 건수"
                    >
                      <option value={10}>10개씩</option>
                      <option value={20}>20개씩</option>
                      <option value={50}>50개씩</option>
                    </select>
                  </footer>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>

      <MbomMaterialFormModal
        open={modalOpen}
        editingId={editingId}
        saving={saving}
        form={form}
        setForm={setForm}
        processes={productProcesses}
        products={products}
        productLabel={productLabel}
        onSave={() => void save()}
        onClose={closeModal}
      />
    </div>
  )
}
