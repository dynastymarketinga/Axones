/**
 * Estado operativo de laminación (espejo plano en JSON de orden-trabajo).
 * Misma idea que printing-turnos.ts: claves lam* estables para API y planilla.
 */
import {
  emptyMesPhaseTimerFields,
  finalizeMesPhaseSlotsOnTimer,
  mesPhaseFieldsFromLegacyForm,
  mesPhaseFieldsToLegacyFlat,
  parseMesPhaseFieldsFromRecord,
  type MesPhaseTimerFields,
} from "@/lib/mes-phase-timer-fields"

export { cumulativeDemountSeconds } from "@/lib/mes-phase-timer-fields"

import {
  emptyBobinaLabelMeta,
  emptyMetaSeries,
  emptyNumericSeries,
  type BobinaLabelMeta,
} from "./printing-turnos"

export type { BobinaLabelMeta }
export { emptyBobinaLabelMeta }

export const LAM_BOBINAS_SLOTS = 30
/** Historial legacy (migración a {@link LAM_TURNOS_KEY}). */
export const LAM_TURNOS_HISTORIAL_KEY = "lamTurnosHistorial"
export const LAM_TURNOS_KEY = "lamTurnosLaminacion"
export const LAM_ACTUAL_KEY = "lamTurnoActual"
export const LAM_ESTADO_KEY = "lamEstadoArea"

export type LaminacionEstadoArea = "abierta" | "finalizada"

export type LamLabelEditorMode = "impresa" | "virgen" | "salida"

export type LaminacionPauseEntry = {
  at: string
  reason: string
  obs: string
  duration_sec: number
}

export type LamArchivedTurnEntry = {
  id: string
  closed_at: string
  outcome: "turno_cerrado" | "orden_finalizada"
  turno: string
  grupo: string
  operador: string
  ayudante: string
  supervisor: string
  effective_sec: number
  dead_sec: number
  total_salida_kg: number
  pauses: LaminacionPauseEntry[]
}

export type LaminacionTurnTimerState =
  | "pending"
  | "running"
  | "paused"
  | "stopped"
  | "completed"

export type LaminacionTurnTimer = {
  state: LaminacionTurnTimerState
  startedAtMs: number
  lastResumeAtMs: number
  pauseAtMs: number
  effectiveAccSec: number
  deadAccSec: number
  pauses: LaminacionPauseEntry[]
} & MesPhaseTimerFields

export type LaminacionTurnoEntry = {
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
  entradaImpresaBobinasKg: string[]
  entradaImpresaBobinasMeta: BobinaLabelMeta[]
  entradaVirgenBobinasKg: string[]
  entradaVirgenBobinasMeta: BobinaLabelMeta[]
  entradaVirgenRechazadasKg: string
  entradaVirgenMaterialesBuenosKg: string
  salidaBobinasKg: string[]
  salidaBobinasMeta: BobinaLabelMeta[]
  metrajeProduccion: string
  adhesivoEntradaKg: string
  adhesivoSobroKg: string
  catalizadorEntradaKg: string
  catalizadorSobroKg: string
  acetatoEntradaLt: string
  acetatoSobroLt: string
  scrapTransparenteKg: string
  scrapImpresoKg: string
  scrapLaminadoKg: string
  observaciones: string
  timer: LaminacionTurnTimer
}

export const LAM_PAUSE_REASONS: string[] = [
  "Cambio de bobina",
  "Ajuste de máquina",
  "Falla mecánica",
  "Falla eléctrica",
  "Problema de calidad",
  "Falta de material",
  "Preparación de adhesivo",
  "Almuerzo/Descanso",
  "Otro",
]

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v
  return ""
}

export function readLamNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function toFiniteOrNull(v: unknown): number | null {
  const raw = readNumberString(v).trim().replace(",", ".")
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function normalizeNumericString(v: unknown): string {
  const n = toFiniteOrNull(v)
  if (n === null) return ""
  return String(n)
}

export function normalizeBobinaLabelMeta(meta: BobinaLabelMeta): BobinaLabelMeta {
  return {
    fecha: readString(meta.fecha).trim(),
    hora: readString(meta.hora).trim(),
    referencia: readString(meta.referencia).trim(),
    lote: readString(meta.lote).trim(),
    proveedor: readString(meta.proveedor).trim(),
    operador: readString(meta.operador).trim(),
    metraje: readString(meta.metraje).trim(),
    peso: readString(meta.peso).trim(),
    medida_ancho: readString(meta.medida_ancho).trim(),
    tratamiento_interno: readString(meta.tratamiento_interno).trim(),
    tratamiento_externo: readString(meta.tratamiento_externo).trim(),
    maquina_origen: readString(meta.maquina_origen).trim(),
    pedido_lote: readString(meta.pedido_lote).trim(),
    empalmes: readString(meta.empalmes).trim(),
  }
}

export function formatTimerHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, "0")
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export function getNumericSeries(form: Record<string, unknown>, key: string, size: number): string[] {
  const raw = form[key]
  if (!Array.isArray(raw)) return Array.from({ length: size }, () => "")
  const out = raw.slice(0, size).map((v) => readNumberString(v))
  while (out.length < size) out.push("")
  return out
}

export function getMetaSeries(form: Record<string, unknown>, key: string, size: number): BobinaLabelMeta[] {
  const raw = form[key]
  const out: BobinaLabelMeta[] = []
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, size)) {
      if (item && typeof item === "object") {
        out.push(
          normalizeBobinaLabelMeta({
            ...emptyBobinaLabelMeta(),
            ...(item as Record<string, unknown>),
          } as BobinaLabelMeta),
        )
      } else {
        out.push(emptyBobinaLabelMeta())
      }
    }
  }
  while (out.length < size) out.push(emptyBobinaLabelMeta())
  return out
}

function parsePauseEntries(raw: unknown): LaminacionPauseEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => x as Partial<LaminacionPauseEntry>)
    .map((x) => ({
      at: readString(x.at),
      reason: readString(x.reason),
      obs: readString(x.obs),
      duration_sec: readLamNumber(x.duration_sec),
    }))
    .filter((x) => x.reason !== "")
}

