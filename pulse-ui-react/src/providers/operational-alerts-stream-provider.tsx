"use client"

import {
  useCallback,
  useRef,
  type ReactNode,
} from "react"

import { type StreamAlertPayload } from "@/lib/operational-alerts-stream"
import { OperationalAlertsStreamContext } from "@/providers/operational-alerts-stream-context"

export function OperationalAlertsStreamProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<(row: StreamAlertPayload) => void>())

  const subscribe = useCallback((fn: (row: StreamAlertPayload) => void) => {
    listeners.current.add(fn)
    return () => void listeners.current.delete(fn)
  }, [])

  return (
    <OperationalAlertsStreamContext.Provider value={{ subscribe }}>
      {children}
    </OperationalAlertsStreamContext.Provider>
  )
}
