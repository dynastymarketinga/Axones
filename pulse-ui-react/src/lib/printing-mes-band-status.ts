import {
  IMP_ACTUAL_KEY,
  IMP_ESTADO_KEY,
  IMP_TURNOS_KEY,
  parsePrintingTurnoActual,
  parsePrintingTurnos,
  readEstadoArea,
  type PrintingTurnTimerState,
  type PrintingTurnoEntry,
} from "@/pages/axones/printing-turnos"

/** Evento tras guardar control de impresión (misma ventana). */
export const PRINTING_CONTROL_SAVED_EVENT = "axones-printing-control-saved"

/** Cuatro estados operativos visibles en la bandeja de impresión. */
export type PrintingBandejaWorkflow = "sin_iniciar" | "iniciado" | "pausado" | "finalizado"

export type PrintingBandejaMes = {
  workflow: PrintingBandejaWorkflow
  /** Línea corta (turno / grupo). */
  contextLine: string
  /** Texto de apoyo bajo el título principal. */
  hint: string
  /** Tiempo efectivo acumulado (todos los turnos + tramo actual si corre). */
  effectiveHms: string
  /** Tiempo muerto / paradas acumuladas (como en el panel MES). */
  deadHms: string
  /** Efectivo + paradas (aprox. “Total” del temporizador). */
  totalHms: string
  /** Mostrar bloque de tiempos (efectivo + detalle). */
  showTimes: boolean
  /** Mostrar desglose de paradas (si hay tiempo muerto acumulado). */
  showDeadBreakdown: boolean
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0")
}

export function formatHmsFromSeconds(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec + 1e-6))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
}

function cumulativeEffectiveSeconds(
  cerrados: PrintingTurnoEntry[],
  actual: PrintingTurnoEntry | null,
  nowMs: number,
): number {
  let sum = 0
  for (const t of cerrados) {
    sum += t.timer.effectiveAccSec
  }
  if (!actual) return sum
  const tim = actual.timer
  let cur = tim.effectiveAccSec
  if (tim.state === "running" && tim.lastResumeAtMs > 0) {
    cur += (nowMs - tim.lastResumeAtMs) / 1000
  }
  return sum + cur
}

/** Tiempo muerto acumulado (paradas), incluyendo pausa en curso. */
function cumulativeDeadSeconds(
  cerrados: PrintingTurnoEntry[],
  actual: PrintingTurnoEntry | null,
  nowMs: number,
): number {
  let sum = 0
  for (const t of cerrados) {
    sum += t.timer.deadAccSec
  }
  if (!actual) return sum
  const tim = actual.timer
  let d = tim.deadAccSec
  if (tim.state === "paused" && tim.pauseAtMs > 0) {
    d += (nowMs - tim.pauseAtMs) / 1000
  }
  return sum + d
}

function turnoShort(actual: PrintingTurnoEntry): string {
  const parts: string[] = []
  if (actual.turno === "diurno") parts.push("Diurno")
  else if (actual.turno === "nocturno") parts.push("Nocturno")
  if (actual.grupo === "A" || actual.grupo === "B" || actual.grupo === "C") {
    parts.push(`Grupo ${actual.grupo}`)
  }
  return parts.join(" · ") || "—"
}

function technicalForm(row: {
  technical_document?: { form?: Record<string, unknown> } | null
}): Record<string, unknown> | null {
  const f = row.technical_document?.form
  return f && typeof f === "object" ? f : null
}

function labelForWorkflow(wf: PrintingBandejaWorkflow): string {
  if (wf === "sin_iniciar") return "Sin iniciar"
  if (wf === "iniciado") return "Iniciado"
  if (wf === "pausado") return "Pausado"
  return "Finalizado"
}

function hasPrintingMesActivity(form: Record<string, unknown> | null): boolean {
  if (!form) return false
  const cerrados = parsePrintingTurnos(form[IMP_TURNOS_KEY])
  const actual = parsePrintingTurnoActual(form[IMP_ACTUAL_KEY])
  if (actual !== null || cerrados.length > 0) return true
  return readEstadoArea(form[IMP_ESTADO_KEY]) === "finalizada"
}

/**
 * Estado MES para la bandeja de impresión.
 * Incluye OT con datos MES aunque el tablero aún no esté en columna «impresion».
 */
export function printingMesBandFromWorkOrderRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): PrintingBandejaMes | null {
  const form = technicalForm(row)
  const bs = (row.board_stage ?? "").toLowerCase()
  if (bs !== "impresion" && !hasPrintingMesActivity(form)) return null
  const cerrados = form ? parsePrintingTurnos(form[IMP_TURNOS_KEY]) : []
  const actual = form ? parsePrintingTurnoActual(form[IMP_ACTUAL_KEY]) : null
  const estado = form ? readEstadoArea(form[IMP_ESTADO_KEY]) : "abierta"

  const effSec = form ? cumulativeEffectiveSeconds(cerrados, actual, nowMs) : 0
  const deadSec = form ? cumulativeDeadSeconds(cerrados, actual, nowMs) : 0
  const totalSec = effSec + deadSec
  const effHms = formatHmsFromSeconds(effSec)
  const deadHms = formatHmsFromSeconds(deadSec)
  const totalHms = formatHmsFromSeconds(totalSec)
  const showDeadBreakdown = deadSec > 0.5

  if (!form) {
    return {
      workflow: "sin_iniciar",
      contextLine: "Impresión",
      hint: "Abra la OT para cargar datos de turno.",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: false,
      showDeadBreakdown,
    }
  }

  if (estado === "finalizada") {
    return {
      workflow: "finalizado",
      contextLine: `${cerrados.length} turno(s) registrado(s)`,
      hint: "Área de impresión cerrada en el sistema.",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: true,
      showDeadBreakdown,
    }
  }

  if (!actual && cerrados.length === 0) {
    return {
      workflow: "sin_iniciar",
      contextLine: "Sin turno en curso",
      hint: "Inicie un turno en la OT y guarde para ver el estado aquí.",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: effSec > 0.01 || deadSec > 0.01,
      showDeadBreakdown,
    }
  }

  if (!actual) {
    return {
      workflow: "sin_iniciar",
      contextLine: "Entre turnos",
      hint: "Listo para iniciar el siguiente turno en la OT.",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: true,
      showDeadBreakdown,
    }
  }

  const st = actual.timer.state as PrintingTurnTimerState
  const ctx = turnoShort(actual)

  if (st === "running") {
    return {
      workflow: "iniciado",
      contextLine: ctx,
      hint: "Tiempo efectivo corriendo (se detiene al pausar).",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: true,
      showDeadBreakdown,
    }
  }

  if (st === "paused") {
    return {
      workflow: "pausado",
      contextLine: ctx,
      hint: "Producción en pausa; el efectivo no aumenta hasta reanudar.",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: true,
      showDeadBreakdown,
    }
  }

  if (st === "stopped" || st === "completed") {
    return {
      workflow: "sin_iniciar",
      contextLine: ctx,
      hint: "Cronómetro detenido: reinicie, cierre turno o continúe desde la OT.",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: true,
      showDeadBreakdown,
    }
  }

  return {
    workflow: "sin_iniciar",
    contextLine: ctx,
    hint: "Turno abierto: pulse Iniciar en el temporizador de la OT.",
    effectiveHms: effHms,
    deadHms,
    totalHms,
    showTimes: effSec > 0.01 || deadSec > 0.01,
    showDeadBreakdown,
  }
}

export function printingBandejaRowAccentClass(wf: PrintingBandejaWorkflow): string {
  if (wf === "iniciado") {
    return "border-l-[5px] border-l-emerald-500 bg-emerald-500/[0.055] [&>td]:group-hover:bg-emerald-500/10"
  }
  if (wf === "pausado") {
    return "border-l-[5px] border-l-amber-500 bg-amber-500/[0.065] [&>td]:group-hover:bg-amber-500/11"
  }
  if (wf === "finalizado") {
    return "border-l-[5px] border-l-slate-500 bg-slate-500/[0.06] [&>td]:group-hover:bg-slate-500/10"
  }
  return "border-l-[5px] border-l-violet-500 bg-violet-500/[0.05] [&>td]:group-hover:bg-violet-500/9"
}

/** Contenedor tipo “tarjeta” para la celda de estatus. */
export function printingBandejaCardClass(wf: PrintingBandejaWorkflow): string {
  const base =
    "relative overflow-hidden rounded-xl border bg-gradient-to-br p-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
  if (wf === "iniciado") {
    return `${base} from-emerald-50/95 to-background border-emerald-500/25 dark:from-emerald-950/40 dark:to-background`
  }
  if (wf === "pausado") {
    return `${base} from-amber-50/95 to-background border-amber-500/28 dark:from-amber-950/35 dark:to-background`
  }
  if (wf === "finalizado") {
    return `${base} from-slate-100/90 to-background border-slate-400/30 dark:from-slate-900/50 dark:to-background`
  }
  return `${base} from-violet-50/90 to-background border-violet-400/28 dark:from-violet-950/35 dark:to-background`
}

export function printingBandejaStatePillClass(wf: PrintingBandejaWorkflow): string {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
  if (wf === "iniciado") {
    return `${base} border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50`
  }
  if (wf === "pausado") {
    return `${base} border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-50`
  }
  if (wf === "finalizado") {
    return `${base} border-slate-500/35 bg-slate-500/12 text-slate-800 dark:text-slate-100`
  }
  return `${base} border-violet-500/35 bg-violet-500/12 text-violet-950 dark:text-violet-100`
}

export function printingBandejaWorkflowTitle(wf: PrintingBandejaWorkflow): string {
  return labelForWorkflow(wf)
}

export type PrintingActivasSubTab = "pendientes" | "produccion" | "finalizadas"

/**
 * Subpestaña En curso (impresión):
 * - pendientes: primera vez / sin producción iniciada
 * - produccion: turno o cronómetro en uso (incl. entre turnos)
 * - finalizadas: área MES finalizada (`impEstadoArea`)
 */
export function printingActivasBucketFromRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): PrintingActivasSubTab {
  const mes = printingMesBandFromWorkOrderRow(row, nowMs)
  if (!mes) return "pendientes"
  if (mes.workflow === "finalizado") return "finalizadas"
  if (mes.workflow === "iniciado" || mes.workflow === "pausado") return "produccion"
  const form = technicalForm(row)
  const cerrados = form ? parsePrintingTurnos(form[IMP_TURNOS_KEY]) : []
  const actual = form ? parsePrintingTurnoActual(form[IMP_ACTUAL_KEY]) : null
  if (cerrados.length > 0 || actual) return "produccion"
  return "pendientes"
}