export function timerFromLegacyFlatForm(form: Record<string, unknown>): LaminacionTurnTimer {
  const state = (readString(form.lamTimerState) || "pending") as LaminacionTurnTimerState
  const valid: LaminacionTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
  return {
    state: valid.includes(state) ? state : "pending",
    startedAtMs: readLamNumber(form.lamTimerStartedAtMs),
    lastResumeAtMs: readLamNumber(form.lamTimerLastResumeAtMs),
    pauseAtMs: readLamNumber(form.lamTimerPauseAtMs),
    effectiveAccSec: readLamNumber(form.lamTimerEffectiveAccSec),
    deadAccSec: readLamNumber(form.lamTimerDeadAccSec),
    pauses: parsePauseEntries(form.lamTimerPauses),
    ...mesPhaseFieldsFromLegacyForm(form, "lamTimer"),
  }
}

export function timerToLegacyFlat(timer: LaminacionTurnTimer): Record<string, unknown> {
  return {
    lamTimerState: timer.state,
    lamTimerStartedAtMs: timer.startedAtMs,
    lamTimerLastResumeAtMs: timer.lastResumeAtMs,
    lamTimerPauseAtMs: timer.pauseAtMs,
    lamTimerEffectiveAccSec: timer.effectiveAccSec,
    lamTimerDeadAccSec: timer.deadAccSec,
    lamTimerPauses: timer.pauses,
    ...mesPhaseFieldsToLegacyFlat(timer, "lamTimer"),
  }
}

export function computeLamLiveTimer(
  form: Record<string, unknown>,
  nowMs = Date.now(),
): { effectiveSec: number; deadSec: number; totalSec: number } {
  const timer = timerFromLegacyFlatForm(form)
  let effectiveSec = timer.effectiveAccSec
  let deadSec = timer.deadAccSec
  if (timer.state === "running" && timer.lastResumeAtMs > 0) {
    effectiveSec += (nowMs - timer.lastResumeAtMs) / 1000
  }
  if (timer.state === "paused" && timer.pauseAtMs > 0) {
    deadSec += (nowMs - timer.pauseAtMs) / 1000
  }
  return { effectiveSec, deadSec, totalSec: effectiveSec + deadSec }
}

export function sumSeriesKg(values: string[]): number {
  return values.reduce((acc, v) => acc + readLamNumber(v), 0)
}

export function snapshotSalidaKgFromForm(prev: Record<string, unknown>): number {
  return sumSeriesKg(getNumericSeries(prev, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS))
}

export function parseLamTurnosHistorial(form: Record<string, unknown>): LamArchivedTurnEntry[] {
  const raw = form[LAM_TURNOS_HISTORIAL_KEY]
  if (!Array.isArray(raw)) return []
  const out: LamArchivedTurnEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    out.push({
      id: readString(o.id) || `lam_${out.length}`,
      closed_at: readString(o.closed_at),
      outcome: o.outcome === "orden_finalizada" ? "orden_finalizada" : "turno_cerrado",
      turno: readString(o.turno),
      grupo: readString(o.grupo),
      operador: readString(o.operador),
      ayudante: readString(o.ayudante),
      supervisor: readString(o.supervisor),
      effective_sec: readLamNumber(o.effective_sec),
      dead_sec: readLamNumber(o.dead_sec),
      total_salida_kg: readLamNumber(o.total_salida_kg),
      pauses: parsePauseEntries(o.pauses),
    })
  }
  return out
}

export function lamUltimoTurnoLabel(timerState: string): string {
  if (timerState === "completed") return "Turno finalizado"
  if (timerState === "stopped") return "Turno cerrado"
  if (timerState === "running") return "Turno en ejecución"
  return "Sin producción previa"
}

export function computeLamMermaRefil(params: {
  totalEntradaImpresa: number
  totalEntradaVirgen: number
  adhesivoConsumido: number
  totalSalida: number
  totalScrap: number
}): { mermaCalc: number; refilPct: number } {
  const mermaCalc =
    params.totalEntradaImpresa +
    params.totalEntradaVirgen +
    params.adhesivoConsumido -
    params.totalSalida -
    params.totalScrap
  const refilPct = params.totalSalida > 0 ? (params.totalScrap / params.totalSalida) * 100 : 0
  return { mermaCalc, refilPct }
}

export function validateBobinaLabelSave(meta: BobinaLabelMeta): string | null {
  const normalized = normalizeBobinaLabelMeta(meta)
  const hasAnyValue = Object.values(normalized).some((v) => v !== "")
  const fechaPattern = /^\d{2}\/\d{2}\/\d{4}$/
  if (hasAnyValue && !fechaPattern.test(normalized.fecha)) {
    return "Fecha obligatoria con formato dd/mm/aaaa."
  }
  return null
}

export function metaKeyForLabelMode(mode: LamLabelEditorMode): string {
  if (mode === "impresa") return "lamEntradaImpresaBobinasMeta"
  if (mode === "virgen") return "lamEntradaVirgenBobinasMeta"
  return "lamSalidaBobinasMeta"
}

export function lamStartTimerPatch(prev: Record<string, unknown>): Record<string, unknown> {
  const now = Date.now()
  const timer = timerFromLegacyFlatForm(prev)
  return {
    ...prev,
    ...timerToLegacyFlat({
      ...timer,
      state: "running",
      startedAtMs: timer.startedAtMs || now,
      lastResumeAtMs: now,
      pauseAtMs: 0,
    }),
  }
}

export function lamPauseTimerPatch(prev: Record<string, unknown>): Record<string, unknown> {
  const timer = timerFromLegacyFlatForm(prev)
  if (timer.state !== "running") return prev
  const now = Date.now()
  const effectiveAccSec =
    timer.effectiveAccSec +
    (timer.lastResumeAtMs > 0 ? (now - timer.lastResumeAtMs) / 1000 : 0)
  return {
    ...prev,
    ...timerToLegacyFlat({
      ...timer,
      state: "paused",
      effectiveAccSec,
      pauseAtMs: now,
      lastResumeAtMs: 0,
    }),
  }
}

