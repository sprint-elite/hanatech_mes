import { fmtNum, fmtWorkRecord, type PayStubDetail } from './payStubDetailTypes'

type Props = {
  detail: PayStubDetail
}

export function PayStubDetailSheet({ detail }: Props) {
  const visibleEarnings = detail.earnings.filter((l) => l.amount > 0 || l.label)
  const visibleDeductions = detail.deductions.filter((l) => l.amount > 0 || l.label)

  return (
    <article className="mesPsDetailSheet" aria-label="급여명세표">
      <header className="mesPsDetailHead">
        <h1 className="mesPsDetailTitle">급여명세표</h1>
        <p className="mesPsDetailPeriod">{detail.yearMonthLabel}</p>
      </header>

      <table className="mesPsDetailMetaTable">
        <tbody>
          <tr>
            <th>지급일자</th>
            <td>{detail.payDateLabel || '—'}</td>
            <th>성명</th>
            <td>{detail.userName}</td>
          </tr>
          <tr>
            <th>부서</th>
            <td>{detail.dept || '—'}</td>
            <th>직위</th>
            <td>{detail.position || '—'}</td>
          </tr>
        </tbody>
      </table>

      <section className="mesPsDetailFormulaBox" aria-label="산출 기준">
        <p><strong>통상시급</strong> = {detail.hourlyRateFormula}</p>
        <p><strong>초과수당</strong> = {detail.overtimeNote}</p>
      </section>

      <section className="mesPsDetailSection">
        <h2 className="mesPsDetailSectionTitle">수당항목</h2>
        <table className="mesPsDetailTable mesPsDetailTable--earning">
          <colgroup>
            <col className="mesPsDetailCol mesPsDetailCol--name" />
            <col className="mesPsDetailCol mesPsDetailCol--type" />
            <col className="mesPsDetailCol mesPsDetailCol--work" />
            <col className="mesPsDetailCol mesPsDetailCol--unit" />
            <col className="mesPsDetailCol mesPsDetailCol--mult" />
            <col className="mesPsDetailCol mesPsDetailCol--amount" />
            <col className="mesPsDetailCol mesPsDetailCol--formula" />
          </colgroup>
          <thead>
            <tr>
              <th>수당항목명</th>
              <th>지급유형</th>
              <th>근무기록</th>
              <th>수당금액</th>
              <th>배율</th>
              <th>금액</th>
              <th>산출방법</th>
            </tr>
          </thead>
          <tbody>
            {visibleEarnings.map((line) => (
              <tr key={line.label}>
                <td>{line.label}</td>
                <td>{line.paymentTypeLabel}</td>
                <td className="mesPsDetailNum">{fmtWorkRecord(line.workRecord, line.paymentType)}</td>
                <td className="mesPsDetailNum">{line.unitAmount != null ? fmtNum(line.unitAmount) : ''}</td>
                <td className="mesPsDetailNum">{line.multiplier != null ? line.multiplier : ''}</td>
                <td className="mesPsDetailNum mesPsDetailAmount">{line.amount ? fmtNum(line.amount) : ''}</td>
                <td className="mesPsDetailFormula">{line.calcDescription}</td>
              </tr>
            ))}
            <tr className="mesPsDetailTotalRow">
              <th colSpan={5} scope="row">합계</th>
              <td className="mesPsDetailNum mesPsDetailAmount">{fmtNum(detail.totalEarning)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mesPsDetailSection">
        <h2 className="mesPsDetailSectionTitle">공제항목</h2>
        <table className="mesPsDetailTable mesPsDetailTable--deduction">
          <colgroup>
            <col className="mesPsDetailCol mesPsDetailCol--name" />
            <col className="mesPsDetailCol mesPsDetailCol--type" />
            <col className="mesPsDetailCol mesPsDetailCol--work" />
            <col className="mesPsDetailCol mesPsDetailCol--unit" />
            <col className="mesPsDetailCol mesPsDetailCol--mult" />
            <col className="mesPsDetailCol mesPsDetailCol--amount" />
            <col className="mesPsDetailCol mesPsDetailCol--formula" />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={3}>공제항목명</th>
              <th colSpan={3}>금액</th>
              <th>산출방법</th>
            </tr>
          </thead>
          <tbody>
            {visibleDeductions.map((line) => (
              <tr key={line.label}>
                <td colSpan={3}>{line.label}</td>
                <td colSpan={3} className="mesPsDetailNum mesPsDetailAmount">{line.amount ? fmtNum(line.amount) : ''}</td>
                <td className="mesPsDetailFormula">{line.calcDescription}</td>
              </tr>
            ))}
            <tr className="mesPsDetailTotalRow">
              <th colSpan={3} scope="row">합계</th>
              <td colSpan={3} className="mesPsDetailNum mesPsDetailAmount">{fmtNum(detail.totalDeduction)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </section>

      <table className="mesPsDetailNetTable">
        <tbody>
          <tr>
            <th>실 지급 액</th>
            <td>{fmtNum(detail.netPay)}원</td>
          </tr>
        </tbody>
      </table>
    </article>
  )
}
