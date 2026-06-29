import { useEffect, useState } from 'react'
import { apiJson } from '../../lib/api'
import { PayStubDetailSheet } from './PayStubDetailSheet'
import type { PayStubDetail } from './payStubDetailTypes'
import type { PayStubRow } from './payStubTypes'

type Props = {
  stub: PayStubRow
  onClose: () => void
}

export function PayStubViewModal({ stub, onClose }: Props) {
  const [detail, setDetail] = useState<PayStubDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void apiJson<{ ok: boolean; detail: PayStubDetail }>(`/api/pay-stubs/${stub.id}/detail`)
      .then((res) => {
        if (!cancelled) {
          setDetail(res.detail)
          setErr(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'unknown error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stub.id])

  const printForm = () => {
    window.print()
  }

  const exportExcel = async () => {
    if (!detail) return
    const { exportPayStubDetailExcel } = await import('../../lib/payrollExcel')
    exportPayStubDetailExcel(detail)
  }

  return (
    <div className="mesPsModalRoot mesPsModalRoot--doc" role="presentation">
      <button type="button" className="mesModalBackdrop mesPsNoPrint" aria-label="닫기" onClick={onClose} />
      <div className="mesPsDocDialog mesPsDocDialog--detail" role="dialog" aria-modal="true" aria-labelledby="mes-ps-doc-title">
        <header className="mesPsDocHeadBar mesPsNoPrint">
          <h2 className="mesPsDocHeadTitle" id="mes-ps-doc-title">급여명세표</h2>
          <div className="mesPsDocHeadActions">
            <button type="button" className="mesPsDocPrintBtn" onClick={printForm} disabled={!detail}>인쇄</button>
            <button type="button" className="mesPsDocPrintBtn mesPsDocExcelBtn" onClick={() => void exportExcel()} disabled={!detail}>Excel</button>
            <button type="button" className="mesPsDocCloseBtn" onClick={onClose}>닫기</button>
          </div>
        </header>

        {loading ? <p className="mesPsDetailLoading">불러오는 중…</p> : null}
        {err ? <p className="mesPsDetailError" role="alert">{err}</p> : null}
        {detail ? <PayStubDetailSheet detail={detail} /> : null}
      </div>
    </div>
  )
}
