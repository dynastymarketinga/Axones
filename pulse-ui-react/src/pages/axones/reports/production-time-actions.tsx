"use client"

import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { Button } from "@/components/ui/button"

type ProductionTimeActionsProps = {
  loadingPlantPreview: boolean
  loadingOtPreview: boolean
  loadingDownloads: boolean
  canRunOtReport: boolean
  aggregateAll: boolean
  onPlantPreview: () => void
  onPlantPdf: () => void
  onOtPreview: () => void
  onOtPdf: () => void
  onOtExcel: () => void
  onAreaExcel: () => void
  onInkCsv: () => void
}

export function ProductionTimeActions({
  loadingPlantPreview,
  loadingOtPreview,
  loadingDownloads,
  canRunOtReport,
  aggregateAll,
  onPlantPreview,
  onPlantPdf,
  onOtPreview,
  onOtPdf,
  onOtExcel,
  onAreaExcel,
  onInkCsv,
}: ProductionTimeActionsProps) {
  return (
    <ReportFilterSection
      title="Acciones"
      accentClass="text-emerald-800 dark:text-emerald-200"
      dotClass="bg-emerald-500"
      borderClass="border-emerald-500/30 from-emerald-500/[0.07]"
    >
      <p className="text-muted-foreground mb-3 text-xs font-medium">PDF y datos — planta (todas las OT del rango)</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={loadingPlantPreview} onClick={onPlantPreview}>
          {loadingPlantPreview ? "Generando…" : "Vista previa planta"}
        </Button>
        <Button type="button" variant="outline" disabled={loadingDownloads} onClick={onPlantPdf}>
          PDF planta (área y máquina)
        </Button>
        <Button type="button" variant="outline" disabled={loadingDownloads} onClick={onAreaExcel}>
          Descargar Excel (planta)
        </Button>
      </div>

      <p className="text-muted-foreground mb-3 mt-4 text-xs font-medium">
        PDF y datos — orden de trabajo (con motivos de parada)
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={loadingOtPreview || !canRunOtReport}
          onClick={onOtPreview}
        >
          {loadingOtPreview ? "Generando…" : "Vista previa OT"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loadingDownloads || !canRunOtReport}
          onClick={onOtPdf}
        >
          PDF orden de trabajo
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loadingDownloads || !canRunOtReport}
          onClick={onOtExcel}
        >
          Descargar Excel (OT)
        </Button>
      </div>

      <p className="text-muted-foreground mb-3 mt-4 text-xs font-medium">Otros</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={loadingDownloads} onClick={onInkCsv}>
          Consumo tintas por cliente
        </Button>
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        {canRunOtReport ? (
          <>
            Modo OT activo{aggregateAll ? " (agregado de todas las OT del rango)" : ""}. PDF, Excel y vista previa OT
            usan los mismos filtros.
          </>
        ) : (
          <>
            Marque <strong>Agregado de todas las OT del rango</strong> o elija una OT en la pestaña Órdenes para
            habilitar PDF y Excel de OT.
          </>
        )}
      </p>
    </ReportFilterSection>
  )
}
