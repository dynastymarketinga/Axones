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

export function laminacionMesBandFromWorkOrderRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): MesBandejaMes | null {
  if ((row.board_stage ?? "").toLowerCase() !== "laminacion") return null
  const form = technicalFormFromRow(row)
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

export const laminacionBandejaRowAccentClass = mesBandejaRowAccentClass
export const laminacionBandejaCardClass = mesBandejaCardClass
export const laminacionBandejaStatePillClass = mesBandejaStatePillClass
export const laminacionBandejaWorkflowTitle = mesBandejaWorkflowTitle
