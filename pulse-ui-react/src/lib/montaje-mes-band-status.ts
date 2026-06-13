import {
  MON_ESTADO_KEY,
  MON_TURNOS_KEY,
  accumulateMontajeFromJson,
  bootstrapMontajeFormState,
  montajeAnyTimedPhaseRunning,
  parseMontajeTurnos,
  readEstadoArea,
  resolveMontajeTurnoActual,
  shiftArranqueSeconds,
  shiftDemountSeconds,
  shiftMontajeOpSeconds,
  sumMermaKg,
  sumProduccionKg,
  type MontajeTurnoEntry,
  type MontajeTurnTimer,
} from "@/pages/axones/montaje-turnos"

import {
  buildMesBandFromTurnos,
  mesBandejaCardClass,
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowTitle,
  deriveMesOperativoEstadoFromMes,
  technicalFormFromRow,
  type MesBandejaWorkflow,
  type MesBandejaMes,
  type MesOperativoEstado,
} from "@/lib/mes-timer-band-shared"

export { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"
export type { MesBandejaMes, MesBandejaWorkflow }

export const MONTAJE_CONTROL_SAVED_EVENT = "axones-montaje-control-saved"

export type MontajeTurnoBandejaItem = {
  turno: MontajeTurnoEntry
  enCurso: boolean
}

/** Misma normalización que la OT en Producción → Montaje. */
export function montajeFormForMesBand(form: Record<string, unknown> | null): {
  cerrados: MontajeTurnoEntry[]
  actual: MontajeTurnoEntry | null
  estado: "abierta" | "finalizada"
} {
  if (!form) {
    return { cerrados: [], actual: null, estado: "abierta" }
  }
  const booted = bootstrapMontajeFormState(form)
  let cerrados = parseMontajeTurnos(booted[MON_TURNOS_KEY])
  let actual = resolveMontajeTurnoActual(booted)
  if (actual?.closed_at) {
    if (!cerrados.some((t) => t.id === actual!.id)) {
      cerrados = [...cerrados, actual]
    }
    actual = null
  }
  return {
    cerrados,
    actual,
    estado: readEstadoArea(booted[MON_ESTADO_KEY]),
  }
}

export function montajeTurnosBandejaItems(form: Record<string, unknown> | null): MontajeTurnoBandejaItem[] {
  const { cerrados, actual } = montajeFormForMesBand(form)
  const items: MontajeTurnoBandejaItem[] = cerrados.map((turno) => ({ turno, enCurso: false }))
  if (actual) items.push({ turno: actual, enCurso: true })
  return items
}

/** Etiqueta de fase activa (alineada con el badge del cronómetro en la OT). */
export function montajePhaseStatusLabel(timer: MontajeTurnTimer): string | null {
  if (timer.state === "paused") return "Producción en pausa"
  if (timer.state === "running") return "Producción en marcha"
  if (timer.demountState === "running") return "Desmontaje en marcha"
  if (timer.montajeOpState === "running") return "Montaje en marcha"
  if (timer.arranqueState === "running") return "Arranque en marcha"
  return null
}

function montajePhaseHint(timer: MontajeTurnTimer): string | null {
  const label = montajePhaseStatusLabel(timer)
  if (!label) return null
  if (timer.state === "paused") {
    return "Producción en pausa; el tiempo efectivo no aumenta hasta reanudar."
  }
  if (timer.state === "running") {
    return "Tiempo efectivo corriendo (se detiene al pausar)."
  }
  if (timer.demountState === "running") {
    return "Desmontaje en curso en la máquina."
  }
  if (timer.montajeOpState === "running") {
    return "Operación de montaje en máquina (limpieza / recorridos)."
  }
  if (timer.arranqueState === "running") {
    return "Arranque (preparación) en curso; pulse «Parar arranque» o inicie producción."
  }
  return null
}

/** Bandeja MES con fases de cronómetro y kg de producción del turno. */
export function buildMontajeMesBand(params: {
  estado: "abierta" | "finalizada"
  cerrados: MontajeTurnoEntry[]
  actual: MontajeTurnoEntry | null
  nowMs: number
  form: Record<string, unknown> | null
}): MesBandejaMes {
  const { estado, cerrados, actual, nowMs, form } = params
  const base = buildMesBandFromTurnos({
    areaLabel: "Montaje",
    estado,
    cerrados,
    actual,
    nowMs,
    form,
  })

  const acc = accumulateMontajeFromJson(cerrados, actual)
  let mermaKg = 0
  for (const t of cerrados) mermaKg += sumMermaKg(t)
  if (actual) mermaKg += sumMermaKg(actual)

  const enriched: MesBandejaMes = {
    ...base,
    producidoKg: acc.producidoKg > 0.005 ? acc.producidoKg : undefined,
    desperdicioKg: mermaKg > 0.005 ? mermaKg : undefined,
  }

  if (estado === "finalizada" || !actual) {
    return enriched
  }

  const phaseLabel = montajePhaseStatusLabel(actual.timer)
  const phaseHint = montajePhaseHint(actual.timer)

  if (phaseLabel) {
    let workflow: MesBandejaWorkflow = enriched.workflow
    if (actual.timer.state === "paused") {
      workflow = "pausado"
    } else if (
      actual.timer.state === "running" ||
      montajeAnyTimedPhaseRunning(actual.timer)
    ) {
      workflow = "iniciado"
    }
    return {
      ...enriched,
      workflow,
      statusLabel: phaseLabel,
      hint: phaseHint ?? enriched.hint,
      showTimes: true,
    }
  }

  const hasPhaseTime =
    actual.timer.arranqueAccSec > 0.01 ||
    actual.timer.montajeOpAccSec > 0.01 ||
    actual.timer.demountAccSec > 0.01 ||
    actual.timer.effectiveAccSec > 0.01

  if (hasPhaseTime && enriched.workflow === "turno_abierto") {
    return {
      ...enriched,
      workflow: "iniciado",
      statusLabel: "Cronómetro con registro",
      hint: "Hay tiempos registrados en el turno. Continúe en la OT o cierre el turno.",
      showTimes: true,
    }
  }

  return enriched
}

export function montajeMesBandFromWorkOrderRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): MesBandejaMes | null {
  const form = technicalFormFromRow(row)
  if (!form) return null
  const bs = (row.board_stage ?? "").toLowerCase()
  const { cerrados, actual, estado } = montajeFormForMesBand(form)
  const hasMontajeTurno = actual !== null || cerrados.length > 0
  if (bs !== "montaje" && !hasMontajeTurno) return null

  return buildMontajeMesBand({
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

export type MontajeOperativoEstado = MesOperativoEstado

/** Misma lógica que la bandeja `/axones/montaje` a partir del formulario técnico. */
export function deriveMontajeOperativoEstado(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MontajeOperativoEstado {
  const { cerrados, actual, estado } = montajeFormForMesBand(form ?? null)
  const mes = buildMontajeMesBand({
    estado,
    cerrados,
    actual,
    nowMs,
    form: form ?? null,
  })
  return deriveMesOperativoEstadoFromMes(mes)
}

export function montajeMesBandFromForm(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MesBandejaMes {
  return deriveMontajeOperativoEstado(form, nowMs).mes
}

export type MontajeActivasSubTab = "pendientes" | "produccion" | "finalizadas"

export function montajeActivasBucketFromRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): MontajeActivasSubTab {
  const mes = montajeMesBandFromWorkOrderRow(row, nowMs)
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
  const form = technicalFormFromRow(row)
  const { cerrados, actual } = montajeFormForMesBand(form)
  if (cerrados.length > 0 || actual) return "produccion"
  return "pendientes"
}

export type MontajeTurnLiveTimes = {
  efectivoSec: number
  deadSec: number
  arranqueSec: number
  montajeOpSec: number
  demountSec: number
  totalProduccionSec: number
  state: string
  numParadas: number
  horaArranque: string
  arranqueLive: boolean
  montajeOpLive: boolean
  demountLive: boolean
  efectivoLive: boolean
  produccionKg: number
  mermaKg: number
}

export function resolveMontajeTurnLiveTimes(
  turno: MontajeTurnoEntry,
  nowMs: number,
): MontajeTurnLiveTimes {
  const t = turno.timer
  let efectivoSec = t.effectiveAccSec
  if (t.state === "running" && t.lastResumeAtMs > 0) {
    efectivoSec += (nowMs - t.lastResumeAtMs) / 1000
  }
  let deadSec = t.deadAccSec
  if (t.state === "paused" && t.pauseAtMs > 0) {
    deadSec += (nowMs - t.pauseAtMs) / 1000
  }
  const pauses = Array.isArray(t.pauses) ? t.pauses : []
  return {
    efectivoSec,
    deadSec,
    arranqueSec: shiftArranqueSeconds(t, nowMs),
    montajeOpSec: shiftMontajeOpSeconds(t, nowMs),
    demountSec: shiftDemountSeconds(t, nowMs),
    totalProduccionSec: efectivoSec + deadSec,
    state: t.state,
    numParadas: pauses.length,
    horaArranque:
      t.arranqueStartedAtMs > 0
        ? new Date(t.arranqueStartedAtMs).toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
        : "—",
    arranqueLive: t.arranqueState === "running",
    montajeOpLive: t.montajeOpState === "running",
    demountLive: t.demountState === "running",
    efectivoLive: t.state === "running",
    produccionKg: sumProduccionKg(turno),
    mermaKg: sumMermaKg(turno),
  }
}

export function montajeOtPhaseTotals(
  items: MontajeTurnoBandejaItem[],
  nowMs: number,
): { arranqueSec: number; montajeOpSec: number; demountSec: number } {
  let arranqueSec = 0
  let montajeOpSec = 0
  let demountSec = 0
  for (const { turno, enCurso } of items) {
    const live = resolveMontajeTurnLiveTimes(turno, enCurso ? nowMs : Date.parse(turno.closed_at ?? turno.started_at) || nowMs)
    arranqueSec += live.arranqueSec
    montajeOpSec += live.montajeOpSec
    demountSec += live.demountSec
  }
  return { arranqueSec, montajeOpSec, demountSec }
}
