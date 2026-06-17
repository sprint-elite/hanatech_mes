import { ReadonlyDataPage } from '../ui/ReadonlyDataPage'

type Row = {
  id: number
  lotId: number
  processId: number
  imagePath: string
  createdAt: string
  lot?: { lotNo: string }
  process?: { processCode: string }
}

export function VisionLogsPage() {
  return (
    <ReadonlyDataPage<Row>
      title="비전 검사 로그"
      description="이미지 경로·검사 시각(조회 전용)."
      fetchPath="/api/vision-raw-logs"
      columns={[
        { header: 'LOT', cell: (r) => r.lot?.lotNo ?? r.lotId },
        { header: '공정', cell: (r) => r.process?.processCode ?? r.processId },
        { header: '이미지', cell: (r) => <span className="mono" style={{ fontSize: 11 }}>{r.imagePath}</span> },
        { header: '시각', cell: (r) => String(r.createdAt).replace('T', ' ').slice(0, 19) },
      ]}
    />
  )
}
