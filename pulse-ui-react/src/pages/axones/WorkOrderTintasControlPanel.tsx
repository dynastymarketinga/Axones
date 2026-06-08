"use client"

import { TintasOtWorkspace } from "@/components/axones/TintasOtWorkspace"
import { useTintasMaterials } from "@/hooks/useTintasMaterials"

export type WorkOrderTintasControlPanelProps = {
  workOrderId: number
  workOrderCode?: string | null
}

export default function WorkOrderTintasControlPanel({
  workOrderId,
  workOrderCode,
}: WorkOrderTintasControlPanelProps) {
  const { tintaMaterials, invTintas, invCementerio, reload } = useTintasMaterials()

  return (
    <TintasOtWorkspace
      workOrderId={workOrderId}
      workOrderCode={workOrderCode}
      tintaMaterials={tintaMaterials}
      invTintas={invTintas}
      invCementerio={invCementerio}
      onMixCreated={() => void reload()}
    />
  )
}
