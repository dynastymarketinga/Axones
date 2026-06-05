import { appAbsoluteUrl } from "@/lib/app-base-path"
import { formatHmsFromSeconds, corteMesBandFromWorkOrderRow } from "@/lib/corte-mes-band-status"
import { parseBobinaKgSlotNumber } from "@/lib/bobina-kg-slot"
import {
  COR_ACTUAL_KEY,
  COR_ESTADO_KEY,
  COR_TURNOS_KEY,
  accumulateCorteFromJson,
  bootstrapCorteFormState,
  countRollosWithKg,
  getCorPaletas,
  parseCorteTurnoActual,
  parseCorteTurnos,
  readCorteEstadoArea,
  sumEntradaKgFromForm,
  sumSalidaKgFromClosedTurno,
  sumSalidaKgFromPaletas,
  type CorPaleta,
  type CorteTurnoEntry,
} from "@/pages/axones/corte-turnos"

export const CORTE_PLANILLA_PREVIEW_STORAGE_PREFIX = "axones.corte.planilla-preview."

const ENTRADA_SLOTS = 14
const PALETA_COLS = 5
const PALETA_ROWS = 5

export type CortePlanillaSheet = {
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
  entrada_bobinas: string[]
  total_entrada_kg: number
  paleta_grid: string[][]
  paleta_row_totals: string[]
  total_salida_kg: number
  num_bobinas: number
  num_paletas: number
  merma_kg: number
  metraje_m: number
  scrap_refile_kg: number
  scrap_impreso_kg: number
  scrap_laminado_kg: number
  tiempo_muerto: string
  tiempo_efectivo: string
  tiempo_preparacion: string
  paradas_lines: string[]
  is_current: boolean
}

export type CortePlanillaTurnoRow = {
  id: string
  label: string
  closed_at: string | null
  operador: string
  entrada_kg: number
  salida_kg: number
  scrap_kg: number
  rollos_salida: number
  paletas: number
  effective_hms: string
  dead_hms: string
  total_hms: string
  is_current: boolean
}

export type CortePlanillaPreviewPayload = {
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
  turnos: CortePlanillaTurnoRow[]
  sum_check: {
    turnos_salida_sum: number
    turnos_entrada_sum: number
    turnos_scrap_sum: number
    matches_acumulado: boolean
  }
  bandeja: {
    producido_kg: number
    effective_hms: string
    workflow: string
    timer_label: string
  } | null
  sheets: CortePlanillaSheet[]
}

