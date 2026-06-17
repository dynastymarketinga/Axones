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
  login: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${apiBase()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ login: login.trim(), password }),
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

export async function passwordResetRequest(login: string): Promise<{ message: string }> {
  const res = await fetch(`${apiBase()}/auth/password-reset-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ login: login.trim() }),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string } & ApiErrorBody
  if (!res.ok) {
    throw new ApiError(
      data.message || "No se pudo registrar la solicitud.",
      res.status,
      data,
    )
  }
  return { message: data.message ?? "" }
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

async function fetchApiResponse(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const maxAttempts = 2
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetch(url, init)
    } catch (e) {
      lastError = e
      if (isApiAbortError(e)) throw e
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 350))
      }
    }
  }
  throw lastError
}

/** Petición cancelada (AbortController) — no es error de red. */
export function isApiAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true
  return e instanceof Error && e.name === "AbortError"
}

function isNetworkFetchError(e: unknown): boolean {
  if (isApiAbortError(e)) return false
  return e instanceof TypeError
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

  let res: Response
  try {
    res = await fetchApiResponse(url, {
      ...rest,
      headers: mergedHeaders,
    })
  } catch (e) {
    if (isApiAbortError(e)) throw e
    throw new ApiError(
      isNetworkFetchError(e)
        ? "No se pudo contactar al servidor. Compruebe que Laravel esté en marcha (php artisan serve) y recargue la página."
        : "Error de red al contactar al servidor.",
      0,
      {},
    )
  }

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

export type UpdateCurrentUserPasswordPayload = {
  current_password: string
  password: string
  password_confirmation: string
}

export async function updateCurrentUserPassword(
  payload: UpdateCurrentUserPasswordPayload,
): Promise<{ message: string; requires_relogin?: boolean }> {
  return apiFetch("user/password", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export type UserAvatarResponse = {
  message: string
  user: AuthUser
}

export async function uploadUserAvatar(file: File): Promise<UserAvatarResponse> {
  const token = getStoredToken()
  const form = new FormData()
  form.append("avatar", file)

  const res = await fetch(`${apiBase()}/user/avatar`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })

  const data = (await res.json().catch(() => ({}))) as UserAvatarResponse & ApiErrorBody
  if (!res.ok) {
    throw new ApiError(data.message || "No se pudo subir la foto.", res.status, data)
  }
  return data
}

export async function deleteUserAvatar(): Promise<UserAvatarResponse> {
  return apiFetch<UserAvatarResponse>("user/avatar", { method: "DELETE" })
}
