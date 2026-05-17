import {
  COR_ESTADO_KEY,
  materializeOpenCorteTurnoActual,
  readCorteEstadoArea,
  type CorteEstadoArea,
} from "@/pages/axones/corte-turnos"
import {
  canSaveProductionAreaForm,
  hasActiveProductionTurno,
  MES_PRODUCTION_SAVE_CONFIG,
} from "@/lib/mes-timer-guards"

export type CorteOperability = {
  areaEstado: CorteEstadoArea
  hasActiveTurno: boolean
  canOperateProduction: boolean
  /** Turno abierto y área no finalizada (agregar paleta / editar rollos abiertos). */
  canAddPaleta: boolean
}

export function corteProduccionTabPath(workOrderId: number): string {
  return `/ordenes-trabajo/${workOrderId}/produccion?tab=corte`
}

export function corteOperabilityFromForm(
  form: Record<string, unknown> | null | undefined,
): CorteOperability {
  const src = form ?? {}
  const areaEstado = readCorteEstadoArea(src[COR_ESTADO_KEY])
  const hasActiveTurno = materializeOpenCorteTurnoActual(src) !== null
  const canOperateProduction = canSaveProductionAreaForm(src, MES_PRODUCTION_SAVE_CONFIG.corte)
  const canAddPaleta = areaEstado !== "finalizada" && hasActiveTurno

  return {
    areaEstado,
    hasActiveTurno,
    canOperateProduction,
    canAddPaleta,
  }
}

export function explainCannotAddPaleta(op: CorteOperability): string {
  if (op.areaEstado === "finalizada") {
    return "El área de corte ya está finalizada. Agregue material solo desde Despacho · producto terminado."
  }
  if (!op.hasActiveTurno) {
    return "No hay turno de planta abierto en Corte. Abra turno en la pestaña Corte de la OT o elija paletas ya cerradas en Despacho."
  }
  return "No puede agregar paletas en este momento."
}

export type AgregarPaletasDesdeNotaTarget =
  | { kind: "corte"; workOrderId: number; label: string }
  | { kind: "despacho"; label: string; reason?: string }

/**
 * Decide destino al ampliar paletas desde nueva nota de entrega.
 * Una sola OT: preferir Corte si el área sigue operativa; si no, Despacho.
 */
export function resolveAgregarPaletasDesdeNotaTarget(
  workOrderIds: number[],
  operabilityByWo: Record<number, CorteOperability | undefined>,
): AgregarPaletasDesdeNotaTarget {
  const ids = workOrderIds.filter((id) => Number.isFinite(id) && id > 0)
  if (ids.length === 1) {
    const woId = ids[0]!
    const op = operabilityByWo[woId]
    if (op?.canAddPaleta) {
      return {
        kind: "corte",
        workOrderId: woId,
        label: "Agregar paleta en Corte",
      }
    }
    if (op?.areaEstado === "finalizada") {
      return {
        kind: "despacho",
        label: "Elegir paletas en Despacho",
        reason: explainCannotAddPaleta(op),
      }
    }
    if (op && !op.hasActiveTurno) {
      return {
        kind: "corte",
        workOrderId: woId,
        label: "Ir a Corte (abrir turno)",
      }
    }
    return {
      kind: "corte",
      workOrderId: woId,
      label: "Ir a producción · Corte",
    }
  }

  return {
    kind: "despacho",
    label: ids.length > 1 ? "Elegir paletas en Despacho" : "Agregar más paletas",
    reason:
      ids.length > 1
        ? "Hay varias órdenes en la nota. Elija paletas cerradas en Despacho."
        : undefined,
  }
}

export function hasOpenCorteTurno(form: Record<string, unknown> | null | undefined): boolean {
  return hasActiveProductionTurno(form ?? {}, MES_PRODUCTION_SAVE_CONFIG.corte)
}
