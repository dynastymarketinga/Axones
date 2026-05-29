"use client"

import { Link } from "react-router-dom"
import { Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import {
  areasWithRecordedTime,
  PRODUCTION_AREA_LABELS,
  resolveMontajeWorkOrderId,
  type ProductionAreaKey,
  type ProductionTimeAreaSummaryRow,
  type WorkOrderTimeCandidate,
} from "./report-shared"

type ProductionTimeSingleAreaBannerProps = {
  areaRows: ProductionTimeAreaSummaryRow[]
}

export function ProductionTimeSingleAreaBanner({ areaRows }: ProductionTimeSingleAreaBannerProps) {
  const active = areasWithRecordedTime(areaRows)
  if (active.length !== 1) return null

  const area = active[0] as ProductionAreaKey
  const label = PRODUCTION_AREA_LABELS[area] ?? area

  return (
    <Alert className="border-primary/25 bg-primary/[0.06]">
      <Info className="h-4 w-4 text-primary" aria-hidden />
      <AlertTitle className="text-sm">Solo {label} en este período</AlertTitle>
      <AlertDescription className="text-xs">
        En el rango seleccionado, el tiempo registrado proviene únicamente del área{" "}
        <strong>{label}</strong>. Las demás áreas no tienen segmentos cerrados. Consulte la pestaña{" "}
        <strong>Tiempos por área</strong> para el detalle por máquina.
      </AlertDescription>
    </Alert>
  )
}

type ProductionTimeSegmentNoticeProps = {
  candidates: WorkOrderTimeCandidate[]
  woId: string
  aggregateAll: boolean
}

export function ProductionTimeSegmentNotice({
  candidates,
  woId,
  aggregateAll,
}: ProductionTimeSegmentNoticeProps) {
  const montajeOtId = resolveMontajeWorkOrderId(candidates, woId)

  const montajeCode =
    montajeOtId != null
      ? candidates.find((c) => c.work_order_id === montajeOtId)?.work_order_code
      : null

  return (
    <Alert variant="default" className="border-amber-500/30 bg-amber-500/[0.06]">
      <Info className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
      <AlertTitle className="text-sm">Segmentos cerrados vs. cronómetro en pantalla</AlertTitle>
      <AlertDescription className="space-y-2 text-xs">
        <p>
          Los totales de este reporte suman <strong>segmentos cerrados</strong> en el período. El cronómetro en la
          pantalla de Montaje puede mostrar menos tiempo si aún hay turnos sin guardar o si quedaron segmentos antiguos
          de prueba en base de datos.
        </p>
        <p>
          Guarde la planilla Montaje para sincronizar turnos recientes
          {aggregateAll ? " (todas las OT del rango)" : ""}.
        </p>
        {montajeOtId != null && Number.isFinite(montajeOtId) ? (
          <Button asChild variant="outline" size="sm" className="mt-1 h-8 border-amber-500/40">
            <Link to={`/ordenes-trabajo/${montajeOtId}/produccion?tab=montaje`}>
              Ir a Montaje{montajeCode ? ` — ${montajeCode}` : ""} (ver tiempos y guardar)
            </Link>
          </Button>
        ) : (
          <p className="text-muted-foreground">
            Seleccione una OT en la pestaña <strong>Órdenes en el rango</strong> para abrir su planilla Montaje.
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