export type CortePlanillaPreviewSource = {
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
  return readNumber(form.corAcumuladoProducidoKg)
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

function sumKgStrings(values: string[]): number {
  return values.reduce((acc, v) => acc + parseBobinaKgSlotNumber(v), 0)
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

function buildParadasLines(t: CorteTurnoEntry): string[] {
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
  return readString(form.corMaquina).trim() || readString(form.maquina).trim()
}

function flattenEntradaKg(t: CorteTurnoEntry): string[] {
  return collectKgFromSlots(t.entradaBobinasKg)
}

function buildPaletaGrid(paletas: CorPaleta[]): { grid: string[][]; rowTotals: string[] } {
  const grid: string[][] = Array.from({ length: PALETA_ROWS }, () =>
    Array.from({ length: PALETA_COLS }, () => ""),
  )
  const rowTotals: string[] = Array.from({ length: PALETA_ROWS }, () => "")

  for (let pIdx = 0; pIdx < Math.min(paletas.length, PALETA_ROWS); pIdx++) {
    const paleta = paletas[pIdx]
    const rollos = collectKgFromSlots(paleta.rollosKg)
    for (let c = 0; c < Math.min(rollos.length, PALETA_COLS); c++) {
      grid[pIdx][c] = rollos[c]
    }
    const total = sumSalidaKgFromPaletas([paleta])
    if (total > 0) {
      rowTotals[pIdx] = total % 1 === 0 ? String(Math.round(total)) : total.toFixed(2).replace(".", ",")
    }
  }

  return { grid, rowTotals }
}

function countRollosSalida(paletas: CorPaleta[]): number {
  return paletas.reduce((acc, p) => acc + countRollosWithKg(p), 0)
}

function sumEntradaKgTurno(t: CorteTurnoEntry): number {
  return sumKgStrings(flattenEntradaKg(t))
}

function sumScrapKgFromForm(form: Record<string, unknown>): number {
  return (
    readNumber(form.corScrapRefileKg) +
    readNumber(form.corScrapImpresoKg) +
    readNumber(form.corScrapMalCorteKg)
  )
}

function sumScrapKgTurno(t: CorteTurnoEntry, form: Record<string, unknown>): number {
  if (t.metrics?.scrap_total_kg) return readNumber(t.metrics.scrap_total_kg)
  return sumScrapKgFromForm(form)
}

function buildSheetFromTurno(
  t: CorteTurnoEntry,
  ctx: {
    work_order_code: string
    product: string | null
    form: Record<string, unknown>
    is_current: boolean
  },
): CortePlanillaSheet {
  const entradaFlat = flattenEntradaKg(t)
  const totalEntrada = sumEntradaKgTurno(t)
  const paletas = t.paletas ?? []
  const { grid, rowTotals } = buildPaletaGrid(paletas)
  const totalSalida = sumSalidaKgFromPaletas(paletas)
  const startedIso = t.started_at || (t.timer.startedAtMs > 0 ? new Date(t.timer.startedAtMs).toISOString() : null)
  const maquinaSidebar = readMaquina(ctx.form)
  const maquinaHeader = maquinaSidebar || "Permaco"
  const fecha = fmtDateParts(startedIso)
  const fechaFromMs = fecha.display ? fecha : fmtDatePartsFromMs(t.timer.startedAtMs)
  const merma = readNumber(t.kgMerma) || readNumber(ctx.form.kgMermaCorte)
  const metraje = readNumber(t.metraje) || readNumber(ctx.form.metrajeCorte)

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
    entrada_bobinas: padSeries(entradaFlat, ENTRADA_SLOTS),
    total_entrada_kg: totalEntrada,
    paleta_grid: grid,
    paleta_row_totals: rowTotals,
    total_salida_kg: totalSalida,
    num_bobinas: countRollosSalida(paletas),
    num_paletas: paletas.filter((p) => sumSalidaKgFromPaletas([p]) > 0).length,
    merma_kg: merma,
    metraje_m: metraje,
    scrap_refile_kg: readNumber(ctx.form.corScrapRefileKg),
    scrap_impreso_kg: readNumber(ctx.form.corScrapImpresoKg),
    scrap_laminado_kg: readNumber(ctx.form.corScrapMalCorteKg),
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
    acumulado: CortePlanillaPreviewPayload["acumulado"]
  },
): CortePlanillaSheet {
  const maquinaSidebar = readMaquina(form)
  const paletas = getCorPaletas(form)
  const { grid, rowTotals } = buildPaletaGrid(paletas)

  return {
    turno_id: "flat",
    turno_label: "Sin turno guardado",
    turno_diurno: readString(form.corTurno) === "diurno",
    turno_nocturno: readString(form.corTurno) === "nocturno",
    turno_grupo: grupoToPaper(readString(form.corGrupo)),
    work_order_code: ctx.work_order_code,
    product: ctx.product,
    operador: readString(form.corOperador).trim(),
    ayudante: readString(form.corAyudante).trim(),
    supervisor: readString(form.corSupervisor).trim(),
    maquina_header: maquinaSidebar || "Permaco",
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
    entrada_bobinas: padSeries([], ENTRADA_SLOTS),
    total_entrada_kg: sumEntradaKgFromForm(form),
    paleta_grid: grid,
    paleta_row_totals: rowTotals,
    total_salida_kg: ctx.acumulado.producido_kg,
    num_bobinas: countRollosSalida(paletas),
    num_paletas: paletas.filter((p) => sumSalidaKgFromPaletas([p]) > 0).length,
    merma_kg: readNumber(form.kgMermaCorte),
    metraje_m: readNumber(form.metrajeCorte),
    scrap_refile_kg: readNumber(form.corScrapRefileKg),
    scrap_impreso_kg: readNumber(form.corScrapImpresoKg),
    scrap_laminado_kg: readNumber(form.corScrapMalCorteKg),
    tiempo_muerto: ctx.acumulado.dead_hms,
    tiempo_efectivo: ctx.acumulado.effective_hms,
    tiempo_preparacion: "",
    paradas_lines: [],
    is_current: false,
  }
}

function turnoToPreviewRow(
  t: CorteTurnoEntry,
  form: Record<string, unknown>,
  isCurrent: boolean,
  salidaOverride?: number,
): CortePlanillaTurnoRow {
  const eff = readNumber(t.timer.effectiveAccSec)
  const dead = readNumber(t.timer.deadAccSec)
  const salida = salidaOverride ?? sumSalidaKgFromClosedTurno(t)
  return {
    id: t.id,
    label: turnoGrupoLabel(t.turno, t.grupo),
    closed_at: t.closed_at ?? null,
    operador: t.operador.trim(),
    entrada_kg: sumEntradaKgTurno(t),
    salida_kg: salida,
    scrap_kg: sumScrapKgTurno(t, form),
    rollos_salida: countRollosSalida(t.paletas),
    paletas: t.paletas.length,
    effective_hms: formatHmsFromSeconds(eff),
    dead_hms: formatHmsFromSeconds(dead),
    total_hms: formatHmsFromSeconds(eff + dead),
    is_current: isCurrent,
  }
}

function ultimoCierreLabel(cerrados: CorteTurnoEntry[]): string {
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

export function buildCortePlanillaPreviewPayload(source: CortePlanillaPreviewSource): CortePlanillaPreviewPayload {
  const nowMs = source.nowMs ?? Date.now()
  const booted = bootstrapCorteFormState(source.form)
  let cerrados = parseCorteTurnos(booted[COR_TURNOS_KEY], booted)
  let actual = parseCorteTurnoActual(booted[COR_ACTUAL_KEY], booted)
  if (actual?.closed_at) {
    if (!cerrados.some((t) => t.id === actual!.id)) {
      cerrados = [...cerrados, actual]
    }
    actual = null
  }

  const formSalidaActual = actual ? sumSalidaKgFromPaletas(actual.paletas) : undefined
  const acum = accumulateCorteFromJson(cerrados, actual, formSalidaActual)
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

  const turnos: CortePlanillaTurnoRow[] = [
    ...cerrados.map((t) => turnoToPreviewRow(t, booted, false)),
    ...(actual ? [turnoToPreviewRow(actual, booted, true, formSalidaActual)] : []),
  ]

  const turnosSalidaSum = turnos.reduce((acc, t) => acc + t.salida_kg, 0)
  const turnosEntradaSum = turnos.reduce((acc, t) => acc + t.entrada_kg, 0)
  const turnosScrapSum = turnos.reduce((acc, t) => acc + t.scrap_kg, 0)

  const matchesAcumulado =
    Math.abs(turnosSalidaSum - producidoKg) < 0.02 && Math.abs(turnosEntradaSum - sumEntradaKgFromForm(booted)) < 0.02

  const mesRow = {
    technical_document: source.technical_document ?? { form: source.form },
    board_stage: source.board_stage ?? "corte",
  }
  const mes = corteMesBandFromWorkOrderRow(mesRow, nowMs)

  const sheetCtx = {
    work_order_code: source.work_order_code,
    product: source.product?.trim() ? source.product.trim() : null,
    form: booted,
  }
  const sheets: CortePlanillaSheet[] = [
    ...cerrados.map((t) => buildSheetFromTurno(t, { ...sheetCtx, is_current: false })),
    ...(actual ? [buildSheetFromTurno(actual, { ...sheetCtx, is_current: true })] : []),
  ]
  const acumuladoBlock = {
    producido_kg: producidoKg,
    entrada_kg: sumEntradaKgFromForm(booted),
    scrap_kg: sumScrapKgFromForm(booted),
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

export function persistCortePlanillaPreview(payload: CortePlanillaPreviewPayload): boolean {
  try {
    localStorage.setItem(
      `${CORTE_PLANILLA_PREVIEW_STORAGE_PREFIX}${payload.work_order_id}`,
      JSON.stringify(payload),
    )
    return true
  } catch {
    return false
  }
}

export function openCortePlanillaPreviewWindow(workOrderId: number): void {
  const url = appAbsoluteUrl(
    `/ordenes-trabajo/${encodeURIComponent(String(workOrderId))}/corte/planilla/vista-previa`,
  )
  window.open(url, "_blank", "noopener,noreferrer")
}

export function openCortePlanillaPreviewFromPayload(payload: CortePlanillaPreviewPayload): boolean {
  if (!persistCortePlanillaPreview(payload)) return false
  openCortePlanillaPreviewWindow(payload.work_order_id)
  return true
}

/** Planilla física solo tras «Finalizar área de corte» (`corEstadoArea`). */
export function canOpenCortePlanillaPreview(form: Record<string, unknown> | null | undefined): boolean {
  if (!form) return false
  const booted = bootstrapCorteFormState(form)
  return readCorteEstadoArea(booted[COR_ESTADO_KEY]) === "finalizada"
}

export function openCortePlanillaPreviewFromSource(source: CortePlanillaPreviewSource): boolean {
  if (!canOpenCortePlanillaPreview(source.form)) return false
  const payload = buildCortePlanillaPreviewPayload(source)
  return openCortePlanillaPreviewFromPayload(payload)
}

export { PALETA_COLS, PALETA_ROWS, ENTRADA_SLOTS }
