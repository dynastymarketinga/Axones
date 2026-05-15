import {
  MON_ACTUAL_KEY,
  MON_ESTADO_KEY,
  MON_TURNOS_KEY,
  parseMontajeTurnos,
  readEstadoArea,
  resolveMontajeTurnoActual,
} from "@/pages/axones/montaje-turnos"

import {
  buildMesBandFromTurnos,
  mesBandejaCardClass,
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowBandejaHint,
  mesBandejaWorkflowTitle,
  technicalFormFromRow,
  type MesBandejaMes,
  type MesBandejaWorkflow,
} from "@/lib/mes-timer-band-shared"

export { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"
export type { MesBandejaMes, MesBandejaWorkflow }

export const MONTAJE_CONTROL_SAVED_EVENT = "axones-montaje-control-saved"

export function montajeMesBandFromWorkOrderRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): MesBandejaMes | null {
  const form = technicalFormFromRow(row)
  if (!form) return null
  const bs = (row.board_stage ?? "").toLowerCase()
  const actualResolved = resolveMontajeTurnoActual(form)
  const cerrados = parseMontajeTurnos(form[MON_TURNOS_KEY])
  const hasMontajeTurno = actualResolved !== null || cerrados.length > 0
  if (bs !== "montaje" && !hasMontajeTurno) return null
  const actual = actualResolved
  const estado = form ? readEstadoArea(form[MON_ESTADO_KEY]) : "abierta"
  return buildMesBandFromTurnos({
    areaLabel: "Montaje",
    estado,
    cerrados,
    actual,
    nowMs,
    form,
  })
}

export const montajeBandejaRowAccentClass = mesBandejaRowAccentClass
export const montajeBandejaCardClass = mesBandejaCardClass
export const montajeBandejaStatePillClass = mesBandejaStatePillClass
export const montajeBandejaWorkflowTitle = mesBandejaWorkflowTitle

export type MontajeOperativoEstado = {
  mes: MesBandejaMes
  workflow: MesBandejaWorkflow
  title: string
  bandejaHint: string
  contextLine: string
}

/** Misma lógica que la bandeja `/axones/montaje` a partir del formulario técnico. */
export function deriveMontajeOperativoEstado(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MontajeOperativoEstado {
  const cerrados = form ? parseMontajeTurnos(form[MON_TURNOS_KEY]) : []
  const actual = form ? resolveMontajeTurnoActual(form) : null
  const estado = form ? readEstadoArea(form[MON_ESTADO_KEY]) : "abierta"
  const mes = buildMesBandFromTurnos({
    areaLabel: "Montaje",
    estado,
    cerrados,
    actual,
    nowMs,
    form: form ?? null,
  })
  return {
    mes,
    workflow: mes.workflow,
    title: mesBandejaWorkflowTitle(mes.workflow),
    bandejaHint: mesBandejaWorkflowBandejaHint(mes.workflow),
    contextLine: mes.contextLine,
  }
}

export function montajeMesBandFromForm(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MesBandejaMes {
  return deriveMontajeOperativoEstado(form, nowMs).mes
}
