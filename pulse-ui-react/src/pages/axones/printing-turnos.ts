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
}

export const IMP_TURNOS_KEY = "impTurnosImpresion"
export const IMP_ACTUAL_KEY = "impTurnoActual"
export const IMP_ESTADO_KEY = "impEstadoArea"

/** Casillas por rejilla: ingreso material virgen y salida bobina impresa (OT impresión). */
export const IMP_BOBINAS_SLOTS = 30

/** Borrador de campos solo para el envío a almacén (materiales y referencia). Los Kg y motivo van en el formulario del turno (`impDevolucion*`). */
export type WarehouseReturnDraft = {
  buenaMaterialId: string
  rechazadaMaterialId: string
  bobinaCode: string
  rechazadaObs: string
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
}

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
  devolucionRechazadaKg: string
  /** id del motivo (PRINTING_REJECT_REASONS) o texto libre si aplica */
  devolucionRechazadaMotivo: string
  scrapTransparenteKg: string
  scrapImpresoKg: string
  mermaKg: string
  metrajeProduccion: string
  observaciones: string
  timer: PrintingTurnTimer
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
  }
}

export function emptyNumericSeries(size: number): string[] {
  return Array.from({ length: size }, () => "")
}

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
    devolucionRechazadaMotivo: "",
    scrapTransparenteKg: "0",
    scrapImpresoKg: "0",
    mermaKg: "",
    metrajeProduccion: "",
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
  }
}

function getNumericSeriesForm(form: Record<string, unknown>, key: string, size: number): string[] {
  const raw = form[key]
  if (!Array.isArray(raw)) return emptyNumericSeries(size)
  const out = raw.slice(0, size).map((v) => readNumberString(v))
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
    devolucionRechazadaKg: readNumberString(o.devolucionRechazadaKg),
    devolucionRechazadaMotivo: readString(o.devolucionRechazadaMotivo),
    scrapTransparenteKg: readNumberString(o.scrapTransparenteKg),
    scrapImpresoKg: readNumberString(o.scrapImpresoKg),
    mermaKg: readNumberString(o.mermaKg),
    metrajeProduccion: readNumberString(o.metrajeProduccion),
    observaciones: readString(o.observaciones),
    timer: parseTimer(o.timer),
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
  if (readNumber(form.impDevolucionBuenaKg) > 0 || readNumber(form.impDevolucionRechazadaKg) > 0) return true

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
    devolucionRechazadaKg: readNumberString(form.impDevolucionRechazadaKg),
    devolucionRechazadaMotivo: readString(form.impDevolucionRechazadaMotivo),
    scrapTransparenteKg: readNumberString(form.impScrapTransparenteKg),
    scrapImpresoKg: readNumberString(form.impScrapImpresoKg),
    mermaKg: readNumberString(form.impMermaKg),
    metrajeProduccion: readNumberString(form.impMetrajeProduccion),
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
    impDevolucionRechazadaKg: t.devolucionRechazadaKg,
    impDevolucionRechazadaMotivo: t.devolucionRechazadaMotivo,
    impScrapTransparenteKg: t.scrapTransparenteKg,
    impScrapImpresoKg: t.scrapImpresoKg,
    impMermaKg: t.mermaKg,
    impMetrajeProduccion: t.metrajeProduccion,
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
    impDevolucionRechazadaMotivo: "",
    /** Tras "Enviar a almacén" en devoluciones: heurística para badge pendiente */
    impDevolucionesAlmacenUltimoEnvioMs: 0,
    impDevolucionesAlmacenSnapBuena: "",
    impDevolucionesAlmacenSnapRech: "",
    impScrapTransparenteKg: "0",
    impScrapImpresoKg: "0",
    impMermaKg: "",
    impMetrajeProduccion: "",
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

export function sumSalidaKg(t: PrintingTurnoEntry): number {
  return t.salidaBobinasKg.reduce((acc, v) => acc + readNumber(v), 0)
}

export function sumEntradaKg(t: PrintingTurnoEntry): number {
  return t.entradaBobinasKg.reduce((acc, v) => acc + readNumber(v), 0)
}

export function sumScrapKg(t: PrintingTurnoEntry): number {
  return readNumber(t.scrapTransparenteKg) + readNumber(t.scrapImpresoKg)
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
    producidoKg += sumSalidaKg(t)
    entradaKg += sumEntradaKg(t)
    scrapKg += sumScrapKg(t)
  }
  if (actual) {
    producidoKg += sumSalidaKg(actual)
    entradaKg += sumEntradaKg(actual)
    scrapKg += sumScrapKg(actual)
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
  return {
    ...timer,
    state: "stopped",
    effectiveAccSec: effective,
    deadAccSec: dead,
    pauseAtMs: 0,
    lastResumeAtMs: 0,
  }
}
