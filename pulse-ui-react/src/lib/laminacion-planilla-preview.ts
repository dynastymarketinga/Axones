import { appAbsoluteUrl } from "@/lib/app-base-path"
import { formatHmsFromSeconds, laminacionMesBandFromWorkOrderRow } from "@/lib/laminacion-mes-band-status"
import { parseBobinaKgSlotNumber } from "@/lib/bobina-kg-slot"
import {
  LAM_ACTUAL_KEY,
  LAM_ESTADO_KEY,
  LAM_TURNOS_KEY,
  accumulateLaminacionFromJson,
  bootstrapLaminacionFormState,
  parseLaminacionTurnoActual,
  parseLaminacionTurnos,
  readLaminacionEstadoArea,
  readLamNumber,
  sumEntradaImpresaKgTurno,
  sumEntradaVirgenKgTurno,
  sumSalidaKgTurno,
  sumScrapKgTurno,
  type LaminacionTurnoEntry,
} from "@/pages/axones/laminacion-turnos"

export const LAMINACION_PLANILLA_PREVIEW_STORAGE_PREFIX = "axones.laminacion.planilla-preview."

const ENTRADA_IMPRESA_SLOTS = 24
const ENTRADA_VIRGEN_SLOTS = 24
const SALIDA_SLOTS = 22
const SALIDA_LEFT = 11

export type LaminacionPlanillaSheet = {
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
  hora_final: string
  apertura: string
  cierre: string
  num_pesaje: string
  entrada_impresa: string[]
  total_entrada_impresa_kg: number
  entrada_virgen: string[]
  total_entrada_virgen_kg: number
  salida_bobinas: string[]
  total_salida_kg: number
  num_bobinas: number
  merma_kg: number
  metraje_m: number
  scrap_transparente_kg: number
  scrap_impreso_kg: number
  scrap_laminado_kg: number
  tiempo_muerto: string
  tiempo_efectivo: string
  tiempo_preparacion: string
  paradas_lines: string[]
  is_current: boolean
}

export type LaminacionPlanillaTurnoRow = {
  id: string
  label: string
  closed_at: string | null
  operador: string
  entrada_impresa_kg: number
  entrada_virgen_kg: number
  salida_kg: number
  scrap_kg: number
  bobinas_salida: number
  effective_hms: string
  dead_hms: string
  total_hms: string
  is_current: boolean
}

export type LaminacionPlanillaPreviewPayload = {
  generated_at: string
  work_order_id: number
  work_order_code: string
  client: string | null
  product: string | null
  pedido_kg: number
  acumulado: {
    producido_kg: number
    entrada_impresa_kg: number
    entrada_virgen_kg: number
    scrap_kg: number
    turnos_registrados: number
    faltante_kg: number
    effective_hms: string
    dead_hms: string
    total_hms: string
    ultimo_turno_label: string
  }
  turnos: LaminacionPlanillaTurnoRow[]
  sum_check: {
    turnos_salida_sum: number
    turnos_entrada_impresa_sum: number
    turnos_entrada_virgen_sum: number
    turnos_scrap_sum: number
    matches_acumulado: boolean
  }
  bandeja: {
    producido_kg: number
    effective_hms: string
    workflow: string
    timer_label: string
  } | null
  sheets: LaminacionPlanillaSheet[]
}

