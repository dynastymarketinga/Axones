import { cn } from "@/lib/utils"

/** Estados operativos visibles en bandejas MES por área. */
export type MesBandejaWorkflow =
  | "sin_iniciar"
  | "turno_abierto"
  | "entre_turnos"
  | "iniciado"
  | "pausado"
  | "finalizado"

export type MesBandejaMes = {
  workflow: MesBandejaWorkflow
  contextLine: string
  hint: string
  effectiveHms: string
  deadHms: string
  totalHms: string
  showTimes: boolean
  showDeadBreakdown: boolean
  /** Etiqueta operativa (p. ej. «Arranque en marcha»); si falta, se usa el título del workflow. */
  statusLabel?: string
  /** Kg de salida acumulados (p. ej. impresión: cerrados + turno actual). */
  producidoKg?: number
  /** Kg de entrada virgen acumulados (impresión). */
  entradaKg?: number
  /** Kg de desperdicio acumulados (impresión). */
  desperdicioKg?: number
}

/** Columna # (numeración de fila en bandeja MES). */
export const MES_BANDEJA_INDEX_COLUMN_COUNT = 1

/** Columnas de kg desglosadas en bandeja (impresión): bobinas + producido, entrada, desperd., total masa. */
export const MES_BANDEJA_KG_BREAKDOWN_COLUMN_COUNT = 5

/** Solo columnas numéricas de kg (sin bobinas). */
export const MES_BANDEJA_KG_NUMERIC_COLUMN_COUNT = 4

export const MES_BANDEJA_KG_TOTAL_HEAD_LABEL = "Total masa acum."

export function areaShowsMesKgBreakdownColumns(area: string): boolean {
  return area === "printing"
}

/** Suma producido + entrada + desperdicio (kg registrados en turnos). */
export function mesBandejaMasaTotalKg(mes: MesBandejaMes | null): number | null {
  if (!mes) return null
  const hasAny =
    mes.producidoKg != null || mes.entradaKg != null || mes.desperdicioKg != null
  if (!hasAny) return null
  return (mes.producidoKg ?? 0) + (mes.entradaKg ?? 0) + (mes.desperdicioKg ?? 0)
}

/** Columnas MES antes del bloque kg (# + OT + estado + temporizador + turno). */
export const MES_BANDEJA_PRE_KG_COLUMN_COUNT = 5

/** Columnas de programación en bandeja Pendientes (prioridad, inicio, entrega, motivo). */
export const MES_BANDEJA_PROGRAMACION_COLUMN_COUNT = 4

export type MesBandejaKgTotals = {
  /** Filas con al menos un kg registrado. */
  rowsWithKg: number
  producidoKg: number
  entradaKg: number
  desperdicioKg: number
  totalMasaKg: number
}

/** Totaliza kg de las filas visibles en la bandeja MES. */
export function mesBandejaKgTotalsFromBands(bands: (MesBandejaMes | null)[]): MesBandejaKgTotals {
  let rowsWithKg = 0
  let producidoKg = 0
  let entradaKg = 0
  let desperdicioKg = 0

  for (const mes of bands) {
    if (!mes) continue
    const hasAny =
      mes.producidoKg != null || mes.entradaKg != null || mes.desperdicioKg != null
    if (!hasAny) continue
    rowsWithKg++
    producidoKg += mes.producidoKg ?? 0
    entradaKg += mes.entradaKg ?? 0
    desperdicioKg += mes.desperdicioKg ?? 0
  }

  return {
    rowsWithKg,
    producidoKg,
    entradaKg,
    desperdicioKg,
    totalMasaKg: producidoKg + entradaKg + desperdicioKg,
  }
}

export type MesTurnTimerLike = {
  state: string
  effectiveAccSec: number
  deadAccSec: number
  lastResumeAtMs: number
  pauseAtMs: number
  pauses?: { duration_sec?: number }[]
}

