import { ReadonlyDataPage } from '../ui/ReadonlyDataPage'

type Row = {
  id: number
  productId: number
  fromProcessId: number | null
  toProcessId: number | null
  conditionType: string | null
  product?: { productCode: string; productName: string }
  fromProcess?: { processCode: string; processName: string } | null
  toProcess?: { processCode: string; processName: string } | null
}

export function ProcessRoutingPage() {
  return (
    <ReadonlyDataPage<Row>
      title="공정 라우팅"
      description="품목별 공정 간 이동·분기 조건(조회 전용)."
      fetchPath="/api/process-routings"
      columns={[
        { header: '품목', cell: (r) => (r.product ? `${r.product.productCode}` : r.productId) },
        { header: 'FROM', cell: (r) => (r.fromProcess ? r.fromProcess.processCode : '—') },
        { header: 'TO', cell: (r) => (r.toProcess ? r.toProcess.processCode : '—') },
        { header: '조건', cell: (r) => r.conditionType ?? '—' },
      ]}
    />
  )
}
