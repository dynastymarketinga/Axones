import { parseDecimalTwoInput, sanitizeDecimalTwoInput } from "@/lib/decimal-two-input"
import { sanitizeBobinaKgSlotInput } from "@/lib/bobina-kg-slot"

export { isBobinaKgSlotFilled, sanitizeBobinaKgSlotInput } from "@/lib/bobina-kg-slot"
import {
  emptyMesPhaseTimerFields,
  finalizeMesPhaseSlotsOnTimer,
  mesPhaseFieldsFromLegacyForm,
  mesPhaseFieldsToLegacyFlat,
  parseMesPhaseFieldsFromRecord,
  type MesPhaseTimerFields,
} from "@/lib/mes-phase-timer-fields"

export { cumulativeDemountSeconds } from "@/lib/mes-phase-timer-fields"

export type BobinaLabelMeta = {
  fecha: string
  hora: string
  referencia: string
  lote: string
  proveedor: string
  operador: string
  metraje: string
  peso: string
  medida_ancho: string
  tratamiento_interno: string
  tratamiento_externo: string
  maquina_origen: string
  pedido_lote: string
  /** Empalmes en bobina de salida (planilla física). */
  empalmes: string
}

/** Campos usados solo en etiqueta de salida impresa (planilla física). */
export const SALIDA_BOBINA_LABEL_KEYS = ["peso", "fecha", "metraje", "hora", "empalmes"] as const
export type SalidaBobinaLabelKey = (typeof SALIDA_BOBINA_LABEL_KEYS)[number]

export const IMP_TURNOS_KEY = "impTurnosImpresion"
export const IMP_ACTUAL_KEY = "impTurnoActual"
export const IMP_ESTADO_KEY = "impEstadoArea"

/** Casillas por rejilla: ingreso material virgen y salida bobina impresa (OT impresión). */
export const IMP_BOBINAS_SLOTS = 30

/** Línea de devolución rechazada en el panel de envío a almacén (puede haber varias por motivo/material). */
export type WarehouseRejectedEntry = {
  id: string
  /** @deprecated Preferir kg; se conserva para totales en turno. */
  bobinas: string
  /** Kilos de material rechazado (cantidad principal hacia almacén). */
  kg: string
  motivo: string
  /** Fecha impresa en la etiqueta de la bobina (AAAA-MM-DD). */
  fechaBobina: string
  /** Fecha de registro / creación del aviso (AAAA-MM-DD). */
  creadaFecha: string
  /** Operador que reporta la devolución mala. */
  operador: string
  /** Proveedor (catálogo); opcional. */
  proveedorId: string
  materialId: string
  obs: string
}

