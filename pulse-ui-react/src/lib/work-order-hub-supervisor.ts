import { corteMesBandFromWorkOrderRow } from "@/lib/corte-mes-band-status"
import { laminacionMesBandFromWorkOrderRow } from "@/lib/laminacion-mes-band-status"
import { montajeMesBandFromWorkOrderRow } from "@/lib/montaje-mes-band-status"
import {
  technicalFormFromRow,
  type MesBandejaWorkflow,
} from "@/lib/mes-timer-band-shared"
import { printingMesBandFromWorkOrderRow } from "@/lib/printing-mes-band-status"
import { tintasMesBandFromWorkOrderRow } from "@/lib/tintas-mes-band-status"
import { COR_ESTADO_KEY, readCorteEstadoArea } from "@/pages/axones/corte-turnos"
import { LAM_ESTADO_KEY, readLaminacionEstadoArea } from "@/pages/axones/laminacion-turnos"
import { MON_ESTADO_KEY, readEstadoArea } from "@/pages/axones/montaje-turnos"
import { IMP_ESTADO_KEY, readEstadoArea as readImpEstadoArea } from "@/pages/axones/printing-turnos"
import type { WorkOrderListRow } from "@/types/api"

/** Bucket operativo del listado hub (pestañas de supervisión). */
export type HubSupervisorBucket =
  | "registered"
  | "in_progress"
  | "closed"
  | "closed_complete"
  | "cancelled"

export type HubSupervisorFilter = "all" | HubSupervisorBucket

const ACTIVE_PRODUCTION_WORKFLOWS: ReadonlySet<MesBandejaWorkflow> = new Set([
  "turno_abierto",
  "iniciado",
  "pausado",
  "entre_turnos",
])

const CORE_ESTADO_KEYS = [
  { key: MON_ESTADO_KEY, read: readEstadoArea },
  { key: IMP_ESTADO_KEY, read: readImpEstadoArea },
  { key: LAM_ESTADO_KEY, read: readLaminacionEstadoArea },
  { key: COR_ESTADO_KEY, read: readCorteEstadoArea },
] as const

function isWorkflowProductionStarted(wf: MesBandejaWorkflow | undefined): boolean {
  return wf !== undefined && ACTIVE_PRODUCTION_WORKFLOWS.has(wf)
}

export function isAreaFinalized(form: Record<string, unknown> | null, estadoKey: string, read: (raw: unknown) => string): boolean {
  if (!form) return false
  return read(form[estadoKey]) === "finalizada"
}

export function isCorteFinalized(form: Record<string, unknown> | null): boolean {
  return isAreaFinalized(form, COR_ESTADO_KEY, readCorteEstadoArea)
}

/** Montaje + Impresión + Laminación + Corte finalizados en planilla. */
export function isCoreProductionComplete(form: Record<string, unknown> | null): boolean {
  if (!form) return false
  return CORE_ESTADO_KEYS.every(({ key, read }) => isAreaFinalized(form, key, read))
}

function mesWorkflowFromRow(
  row: WorkOrderListRow,
  nowMs: number,
): MesBandejaWorkflow | null {
  const bands = [
    montajeMesBandFromWorkOrderRow(row, nowMs),
    printingMesBandFromWorkOrderRow(row, nowMs),
    laminacionMesBandFromWorkOrderRow(row, nowMs),
    corteMesBandFromWorkOrderRow(row, nowMs),
    tintasMesBandFromWorkOrderRow(row, nowMs),
  ]
  for (const mes of bands) {
    if (mes && isWorkflowProductionStarted(mes.workflow)) {
      return mes.workflow
    }
  }
  return null
}

function hasTintasProductionActivity(row: WorkOrderListRow, nowMs: number): boolean {
  const mes = tintasMesBandFromWorkOrderRow(row, nowMs)
  if (!mes) return false
  if (isWorkflowProductionStarted(mes.workflow)) return true
  const summary = row.area_time_summary
  if (!summary) return false
  return (
    Boolean(summary.open_segment_type) ||
    summary.effective_seconds > 0.01 ||
    summary.dead_seconds > 0.01
  )
}

function hasAnyAreaFinalized(form: Record<string, unknown> | null): boolean {
  if (!form) return false
  return CORE_ESTADO_KEYS.some(({ key, read }) => isAreaFinalized(form, key, read))
}

/**
 * Producción iniciada en al menos un área (turnos, pausa, entre turnos o algún área ya cerrada).
 */
export function hasAnyProductionActivity(row: WorkOrderListRow, nowMs: number): boolean {
  if (mesWorkflowFromRow(row, nowMs) !== null) return true
  if (hasTintasProductionActivity(row, nowMs)) return true
  const form = technicalFormFromRow(row)
  return hasAnyAreaFinalized(form)
}

export function hubBucketEtapaHint(bucket: HubSupervisorBucket): string | null {
  if (bucket === "closed") return "Corte cerrado"
  if (bucket === "closed_complete") return "4 áreas listas"
  return null
}

/**
 * Clasifica una OT del listado hub (prioridad: cancelada → 4 áreas → corte → producción → registrada).
 */
export function classifyWorkOrderHubRow(
  row: WorkOrderListRow,
  nowMs: number = Date.now(),
): HubSupervisorBucket {
  const status = (row.status ?? "").toLowerCase().trim()
  const stage = (row.board_stage ?? "").toLowerCase().trim()

  if (status === "cancelled") return "cancelled"

  const form = technicalFormFromRow(row)

  if (
    isCoreProductionComplete(form) ||
    status === "completed" ||
    stage === "completada"
  ) {
    return "closed_complete"
  }

  if (isCorteFinalized(form)) return "closed"

  if (hasAnyProductionActivity(row, nowMs)) return "in_progress"

  return "registered"
}

export function hubBucketMatchesFilter(
  bucket: HubSupervisorBucket,
  filter: HubSupervisorFilter,
): boolean {
  if (filter === "all") return true
  if (bucket === "cancelled") return false
  return bucket === filter
}
