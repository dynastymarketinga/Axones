"use client"

import type { ReactNode } from "react"
import { Droplets, RefreshCw } from "lucide-react"

import { ProductionAreaPanel } from "@/components/axones/ProductionAreaPanel"
import { TintasMixSection } from "@/components/axones/TintasMixSection"
import type { MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import "@/pages/axones/tintas-ot-workspace.css"

export { TintasPaneHead } from "@/components/axones/TintasPaneHead"

export type TintasOtWorkspaceProps = {
  workOrderId: number
  workOrderCode?: string | null
  tintaMaterials: MaterialRow[]
  onMixCreated?: () => void
  onRefresh?: () => void
  refreshing?: boolean
}

export function TintasOtWorkspace({
  workOrderId,
  workOrderCode,
  tintaMaterials,
  onMixCreated,
  onRefresh,
  refreshing,
}: TintasOtWorkspaceProps) {
  const mixForm: ReactNode = (
    <TintasMixSection
      layout="form"
      workOrderId={workOrderId}
      tintaMaterials={tintaMaterials}
      onMixCreated={onMixCreated}
    />
  )

  return (
    <div className="tintas-workspace rounded-none border-0 border-t border-violet-100/80 shadow-none">
      <div className="tintas-workspace__hero">
        <div className="tintas-workspace__hero-title">
          <span className="tintas-workspace__hero-icon" aria-hidden>
            <Droplets className="h-5 w-5" />
          </span>
          <span>
            Operación de tintas
            {workOrderCode ? (
              <>
                {" "}
                <span className="font-mono text-violet-700/90">{workOrderCode}</span>
              </>
            ) : null}
          </span>
        </div>
        {onRefresh ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-violet-200/80 bg-white/80 text-xs shadow-sm hover:bg-violet-50"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
            Actualizar
          </Button>
        ) : null}
      </div>

      <ProductionAreaPanel
        workOrderId={workOrderId}
        title="Tintas"
        areaPath="tintas"
        usageMode="none"
        presentation="tintas-premium"
        mixColumn={mixForm}
      />

      <div className="tintas-workspace__recetario">
        <TintasMixSection
          layout="recetario"
          workOrderId={workOrderId}
          tintaMaterials={tintaMaterials}
        />
      </div>
    </div>
  )
}
