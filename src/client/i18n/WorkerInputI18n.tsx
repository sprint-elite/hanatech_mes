import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  WI_LOCALES,
  WI_LOCALE_LABELS,
  WI_MESSAGES,
  formatWiMessage,
  getStoredWiLocale,
  setStoredWiLocale,
  type WiLocale,
  type WiMessageKey,
} from './workerInput'

type WiI18nContextValue = {
  locale: WiLocale
  setLocale: (locale: WiLocale) => void
  t: (key: WiMessageKey, vars?: Record<string, string | number>) => string
  steps: string[]
}

const WiI18nContext = createContext<WiI18nContextValue | null>(null)

export function WorkerInputI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<WiLocale>(() => getStoredWiLocale())

  const setLocale = useCallback((next: WiLocale) => {
    setStoredWiLocale(next)
    setLocaleState(next)
  }, [])

  const t = useCallback(
    (key: WiMessageKey, vars?: Record<string, string | number>) =>
      formatWiMessage(WI_MESSAGES[locale][key], vars),
    [locale],
  )

  const steps = useMemo(
    () => [t('stepLot'), t('stepResult'), t('stepDefect'), t('stepConfirm')],
    [t],
  )

  const value = useMemo(() => ({ locale, setLocale, t, steps }), [locale, setLocale, t, steps])

  return <WiI18nContext.Provider value={value}>{children}</WiI18nContext.Provider>
}

export function useWorkerInputI18n(): WiI18nContextValue {
  const ctx = useContext(WiI18nContext)
  if (!ctx) throw new Error('useWorkerInputI18n must be used within WorkerInputI18nProvider')
  return ctx
}

export function WorkerInputLanguageBar() {
  const { locale, setLocale, t } = useWorkerInputI18n()

  return (
    <div className="wi__langBar" role="group" aria-label={t('language')}>
      {WI_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={`wi__langBtn${locale === code ? ' wi__langBtn--active' : ''}`}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
        >
          {WI_LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  )
}
