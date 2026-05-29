export const MON_TURNOS_KEY = "montTurnosMontaje"
export const MON_ACTUAL_KEY = "montTurnoActual"
export const MON_ESTADO_KEY = "montEstadoArea"
export const MON_OBS_KEY = "montObservaciones"

export type MontajeEstadoArea = "abierta" | "finalizada"

export type MontajePauseEntry = {
  at: string
  reason: string
  obs: string
  duration_sec: number
}

export type MontajeTurnTimerState =
  | "pending"
  | "running"
  | "paused"
  | "stopped"
  | "completed"

export type MontajeTurnTimer = {
  state: MontajeTurnTimerState
  startedAtMs: number
  lastResumeAtMs: number
  pauseAtMs: number
  effectiveAccSec: number
  deadAccSec: number
  pauses: MontajePauseEntry[]
}

export type MontajeTurnoEntry = {
  id: string
  started_at: string
  closed_at: string | null
  closed_by: { id: number; name: string } | null
  control_owner_user_id?: number | null
  control_owner_name?: string | null
  control_taken_at?: string | null
  turno: "diurno" | "nocturno" | ""
  grupo: "A" | "B" | "C" | ""
  operador: string
  ayudante: string
  supervisor: string
  observaciones: string
  timer: MontajeTurnTimer
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

export function newMontajeTurnoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `mont-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function emptyMontajeTurnTimer(): MontajeTurnTimer {
  return {
    state: "pending",
    startedAtMs: 0,
    lastResumeAtMs: 0,
    pauseAtMs: 0,
    effectiveAccSec: 0,
    deadAccSec: 0,
    pauses: [],
  }
}

export function createNewMontajeTurno(params: {
  turno: "diurno" | "nocturno"
  grupo: "A" | "B" | "C"
  operador: string
  controlOwner?: { id: number; name: string } | null
}): MontajeTurnoEntry {
  const now = new Date().toISOString()
  return {
    id: newMontajeTurnoId(),
    started_at: now,
    closed_at: null,
    closed_by: null,
    control_owner_user_id: params.controlOwner?.id ?? null,
    control_owner_name: params.controlOwner?.name ?? null,
    control_taken_at: params.controlOwner ? now : null,
    turno: params.turno,
    grupo: params.grupo,
    operador: params.operador.trim(),
    ayudante: "",
    supervisor: "",
    observaciones: "",
    timer: emptyMontajeTurnTimer(),
  }
}

function parsePauseEntries(raw: unknown): MontajePauseEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => x as Partial<MontajePauseEntry>)
    .map((x) => ({
      at: readString(x.at),
      reason: readString(x.reason),
      obs: readString(x.obs),
      duration_sec: readNumber(x.duration_sec),
    }))
    .filter((x) => x.reason)
}

function parseTimer(raw: unknown): MontajeTurnTimer {
  if (!raw || typeof raw !== "object") return emptyMontajeTurnTimer()
  const o = raw as Record<string, unknown>
  const state = readString(o.state) as MontajeTurnTimerState
  const valid: MontajeTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
  return {
    state: valid.includes(state) ? state : "pending",
    startedAtMs: readNumber(o.startedAtMs),
    lastResumeAtMs: readNumber(o.lastResumeAtMs),
    pauseAtMs: readNumber(o.pauseAtMs),
    effectiveAccSec: readNumber(o.effectiveAccSec),
    deadAccSec: readNumber(o.deadAccSec),
    pauses: parsePauseEntries(o.pauses),
  }
}

export function timerFromLegacyFlatForm(form: Record<string, unknown>): MontajeTurnTimer {
  const state = (readString(form.montTimerState) || "pending") as MontajeTurnTimerState
  const valid: MontajeTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
  return {
    state: valid.includes(state) ? state : "pending",
    startedAtMs: readNumber(form.montTimerStartedAtMs),
    lastResumeAtMs: readNumber(form.montTimerLastResumeAtMs),
    pauseAtMs: readNumber(form.montTimerPauseAtMs),
    effectiveAccSec: readNumber(form.montTimerEffectiveAccSec),
    deadAccSec: readNumber(form.montTimerDeadAccSec),
    pauses: parsePauseEntries(form.montTimerPauses),
  }
}

export function timerToLegacyFlat(timer: MontajeTurnTimer): Record<string, unknown> {
  return {
    montTimerState: timer.state,
    montTimerStartedAtMs: timer.startedAtMs,
    montTimerLastResumeAtMs: timer.lastResumeAtMs,
    montTimerPauseAtMs: timer.pauseAtMs,
    montTimerEffectiveAccSec: timer.effectiveAccSec,
    montTimerDeadAccSec: timer.deadAccSec,
    montTimerPauses: timer.pauses,
  }
}

export function normalizeMontajeTurno(raw: unknown): MontajeTurnoEntry | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  let id = readString(o.id)
  if (!id) {
    const operadorProbe = readString(o.operador).trim()
    const turnoProbe = readString(o.turno).trim()
    const grupoProbe = readString(o.grupo).trim()
    if (!operadorProbe && !turnoProbe && !grupoProbe) return null
    id = `recovered-${Date.now()}`
  }
  const turnoRaw = readString(o.turno).toLowerCase()
  const grupoRaw = readString(o.grupo).toUpperCase()
  const turno: MontajeTurnoEntry["turno"] =
    turnoRaw === "diurno" || turnoRaw === "nocturno" ? (turnoRaw as "diurno" | "nocturno") : ""
  const grupo: MontajeTurnoEntry["grupo"] =
    grupoRaw === "A" || grupoRaw === "B" || grupoRaw === "C" ? (grupoRaw as "A" | "B" | "C") : ""

  let closedBy: MontajeTurnoEntry["closed_by"] = null
  const cb = o.closed_by
  if (cb && typeof cb === "object") {
    const c = cb as Record<string, unknown>
    const cid = readNumber(c.id)
    if (cid > 0) closedBy = { id: cid, name: readString(c.name) || "—" }
  }

  return {
    id,
    started_at: readString(o.started_at) || new Date().toISOString(),
    closed_at: o.closed_at === null || o.closed_at === undefined ? null : readString(o.closed_at),
    closed_by: closedBy,
    control_owner_user_id:
      o.control_owner_user_id === null || o.control_owner_user_id === undefined
        ? null
        : readNumber(o.control_owner_user_id),
    control_owner_name: readString(o.control_owner_name) || null,
    control_taken_at: readString(o.control_taken_at) || null,
    turno,
    grupo,
    operador: readString(o.operador),
    ayudante: readString(o.ayudante),
    supervisor: readString(o.supervisor),
    observaciones: readString(o.observaciones),
    timer: parseTimer(o.timer),
  }
}

export function parseMontajeTurnos(raw: unknown): MontajeTurnoEntry[] {
  if (!Array.isArray(raw)) return []
  const out: MontajeTurnoEntry[] = []
  for (const item of raw) {
    const t = normalizeMontajeTurno(item)
    if (t) out.push(t)
  }
  return out
}

export function parseMontajeTurnoActual(raw: unknown): MontajeTurnoEntry | null {
  if (raw === null || raw === undefined) return null
  return normalizeMontajeTurno(raw)
}

/** Indica turno abierto según espejo plano (campos mont* en form). */
export function legacyMirrorIndicatesOpenMontajeShift(form: Record<string, unknown>): boolean {
  const operador = readString(form.montOperador).trim()
  const turno = readString(form.montTurno).toLowerCase()
  const grupo = readString(form.montGrupo).toUpperCase()
  const timer = timerFromLegacyFlatForm(form)
  const shiftMeta =
    operador !== "" ||
    turno === "diurno" ||
    turno === "nocturno" ||
    grupo === "A" ||
    grupo === "B" ||
    grupo === "C"
  const timerActive =
    timer.state === "running" ||
    timer.state === "paused" ||
    timer.state === "pending" ||
    timer.effectiveAccSec > 0.01 ||
    timer.lastResumeAtMs > 0 ||
    timer.pauseAtMs > 0
  return shiftMeta && (timerActive || operador !== "")
}

/** Reconstruye turno actual desde espejo plano cuando falta el objeto anidado en BD. */
export function synthesizeMontajeTurnoFromLegacyMirror(
  form: Record<string, unknown>,
): MontajeTurnoEntry | null {
  if (!legacyMirrorIndicatesOpenMontajeShift(form)) return null
  const turnoRaw = readString(form.montTurno).toLowerCase()
  const grupoRaw = readString(form.montGrupo).toUpperCase()
  const turno: MontajeTurnoEntry["turno"] =
    turnoRaw === "diurno" || turnoRaw === "nocturno" ? (turnoRaw as "diurno" | "nocturno") : ""
  const grupo: MontajeTurnoEntry["grupo"] =
    grupoRaw === "A" || grupoRaw === "B" || grupoRaw === "C" ? (grupoRaw as "A" | "B" | "C") : ""
  const nested = form[MON_ACTUAL_KEY]
  const nestedId =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? readString((nested as Record<string, unknown>).id)
      : ""
  return {
    id: nestedId || `mirror-${readString(form.montOperador).trim() || "turno"}`,
    started_at: new Date().toISOString(),
    closed_at: null,
    closed_by: null,
    turno,
    grupo,
    operador: readString(form.montOperador),
    ayudante: readString(form.montAyudante),
    supervisor: readString(form.montSupervisor),
    observaciones: readString(form.montObservaciones),
    timer: timerFromLegacyFlatForm(form),
  }
}

/** Turno en curso: objeto anidado o espejo plano (bandeja / guardado). */
export function resolveMontajeTurnoActual(form: Record<string, unknown>): MontajeTurnoEntry | null {
  const nested = parseMontajeTurnoActual(form[MON_ACTUAL_KEY])
  if (nested) return nested
  return synthesizeMontajeTurnoFromLegacyMirror(form)
}

export function readEstadoArea(raw: unknown): MontajeEstadoArea {
  const s = readString(raw).toLowerCase().trim()
  if (s === "finalizada") return "finalizada"
  return "abierta"
}

export function montajeTurnoToMirror(t: MontajeTurnoEntry): Record<string, unknown> {
  return {
    montTurno: t.turno,
    montGrupo: t.grupo,
    montOperador: t.operador,
    montAyudante: t.ayudante,
    montSupervisor: t.supervisor,
    montObservaciones: t.observaciones,
    ...timerToLegacyFlat(t.timer),
  }
}

/** Limpia solo datos del turno de planta en curso; no toca el cronómetro. */
export function clearMontajeShiftMirrorKeysOnly(): Record<string, unknown> {
  return {
    montTurno: "",
    montGrupo: "",
    montOperador: "",
    montAyudante: "",
    montSupervisor: "",
    montObservaciones: "",
    montAcumuladoProducidoKg: "",
    montRegistrosTurnos: "",
  }
}

export function clearMontajeMirrorKeys(): Record<string, unknown> {
  return {
    ...clearMontajeShiftMirrorKeysOnly(),
    ...timerToLegacyFlat(emptyMontajeTurnTimer()),
  }
}

export function bootstrapMontajeFormState(mergedForm: Record<string, unknown>): Record<string, unknown> {
  const turnos = parseMontajeTurnos(mergedForm[MON_TURNOS_KEY])
  const actual = resolveMontajeTurnoActual(mergedForm)
  const estado = readEstadoArea(mergedForm[MON_ESTADO_KEY])

  let next: Record<string, unknown> = {
    ...mergedForm,
    [MON_TURNOS_KEY]: turnos,
    [MON_ACTUAL_KEY]: actual,
    [MON_ESTADO_KEY]: estado,
  }

  if (actual) {
    next = { ...next, ...montajeTurnoToMirror(actual) }
  } else {
    next = { ...next, ...clearMontajeShiftMirrorKeysOnly() }
  }

  return next
}

export function sumProduccionKg(t: MontajeTurnoEntry): number {
  void t
  return 0
}

export type JsonAccumulatedMontaje = {
  producidoKg: number
  turnosCerrados: number
  turnosRegistrados: number
  ultimoCierreLabel: string
}

export function accumulateMontajeFromJson(
  cerrados: MontajeTurnoEntry[],
  actual: MontajeTurnoEntry | null,
): JsonAccumulatedMontaje {
  let producidoKg = 0
  for (const t of cerrados) producidoKg += sumProduccionKg(t)
  if (actual) producidoKg += sumProduccionKg(actual)

  const ultimo = [...cerrados].sort((a, b) =>
    readString(b.closed_at ?? "").localeCompare(readString(a.closed_at ?? "")),
  )[0]
  let ultimoCierreLabel = "Sin producción previa"
  if (ultimo?.closed_at) {
    try {
      ultimoCierreLabel = `Último cierre: ${new Date(ultimo.closed_at).toLocaleString("es-VE")}`
    } catch {
      ultimoCierreLabel = "Turno cerrado"
    }
  } else if (cerrados.length > 0) {
    ultimoCierreLabel = "Turno cerrado"
  }

  return {
    producidoKg,
    turnosCerrados: cerrados.length,
    turnosRegistrados: cerrados.length + (actual ? 1 : 0),
    ultimoCierreLabel,
  }
}

export const MON_PAUSE_REASONS = [
  "Ajuste de cilindros",
  "Cambio de cliché",
  "Falla mecánica",
  "Falla eléctrica",
  "Problema de registro",
  "Problema de calidad",
  "Falta de material",
  "Almuerzo/Descanso",
  "Otro",
]

export function formatTimerHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":")
}

export function finalizeTurnTimerNow(timer: MontajeTurnTimer): MontajeTurnTimer {
  const now = Date.now()
  let effective = timer.effectiveAccSec
  let dead = timer.deadAccSec
  if (timer.state === "running" && timer.lastResumeAtMs > 0) {
    effective += (now - timer.lastResumeAtMs) / 1000
  }
  if (timer.state === "paused" && timer.pauseAtMs > 0) {
    dead += (now - timer.pauseAtMs) / 1000
  }
  return {
    ...timer,
    state: "stopped",
    effectiveAccSec: effective,
    deadAccSec: dead,
    pauseAtMs: 0,
    lastResumeAtMs: 0,
  }
}
