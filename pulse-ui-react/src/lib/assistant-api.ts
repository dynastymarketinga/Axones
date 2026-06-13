import { ApiError, apiBase, authHeaders } from "@/lib/api"
import type {
  AssistantChatContext,
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantStatus,
  AssistantSuggestionsResponse,
} from "@/types/assistant"

async function handle<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && typeof body.message === "string")
        ? body.message
        : fallback
    throw new ApiError(message, res.status, (body ?? {}) as ApiError["body"])
  }
  return body as T
}

export async function fetchAssistantStatus(signal?: AbortSignal): Promise<AssistantStatus> {
  const res = await fetch(`${apiBase()}/assistant/status`, {
    method: "GET",
    headers: authHeaders(),
    signal,
  })
  return handle<AssistantStatus>(res, "No se pudo leer el estado del asistente.")
}

export async function postAssistantChat(
  payload: AssistantChatRequest,
  signal?: AbortSignal,
): Promise<AssistantChatResponse> {
  const res = await fetch(`${apiBase()}/assistant/chat`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal,
  })
  return handle<AssistantChatResponse>(res, "El asistente no pudo responder.")
}

export async function fetchAssistantSuggestions(
  context: AssistantChatContext,
  signal?: AbortSignal,
): Promise<AssistantSuggestionsResponse> {
  const url = new URL(`${apiBase()}/assistant/suggestions`)
  for (const [k, v] of Object.entries(context)) {
    if (v === undefined || v === null || v === "") continue
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
    signal,
  })
  return handle<AssistantSuggestionsResponse>(res, "No se pudieron leer sugerencias.")
}
