import { useEffect, useRef, useState } from "react"

import { fetchAssistantStatus } from "@/lib/assistant-api"
import type { AssistantStatus } from "@/types/assistant"

type State = {
  status: AssistantStatus | null
  loading: boolean
  error: string | null
}

/**
 * Lee /api/assistant/status una sola vez (o cuando se llama refresh). Si el
 * usuario no está autenticado, el endpoint igual responde con enabled/allowed.
 */
export function useAssistantStatus(): State & { refresh: () => void } {
  const [state, setState] = useState<State>({ status: null, loading: true, error: null })
  const reqRef = useRef<AbortController | null>(null)

  const refresh = () => {
    reqRef.current?.abort()
    const ctrl = new AbortController()
    reqRef.current = ctrl
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchAssistantStatus(ctrl.signal)
      .then((status) => {
        if (ctrl.signal.aborted) return
        setState({ status, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        const message = err instanceof Error ? err.message : "Error desconocido."
        setState({ status: null, loading: false, error: message })
      })
  }

  useEffect(() => {
    refresh()
    return () => reqRef.current?.abort()
     
  }, [])

  return { ...state, refresh }
}
