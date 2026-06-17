import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { apiJson } from '../lib/api'

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
    <div className="mesPage">
      <header className="mesPageHead">
        <h1 className="mesPageTitle">{title}</h1>
        <p className="mesPageDesc">{description}</p>
      </header>
      <div className="mesToolbar">
        <button type="button" className="mesBtnPrimary" onClick={() => void load()}>
          새로고침
        </button>
      </div>
      {err ? <div className="error mesBanner">{err}</div> : null}
      <div className="mesTableWrap mesTableScroll">
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
  )
}
