import {
  COR_ACTUAL_KEY,
  COR_TURNOS_KEY,
  parseCorteTurnoActual,
  parseCorteTurnos,
} from "@/pages/axones/corte-turnos"

import {
  buildMesBandFromTurnos,
  mesBandFromAreaTimeSummary,
  mesBandejaCardClass,
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowTitle,
  technicalFormFromRow,
  type AreaTimeSummary,
  type MesBandejaMes,
  type MesBandejaWorkflow,
} from "@/lib/mes-timer-band-shared"

export { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"
export type { AreaTimeSummary, MesBandejaMes, MesBandejaWorkflow }

export const CORTE_CONTROL_SAVED_EVENT = "axones-corte-control-saved"

type CorteBandejaRow = {
  technical_document?: { form?: Record<string, unknown> } | null
  board_stage?: string | null
  area_time_summary?: AreaTimeSummary | null
}

export function corteMesBandFromWorkOrderRow(row: CorteBandejaRow, nowMs: number): MesBandejaMes | null {
  const stage = (row.board_stage ?? "").toLowerCase()

  if (row.area_time_summary) {
    const fromSegments = mesBandFromAreaTimeSummary(row.area_time_summary, nowMs, "Corte")
    if (fromSegments) return fromSegments
  }

  if (stage !== "corte") return null

  const form = technicalFormFromRow(row)
  const cerrados = form ? parseCorteTurnos(form[COR_TURNOS_KEY], form ?? undefined) : []
  const actual = form ? parseCorteTurnoActual(form[COR_ACTUAL_KEY], form ?? undefined) : null
  return buildMesBandFromTurnos({
    areaLabel: "Corte",
    estado: "abierta",
    cerrados,
    actual,
    nowMs,
    form,
  })
}

export const corteBandejaRowAccentClass = mesBandejaRowAccentClass
export const corteBandejaCardClass = mesBandejaCardClass
export const corteBandejaStatePillClass = mesBandejaStatePillClass
export const corteBandejaWorkflowTitle = mesBandejaWorkflowTitle
