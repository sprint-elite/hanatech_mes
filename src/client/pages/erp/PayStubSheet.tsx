import {
  fmtKrDate,
  fmtWon,
  fmtYearMonth,
  RUN_STATUS_LABEL,
  type PayStubRow,
} from './payStubTypes'

type Props = {
  stub: PayStubRow
}

function padLines(lines: { label: string; amount: number }[], minRows: number) {
  const rows = [...lines]
  while (rows.length < minRows) rows.push({ label: '', amount: 0 })
  return rows
}

export function PayStubSheet({ stub }: Props) {
  const ym = stub.run?.yearMonth ?? ''
  const title = stub.run?.title ?? (ym ? `${fmtYearMonth(ym)}분` : '급여명세서')
  const payDate = stub.run?.payDate
  const isDraft = stub.run?.status === 'DRAFT'
  const maxRows = Math.max(stub.earnings.length, stub.deductions.length, 6)
  const earnings = padLines(stub.earnings, maxRows)
  const deductions = padLines(stub.deductions, maxRows)

  return (
    <article className="mesPsDocSheet" aria-label="급여명세서 A4 양식">
      {isDraft ? <div className="mesPsDocWatermark">작성중</div> : null}

      <header className="mesPsDocHeader">
        <h1 className="mesPsDocTitle">급 여 명 세 서</h1>
        <p className="mesPsDocSubtitle">{title}</p>
      </header>

      <table className="mesPsDocInfoTable" aria-label="근로자 정보">
        <tbody>
          <tr>
            <th scope="row">성명</th>
            <td>{stub.userName}</td>
            <th scope="row">부서</th>
            <td>{stub.dept === '—' ? '' : stub.dept}</td>
          </tr>
          <tr>
            <th scope="row">직위</th>
            <td>{stub.position === '—' ? '' : stub.position}</td>
            <th scope="row">입사일</th>
            <td>{stub.hireDate ? fmtKrDate(stub.hireDate) : ''}</td>
          </tr>
          <tr>
            <th scope="row">근무일수</th>
            <td>{stub.workDays != null ? `${stub.workDays}일` : ''}</td>
            <th scope="row">지급일</th>
            <td>{payDate ? fmtKrDate(payDate) : ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="mesPsDocColumns">
        <section className="mesPsDocCol" aria-label="지급">
          <h2 className="mesPsDocColTitle">지 급</h2>
          <table className="mesPsDocLineTable">
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">금액</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((line, i) => (
                <tr key={`e-${i}`}>
                  <td>{line.label}</td>
                  <td className="mesPsDocAmount">{line.amount ? fmtWon(line.amount) : ''}</td>
                </tr>
              ))}
              <tr className="mesPsDocTotalRow">
                <th scope="row">지급계</th>
                <td className="mesPsDocAmount">{fmtWon(stub.totalEarning)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mesPsDocCol" aria-label="공제">
          <h2 className="mesPsDocColTitle">공 제</h2>
          <table className="mesPsDocLineTable">
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">금액</th>
              </tr>
            </thead>
            <tbody>
              {deductions.map((line, i) => (
                <tr key={`d-${i}`}>
                  <td>{line.label}</td>
                  <td className="mesPsDocAmount">{line.amount ? fmtWon(line.amount) : ''}</td>
                </tr>
              ))}
              <tr className="mesPsDocTotalRow">
                <th scope="row">공제계</th>
                <td className="mesPsDocAmount">{fmtWon(stub.totalDeduction)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <table className="mesPsDocNetTable" aria-label="실지급액">
        <tbody>
          <tr>
            <th scope="row">실 지 급 액</th>
            <td className="mesPsDocNetAmount">{fmtWon(stub.netPay)}</td>
          </tr>
        </tbody>
      </table>

      {stub.remark ? (
        <div className="mesPsDocRemark">
          <strong>비고</strong>
          <p>{stub.remark}</p>
        </div>
      ) : null}

      <footer className="mesPsDocFooter">
        <p className="mesPsDocClosing">위와 같이 급여를 지급합니다.</p>
        <p className="mesPsDocDateLine">{fmtKrDate(payDate ?? new Date().toISOString().slice(0, 10))}</p>
        {stub.run?.status ? (
          <p className="mesPsDocStatusNote">상태: {RUN_STATUS_LABEL[stub.run.status]}</p>
        ) : null}
      </footer>
    </article>
  )
}
