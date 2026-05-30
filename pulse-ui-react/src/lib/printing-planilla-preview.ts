import {
  IMP_ACTUAL_KEY,
  IMP_ESTADO_KEY,
  IMP_TURNOS_KEY,
  accumulatePrintingFromJson,
  bootstrapPrintingFormState,
  parsePrintingTurnoActual,
  parsePrintingTurnos,
  printingTurnoResumen,
  readEstadoArea,
  turnoProduccionTotals,
  type PrintingTurnoEntry,
} from "@/pages/axones/printing-turnos"
import {
  personnelLinesFromPrintingTurno,
  turnoGrupoLabelPrinting,
} from "@/pages/axones/printing-shift-history"
import { formatHmsFromSeconds, printingMesBandFromWorkOrderRow } from "@/lib/printing-mes-band-status"

export const PRINTING_PLANILLA_PREVIEW_STORAGE_PREFIX = "axones.printing.planilla-preview."

const ENTRADA_SLOTS = 26
const SALIDA_SLOTS = 22

export type PrintingPlanillaSheet = {
  turno_id: string
  turno_label: string
  turno_diurno: boolean
  turno_nocturno: boolean
  turno_grupo: "1" | "2" | "3" | ""
  work_order_code: string
  product: string | null
  operador: string
  ayudante: string
  supervisor: string
  maquina_header: string
  maquina_numero: string
  maquina_sidebar: string
  fecha_display: string
  fecha_d: string
  fecha_m: string
  fecha_a: string
  hora_inicio: string
  hora_arranque: string
  apertura: string
  cierre: string
  num_pesaje: string
  entrada_laminas: string[]
  total_entrada_kg: number
  salida_bobinas: string[]
  total_salida_kg: number
  num_bobinas: number
  merma_kg: number
  metraje_m: number
  scrap_transparente_kg: number
  scrap_impreso_kg: number
  tiempo_muerto: string
  tiempo_efectivo: string
  tiempo_preparacion: string
  paradas_lines: string[]
  is_current: boolean
}

export type PrintingPlanillaTurnoRow = {
  id: string
  label: string
  closed_at: string | null
  operador: string
  personnel: string[]
  entrada_kg: number
  salida_kg: number
  scrap_kg: number
  scrap_transparente_kg: number
  scrap_impreso_kg: number
  bobinas_salida: number
  effective_hms: string
  dead_hms: string
  total_hms: string
  is_current: boolean
}

export type PrintingPlanillaPreviewPayload = {
  generated_at: string
  work_order_id: number
  work_order_code: string
  client: string | null
  product: string | null
  pedido_kg: number
  acumulado: {
    producido_kg: number
    entrada_kg: number
    scrap_kg: number
    turnos_registrados: number
    faltante_kg: number
    effective_hms: string
    dead_hms: string
    total_hms: string
    ultimo_turno_label: string
  }
  turnos: PrintingPlanillaTurnoRow[]
  sum_check: {
    turnos_salida_sum: number
    turnos_entrada_sum: number
    turnos_scrap_sum: number
    turnos_effective_sec_sum: number
    matches_acumulado: boolean
  }
  bandeja: {
    producido_kg: number
    effective_hms: string
    workflow: string
    timer_label: string
  } | null
  /** Una hoja física por turno (o fallback único). */
  sheets: PrintingPlanillaSheet[]
}

export type PrintingPlanillaPreviewSource = {
  work_order_id: number
  work_order_code: string
  client?: string | null
  product?: string | null
  form: Record<string, unknown>
  technical_document?: { form?: Record<string, unknown> } | null
  board_stage?: string | null
  nowMs?: number
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v)
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."))
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }
  return 0
}

function readStoredProducidoKg(form: Record<string, unknown>): number {
  return readNumber(form.impAcumuladoProducidoKg)
}

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v.trim()
  return ""
}

function fmtKgCell(v: unknown): string {
  const s = readNumberString(v)
  if (!s) return ""
  const n = readNumber(s)
  if (n <= 0) return ""
  if (s.includes(",")) return s
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2).replace(".", ",")
}

function collectKgFromSlots(slots: string[]): string[] {
  const out: string[] = []
  for (const raw of slots) {
    const cell = fmtKgCell(raw)
    if (cell) out.push(cell)
  }
  return out
}

