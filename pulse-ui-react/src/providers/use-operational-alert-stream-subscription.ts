"use client"

import { useContext, useEffect } from "react"

import { type StreamAlertPayload } from "@/lib/operational-alerts-stream"
import { OperationalAlertsStreamContext } from "@/providers/operational-alerts-stream-context"

export function useOperationalAlertStreamSubscription(
  onRow: (row: StreamAlertPayload) => void,
) {
  const ctx = useContext(OperationalAlertsStreamContext)
  useEffect(() => {
    if (!ctx) return
    return ctx.subscribe(onRow)
  }, [ctx, onRow])
}
