import { Navigate } from 'react-router-dom'

/** 업무일지 기능은 일정관리로 통합되었습니다. */
export function WorkLogsPage() {
  return <Navigate to="/erp/schedules" replace />
}
