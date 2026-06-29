export type MesAuthUser = {
  id: number
  loginId: string
  userName: string
  roleId: number
  workerId: number | null
  roleName: string
}

const STORAGE_KEY = 'mes_auth_user'

export function getStoredUser(): MesAuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MesAuthUser
  } catch {
    return null
  }
}

export function setStoredUser(user: MesAuthUser | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function getSysUserHeader(): string | undefined {
  return getStoredUser()?.loginId
}
