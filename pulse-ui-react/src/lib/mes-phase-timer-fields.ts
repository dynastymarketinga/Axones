/** Campos de fases arranque / desmontaje en cronómetro MES (compartido entre áreas). */

export type MesPhaseSlotState = "idle" | "running" | "stopped"

export type MesPhaseTimerFields = {
  arranqueState: MesPhaseSlotState
  arranqueAccSec: number
  arranqueStartedAtMs: number
  arranqueLastResumeAtMs: number
  demountState: MesPhaseSlotState
  demountAccSec: number
  demountStartedAtMs: number
  demountLastResumeAtMs: number
}

export function emptyMesPhaseTimerFields(): MesPhaseTimerFields {
  return {
    arranqueState: "idle",
    arranqueAccSec: 0,
    arranqueStartedAtMs: 0,
    arranqueLastResumeAtMs: 0,
    demountState: "idle",
    demountAccSec: 0,
    demountStartedAtMs: 0,
    demountLastResumeAtMs: 0,
  }
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function parseMesPhaseSlotState(raw: unknown): MesPhaseSlotState {
  const s = readString(raw) as MesPhaseSlotState
  return s === "running" || s === "stopped" ? s : "idle"
}

export function shiftPhaseSlotSeconds(
  accSec: number,
  state: MesPhaseSlotState,
  lastResumeAtMs: number,
  nowMs: number,
): number {
  let sec = accSec
  if (state === "running" && lastResumeAtMs > 0) {
    sec += (nowMs - lastResumeAtMs) / 1000
  }
  return sec
}

export function parseMesPhaseFieldsFromRecord(o: Record<string, unknown>): MesPhaseTimerFields {
  return {
    arranqueState: parseMesPhaseSlotState(o.arranqueState),
    arranqueAccSec: readNumber(o.arranqueAccSec),
    arranqueStartedAtMs: readNumber(o.arranqueStartedAtMs),
    arranqueLastResumeAtMs: readNumber(o.arranqueLastResumeAtMs),
    demountState: parseMesPhaseSlotState(o.demountState),
    demountAccSec: readNumber(o.demountAccSec),
    demountStartedAtMs: readNumber(o.demountStartedAtMs),
    demountLastResumeAtMs: readNumber(o.demountLastResumeAtMs),
  }
}

/** `prefix` p. ej. `impTimer` → claves `impTimerArranqueState`, … */
export function mesPhaseFieldsFromLegacyForm(
  form: Record<string, unknown>,
  prefix: string,
): MesPhaseTimerFields {
  return {
    arranqueState: parseMesPhaseSlotState(form[`${prefix}ArranqueState`]),
    arranqueAccSec: readNumber(form[`${prefix}ArranqueAccSec`]),
    arranqueStartedAtMs: readNumber(form[`${prefix}ArranqueStartedAtMs`]),
    arranqueLastResumeAtMs: readNumber(form[`${prefix}ArranqueLastResumeAtMs`]),
    demountState: parseMesPhaseSlotState(form[`${prefix}DemountState`]),
    demountAccSec: readNumber(form[`${prefix}DemountAccSec`]),
    demountStartedAtMs: readNumber(form[`${prefix}DemountStartedAtMs`]),
    demountLastResumeAtMs: readNumber(form[`${prefix}DemountLastResumeAtMs`]),
  }
}

export function mesPhaseFieldsToLegacyFlat(
  fields: MesPhaseTimerFields,
  prefix: string,
): Record<string, unknown> {
  return {
    [`${prefix}ArranqueState`]: fields.arranqueState,
    [`${prefix}ArranqueAccSec`]: fields.arranqueAccSec,
    [`${prefix}ArranqueStartedAtMs`]: fields.arranqueStartedAtMs,
    [`${prefix}ArranqueLastResumeAtMs`]: fields.arranqueLastResumeAtMs,
    [`${prefix}DemountState`]: fields.demountState,
    [`${prefix}DemountAccSec`]: fields.demountAccSec,
    [`${prefix}DemountStartedAtMs`]: fields.demountStartedAtMs,
    [`${prefix}DemountLastResumeAtMs`]: fields.demountLastResumeAtMs,
  }
}

export function shiftArranqueSeconds(timer: MesPhaseTimerFields, nowMs: number): number {
  return shiftPhaseSlotSeconds(
    timer.arranqueAccSec,
    timer.arranqueState,
    timer.arranqueLastResumeAtMs,
    nowMs,
  )
}

export function shiftDemountSeconds(timer: MesPhaseTimerFields, nowMs: number): number {
  return shiftPhaseSlotSeconds(
    timer.demountAccSec,
    timer.demountState,
    timer.demountLastResumeAtMs,
    nowMs,
  )
}

export function finalizeMesPhaseSlotsOnTimer<T extends MesPhaseTimerFields>(timer: T, now = Date.now()): T {
  const arranqueAcc = shiftArranqueSeconds(timer, now)
  const demountAcc = shiftDemountSeconds(timer, now)
  return {
    ...timer,
    arranqueState: timer.arranqueState === "running" ? "stopped" : timer.arranqueState,
    arranqueAccSec: arranqueAcc,
    arranqueLastResumeAtMs: 0,
    demountState: timer.demountState === "running" ? "stopped" : timer.demountState,
    demountAccSec: demountAcc,
    demountLastResumeAtMs: 0,
  }
}

export function cumulativeDemountSeconds<T extends { timer: MesPhaseTimerFields }>(
  cerrados: T[],
  actual: T | null,
  nowMs: number,
): number {
  let sum = 0
  for (const t of cerrados) {
    sum += t.timer.demountAccSec
  }
  if (!actual) return sum
  return sum + shiftDemountSeconds(actual.timer, nowMs)
}
