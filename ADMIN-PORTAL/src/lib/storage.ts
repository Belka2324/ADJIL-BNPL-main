import { Role } from './types'

const SESSION_KEY = 'adjil_admin_session'
const ROLE_KEY = 'adjil_admin_role'

export type AdminSession = {
  username: string
  role: Role
  remember: boolean
  isCEO?: boolean // CEO has special privileges
}

export const getStoredRole = () => {
  const role = localStorage.getItem(ROLE_KEY)
  return role as Role | null
}

export const setStoredRole = (role: Role) => {
  localStorage.setItem(ROLE_KEY, role)
}

export const clearStoredRole = () => {
  localStorage.removeItem(ROLE_KEY)
}

export const saveSession = (session: AdminSession) => {
  if (session.remember) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
}

export const getSession = () => {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as AdminSession) : null
}

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}