export function lamConfirmPausePatch(
  prev: Record<string, unknown>,
  pauseReason: string,
  pauseObs: string,
): Record<string, unknown> {
  const timer = timerFromLegacyFlatForm(prev)
  if (timer.state !== "paused") return prev
  const now = Date.now()
  const pauseDurationSec = timer.pauseAtMs > 0 ? (now - timer.pauseAtMs) / 1000 : 0
  return {
    ...prev,
    ...timerToLegacyFlat({
      ...timer,
      state: "running",
      deadAccSec: timer.deadAccSec + pauseDurationSec,
      pauseAtMs: 0,
      lastResumeAtMs: now,
      pauses: [
        ...timer.pauses,
        {
          at: new Date(now).toISOString(),
          reason: pauseReason,
          obs: pauseObs.trim(),
          duration_sec: pauseDurationSec,
        },
      ],
    }),
  }
}

export function lamStopTimerPatch(
  prev: Record<string, unknown>,
  nextState: "stopped" | "completed",
): Record<string, unknown> {
  const now = Date.now()
  const timer = timerFromLegacyFlatForm(prev)
  let effective = timer.effectiveAccSec
  let dead = timer.deadAccSec
  if (timer.state === "running" && timer.lastResumeAtMs > 0) {
    effective += (now - timer.lastResumeAtMs) / 1000
  }
  if (timer.state === "paused" && timer.pauseAtMs > 0) {
    dead += (now - timer.pauseAtMs) / 1000
  }

  const prevState = timer.state
  const pausesSnapshot = timer.pauses.map((p) => ({ ...p }))
  const shouldArchive =
    effective + dead > 0.01 || pausesSnapshot.length > 0 || prevState !== "pending"

  let historial = parseLamTurnosHistorial(prev)
  if (shouldArchive) {
    historial = [
      ...historial,
      {
        id: `lam_${now}_${historial.length}`,
        closed_at: new Date(now).toISOString(),
        outcome: nextState === "completed" ? "orden_finalizada" : "turno_cerrado",
        turno: readString(prev.lamTurno),
        grupo: readString(prev.lamGrupo),
        operador: readString(prev.lamOperador),
        ayudante: readString(prev.lamAyudante),
        supervisor: readString(prev.lamSupervisor),
        effective_sec: effective,
        dead_sec: dead,
        total_salida_kg: snapshotSalidaKgFromForm(prev),
        pauses: pausesSnapshot,
      },
    ]
  }

  const registros = shouldArchive ? historial.length : Math.max(0, Math.floor(readLamNumber(prev.lamRegistrosTurnos)))

  if (nextState === "stopped") {
    return {
      ...prev,
      [LAM_TURNOS_HISTORIAL_KEY]: historial,
      lamRegistrosTurnos: registros,
      ...timerToLegacyFlat({
        ...emptyLaminacionTurnTimer(),
        state: "pending",
        startedAtMs: 0,
        lastResumeAtMs: 0,
        pauseAtMs: 0,
        effectiveAccSec: 0,
        deadAccSec: 0,
        pauses: [],
      }),
    }
  }

  return {
    ...prev,
    [LAM_TURNOS_HISTORIAL_KEY]: historial,
    lamRegistrosTurnos: registros,
    ...timerToLegacyFlat({
      ...emptyLaminacionTurnTimer(),
      state: "completed",
      startedAtMs: timer.startedAtMs,
      lastResumeAtMs: 0,
      pauseAtMs: 0,
      effectiveAccSec: effective,
      deadAccSec: dead,
      pauses: pausesSnapshot,
    }),
  }
}

export type SustratoLamRow = { material_id: string; kg: string; material_free_text?: string }

const MIN_SUSTRATO_ROWS = 1

function ensureMinSustratoRows(rows: SustratoLamRow[], minRows = MIN_SUSTRATO_ROWS): SustratoLamRow[] {
  const next = [...rows]
  while (next.length < minRows) next.push({ material_id: "", kg: "", material_free_text: "" })
  return next
}

export function getSustratosLamRows(form: Record<string, unknown>): SustratoLamRow[] {
  const raw = form.sustratosVirgenLam
  if (!Array.isArray(raw)) return ensureMinSustratoRows([])
  const out: SustratoLamRow[] = raw.map((r) => {
    const o = r as Record<string, unknown>
    return {
      material_id: readString(o.material_id),
      kg: readNumberString(o.kg),
      material_free_text: readString(o.material_free_text),
    }
  })
  return ensureMinSustratoRows(out)
}

/** Si no hay pesos en la rejilla virgen, copia kg de sustratosVirgenLam a casillas consecutivas. */
export function hydrateVirgenBobinasFromSustratos(form: Record<string, unknown>): Record<string, unknown> {
  const series = getNumericSeries(form, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS)
  const hasAnyBobina = series.some((v) => readLamNumber(v) > 0)
  if (hasAnyBobina) return form

  const rows = getSustratosLamRows(form).filter((r) => readLamNumber(r.kg) > 0)
  if (rows.length === 0) return form

  const next = [...series]
  let slot = 0
  for (const r of rows) {
    if (slot >= LAM_BOBINAS_SLOTS) break
    next[slot] = normalizeNumericString(r.kg)
    slot += 1
  }
  return { ...form, lamEntradaVirgenBobinasKg: next }
}