export type LaminacionPlanillaPreviewSource = {
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
  return readNumber(form.lamAcumuladoProducidoKg)
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

function countSalidaBobinas(slots: string[]): number {
  return slots.filter((v) => readLamNumber(v) > 0).length
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

function turnoGrupoLabel(turno: string, grupo: string): string {
  const t = turno === "diurno" ? "Diurno" : turno === "nocturno" ? "Nocturno" : turno.trim() || "—"
  const g = grupo === "A" || grupo === "B" || grupo === "C" ? `Grupo ${grupo}` : grupo.trim() || "—"
  return `${t} · ${g}`
}

function buildParadasLines(t: LaminacionTurnoEntry): string[] {
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

function readMaquina(form: Record<string, unknown>): string {
  return readString(form.lamMaquina).trim() || readString(form.maquina).trim()
}

function buildSheetFromTurno(
  t: LaminacionTurnoEntry,
  ctx: {
    work_order_code: string
    product: string | null
    form: Record<string, unknown>
    is_current: boolean
  },
): LaminacionPlanillaSheet {
  const entradaImpresaFlat = collectKgFromSlots(t.entradaImpresaBobinasKg)
  const entradaVirgenFlat = collectKgFromSlots(t.entradaVirgenBobinasKg)
  const salidaFlat = collectKgFromSlots(t.salidaBobinasKg)
  const totalEntradaImpresa = sumEntradaImpresaKgTurno(t)
  const totalEntradaVirgen = sumEntradaVirgenKgTurno(t)
  const totalSalida = sumSalidaKgTurno(t)
  const scrapT = readLamNumber(t.scrapTransparenteKg)
  const scrapI = readLamNumber(t.scrapImpresoKg)
  const scrapL = readLamNumber(t.scrapLaminadoKg)
  const merma = sumScrapKgTurno(t)
  const startedIso = t.started_at || (t.timer.startedAtMs > 0 ? new Date(t.timer.startedAtMs).toISOString() : null)
  const maquinaSidebar = readMaquina(ctx.form)
  const maquinaHeader = maquinaSidebar ? `Laminadora ${maquinaSidebar}` : "Laminadora"
  const fecha = fmtDateParts(startedIso)
  const fechaFromMs = fecha.display ? fecha : fmtDatePartsFromMs(t.timer.startedAtMs)

  return {
    turno_id: t.id,
    turno_label: turnoGrupoLabel(t.turno, t.grupo),
    turno_diurno: t.turno === "diurno",
    turno_nocturno: t.turno === "nocturno",
    turno_grupo: grupoToPaper(t.grupo),
    work_order_code: ctx.work_order_code,
    product: ctx.product,
    operador: t.operador.trim(),
    ayudante: t.ayudante.trim(),
    supervisor: t.supervisor.trim(),
    maquina_header: maquinaHeader,
    maquina_numero: maquinaSidebar,
    maquina_sidebar: maquinaSidebar,
    fecha_display: fechaFromMs.display,
    fecha_d: fechaFromMs.d,
    fecha_m: fechaFromMs.m,
    fecha_a: fechaFromMs.a,
    hora_inicio: fmtTimeFromIso(startedIso),
    hora_arranque: fmtTimeFromMs(t.timer.lastResumeAtMs || t.timer.startedAtMs),
    hora_final: fmtTimeFromIso(t.closed_at),
    apertura: fmtTimeFromIso(startedIso),
    cierre: fmtTimeFromIso(t.closed_at),
    num_pesaje: "",
    entrada_impresa: padSeries(entradaImpresaFlat, ENTRADA_IMPRESA_SLOTS),
    total_entrada_impresa_kg: totalEntradaImpresa,
    entrada_virgen: padSeries(entradaVirgenFlat, ENTRADA_VIRGEN_SLOTS),
    total_entrada_virgen_kg: totalEntradaVirgen,
    salida_bobinas: padSeries(salidaFlat, SALIDA_SLOTS),
    total_salida_kg: totalSalida,
    num_bobinas: countSalidaBobinas(t.salidaBobinasKg),
    merma_kg: merma,
    metraje_m: readLamNumber(t.metrajeProduccion),
    scrap_transparente_kg: scrapT,
    scrap_impreso_kg: scrapI,
    scrap_laminado_kg: scrapL,
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
    acumulado: LaminacionPlanillaPreviewPayload["acumulado"]
  },
): LaminacionPlanillaSheet {
  const maquinaSidebar = readMaquina(form)

  return {
    turno_id: "flat",
    turno_label: "Sin turno guardado",
    turno_diurno: readString(form.lamTurno) === "diurno",
    turno_nocturno: readString(form.lamTurno) === "nocturno",
    turno_grupo: grupoToPaper(readString(form.lamGrupo)),
    work_order_code: ctx.work_order_code,
    product: ctx.product,
    operador: readString(form.lamOperador).trim(),
    ayudante: readString(form.lamAyudante).trim(),
    supervisor: readString(form.lamSupervisor).trim(),
    maquina_header: maquinaSidebar ? `Laminadora ${maquinaSidebar}` : "Laminadora",
    maquina_numero: maquinaSidebar,
    maquina_sidebar: maquinaSidebar,
    fecha_display: "",
    fecha_d: "",
    fecha_m: "",
    fecha_a: "",
    hora_inicio: "",
    hora_arranque: "",
    hora_final: "",
    apertura: "",
    cierre: "",
    num_pesaje: "",
    entrada_impresa: padSeries([], ENTRADA_IMPRESA_SLOTS),
    total_entrada_impresa_kg: ctx.acumulado.entrada_impresa_kg,
    entrada_virgen: padSeries([], ENTRADA_VIRGEN_SLOTS),
    total_entrada_virgen_kg: ctx.acumulado.entrada_virgen_kg,
    salida_bobinas: padSeries([], SALIDA_SLOTS),
    total_salida_kg: ctx.acumulado.producido_kg,
    num_bobinas: 0,
    merma_kg: ctx.acumulado.scrap_kg,
    metraje_m: readLamNumber(form.lamMetrajeProduccion),
    scrap_transparente_kg: readLamNumber(form.lamScrapTransparenteKg),
    scrap_impreso_kg: readLamNumber(form.lamScrapImpresoKg),
    scrap_laminado_kg: readLamNumber(form.lamScrapLaminadoKg),
    tiempo_muerto: ctx.acumulado.dead_hms,
    tiempo_efectivo: ctx.acumulado.effective_hms,
    tiempo_preparacion: "",
    paradas_lines: [],
    is_current: false,
  }
}

function turnoToPreviewRow(t: LaminacionTurnoEntry, isCurrent: boolean): LaminacionPlanillaTurnoRow {
  const eff = readNumber(t.timer.effectiveAccSec)
  const dead = readNumber(t.timer.deadAccSec)
  return {
    id: t.id,
    label: turnoGrupoLabel(t.turno, t.grupo),
    closed_at: t.closed_at ?? null,
    operador: t.operador.trim(),
    entrada_impresa_kg: sumEntradaImpresaKgTurno(t),
    entrada_virgen_kg: sumEntradaVirgenKgTurno(t),
    salida_kg: sumSalidaKgTurno(t),
    scrap_kg: sumScrapKgTurno(t),
    bobinas_salida: countSalidaBobinas(t.salidaBobinasKg),
    effective_hms: formatHmsFromSeconds(eff),
    dead_hms: formatHmsFromSeconds(dead),
    total_hms: formatHmsFromSeconds(eff + dead),
    is_current: isCurrent,
  }
}

function ultimoCierreLabel(cerrados: LaminacionTurnoEntry[]): string {
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

export function buildLaminacionPlanillaPreviewPayload(
  source: LaminacionPlanillaPreviewSource,
): LaminacionPlanillaPreviewPayload {
  const nowMs = source.nowMs ?? Date.now()
  const booted = bootstrapLaminacionFormState(source.form)
  let cerrados = parseLaminacionTurnos(booted[LAM_TURNOS_KEY])
  let actual = parseLaminacionTurnoActual(booted[LAM_ACTUAL_KEY])
  if (actual?.closed_at) {
    if (!cerrados.some((t) => t.id === actual!.id)) {
      cerrados = [...cerrados, actual]
    }
    actual = null
  }

  const acum = accumulateLaminacionFromJson(cerrados, actual)
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

  const turnos: LaminacionPlanillaTurnoRow[] = [
    ...cerrados.map((t) => turnoToPreviewRow(t, false)),
    ...(actual ? [turnoToPreviewRow(actual, true)] : []),
  ]

  const turnosSalidaSum = turnos.reduce((acc, t) => acc + t.salida_kg, 0)
  const turnosEntradaImpresaSum = turnos.reduce((acc, t) => acc + t.entrada_impresa_kg, 0)
  const turnosEntradaVirgenSum = turnos.reduce((acc, t) => acc + t.entrada_virgen_kg, 0)
  const turnosScrapSum = turnos.reduce((acc, t) => acc + t.scrap_kg, 0)

  const matchesAcumulado =
    Math.abs(turnosSalidaSum - producidoKg) < 0.02 &&
    Math.abs(turnosEntradaImpresaSum - acum.entradaImpresaKg) < 0.02 &&
    Math.abs(turnosEntradaVirgenSum - acum.entradaVirgenKg) < 0.02 &&
    Math.abs(turnosScrapSum - acum.scrapKg) < 0.02

  const mesRow = {
    technical_document: source.technical_document ?? { form: source.form },
    board_stage: source.board_stage ?? "laminacion",
  }
  const mes = laminacionMesBandFromWorkOrderRow(mesRow, nowMs)

  const sheetCtx = {
    work_order_code: source.work_order_code,
    product: source.product?.trim() ? source.product.trim() : null,
    form: booted,
  }
  const sheets: LaminacionPlanillaSheet[] = [
    ...cerrados.map((t) => buildSheetFromTurno(t, { ...sheetCtx, is_current: false })),
    ...(actual ? [buildSheetFromTurno(actual, { ...sheetCtx, is_current: true })] : []),
  ]
  const acumuladoBlock = {
    producido_kg: producidoKg,
    entrada_impresa_kg: acum.entradaImpresaKg,
    entrada_virgen_kg: acum.entradaVirgenKg,
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
      turnos_entrada_impresa_sum: turnosEntradaImpresaSum,
      turnos_entrada_virgen_sum: turnosEntradaVirgenSum,
      turnos_scrap_sum: turnosScrapSum,
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

export function persistLaminacionPlanillaPreview(payload: LaminacionPlanillaPreviewPayload): boolean {
  try {
    localStorage.setItem(
      `${LAMINACION_PLANILLA_PREVIEW_STORAGE_PREFIX}${payload.work_order_id}`,
      JSON.stringify(payload),
    )
    return true
  } catch {
    return false
  }
}

export function openLaminacionPlanillaPreviewWindow(workOrderId: number): void {
  const url = appAbsoluteUrl(
    `/ordenes-trabajo/${encodeURIComponent(String(workOrderId))}/laminacion/planilla/vista-previa`,
  )
  window.open(url, "_blank", "noopener,noreferrer")
}

export function openLaminacionPlanillaPreviewFromPayload(payload: LaminacionPlanillaPreviewPayload): boolean {
  if (!persistLaminacionPlanillaPreview(payload)) return false
  openLaminacionPlanillaPreviewWindow(payload.work_order_id)
  return true
}

/** Planilla física solo tras «Finalizar área de laminación» (`lamEstadoArea`). */
export function canOpenLaminacionPlanillaPreview(form: Record<string, unknown> | null | undefined): boolean {
  if (!form) return false
  const booted = bootstrapLaminacionFormState(form)
  return readLaminacionEstadoArea(booted[LAM_ESTADO_KEY]) === "finalizada"
}

export function openLaminacionPlanillaPreviewFromSource(source: LaminacionPlanillaPreviewSource): boolean {
  if (!canOpenLaminacionPlanillaPreview(source.form)) return false
  const payload = buildLaminacionPlanillaPreviewPayload(source)
  return openLaminacionPlanillaPreviewFromPayload(payload)
}

export { SALIDA_LEFT }
