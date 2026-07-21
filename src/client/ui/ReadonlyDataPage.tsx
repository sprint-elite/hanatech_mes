import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { apiJson } from '../lib/api'
import '../list-page.css'

type Col<T> = {
  header: string
  cell: (row: T) => ReactNode
}

type Props<T> = {
  title: string
  description: string
  fetchPath: string
  columns: Col<T>[]
}

export function ReadonlyDataPage<T>({ title, description, fetchPath, columns }: Props<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<{ ok: boolean; items: T[] }>(fetchPath)
      setRows(data.items)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unknown error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fetchPath])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mesPage mesPageWide mesListPage">
      <header className="mesListHead">
        <div className="mesListHeadMain">
          <h1 className="mesListTitle">{title}</h1>
          <p className="mesListDesc">{description}</p>
        </div>
        <div className="mesListHeadActions">
          <span className="mesListCountBadge">{rows.length}건</span>
          <button type="button" className="mesListBtn mesListBtn--secondary" onClick={() => void load()}>
            새로고침
          </button>
        </div>
      </header>
      {err ? <div className="error mesBanner mesListNotice">{err}</div> : null}
      <div className="mesListTableCard">
        <div className="mesTableWrap mesListTableViewport">
          <table className="mesTable">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="muted">
                    로딩 중…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.header}>{c.cell(row)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
