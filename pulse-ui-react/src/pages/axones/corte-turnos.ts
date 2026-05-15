/** Turnos de planta y métricas del área Corte (OT). */

export const COR_TURNOS_KEY = "cor_turnos"
export const COR_ACTUAL_KEY = "corTurnoActual"
export const COR_LEGACY_ACTUAL_KEY = "cor_turno_actual"

/** Bobinas impresa de ingreso al área (paridad operativa con impresión: 30 posiciones). */
export const COR_ENTRADA_SLOTS = 30
export const COR_ROLLOS_PER_PALETA = 48

export type CortePauseEntry = {
  at: string
  reason: string
  obs: string
  duration_sec: number
}

export type CorteTurnTimerState = "pending" | "running" | "paused" | "stopped" | "completed"

export type CorteTurnTimer = {
  state: CorteTurnTimerState
  startedAtMs: number
  lastResumeAtMs: number
  pauseAtMs: number
  effectiveAccSec: number
  deadAccSec: number
  pauses: CortePauseEntry[]
}

export type CorPaleta = {
  id: string
  label: string
  rollosKg: string[]
  status?: "en_progreso" | "cerrada_opcional"
}

export type CorteTurnMetrics = {
  entrada_bobinas_kg: string
  salida_total_kg: string
  merma_kg: string
  metraje: string
  scrap_total_kg: string
  scrap_refile_kg?: string
  scrap_impreso_kg?: string
  scrap_mal_corte_kg?: string
  rollos_salida: number
  paletas: number
}

export type CorteTurnoEntry = {
  id: string
  started_at: string
  closed_at: string | null
  closed_by: { id: number; name: string } | null
  turno: "diurno" | "nocturno" | ""
  grupo: "A" | "B" | "C" | ""
  operador: string
  ayudante: string
  supervisor: string
  kgIngresados: string
  kgMerma: string
  metraje: string
  observaciones: string
  entradaBobinasKg: string[]
  paletas: CorPaleta[]
  metrics?: CorteTurnMetrics
  timer: CorteTurnTimer
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

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v
  return ""
}