export function hasLaminacionSavedData(form: Record<string, unknown> | null | undefined): boolean {
  if (!form || typeof form !== "object") return false
  const f = form as Record<string, unknown>
  const singleKeys = [
    "lamTurno",
    "lamGrupo",
    "lamOperador",
    "lamAyudante",
    "lamSupervisor",
    "lamMetrajeProduccion",
    "lamAdhesivoEntradaKg",
    "lamAdhesivoSobroKg",
    "lamCatalizadorEntradaKg",
    "lamCatalizadorSobroKg",
    "lamAcetatoEntradaLt",
    "lamAcetatoSobroLt",
    "lamScrapTransparenteKg",
    "lamScrapImpresoKg",
    "lamScrapLaminadoKg",
    "lamObservaciones",
    "lamTimerState",
    "lamEntradaVirgenRechazadasKg",
    "lamEntradaVirgenMaterialesBuenosKg",
    "lamDevolucionBuenaKg",
    "lamDevolucionRechazadaKg",
    "lamDevolucionRechazadaBobinas",
    "lamDevolucionRechazadaMotivo",
    "lamDevolucionesAlmacenUltimoEnvioMs",
    "lamDevolucionesAlmacenSnapBuena",
    "lamDevolucionesAlmacenSnapRech",
    "lamChecklistEstado",
    "lamChecklistObs",
  ]

  for (const key of singleKeys) {
    const value = f[key]
    if (typeof value === "string" && value.trim() !== "") return true
    if (typeof value === "number" && Number.isFinite(value) && value !== 0) return true
  }

  const seriesKeys = ["lamEntradaImpresaBobinasKg", "lamEntradaVirgenBobinasKg", "lamSalidaBobinasKg"]
  for (const key of seriesKeys) {
    const raw = f[key]
    if (!Array.isArray(raw)) continue
    if (raw.some((v) => readLamNumber(v) > 0)) return true
  }

  const hist = f[LAM_TURNOS_HISTORIAL_KEY]
  if (Array.isArray(hist) && hist.length > 0) return true

  const chk = f.lamChecklistChecked
  if (Array.isArray(chk) && chk.length > 0) return true

  if (parseLaminacionTurnos(f[LAM_TURNOS_KEY]).length > 0) return true
  if (parseLaminacionTurnoActual(f[LAM_ACTUAL_KEY]) !== null) return true

  return false
}

export function normalizeLaminacionFormForSave(
  form: Record<string, unknown>,
  series: {
    entradaImpresaBobinas: string[]
    entradaVirgenBobinas: string[]
    salidaBobinas: string[]
    entradaImpresaBobinasMeta: BobinaLabelMeta[]
    entradaVirgenBobinasMeta: BobinaLabelMeta[]
    salidaBobinasMeta: BobinaLabelMeta[]
  },
): Record<string, unknown> {
  return {
    ...form,
    lamEntradaImpresaBobinasKg: series.entradaImpresaBobinas.map((v) => normalizeNumericString(v)),
    lamEntradaVirgenBobinasKg: series.entradaVirgenBobinas.map((v) => normalizeNumericString(v)),
    lamEntradaVirgenRechazadasKg: normalizeNumericString(form.lamEntradaVirgenRechazadasKg),
    lamEntradaVirgenMaterialesBuenosKg: normalizeNumericString(form.lamEntradaVirgenMaterialesBuenosKg),
    lamSalidaBobinasKg: series.salidaBobinas.map((v) => normalizeNumericString(v)),
    lamEntradaImpresaBobinasMeta: series.entradaImpresaBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
    lamEntradaVirgenBobinasMeta: series.entradaVirgenBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
    lamSalidaBobinasMeta: series.salidaBobinasMeta.map((m) => normalizeBobinaLabelMeta(m)),
  }
}

export function hasMeta(meta: BobinaLabelMeta | undefined): boolean {
  if (!meta) return false
  return Object.values(meta).some((v) => v.trim() !== "")
}

export function labelTooltipText(meta: BobinaLabelMeta | undefined): string {
  if (!meta || !hasMeta(meta)) return "Sin etiqueta registrada"
  const fecha = meta.fecha.trim() || "Sin fecha"
  const referencia = meta.referencia.trim() || "Sin referencia"
  return `Fecha: ${fecha} · Ref: ${referencia}`
}

export function lamLabelEditorTitle(mode: LamLabelEditorMode, idx: number): string {
  const n = idx + 1
  if (mode === "impresa") return `Etiqueta bobina impresa (entrada laminación) #${n}`
  if (mode === "virgen") return `Etiqueta bobina virgen (laminación) #${n}`
  return `Etiqueta bobina salida laminada #${n}`
}

