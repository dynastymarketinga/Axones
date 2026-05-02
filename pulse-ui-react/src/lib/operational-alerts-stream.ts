import { apiBase, authHeaders } from "@/lib/api"

export type StreamAlertPayload = {
  id: number
  alert_type: string
  severity: string
  message: string
  created_at: string
  acknowledged_at: string | null
  metadata?: Record<string, unknown>
  work_order?: { id?: number; code?: string }
}

/**
 * Lee un bloque SSE (hasta que el servidor cierra la conexión). Reconectar desde el caller con after_id actualizado.
 */
export async function readOperationalAlertStream(
  afterId: number,
  onRow: (row: StreamAlertPayload) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `${apiBase()}/alerts/stream?after_id=${afterId}`,
    {
      method: "GET",
      headers: {
        ...authHeaders(),
        Accept: "text/event-stream",
      },
      signal,
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `stream ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error("Sin cuerpo en la respuesta del stream")
  }

  const decoder = new TextDecoder()
  let buffer = ""

  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep = buffer.indexOf("\n\n")
    while (sep !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      let dataLine: string | null = null
      for (const line of raw.split("\n")) {
        if (line.startsWith("data: ")) {
          dataLine = line.slice(6).trim()
        }
      }
      if (dataLine) {
        try {
          const row = JSON.parse(dataLine) as StreamAlertPayload
          if (row?.id) onRow(row)
        } catch {
          // ping u otro payload
        }
      }
      sep = buffer.indexOf("\n\n")
    }
  }
}
