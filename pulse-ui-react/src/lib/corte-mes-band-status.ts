import {
  COR_ACTUAL_KEY,
  COR_ESTADO_KEY,
  COR_TURNOS_KEY,
  parseCorteTurnoActual,
  parseCorteTurnos,
  readCorteEstadoArea,
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

export type CorteActivasSubTab = "pendientes" | "produccion" | "finalizadas"

type CorteBandejaRow = {
  technical_document?: { form?: Record<string, unknown> } | null
  board_stage?: string | null
  area_time_summary?: AreaTimeSummary | null
}

function hasCorteMesActivity(form: Record<string, unknown> | null): boolean {
  if (!form) return false
  const cerrados = parseCorteTurnos(form[COR_TURNOS_KEY], form)
  const actual = parseCorteTurnoActual(form[COR_ACTUAL_KEY], form)
  if (actual !== null || cerrados.length > 0) return true
  return readCorteEstadoArea(form[COR_ESTADO_KEY]) === "finalizada"
}

/**
 * Estado MES para la bandeja de corte.
 * Incluye OT con datos MES aunque el tablero aún no esté en columna «corte».
 */
export function corteMesBandFromWorkOrderRow(row: CorteBandejaRow, nowMs: number): MesBandejaMes | null {
  if (row.area_time_summary) {
    const fromSegments = mesBandFromAreaTimeSummary(row.area_time_summary, nowMs, "Corte")
    if (fromSegments) return fromSegments
  }

  const form = technicalFormFromRow(row)
  const bs = (row.board_stage ?? "").toLowerCase()
  if (bs !== "corte" && !hasCorteMesActivity(form)) return null

  const cerrados = form ? parseCorteTurnos(form[COR_TURNOS_KEY], form) : []
  const actual = form ? parseCorteTurnoActual(form[COR_ACTUAL_KEY], form) : null
  const estado = form ? readCorteEstadoArea(form[COR_ESTADO_KEY]) : "abierta"
  return buildMesBandFromTurnos({
    areaLabel: "Corte",
    estado,
    cerrados,
    actual,
    nowMs,
    form,
  })
}

/**
 * Subpestaña En curso (corte), misma lógica que impresión y laminación.
 */
export function corteActivasBucketFromRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): CorteActivasSubTab {
  const mes = corteMesBandFromWorkOrderRow(row, nowMs)
  if (!mes) return "pendientes"
  if (mes.workflow === "finalizado") return "finalizadas"
  if (mes.workflow === "iniciado" || mes.workflow === "pausado") return "produccion"
  const form = technicalFormFromRow(row)
  const cerrados = form ? parseCorteTurnos(form[COR_TURNOS_KEY], form) : []
  const actual = form ? parseCorteTurnoActual(form[COR_ACTUAL_KEY], form) : null
  if (cerrados.length > 0 || actual) return "produccion"
  return "pendientes"
}

export const corteBandejaRowAccentClass = mesBandejaRowAccentClass
export const corteBandejaCardClass = mesBandejaCardClass
export const corteBandejaStatePillClass = mesBandejaStatePillClass
export const corteBandejaWorkflowTitle = mesBandejaWorkflowTitle
