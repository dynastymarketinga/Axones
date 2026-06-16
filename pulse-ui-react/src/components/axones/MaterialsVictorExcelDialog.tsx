"use client"

import { useCallback, useRef, useState } from "react"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiFetch, ApiError } from "@/lib/api"
import {
  parseVictorExcel,
  exportVictorTemplateExcel,
  type VictorImportRow,
  type VictorParseResult,
} from "@/lib/materials-victor-excel"

type BulkImportResponse = {
  dry_run: boolean
  total_rows: number
  created: number
  updated: number
  stock_adjusted: number
  unchanged: number
  errors: Array<{
    index: number
    sku: string
    sheet_name: string
    row_number: number
    message: string
  }>
}

const AREA_LABELS: Record<string, string> = {
  material: "Sustrato",
  tintas: "Tintas",
  quimicos: "Químicos",
  miscelaneos: "Misceláneos",
}

type MaterialsVictorExcelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function MaterialsVictorExcelDialog({
  open,
  onOpenChange,
  onImported,
}: MaterialsVictorExcelDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parseResult, setParseResult] = useState<VictorParseResult | null>(null)
  const [sourceFilename, setSourceFilename] = useState("")
  const [previewResult, setPreviewResult] = useState<BulkImportResponse | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  const reset = useCallback(() => {
    setParseResult(null)
    setPreviewResult(null)
    setSourceFilename("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const runImport = async (rows: VictorImportRow[], dryRun: boolean) => {
    return apiFetch<BulkImportResponse>("materials/bulk-import", {
      method: "POST",
      body: JSON.stringify({
        dry_run: dryRun,
        source_filename: sourceFilename || undefined,
        rows: rows.map((r) => ({
          sheet_name: r.sheet_name,
          row_number: r.row_number,
          sku: r.sku,
          name: r.name,
          inventory_area: r.inventory_area,
          unit: r.unit,
          micras: r.micras,
          ancho: r.ancho,
          tinta_subarea: r.tinta_subarea,
          quantity: r.quantity,
        })),
      }),
    })
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    setPreviewResult(null)
    try {
      const result = await parseVictorExcel(file)
      setParseResult(result)
      setSourceFilename(file.name)
      if (result.rows.length === 0) {
        toast.error("No se encontraron filas válidas en el Excel.")
        return
      }
      const preview = await runImport(result.rows, true)
      setPreviewResult(preview)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo Excel.")
      reset()
    } finally {
      setParsing(false)
    }
  }

  const handleConfirm = async () => {
    if (!parseResult?.rows.length) return
    setImporting(true)
    try {
      const result = await runImport(parseResult.rows, false)
      if (result.errors.length > 0) {
        toast.warning(
          `Importación parcial: ${result.created} creados, ${result.errors.length} error(es).`,
        )
      } else {
        toast.success(
          `Importación lista: ${result.created} nuevos, ${result.updated} actualizados, ${result.stock_adjusted} ajustes de stock.`,
        )
      }
      onImported()
      handleOpenChange(false)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo importar el inventario.")
    } finally {
      setImporting(false)
    }
  }

  const summary = parseResult?.summary

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" aria-hidden />
            Importar Excel Victor
          </DialogTitle>
          <DialogDescription>
            Carga el formato <strong>INVENTARIO VICTOR.xlsx</strong> (sustratos por hoja, tintas,
            químicos y consumibles). El stock en KG/CANTIDAD quedará igual al del archivo.{" "}
            <a
              href={`${import.meta.env.BASE_URL.replace(/\/?$/, "")}/formato-inventario-victor.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              Ver guía de formato
            </a>
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(ev) => {
            const file = ev.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />

        {!parseResult ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8">
            <Upload className="size-10 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground text-center text-sm">
              Seleccione el archivo .xlsx con las hojas Hoja2–9, TINTAS, QUÍMICOS y COSUMIBLES.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={parsing || downloadingTemplate}
                onClick={() => fileInputRef.current?.click()}
              >
                {parsing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="mr-2 size-4" aria-hidden />
                )}
                Elegir archivo
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={parsing || downloadingTemplate}
                onClick={() => {
                  setDownloadingTemplate(true)
                  void exportVictorTemplateExcel()
                    .then(() => toast.success("Plantilla descargada."))
                    .catch(() => toast.error("No se pudo generar la plantilla."))
                    .finally(() => setDownloadingTemplate(false))
                }}
              >
                {downloadingTemplate ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="mr-2 size-4" aria-hidden />
                )}
                Descargar plantilla vacía
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p>
              Archivo: <strong>{sourceFilename}</strong>
            </p>
            {summary ? (
              <ul className="grid grid-cols-2 gap-2">
                {(Object.keys(summary) as Array<keyof typeof summary>).map((key) => (
                  <li key={key} className="rounded-md bg-muted/60 px-3 py-2">
                    <span className="text-muted-foreground">{AREA_LABELS[key] ?? key}: </span>
                    <strong>{summary[key]}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            <p>
              Total filas: <strong>{parseResult.rows.length}</strong>
            </p>
            {parseResult.issues.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                <p className="font-medium">Avisos ({parseResult.issues.length})</p>
                <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-4 text-xs">
                  {parseResult.issues.slice(0, 8).map((issue, i) => (
                    <li key={i}>
                      {issue.sheet_name} fila {issue.row_number}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {previewResult ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="font-medium">Vista previa (sin guardar)</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {previewResult.created} nuevos · {previewResult.updated} actualizados ·{" "}
                  {previewResult.stock_adjusted} ajustes de stock · {previewResult.unchanged} sin
                  cambios
                </p>
                {previewResult.errors.length > 0 ? (
                  <p className="mt-1 text-destructive text-xs">
                    {previewResult.errors.length} error(es) en vista previa
                  </p>
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0"
              onClick={() => {
                reset()
                fileInputRef.current?.click()
              }}
            >
              Elegir otro archivo
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!parseResult?.rows.length || importing || parsing || !previewResult}
            onClick={() => void handleConfirm()}
          >
            {importing ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
            Confirmar importación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
