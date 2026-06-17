const TOKEN_KEY = "axones_auth_token"
const USER_KEY = "axones_auth_user"

export type AuthUser = {
  id: number
  name: string
  email: string
  username?: string | null
  role?: string
  avatar_url?: string | null
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setAuthSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("axones-auth-updated"))
  }
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
