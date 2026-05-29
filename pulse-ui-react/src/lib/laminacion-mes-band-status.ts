import {
  buildMesBandFromTurnos,
  mesBandejaCardClass,
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowTitle,
  technicalFormFromRow,
  type MesBandejaMes,
} from "@/lib/mes-timer-band-shared"
import {
  LAM_ACTUAL_KEY,
  LAM_ESTADO_KEY,
  LAM_TURNOS_KEY,
  accumulateLaminacionFromJson,
  bootstrapLaminacionFormState,
  parseLaminacionTurnoActual,
  parseLaminacionTurnos,
  readLaminacionEstadoArea,
  type LaminacionTurnoEntry,
} from "@/pages/axones/laminacion-turnos"

/** Normaliza form laminación para bandeja (misma lógica que la OT en producción). */
function laminacionFormForMesBand(form: Record<string, unknown> | null): {
  cerrados: LaminacionTurnoEntry[]
  actual: LaminacionTurnoEntry | null
  estado: "abierta" | "finalizada"
} {
  if (!form) {
    return { cerrados: [], actual: null, estado: "abierta" }
  }
  const booted = bootstrapLaminacionFormState(form)
  let cerrados = parseLaminacionTurnos(booted[LAM_TURNOS_KEY])
  let actual = parseLaminacionTurnoActual(booted[LAM_ACTUAL_KEY])
  if (actual?.closed_at) {
    if (!cerrados.some((t) => t.id === actual!.id)) {
      cerrados = [...cerrados, actual]
    }
    actual = null
  }
  return {
    cerrados,
    actual,
    estado: readLaminacionEstadoArea(booted[LAM_ESTADO_KEY]),
  }
}

export const LAMINACION_CONTROL_SAVED_EVENT = "axones-laminacion-control-saved"

export type { MesBandejaMes as LaminacionBandejaMes }
export type { MesBandejaWorkflow as LaminacionBandejaWorkflow } from "@/lib/mes-timer-band-shared"
export { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"

function hasLaminacionMesActivity(form: Record<string, unknown> | null): boolean {
  if (!form) return false
  const { cerrados, actual, estado } = laminacionFormForMesBand(form)
  if (actual !== null || cerrados.length > 0) return true
  return estado === "finalizada"
}

function readStoredProducidoKg(form: Record<string, unknown> | null): number {
  if (!form) return 0
  const raw = form.lamAcumuladoProducidoKg
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw)
  if (typeof raw === "string") {
    const n = Number(raw.replace(",", "."))
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }
  return 0
}

/**
 * Estado MES para la bandeja de laminación.
 * Incluye OT con datos MES aunque el tablero aún no esté en columna «laminacion».
 */
export function laminacionMesBandFromWorkOrderRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): MesBandejaMes | null {
  const form = technicalFormFromRow(row)
  const bs = (row.board_stage ?? "").toLowerCase()
  if (bs !== "laminacion" && !hasLaminacionMesActivity(form)) return null

  const { cerrados, actual, estado } = laminacionFormForMesBand(form)

  const mes = buildMesBandFromTurnos({
    areaLabel: "Laminación",
    estado,
    cerrados,
    actual,
    nowMs,
    form,
  })

  const acum = accumulateLaminacionFromJson(cerrados, actual)
  if (cerrados.length > 0 || actual) {
    const storedKg = readStoredProducidoKg(form)
    const producidoKg = Math.max(acum.producidoKg, storedKg)
    return { ...mes, producidoKg }
  }
  const storedOnly = readStoredProducidoKg(form)
  if (storedOnly > 0.005) {
    return { ...mes, producidoKg: storedOnly }
  }
  return mes
}

export type LaminacionActivasSubTab = "pendientes" | "produccion" | "finalizadas"

/**
 * Subpestaña En curso (laminación), misma lógica que impresión.
 */
export function laminacionActivasBucketFromRow(
  row: { technical_document?: { form?: Record<string, unknown> } | null; board_stage?: string | null },
  nowMs: number,
): LaminacionActivasSubTab {
  const mes = laminacionMesBandFromWorkOrderRow(row, nowMs)
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
  const { cerrados, actual } = laminacionFormForMesBand(form)
  if (cerrados.length > 0 || actual) return "produccion"
  return "pendientes"
}

export const laminacionBandejaRowAccentClass = mesBandejaRowAccentClass
export const laminacionBandejaCardClass = mesBandejaCardClass
export const laminacionBandejaStatePillClass = mesBandejaStatePillClass
export const laminacionBandejaWorkflowTitle = mesBandejaWorkflowTitle
