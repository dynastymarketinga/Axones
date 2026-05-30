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
  /** Kg de salida acumulados (p. ej. impresión: cerrados + turno actual). */
  producidoKg?: number
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

export function mesBandejaRowAccentClass(wf: MesBandejaWorkflow): string {
  if (wf === "iniciado") {
    return "border-l-[5px] border-l-emerald-500 bg-emerald-500/[0.055] [&>td]:group-hover:bg-emerald-500/10"
  }
  if (wf === "pausado") {
    return "border-l-[5px] border-l-amber-500 bg-amber-500/[0.065] [&>td]:group-hover:bg-amber-500/11"
  }
  if (wf === "turno_abierto") {
    return "border-l-[5px] border-l-cyan-500 bg-cyan-500/[0.055] [&>td]:group-hover:bg-cyan-500/10"
  }
  if (wf === "entre_turnos") {
    return "border-l-[5px] border-l-sky-500 bg-sky-500/[0.055] [&>td]:group-hover:bg-sky-500/10"
  }
  if (wf === "finalizado") {
    return "border-l-[5px] border-l-slate-500 bg-slate-500/[0.06] [&>td]:group-hover:bg-slate-500/10"
  }
  return "border-l-[5px] border-l-violet-500 bg-violet-500/[0.05] [&>td]:group-hover:bg-violet-500/9"
}

export function mesBandejaStatePillClass(wf: MesBandejaWorkflow): string {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
  if (wf === "iniciado") {
    return `${base} border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50`
  }
  if (wf === "pausado") {
    return `${base} border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-50`
  }
  if (wf === "turno_abierto") {
    return `${base} border-cyan-500/35 bg-cyan-500/12 text-cyan-950 dark:text-cyan-50`
  }
  if (wf === "entre_turnos") {
    return `${base} border-sky-500/35 bg-sky-500/12 text-sky-950 dark:text-sky-50`
  }
  if (wf === "finalizado") {
    return `${base} border-slate-500/35 bg-slate-500/12 text-slate-800 dark:text-slate-100`
  }
  return `${base} border-violet-500/35 bg-violet-500/12 text-violet-950 dark:text-violet-100`
}

export function mesBandejaWorkflowTitle(wf: MesBandejaWorkflow): string {
  return labelForWorkflow(wf)
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
