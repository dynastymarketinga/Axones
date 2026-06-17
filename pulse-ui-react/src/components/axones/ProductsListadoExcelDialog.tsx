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
  exportListadoProductosTemplateExcel,
  parseListadoProductosExcel,
  type ListadoImportClient,
  type ListadoImportProduct,
  type ListadoParseResult,
} from "@/lib/products-listado-excel"

type BulkImportResponse = {
  dry_run: boolean
  total_clients: number
  total_products: number
  clients_created: number
  clients_updated: number
  products_created: number
  products_updated: number
  unchanged: number
  errors: Array<{
    index: number
    kind: string
    sheet_name: string
    row_number: number
    name: string
    message: string
  }>
}

type ProductsListadoExcelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function ProductsListadoExcelDialog({
  open,
  onOpenChange,
  onImported,
}: ProductsListadoExcelDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parseResult, setParseResult] = useState<ListadoParseResult | null>(null)
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

  const runImport = async (
    clients: ListadoImportClient[],
    products: ListadoImportProduct[],
    dryRun: boolean,
    filename = sourceFilename,
  ) => {
    return apiFetch<BulkImportResponse>("products/bulk-import", {
      method: "POST",
      body: JSON.stringify({
        dry_run: dryRun,
        source_filename: filename || undefined,
        clients: clients.map((c) => ({
          nombre_cliente: c.nombre_cliente,
          rif: c.rif,
          sheet_name: c.sheet_name,
          row_number: c.row_number,
        })),
        products: products.map((p) => ({
          producto: p.producto,
          nombre_cliente: p.nombre_cliente,
          rif_cliente: p.rif_cliente,
          cpe: p.cpe,
          mps: p.mps,
          cod_barra: p.cod_barra,
          sheet_name: p.sheet_name,
          row_number: p.row_number,
        })),
      }),
    })
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    setPreviewResult(null)
    try {
      const result = await parseListadoProductosExcel(file)
      setParseResult(result)
      setSourceFilename(file.name)
      if (result.products.length === 0) {
        toast.error("No se encontraron productos válidos en el Excel.")
        return
      }
      const preview = await runImport(result.clients, result.products, true, file.name)
      setPreviewResult(preview)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el archivo Excel.")
      reset()
    } finally {
      setParsing(false)
    }
  }

  const handleConfirm = async () => {
    if (!parseResult?.products.length) return
    setImporting(true)
    try {
      const result = await runImport(parseResult.clients, parseResult.products, false)
      if (result.errors.length > 0) {
        toast.warning(
          `Importación parcial: ${result.products_created} productos nuevos, ${result.errors.length} error(es).`,
        )
      } else {
        toast.success(
          `Importación lista: ${result.clients_created} clientes nuevos, ${result.products_created} especificaciones nuevas, ${result.products_updated} actualizadas.`,
        )
      }
      onImported()
      handleOpenChange(false)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo importar el listado de productos.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" aria-hidden />
            Importar listado de productos
          </DialogTitle>
          <DialogDescription>
            Carga el formato <strong>LISTADO DE PRODUCTOS.xlsx</strong> (original de planta u organizado
            con hojas CLIENTES + PRODUCTOS). Se crearán o actualizarán clientes y especificaciones.{" "}
            <a
              href={`${import.meta.env.BASE_URL.replace(/\/?$/, "")}/formato-listado-productos.md`}
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
              Seleccione el archivo .xlsx con producto, cliente (nombre + RIF), CPE, M.P.P.S y código de
              barra.
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
                  void exportListadoProductosTemplateExcel()
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
              Archivo: <strong>{sourceFilename}</strong> · Formato:{" "}
              <strong>{parseResult.format === "organizado" ? "organizado" : "original"}</strong>
            </p>
            <ul className="grid grid-cols-2 gap-2">
              <li className="rounded-md bg-muted/60 px-3 py-2">
                <span className="text-muted-foreground">Clientes: </span>
                <strong>{parseResult.clients.length}</strong>
              </li>
              <li className="rounded-md bg-muted/60 px-3 py-2">
                <span className="text-muted-foreground">Productos: </span>
                <strong>{parseResult.products.length}</strong>
              </li>
            </ul>
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
                  {previewResult.clients_created} clientes nuevos · {previewResult.clients_updated}{" "}
                  clientes actualizados · {previewResult.products_created} productos nuevos ·{" "}
                  {previewResult.products_updated} productos actualizados · {previewResult.unchanged} sin
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
            disabled={!parseResult?.products.length || importing || parsing || !previewResult}
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
