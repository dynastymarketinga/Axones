"use client"

import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  PRINTING_PLANILLA_PREVIEW_STORAGE_PREFIX,
  type PrintingPlanillaPreviewPayload,
} from "@/lib/printing-planilla-preview"
import { PrintingPlanillaPaperSheet } from "./PrintingPlanillaPaperSheet"

function readPayload(id: number): PrintingPlanillaPreviewPayload | null {
  if (!Number.isFinite(id) || id < 1) return null
  try {
    const raw = localStorage.getItem(`${PRINTING_PLANILLA_PREVIEW_STORAGE_PREFIX}${id}`)
    if (!raw) return null
    return JSON.parse(raw) as PrintingPlanillaPreviewPayload
  } catch {
    return null
  }
}

export default function WorkOrderPrintingPlanillaPreviewPage() {
  const { woId } = useParams()
  const id = Number(woId ?? "")

  const payload = useMemo(() => readPayload(id), [id])
  const sheets = payload?.sheets ?? []

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 md:p-6 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Vista previa · Planilla de impresión</h1>
            <p className="text-muted-foreground text-sm">
              Réplica de la planilla física «Control de producción de impresión». Una hoja por turno guardado.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to={`/ordenes-trabajo/${Number.isFinite(id) ? id : ""}/produccion?tab=printing`}>
                Volver a impresión
              </Link>
            </Button>
            <Button type="button" onClick={() => window.print()} disabled={!payload}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      {!payload ? (
        <div className="mx-auto max-w-xl rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground print:hidden">
          No hay datos de vista previa. Tras «Finalizar área de impresión», pulse{" "}
          <span className="font-semibold text-foreground">Vista previa</span> en la bandeja o en la OT.
        </div>
      ) : (
        <div className="printing-planilla-paper-root px-2 pb-8 print:p-0">
          {sheets.map((sheet, idx) => (
            <PrintingPlanillaPaperSheet
              key={sheet.turno_id}
              sheet={sheet}
              sheetIndex={idx}
              sheetTotal={sheets.length}
            />
          ))}
        </div>
      )}
    </div>
  )
}
