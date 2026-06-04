import {
  buildMesBandFromTurnos,
  deriveMesOperativoEstadoFromMes,
  technicalFormFromRow,
  type MesBandejaMes,
  type MesOperativoEstado,
} from "@/lib/mes-timer-band-shared"
import {
  IMP_ACTUAL_KEY,
  IMP_ESTADO_KEY,
  IMP_TURNOS_KEY,
  accumulatePrintingFromJson,
  bootstrapPrintingFormState,
  parsePrintingTurnoActual,
  parsePrintingTurnos,
  readEstadoArea,
  type PrintingTurnoEntry,
} from "@/pages/axones/printing-turnos"
import { turnoGrupoLabelPrinting } from "@/pages/axones/printing-shift-history"

export type PrintingTurnoBandejaItem = {
  turno: PrintingTurnoEntry
  enCurso: boolean
}

/** Normaliza form impresión para bandeja (misma lógica que la OT en producción). */
export function printingFormForMesBand(form: Record<string, unknown> | null): {
  cerrados: PrintingTurnoEntry[]
  actual: PrintingTurnoEntry | null
  estado: "abierta" | "finalizada"
} {
  if (!form) {
    return { cerrados: [], actual: null, estado: "abierta" }
  }
  const booted = bootstrapPrintingFormState(form)
  let cerrados = parsePrintingTurnos(booted[IMP_TURNOS_KEY])
  let actual = parsePrintingTurnoActual(booted[IMP_ACTUAL_KEY])
  if (actual?.closed_at) {
    if (!cerrados.some((t) => t.id === actual!.id)) {
      cerrados = [...cerrados, actual]
    }
    actual = null
  }
  return {
    cerrados,
    actual,
    estado: readEstadoArea(booted[IMP_ESTADO_KEY]),
  }
}

function turnoCreatedAtMs(t: PrintingTurnoEntry): number {
  const raw = t.started_at?.trim() || t.closed_at?.trim() || ""
  if (!raw) return 0
  const n = Date.parse(raw)
  return Number.isFinite(n) ? n : 0
}

export function printingTurnosBandejaItems(form: Record<string, unknown> | null): PrintingTurnoBandejaItem[] {
  const { cerrados, actual } = printingFormForMesBand(form)
  const items: PrintingTurnoBandejaItem[] = cerrados.map((turno) => ({ turno, enCurso: false }))
  if (actual) items.push({ turno: actual, enCurso: true })
  return items
}

export function sortPrintingTurnoBandejaItems(
  items: PrintingTurnoBandejaItem[],
  order: "desc" | "asc",
): PrintingTurnoBandejaItem[] {
  return [...items].sort((a, b) => {
    const da = turnoCreatedAtMs(a.turno)
    const db = turnoCreatedAtMs(b.turno)
    return order === "desc" ? db - da : da - db
  })
}

export function printingTurnosBandejaSnapshot(form: Record<string, unknown> | null): {
  total: number
  latestLabel: string | null
  latestIsOpen: boolean
  items: PrintingTurnoBandejaItem[]
} {
  const items = printingTurnosBandejaItems(form)
  const total = items.length
  const open = items.find((i) => i.enCurso)
  const sorted = sortPrintingTurnoBandejaItems(items, "desc")
  const latest = open ?? sorted[0] ?? null
  return {
    total,
    latestLabel: latest ? turnoGrupoLabelPrinting(latest.turno.turno, latest.turno.grupo) : null,
    latestIsOpen: latest?.enCurso ?? false,
    items,
  }
}

/** Evento tras guardar control de impresión (misma ventana). */
export const PRINTING_CONTROL_SAVED_EVENT = "axones-printing-control-saved"

export type { MesBandejaMes as PrintingBandejaMes }
export type { MesBandejaWorkflow as PrintingBandejaWorkflow } from "@/lib/mes-timer-band-shared"
export { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"

function hasPrintingMesActivity(form: Record<string, unknown> | null): boolean {
  if (!form) return false
  const { cerrados, actual, estado } = printingFormForMesBand(form)
  if (actual !== null || cerrados.length > 0) return true
  return estado === "finalizada"
}

/**
 * Estado MES para la bandeja de impresión.
 * Incluye OT con datos MES aunque el tablero aún no esté en columna «impresion».
 */
/** Estado MES del formulario de impresión (misma lógica que la bandeja). */
export function printingMesBandFromForm(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MesBandejaMes {
  const f = form ?? null
  const { cerrados, actual, estado } = printingFormForMesBand(f)
  const mes = buildMesBandFromTurnos({
    areaLabel: "Impresión",
    estado,
    cerrados,
    actual,
    nowMs,
    form: f,
  })
  const acum = accumulatePrintingFromJson(cerrados, actual)
  const kgExtras = {
    entradaKg: acum.entradaKg,
    desperdicioKg: acum.scrapKg,
  }
  if (cerrados.length > 0 || actual) {
    const storedKg = readStoredProducidoKg(f)
    const producidoKg = Math.max(acum.producidoKg, storedKg)
    return { ...mes, producidoKg, ...kgExtras }
  }
  const storedOnly = readStoredProducidoKg(f)
  if (storedOnly > 0.005) {
    return { ...mes, producidoKg: storedOnly }
  }
  return mes
}

export function derivePrintingOperativoEstado(
  form: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now(),
): MesOperativoEstado {
  return deriveMesOperativoEstadoFromMes(printingMesBandFromForm(form, nowMs))
}

export function printingMesBandFromWorkOrderRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): MesBandejaMes | null {
  const form = technicalFormFromRow(row)
  const bs = (row.board_stage ?? "").toLowerCase()
  if (bs !== "impresion" && !hasPrintingMesActivity(form)) return null
  return printingMesBandFromForm(form, nowMs)
}

function readStoredProducidoKg(form: Record<string, unknown> | null): number {
  if (!form) return 0
  const raw = form.impAcumuladoProducidoKg
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw)
  if (typeof raw === "string") {
    const n = Number(raw.replace(",", "."))
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }
  return 0
}

export type PrintingActivasSubTab = "pendientes" | "produccion" | "finalizadas"

/**
 * Subpestaña En curso (impresión):
 * - pendientes: primera vez / sin producción iniciada
 * - produccion: turno o cronómetro en uso (incl. entre turnos)
 * - finalizadas: área MES finalizada (`impEstadoArea`)
 */
export function printingActivasBucketFromRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): PrintingActivasSubTab {
  const mes = printingMesBandFromWorkOrderRow(row, nowMs)
  if (!mes) return "pendientes"
  if (mes.workflow === "finalizado") return "finalizadas"
  if (
    mes.workflow === "iniciado" ||
    mes.workflow === "pausado" ||
    mes.workflow === "entre_turnos" ||
    mes.workflow === "turno_abierto"
  ) {
    return "produccion"
  }
  const form = technicalFormFromRow(row)
  const { cerrados, actual } = printingFormForMesBand(form)
  if (cerrados.length > 0 || actual) return "produccion"
  return "pendientes"
}