export function newWarehouseRejectedEntry(
  partial?: Partial<Omit<WarehouseRejectedEntry, "id">> & { id?: string },
): WarehouseRejectedEntry {
  const id =
    partial?.id ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `rech-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
  return {
    id,
    bobinas: "",
    kg: "",
    motivo: "",
    fechaBobina: "",
    creadaFecha: "",
    operador: "",
    proveedorId: "",
    materialId: "",
    obs: "",
    ...partial,
  }
}

export function countRejectedEntryBobinas(raw: unknown): number {
  const n = readNumber(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

export function countRejectedEntryKg(raw: unknown): number {
  const n = readNumber(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

export function sumRejectedEntryBobinas(entries: WarehouseRejectedEntry[]): number {
  return entries.reduce((acc, e) => acc + countRejectedEntryBobinas(e.bobinas), 0)
}

export function sumRejectedEntryKg(entries: WarehouseRejectedEntry[]): number {
  return entries.reduce((acc, e) => acc + countRejectedEntryKg(e.kg), 0)
}

export function rejectedEntriesWithBobinas(entries: WarehouseRejectedEntry[]): WarehouseRejectedEntry[] {
  return entries.filter(
    (e) => countRejectedEntryBobinas(e.bobinas) > 0 || countRejectedEntryKg(e.kg) > 0,
  )
}

export function rejectedEntriesWithKg(entries: WarehouseRejectedEntry[]): WarehouseRejectedEntry[] {
  return entries.filter((e) => countRejectedEntryKg(e.kg) > 0)
}

export function allRejectedEntriesHaveMotivo(entries: WarehouseRejectedEntry[]): boolean {
  const active = rejectedEntriesWithBobinas(entries)
  if (active.length === 0) return true
  return active.every((e) => e.motivo.trim().length > 0)
}

/** Borrador de campos solo para el envío a almacén (materiales, referencia y líneas rechazadas). */
export type WarehouseReturnDraft = {
  buenaMaterialId: string
  /** Texto libre o autocompletado desde el material seleccionado. */
  buenaEspecificaciones: string
  buenaMotivo: string
  bobinaCode: string
  rechazadaEntries: WarehouseRejectedEntry[]
}

/** Motivos estándar para devolución rechazada (impresión); mismo criterio que el panel de envío a almacén. */
export const PRINTING_REJECT_REASONS: Array<{ id: string; label: string }> = [
  { id: "impresion_defectuosa", label: "Impresión defectuosa" },
  { id: "manchas", label: "Manchas" },
  { id: "registro_fuera", label: "Registro fuera" },
  { id: "contaminacion", label: "Contaminación" },
  { id: "otro", label: "Otro" },
]

export type PrintingEstadoArea = "abierta" | "finalizada"

export type PrintingPauseEntry = {
  at: string
  reason: string
  obs: string
  duration_sec: number
}

export type PrintingTurnTimerState =
  | "pending"
  | "running"
  | "paused"
  | "stopped"
  | "completed"

export type PrintingTurnTimer = {
  state: PrintingTurnTimerState
  startedAtMs: number
  lastResumeAtMs: number
  pauseAtMs: number
  effectiveAccSec: number
  deadAccSec: number
  pauses: PrintingPauseEntry[]
} & MesPhaseTimerFields

export type PrintingTurnoEntry = {
  id: string
  started_at: string
  closed_at: string | null
  closed_by: { id: number; name: string } | null
  /** Control multiusuario del turno (frontend) */
  control_owner_user_id?: number | null
  control_owner_name?: string | null
  control_taken_at?: string | null
  turno: "diurno" | "nocturno" | ""
  grupo: "A" | "B" | "C" | ""
  operador: string
  ayudante: string
  supervisor: string
  entradaBobinasKg: string[]
  entradaBobinasMeta: BobinaLabelMeta[]
  salidaBobinasKg: string[]
  salidaBobinasMeta: BobinaLabelMeta[]
  devolucionBuenaKg: string
  /** @deprecated Legado (kg); usar devolucionRechazadaBobinas. */
  devolucionRechazadaKg: string
  /** Cantidad de bobinas rechazadas devueltas en el turno. */
  devolucionRechazadaBobinas: string
  /** id del motivo (PRINTING_REJECT_REASONS) o texto libre si aplica */
  devolucionRechazadaMotivo: string
  scrapTransparenteKg: string
  scrapImpresoKg: string
  observaciones: string
  timer: PrintingTurnTimer
  /** Resumen derivado al cerrar el turno (historial / bandeja). */
  resumenCierre?: PrintingTurnoResumenCierre
  /** Capturas guardadas con «Guardar» dentro del mismo turno (rejillas se limpian tras cada una). */
  capturas?: PrintingCapturaProduccion[]
}

/** Snapshot de producción al pulsar Guardar (acumulativo dentro del turno). */
export type PrintingCapturaProduccion = {
  id: string
  saved_at: string
  entradaBobinasKg: string[]
  entradaBobinasMeta: BobinaLabelMeta[]
  salidaBobinasKg: string[]
  salidaBobinasMeta: BobinaLabelMeta[]
  devolucionBuenaKg: string
  devolucionRechazadaKg: string
  devolucionRechazadaBobinas: string
  devolucionRechazadaMotivo: string
  scrapTransparenteKg: string
  scrapImpresoKg: string
}

/** N° bobinas rechazadas (lee campo nuevo o legado en kg). */
export function countDevolucionRechazadaBobinas(
  bobinasRaw: unknown,
  legacyKgRaw?: unknown,
): number {
  const b = readNumber(bobinasRaw)
  if (b > 0) return Math.floor(b)
  const k = readNumber(legacyKgRaw)
  if (k > 0) return Math.floor(k)
  return 0
}

function readDevolucionRechazadaBobinasField(o: Record<string, unknown>): string {
  const b =
    readNumberString(o.devolucionRechazadaBobinas) || readNumberString(o.impDevolucionRechazadaBobinas)
  if (readNumber(b) > 0) return b
  const legacy = countDevolucionRechazadaBobinas(
    "",
    o.devolucionRechazadaKg ?? o.impDevolucionRechazadaKg,
  )
  return legacy > 0 ? String(legacy) : ""
}

/** Métricas de cierre para historial legible. */
export type PrintingTurnoResumenCierre = {
  numBobinasSalida: number
  pesoSalidaKg: number
  pesoEntradaKg: number
  scrapKg: number
  numParadas: number
  metrajeTotalM: number
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

export function newTurnoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function emptyBobinaLabelMeta(): BobinaLabelMeta {
  return {
    fecha: "",
    hora: "",
    referencia: "",
    lote: "",
    proveedor: "",
    operador: "",
    metraje: "",
    peso: "",
    medida_ancho: "",
    tratamiento_interno: "",
    tratamiento_externo: "",
    maquina_origen: "",
    pedido_lote: "",
    empalmes: "",
  }
}

function normalizeBobinaLabelMeta(meta: Partial<BobinaLabelMeta>): BobinaLabelMeta {
  const e = emptyBobinaLabelMeta()
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

/** Etiqueta de salida: solo campos de la planilla física (Peso, Fecha, Metraje, Hora, Empalmes). */
export function normalizeSalidaBobinaLabelMeta(meta: Partial<BobinaLabelMeta>): BobinaLabelMeta {
  const base = emptyBobinaLabelMeta()
  const normalized = normalizeBobinaLabelMeta(meta)
  return {
    ...base,
    peso: normalized.peso,
    fecha: normalized.fecha,
    metraje: normalized.metraje,
    hora: normalized.hora,
    empalmes: normalized.empalmes,
  }
}

export function hasSalidaBobinaMeta(meta: BobinaLabelMeta | undefined): boolean {
  if (!meta) return false
  return SALIDA_BOBINA_LABEL_KEYS.some((key) => meta[key].trim() !== "")
}

export function salidaBobinaLabelTooltipText(meta: BobinaLabelMeta | undefined): string {
  if (!meta || !hasSalidaBobinaMeta(meta)) return "Sin etiqueta registrada"
  const parts: string[] = []
  if (meta.peso.trim()) parts.push(`Peso: ${meta.peso} Kg`)
  if (meta.fecha.trim()) parts.push(`Fecha: ${meta.fecha}`)
  if (meta.metraje.trim()) parts.push(`Metraje: ${meta.metraje} m`)
  if (meta.hora.trim()) parts.push(`Hora: ${meta.hora}`)
  if (meta.empalmes.trim()) parts.push(`Empalmes: ${meta.empalmes}`)
  return parts.join(" · ")
}

export function emptyNumericSeries(size: number): string[] {
  return Array.from({ length: size }, () => "")
}

/** Casilla kg de bobina (ingreso/salida): solo dígitos y coma/punto con hasta 2 decimales. */
export function emptyMetaSeries(size: number): BobinaLabelMeta[] {
  return Array.from({ length: size }, () => emptyBobinaLabelMeta())
}

export function emptyPrintingTurnTimer(): PrintingTurnTimer {
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

export function createNewPrintingTurno(params: {
  turno: "diurno" | "nocturno"
  grupo: "A" | "B" | "C"
  operador: string
  controlOwner?: { id: number; name: string } | null
}): PrintingTurnoEntry {
  const now = new Date().toISOString()
  return {
    id: newTurnoId(),
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
    entradaBobinasKg: emptyNumericSeries(IMP_BOBINAS_SLOTS),
    entradaBobinasMeta: emptyMetaSeries(IMP_BOBINAS_SLOTS),
    salidaBobinasKg: emptyNumericSeries(IMP_BOBINAS_SLOTS),
    salidaBobinasMeta: emptyMetaSeries(IMP_BOBINAS_SLOTS),
    devolucionBuenaKg: "",
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: "",
    devolucionRechazadaMotivo: "",
    scrapTransparenteKg: "0",
    scrapImpresoKg: "0",
    observaciones: "",
    timer: emptyPrintingTurnTimer(),
  }
}

function parsePauseEntries(raw: unknown): PrintingPauseEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => x as Partial<PrintingPauseEntry>)
    .map((x) => ({
      at: readString(x.at),
      reason: readString(x.reason),
      obs: readString(x.obs),
      duration_sec: readNumber(x.duration_sec),
    }))
    .filter((x) => x.reason)
}

function parseTimer(raw: unknown): PrintingTurnTimer {
  if (!raw || typeof raw !== "object") return emptyPrintingTurnTimer()
  const o = raw as Record<string, unknown>
  const state = readString(o.state) as PrintingTurnTimerState
  const valid: PrintingTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
  return {
    state: valid.includes(state) ? state : "pending",
    startedAtMs: readNumber(o.startedAtMs),
    lastResumeAtMs: readNumber(o.lastResumeAtMs),
    pauseAtMs: readNumber(o.pauseAtMs),
    effectiveAccSec: readNumber(o.effectiveAccSec),
    deadAccSec: readNumber(o.deadAccSec),
    pauses: parsePauseEntries(o.pauses),
    ...parseMesPhaseFieldsFromRecord(o),
  }
}

/** Parsea timer desde claves planas legacy impTimer* (compatibilidad). */
export function timerFromLegacyFlatForm(form: Record<string, unknown>): PrintingTurnTimer {
  const state = (readString(form.impTimerState) || "pending") as PrintingTurnTimerState
  const valid: PrintingTurnTimerState[] = ["pending", "running", "paused", "stopped", "completed"]
  return {
    state: valid.includes(state) ? state : "pending",
    startedAtMs: readNumber(form.impTimerStartedAtMs),
    lastResumeAtMs: readNumber(form.impTimerLastResumeAtMs),
    pauseAtMs: readNumber(form.impTimerPauseAtMs),
    effectiveAccSec: readNumber(form.impTimerEffectiveAccSec),
    deadAccSec: readNumber(form.impTimerDeadAccSec),
    pauses: parsePauseEntries(form.impTimerPauses),
    ...mesPhaseFieldsFromLegacyForm(form, "impTimer"),
  }
}

/** Serializa PrintingTurnTimer a claves planas impTimer* para espejo / API. */
export function timerToLegacyFlat(timer: PrintingTurnTimer): Record<string, unknown> {
  return {
    impTimerState: timer.state,
    impTimerStartedAtMs: timer.startedAtMs,
    impTimerLastResumeAtMs: timer.lastResumeAtMs,
    impTimerPauseAtMs: timer.pauseAtMs,
    impTimerEffectiveAccSec: timer.effectiveAccSec,
    impTimerDeadAccSec: timer.deadAccSec,
    impTimerPauses: timer.pauses,
    ...mesPhaseFieldsToLegacyFlat(timer, "impTimer"),
  }
}

function getNumericSeriesForm(form: Record<string, unknown>, key: string, size: number): string[] {
  const raw = form[key]
  if (!Array.isArray(raw)) return emptyNumericSeries(size)
  const out = raw.slice(0, size).map((v) => sanitizeBobinaKgSlotInput(v))
  while (out.length < size) out.push("")
  return out
}

function getMetaSeriesForm(form: Record<string, unknown>, key: string, size: number): BobinaLabelMeta[] {
  const raw = form[key]
  const out: BobinaLabelMeta[] = []
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, size)) {
      if (item && typeof item === "object") {
        out.push(normalizeBobinaLabelMeta({ ...emptyBobinaLabelMeta(), ...(item as object) }))
      } else {
        out.push(emptyBobinaLabelMeta())
      }
    }
  }
  while (out.length < size) out.push(emptyBobinaLabelMeta())
  return out
}

function normalizePrintingCaptura(raw: unknown): PrintingCapturaProduccion | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = readString(o.id)
  if (!id) return null
  return {
    id,
    saved_at: readString(o.saved_at) || new Date().toISOString(),
    entradaBobinasKg: padStringArray(o.entradaBobinasKg, IMP_BOBINAS_SLOTS),
    entradaBobinasMeta: padMetaArray(o.entradaBobinasMeta, IMP_BOBINAS_SLOTS),
    salidaBobinasKg: padStringArray(o.salidaBobinasKg, IMP_BOBINAS_SLOTS),
    salidaBobinasMeta: padMetaArray(o.salidaBobinasMeta, IMP_BOBINAS_SLOTS),
    devolucionBuenaKg: readNumberString(o.devolucionBuenaKg),
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: readDevolucionRechazadaBobinasField(o),
    devolucionRechazadaMotivo: readString(o.devolucionRechazadaMotivo),
    scrapTransparenteKg: readNumberString(o.scrapTransparenteKg),
    scrapImpresoKg: readNumberString(o.scrapImpresoKg),
  }
}

function parsePrintingCapturas(raw: unknown): PrintingCapturaProduccion[] {
  if (!Array.isArray(raw)) return []
  const out: PrintingCapturaProduccion[] = []
  for (const item of raw) {
    const c = normalizePrintingCaptura(item)
    if (c) out.push(c)
  }
  return out
}

export function parsePrintingTurnos(raw: unknown): PrintingTurnoEntry[] {
  if (!Array.isArray(raw)) return []
  const out: PrintingTurnoEntry[] = []
  for (const item of raw) {
    const t = normalizePrintingTurno(item)
    if (t) out.push(t)
  }
  return out
}

export function normalizePrintingTurno(raw: unknown): PrintingTurnoEntry | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = readString(o.id)
  if (!id) return null
  const turnoRaw = readString(o.turno).toLowerCase()
  const grupoRaw = readString(o.grupo).toUpperCase()
  const turno: PrintingTurnoEntry["turno"] =
    turnoRaw === "diurno" || turnoRaw === "nocturno" ? (turnoRaw as "diurno" | "nocturno") : ""
  const grupo: PrintingTurnoEntry["grupo"] =
    grupoRaw === "A" || grupoRaw === "B" || grupoRaw === "C" ? (grupoRaw as "A" | "B" | "C") : ""

  let closedBy: PrintingTurnoEntry["closed_by"] = null
  const cb = o.closed_by
  if (cb && typeof cb === "object") {
    const c = cb as Record<string, unknown>
    const cid = readNumber(c.id)
    if (cid > 0) closedBy = { id: cid, name: readString(c.name) || "—" }
  }

  let resumenCierre: PrintingTurnoResumenCierre | undefined
  const rc = o.resumenCierre
  if (rc && typeof rc === "object") {
    const r = rc as Record<string, unknown>
    resumenCierre = {
      numBobinasSalida: readNumber(r.numBobinasSalida),
      pesoSalidaKg: readNumber(r.pesoSalidaKg),
      pesoEntradaKg: readNumber(r.pesoEntradaKg),
      scrapKg: readNumber(r.scrapKg),
      numParadas: readNumber(r.numParadas),
      metrajeTotalM: readNumber(r.metrajeTotalM),
    }
  }

  return {
    id,
    started_at: readString(o.started_at) || new Date().toISOString(),
    closed_at: o.closed_at === null || o.closed_at === undefined ? null : readString(o.closed_at),
    closed_by: closedBy,
    control_owner_user_id: o.control_owner_user_id === null || o.control_owner_user_id === undefined ? null : readNumber(o.control_owner_user_id),
    control_owner_name: readString(o.control_owner_name) || null,
    control_taken_at: readString(o.control_taken_at) || null,
    turno,
    grupo,
    operador: readString(o.operador),
    ayudante: readString(o.ayudante),
    supervisor: readString(o.supervisor),
    entradaBobinasKg: padStringArray(o.entradaBobinasKg, IMP_BOBINAS_SLOTS),
    entradaBobinasMeta: padMetaArray(o.entradaBobinasMeta, IMP_BOBINAS_SLOTS),
    salidaBobinasKg: padStringArray(o.salidaBobinasKg, IMP_BOBINAS_SLOTS),
    salidaBobinasMeta: padMetaArray(o.salidaBobinasMeta, IMP_BOBINAS_SLOTS),
    devolucionBuenaKg: readNumberString(o.devolucionBuenaKg),
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: readDevolucionRechazadaBobinasField(o),
    devolucionRechazadaMotivo: readString(o.devolucionRechazadaMotivo),
    scrapTransparenteKg: readNumberString(o.scrapTransparenteKg),
    scrapImpresoKg: readNumberString(o.scrapImpresoKg),
    observaciones: readString(o.observaciones),
    timer: parseTimer(o.timer),
    ...(resumenCierre ? { resumenCierre } : {}),
    capturas: parsePrintingCapturas(o.capturas),
  }
}

function padStringArray(raw: unknown, size: number): string[] {
  if (!Array.isArray(raw)) return emptyNumericSeries(size)
  const out = raw.slice(0, size).map((v) => sanitizeBobinaKgSlotInput(v))
  while (out.length < size) out.push("")
  return out
}

function padMetaArray(raw: unknown, size: number): BobinaLabelMeta[] {
  if (!Array.isArray(raw)) return emptyMetaSeries(size)
  const out: BobinaLabelMeta[] = []
  for (const item of raw.slice(0, size)) {
    if (item && typeof item === "object") {
      out.push(normalizeBobinaLabelMeta({ ...emptyBobinaLabelMeta(), ...(item as object) }))
    } else {
      out.push(emptyBobinaLabelMeta())
    }
  }
  while (out.length < size) out.push(emptyBobinaLabelMeta())
  return out
}

export function parsePrintingTurnoActual(raw: unknown): PrintingTurnoEntry | null {
  if (raw === null || raw === undefined) return null
  return normalizePrintingTurno(raw)
}

export function readEstadoArea(raw: unknown): PrintingEstadoArea {
  const s = readString(raw).toLowerCase().trim()
  if (s === "finalizada") return "finalizada"
  return "abierta"
}

/** Detecta datos legacy en claves planas imp* sin historial estructurado. */
export function hasLegacyPrintingMirror(form: Record<string, unknown>): boolean {
  const hasStructured =
    parsePrintingTurnos(form[IMP_TURNOS_KEY]).length > 0 || parsePrintingTurnoActual(form[IMP_ACTUAL_KEY]) !== null
  if (hasStructured) return false

  const ts = readString(form.impTimerState).toLowerCase()
  if (ts && ts !== "pending") return true
  if (readString(form.impOperador).trim()) return true

  const ent = getNumericSeriesForm(form, "impEntradaBobinasKg", IMP_BOBINAS_SLOTS)
  const sal = getNumericSeriesForm(form, "impSalidaBobinasKg", IMP_BOBINAS_SLOTS)
  if (ent.some((x) => readNumber(x) > 0) || sal.some((x) => readNumber(x) > 0)) return true

  if (readNumber(form.impScrapTransparenteKg) > 0 || readNumber(form.impScrapImpresoKg) > 0) return true
  if (
    readNumber(form.impDevolucionBuenaKg) > 0 ||
    countDevolucionRechazadaBobinas(form.impDevolucionRechazadaBobinas, form.impDevolucionRechazadaKg) > 0
  ) {
    return true
  }

  return false
}

/** Construye un turno cerrado desde el espejo plano actual (migración). */
export function legacyClosedTurnoFromMirror(form: Record<string, unknown>): PrintingTurnoEntry {
  const now = new Date().toISOString()
  const timer = timerFromLegacyFlatForm(form)
  return {
    id: newTurnoId(),
    started_at: readString(form.impTimerStartedAtMs)
      ? new Date(readNumber(form.impTimerStartedAtMs)).toISOString()
      : now,
    closed_at: now,
    closed_by: null,
    turno: readString(form.impTurno) === "nocturno" ? "nocturno" : readString(form.impTurno) === "diurno" ? "diurno" : "",
    grupo: ((): PrintingTurnoEntry["grupo"] => {
      const g = readString(form.impGrupo).toUpperCase()
      return g === "A" || g === "B" || g === "C" ? g : ""
    })(),
    operador: readString(form.impOperador),
    ayudante: readString(form.impAyudante),
    supervisor: readString(form.impSupervisor),
    entradaBobinasKg: getNumericSeriesForm(form, "impEntradaBobinasKg", IMP_BOBINAS_SLOTS),
    entradaBobinasMeta: getMetaSeriesForm(form, "impEntradaBobinasMeta", IMP_BOBINAS_SLOTS),
    salidaBobinasKg: getNumericSeriesForm(form, "impSalidaBobinasKg", IMP_BOBINAS_SLOTS),
    salidaBobinasMeta: getMetaSeriesForm(form, "impSalidaBobinasMeta", IMP_BOBINAS_SLOTS),
    devolucionBuenaKg: readNumberString(form.impDevolucionBuenaKg),
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: readDevolucionRechazadaBobinasField(form),
    devolucionRechazadaMotivo: readString(form.impDevolucionRechazadaMotivo),
    scrapTransparenteKg: readNumberString(form.impScrapTransparenteKg),
    scrapImpresoKg: readNumberString(form.impScrapImpresoKg),
    observaciones: readString(form.impObservaciones),
    timer,
  }
}

/** Espejo plano imp* desde un turno (compatibilidad con endpoints / PDF). */
export function printingTurnoToMirror(t: PrintingTurnoEntry): Record<string, unknown> {
  return {
    impTurno: t.turno,
    impGrupo: t.grupo,
    impOperador: t.operador,
    impAyudante: t.ayudante,
    impSupervisor: t.supervisor,
    impEntradaBobinasKg: t.entradaBobinasKg,
    impEntradaBobinasMeta: t.entradaBobinasMeta,
    impSalidaBobinasKg: t.salidaBobinasKg,
    impSalidaBobinasMeta: t.salidaBobinasMeta,
    impDevolucionBuenaKg: t.devolucionBuenaKg,
    impDevolucionRechazadaKg: "",
    impDevolucionRechazadaBobinas: t.devolucionRechazadaBobinas,
    impDevolucionRechazadaMotivo: t.devolucionRechazadaMotivo,
    impScrapTransparenteKg: t.scrapTransparenteKg,
    impScrapImpresoKg: t.scrapImpresoKg,
    impObservaciones: t.observaciones,
    ...timerToLegacyFlat(t.timer),
  }
}

/** Limpia solo campos operativos del espejo (no toca pedidoKg ni planilla). */
export function clearPrintingMirrorKeys(): Record<string, unknown> {
  return {
    impTurno: "",
    impGrupo: "",
    impOperador: "",
    impAyudante: "",
    impSupervisor: "",
    impEntradaBobinasKg: emptyNumericSeries(IMP_BOBINAS_SLOTS),
    impEntradaBobinasMeta: emptyMetaSeries(IMP_BOBINAS_SLOTS),
    impSalidaBobinasKg: emptyNumericSeries(IMP_BOBINAS_SLOTS),
    impSalidaBobinasMeta: emptyMetaSeries(IMP_BOBINAS_SLOTS),
    impDevolucionBuenaKg: "",
    impDevolucionRechazadaKg: "",
    impDevolucionRechazadaBobinas: "",
    impDevolucionRechazadaMotivo: "",
    /** Tras "Enviar a almacén" en devoluciones: heurística para badge pendiente */
    impDevolucionesAlmacenUltimoEnvioMs: 0,
    impDevolucionesAlmacenSnapBuena: "",
    impDevolucionesAlmacenSnapRech: "",
    impScrapTransparenteKg: "0",
    impScrapImpresoKg: "0",
    impObservaciones: "",
    impAcumuladoProducidoKg: "",
    impRegistrosTurnos: "",
    impScrapAcumuladoKg: "",
    ...timerToLegacyFlat(emptyPrintingTurnTimer()),
  }
}

export function bootstrapPrintingFormState(mergedForm: Record<string, unknown>): Record<string, unknown> {
  let turnos = parsePrintingTurnos(mergedForm[IMP_TURNOS_KEY])
  let actual = parsePrintingTurnoActual(mergedForm[IMP_ACTUAL_KEY])
  const estado = readEstadoArea(mergedForm[IMP_ESTADO_KEY])

  let next: Record<string, unknown> = { ...mergedForm }

  if (!actual && turnos.length === 0 && hasLegacyPrintingMirror(next)) {
    turnos = [legacyClosedTurnoFromMirror(next)]
    next = {
      ...next,
      [IMP_TURNOS_KEY]: turnos,
      [IMP_ACTUAL_KEY]: null,
      [IMP_ESTADO_KEY]: estado,
      ...clearPrintingMirrorKeys(),
    }
    return next
  }

  next = {
    ...next,
    [IMP_TURNOS_KEY]: turnos,
    [IMP_ACTUAL_KEY]: actual,
    [IMP_ESTADO_KEY]: estado,
  }

  if (actual) {
    next = {
      ...next,
      ...printingTurnoToMirror(actual),
    }
  } else {
    next = {
      ...next,
      ...clearPrintingMirrorKeys(),
    }
  }

  return next
}

export function sumSalidaKgSlots(slots: string[]): number {
  return slots.reduce((acc, v) => acc + readNumber(v), 0)
}

/** Kg de salida por casilla: rejilla operativa o peso en etiqueta si la casilla está vacía. */
export function salidaKgFromSlotsAndMeta(slots: string[], metas: BobinaLabelMeta[]): number {
  let sum = 0
  for (let i = 0; i < slots.length; i++) {
    const slotKg = readNumber(slots[i])
    if (slotKg > 0.005) {
      sum += slotKg
      continue
    }
    sum += readNumber(metas[i]?.peso)
  }
  return sum
}

function mergeKgSlotSeries(turnoSlots: string[], mirrorSlots: string[]): string[] {
  return turnoSlots.map((v, i) => {
    const best = Math.max(readNumber(v), readNumber(mirrorSlots[i]))
    return best > 0.005 ? readNumberString(best) : ""
  })
}

/** Alinea turno actual con el espejo plano imp* antes de flush / cierre (evita kg perdidos). */
export function syncPrintingTurnoFromFormMirror(
  form: Record<string, unknown>,
  turno: PrintingTurnoEntry,
): PrintingTurnoEntry {
  const mirrorEb = getNumericSeriesForm(form, "impEntradaBobinasKg", IMP_BOBINAS_SLOTS)
  const mirrorSb = getNumericSeriesForm(form, "impSalidaBobinasKg", IMP_BOBINAS_SLOTS)
  const mirrorEm = getMetaSeriesForm(form, "impEntradaBobinasMeta", IMP_BOBINAS_SLOTS)
  const mirrorSm = getMetaSeriesForm(form, "impSalidaBobinasMeta", IMP_BOBINAS_SLOTS)
  const devBuena =
    readNumber(turno.devolucionBuenaKg) > 0
      ? turno.devolucionBuenaKg
      : readNumberString(form.impDevolucionBuenaKg)
  const devRech =
    countDevolucionRechazadaBobinas(turno.devolucionRechazadaBobinas, turno.devolucionRechazadaKg) > 0
      ? turno.devolucionRechazadaBobinas
      : readDevolucionRechazadaBobinasField(form)
  const devMotivo =
    readString(turno.devolucionRechazadaMotivo).trim() ||
    readString(form.impDevolucionRechazadaMotivo).trim()
  const scrapT =
    readNumber(turno.scrapTransparenteKg) > 0
      ? turno.scrapTransparenteKg
      : readNumberString(form.impScrapTransparenteKg)
  const scrapI =
    readNumber(turno.scrapImpresoKg) > 0 ? turno.scrapImpresoKg : readNumberString(form.impScrapImpresoKg)

  return {
    ...turno,
    entradaBobinasKg: mergeKgSlotSeries(turno.entradaBobinasKg, mirrorEb),
    salidaBobinasKg: mergeKgSlotSeries(turno.salidaBobinasKg, mirrorSb),
    entradaBobinasMeta: turno.entradaBobinasMeta.map((m, i) => {
      const mirror = mirrorEm[i] ?? emptyBobinaLabelMeta()
      return readNumber(m.peso) > 0 || Object.values(m).some((v) => readString(v).trim() !== "")
        ? m
        : mirror
    }),
    salidaBobinasMeta: turno.salidaBobinasMeta.map((m, i) => {
      const mirror = mirrorSm[i] ?? emptyBobinaLabelMeta()
      return readNumber(m.peso) > 0 || Object.values(m).some((v) => readString(v).trim() !== "")
        ? m
        : mirror
    }),
    devolucionBuenaKg: devBuena,
    devolucionRechazadaBobinas: devRech,
    devolucionRechazadaMotivo: devMotivo,
    scrapTransparenteKg: scrapT || "0",
    scrapImpresoKg: scrapI || "0",
    observaciones: readString(turno.observaciones).trim()
      ? turno.observaciones
      : readString(form.impObservaciones),
  }
}

export function sumEntradaKgSlots(slots: string[]): number {
  return slots.reduce((acc, v) => acc + readNumber(v), 0)
}

export function sumSalidaKg(t: PrintingTurnoEntry): number {
  return sumSalidaKgSlots(t.salidaBobinasKg)
}

export function sumEntradaKg(t: PrintingTurnoEntry): number {
  return sumEntradaKgSlots(t.entradaBobinasKg)
}

export function sumScrapKg(t: PrintingTurnoEntry): number {
  return readNumber(t.scrapTransparenteKg) + readNumber(t.scrapImpresoKg)
}

export function sumScrapKgCaptura(c: PrintingCapturaProduccion): number {
  return readNumber(c.scrapTransparenteKg) + readNumber(c.scrapImpresoKg)
}

/** Totales del turno: capturas guardadas + rejilla operativa actual. */
export function turnoProduccionTotals(t: PrintingTurnoEntry): {
  entradaKg: number
  salidaKg: number
  scrapKg: number
} {
  let entradaKg = 0
  let salidaKg = 0
  let scrapKg = 0
  for (const c of t.capturas ?? []) {
    entradaKg += sumEntradaKgSlots(c.entradaBobinasKg)
    salidaKg += salidaKgFromSlotsAndMeta(c.salidaBobinasKg, c.salidaBobinasMeta)
    scrapKg += sumScrapKgCaptura(c)
  }
  entradaKg += sumEntradaKg(t)
  salidaKg += salidaKgFromSlotsAndMeta(t.salidaBobinasKg, t.salidaBobinasMeta)
  scrapKg += sumScrapKg(t)
  if (salidaKg < 0.005 && t.resumenCierre && readNumber(t.resumenCierre.pesoSalidaKg) > 0) {
    salidaKg = readNumber(t.resumenCierre.pesoSalidaKg)
  }
  return { entradaKg, salidaKg, scrapKg }
}

export function printingTurnoHasOperativoData(t: PrintingTurnoEntry): boolean {
  const tot = turnoProduccionTotals(t)
  if (tot.entradaKg > 0.005 || tot.salidaKg > 0.005 || tot.scrapKg > 0.005) return true
  if (
    readNumber(t.devolucionBuenaKg) > 0 ||
    countDevolucionRechazadaBobinas(t.devolucionRechazadaBobinas, t.devolucionRechazadaKg) > 0
  ) {
    return true
  }
  for (const c of t.capturas ?? []) {
    if (
      readNumber(c.devolucionBuenaKg) > 0 ||
      countDevolucionRechazadaBobinas(c.devolucionRechazadaBobinas, c.devolucionRechazadaKg) > 0
    ) {
      return true
    }
  }
  return false
}

export function buildPrintingCapturaFromTurno(t: PrintingTurnoEntry): PrintingCapturaProduccion {
  return {
    id: newTurnoId(),
    saved_at: new Date().toISOString(),
    entradaBobinasKg: [...t.entradaBobinasKg],
    entradaBobinasMeta: t.entradaBobinasMeta.map((m) => ({ ...m })),
    salidaBobinasKg: [...t.salidaBobinasKg],
    salidaBobinasMeta: t.salidaBobinasMeta.map((m) => ({ ...m })),
    devolucionBuenaKg: t.devolucionBuenaKg,
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: t.devolucionRechazadaBobinas,
    devolucionRechazadaMotivo: t.devolucionRechazadaMotivo,
    scrapTransparenteKg: t.scrapTransparenteKg,
    scrapImpresoKg: t.scrapImpresoKg,
  }
}

/** Vacía rejillas y desperdicio/devoluciones del turno (tras guardar captura). */
export function clearPrintingTurnoOperativo(t: PrintingTurnoEntry): PrintingTurnoEntry {
  return {
    ...t,
    entradaBobinasKg: emptyNumericSeries(IMP_BOBINAS_SLOTS),
    entradaBobinasMeta: emptyMetaSeries(IMP_BOBINAS_SLOTS),
    salidaBobinasKg: emptyNumericSeries(IMP_BOBINAS_SLOTS),
    salidaBobinasMeta: emptyMetaSeries(IMP_BOBINAS_SLOTS),
    devolucionBuenaKg: "",
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: "",
    devolucionRechazadaMotivo: "",
    scrapTransparenteKg: "0",
    scrapImpresoKg: "0",
  }
}

/** Mueve datos operativos actuales a capturas y limpia la rejilla para nuevo registro. */
export function flushPrintingTurnoOperativoToCapturas(t: PrintingTurnoEntry): PrintingTurnoEntry {
  const hasGridOrScrap =
    sumEntradaKg(t) > 0.005 ||
    sumSalidaKg(t) > 0.005 ||
    sumScrapKg(t) > 0.005 ||
    readNumber(t.devolucionBuenaKg) > 0 ||
    countDevolucionRechazadaBobinas(t.devolucionRechazadaBobinas, t.devolucionRechazadaKg) > 0
  if (!hasGridOrScrap) return t
  return clearPrintingTurnoOperativo({
    ...t,
    capturas: [...(t.capturas ?? []), buildPrintingCapturaFromTurno(t)],
  })
}

export function countBobinasConKg(slots: string[]): number {
  return slots.filter((v) => readNumber(v) > 0).length
}

function sumMetrajeSalidaSlots(slots: string[], metas: BobinaLabelMeta[]): number {
  let sum = 0
  for (let i = 0; i < slots.length; i++) {
    if (readNumber(slots[i]) <= 0) continue
    const meta = metas[i]
    if (meta?.metraje) sum += readNumber(meta.metraje)
  }
  return sum
}

export function sumMetrajeSalidaM(t: PrintingTurnoEntry): number {
  let sum = 0
  for (const c of t.capturas ?? []) {
    sum += sumMetrajeSalidaSlots(c.salidaBobinasKg, c.salidaBobinasMeta)
  }
  sum += sumMetrajeSalidaSlots(t.salidaBobinasKg, t.salidaBobinasMeta)
  return sum
}

export function buildPrintingTurnoResumenCierre(t: PrintingTurnoEntry): PrintingTurnoResumenCierre {
  const pauses = Array.isArray(t.timer.pauses) ? t.timer.pauses : []
  const tot = turnoProduccionTotals(t)
  let numBobinasSalida = 0
  for (const c of t.capturas ?? []) {
    numBobinasSalida += countBobinasConKg(c.salidaBobinasKg)
  }
  numBobinasSalida += countBobinasConKg(t.salidaBobinasKg)
  return {
    numBobinasSalida,
    pesoSalidaKg: tot.salidaKg,
    pesoEntradaKg: tot.entradaKg,
    scrapKg: tot.scrapKg,
    numParadas: pauses.length,
    metrajeTotalM: sumMetrajeSalidaM(t),
  }
}

export function getLastClosedPrintingTurno(cerrados: PrintingTurnoEntry[]): PrintingTurnoEntry | null {
  if (cerrados.length === 0) return null
  return [...cerrados].sort((a, b) =>
    readString(b.closed_at ?? "").localeCompare(readString(a.closed_at ?? "")),
  )[0]
}

export function printingTurnoResumen(t: PrintingTurnoEntry): PrintingTurnoResumenCierre {
  return t.resumenCierre ?? buildPrintingTurnoResumenCierre(t)
}

export type JsonAccumulatedPrinting = {
  producidoKg: number
  entradaKg: number
  scrapKg: number
  /** Solo turnos ya cerrados en historial. */
  turnosCerrados: number
  /** Cerrados + 1 si hay turno actual abierto (vista en tiempo real). */
  turnosRegistrados: number
  ultimoCierreLabel: string
}

export function accumulatePrintingFromJson(
  cerrados: PrintingTurnoEntry[],
  actual: PrintingTurnoEntry | null,
): JsonAccumulatedPrinting {
  let producidoKg = 0
  let entradaKg = 0
  let scrapKg = 0
  for (const t of cerrados) {
    const tot = turnoProduccionTotals(t)
    producidoKg += tot.salidaKg
    entradaKg += tot.entradaKg
    scrapKg += tot.scrapKg
  }
  if (actual) {
    const tot = turnoProduccionTotals(actual)
    producidoKg += tot.salidaKg
    entradaKg += tot.entradaKg
    scrapKg += tot.scrapKg
  }

  const ultimo = [...cerrados].sort((a, b) => readString(b.closed_at ?? "").localeCompare(readString(a.closed_at ?? "")))[0]
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
    entradaKg,
    scrapKg,
    turnosCerrados: cerrados.length,
    turnosRegistrados: cerrados.length + (actual ? 1 : 0),
    ultimoCierreLabel,
  }
}

/** Espejo plano con tiempos acumulados de turnos cerrados (área finalizada / sin turno actual). */
export function printingAggregatedTimerMirrorFromTurnos(
  turnos: PrintingTurnoEntry[],
): Record<string, unknown> {
  let effectiveAccSec = 0
  let deadAccSec = 0
  for (const t of turnos) {
    effectiveAccSec += readNumber(t.timer.effectiveAccSec)
    deadAccSec += readNumber(t.timer.deadAccSec)
  }
  return timerToLegacyFlat({
    ...emptyPrintingTurnTimer(),
    state: "completed",
    effectiveAccSec,
    deadAccSec,
  })
}

export function finalizeTurnTimerNow(timer: PrintingTurnTimer): PrintingTurnTimer {
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
