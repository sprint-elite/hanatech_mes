import { useCallback, useEffect, useMemo, useState, type SVGProps } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { getStoredTheme, setTheme, type MesTheme } from '../lib/theme'

type NavItem = { to: string; label: string; end?: boolean }

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: '운영',
    items: [
      { to: '/', label: '대시보드', end: true },
      { to: '/integrated-ops', label: '통합 생산 운영' },
    ],
  },
  {
    label: '기준정보',
    items: [
      { to: '/products', label: '품목' },
      { to: '/customers', label: '고객/업체' },
      { to: '/ebom', label: 'EBOM' },
      { to: '/work-centers', label: '작업장' },
      { to: '/workers', label: '작업자' },
      { to: '/defect-types', label: '불량유형' },
      { to: '/defect-history', label: '불량이력' },
      { to: '/mbom', label: 'MBOM 공정' },
      { to: '/mbom-materials', label: 'MBOM 투입자재' },
      { to: '/locations', label: '창고·위치' },
    ],
  },
  {
    label: '계획·지시',
    items: [
      { to: '/production-plans', label: '생산 계획' },
      { to: '/work-orders', label: '작업 지시' },
    ],
  },
  {
    label: '생산·LOT',
    items: [
      { to: '/lots', label: '생산 LOT' },
      { to: '/material-lots', label: '자재 LOT' },
      { to: '/lot-history', label: 'LOT 이력' },
      { to: '/lot-material-usage', label: '자재 투입' },
      { to: '/process-result', label: '실적 등록' },
      { to: '/worker-input', label: '현장 입력 (모바일)' },
      { to: '/process-history', label: '실적 이력' },
    ],
  },
  {
    label: '재고·출하·외주',
    items: [
      { to: '/inventory', label: '재고' },
      { to: '/stock-movements', label: '입출고관리' },
      { to: '/shipments', label: '출하' },
      { to: '/outsourcing', label: '외주' },
      { to: '/barcodes', label: '바코드' },
    ],
  },
  {
    label: '시스템',
    items: [
      { to: '/roles', label: '역할' },
      { to: '/users', label: '사용자' },
      { to: '/notices', label: '공지' },
      { to: '/audit-logs', label: '감사 로그' },
      { to: '/system-logs', label: '시스템 로그' },
      { to: '/vision-logs', label: '비전 로그' },
    ],
  },
]

function pathMatchesItem(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  )
}

function groupIcon(label: string) {
  switch (label) {
    case '운영':
      return (
        <Svg>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </Svg>
      )
    case '기준정보':
      return (
        <Svg>
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <path d="M7 7h.01" />
        </Svg>
      )
    case '계획·지시':
      return (
        <Svg>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </Svg>
      )
    case '생산·LOT':
      return (
        <Svg>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </Svg>
      )
    case '재고·출하·외주':
      return (
        <Svg>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.27 6.96 12 12.01l8.73-5.05" />
          <path d="M12 22.08V12" />
        </Svg>
      )
    case '시스템':
      return (
        <Svg>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </Svg>
      )
    default:
      return (
        <Svg>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </Svg>
      )
  }
}

function ThemeIcon({ theme }: { theme: MesTheme }) {
  if (theme === 'dark') {
    return (
      <Svg width={16} height={16}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </Svg>
    )
  }
  return (
    <Svg width={16} height={16}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Svg>
  )
}

export function Layout() {
  const location = useLocation()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [theme, setThemeState] = useState<MesTheme>(() => getStoredTheme())

  const handleThemeToggle = useCallback(() => {
    const next: MesTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }, [theme])

  const activeGroupLabel = useMemo(() => {
    for (const g of navGroups) {
      if (g.items.some((item) => pathMatchesItem(location.pathname, item))) return g.label
    }
    return navGroups[0]?.label ?? ''
  }, [location.pathname])

  useEffect(() => {
    if (!activeGroupLabel) return
    setExpanded((prev) => ({ ...prev, [activeGroupLabel]: true }))
  }, [activeGroupLabel])

  const toggleGroup = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="mesShell">
      <aside className="mesSide">
        <div className="mesSideTop">
          <button
            type="button"
            className="mesThemeToggle"
            onClick={handleThemeToggle}
            aria-label={theme === 'dark' ? '밝은 모드로 전환' : '어두운 모드로 전환'}
            title={theme === 'dark' ? '밝은 모드' : '어두운 모드'}
          >
            <span className="mesThemeToggleIcon" aria-hidden>
              <ThemeIcon theme={theme} />
            </span>
            <span className="mesThemeToggleLabel">{theme === 'dark' ? '밝은 모드' : '어두운 모드'}</span>
          </button>
          <div className="mesBrand">
            <div className="mesBrandTitle">HANA-TECH</div>
            <div className="mesBrandMes">MES</div>
            <div className="mesBrandSub">Manufacturing Execution</div>
          </div>
          <div className="mesStatusStrip" title="클라이언트 세션">
            <span className="mesStatusLed" aria-hidden />
            <span className="mesStatusText">현장 단말</span>
          </div>
        </div>
        <div className="mesSideBody mesSideBodyAccordion">
          {navGroups.map((g, gi) => {
            const open = !!expanded[g.label]
            const headId = `mes-nav-head-${gi}`
            const panelId = `mes-nav-panel-${gi}`
            return (
              <div key={g.label} className="mesAccordionGroup">
                <button
                  type="button"
                  className="mesAccordionTrigger"
                  aria-expanded={open}
                  aria-controls={panelId}
                  id={headId}
                  onClick={() => toggleGroup(g.label)}
                >
                  <span className="mesAccordionIcon">{groupIcon(g.label)}</span>
                  <span className="mesAccordionTitle">{g.label}</span>
                  <span className="mesAccordionChevron" aria-hidden>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={headId}
                  className="mesAccordionPanel"
                  hidden={!open}
                >
                  <nav className="mesNav mesNavSub">
                    {g.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => `mesNavLink mesNavLinkSub${isActive ? ' mesNavLinkActive' : ''}`}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
              </div>
            )
          })}
        </div>
      </aside>
      <div className="mesMain">
        <div className="mesMainBar" aria-hidden />
        <div className="mesMainInner">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
