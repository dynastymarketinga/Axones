import { technicalFormFromRow } from "@/lib/mes-timer-band-shared"
import { printingFormForMesBand } from "@/lib/printing-mes-band-status"
import { turnoGrupoLabelPrinting } from "@/pages/axones/printing-shift-history"
import {
  IMP_ACTUAL_KEY,
  IMP_TURNOS_KEY,
  bootstrapPrintingFormState,
  countDevolucionRechazadaBobinas,
  hasLegacyPrintingMirror,
  legacyClosedTurnoFromMirror,
  parsePrintingTurnoActual,
  parsePrintingTurnos,
  syncPrintingTurnoFromFormMirror,
  type PrintingCapturaProduccion,
  type PrintingTurnoEntry,
} from "@/pages/axones/printing-turnos"
import { rejectReasonLabel } from "@/pages/axones/warehouse-return-helpers"
import type { WorkOrderListRow } from "@/types/api"

export type MesBandejaDevolucionBuenaLine = {
  turnoLabel: string
  kg: number
  motivo: string
}

export type MesBandejaDevolucionMalaLine = {
  turnoLabel: string
  kg: number
  /** Solo cuando no hay kg pero sí conteo legado de bobinas. */
  bobinasCount: number
  motivo: string
  operador: string
  fechaBobina: string
  creada: string
}

export type MesBandejaDevolucionesSnapshot = {
  buenaTotalKg: number
  malaTotalKg: number
  buenaLines: MesBandejaDevolucionBuenaLine[]
  malaLines: MesBandejaDevolucionMalaLine[]
  hasAny: boolean
}

