"use client"

import { TintasTabletWorkspace } from "@/components/axones/TintasTabletWorkspace"
import type { MaterialRow } from "@/types/api"

import "@/pages/axones/tintas-ot-workspace.css"

export { TintasPaneHead } from "@/components/axones/TintasPaneHead"

export type TintasOtWorkspaceProps = {
  workOrderId: number
  workOrderCode?: string | null
  tintaMaterials: MaterialRow[]
  invTintas?: MaterialRow[]
  invCementerio?: MaterialRow[]
  onMixCreated?: () => void
}

/** Flujo encargado de tintas (tablet): consumo, químicos, devolución y mezcla. */
export function TintasOtWorkspace({
  workOrderId,
  workOrderCode,
  tintaMaterials,
  invTintas = [],
  invCementerio = [],
  onMixCreated,
}: TintasOtWorkspaceProps) {
  return (
    <div className="tintas-workspace tintas-workspace--tablet rounded-none border-0 border-t border-violet-100/80 shadow-none">
      <TintasTabletWorkspace
        workOrderId={workOrderId}
        workOrderCode={workOrderCode}
        tintaMaterials={tintaMaterials}
        invTintas={invTintas}
        invCementerio={invCementerio}
        onMixCreated={onMixCreated}
      />
    </div>
  )
}
