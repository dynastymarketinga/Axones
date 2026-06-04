"use client"

import { Building2, Eye, FileDown, FileSpreadsheet, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ProductionTimeActionsProps = {
  loadingDownloads: boolean
  onPreview: () => void
  onPdf: () => void
  onExcel: () => void
}

const actionBtnClass =
  "h-9 w-full justify-start gap-2 text-xs font-medium sm:justify-center xl:justify-start"

export function ProductionTimeActions({
  loadingDownloads,
  onPreview,
  onPdf,
  onExcel,
}: ProductionTimeActionsProps) {
  return (
    <div className="space-y-2.5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
        Tiempos del período
      </p>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 xl:grid-cols-1">
        <Button type="button" size="sm" className={actionBtnClass} onClick={onPreview}>
          <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Vista previa
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={actionBtnClass}
          disabled={loadingDownloads}
          onClick={onPdf}
        >
          {loadingDownloads ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          Descargar PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(actionBtnClass, "sm:col-span-1")}
          disabled={loadingDownloads}
          onClick={onExcel}
        >
          {loadingDownloads ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          Descargar Excel
        </Button>
      </div>

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        Resumen general por área y máquina. Exportaciones usan segmentos cerrados; la pantalla puede incluir turnos en
        curso.
      </p>
    </div>
  )
}
