import type { WorkOrderListRow } from "@/types/api"

import { areaRequestsFromRow } from "@/lib/area-request-for-row"
import type { MesBandejaWorkflow } from "@/lib/mes-timer-band-shared"

export type AreaMesProgressKey = "printing" | "montaje" | "laminacion" | "corte" | "tintas"

const ESTADO_AREA_KEY: Record<AreaMesProgressKey, string | null> = {
  montaje: "montEstadoArea",
  printing: "impEstadoArea",
  laminacion: "lamEstadoArea",
  corte: null,
  tintas: "impEstadoArea",
}

const BOARD_STAGE_BY_AREA: Record<AreaMesProgressKey, string> = {
  printing: "impresion",
  montaje: "montaje",
  laminacion: "laminacion",
  corte: "corte",
  tintas: "impresion",
}

/** Etapa MES finalizada en el formulario técnico (no deducir solo del tablero Kanban). */
export function mesEstadoAreaFromRow(
  row: WorkOrderListRow,
  area: AreaMesProgressKey,
): "abierta" | "finalizada" {
  const key = ESTADO_AREA_KEY[area]
  if (!key) return "abierta"
  const form = row.technical_document?.form as Record<string, unknown> | undefined
  return String(form?.[key] ?? "abierta").toLowerCase() === "finalizada" ? "finalizada" : "abierta"
}

/**
 * Etiqueta de progreso por área en bandeja.
 * «Hecho en área» solo cuando el MES del área está finalizado, no porque otra área avanzó el tablero.
 */
export function processStateForAreaBandeja(
  area: AreaMesProgressKey,
  row: WorkOrderListRow,
  mesWorkflow?: MesBandejaWorkflow | null,
): string {
  if (mesEstadoAreaFromRow(row, area) === "finalizada") {
    return "Hecho en área"
  }

  if (mesWorkflow && mesWorkflow !== "sin_iniciar") {
    return "En proceso"
  }

  const areaStage = BOARD_STAGE_BY_AREA[area]
  const bs = (row.board_stage ?? "").toLowerCase()
  if (bs === areaStage) {
    return "En proceso"
  }

  if (areaRequestsFromRow(row).some((r) => r.status === "pending")) {
    return "Pendiente"
  }

  if (!bs) {
    return "Sin registrar"
  }

  const stageOrder: Record<string, number> = {
    nueva: 0,
    pendiente: 1,
    montaje: 2,
    impresion: 3,
    laminacion: 4,
    corte: 5,
    completada: 6,
  }
  const current = stageOrder[bs] ?? -1
  const target = stageOrder[areaStage] ?? -1
  if (current < target) {
    return "Antes de esta etapa"
  }

  return "Sin registrar"
}

export function areaBandejaProgressStickerClass(label: string): string {
  const base =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-tight"
  if (label === "Hecho en área") {
    return `${base} border-emerald-500/35 bg-emerald-500/12 text-emerald-950 dark:text-emerald-50`
  }
  if (label === "En proceso") {
    return `${base} border-sky-500/35 bg-sky-500/12 text-sky-950 dark:text-sky-50`
  }
  if (label === "Pendiente") {
    return `${base} border-amber-500/35 bg-amber-500/12 text-amber-950 dark:text-amber-50`
  }
  return `${base} border-violet-400/35 bg-violet-500/10 text-violet-950 dark:border-violet-500/30 dark:bg-violet-950/35 dark:text-violet-100`
}
