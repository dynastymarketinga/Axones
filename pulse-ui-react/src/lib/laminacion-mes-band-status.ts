import {
  LAM_ACTUAL_KEY,
  LAM_ESTADO_KEY,
  LAM_TURNOS_KEY,
  parseLaminacionTurnoActual,
  parseLaminacionTurnos,
  readLaminacionEstadoArea,
} from "@/pages/axones/laminacion-turnos"

import {
  buildMesBandFromTurnos,
  mesBandejaCardClass,
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowTitle,
  technicalFormFromRow,
  type MesBandejaMes,
  type MesBandejaWorkflow,
} from "@/lib/mes-timer-band-shared"

export { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"
export type { MesBandejaMes, MesBandejaWorkflow }

export const LAMINACION_CONTROL_SAVED_EVENT = "axones-laminacion-control-saved"

export type LaminacionActivasSubTab = "pendientes" | "produccion" | "finalizadas"

function hasLaminacionMesActivity(form: Record<string, unknown> | null): boolean {
  if (!form) return false
  const cerrados = parseLaminacionTurnos(form[LAM_TURNOS_KEY])
  const actual = parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY])
  if (actual !== null || cerrados.length > 0) return true
  return readLaminacionEstadoArea(form[LAM_ESTADO_KEY]) === "finalizada"
}

/**
 * Estado MES para la bandeja de laminación.
 * Incluye OT con datos MES aunque el tablero aún no esté en columna «laminacion».
 */
export function laminacionMesBandFromWorkOrderRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): MesBandejaMes | null {
  const form = technicalFormFromRow(row)
  const bs = (row.board_stage ?? "").toLowerCase()
  if (bs !== "laminacion" && !hasLaminacionMesActivity(form)) return null
  const cerrados = form ? parseLaminacionTurnos(form[LAM_TURNOS_KEY]) : []
  const actual = form ? parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY]) : null
  const estado = form ? readLaminacionEstadoArea(form[LAM_ESTADO_KEY]) : "abierta"
  return buildMesBandFromTurnos({
    areaLabel: "Laminación",
    estado,
    cerrados,
    actual,
    nowMs,
    form,
  })
}

/**
 * Subpestaña En curso (laminación), misma lógica que impresión.
 */
export function laminacionActivasBucketFromRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): LaminacionActivasSubTab {
  const mes = laminacionMesBandFromWorkOrderRow(row, nowMs)
  if (!mes) return "pendientes"
  if (mes.workflow === "finalizado") return "finalizadas"
  if (mes.workflow === "iniciado" || mes.workflow === "pausado") return "produccion"
  const form = technicalFormFromRow(row)
  const cerrados = form ? parseLaminacionTurnos(form[LAM_TURNOS_KEY]) : []
  const actual = form ? parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY]) : null
  if (cerrados.length > 0 || actual) return "produccion"
  return "pendientes"
}

export const laminacionBandejaRowAccentClass = mesBandejaRowAccentClass
export const laminacionBandejaCardClass = mesBandejaCardClass
export const laminacionBandejaStatePillClass = mesBandejaStatePillClass
export const laminacionBandejaWorkflowTitle = mesBandejaWorkflowTitle
