export type MesTheme = 'dark' | 'light'

const STORAGE_KEY = 'mes-theme'

export function getStoredTheme(): MesTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function applyTheme(theme: MesTheme) {
  document.documentElement.dataset.theme = theme
}

export function initTheme() {
  applyTheme(getStoredTheme())
}

export function setTheme(theme: MesTheme) {
  applyTheme(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): MesTheme {
  const next: MesTheme = getStoredTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