function flattenEntradaKg(t: PrintingTurnoEntry): string[] {
  const out: string[] = []
  for (const c of t.capturas ?? []) {
    out.push(...collectKgFromSlots(c.entradaBobinasKg))
  }
  out.push(...collectKgFromSlots(t.entradaBobinasKg))
  return out
}

function flattenSalidaKg(t: PrintingTurnoEntry): string[] {
  const out: string[] = []
  for (const c of t.capturas ?? []) {
    out.push(...collectKgFromSlots(c.salidaBobinasKg))
  }
  out.push(...collectKgFromSlots(t.salidaBobinasKg))
  return out
}

function sumKgStrings(values: string[]): number {
  return values.reduce((acc, v) => acc + readNumber(v.replace(",", ".")), 0)
}

function fmtTimeFromIso(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleTimeString("es-VE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } catch {
    return ""
  }
}

function fmtTimeFromMs(ms: number): string {
  if (!ms || ms <= 0) return ""
  try {
    return new Date(ms).toLocaleTimeString("es-VE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } catch {
    return ""
  }
}

function fmtDateParts(iso: string | null | undefined): { d: string; m: string; a: string; display: string } {
  if (!iso) return { d: "", m: "", a: "", display: "" }
  try {
    const dt = new Date(iso)
    const d = String(dt.getDate())
    const m = String(dt.getMonth() + 1)
    const a = String(dt.getFullYear()).slice(-2)
    return { d, m, a, display: `${d}, ${m}, ${a}` }
  } catch {
    return { d: "", m: "", a: "", display: "" }
  }
}

function fmtDatePartsFromMs(ms: number): { d: string; m: string; a: string; display: string } {
  if (!ms || ms <= 0) return { d: "", m: "", a: "", display: "" }
  return fmtDateParts(new Date(ms).toISOString())
}

function grupoToPaper(grupo: string): "1" | "2" | "3" | "" {
  if (grupo === "A") return "1"
  if (grupo === "B") return "2"
  if (grupo === "C") return "3"
  return ""
}

function buildParadasLines(t: PrintingTurnoEntry): string[] {
  const pauses = Array.isArray(t.timer.pauses) ? t.timer.pauses : []
  return pauses
    .map((p) => {
      const reason = readString(p.reason).trim()
      const obs = readString(p.obs).trim()
      const dur = readNumber(p.duration_sec)
      const durHms = dur > 0 ? formatHmsFromSeconds(dur) : ""
      const parts = [reason, obs, durHms ? `(${durHms})` : ""].filter(Boolean)
      return parts.join(" · ")
    })
    .filter(Boolean)
}

function padSeries(values: string[], size: number): string[] {
  const out = values.slice(0, size)
  while (out.length < size) out.push("")
  return out
}

function buildSheetFromTurno(
  t: PrintingTurnoEntry,
  ctx: {
    work_order_code: string
    product: string | null
    form: Record<string, unknown>
    is_current: boolean
  },
): PrintingPlanillaSheet {
  const res = printingTurnoResumen(t)
  const tot = turnoProduccionTotals(t)
  const entradaFlat = flattenEntradaKg(t)
  const salidaFlat = flattenSalidaKg(t)
  const totalEntrada = tot.entradaKg > 0 ? tot.entradaKg : sumKgStrings(entradaFlat)
  const totalSalida = tot.salidaKg > 0 ? tot.salidaKg : sumKgStrings(salidaFlat)
  const scrapT = readNumber(t.scrapTransparenteKg)
  const scrapI = readNumber(t.scrapImpresoKg)
  const merma = tot.scrapKg > 0 ? tot.scrapKg : scrapT + scrapI
  const startedIso = t.started_at || (t.timer.startedAtMs > 0 ? new Date(t.timer.startedAtMs).toISOString() : null)
  const maquinaSidebar = readString(ctx.form.maquina).trim()
  const pinon = readString(ctx.form.pinonImp).trim()
  const maquinaNumero = pinon || maquinaSidebar
  const maquinaHeader = maquinaSidebar || (pinon ? `Impresora ${pinon}` : "Impresora")
  const fecha = fmtDateParts(startedIso)
  const fechaFromMs =
    fecha.display ? fecha : fmtDatePartsFromMs(t.timer.startedAtMs)

  return {
    turno_id: t.id,
    turno_label: turnoGrupoLabelPrinting(t.turno, t.grupo),
    turno_diurno: t.turno === "diurno",
    turno_nocturno: t.turno === "nocturno",
    turno_grupo: grupoToPaper(t.grupo),
    work_order_code: ctx.work_order_code,
    product: ctx.product,
    operador: t.operador.trim(),
    ayudante: t.ayudante.trim(),
    supervisor: t.supervisor.trim(),
    maquina_header: maquinaHeader,
    maquina_numero: maquinaNumero,
    maquina_sidebar: maquinaSidebar,
    fecha_display: fechaFromMs.display,
    fecha_d: fechaFromMs.d,
    fecha_m: fechaFromMs.m,
    fecha_a: fechaFromMs.a,
    hora_inicio: fmtTimeFromIso(startedIso),
    hora_arranque: fmtTimeFromMs(t.timer.lastResumeAtMs || t.timer.startedAtMs),
    apertura: fmtTimeFromIso(startedIso),
    cierre: fmtTimeFromIso(t.closed_at),
    num_pesaje: "",
    entrada_laminas: padSeries(entradaFlat, ENTRADA_SLOTS),
    total_entrada_kg: totalEntrada,
    salida_bobinas: padSeries(salidaFlat, SALIDA_SLOTS),
    total_salida_kg: totalSalida,
    num_bobinas: res.numBobinasSalida,
    merma_kg: merma,
    metraje_m: res.metrajeTotalM,
    scrap_transparente_kg: scrapT,
    scrap_impreso_kg: scrapI,
    tiempo_muerto: formatHmsFromSeconds(readNumber(t.timer.deadAccSec)),
    tiempo_efectivo: formatHmsFromSeconds(readNumber(t.timer.effectiveAccSec)),
    tiempo_preparacion: "",
    paradas_lines: buildParadasLines(t),
    is_current: ctx.is_current,
  }
}

function buildSheetFromFormFlat(
  form: Record<string, unknown>,
  ctx: {
    work_order_code: string
    product: string | null
    acumulado: PrintingPlanillaPreviewPayload["acumulado"]
  },
): PrintingPlanillaSheet {
  const kgIn = readNumber(form.kgIngresadoImp)
  const kgOut = readNumber(form.kgSalidaImp)
  const maquinaSidebar = readString(form.maquina).trim()
  const pinon = readString(form.pinonImp).trim()
  const maquinaNumero = pinon || maquinaSidebar
  const maquinaHeader = maquinaSidebar || (pinon ? `Impresora ${pinon}` : "Impresora")

  return {
    turno_id: "flat",
    turno_label: "Sin turno guardado",
    turno_diurno: readString(form.impTurno) === "diurno",
    turno_nocturno: readString(form.impTurno) === "nocturno",
    turno_grupo: grupoToPaper(readString(form.impGrupo)),
    work_order_code: ctx.work_order_code,
    product: ctx.product,
    operador: readString(form.impOperador).trim(),
    ayudante: readString(form.impAyudante).trim(),
    supervisor: readString(form.impSupervisor).trim(),
    maquina_header: maquinaHeader,
    maquina_numero: maquinaNumero,
    maquina_sidebar: maquinaSidebar,
    fecha_display: "",
    fecha_d: "",
    fecha_m: "",
    fecha_a: "",
    hora_inicio: "",
    hora_arranque: "",
    apertura: "",
    cierre: "",
    num_pesaje: "",
    entrada_laminas: padSeries(kgIn > 0 ? [fmtKgCell(kgIn)] : [], ENTRADA_SLOTS),
    total_entrada_kg: kgIn > 0 ? kgIn : ctx.acumulado.entrada_kg,
    salida_bobinas: padSeries(kgOut > 0 ? [fmtKgCell(kgOut)] : [], SALIDA_SLOTS),
    total_salida_kg: kgOut > 0 ? kgOut : ctx.acumulado.producido_kg,
    num_bobinas: kgOut > 0 ? 1 : 0,
    merma_kg: ctx.acumulado.scrap_kg,
    metraje_m: 0,
    scrap_transparente_kg: readNumber(form.impScrapTransparenteKg),
    scrap_impreso_kg: readNumber(form.impScrapImpresoKg),
    tiempo_muerto: ctx.acumulado.dead_hms,
    tiempo_efectivo: ctx.acumulado.effective_hms,
    tiempo_preparacion: "",
    paradas_lines: [],
    is_current: false,
  }
}

function turnoToPreviewRow(t: PrintingTurnoEntry, isCurrent: boolean): PrintingPlanillaTurnoRow {
  const tot = turnoProduccionTotals(t)
  const res = printingTurnoResumen(t)
  const eff = readNumber(t.timer.effectiveAccSec)
  const dead = readNumber(t.timer.deadAccSec)
  return {
    id: t.id,
    label: turnoGrupoLabelPrinting(t.turno, t.grupo),
    closed_at: t.closed_at ?? null,
    operador: t.operador.trim(),
    personnel: personnelLinesFromPrintingTurno(t),
    entrada_kg: tot.entradaKg,
    salida_kg: tot.salidaKg,
    scrap_kg: tot.scrapKg,
    scrap_transparente_kg: readNumber(t.scrapTransparenteKg),
    scrap_impreso_kg: readNumber(t.scrapImpresoKg),
    bobinas_salida: res.numBobinasSalida,
    effective_hms: formatHmsFromSeconds(eff),
    dead_hms: formatHmsFromSeconds(dead),
    total_hms: formatHmsFromSeconds(eff + dead),
    is_current: isCurrent,
  }
}

function ultimoCierreLabel(cerrados: PrintingTurnoEntry[]): string {
  const ultimo = [...cerrados].sort((a, b) =>
    readString(b.closed_at ?? "").localeCompare(readString(a.closed_at ?? "")),
  )[0]
  if (!ultimo?.closed_at) {
    return cerrados.length > 0 ? "Turno cerrado" : "Sin producción previa"
  }
  try {
    return `Último cierre: ${new Date(ultimo.closed_at).toLocaleString("es-VE")}`
  } catch {
    return "Turno cerrado"
  }
}

export function buildPrintingPlanillaPreviewPayload(
  source: PrintingPlanillaPreviewSource,
): PrintingPlanillaPreviewPayload {
  const nowMs = source.nowMs ?? Date.now()
  const booted = bootstrapPrintingFormState(source.form)
  let cerrados = parsePrintingTurnos(booted[IMP_TURNOS_KEY])
  let actual = parsePrintingTurnoActual(booted[IMP_ACTUAL_KEY])
  if (actual?.closed_at) {
    if (!cerrados.some((t) => t.id === actual!.id)) {
      cerrados = [...cerrados, actual]
    }
    actual = null
  }

  const acum = accumulatePrintingFromJson(cerrados, actual)
  const storedKg = readStoredProducidoKg(booted)
  const producidoKg = Math.max(acum.producidoKg, storedKg)
  const pedidoKg = readNumber(booted.pedidoKg)

  let effectiveSec = 0
  let deadSec = 0
  for (const t of cerrados) {
    effectiveSec += readNumber(t.timer.effectiveAccSec)
    deadSec += readNumber(t.timer.deadAccSec)
  }
  if (actual) {
    effectiveSec += readNumber(actual.timer.effectiveAccSec)
    deadSec += readNumber(actual.timer.deadAccSec)
  }

  const turnos: PrintingPlanillaTurnoRow[] = [
    ...cerrados.map((t) => turnoToPreviewRow(t, false)),
    ...(actual ? [turnoToPreviewRow(actual, true)] : []),
  ]

  const turnosSalidaSum = turnos.reduce((acc, t) => acc + t.salida_kg, 0)
  const turnosEntradaSum = turnos.reduce((acc, t) => acc + t.entrada_kg, 0)
  const turnosScrapSum = turnos.reduce((acc, t) => acc + t.scrap_kg, 0)
  const turnosEffectiveSecSum = turnos.reduce((acc, t) => {
    const parts = t.effective_hms.split(":").map(Number)
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return acc
    return acc + parts[0] * 3600 + parts[1] * 60 + parts[2]
  }, 0)

  const matchesAcumulado =
    Math.abs(turnosSalidaSum - producidoKg) < 0.02 &&
    Math.abs(turnosEntradaSum - acum.entradaKg) < 0.02 &&
    Math.abs(turnosScrapSum - acum.scrapKg) < 0.02

  const mesRow = {
    technical_document: source.technical_document ?? { form: source.form },
    board_stage: source.board_stage ?? "impresion",
  }
  const mes = printingMesBandFromWorkOrderRow(mesRow, nowMs)

  const sheetCtx = {
    work_order_code: source.work_order_code,
    product: source.product?.trim() ? source.product.trim() : null,
    form: booted,
  }
  const sheets: PrintingPlanillaSheet[] = [
    ...cerrados.map((t) => buildSheetFromTurno(t, { ...sheetCtx, is_current: false })),
    ...(actual ? [buildSheetFromTurno(actual, { ...sheetCtx, is_current: true })] : []),
  ]
  const acumuladoBlock = {
    producido_kg: producidoKg,
    entrada_kg: acum.entradaKg,
    scrap_kg: acum.scrapKg,
    turnos_registrados: acum.turnosRegistrados,
    faltante_kg: Math.max(0, pedidoKg - producidoKg),
    effective_hms: formatHmsFromSeconds(effectiveSec),
    dead_hms: formatHmsFromSeconds(deadSec),
    total_hms: formatHmsFromSeconds(effectiveSec + deadSec),
    ultimo_turno_label: actual ? "Turno en curso" : ultimoCierreLabel(cerrados),
  }
  if (sheets.length === 0) {
    sheets.push(
      buildSheetFromFormFlat(booted, {
        work_order_code: source.work_order_code,
        product: sheetCtx.product,
        acumulado: acumuladoBlock,
      }),
    )
  }

  return {
    generated_at: new Date(nowMs).toISOString(),
    work_order_id: source.work_order_id,
    work_order_code: source.work_order_code,
    client: source.client?.trim() ? source.client.trim() : null,
    product: source.product?.trim() ? source.product.trim() : null,
    pedido_kg: pedidoKg,
    acumulado: acumuladoBlock,
    turnos,
    sum_check: {
      turnos_salida_sum: turnosSalidaSum,
      turnos_entrada_sum: turnosEntradaSum,
      turnos_scrap_sum: turnosScrapSum,
      turnos_effective_sec_sum: turnosEffectiveSecSum,
      matches_acumulado: matchesAcumulado,
    },
    bandeja: mes
      ? {
          producido_kg: mes.producidoKg ?? producidoKg,
          effective_hms: mes.effectiveHms ?? formatHmsFromSeconds(effectiveSec),
          workflow: mes.workflow,
          timer_label: mes.contextLine,
        }
      : null,
    sheets,
  }
}

export function persistPrintingPlanillaPreview(payload: PrintingPlanillaPreviewPayload): boolean {
  try {
    localStorage.setItem(
      `${PRINTING_PLANILLA_PREVIEW_STORAGE_PREFIX}${payload.work_order_id}`,
      JSON.stringify(payload),
    )
    return true
  } catch {
    return false
  }
}

export function openPrintingPlanillaPreviewWindow(workOrderId: number): void {
  const url = `${window.location.origin}/axones/ordenes-trabajo/${encodeURIComponent(
    String(workOrderId),
  )}/impresion/planilla/vista-previa`
  window.open(url, "_blank", "noopener,noreferrer")
}

export function openPrintingPlanillaPreviewFromPayload(payload: PrintingPlanillaPreviewPayload): boolean {
  if (!persistPrintingPlanillaPreview(payload)) return false
  openPrintingPlanillaPreviewWindow(payload.work_order_id)
  return true
}

/** Planilla física solo tras «Finalizar área de impresión» (`impEstadoArea`). */
export function canOpenPrintingPlanillaPreview(form: Record<string, unknown> | null | undefined): boolean {
  if (!form) return false
  const booted = bootstrapPrintingFormState(form)
  return readEstadoArea(booted[IMP_ESTADO_KEY]) === "finalizada"
}

export function openPrintingPlanillaPreviewFromSource(source: PrintingPlanillaPreviewSource): boolean {
  if (!canOpenPrintingPlanillaPreview(source.form)) return false
  const payload = buildPrintingPlanillaPreviewPayload(source)
  return openPrintingPlanillaPreviewFromPayload(payload)
}