export type MesTurnoEntryLike = {
  turno: string
  grupo: string
  timer: MesTurnTimerLike
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

/** Marca de tiempo del último arranque del cronómetro (play / reanudar). */
export function horaArranqueMsFromTimer(timer: {
  lastResumeAtMs?: number
  startedAtMs?: number
}): number {
  const last = timer.lastResumeAtMs ?? 0
  if (last > 0) return last
  return timer.startedAtMs ?? 0
}

/** Hora local de arranque para la cara del cronómetro MES. */
export function formatHoraArranqueFromMs(ms: number): string {
  if (!ms || ms <= 0) return "—"
  try {
    return new Date(ms).toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  } catch {
    return "—"
  }
}

export function cumulativeEffectiveSeconds(
  cerrados: MesTurnoEntryLike[],
  actual: MesTurnoEntryLike | null,
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

/** Tiempo muerto ya persistido (paradas registradas), sin el tramo abierto de la parada actual. */
export function cumulativePersistedDeadSeconds(
  cerrados: MesTurnoEntryLike[],
  actual: MesTurnoEntryLike | null,
): number {
  let sum = 0
  for (const t of cerrados) {
    sum += t.timer.deadAccSec
  }
  if (!actual) return sum
  return sum + actual.timer.deadAccSec
}

export function cumulativeDeadSeconds(
  cerrados: MesTurnoEntryLike[],
  actual: MesTurnoEntryLike | null,
  nowMs: number,
): number {
  let sum = cumulativePersistedDeadSeconds(cerrados, actual)
  if (!actual) return sum
  const tim = actual.timer
  // Parada en curso: sumar desde pauseAtMs (se reinicia al registrar motivo para no duplicar).
  if (tim.state === "paused" && tim.pauseAtMs > 0) {
    sum += (nowMs - tim.pauseAtMs) / 1000
  }
  return sum
}

/** Total acumulado visible: efectivo + paradas registradas (la parada en curso solo va a tiempo muerto). */
export function cumulativeTotalPersistedSeconds(
  cerrados: MesTurnoEntryLike[],
  actual: MesTurnoEntryLike | null,
  nowMs: number,
): number {
  return (
    cumulativeEffectiveSeconds(cerrados, actual, nowMs) +
    cumulativePersistedDeadSeconds(cerrados, actual)
  )
}

/** Al reanudar desde pausa, cerrar el tramo muerto abierto en deadAccSec. */
export function deadAccSecAfterResume(timer: MesTurnTimerLike, nowMs: number): number {
  let dead = timer.deadAccSec
  if (timer.state === "paused" && timer.pauseAtMs > 0) {
    dead += (nowMs - timer.pauseAtMs) / 1000
  }
  return dead
}

export function turnoShortFromEntry(actual: MesTurnoEntryLike): string {
  const parts: string[] = []
  if (actual.turno === "diurno") parts.push("Diurno")
  else if (actual.turno === "nocturno") parts.push("Nocturno")
  else if (String(actual.turno ?? "").trim()) parts.push(String(actual.turno).trim())
  if (actual.grupo === "A" || actual.grupo === "B" || actual.grupo === "C") {
    parts.push(`Grupo ${actual.grupo}`)
  } else if (String(actual.grupo ?? "").trim()) {
    parts.push(String(actual.grupo).trim())
  }
  return parts.join(" · ") || "—"
}

export function technicalFormFromRow(row: {
  technical_document?: { form?: Record<string, unknown> } | null
  technicalDocument?: { form?: Record<string, unknown> } | null
}): Record<string, unknown> | null {
  const f = row.technical_document?.form ?? row.technicalDocument?.form
  return f && typeof f === "object" && !Array.isArray(f) ? f : null
}

function labelForWorkflow(wf: MesBandejaWorkflow): string {
  if (wf === "sin_iniciar") return "Sin iniciar"
  if (wf === "turno_abierto") return "Turno abierto"
  if (wf === "entre_turnos") return "Entre turnos"
  if (wf === "iniciado") return "Iniciado"
  if (wf === "pausado") return "Pausado"
  return "Finalizado"
}

/** Estado operativo derivado de `MesBandejaMes` (banner en OT y bandeja). */
export type MesOperativoEstado = {
  mes: MesBandejaMes
  workflow: MesBandejaWorkflow
  title: string
  bandejaHint: string
  bannerHint: string
  contextLine: string
}

export function deriveMesOperativoEstadoFromMes(mes: MesBandejaMes): MesOperativoEstado {
  const title = mes.statusLabel?.trim() || mesBandejaWorkflowTitle(mes.workflow)
  return {
    mes,
    workflow: mes.workflow,
    title,
    bandejaHint: mesBandejaWorkflowBandejaHint(mes.workflow),
    bannerHint: mesBandejaWorkflowBannerHint(mes.workflow),
    contextLine: mes.contextLine,
  }
}

/** Texto breve para el banner de estado en la OT (sin repetir el modal). */
export function mesBandejaWorkflowBannerHint(wf: MesBandejaWorkflow): string {
  if (wf === "sin_iniciar") return "Sin turno ni tiempo en bandeja."
  if (wf === "turno_abierto") return "Listo para cronómetro en la OT."
  if (wf === "entre_turnos") return "Tiempos y kg de turnos cerrados."
  if (wf === "iniciado") return "Tiempo efectivo en marcha."
  if (wf === "pausado") return "Producción en pausa."
  return "Área cerrada; OT en historial."
}

/** Texto para banner de producción: qué verá la bandeja tras guardar. */
export function mesBandejaWorkflowBandejaHint(wf: MesBandejaWorkflow): string {
  if (wf === "sin_iniciar") {
    return "En la bandeja Montaje verá «Sin iniciar» (sin turno ni tiempo registrado)."
  }
  if (wf === "turno_abierto") {
    return "En la bandeja Montaje verá «Turno abierto» (listo para cronómetro; el tiempo efectivo aún no corre)."
  }
  if (wf === "entre_turnos") {
    return "En la bandeja Montaje verá «Entre turnos» con el tiempo acumulado de turnos cerrados."
  }
  if (wf === "iniciado") {
    return "En la bandeja Montaje verá «Iniciado» y el tiempo efectivo aumentará."
  }
  if (wf === "pausado") {
    return "En la bandeja Montaje verá «Pausado»; el tiempo efectivo queda detenido."
  }
  return "En la bandeja Montaje verá «Finalizado» y la OT pasará a la pestaña Historial."
}

export function buildMesBandFromTurnos(params: {
  areaLabel: string
  estado: "abierta" | "finalizada"
  cerrados: MesTurnoEntryLike[]
  actual: MesTurnoEntryLike | null
  nowMs: number
  form: Record<string, unknown> | null
}): MesBandejaMes {
  const { areaLabel, estado, cerrados, actual, nowMs, form } = params
  const effSec = form ? cumulativeEffectiveSeconds(cerrados, actual, nowMs) : 0
  const deadSec = form ? cumulativeDeadSeconds(cerrados, actual, nowMs) : 0
  const totalSec = form ? cumulativeTotalPersistedSeconds(cerrados, actual, nowMs) : 0
  const effHms = formatHmsFromSeconds(effSec)
  const deadHms = formatHmsFromSeconds(deadSec)
  const totalHms = formatHmsFromSeconds(totalSec)
  const showDeadBreakdown = deadSec > 0.5

  if (!form) {
    return {
      workflow: "sin_iniciar",
      contextLine: areaLabel,
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
      hint: `Área de ${areaLabel.toLowerCase()} cerrada en el sistema.`,
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
      workflow: "entre_turnos",
      contextLine: `${cerrados.length} turno(s) cerrado(s)`,
      hint: "Sin turno abierto. Puede iniciar el siguiente turno en la OT.",
      effectiveHms: effHms,
      deadHms,
      totalHms,
      showTimes: true,
      showDeadBreakdown,
    }
  }

  const st = actual.timer.state
  const ctx = turnoShortFromEntry(actual)

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
    workflow: "turno_abierto",
    contextLine: ctx,
    hint: "Turno de planta abierto. Pulse play en el cronómetro de la OT para pasar a «Iniciado».",
    effectiveHms: effHms,
    deadHms,
    totalHms,
    showTimes: effSec > 0.01 || deadSec > 0.01,
    showDeadBreakdown,
  }
}

/** Fondo y borde izquierdo de fila en bandejas MES según estado operativo. */
export function mesBandejaRowAccentClass(wf: MesBandejaWorkflow): string {
  const base =
    "border-l-[6px] transition-colors [&>td]:bg-transparent [&>td]:group-hover:bg-transparent"
  if (wf === "iniciado") {
    return `${base} border-l-emerald-500 bg-emerald-500/14 hover:bg-emerald-500/20 dark:bg-emerald-500/18 dark:hover:bg-emerald-500/24`
  }
  if (wf === "pausado") {
    return `${base} border-l-amber-500 bg-amber-500/16 hover:bg-amber-500/22 dark:bg-amber-500/20 dark:hover:bg-amber-500/26`
  }
  if (wf === "turno_abierto") {
    return `${base} border-l-cyan-500 bg-cyan-500/14 hover:bg-cyan-500/20 dark:bg-cyan-500/18 dark:hover:bg-cyan-500/24`
  }
  if (wf === "entre_turnos") {
    return `${base} border-l-sky-500 bg-sky-500/14 hover:bg-sky-500/20 dark:bg-sky-500/18 dark:hover:bg-sky-500/24`
  }
  if (wf === "finalizado") {
    return `${base} border-l-slate-500 bg-slate-500/14 hover:bg-slate-500/20 dark:bg-slate-500/18 dark:hover:bg-slate-500/24`
  }
  return `${base} border-l-violet-500 bg-violet-500/12 hover:bg-violet-500/18 dark:bg-violet-500/16 dark:hover:bg-violet-500/22`
}

/** Enlace OT en bandejas MES: legible, sin partir el código en varias líneas. */
export const mesBandejaOtLinkClassName =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-primary/12 px-2 py-1.5 font-mono text-[11px] font-bold tracking-tight text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/20 sm:px-3 sm:py-2 sm:text-sm md:text-base"

export function mesBandejaStatePillClass(wf: MesBandejaWorkflow): string {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-wide shadow-sm ring-1 sm:text-sm"
  if (wf === "iniciado") {
    return `${base} border-emerald-500/55 bg-emerald-500/22 text-emerald-950 ring-emerald-500/30 dark:bg-emerald-500/28 dark:text-emerald-50`
  }
  if (wf === "pausado") {
    return `${base} border-amber-500/55 bg-amber-500/24 text-amber-950 ring-amber-500/35 dark:bg-amber-500/28 dark:text-amber-50`
  }
  if (wf === "turno_abierto") {
    return `${base} border-cyan-500/60 bg-cyan-500/24 text-cyan-950 ring-cyan-500/35 dark:bg-cyan-500/30 dark:text-cyan-50`
  }
  if (wf === "entre_turnos") {
    return `${base} border-sky-500/55 bg-sky-500/22 text-sky-950 ring-sky-500/30 dark:bg-sky-500/28 dark:text-sky-50`
  }
  if (wf === "finalizado") {
    return `${base} border-slate-500/50 bg-slate-500/18 text-slate-900 ring-slate-500/25 dark:bg-slate-500/22 dark:text-slate-100`
  }
  return `${base} border-violet-500/55 bg-violet-500/20 text-violet-950 ring-violet-500/30 dark:bg-violet-500/25 dark:text-violet-100`
}

/** Variante compacta solo icono para columna Estado producción en bandeja. */
export function mesBandejaStateIconPillClass(wf: MesBandejaWorkflow): string {
  const base =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-sm ring-1 transition hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
  if (wf === "iniciado") {
    return `${base} border-emerald-500/55 bg-emerald-500/22 ring-emerald-500/30 dark:bg-emerald-500/28`
  }
  if (wf === "pausado") {
    return `${base} border-amber-500/55 bg-amber-500/24 ring-amber-500/35 dark:bg-amber-500/28`
  }
  if (wf === "turno_abierto") {
    return `${base} border-cyan-500/60 bg-cyan-500/24 ring-cyan-500/35 dark:bg-cyan-500/30`
  }
  if (wf === "entre_turnos") {
    return `${base} border-sky-500/55 bg-sky-500/22 ring-sky-500/30 dark:bg-sky-500/28`
  }
  if (wf === "finalizado") {
    return `${base} border-slate-500/50 bg-slate-500/18 ring-slate-500/25 dark:bg-slate-500/22`
  }
  return `${base} border-violet-500/55 bg-violet-500/20 ring-violet-500/30 dark:bg-violet-500/25`
}

export function mesBandejaWorkflowTitle(wf: MesBandejaWorkflow): string {
  return labelForWorkflow(wf)
}

export type MesBandejaWorkflowHelpEntry = {
  workflow: MesBandejaWorkflow
  title: string
  /** Cuándo aparece este estado en la bandeja. */
  when: string
  /** Qué representa en planta. */
  meaning: string
}

/** Referencia para popover al pulsar un estado MES en la bandeja. */
export const MES_BANDEJA_WORKFLOW_HELP: MesBandejaWorkflowHelpEntry[] = [
  {
    workflow: "sin_iniciar",
    title: "Sin iniciar",
    when: "La OT aún no tiene turno de planta ni cronómetro registrado en esta área, o el cronómetro quedó detenido sin turno abierto.",
    meaning: "Producción MES no iniciada. Abra un turno en la OT y guarde.",
  },
  {
    workflow: "turno_abierto",
    title: "Turno abierto",
    when: "Hay turno de planta guardado (cuadrilla/personal) pero el cronómetro sigue en «pendiente» (sin play).",
    meaning: "Listo para arrancar tiempos. Pulse play en el cronómetro de la OT para pasar a «Iniciado».",
  },
  {
    workflow: "entre_turnos",
    title: "Entre turnos",
    when: "Existen turnos cerrados en el historial y no hay turno actual abierto en la OT.",
    meaning: "Pausa entre registros de planta. Puede abrir el siguiente turno; el tiempo efectivo muestra lo acumulado.",
  },
  {
    workflow: "iniciado",
    title: "Iniciado",
    when: "El cronómetro está en marcha (producción o arranque activo, según la fase).",
    meaning: "Tiempo efectivo corriendo. Se detiene al registrar parada / tiempo muerto.",
  },
  {
    workflow: "pausado",
    title: "Pausado",
    when: "El cronómetro está en parada (tiempo muerto) con motivo registrado o en curso.",
    meaning: "El tiempo efectivo no aumenta hasta reanudar. El turno de planta sigue abierto.",
  },
  {
    workflow: "finalizado",
    title: "Finalizado",
    when: "El área de producción se marcó como finalizada en la OT (p. ej. impEstadoArea).",
    meaning: "La OT suele pasar a Historial en la bandeja. Solo lectura salvo permisos de jefatura.",
  },
]

/** Sub-filtros dentro de «En producción» en bandeja MES (excluye finalizado). */
export const MES_PRODUCCION_WORKFLOW_TAB_ORDER = [
  "sin_iniciar",
  "turno_abierto",
  "entre_turnos",
  "iniciado",
  "pausado",
] as const

export type MesProduccionWorkflowFilter = (typeof MES_PRODUCCION_WORKFLOW_TAB_ORDER)[number]

export function isMesProduccionWorkflowFilter(
  wf: MesBandejaWorkflow | null | undefined,
): wf is MesProduccionWorkflowFilter {
  return (
    wf != null &&
    (MES_PRODUCCION_WORKFLOW_TAB_ORDER as readonly MesBandejaWorkflow[]).includes(wf)
  )
}

const MES_PRODUCCION_TAB_TOGGLE_LAYOUT =
  "inline-flex min-h-9 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-lg border-2 px-2.5 py-2 text-[11px] font-semibold shadow-sm transition-all sm:basis-auto sm:text-xs hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:bg-[inherit] hover:text-[inherit] data-[state=on]:shadow-md"

/** Pestaña de filtro «En producción» — fondo sólido por estado (inactiva tintada, activa plena). */
export function mesProduccionWorkflowTabToggleClass(wf: MesProduccionWorkflowFilter): string {
  if (wf === "iniciado") {
    return cn(
      MES_PRODUCCION_TAB_TOGGLE_LAYOUT,
      "border-emerald-600/70 bg-emerald-400/45 text-emerald-950 ring-1 ring-emerald-600/40 dark:border-emerald-500 dark:bg-emerald-500/40 dark:text-emerald-50",
      "hover:border-emerald-600 hover:bg-emerald-400/55 dark:hover:bg-emerald-500/50",
      "data-[state=on]:border-emerald-700 data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:ring-2 data-[state=on]:ring-emerald-600/50 dark:data-[state=on]:bg-emerald-600 dark:data-[state=on]:text-emerald-50",
    )
  }
  if (wf === "pausado") {
    return cn(
      MES_PRODUCCION_TAB_TOGGLE_LAYOUT,
      "border-amber-600/70 bg-amber-400/45 text-amber-950 ring-1 ring-amber-600/40 dark:border-amber-500 dark:bg-amber-500/40 dark:text-amber-50",
      "hover:border-amber-600 hover:bg-amber-400/55 dark:hover:bg-amber-500/50",
      "data-[state=on]:border-amber-700 data-[state=on]:bg-amber-500 data-[state=on]:text-amber-950 data-[state=on]:ring-2 data-[state=on]:ring-amber-600/50 dark:data-[state=on]:bg-amber-600 dark:data-[state=on]:text-amber-50",
    )
  }
  if (wf === "turno_abierto") {
    return cn(
      MES_PRODUCCION_TAB_TOGGLE_LAYOUT,
      "border-cyan-600/70 bg-cyan-400/45 text-cyan-950 ring-1 ring-cyan-600/40 dark:border-cyan-500 dark:bg-cyan-500/40 dark:text-cyan-50",
      "hover:border-cyan-600 hover:bg-cyan-400/55 dark:hover:bg-cyan-500/50",
      "data-[state=on]:border-cyan-700 data-[state=on]:bg-cyan-500 data-[state=on]:text-white data-[state=on]:ring-2 data-[state=on]:ring-cyan-600/50 dark:data-[state=on]:bg-cyan-600 dark:data-[state=on]:text-cyan-50",
    )
  }
  if (wf === "entre_turnos") {
    return cn(
      MES_PRODUCCION_TAB_TOGGLE_LAYOUT,
      "border-sky-600/70 bg-sky-400/45 text-sky-950 ring-1 ring-sky-600/40 dark:border-sky-500 dark:bg-sky-500/40 dark:text-sky-50",
      "hover:border-sky-600 hover:bg-sky-400/55 dark:hover:bg-sky-500/50",
      "data-[state=on]:border-sky-700 data-[state=on]:bg-sky-500 data-[state=on]:text-white data-[state=on]:ring-2 data-[state=on]:ring-sky-600/50 dark:data-[state=on]:bg-sky-600 dark:data-[state=on]:text-sky-50",
    )
  }
  return cn(
    MES_PRODUCCION_TAB_TOGGLE_LAYOUT,
    "border-violet-600/70 bg-violet-400/45 text-violet-950 ring-1 ring-violet-600/40 dark:border-violet-500 dark:bg-violet-500/40 dark:text-violet-50",
    "hover:border-violet-600 hover:bg-violet-400/55 dark:hover:bg-violet-500/50",
    "data-[state=on]:border-violet-700 data-[state=on]:bg-violet-500 data-[state=on]:text-white data-[state=on]:ring-2 data-[state=on]:ring-violet-600/50 dark:data-[state=on]:bg-violet-600 dark:data-[state=on]:text-violet-50",
  )
}

/** Panel de ayuda bajo las pestañas de filtro. */
const MES_ACTIVAS_SUB_TAB_LAYOUT =
  "inline-flex min-h-9 flex-1 basis-[calc(33.333%-0.25rem)] flex-wrap items-center justify-center gap-2 rounded-lg border-2 px-2.5 py-2 text-xs font-semibold shadow-sm transition-all sm:flex-initial sm:basis-auto sm:text-sm hover:brightness-[1.05] data-[state=on]:shadow-md"

/** Pestañas Pendientes / En producción / Finalizadas (bandeja MES). */
export function mesActivasSubTabToggleClass(tab: "pendientes" | "produccion" | "finalizadas"): string {
  if (tab === "produccion") {
    return cn(
      MES_ACTIVAS_SUB_TAB_LAYOUT,
      "border-cyan-600/55 bg-cyan-400/35 text-cyan-950 dark:bg-cyan-500/35 dark:text-cyan-50",
      "data-[state=on]:border-cyan-700 data-[state=on]:bg-cyan-500 data-[state=on]:text-white dark:data-[state=on]:bg-cyan-600 dark:data-[state=on]:text-cyan-50",
    )
  }
  if (tab === "finalizadas") {
    return cn(
      MES_ACTIVAS_SUB_TAB_LAYOUT,
      "border-emerald-600/55 bg-emerald-400/35 text-emerald-950 dark:bg-emerald-500/35 dark:text-emerald-50",
      "data-[state=on]:border-emerald-700 data-[state=on]:bg-emerald-500 data-[state=on]:text-white dark:data-[state=on]:bg-emerald-600 dark:data-[state=on]:text-emerald-50",
    )
  }
  return cn(
    MES_ACTIVAS_SUB_TAB_LAYOUT,
    "border-violet-600/55 bg-violet-400/35 text-violet-950 dark:bg-violet-500/35 dark:text-violet-50",
    "data-[state=on]:border-violet-700 data-[state=on]:bg-violet-500 data-[state=on]:text-white dark:data-[state=on]:bg-violet-600 dark:data-[state=on]:text-violet-50",
  )
}

export function mesProduccionWorkflowHelpPanelClass(wf: MesProduccionWorkflowFilter): string {
  const base = "rounded-lg border-2 px-3 py-2.5 text-xs leading-relaxed sm:text-sm"
  if (wf === "iniciado") {
    return cn(base, "border-emerald-500/50 bg-emerald-500/20 text-emerald-950 dark:bg-emerald-500/25 dark:text-emerald-50")
  }
  if (wf === "pausado") {
    return cn(base, "border-amber-500/50 bg-amber-500/20 text-amber-950 dark:bg-amber-500/25 dark:text-amber-50")
  }
  if (wf === "turno_abierto") {
    return cn(base, "border-cyan-500/50 bg-cyan-500/20 text-cyan-950 dark:bg-cyan-500/25 dark:text-cyan-50")
  }
  if (wf === "entre_turnos") {
    return cn(base, "border-sky-500/50 bg-sky-500/20 text-sky-950 dark:bg-sky-500/25 dark:text-sky-50")
  }
  return cn(base, "border-violet-500/50 bg-violet-500/20 text-violet-950 dark:bg-violet-500/25 dark:text-violet-50")
}

export function mesProduccionWorkflowCountsEmpty(): Record<MesProduccionWorkflowFilter, number> {
  return {
    sin_iniciar: 0,
    turno_abierto: 0,
    entre_turnos: 0,
    iniciado: 0,
    pausado: 0,
  }
}

export function mesBandejaWorkflowHelpFor(wf: MesBandejaWorkflow): MesBandejaWorkflowHelpEntry {
  return (
    MES_BANDEJA_WORKFLOW_HELP.find((e) => e.workflow === wf) ?? {
      workflow: wf,
      title: labelForWorkflow(wf),
      when: "—",
      meaning: "—",
    }
  )
}

export function mesBandejaCardClass(wf: MesBandejaWorkflow): string {
  const base =
    "relative overflow-hidden rounded-xl border bg-gradient-to-br p-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
  if (wf === "iniciado") {
    return `${base} from-emerald-50/95 to-background border-emerald-500/25 dark:from-emerald-950/40 dark:to-background`
  }
  if (wf === "pausado") {
    return `${base} from-amber-50/95 to-background border-amber-500/28 dark:from-amber-950/35 dark:to-background`
  }
  if (wf === "turno_abierto") {
    return `${base} from-cyan-50/95 to-background border-cyan-500/28 dark:from-cyan-950/35 dark:to-background`
  }
  if (wf === "entre_turnos") {
    return `${base} from-sky-50/95 to-background border-sky-500/28 dark:from-sky-950/35 dark:to-background`
  }
  if (wf === "finalizado") {
    return `${base} from-slate-100/90 to-background border-slate-400/30 dark:from-slate-900/50 dark:to-background`
  }
  return `${base} from-violet-50/90 to-background border-violet-400/28 dark:from-violet-950/35 dark:to-background`
}

/** Resumen de segmentos de tiempo (API bandeja corte/tintas). */
export type AreaTimeSummary = {
  effective_seconds: number
  dead_seconds: number
  open_segment_type: string | null
  open_started_at: string | null
}

export function mesBandFromAreaTimeSummary(
  summary: AreaTimeSummary | null | undefined,
  nowMs: number,
  areaLabel: string,
): MesBandejaMes | null {
  if (!summary) return null
  let effSec = summary.effective_seconds
  let deadSec = summary.dead_seconds
  let totalSec = summary.effective_seconds + summary.dead_seconds
  if (summary.open_segment_type && summary.open_started_at) {
    const startMs = new Date(summary.open_started_at).getTime()
    if (Number.isFinite(startMs)) {
      const elapsed = Math.max(0, (nowMs - startMs) / 1000)
      if (summary.open_segment_type === "downtime") {
        deadSec += elapsed
      } else {
        effSec += elapsed
        totalSec += elapsed
      }
    }
  }
  const wf: MesBandejaWorkflow =
    summary.open_segment_type === "downtime"
      ? "pausado"
      : summary.open_segment_type
        ? "iniciado"
        : effSec > 0.01 || deadSec > 0.01
          ? "sin_iniciar"
          : "sin_iniciar"
  return {
    workflow: wf,
    contextLine: summary.open_segment_type
      ? segmentTypeLabelEs(summary.open_segment_type)
      : areaLabel,
    hint: summary.open_segment_type
      ? "Segmento en curso (acumulativo por OT)."
      : "Sin segmento abierto.",
    effectiveHms: formatHmsFromSeconds(effSec),
    deadHms: formatHmsFromSeconds(deadSec),
    totalHms: formatHmsFromSeconds(totalSec),
    showTimes: effSec > 0.01 || deadSec > 0.01 || Boolean(summary.open_segment_type),
    showDeadBreakdown: deadSec > 0.5,
  }
}

function segmentTypeLabelEs(t: string): string {
  if (t === "mount") return "Montaje máquina"
  if (t === "demount") return "Desmontaje"
  if (t === "production") return "Producción"
  if (t === "downtime") return "Tiempo muerto"
  return t
}
