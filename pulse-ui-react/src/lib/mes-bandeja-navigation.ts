import type { NavigateFunction } from "react-router-dom"

import type { MesActivasSubTabKey } from "@/components/axones/MesActivasSubTabsBar"

/** Query param en bandejas de producción (`/montaje?bandeja=produccion`). */
export const MES_BANDEJA_QUERY_KEY = "bandeja"

export type MesBandejaProductionArea = "montaje" | "printing" | "laminacion" | "corte" | "tintas"

const MES_BANDEJA_AREA_PATH: Record<MesBandejaProductionArea, string> = {
  montaje: "/montaje",
  printing: "/impresion",
  laminacion: "/laminacion",
  corte: "/corte",
  tintas: "/tintas",
}

export function parseMesBandejaSubTabParam(raw: string | null | undefined): MesActivasSubTabKey | null {
  const v = raw?.trim().toLowerCase()
  if (v === "pendientes" || v === "produccion" || v === "finalizadas") return v
  return null
}

export function mesBandejaPath(area: MesBandejaProductionArea, subTab?: MesActivasSubTabKey): string {
  const base = MES_BANDEJA_AREA_PATH[area]
  if (!subTab) return base
  return `${base}?${MES_BANDEJA_QUERY_KEY}=${encodeURIComponent(subTab)}`
}

export function navigateToMesBandeja(
  navigate: NavigateFunction,
  area: MesBandejaProductionArea,
  subTab: MesActivasSubTabKey,
): void {
  navigate(mesBandejaPath(area, subTab), { replace: true })
}
