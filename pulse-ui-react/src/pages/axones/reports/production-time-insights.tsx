"use client"

import { Link } from "react-router-dom"
import { Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  areasWithRecordedTime,
  groupLiveActiveByArea,
  PRODUCTION_AREA_LABELS,
  PRODUCTION_AREA_TAB,
  PRODUCTION_SEGMENT_TYPE_LABELS,
  type ProductionAreaKey,
  type ProductionTimeAreaSummaryRow,
  type ProductionTimeLiveActiveEntry,
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
    <Alert className="border-primary/25 bg-primary/[0.06] py-3">
      <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <AlertTitle className="text-sm leading-snug">Solo {label} en este período</AlertTitle>
      <AlertDescription className="text-xs leading-relaxed">
        En el rango, el tiempo proviene solo del área <strong>{label}</strong>. Consulte{" "}
        <strong>Tiempos por área</strong> para detalle por máquina.
      </AlertDescription>
    </Alert>
  )
}

type ProductionTimeLiveActiveListProps = {
  entries: ProductionTimeLiveActiveEntry[]
}

function ProductionTimeLiveActiveList({ entries }: ProductionTimeLiveActiveListProps) {
  const grouped = groupLiveActiveByArea(entries)

  if (grouped.length === 0) {
    return (
      <p className="text-muted-foreground">
        Ningún cronómetro activo en planta en este momento (dentro del período).
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ area, label, items }) => (
        <div key={area} className="space-y-1.5">
          <p className="text-foreground text-xs font-semibold tracking-wide">{label}</p>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="list">
            {items.map((item) => {
              const tab = PRODUCTION_AREA_TAB[area]
              const types = item.segment_types ?? []
              const machines = item.machine_codes ?? []
              return (
                <li key={`${area}-${item.work_order_id}`}>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-8 w-full max-w-full justify-start gap-2 whitespace-normal px-3 py-1.5 text-left sm:w-auto"
                  >
                    <Link to={`/ordenes-trabajo/${item.work_order_id}/produccion?tab=${tab}`}>
                      <span className="font-medium">{item.work_order_code || `OT #${item.work_order_id}`}</span>
                      {types.length > 0 ? (
                        <span className="text-muted-foreground flex flex-wrap gap-1">
                          {types.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="h-5 px-1.5 text-[10px] font-normal"
                            >
                              {PRODUCTION_SEGMENT_TYPE_LABELS[t] ?? t}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                          Turno en curso
                        </Badge>
                      )}
                      {machines.length > 0 ? (
                        <span className="text-muted-foreground w-full text-[10px] sm:w-auto">
                          {machines.join(" · ")}
                        </span>
                      ) : null}
                    </Link>
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

type ProductionTimeSegmentNoticeProps = {
  candidates: WorkOrderTimeCandidate[]
  woId: string
  aggregateAll: boolean
  includeLive: boolean
  liveAsOf?: string | null
  liveActive?: ProductionTimeLiveActiveEntry[]
}

export function ProductionTimeSegmentNotice({
  candidates: _candidates,
  woId: _woId,
  aggregateAll,
  includeLive,
  liveAsOf,
  liveActive = [],
}: ProductionTimeSegmentNoticeProps) {
  return (
    <Alert
      variant="default"
      className={cn(
        "py-3",
        includeLive
          ? "border-sky-500/30 bg-sky-500/[0.06]"
          : "border-amber-500/30 bg-amber-500/[0.06]",
      )}
    >
      <Info
        className={cn(
          "h-4 w-4 shrink-0",
          includeLive
            ? "text-sky-700 dark:text-sky-300"
            : "text-amber-700 dark:text-amber-300",
        )}
        aria-hidden
      />
      <AlertTitle className="text-sm leading-snug">
        {includeLive ? "Vista en tiempo real activa" : "Segmentos cerrados vs. cronómetro"}
      </AlertTitle>
      <AlertDescription className="space-y-2 text-xs leading-relaxed">
        {includeLive ? (
          <>
            <p>
              Incluye <strong>turnos en curso</strong>.
              {liveAsOf ? (
                <>
                  {" "}
                  Actualizado{" "}
                  <strong>
                    {new Date(liveAsOf).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </strong>
                  .
                </>
              ) : null}{" "}
              PDF/Excel = solo cerrados.
            </p>
            <p className="text-muted-foreground">
              Cronómetros activos por área (todas las OT con temporizador encendido):
            </p>
            <ProductionTimeLiveActiveList entries={liveActive} />
          </>
        ) : (
          <>
            <p>
              Totales = <strong>segmentos cerrados</strong>. Active tiempo real en filtros para ver cronómetros en
              planta.
            </p>
            <p>
              Guarde planilla Montaje para sincronizar
              {aggregateAll ? " (todas las OT)" : ""}.
            </p>
            <p className="text-muted-foreground">
              Elija una OT en <strong>Órdenes en el rango</strong> para abrir su detalle.
            </p>
          </>
        )}
      </AlertDescription>
    </Alert>
  )
}
