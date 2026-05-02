"use client"

import { createContext } from "react"

import { type StreamAlertPayload } from "@/lib/operational-alerts-stream"

export type OperationalAlertsStreamContextValue = {
  subscribe: (fn: (row: StreamAlertPayload) => void) => () => void
}

export const OperationalAlertsStreamContext =
  createContext<OperationalAlertsStreamContextValue | null>(null)
