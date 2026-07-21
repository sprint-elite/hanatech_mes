import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '../lib/api'
import '../lot-material-usage-page.css'

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

type Filters = { q: string }

const emptyFilters = (): Filters => ({ q: '' })

function formatTs(v: string): string {
  return String(v).replace('T', ' ').slice(0, 19)
}

function materialCell(r: Row): string {
  if (r.materialLot?.lotNo) return r.materialLot.lotNo
  if (r.materialProduct) return `${r.materialProduct.productCode} · ${r.materialProduct.productName} (LOT 미지정)`
  if (r.materialLotId != null) return String(r.materialLotId)
  return '—'
}

function matchesFilters(row: Row, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase()
  if (!q) return true
  const hay = [
    row.productionLot?.lotNo ?? '',
    String(row.productionLotId),
    materialCell(row),
    row.usedQty,
    formatTs(row.createdAt),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function parseQty(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
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

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 3v6h6" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2 3 7l9 5 9-5-9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </svg>
  )
}

function IconPackage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3 3 8v8l9 5 9-5V8l-9-5Z" />
      <path d="M12 12v9" />
      <path d="M3 8l9 5 9-5" />
    </svg>
  )
}

export function LotMaterialUsagePage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
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

  const filteredItems = useMemo(
    () => items.filter((row) => matchesFilters(row, filters)),
    [items, filters],
  )

  const stats = useMemo(() => {
    const prodLots = new Set<number>()
    const matLots = new Set<number>()
    let totalQty = 0
    for (const row of filteredItems) {
      prodLots.add(row.productionLotId)
      if (row.materialLotId != null) matLots.add(row.materialLotId)
      totalQty += parseQty(row.usedQty)
    }
    return {
      total: filteredItems.length,
      prodLotCount: prodLots.size,
      matLotCount: matLots.size,
      totalQty,
    }
  }, [filteredItems])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

  const applyFilters = () => {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    const empty = emptyFilters()
    setDraftFilters(empty)
    setFilters(empty)
    setPage(1)
  }

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
    <div className="mesPage mesPageWide mesLmuPage">
      <header className="mesLmuHead">
        <div className="mesLmuHeadMain">
          <h1 className="mesLmuTitle">자재 투입</h1>
          <p className="mesLmuDesc">
            트랜잭션: 자재 LOT 잔량 차감·투입 이력·LOT 이력·(재고 연동 시) 재고 OUT·작업지시 소요량 반영(선택). 마지막 공정 실적(백플러시)에서 LOT
            미지정 재고만 쓴 경우에도 품목 기준으로 투입 행이 남습니다.
          </p>
        </div>
        <div className="mesLmuHeadActions">
          <span className="mesLmuCountBadge">{loading ? '…' : `${filteredItems.length}건`}</span>
          <button type="button" className="mesLmuBtn mesLmuBtn--secondary" onClick={() => void load()}>
            <IconRefresh />
            새로고침
          </button>
          <button type="button" className="mesLmuBtn mesLmuBtn--primary" onClick={openPanel}>
            <IconPlus />
            자재 투입
          </button>
        </div>
      </header>

      {err ? (
        <div className="mesNotice mesNoticeError mesLmuNotice" role="alert">
          <div className="mesNoticeBody">
            <span className="mesNoticeTitle">오류</span>
            <span className="mesNoticeText">{err}</span>
          </div>
          <button type="button" className="mesNoticeDismiss" onClick={() => setErr(null)} aria-label="닫기">
            ×
          </button>
        </div>
      ) : null}

      <div className="mesLmuFilterCard">
        <div className="mesLmuField mesLmuField--search">
          <span className="mesLmuFieldLabel">검색</span>
          <div className="mesLmuInputWrap">
            <span className="mesLmuInputIcon">
              <IconSearch />
            </span>
            <input
              className="mesLmuInput mesLmuInput--search"
              placeholder="생산 LOT / 자재 LOT / 품목 검색"
              value={draftFilters.q}
              onChange={(ev) => setDraftFilters((f) => ({ ...f, q: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') applyFilters()
              }}
            />
          </div>
        </div>
        <div className="mesLmuFilterActions">
          <button type="button" className="mesLmuBtn mesLmuBtn--secondary" onClick={resetFilters}>
            <IconReset />
            필터 초기화
          </button>
          <button type="button" className="mesLmuBtn mesLmuBtn--primary" onClick={applyFilters}>
            <IconFilter />
            필터 적용
          </button>
        </div>
      </div>

      <div className="mesLmuStatsStrip" aria-label="자재 투입 요약">
        <div className="mesLmuStatItem">
          <div className="mesLmuStatIcon mesLmuStatIcon--blue">
            <IconClipboard />
          </div>
          <div className="mesLmuStatMeta">
            <p className="mesLmuStatLabel">전체 투입</p>
            <p className="mesLmuStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLmuStatValueNum">{stats.total}</span>
                  <span className="mesLmuStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLmuStatItem">
          <div className="mesLmuStatIcon mesLmuStatIcon--purple">
            <IconLayers />
          </div>
          <div className="mesLmuStatMeta">
            <p className="mesLmuStatLabel">생산 LOT</p>
            <p className="mesLmuStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLmuStatValueNum">{stats.prodLotCount}</span>
                  <span className="mesLmuStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLmuStatItem">
          <div className="mesLmuStatIcon mesLmuStatIcon--green">
            <IconPackage />
          </div>
          <div className="mesLmuStatMeta">
            <p className="mesLmuStatLabel">자재 LOT</p>
            <p className="mesLmuStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLmuStatValueNum">{stats.matLotCount}</span>
                  <span className="mesLmuStatValueUnit">건</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mesLmuStatItem">
          <div className="mesLmuStatIcon mesLmuStatIcon--gold">
            <IconBox />
          </div>
          <div className="mesLmuStatMeta">
            <p className="mesLmuStatLabel">총 투입량</p>
            <p className="mesLmuStatValue">
              {loading ? (
                '…'
              ) : (
                <>
                  <span className="mesLmuStatValueNum">{stats.totalQty.toLocaleString('ko-KR')}</span>
                  <span className="mesLmuStatValueUnit">EA</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mesLmuTableCard">
        <div className="mesLmuTableViewport">
          <table className="mesLmuTable">
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
                  <td colSpan={4} className="mesLmuEmpty">
                    로딩 중…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="mesLmuEmpty">
                    {items.length === 0 ? (
                      <>
                        데이터가 없습니다. <strong>자재 투입</strong>으로 등록하세요.
                      </>
                    ) : (
                      '필터 조건에 맞는 이력이 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.productionLot?.lotNo ?? r.productionLotId}</td>
                    <td>{materialCell(r)}</td>
                    <td className="mono">{parseQty(r.usedQty).toLocaleString('ko-KR')}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {formatTs(r.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mesLmuPager">
          <span className="mesLmuPagerTotal">전체 {filteredItems.length}건</span>
          <nav className="mesLmuPagerNav" aria-label="페이지">
            <button type="button" className="mesLmuPagerBtn" disabled={page <= 1} onClick={() => setPage(1)} aria-label="첫 페이지">
              «
            </button>
            <button
              type="button"
              className="mesLmuPagerBtn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1]
                const showEllipsis = prev != null && n - prev > 1
                return (
                  <span key={n} style={{ display: 'contents' }}>
                    {showEllipsis ? (
                      <span className="mesLmuPagerBtn" style={{ border: 'none', background: 'transparent' }}>
                        …
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`mesLmuPagerBtn${n === page ? ' mesLmuPagerBtn--active' : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                )
              })}
            <button
              type="button"
              className="mesLmuPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              className="mesLmuPagerBtn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="마지막 페이지"
            >
              »
            </button>
          </nav>
          <div className="mesLmuPageSize">
            <select
              value={pageSize}
              onChange={(ev) => {
                setPageSize(Number(ev.target.value))
                setPage(1)
              }}
              aria-label="페이지당 표시 건수"
            >
              <option value={10}>10개씩 보기</option>
              <option value={20}>20개씩 보기</option>
              <option value={50}>50개씩 보기</option>
            </select>
          </div>
        </footer>
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
