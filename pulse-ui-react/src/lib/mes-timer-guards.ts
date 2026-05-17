/** Guards for MES production save: turno abierto + cronómetro iniciado al menos una vez. */

export const MES_SAVE_BLOCKED_MESSAGE =
  "Abra un turno de planta e inicie el cronómetro (play) antes de guardar."

export type MesAreaTimerPrefix = "mont" | "imp" | "lam" | "cor"

export type MesProductionTimerFields = {
  timerState: string
  effectiveAccSec: number
  deadAccSec: number
  lastResumeAt: number
  pauseAt: number
  pauseEntriesCount: number
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function pauseEntriesCount(form: Record<string, unknown>, pausesKey: string): number {
  const raw = form[pausesKey]
  if (!Array.isArray(raw)) return 0
  return raw.filter((x) => {
    if (x === null || typeof x !== "object") return false
    const reason = readString((x as { reason?: unknown }).reason)
    return reason.trim() !== ""
  }).length
}

/** Same semantics as `canPreviewTimerReport` timer leg (without turno / readOnly checks). */
export function hasProductionTimerStarted(fields: MesProductionTimerFields): boolean {
  const startedByState =
    fields.timerState === "running" ||
    fields.timerState === "paused" ||
    fields.timerState === "stopped" ||
    fields.timerState === "completed"
  const startedByLegacy =
    fields.effectiveAccSec > 0 ||
    fields.deadAccSec > 0 ||
    fields.lastResumeAt > 0 ||
    fields.pauseAt > 0 ||
    fields.pauseEntriesCount > 0
  return startedByState || startedByLegacy
}

export function mesTimerFieldsFromForm(
  form: Record<string, unknown>,
  prefix: MesAreaTimerPrefix,
): MesProductionTimerFields {
  return {
    timerState: readString(form[`${prefix}TimerState`]) || "pending",
    effectiveAccSec: readNumber(form[`${prefix}TimerEffectiveAccSec`]),
    deadAccSec: readNumber(form[`${prefix}TimerDeadAccSec`]),
    lastResumeAt: readNumber(form[`${prefix}TimerLastResumeAtMs`]),
    pauseAt: readNumber(form[`${prefix}TimerPauseAtMs`]),
    pauseEntriesCount: pauseEntriesCount(form, `${prefix}TimerPauses`),
  }
}

export type MesProductionSaveAreaConfig = {
  prefix: MesAreaTimerPrefix
  actualKey: string
  /** When actual is null, optional legacy flat turno fields still count as open shift. */
  legacyTurnoKeys?: string[]
}

function hasActiveTurnoInForm(
  form: Record<string, unknown>,
  actualKey: string,
  legacyTurnoKeys?: string[],
): boolean {
  const actual = form[actualKey]
  if (actual !== null && actual !== undefined && typeof actual === "object" && !Array.isArray(actual)) {
    return true
  }
  if (!legacyTurnoKeys?.length) return false
  return legacyTurnoKeys.some((k) => readString(form[k]).trim() !== "")
}

/** Turno de planta abierto (sin exigir cronómetro iniciado). */
export function hasActiveProductionTurno(
  form: Record<string, unknown>,
  config: MesProductionSaveAreaConfig,
): boolean {
  return hasActiveTurnoInForm(form, config.actualKey, config.legacyTurnoKeys)
}

/**
 * Whether a production-area form may be persisted via the main «Guardar» action.
 */
export function canSaveProductionAreaForm(
  form: Record<string, unknown>,
  config: MesProductionSaveAreaConfig,
): boolean {
  if (!hasActiveProductionTurno(form, config)) {
    return false
  }
  return hasProductionTimerStarted(mesTimerFieldsFromForm(form, config.prefix))
}

export const MES_PRODUCTION_SAVE_CONFIG = {
  montaje: {
    prefix: "mont",
    actualKey: "montTurnoActual",
  },
  impresion: {
    prefix: "imp",
    actualKey: "impTurnoActual",
    legacyTurnoKeys: ["impOperador", "impTurno", "impGrupo"],
  },
  laminacion: {
    prefix: "lam",
    actualKey: "lamTurnoActual",
  },
  corte: {
    prefix: "cor",
    actualKey: "corTurnoActual",
    legacyTurnoKeys: ["cor_turno_actual", "corOperador", "corTurno", "corGrupo"],
  },
} as const satisfies Record<string, MesProductionSaveAreaConfig>
