import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { apiJson } from '../lib/api'
import { itemTypeLabel, productItemTypeCode } from '../lib/itemType'

type Product = { id: number; productCode: string; productName: string; itemType: string; specJson?: unknown }
type EbomLine = {
  id: number
  parentProductId: number
  childProductId: number
  qty: string
  unit: string
  spec: string | null
  lossRate: string | null
  sequence: number
  pathSequence: number | null
  remark: string | null
  inUnitPrice: string | null
  outUnitPrice: string | null
  useYn: 'Y' | 'N'
  childProduct?: Product
  parentProduct?: Product
}
type EbomParentGroup = { parentProduct: Product; lines: EbomLine[]; lineCount: number }

function optionLabel(p: Product): string {
  return `${p.productCode} · ${p.productName} (${itemTypeLabel(p.itemType)})`
}

function specFromJson(v: unknown): string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ''
  const s = (v as Record<string, unknown>).spec
  return typeof s === 'string' ? s : ''
}

export function EbomPage() {
  const [parents, setParents] = useState<EbomParentGroup[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null)
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const [childProductId, setChildProductId] = useState('')
  const [childSearch, setChildSearch] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('EA')
  const [spec, setSpec] = useState('')
  const [sequence, setSequence] = useState('0')
  const [pathSequence, setPathSequence] = useState('')
  const [remark, setRemark] = useState('')
  const [useYn, setUseYn] = useState<'Y' | 'N'>('Y')
  const [inUnitPrice, setInUnitPrice] = useState('')
  const [outUnitPrice, setOutUnitPrice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tree, prod] = await Promise.all([
        apiJson<{ ok: boolean; parents: EbomParentGroup[] }>('/api/ebom/tree'),
        apiJson<{ ok: boolean; items: Product[] }>('/api/products'),
      ])
      setParents(tree.parents)
      setProducts(prod.items)
      if (tree.parents.length > 0 && !selectedParentId) setSelectedParentId(tree.parents[0].parentProduct.id)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setParents([])
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [selectedParentId])

  useEffect(() => {
    void load()
  }, [load])

  const childOptions = useMemo(
    () =>
      products
        .filter((p) => {
          const t = productItemTypeCode(p.itemType)
          return t === 'RAW' || t === 'WIP'
        })
        .filter((p) => {
          const q = childSearch.trim().toLowerCase()
          if (q === '') return true
          return p.productCode.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q)
        })
        .sort((a, b) => a.productCode.localeCompare(b.productCode)),
    [products, childSearch],
  )

  const selectedParent = useMemo(
    () => parents.find((p) => p.parentProduct.id === selectedParentId) ?? null,
    [parents, selectedParentId],
  )

  const filteredParents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q === '') return parents
    return parents.filter((g) => {
      const code = g.parentProduct.productCode.toLowerCase()
      const name = g.parentProduct.productName.toLowerCase()
      return code.includes(q) || name.includes(q)
    })
  }, [parents, search])

  const resetForm = () => {
    setChildProductId('')
    setChildSearch('')
    setQty('1')
    setUnit('EA')
    setSpec('')
    setSequence('0')
    setPathSequence('')
    setRemark('')
    setUseYn('Y')
    setInUnitPrice('')
    setOutUnitPrice('')
    setEditingRow(null)
  }

  const onEditLine = (line: EbomLine) => {
    setEditingRow(line.id)
    setChildProductId(String(line.childProductId))
    setQty(line.qty)
    setUnit(line.unit ?? 'EA')
    setSpec(line.spec ?? specFromJson(line.childProduct?.specJson))
    setSequence(String(line.sequence ?? 0))
    setPathSequence(line.pathSequence != null ? String(line.pathSequence) : '')
    setRemark(line.remark ?? '')
    setUseYn(line.useYn)
    setInUnitPrice(line.inUnitPrice ?? '')
    setOutUnitPrice(line.outUnitPrice ?? '')
  }

  const saveLine = async () => {
    if (!selectedParentId) return
    const cp = Number(childProductId)
    if (!Number.isFinite(cp) || cp < 1) return setErr('하위 품목을 선택하세요.')
    setSaving(true)
    setErr(null)
    try {
      const body = {
        parentProductId: selectedParentId,
        childProductId: cp,
        qty: qty.trim(),
        unit: unit.trim() || 'EA',
        spec: spec.trim() === '' ? null : spec.trim(),
        sequence: Number(sequence) || 0,
        pathSequence: pathSequence.trim() === '' ? null : Number(pathSequence),
        remark: remark.trim() === '' ? null : remark.trim(),
        useYn,
        inUnitPrice: inUnitPrice.trim() === '' ? null : inUnitPrice.trim(),
        outUnitPrice: outUnitPrice.trim() === '' ? null : outUnitPrice.trim(),
      }
      if (editingRow == null) await apiJson('/api/ebom', { method: 'POST', body: JSON.stringify(body) })
      else await apiJson(`/api/ebom/${editingRow}`, { method: 'PATCH', body: JSON.stringify(body) })
      await load()
      resetForm()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number, ev: MouseEvent) => {
    ev.stopPropagation()
    if (!confirm('이 하위 BOM 행을 삭제할까요?')) return
    try {
      await apiJson(`/api/ebom/${id}`, { method: 'DELETE' })
      await load()
      if (editingRow === id) resetForm()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
    }
  }

  return (
    <div className="mesPage mesPageWide">
      <header className="mesPageHeadRow">
        <div>
          <h1 className="mesPageTitle">EBOM</h1>
          <p className="mesPageDesc">좌측 상위 BOM 목록, 우측 하위 BOM 상세/편집 구조로 관리합니다.</p>
        </div>
        <span className="mesCountPill">{loading ? '…' : `${parents.length}개 상위 BOM`}</span>
      </header>

      <div className="mesPanelCard" style={{ marginBottom: 10 }}>
        <div className="mesFieldRow mesFieldRow3" style={{ marginBottom: 0 }}>
          <label className="mesLabel">
            BOM 검색
            <input
              className="mesInput mono"
              placeholder="예: J3515-60 또는 품명"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="mesLabel">
            BOM 선택
            <select
              className="mesInput"
              value={selectedParentId ?? ''}
              onChange={(e) => setSelectedParentId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">선택하세요</option>
              {filteredParents.map((g) => (
                <option key={g.parentProduct.id} value={g.parentProduct.id}>
                  {g.parentProduct.productCode} · {g.parentProduct.productName}
                </option>
              ))}
            </select>
          </label>
          <div className="mesLabel">
            검색 결과
            <div className="mesInput mono" style={{ display: 'flex', alignItems: 'center' }}>
              {filteredParents.length}건
            </div>
          </div>
        </div>
      </div>

      {err ? (
        <div className="mesNotice mesNoticeError" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <section className="mesCrudMain">
        {selectedParent ? (
          <>
            <div className="mesPanelCard" style={{ marginBottom: 8 }}>
            <div className="mesPanelHead">
              <div className="mesEbomPanelHeadText">
                <div className="mesPanelTitle">하위 BOM 추가/수정</div>
                <span
                  className="mesOpsPlanContextChip mesEbomContextChip"
                  title={`${selectedParent.parentProduct.productCode} · ${selectedParent.parentProduct.productName}`}
                >
                  <span className="mesOpsPlanContextChipName">{selectedParent.parentProduct.productName}</span>
                </span>
              </div>
              <div className="mesModalHeadActions">
                <button type="button" className="mesBtnPrimary" disabled={!selectedParentId || saving} onClick={() => void saveLine()}>
                  {saving ? '저장 중…' : editingRow ? '행 수정' : '하위 BOM 추가'}
                </button>
                <button type="button" className="mesBtnSecondary" onClick={resetForm}>
                  입력 초기화
                </button>
              </div>
            </div>
            <div className="mesEbomFormGrid">
              <label className="mesLabel mesEbomSpan3">
                하위 품목 검색
                <input
                  className="mesInput mono"
                  placeholder="코드/품명 검색"
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                />
              </label>
              <label className="mesLabel mesEbomSpan3">
                하위 품목
                <select className="mesInput" value={childProductId} onChange={(e) => setChildProductId(e.target.value)}>
                  <option value="">선택하세요</option>
                  {childOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {optionLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mesLabel mesEbomSpan3">
                규격
                <input className="mesInput" value={spec} onChange={(e) => setSpec(e.target.value)} />
              </label>
              <label className="mesLabel mesEbomSpan1">
                수량
                <input className="mesInput" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              <label className="mesLabel mesEbomSpan2">
                단위
                <input className="mesInput" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </label>

              <label className="mesLabel mesEbomSpan2">
                경로순서
                <input className="mesInput" value={pathSequence} onChange={(e) => setPathSequence(e.target.value)} />
              </label>
              <label className="mesLabel mesEbomSpan2">
                표시순서
                <input className="mesInput" value={sequence} onChange={(e) => setSequence(e.target.value)} />
              </label>
              <label className="mesLabel mesEbomSpan3">
                비고
                <input className="mesInput" value={remark} onChange={(e) => setRemark(e.target.value)} />
              </label>
              <label className="mesLabel mesEbomSpan1">
                사용여부
                <select className="mesInput" value={useYn} onChange={(e) => setUseYn(e.target.value as 'Y' | 'N')}>
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </label>
              <label className="mesLabel mesEbomSpan2">
                입고단가
                <input className="mesInput" value={inUnitPrice} onChange={(e) => setInUnitPrice(e.target.value)} />
              </label>
              <label className="mesLabel mesEbomSpan2">
                판매단가
                <input className="mesInput" value={outUnitPrice} onChange={(e) => setOutUnitPrice(e.target.value)} />
              </label>
            </div>
            </div>

            <div className="mesTableViewport mesEbomLinesTable">
              <table className="mesTable mesTableSticky mesTableClick mesEbomLinesGrid">
              <colgroup>
                <col className="mesEbomColCode" />
                <col className="mesEbomColName" />
                <col className="mesEbomColSpec" />
                <col className="mesEbomColQty" />
                <col className="mesEbomColPath" />
                <col className="mesEbomColUseYn" />
                <col className="mesEbomColPrice" />
                <col className="mesEbomColPrice" />
                <col className="mesEbomColRemark" />
                <col className="mesEbomColAction" />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>품번</th>
                  <th style={{ textAlign: 'center' }}>품명</th>
                  <th style={{ textAlign: 'center' }}>규격</th>
                  <th style={{ textAlign: 'center' }}>수량</th>
                  <th style={{ textAlign: 'center' }}>경로순서</th>
                  <th style={{ textAlign: 'center' }}>사용여부</th>
                  <th style={{ textAlign: 'center' }}>입고단가</th>
                  <th style={{ textAlign: 'center' }}>판매단가</th>
                  <th style={{ textAlign: 'center' }}>비고</th>
                  <th className="mesThActions" style={{ textAlign: 'center' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {selectedParent.lines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="muted">등록된 하위 BOM이 없습니다.</td>
                  </tr>
                ) : (
                  selectedParent.lines.map((r) => (
                    <tr
                      key={r.id}
                      className={editingRow === r.id ? 'mesRowSelected' : undefined}
                      onClick={() => onEditLine(r)}
                    >
                      <td className="mono" style={{ textAlign: 'center' }}>{r.childProduct?.productCode ?? r.childProductId}</td>
                      <td style={{ textAlign: 'center' }}>{r.childProduct?.productName ?? '-'}</td>
                      <td style={{ textAlign: 'center' }}>{(r.spec ?? specFromJson(r.childProduct?.specJson)) || '-'}</td>
                      <td className="mono" style={{ textAlign: 'center' }}>{r.qty}</td>
                      <td style={{ textAlign: 'center' }}>{r.pathSequence ?? r.sequence}</td>
                      <td style={{ textAlign: 'center' }}>{r.useYn}</td>
                      <td className="mono mesEbomNum">{r.inUnitPrice ?? '0'}</td>
                      <td className="mono mesEbomNum">{r.outUnitPrice ?? '0'}</td>
                      <td style={{ textAlign: 'center' }}>{r.remark ?? '-'}</td>
                      <td className="mesTdActions">
                        <button type="button" className="mesBtnSm mesBtnDanger" onClick={(ev) => void remove(r.id, ev)}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="mesPanelCard">
            <p className="mesPanelHint">상단 필터에서 BOM을 검색하고 선택하면 하위 BOM 표가 표시됩니다.</p>
          </div>
        )}
      </section>
    </div>
  )
}