function readObject(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function ensureStringArray(raw: unknown, size: number): string[] {
  const out: string[] = []
  if (Array.isArray(raw)) {
    for (const v of raw.slice(0, size)) out.push(readString(v))
  }
  while (out.length < size) out.push("")
  return out
}

export function emptyPaletaRollos(): string[] {
  return Array.from({ length: COR_ROLLOS_PER_PALETA }, () => "")
}

function toCorPaletasFromLegacy(form: Record<string, unknown>): CorPaleta[] {
  const raw = form.corSalidaPaletasKg
  if (!Array.isArray(raw)) return []
  return raw.map((p, idx) => ({
    id: `legacy-${idx + 1}`,
    label: `Paleta #${String(idx + 1).padStart(2, "0")}`,
    rollosKg: ensureStringArray(p, COR_ROLLOS_PER_PALETA),
    status: "en_progreso" as const,
  }))
}

export function getCorPaletas(form: Record<string, unknown>): CorPaleta[] {
  const raw = form.cor_paletas
  const paletas: CorPaleta[] = []
  if (Array.isArray(raw)) {
    for (const p of raw) {
      const o = readObject(p)
      const id = readString(o.id)
      const label = readString(o.label) || "Paleta"
      if (!id) continue
      paletas.push({
        id,
        label,
        rollosKg: ensureStringArray(o.rollosKg, COR_ROLLOS_PER_PALETA),
        status: (readString(o.status) as CorPaleta["status"]) || "en_progreso",
      })
    }
  }

  const fromLegacy = paletas.length === 0 ? toCorPaletasFromLegacy(form) : []
  const merged = paletas.length > 0 ? paletas : fromLegacy

  if (merged.length === 0) {
    return [
      {
        id: "p-01",
        label: "Paleta #01",
        rollosKg: emptyPaletaRollos(),
        status: "en_progreso",
      },
    ]
  }

  while (merged.length < 1) {
    merged.push({
      id: `p-${String(merged.length + 1).padStart(2, "0")}`,
      label: `Paleta #${String(merged.length + 1).padStart(2, "0")}`,
      rollosKg: emptyPaletaRollos(),
      status: "en_progreso",
    })
  }
  return merged
}

export function sumSalidaKgFromPaletas(paletas: CorPaleta[]): number {
  return paletas
    .flatMap((p) => p.rollosKg)
    .reduce((acc, v) => acc + readNumber(v), 0)
}

export function sumSalidaKgFromForm(form: Record<string, unknown>): number {
  return sumSalidaKgFromPaletas(getCorPaletas(form))
}

export function sumEntradaKgFromForm(form: Record<string, unknown>): number {
  const raw = form.corEntradaBobinasKg
  if (!Array.isArray(raw)) return 0
  return raw.reduce((acc, v) => acc + readNumber(v), 0)
}

export function sumSalidaKgFromClosedTurno(t: CorteTurnoEntry): number {
  if (t.metrics?.salida_total_kg) return readNumber(t.metrics.salida_total_kg)
  return sumSalidaKgFromPaletas(t.paletas)
}

export function newCorteTurnoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `cor-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function emptyCorteTurnTimer(): CorteTurnTimer {
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

function parsePauseEntries(raw: unknown): CortePauseEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => x as Partial<CortePauseEntry>)
    .map((x) => ({
      at: readString(x.at),
      reason: readString(x.reason),
      obs: readString(x.obs),
      duration_sec: readNumber(x.duration_sec),
    }))
    .filter((x) => x.reason)
}

function parseTimer(raw: unknown): CorteTurnTimer {
  if (!raw || typeof raw !== "object") return emptyCorteTurnTimer()
  const o = raw as Record<string, unknown>
  const state = readString(o.state) as CorteTurnTimerState
  const valid: CorteTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
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

export function timerFromLegacyFlatForm(form: Record<string, unknown>): CorteTurnTimer {
  const state = (readString(form.corTimerState) || "pending") as CorteTurnTimerState
  const valid: CorteTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
  return {
    state: valid.includes(state) ? state : "pending",
    startedAtMs: readNumber(form.corTimerStartedAtMs),
    lastResumeAtMs: readNumber(form.corTimerLastResumeAtMs),
    pauseAtMs: readNumber(form.corTimerPauseAtMs),
    effectiveAccSec: readNumber(form.corTimerEffectiveAccSec),
    deadAccSec: readNumber(form.corTimerDeadAccSec),
    pauses: parsePauseEntries(form.corTimerPauses),
  }
}

export function timerToLegacyFlat(timer: CorteTurnTimer): Record<string, unknown> {
  return {
    corTimerState: timer.state,
    corTimerStartedAtMs: timer.startedAtMs,
    corTimerLastResumeAtMs: timer.lastResumeAtMs,
    corTimerPauseAtMs: timer.pauseAtMs,
    corTimerEffectiveAccSec: timer.effectiveAccSec,
    corTimerDeadAccSec: timer.deadAccSec,
    corTimerPauses: timer.pauses,
  }
}

function parsePaletas(raw: unknown): CorPaleta[] {
  if (!Array.isArray(raw)) return []
  const out: CorPaleta[] = []
  for (const p of raw) {
    const o = readObject(p)
    const id = readString(o.id)
    if (!id) continue
    out.push({
      id,
      label: readString(o.label) || "Paleta",
      rollosKg: ensureStringArray(o.rollosKg, COR_ROLLOS_PER_PALETA),
      status: (readString(o.status) as CorPaleta["status"]) || "en_progreso",
    })
  }
  return out
}

export function normalizeCorteTurno(raw: unknown, formFallback?: Record<string, unknown>): CorteTurnoEntry | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = readString(o.id)
  if (!id) return null

  const turnoRaw = readString(o.turno).toLowerCase()
  const grupoRaw = readString(o.grupo).toUpperCase()
  const turno: CorteTurnoEntry["turno"] =
    turnoRaw === "diurno" || turnoRaw === "nocturno" ? (turnoRaw as "diurno" | "nocturno") : ""
  const grupo: CorteTurnoEntry["grupo"] =
    grupoRaw === "A" || grupoRaw === "B" || grupoRaw === "C" ? (grupoRaw as "A" | "B" | "C") : ""

  let closedBy: CorteTurnoEntry["closed_by"] = null
  const cb = o.closed_by
  if (cb && typeof cb === "object") {
    const c = cb as Record<string, unknown>
    const cid = readNumber(c.id)
    if (cid > 0) closedBy = { id: cid, name: readString(c.name) || "—" }
  }

  const fb = formFallback ?? {}
  const paletas = parsePaletas(o.paletas)
  const entradaBobinasKg = Array.isArray(o.entradaBobinasKg)
    ? ensureStringArray(o.entradaBobinasKg, COR_ENTRADA_SLOTS)
    : ensureStringArray(fb.corEntradaBobinasKg, COR_ENTRADA_SLOTS)

  let metrics: CorteTurnMetrics | undefined
  if (o.metrics && typeof o.metrics === "object") {
    const m = o.metrics as Record<string, unknown>
    metrics = {
      entrada_bobinas_kg: readString(m.entrada_bobinas_kg),
      salida_total_kg: readString(m.salida_total_kg),
      merma_kg: readString(m.merma_kg),
      metraje: readString(m.metraje),
      scrap_total_kg: readString(m.scrap_total_kg),
      scrap_refile_kg: readString(m.scrap_refile_kg),
      scrap_impreso_kg: readString(m.scrap_impreso_kg),
      scrap_mal_corte_kg: readString(m.scrap_mal_corte_kg),
      rollos_salida: readNumber(m.rollos_salida),
      paletas: readNumber(m.paletas),
    }
  }

  return {
    id,
    started_at: readString(o.started_at) || new Date().toISOString(),
    closed_at: o.closed_at === null || o.closed_at === undefined ? null : readString(o.closed_at),
    closed_by: closedBy,
    turno,
    grupo,
    operador: readString(o.operador) || readString(fb.corOperador),
    ayudante: readString(o.ayudante) || readString(fb.corAyudante),
    supervisor: readString(o.supervisor) || readString(fb.corSupervisor),
    kgIngresados: readNumberString(o.kgIngresados) || readNumberString(fb.kgIngresadosCorte),
    kgMerma: readNumberString(o.kgMerma) || readNumberString(fb.kgMermaCorte),
    metraje: readNumberString(o.metraje) || readNumberString(fb.metrajeCorte),
    observaciones: readString(o.observaciones) || readString(fb.corObservaciones),
    entradaBobinasKg,
    paletas: paletas.length > 0 ? paletas : getCorPaletas(fb),
    metrics,
    timer: parseTimer(o.timer),
  }
}

export function parseCorteTurnos(raw: unknown, formFallback?: Record<string, unknown>): CorteTurnoEntry[] {
  if (!Array.isArray(raw)) return []
  const out: CorteTurnoEntry[] = []
  for (const item of raw) {
    const t = normalizeCorteTurno(item, formFallback)
    if (t && t.closed_at) out.push(t)
  }
  return out
}

export function parseCorteTurnoActual(
  raw: unknown,
  formFallback?: Record<string, unknown>,
): CorteTurnoEntry | null {
  if (raw === null || raw === undefined) return null
  const t = normalizeCorteTurno(raw, formFallback)
  if (!t || t.closed_at) return null
  return t
}

/** Turno abierto heredado de claves planas + cor_turno_actual mínimo. */
export function legacyActiveTurnoFromForm(form: Record<string, unknown>): CorteTurnoEntry | null {
  const legacy = readObject(form[COR_LEGACY_ACTUAL_KEY])
  const legacyId = readString(legacy.id)
  const turno = readString(form.corTurno).toLowerCase()
  const grupo = readString(form.corGrupo).toUpperCase()
  const operador = readString(form.corOperador)
  if (!legacyId && !operador && !turno) return null

  return {
    id: legacyId || newCorteTurnoId(),
    started_at: readString(legacy.opened_at) || new Date().toISOString(),
    closed_at: null,
    closed_by: null,
    turno: turno === "diurno" || turno === "nocturno" ? turno : "",
    grupo: grupo === "A" || grupo === "B" || grupo === "C" ? grupo : "",
    operador,
    ayudante: readString(form.corAyudante),
    supervisor: readString(form.corSupervisor),
    kgIngresados: readNumberString(form.kgIngresadosCorte),
    kgMerma: readNumberString(form.kgMermaCorte),
    metraje: readNumberString(form.metrajeCorte),
    observaciones: readString(form.corObservaciones),
    entradaBobinasKg: ensureStringArray(form.corEntradaBobinasKg, COR_ENTRADA_SLOTS),
    paletas: getCorPaletas(form),
    timer: timerFromLegacyFlatForm(form),
  }
}

export function corteTurnoToMirror(t: CorteTurnoEntry): Record<string, unknown> {
  return {
    corTurno: t.turno,
    corGrupo: t.grupo,
    corOperador: t.operador,
    corAyudante: t.ayudante,
    corSupervisor: t.supervisor,
    kgIngresadosCorte: t.kgIngresados,
    kgMermaCorte: t.kgMerma,
    metrajeCorte: t.metraje,
    corObservaciones: t.observaciones,
    corEntradaBobinasKg: t.entradaBobinasKg,
    cor_paletas: t.paletas,
    corSalidaPaletasKg: t.paletas.map((p) => p.rollosKg),
    ...timerToLegacyFlat(t.timer),
  }
}

export function clearCorteMirrorKeys(): Record<string, unknown> {
  return {
    corTurno: "",
    corGrupo: "",
    corOperador: "",
    corAyudante: "",
    corSupervisor: "",
    kgIngresadosCorte: "",
    kgMermaCorte: "",
    metrajeCorte: "",
    corObservaciones: "",
    corEntradaBobinasKg: Array.from({ length: COR_ENTRADA_SLOTS }, () => ""),
    cor_paletas: [
      {
        id: "p-01",
        label: "Paleta #01",
        rollosKg: emptyPaletaRollos(),
        status: "en_progreso",
      },
    ],
    corSalidaPaletasKg: [emptyPaletaRollos()],
    kgSalidaCorte: "0.00",
    ...timerToLegacyFlat(emptyCorteTurnTimer()),
  }
}

export function syncCorteSalidaFields(form: Record<string, unknown>): Record<string, unknown> {
  const salida = sumSalidaKgFromForm(form)
  const salidaStr = salida.toFixed(2)
  return {
    kgSalidaCorte: salidaStr,
    corAcumuladoProducidoKg: salida,
  }
}

/** Sincroniza kg ingresados desde la grilla de bobinas (30 posiciones). */
export function syncCorteEntradaFields(form: Record<string, unknown>): Record<string, unknown> {
  const entrada = sumEntradaKgFromForm(form)
  return {
    kgIngresadosCorte: entrada.toFixed(2),
  }
}

/** Métricas derivadas: entrada (grid) + salida (rollos por paleta). */
export function syncCorteFormMetrics(form: Record<string, unknown>): Record<string, unknown> {
  const withEntrada = { ...form, ...syncCorteEntradaFields(form) }
  return { ...withEntrada, ...syncCorteSalidaFields(withEntrada) }
}

export function bootstrapCorteFormState(mergedForm: Record<string, unknown>): Record<string, unknown> {
  let actual =
    parseCorteTurnoActual(mergedForm[COR_ACTUAL_KEY], mergedForm) ??
    legacyActiveTurnoFromForm(mergedForm)
  const turnos = parseCorteTurnos(mergedForm[COR_TURNOS_KEY], mergedForm)

  let next: Record<string, unknown> = {
    ...mergedForm,
    ...syncCorteFormMetrics(mergedForm),
    [COR_TURNOS_KEY]: turnos,
    [COR_ACTUAL_KEY]: actual,
  }

  if (actual) {
    next = { ...next, ...corteTurnoToMirror(actual) }
  } else if (!readString(mergedForm.corTurno) && !readString(mergedForm.corOperador)) {
    next = { ...next, ...clearCorteMirrorKeys(), [COR_ACTUAL_KEY]: null }
  }

  return next
}

export type JsonAccumulatedCorte = {
  producidoKg: number
  turnosCerrados: number
  turnosRegistrados: number
  ultimoCierreLabel: string
}

export function accumulateCorteFromJson(
  cerrados: CorteTurnoEntry[],
  actual: CorteTurnoEntry | null,
  formSalidaActual?: number,
): JsonAccumulatedCorte {
  let producidoKg = 0
  for (const t of cerrados) producidoKg += sumSalidaKgFromClosedTurno(t)
  if (actual) {
    producidoKg += formSalidaActual ?? sumSalidaKgFromPaletas(actual.paletas)
  }

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

export const COR_PAUSE_REASONS = [
  "Cambio de cuchillas",
  "Ajuste de corte",
  "Falla mecánica",
  "Falla eléctrica",
  "Problema de calidad",
  "Cambio de pedido",
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

export function finalizeTurnTimerNow(timer: CorteTurnTimer): CorteTurnTimer {
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

export function createNewCorteTurno(params: {
  turno: "diurno" | "nocturno"
  grupo: "A" | "B" | "C"
  operador: string
  ayudante: string
  supervisor: string
}): CorteTurnoEntry {
  const now = new Date().toISOString()
  return {
    id: newCorteTurnoId(),
    started_at: now,
    closed_at: null,
    closed_by: null,
    turno: params.turno,
    grupo: params.grupo,
    operador: params.operador.trim(),
    ayudante: params.ayudante.trim(),
    supervisor: params.supervisor.trim(),
    kgIngresados: "",
    kgMerma: "",
    metraje: "",
    observaciones: "",
    entradaBobinasKg: Array.from({ length: COR_ENTRADA_SLOTS }, () => ""),
    paletas: [
      {
        id: "p-01",
        label: "Paleta #01",
        rollosKg: emptyPaletaRollos(),
        status: "en_progreso",
      },
    ],
    timer: emptyCorteTurnTimer(),
  }
}

export function snapshotCorteTurnMetrics(form: Record<string, unknown>): CorteTurnMetrics {
  const paletas = getCorPaletas(form)
  const salida = sumSalidaKgFromPaletas(paletas)
  const scrapR = readNumber(form.corScrapRefileKg)
  const scrapI = readNumber(form.corScrapImpresoKg)
  const scrapM = readNumber(form.corScrapMalCorteKg)
  const rollos = paletas
    .flatMap((p) => p.rollosKg)
    .filter((v) => readNumber(v) > 0).length
  return {
    entrada_bobinas_kg: sumEntradaKgFromForm(form).toFixed(3),
    salida_total_kg: salida.toFixed(3),
    merma_kg: readNumber(form.kgMermaCorte).toFixed(3),
    metraje: readNumber(form.metrajeCorte).toFixed(3),
    scrap_total_kg: (scrapR + scrapI + scrapM).toFixed(3),
    scrap_refile_kg: scrapR.toFixed(3),
    scrap_impreso_kg: scrapI.toFixed(3),
    scrap_mal_corte_kg: scrapM.toFixed(3),
    rollos_salida: rollos,
    paletas: paletas.length,
  }
}
