import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"

import { fetchAssistantSuggestions, postAssistantChat } from "@/lib/assistant-api"
import { deriveAssistantContext } from "@/lib/axones-assistant-context"
import { getStoredUser } from "@/lib/auth-storage"
import type {
  AssistantChip,
  AssistantMessageItem,
  AssistantRateLimit,
} from "@/types/assistant"

type State = {
  messages: AssistantMessageItem[]
  chips: AssistantChip[]
  sending: boolean
  error: string | null
  rateLimit: AssistantRateLimit | null
  lastModelUsed: string | null
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Estado del panel del asistente: historial de mensajes (solo en memoria),
 * sugerencias contextuales por ruta y envío al backend.
 */
export type AssistantSendOptions = {
  force_analysis?: boolean
  tool?: string
  tool_params?: Record<string, unknown>
}

export function useAxonesAssistant(open: boolean): State & {
  send: (text: string, opts?: AssistantSendOptions) => Promise<void>
  clear: () => void
} {
  const location = useLocation()
  const user = getStoredUser()
  const [state, setState] = useState<State>({
    messages: [],
    chips: [],
    sending: false,
    error: null,
    rateLimit: null,
    lastModelUsed: null,
  })
  const sendCtrlRef = useRef<AbortController | null>(null)
  const suggestCtrlRef = useRef<AbortController | null>(null)

  const context = useMemo(
    () => deriveAssistantContext(location.pathname, user?.role),
    [location.pathname, user?.role],
  )

  useEffect(() => {
    if (!open) return
    suggestCtrlRef.current?.abort()
    const ctrl = new AbortController()
    suggestCtrlRef.current = ctrl
    fetchAssistantSuggestions(context, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return
        const chips = res.follow_up_chips ?? res.data?.chips ?? []
        setState((s) => ({ ...s, chips }))
      })
      .catch(() => {
        // Las sugerencias son secundarias; si fallan, dejamos chips previos.
      })
    return () => ctrl.abort()
  }, [open, context])

  const send = useCallback(
    async (text: string, opts?: AssistantSendOptions) => {
      const trimmed = text.trim()
      if (!trimmed) return
      sendCtrlRef.current?.abort()
      const ctrl = new AbortController()
      sendCtrlRef.current = ctrl

      const userMsg: AssistantMessageItem = {
        id: newId(),
        role: "user",
        text: trimmed,
        createdAt: Date.now(),
      }
      setState((s) => ({ ...s, sending: true, error: null, messages: [...s.messages, userMsg] }))

      try {
        const res = await postAssistantChat(
          {
            message: trimmed,
            context,
            ...(opts?.tool ? { tool: opts.tool } : {}),
            ...(opts?.tool_params ? { tool_params: opts.tool_params } : {}),
            ...(opts?.force_analysis ? { force_analysis: true } : {}),
          },
          ctrl.signal,
        )
        if (ctrl.signal.aborted) return
        const reply: AssistantMessageItem = {
          id: newId(),
          role: "assistant",
          text: res.assistant_message,
          dots: res.dots,
          chips: res.follow_up_chips,
          toolsUsed: res.tools_used,
          createdAt: Date.now(),
        }
        setState((s) => ({
          ...s,
          sending: false,
          messages: [...s.messages, reply],
          chips: res.follow_up_chips.length > 0 ? res.follow_up_chips : s.chips,
          rateLimit: res.rate_limit,
          lastModelUsed: res.model_used,
        }))
      } catch (err) {
        if (ctrl.signal.aborted) return
        const message = err instanceof Error ? err.message : "El asistente falló."
        const errMsg: AssistantMessageItem = {
          id: newId(),
          role: "error",
          text: message,
          createdAt: Date.now(),
        }
        setState((s) => ({ ...s, sending: false, error: message, messages: [...s.messages, errMsg] }))
      }
    },
    [context],
  )

  const clear = useCallback(() => {
    sendCtrlRef.current?.abort()
    setState((s) => ({ ...s, messages: [], error: null }))
  }, [])

  useEffect(() => {
    return () => {
      sendCtrlRef.current?.abort()
      suggestCtrlRef.current?.abort()
    }
  }, [])

  return { ...state, send, clear }
}
