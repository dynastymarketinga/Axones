import { corteMesBandFromWorkOrderRow } from "@/lib/corte-mes-band-status"
import { laminacionMesBandFromWorkOrderRow } from "@/lib/laminacion-mes-band-status"
import { montajeMesBandFromWorkOrderRow } from "@/lib/montaje-mes-band-status"
import type { MesBandejaMes } from "@/lib/mes-timer-band-shared"
import {
  emptyMesBandejaDevolucionesSnapshot,
  laminacionDevolucionesFromWorkOrderRow,
  printingDevolucionesFromWorkOrderRow,
  type MesBandejaDevolucionesSnapshot,
} from "@/lib/printing-mes-band-devoluciones"
import { printingMesBandFromWorkOrderRow } from "@/lib/printing-mes-band-status"
import type { WorkOrderListRow } from "@/types/api"

export type MesBandejaAreaKey = "printing" | "montaje" | "laminacion" | "corte"

export const MES_BANDEJA_AREAS: MesBandejaAreaKey[] = ["printing", "montaje", "laminacion", "corte"]

export function areaHasMesTimerColumn(area: string): area is MesBandejaAreaKey {
  return MES_BANDEJA_AREAS.includes(area as MesBandejaAreaKey)
}

export function mesBandFromWorkOrderRow(
  area: MesBandejaAreaKey,
  row: WorkOrderListRow,
  nowMs: number,
): MesBandejaMes | null {
  if (area === "printing") return printingMesBandFromWorkOrderRow(row, nowMs)
  if (area === "montaje") return montajeMesBandFromWorkOrderRow(row, nowMs)
  if (area === "laminacion") return laminacionMesBandFromWorkOrderRow(row, nowMs)
  return corteMesBandFromWorkOrderRow(row, nowMs)
}

export const MES_CONTROL_SAVED_EVENTS: Record<MesBandejaAreaKey, string> = {
  printing: "axones-printing-control-saved",
  montaje: "axones-montaje-control-saved",
  laminacion: "axones-laminacion-control-saved",
  corte: "axones-corte-control-saved",
}

export function mesAreaDisplayName(area: MesBandejaAreaKey): string {
  if (area === "printing") return "Impresión"
  if (area === "montaje") return "Montaje"
  if (area === "laminacion") return "Laminación"
  return "Corte"
}

/** Devoluciones de bobina visibles en columna «Bobinas» de la bandeja MES. */
export function mesBandejaDevolucionesFromWorkOrderRow(
  area: MesBandejaAreaKey,
  row: WorkOrderListRow,
): MesBandejaDevolucionesSnapshot {
  if (area === "printing") return printingDevolucionesFromWorkOrderRow(row)
  if (area === "laminacion") return laminacionDevolucionesFromWorkOrderRow(row)
  return emptyMesBandejaDevolucionesSnapshot()
}