const EMPTY_SNAPSHOT: MesBandejaDevolucionesSnapshot = {
  buenaTotalKg: 0,
  malaTotalKg: 0,
  buenaLines: [],
  malaLines: [],
  hasAny: false,
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

function formatIsoDate(raw: string): string {
  const s = raw.trim()
  if (!s) return "—"
  try {
    const d = new Date(s)
    if (!Number.isFinite(d.getTime())) return s
    return d.toLocaleDateString("es-VE")
  } catch {
    return s
  }
}

function turnoContextLabel(t: PrintingTurnoEntry, capturaIndex?: number): string {
  const base = turnoGrupoLabelPrinting(t.turno, t.grupo) || "Turno"
  if (capturaIndex != null) return `${base} · Captura ${capturaIndex + 1}`
  if (t.closed_at) return `${base} · Cerrado`
  return `${base} · En curso`
}

function creadaFromCaptura(c: PrintingCapturaProduccion): string {
  return formatIsoDate(c.saved_at)
}

function creadaFromTurno(t: PrintingTurnoEntry): string {
  return formatIsoDate(t.started_at || t.closed_at || "")
}

type DevolucionSlice = {
  devolucionBuenaKg: string
  devolucionRechazadaKg: string
  devolucionRechazadaBobinas: string
  devolucionRechazadaMotivo: string
}

function pushDevolucionSlice(
  snapshot: MesBandejaDevolucionesSnapshot,
  slice: DevolucionSlice,
  turno: PrintingTurnoEntry,
  captura: PrintingCapturaProduccion | null,
  capturaIndex: number | null,
  fallbackOperador: string,
  formOverlay?: { buenaKg?: number; rechKg?: number; rechMotivo?: string },
) {
  const turnoLabel = turnoContextLabel(turno, capturaIndex ?? undefined)
  const operador = turno.operador.trim() || fallbackOperador.trim() || "—"
  const creada = captura ? creadaFromCaptura(captura) : creadaFromTurno(turno)

  const buenaKg =
    readNumber(slice.devolucionBuenaKg) > 0.005
      ? readNumber(slice.devolucionBuenaKg)
      : (formOverlay?.buenaKg ?? 0)
  if (buenaKg > 0.005) {
    snapshot.buenaLines.push({
      turnoLabel,
      kg: buenaKg,
      motivo: "—",
    })
    snapshot.buenaTotalKg += buenaKg
    snapshot.hasAny = true
  }

  const rechKg =
    readNumber(slice.devolucionRechazadaKg) > 0.005
      ? readNumber(slice.devolucionRechazadaKg)
      : (formOverlay?.rechKg ?? 0)
  const bobinasCount = countDevolucionRechazadaBobinas(
    slice.devolucionRechazadaBobinas,
    "",
  )
  if (rechKg > 0.005 || bobinasCount > 0) {
    const motivoRaw =
      readString(slice.devolucionRechazadaMotivo).trim() ||
      readString(formOverlay?.rechMotivo).trim()
    snapshot.malaLines.push({
      turnoLabel,
      kg: rechKg > 0.005 ? rechKg : 0,
      bobinasCount: rechKg > 0.005 ? 0 : bobinasCount,
      motivo: rejectReasonLabel(motivoRaw) || motivoRaw || "—",
      operador,
      fechaBobina: "—",
      creada,
    })
    if (rechKg > 0.005) {
      snapshot.malaTotalKg += rechKg
    }
    snapshot.hasAny = true
  }
}

function collectFromTurno(
  snapshot: MesBandejaDevolucionesSnapshot,
  turno: PrintingTurnoEntry,
  fallbackOperador: string,
  formOverlay?: { buenaKg?: number; rechKg?: number; rechMotivo?: string },
) {
  for (let i = 0; i < (turno.capturas ?? []).length; i++) {
    const c = turno.capturas![i]!
    pushDevolucionSlice(snapshot, c, turno, c, i, fallbackOperador)
  }
  pushDevolucionSlice(snapshot, turno, turno, null, null, fallbackOperador, formOverlay)
}

/** Devoluciones de bobina acumuladas en la OT (turnos cerrados + turno actual). */
export function printingDevolucionesFromForm(
  form: Record<string, unknown> | null,
): MesBandejaDevolucionesSnapshot {
  if (!form) return { ...EMPTY_SNAPSHOT }

  const booted = bootstrapPrintingFormState(form)
  let cerrados = parsePrintingTurnos(booted[IMP_TURNOS_KEY])
  let actual = parsePrintingTurnoActual(booted[IMP_ACTUAL_KEY])
  if (actual?.closed_at) {
    if (!cerrados.some((t) => t.id === actual!.id)) {
      cerrados = [...cerrados, actual]
    }
    actual = null
  }

  const fallbackOperador = readString(form.impOperador)
  const snapshot: MesBandejaDevolucionesSnapshot = {
    buenaTotalKg: 0,
    malaTotalKg: 0,
    buenaLines: [],
    malaLines: [],
    hasAny: false,
  }

  for (const t of cerrados) {
    collectFromTurno(snapshot, t, fallbackOperador)
  }

  if (actual) {
    const synced = syncPrintingTurnoFromFormMirror(form, actual)
    collectFromTurno(snapshot, synced, fallbackOperador, {
      buenaKg: readNumber(form.impDevolucionBuenaKg),
      rechKg: readNumber(form.impDevolucionRechazadaKg),
      rechMotivo: readString(form.impDevolucionRechazadaMotivo),
    })
  }

  if (cerrados.length === 0 && !actual && hasLegacyPrintingMirror(form)) {
    collectFromTurno(snapshot, legacyClosedTurnoFromMirror(form), fallbackOperador)
  }

  return snapshot
}

/** Cantidad de registros de devolución (líneas buena + mala). */
export function mesBandejaDevolucionesRegistroCount(
  snap: MesBandejaDevolucionesSnapshot,
): number {
  return snap.buenaLines.length + snap.malaLines.length
}

export type MesBandejaDevolucionesTotals = {
  buenaTotalKg: number
  malaTotalKg: number
  totalKg: number
  /** OT con al menos un kg de devolución buena o mala. */
  rowsWithDevoluciones: number
}

/** Totaliza devoluciones de las OT visibles en la página. */
export function mesBandejaDevolucionesTotalsFromSnapshots(
  snapshots: MesBandejaDevolucionesSnapshot[],
): MesBandejaDevolucionesTotals {
  let buenaTotalKg = 0
  let malaTotalKg = 0
  let rowsWithDevoluciones = 0
  for (const snap of snapshots) {
    const has =
      snap.buenaTotalKg > 0.005 ||
      snap.malaTotalKg > 0.005 ||
      mesBandejaDevolucionesRegistroCount(snap) > 0
    if (has) rowsWithDevoluciones++
    buenaTotalKg += snap.buenaTotalKg
    malaTotalKg += snap.malaTotalKg
  }
  return {
    buenaTotalKg,
    malaTotalKg,
    totalKg: buenaTotalKg + malaTotalKg,
    rowsWithDevoluciones,
  }
}

export function printingDevolucionesFromWorkOrderRow(
  row: WorkOrderListRow,
): MesBandejaDevolucionesSnapshot {
  const form = technicalFormFromRow(row)
  if (!form) return { ...EMPTY_SNAPSHOT }
  const { cerrados, actual } = printingFormForMesBand(form)
  if (cerrados.length === 0 && !actual && !hasLegacyPrintingMirror(form)) {
    return { ...EMPTY_SNAPSHOT }
  }
  return printingDevolucionesFromForm(form)
}
