import { clearAuthSession, getStoredToken } from "@/lib/auth-storage"
import type { AuthUser } from "@/lib/auth-storage"

export function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  const fromEnv = raw?.trim().replace(/\/$/, "")
  if (fromEnv) return fromEnv
  // En `npm run dev` con túnel a Vite, conviene dejar VITE vacío: fetch → mismo host `/api` y
  // Vite hace proxy a Laravel (sin CORS ni depender de otra URL trycloudflare).
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return `${window.location.origin}/api`
  }
  return "http://127.0.0.1:8000/api"
}

export type LoginResponse = {
  token: string
  token_type: string
  user: AuthUser
}

export type ApiErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${apiBase()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  const data = (await res.json().catch(() => ({}))) as LoginResponse &
    ApiErrorBody

  if (!res.ok) {
    const err = new Error(
      data.message || "No se pudo iniciar sesión.",
    ) as Error & ApiErrorBody & { status: number }
    err.errors = data.errors
    err.status = res.status
    throw err
  }

  return data
}

export function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(message: string, status: number, body: ApiErrorBody) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

type ApiFetchQuery = Record<string, string | number | undefined | null>

export function buildApiUrl(path: string, query?: ApiFetchQuery): string {
  const base = apiBase().replace(/\/$/, "")
  const segment = path.startsWith("/") ? path.slice(1) : path
  let url = `${base}/${segment}`
  if (query) {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") p.set(k, String(v))
    }
    const qs = p.toString()
    if (qs) url += `?${qs}`
  }
  return url
}

/** Peticiones autenticadas al API Laravel (Sanctum Bearer). */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { query?: ApiFetchQuery },
): Promise<T> {
  const { query, headers: extraHeaders, ...rest } = init || {}
  const url = buildApiUrl(path, query)

  const mergedHeaders: Record<string, string> = {
    ...authHeaders(),
    ...(extraHeaders as Record<string, string> | undefined),
  }

  const res = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
  })

  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody

  if (res.status === 401) {
    clearAuthSession()
    const base = import.meta.env.BASE_URL.replace(/\/?$/, "")
    window.location.assign(`${base}/auth/basic/login`)
    throw new ApiError("Sesión expirada o no autorizada.", 401, {})
  }

  if (!res.ok) {
    const body = data as ApiErrorBody
    throw new ApiError(
      body.message || `Error ${res.status}`,
      res.status,
      body,
    )
  }

  return data as T
}

/** POST multipart (FormData). No establecer Content-Type manualmente. */
export async function apiFetchFormData<T>(
  path: string,
  formData: FormData,
  options?: { method?: string; query?: ApiFetchQuery },
): Promise<T> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const url = buildApiUrl(path, options?.query)
  const res = await fetch(url, {
    method: options?.method ?? "POST",
    headers,
    body: formData,
  })

  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody

  if (res.status === 401) {
    clearAuthSession()
    const base = import.meta.env.BASE_URL.replace(/\/?$/, "")
    window.location.assign(`${base}/auth/basic/login`)
    throw new ApiError("Sesión expirada o no autorizada.", 401, {})
  }

  if (!res.ok) {
    const body = data as ApiErrorBody
    throw new ApiError(
      body.message || `Error ${res.status}`,
      res.status,
      body,
    )
  }

  return data as T
}

/** Headers para descargar binarios (PDF, CSV) con el mismo token. */
export function authHeadersDownload(): Record<string, string> {
  const token = getStoredToken()
  const headers: Record<string, string> = { Accept: "*/*" }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** Descarga un archivo (certificado, PDF de OT, CSV de reportes, etc.). */
export async function apiDownloadFile(
  path: string,
  options?: { query?: ApiFetchQuery; fallbackName?: string },
): Promise<void> {
  const url = buildApiUrl(path, options?.query)
  const res = await fetch(url, { headers: authHeadersDownload() })

  if (res.status === 401) {
    clearAuthSession()
    const base = import.meta.env.BASE_URL.replace(/\/?$/, "")
    window.location.assign(`${base}/auth/basic/login`)
    throw new ApiError("Sesión expirada o no autorizada.", 401, {})
  }

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(
      errBody.message || `Error ${res.status}`,
      res.status,
      errBody,
    )
  }

  const blob = await res.blob()
  let name = options?.fallbackName ?? "descarga"
  const cd = res.headers.get("Content-Disposition")
  if (cd) {
    const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd)
    if (m) name = decodeURIComponent(m[1].trim())
  }

  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