export function newLaminacionTurnoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `lam-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function emptyLaminacionTurnTimer(): LaminacionTurnTimer {
  return {
    state: "pending",
    startedAtMs: 0,
    lastResumeAtMs: 0,
    pauseAtMs: 0,
    effectiveAccSec: 0,
    deadAccSec: 0,
    pauses: [],
    ...emptyMesPhaseTimerFields(),
  }
}

export function createNewLaminacionTurno(params: {
  turno: "diurno" | "nocturno"
  grupo: "A" | "B" | "C"
  operador: string
  controlOwner?: { id: number; name: string } | null
}): LaminacionTurnoEntry {
  const now = new Date().toISOString()
  return {
    id: newLaminacionTurnoId(),
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
    entradaImpresaBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    entradaImpresaBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    entradaVirgenRechazadasKg: "",
    entradaVirgenMaterialesBuenosKg: "",
    salidaBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    salidaBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    metrajeProduccion: "",
    adhesivoEntradaKg: "",
    adhesivoSobroKg: "",
    catalizadorEntradaKg: "",
    catalizadorSobroKg: "",
    acetatoEntradaLt: "",
    acetatoSobroLt: "",
    scrapTransparenteKg: "0",
    scrapImpresoKg: "0",
    scrapLaminadoKg: "0",
    observaciones: "",
    timer: emptyLaminacionTurnTimer(),
  }
}

function parseTimerNested(raw: unknown): LaminacionTurnTimer {
  if (!raw || typeof raw !== "object") return emptyLaminacionTurnTimer()
  const o = raw as Record<string, unknown>
  const state = readString(o.state) as LaminacionTurnTimerState
  const valid: LaminacionTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
  return {
    state: valid.includes(state) ? state : "pending",
    startedAtMs: readLamNumber(o.startedAtMs),
    lastResumeAtMs: readLamNumber(o.lastResumeAtMs),
    pauseAtMs: readLamNumber(o.pauseAtMs),
    effectiveAccSec: readLamNumber(o.effectiveAccSec),
    deadAccSec: readLamNumber(o.deadAccSec),
    pauses: parsePauseEntries(o.pauses),
    ...parseMesPhaseFieldsFromRecord(o),
  }
}

function padStringArray(raw: unknown, size: number): string[] {
  if (!Array.isArray(raw)) return emptyNumericSeries(size)
  const out = raw.slice(0, size).map((v) => readNumberString(v))
  while (out.length < size) out.push("")
  return out
}

function padMetaArray(raw: unknown, size: number): BobinaLabelMeta[] {
  if (!Array.isArray(raw)) return emptyMetaSeries(size)
  const out: BobinaLabelMeta[] = []
  for (const item of raw.slice(0, size)) {
    if (item && typeof item === "object") {
      out.push(
        normalizeBobinaLabelMeta({
          ...emptyBobinaLabelMeta(),
          ...(item as Record<string, unknown>),
        } as BobinaLabelMeta),
      )
    } else {
      out.push(emptyBobinaLabelMeta())
    }
  }
  while (out.length < size) out.push(emptyBobinaLabelMeta())
  return out
}

export function normalizeLaminacionTurno(raw: unknown): LaminacionTurnoEntry | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = readString(o.id)
  if (!id) return null
  const turnoRaw = readString(o.turno).toLowerCase()
  const grupoRaw = readString(o.grupo).toUpperCase()
  const turno: LaminacionTurnoEntry["turno"] =
    turnoRaw === "diurno" || turnoRaw === "nocturno" ? (turnoRaw as "diurno" | "nocturno") : ""
  const grupo: LaminacionTurnoEntry["grupo"] =
    grupoRaw === "A" || grupoRaw === "B" || grupoRaw === "C" ? (grupoRaw as "A" | "B" | "C") : ""

  let closedBy: LaminacionTurnoEntry["closed_by"] = null
  const cb = o.closed_by
  if (cb && typeof cb === "object") {
    const c = cb as Record<string, unknown>
    const cid = readLamNumber(c.id)
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
        : readLamNumber(o.control_owner_user_id),
    control_owner_name: readString(o.control_owner_name) || null,
    control_taken_at: readString(o.control_taken_at) || null,
    turno,
    grupo,
    operador: readString(o.operador),
    ayudante: readString(o.ayudante),
    supervisor: readString(o.supervisor),
    entradaImpresaBobinasKg: padStringArray(o.entradaImpresaBobinasKg, LAM_BOBINAS_SLOTS),
    entradaImpresaBobinasMeta: padMetaArray(o.entradaImpresaBobinasMeta, LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasKg: padStringArray(o.entradaVirgenBobinasKg, LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasMeta: padMetaArray(o.entradaVirgenBobinasMeta, LAM_BOBINAS_SLOTS),
    entradaVirgenRechazadasKg: readNumberString(o.entradaVirgenRechazadasKg),
    entradaVirgenMaterialesBuenosKg: readNumberString(o.entradaVirgenMaterialesBuenosKg),
    salidaBobinasKg: padStringArray(o.salidaBobinasKg, LAM_BOBINAS_SLOTS),
    salidaBobinasMeta: padMetaArray(o.salidaBobinasMeta, LAM_BOBINAS_SLOTS),
    metrajeProduccion: readNumberString(o.metrajeProduccion),
    adhesivoEntradaKg: readNumberString(o.adhesivoEntradaKg),
    adhesivoSobroKg: readNumberString(o.adhesivoSobroKg),
    catalizadorEntradaKg: readNumberString(o.catalizadorEntradaKg),
    catalizadorSobroKg: readNumberString(o.catalizadorSobroKg),
    acetatoEntradaLt: readNumberString(o.acetatoEntradaLt),
    acetatoSobroLt: readNumberString(o.acetatoSobroLt),
    scrapTransparenteKg: readNumberString(o.scrapTransparenteKg),
    scrapImpresoKg: readNumberString(o.scrapImpresoKg),
    scrapLaminadoKg: readNumberString(o.scrapLaminadoKg),
    observaciones: readString(o.observaciones),
    timer: parseTimerNested(o.timer),
  }
}

export function parseLaminacionTurnos(raw: unknown): LaminacionTurnoEntry[] {
  if (!Array.isArray(raw)) return []
  const out: LaminacionTurnoEntry[] = []
  for (const item of raw) {
    const t = normalizeLaminacionTurno(item)
    if (t) out.push(t)
  }
  return out
}

export function parseLaminacionTurnoActual(raw: unknown): LaminacionTurnoEntry | null {
  if (raw === null || raw === undefined) return null
  return normalizeLaminacionTurno(raw)
}

export function readLaminacionEstadoArea(raw: unknown): LaminacionEstadoArea {
  const s = readString(raw).toLowerCase().trim()
  if (s === "finalizada") return "finalizada"
  return "abierta"
}

function mergeKgSlotSeries(turnoSlots: string[], mirrorSlots: string[]): string[] {
  return turnoSlots.map((v, i) => {
    const best = Math.max(readLamNumber(v), readLamNumber(mirrorSlots[i]))
    return best > 0.005 ? readNumberString(best) : ""
  })
}

/** Alinea turno actual con el espejo plano lam* antes de cierre (evita kg perdidos). */
export function syncLaminacionTurnoFromFormMirror(
  form: Record<string, unknown>,
  turno: LaminacionTurnoEntry,
): LaminacionTurnoEntry {
  const mirrorImpresa = getNumericSeries(form, "lamEntradaImpresaBobinasKg", LAM_BOBINAS_SLOTS)
  const mirrorVirgen = getNumericSeries(form, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS)
  const mirrorSalida = getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS)
  const mirrorImpresaMeta = getMetaSeries(form, "lamEntradaImpresaBobinasMeta", LAM_BOBINAS_SLOTS)
  const mirrorVirgenMeta = getMetaSeries(form, "lamEntradaVirgenBobinasMeta", LAM_BOBINAS_SLOTS)
  const mirrorSalidaMeta = getMetaSeries(form, "lamSalidaBobinasMeta", LAM_BOBINAS_SLOTS)
  const scrapT =
    readLamNumber(turno.scrapTransparenteKg) > 0
      ? turno.scrapTransparenteKg
      : readNumberString(form.lamScrapTransparenteKg)
  const scrapI =
    readLamNumber(turno.scrapImpresoKg) > 0 ? turno.scrapImpresoKg : readNumberString(form.lamScrapImpresoKg)
  const scrapL =
    readLamNumber(turno.scrapLaminadoKg) > 0 ? turno.scrapLaminadoKg : readNumberString(form.lamScrapLaminadoKg)

  return {
    ...turno,
    entradaImpresaBobinasKg: mergeKgSlotSeries(turno.entradaImpresaBobinasKg, mirrorImpresa),
    entradaVirgenBobinasKg: mergeKgSlotSeries(turno.entradaVirgenBobinasKg, mirrorVirgen),
    salidaBobinasKg: mergeKgSlotSeries(turno.salidaBobinasKg, mirrorSalida),
    entradaImpresaBobinasMeta: turno.entradaImpresaBobinasMeta.map((m, i) => {
      const mirror = mirrorImpresaMeta[i] ?? emptyBobinaLabelMeta()
      return readLamNumber(m.peso) > 0 || Object.values(m).some((v) => readString(v).trim() !== "")
        ? m
        : mirror
    }),
    entradaVirgenBobinasMeta: turno.entradaVirgenBobinasMeta.map((m, i) => {
      const mirror = mirrorVirgenMeta[i] ?? emptyBobinaLabelMeta()
      return readLamNumber(m.peso) > 0 || Object.values(m).some((v) => readString(v).trim() !== "")
        ? m
        : mirror
    }),
    salidaBobinasMeta: turno.salidaBobinasMeta.map((m, i) => {
      const mirror = mirrorSalidaMeta[i] ?? emptyBobinaLabelMeta()
      return readLamNumber(m.peso) > 0 || Object.values(m).some((v) => readString(v).trim() !== "")
        ? m
        : mirror
    }),
    metrajeProduccion:
      readLamNumber(turno.metrajeProduccion) > 0
        ? turno.metrajeProduccion
        : readNumberString(form.lamMetrajeProduccion),
    adhesivoEntradaKg:
      readLamNumber(turno.adhesivoEntradaKg) > 0
        ? turno.adhesivoEntradaKg
        : readNumberString(form.lamAdhesivoEntradaKg),
    adhesivoSobroKg:
      readLamNumber(turno.adhesivoSobroKg) > 0
        ? turno.adhesivoSobroKg
        : readNumberString(form.lamAdhesivoSobroKg),
    catalizadorEntradaKg:
      readLamNumber(turno.catalizadorEntradaKg) > 0
        ? turno.catalizadorEntradaKg
        : readNumberString(form.lamCatalizadorEntradaKg),
    catalizadorSobroKg:
      readLamNumber(turno.catalizadorSobroKg) > 0
        ? turno.catalizadorSobroKg
        : readNumberString(form.lamCatalizadorSobroKg),
    acetatoEntradaLt:
      readLamNumber(turno.acetatoEntradaLt) > 0
        ? turno.acetatoEntradaLt
        : readNumberString(form.lamAcetatoEntradaLt),
    acetatoSobroLt:
      readLamNumber(turno.acetatoSobroLt) > 0 ? turno.acetatoSobroLt : readNumberString(form.lamAcetatoSobroLt),
    entradaVirgenRechazadasKg:
      readLamNumber(turno.entradaVirgenRechazadasKg) > 0
        ? turno.entradaVirgenRechazadasKg
        : readNumberString(form.lamEntradaVirgenRechazadasKg),
    entradaVirgenMaterialesBuenosKg:
      readLamNumber(turno.entradaVirgenMaterialesBuenosKg) > 0
        ? turno.entradaVirgenMaterialesBuenosKg
        : readNumberString(form.lamEntradaVirgenMaterialesBuenosKg),
    scrapTransparenteKg: scrapT || "0",
    scrapImpresoKg: scrapI || "0",
    scrapLaminadoKg: scrapL || "0",
    observaciones: readString(turno.observaciones).trim()
      ? turno.observaciones
      : readString(form.lamObservaciones),
  }
}

export function laminacionTurnoToMirror(t: LaminacionTurnoEntry): Record<string, unknown> {
  return {
    lamTurno: t.turno,
    lamGrupo: t.grupo,
    lamOperador: t.operador,
    lamAyudante: t.ayudante,
    lamSupervisor: t.supervisor,
    lamEntradaImpresaBobinasKg: t.entradaImpresaBobinasKg,
    lamEntradaImpresaBobinasMeta: t.entradaImpresaBobinasMeta,
    lamEntradaVirgenBobinasKg: t.entradaVirgenBobinasKg,
    lamEntradaVirgenBobinasMeta: t.entradaVirgenBobinasMeta,
    lamEntradaVirgenRechazadasKg: t.entradaVirgenRechazadasKg,
    lamEntradaVirgenMaterialesBuenosKg: t.entradaVirgenMaterialesBuenosKg,
    lamSalidaBobinasKg: t.salidaBobinasKg,
    lamSalidaBobinasMeta: t.salidaBobinasMeta,
    lamMetrajeProduccion: t.metrajeProduccion,
    lamAdhesivoEntradaKg: t.adhesivoEntradaKg,
    lamAdhesivoSobroKg: t.adhesivoSobroKg,
    lamCatalizadorEntradaKg: t.catalizadorEntradaKg,
    lamCatalizadorSobroKg: t.catalizadorSobroKg,
    lamAcetatoEntradaLt: t.acetatoEntradaLt,
    lamAcetatoSobroLt: t.acetatoSobroLt,
    lamScrapTransparenteKg: t.scrapTransparenteKg,
    lamScrapImpresoKg: t.scrapImpresoKg,
    lamScrapLaminadoKg: t.scrapLaminadoKg,
    lamObservaciones: t.observaciones,
    ...timerToLegacyFlat(t.timer),
  }
}

export function clearLaminacionMirrorKeys(): Record<string, unknown> {
  return {
    lamTurno: "",
    lamGrupo: "",
    lamOperador: "",
    lamAyudante: "",
    lamSupervisor: "",
    lamEntradaImpresaBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    lamEntradaImpresaBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    lamEntradaVirgenBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    lamEntradaVirgenBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    lamEntradaVirgenRechazadasKg: "",
    lamEntradaVirgenMaterialesBuenosKg: "",
    lamSalidaBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    lamSalidaBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    lamMetrajeProduccion: "",
    lamAdhesivoEntradaKg: "",
    lamAdhesivoSobroKg: "",
    lamCatalizadorEntradaKg: "",
    lamCatalizadorSobroKg: "",
    lamAcetatoEntradaLt: "",
    lamAcetatoSobroLt: "",
    lamScrapTransparenteKg: "0",
    lamScrapImpresoKg: "0",
    lamScrapLaminadoKg: "0",
    lamObservaciones: "",
    lamAcumuladoProducidoKg: "",
    lamRegistrosTurnos: "",
    ...timerToLegacyFlat(emptyLaminacionTurnTimer()),
  }
}

export function sumSalidaKgTurno(t: LaminacionTurnoEntry): number {
  return sumSeriesKg(t.salidaBobinasKg)
}

export function sumEntradaImpresaKgTurno(t: LaminacionTurnoEntry): number {
  return sumSeriesKg(t.entradaImpresaBobinasKg)
}

export function sumEntradaVirgenKgTurno(t: LaminacionTurnoEntry): number {
  return sumSeriesKg(t.entradaVirgenBobinasKg)
}

export function sumScrapKgTurno(t: LaminacionTurnoEntry): number {
  return (
    readLamNumber(t.scrapTransparenteKg) +
    readLamNumber(t.scrapImpresoKg) +
    readLamNumber(t.scrapLaminadoKg)
  )
}

export function hasLegacyLaminacionMirror(form: Record<string, unknown>): boolean {
  const hasStructured =
    parseLaminacionTurnos(form[LAM_TURNOS_KEY]).length > 0 ||
    parseLaminacionTurnoActual(form[LAM_ACTUAL_KEY]) !== null
  if (hasStructured) return false

  const ts = readString(form.lamTimerState).toLowerCase()
  if (ts && ts !== "pending") return true
  if (readString(form.lamOperador).trim()) return true

  const imp = getNumericSeries(form, "lamEntradaImpresaBobinasKg", LAM_BOBINAS_SLOTS)
  const vir = getNumericSeries(form, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS)
  const sal = getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS)
  if (imp.some((x) => readLamNumber(x) > 0) || vir.some((x) => readLamNumber(x) > 0) || sal.some((x) => readLamNumber(x) > 0)) {
    return true
  }

  if (parseLamTurnosHistorial(form).length > 0) return true

  return false
}

export function legacyClosedTurnoFromMirror(form: Record<string, unknown>): LaminacionTurnoEntry {
  const now = new Date().toISOString()
  const timer = timerFromLegacyFlatForm(form)
  return {
    id: newLaminacionTurnoId(),
    started_at: readLamNumber(form.lamTimerStartedAtMs)
      ? new Date(readLamNumber(form.lamTimerStartedAtMs)).toISOString()
      : now,
    closed_at: now,
    closed_by: null,
    turno: readString(form.lamTurno) === "nocturno" ? "nocturno" : readString(form.lamTurno) === "diurno" ? "diurno" : "",
    grupo: ((): LaminacionTurnoEntry["grupo"] => {
      const g = readString(form.lamGrupo).toUpperCase()
      return g === "A" || g === "B" || g === "C" ? g : ""
    })(),
    operador: readString(form.lamOperador),
    ayudante: readString(form.lamAyudante),
    supervisor: readString(form.lamSupervisor),
    entradaImpresaBobinasKg: getNumericSeries(form, "lamEntradaImpresaBobinasKg", LAM_BOBINAS_SLOTS),
    entradaImpresaBobinasMeta: getMetaSeries(form, "lamEntradaImpresaBobinasMeta", LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasKg: getNumericSeries(form, "lamEntradaVirgenBobinasKg", LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasMeta: getMetaSeries(form, "lamEntradaVirgenBobinasMeta", LAM_BOBINAS_SLOTS),
    entradaVirgenRechazadasKg: readNumberString(form.lamEntradaVirgenRechazadasKg),
    entradaVirgenMaterialesBuenosKg: readNumberString(form.lamEntradaVirgenMaterialesBuenosKg),
    salidaBobinasKg: getNumericSeries(form, "lamSalidaBobinasKg", LAM_BOBINAS_SLOTS),
    salidaBobinasMeta: getMetaSeries(form, "lamSalidaBobinasMeta", LAM_BOBINAS_SLOTS),
    metrajeProduccion: readNumberString(form.lamMetrajeProduccion),
    adhesivoEntradaKg: readNumberString(form.lamAdhesivoEntradaKg),
    adhesivoSobroKg: readNumberString(form.lamAdhesivoSobroKg),
    catalizadorEntradaKg: readNumberString(form.lamCatalizadorEntradaKg),
    catalizadorSobroKg: readNumberString(form.lamCatalizadorSobroKg),
    acetatoEntradaLt: readNumberString(form.lamAcetatoEntradaLt),
    acetatoSobroLt: readNumberString(form.lamAcetatoSobroLt),
    scrapTransparenteKg: readNumberString(form.lamScrapTransparenteKg),
    scrapImpresoKg: readNumberString(form.lamScrapImpresoKg),
    scrapLaminadoKg: readNumberString(form.lamScrapLaminadoKg),
    observaciones: readString(form.lamObservaciones),
    timer,
  }
}

function historialToClosedTurnos(hist: LamArchivedTurnEntry[]): LaminacionTurnoEntry[] {
  return hist.map((h) => ({
    id: h.id || newLaminacionTurnoId(),
    started_at: h.closed_at || new Date().toISOString(),
    closed_at: h.closed_at || new Date().toISOString(),
    closed_by: null,
    turno: h.turno === "nocturno" ? "nocturno" : h.turno === "diurno" ? "diurno" : "",
    grupo: ((): LaminacionTurnoEntry["grupo"] => {
      const g = h.grupo.toUpperCase()
      return g === "A" || g === "B" || g === "C" ? g : ""
    })(),
    operador: h.operador,
    ayudante: h.ayudante,
    supervisor: h.supervisor,
    entradaImpresaBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    entradaImpresaBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    entradaVirgenBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    entradaVirgenRechazadasKg: "",
    entradaVirgenMaterialesBuenosKg: "",
    salidaBobinasKg: emptyNumericSeries(LAM_BOBINAS_SLOTS),
    salidaBobinasMeta: emptyMetaSeries(LAM_BOBINAS_SLOTS),
    metrajeProduccion: "",
    adhesivoEntradaKg: "",
    adhesivoSobroKg: "",
    catalizadorEntradaKg: "",
    catalizadorSobroKg: "",
    acetatoEntradaLt: "",
    acetatoSobroLt: "",
    scrapTransparenteKg: "0",
    scrapImpresoKg: "0",
    scrapLaminadoKg: "0",
    observaciones: "",
    timer: {
      ...emptyLaminacionTurnTimer(),
      state: "stopped",
      effectiveAccSec: h.effective_sec,
      deadAccSec: h.dead_sec,
      pauses: h.pauses,
    },
  }))
}

export function bootstrapLaminacionFormState(mergedForm: Record<string, unknown>): Record<string, unknown> {
  let turnos = parseLaminacionTurnos(mergedForm[LAM_TURNOS_KEY])
  const actual = parseLaminacionTurnoActual(mergedForm[LAM_ACTUAL_KEY])
  const estado = readLaminacionEstadoArea(mergedForm[LAM_ESTADO_KEY])

  let next: Record<string, unknown> = { ...mergedForm }

  if (turnos.length === 0 && !actual) {
    const hist = parseLamTurnosHistorial(next)
    if (hist.length > 0) {
      turnos = historialToClosedTurnos(hist)
    }
  }

  if (!actual && turnos.length === 0 && hasLegacyLaminacionMirror(next)) {
    turnos = [legacyClosedTurnoFromMirror(next)]
    next = {
      ...next,
      [LAM_TURNOS_KEY]: turnos,
      [LAM_ACTUAL_KEY]: null,
      [LAM_ESTADO_KEY]: estado,
      ...clearLaminacionMirrorKeys(),
    }
    return hydrateVirgenBobinasFromSustratos(next)
  }

  next = {
    ...next,
    [LAM_TURNOS_KEY]: turnos,
    [LAM_ACTUAL_KEY]: actual,
    [LAM_ESTADO_KEY]: estado,
  }

  if (actual) {
    next = { ...next, ...laminacionTurnoToMirror(actual) }
  } else if (estado === "finalizada") {
    next = {
      ...next,
      ...clearLaminacionMirrorKeys(),
      ...laminacionAggregatedTimerMirrorFromTurnos(turnos),
    }
  } else {
    next = { ...next, ...clearLaminacionMirrorKeys() }
  }

  return hydrateVirgenBobinasFromSustratos(next)
}

export type JsonAccumulatedLaminacion = {
  producidoKg: number
  entradaImpresaKg: number
  entradaVirgenKg: number
  scrapKg: number
  turnosCerrados: number
  turnosRegistrados: number
  ultimoCierreLabel: string
}

export function accumulateLaminacionFromJson(
  cerrados: LaminacionTurnoEntry[],
  actual: LaminacionTurnoEntry | null,
): JsonAccumulatedLaminacion {
  let producidoKg = 0
  let entradaImpresaKg = 0
  let entradaVirgenKg = 0
  let scrapKg = 0
  for (const t of cerrados) {
    producidoKg += sumSalidaKgTurno(t)
    entradaImpresaKg += sumEntradaImpresaKgTurno(t)
    entradaVirgenKg += sumEntradaVirgenKgTurno(t)
    scrapKg += sumScrapKgTurno(t)
  }
  if (actual) {
    producidoKg += sumSalidaKgTurno(actual)
    entradaImpresaKg += sumEntradaImpresaKgTurno(actual)
    entradaVirgenKg += sumEntradaVirgenKgTurno(actual)
    scrapKg += sumScrapKgTurno(actual)
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
    entradaImpresaKg,
    entradaVirgenKg,
    scrapKg,
    turnosCerrados: cerrados.length,
    turnosRegistrados: cerrados.length + (actual ? 1 : 0),
    ultimoCierreLabel,
  }
}

/** Espejo plano con tiempos acumulados de turnos cerrados (área finalizada / sin turno actual). */
export function laminacionAggregatedTimerMirrorFromTurnos(
  turnos: LaminacionTurnoEntry[],
): Record<string, unknown> {
  let effectiveAccSec = 0
  let deadAccSec = 0
  for (const t of turnos) {
    effectiveAccSec += readLamNumber(t.timer.effectiveAccSec)
    deadAccSec += readLamNumber(t.timer.deadAccSec)
  }
  return timerToLegacyFlat({
    ...emptyLaminacionTurnTimer(),
    state: "completed",
    effectiveAccSec,
    deadAccSec,
  })
}

export function finalizeLaminacionTurnTimerNow(timer: LaminacionTurnTimer): LaminacionTurnTimer {
  const now = Date.now()
  let effective = timer.effectiveAccSec
  let dead = timer.deadAccSec
  if (timer.state === "running" && timer.lastResumeAtMs > 0) {
    effective += (now - timer.lastResumeAtMs) / 1000
  }
  if (timer.state === "paused" && timer.pauseAtMs > 0) {
    dead += (now - timer.pauseAtMs) / 1000
  }
  return finalizeMesPhaseSlotsOnTimer({
    ...timer,
    state: "stopped",
    effectiveAccSec: effective,
    deadAccSec: dead,
    pauseAtMs: 0,
    lastResumeAtMs: 0,
  })
}
