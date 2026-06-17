import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '../lib/api'

type Row = {
  id: number
  productionLotId: number
  processId: number
  processSequence: number
  inputQty: number
  goodQty: number
  defectQty: number
  startTime: string | null
  endTime: string | null
  createdAt: string
  lot: { lotNo: string }
  process: { processCode: string; processName: string }
  worker: { workerCode: string; workerName: string } | null
  workCenter: { centerCode: string; centerName: string } | null
}

export function ProcessHistoryPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: Row[] }>('/api/process-results')
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

  return (
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">공정 실적 이력</h1>
        <p className="mesPageDesc">등록된 공정 실적을 조회합니다. (삭제는 비즈니스 정책상 API 미제공)</p>
      </header>

      <div className="mesToolbar">
        <button type="button" className="mesBtnSecondary" onClick={() => void load()}>
          새로고침
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}

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
              <th>작업자</th>
              <th>작업장</th>
              <th>등록</th>
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
                  실적이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((r) => (
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
                  <td>
                    {r.worker ? `${r.worker.workerCode} · ${r.worker.workerName}` : '—'}
                  </td>
                  <td>
                    {r.workCenter ? `${r.workCenter.centerCode}` : '—'}
                  </td>
                  <td className="small muted">{new Date(r.createdAt).toLocaleString('ko-KR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
