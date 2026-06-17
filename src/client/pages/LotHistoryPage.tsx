import { useMemo } from 'react'
import { ReadonlyDataPage } from '../ui/ReadonlyDataPage'

type Row = {
  id: number
  productionLotId: number
  eventType: string
  eventDesc: string | null
  createdAt: string
  productionLot?: { lotNo: string }
}

export function LotHistoryPage() {
  const columns = useMemo(
    () => [
      { header: 'LOT', cell: (r: Row) => r.productionLot?.lotNo ?? r.productionLotId },
      { header: '이벤트', cell: (r: Row) => r.eventType },
      {
        header: '설명',
        cell: (r: Row) => <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.eventDesc ?? '—'}</span>,
      },
      { header: '시각', cell: (r: Row) => String(r.createdAt).replace('T', ' ').slice(0, 19) },
    ],
    [],
  )

  return (
    <ReadonlyDataPage<Row>
      title="생산 LOT 이력"
      description="LOT 상태 변경 이벤트 로그(조회 전용)."
      fetchPath="/api/lot-histories"
      columns={columns}
    />
  )
}
