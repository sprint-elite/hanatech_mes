import { ReadonlyDataPage } from '../ui/ReadonlyDataPage'

type Row = {
  id: number
  logType: string
  message: string
  refType: string | null
  refId: number | null
  createdAt: string
}

export function SystemLogsPage() {
  return (
    <ReadonlyDataPage<Row>
      title="시스템 로그"
      description="애플리케이션·연동 메시지(조회 전용)."
      fetchPath="/api/system-logs"
      columns={[
        { header: '유형', cell: (r) => r.logType },
        { header: '메시지', cell: (r) => <span style={{ fontSize: 12 }}>{r.message.slice(0, 120)}{r.message.length > 120 ? '…' : ''}</span> },
        { header: '참조', cell: (r) => (r.refType ? `${r.refType}#${r.refId}` : '—') },
        { header: '시각', cell: (r) => String(r.createdAt).replace('T', ' ').slice(0, 19) },
      ]}
    />
  )
}
