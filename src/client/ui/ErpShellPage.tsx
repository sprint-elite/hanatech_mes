import '../erp-page.css'

type Props = {
  title: string
  description: string
}

export function ErpShellPage({ title, description }: Props) {
  return (
    <div className="mesPage mesPageWide mesErpPage">
      <header className="mesErpHead">
        <div>
          <p className="mesErpKicker">ERP</p>
          <h1 className="mesErpTitle">{title}</h1>
          <p className="mesErpDesc">{description}</p>
        </div>
      </header>
      <section className="mesErpShell" aria-label={`${title} 준비 중`}>
        <div className="mesErpShellIcon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <h2 className="mesErpShellTitle">기능 구현 예정</h2>
        <p className="mesErpShellText">
          {title} 화면은 준비 중입니다. 등록·조회·관리 기능을 순차적으로 추가할 예정입니다.
        </p>
      </section>
    </div>
  )
}
