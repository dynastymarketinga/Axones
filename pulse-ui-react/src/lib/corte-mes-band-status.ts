import {
  COR_ACTUAL_KEY,
  COR_ESTADO_KEY,
  COR_TURNOS_KEY,
  accumulateCorteFromJson,
  parseCorteTurnoActual,
  parseCorteTurnos,
  readCorteEstadoArea,
  sumSalidaKgFromPaletas,
} from "@/pages/axones/corte-turnos"

import {
  buildMesBandFromTurnos,
  deriveMesOperativoEstadoFromMes,
  mesBandFromAreaTimeSummary,
  mesBandejaCardClass,
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowTitle,
  technicalFormFromRow,
  type AreaTimeSummary,
  type MesBandejaMes,
  type MesBandejaWorkflow,
  type MesOperativoEstado,
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

function readStoredProducidoKg(form: Record<string, unknown> | null): number {
  if (!form) return 0
  const raw = form.corAcumuladoProducidoKg
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw)
  if (typeof raw === "string") {
    const n = Number(raw.replace(",", "."))
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }
  return 0
}

function corteKgExtrasFromForm(form: Record<string, unknown> | null): Pick<
  MesBandejaMes,
  "producidoKg" | "entradaKg" | "desperdicioKg"
> {
  if (!form) return {}
  const cerrados = parseCorteTurnos(form[COR_TURNOS_KEY], form)
  const actual = parseCorteTurnoActual(form[COR_ACTUAL_KEY], form)
  if (cerrados.length === 0 && !actual) return {}
  const formSalidaActual = actual ? sumSalidaKgFromPaletas(actual.paletas) : undefined
  const acum = accumulateCorteFromJson(cerrados, actual, formSalidaActual, form)
  const storedKg = readStoredProducidoKg(form)
  const producidoKg = Math.max(acum.producidoKg, storedKg)
  return {
    producidoKg: producidoKg > 0.005 ? producidoKg : undefined,
    entradaKg: acum.entradaKg > 0.005 ? acum.entradaKg : undefined,
    desperdicioKg: acum.scrapKg > 0.005 ? acum.scrapKg : undefined,
  }
}

/**
 * Estado MES para la bandeja de corte.
 * Incluye OT con datos MES aunque el tablero aún no esté en columna «corte».
 */
export function corteMesBandFromForm(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MesBandejaMes {
  const f = form ?? null
  const cerrados = f ? parseCorteTurnos(f[COR_TURNOS_KEY], f) : []
  const actual = f ? parseCorteTurnoActual(f[COR_ACTUAL_KEY], f) : null
  const estado = f ? readCorteEstadoArea(f[COR_ESTADO_KEY]) : "abierta"
  const mes = buildMesBandFromTurnos({
    areaLabel: "Corte",
    estado,
    cerrados,
    actual,
    nowMs,
    form: f,
  })
  const kgExtras = corteKgExtrasFromForm(f)
  if (Object.keys(kgExtras).length > 0) {
    return { ...mes, ...kgExtras }
  }
  return mes
}

export function deriveCorteOperativoEstado(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MesOperativoEstado {
  return deriveMesOperativoEstadoFromMes(corteMesBandFromForm(form, nowMs))
}

export function corteMesBandFromWorkOrderRow(row: CorteBandejaRow, nowMs: number): MesBandejaMes | null {
  const form = technicalFormFromRow(row)
  const bs = (row.board_stage ?? "").toLowerCase()
  if (bs !== "corte" && !hasCorteMesActivity(form)) return null

  // corEstadoArea vive en el formulario; el resumen de segmentos no expone finalización.
  if (form && readCorteEstadoArea(form[COR_ESTADO_KEY]) === "finalizada") {
    return corteMesBandFromForm(form, nowMs)
  }

  if (row.area_time_summary) {
    const fromSegments = mesBandFromAreaTimeSummary(row.area_time_summary, nowMs, "Corte")
    if (fromSegments) {
      const kgExtras = corteKgExtrasFromForm(form)
      return Object.keys(kgExtras).length > 0 ? { ...fromSegments, ...kgExtras } : fromSegments
    }
  }

  return corteMesBandFromForm(form, nowMs)
}

/**
 * Subpestaña En curso (corte), misma lógica que impresión y laminación.
 */
export function corteActivasBucketFromRow(
  row: {
    technical_document?: { form?: Record<string, unknown> } | null
    board_stage?: string | null
    area_time_summary?: AreaTimeSummary | null
  },
  nowMs: number,
): CorteActivasSubTab {
  const form = technicalFormFromRow(row)
  if (form && readCorteEstadoArea(form[COR_ESTADO_KEY]) === "finalizada") {
    return "finalizadas"
  }

  const mes = corteMesBandFromWorkOrderRow(row, nowMs)
  if (!mes) return "pendientes"
  if (mes.workflow === "finalizado") return "finalizadas"
  if (
    mes.workflow === "iniciado" ||
    mes.workflow === "pausado" ||
    mes.workflow === "entre_turnos" ||
    mes.workflow === "turno_abierto"
  ) {
    return "produccion"
  }
  const cerrados = form ? parseCorteTurnos(form[COR_TURNOS_KEY], form) : []
  const actual = form ? parseCorteTurnoActual(form[COR_ACTUAL_KEY], form) : null
  if (cerrados.length > 0 || actual) return "produccion"
  return "pendientes"
}

export const corteBandejaRowAccentClass = mesBandejaRowAccentClass
export const corteBandejaCardClass = mesBandejaCardClass
export const corteBandejaStatePillClass = mesBandejaStatePillClass
export const corteBandejaWorkflowTitle = mesBandejaWorkflowTitle
