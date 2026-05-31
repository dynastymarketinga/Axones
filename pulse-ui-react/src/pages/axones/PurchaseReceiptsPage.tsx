"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Barcode,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  Hash,
  Layers,
  ListOrdered,
  PackagePlus,
  Printer,
  Ruler,
  Settings2,
  Truck,
  Type,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogPaginationOutlineButtonClass,
  catalogPaginationSelectTriggerClass,
  catalogSelectTriggerClass,
} from "@/components/axones/catalog-list-classes"
import { InlineSpinner, LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatDateInputDisplay, parseDateInputValue, toDateInputValue } from "@/pages/axones/purchase-document-form-ui"
import { formatDateTime } from "@/pages/axones/purchase-order-shared"
import "./purchase-order-list.css"

type ReceiptRow = {
  id: number
  purchase_order_id?: number | null
  without_purchase_order?: boolean
  supplier_id?: number | null
  supplier_name?: string | null
  supplier?: {
    id: number
    name: string
    rif?: string | null
  } | null
  invoice_number?: string | null
  purchase_order_reference?: string | null
  received_at: string | null
  lines_count?: number
  lines?: Array<{
    item_type?: string | null
    quantity?: string | number | null
    unit?: string | null
    micras?: string | number | null
    ancho_mm?: string | number | null
    material?: {
      sku?: string | null
      name?: string | null
    } | null
  }>
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

const poActionIconBase =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm"

const poActionPrintClass = cn(
  poActionIconBase,
  "border-sky-400/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400",
)
const poActionEyeClass = cn(
  poActionIconBase,
  "border-violet-400/50 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400",
)

function receiptSupplierLabel(row: ReceiptRow): string {
  return row.supplier?.name || row.supplier_name || "—"
}

function receiptSupplierLabelNullable(row: ReceiptRow | null | undefined): string {
  if (!row) return "—"
  return receiptSupplierLabel(row)
}

function formatReceiptCode(id: number | null | undefined): string {
  const n = Number(id)
  if (!Number.isFinite(n) || n < 1) return "REC-———"
  return `REC-${String(Math.trunc(n)).padStart(6, "0")}`
}

function receiptMaterialNames(row: ReceiptRow): string[] {
  return Array.from(
    new Set(
      (row.lines ?? [])
        .map((line) => line.material)
        .filter((material): material is NonNullable<typeof material> => Boolean(material))
        .map((material) => (material.name || "").trim())
        .filter(Boolean),
    ),
  )
}

function receiptMaterialNamesSummary(row: ReceiptRow): string {
  const unique = receiptMaterialNames(row)
  if (!unique.length) return "—"
  if (unique.length <= 2) return unique.join(" · ")
  return `${unique.slice(0, 2).join(" · ")} +${unique.length - 2} más`
}

export default function PurchaseReceiptsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(() => {
    const n = Number(searchParams.get("page") || "1")
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
  })
  const [perPage, setPerPage] = useState(20)

  const [supplierInput, setSupplierInput] = useState(() => searchParams.get("supplier_name")?.trim() ?? "")
  const [invoiceInput, setInvoiceInput] = useState(() => searchParams.get("invoice_number")?.trim() ?? "")
  const [materialInput, setMaterialInput] = useState(() => searchParams.get("material_term")?.trim() ?? "")
  const [fromInput, setFromInput] = useState(() => searchParams.get("from")?.trim() ?? "")
  const [toInput, setToInput] = useState(() => searchParams.get("to")?.trim() ?? "")

  const [supplierFilter, setSupplierFilter] = useState(supplierInput)
  const [invoiceFilter, setInvoiceFilter] = useState(invoiceInput)
  const [materialFilter, setMaterialFilter] = useState(materialInput)
  const [fromFilter, setFromFilter] = useState(fromInput)
  const [toFilter, setToFilter] = useState(toInput)

  const textDebounceRef = useRef<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ReceiptRow> | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRow | null>(null)
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<ReceiptRow | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (textDebounceRef.current) window.clearTimeout(textDebounceRef.current)
    textDebounceRef.current = window.setTimeout(() => {
      setSupplierFilter(supplierInput.trim())
      setInvoiceFilter(invoiceInput.trim())
      setMaterialFilter(materialInput.trim())
      setPage(1)
    }, 320)
    return () => {
      if (textDebounceRef.current) window.clearTimeout(textDebounceRef.current)
    }
  }, [supplierInput, invoiceInput, materialInput])

  useEffect(() => {
    if (fromInput && toInput && fromInput > toInput) {
      toast.error("La fecha desde no puede ser mayor que la fecha hasta.")
      return
    }
    setFromFilter(fromInput)
    setToFilter(toInput)
    setPage(1)
  }, [fromInput, toInput])

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set("page", String(page))
    if (supplierFilter) next.set("supplier_name", supplierFilter)
    if (invoiceFilter) next.set("invoice_number", invoiceFilter)
    if (materialFilter) next.set("material_term", materialFilter)
    if (fromFilter) next.set("from", fromFilter)
    if (toFilter) next.set("to", toFilter)
    setSearchParams(next, { replace: true })
  }, [page, supplierFilter, invoiceFilter, materialFilter, fromFilter, toFilter, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ReceiptRow>>("purchase-receipts", {
        query: {
          page,
          per_page: perPage,
          supplier_name: supplierFilter || undefined,
          invoice_number: invoiceFilter || undefined,
          material_term: materialFilter || undefined,
          from: fromFilter || undefined,
          to: toFilter || undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las recepciones.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [fromFilter, invoiceFilter, materialFilter, page, perPage, supplierFilter, toFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedReceipt?.id) {
      setSelectedReceiptDetail(null)
      return
    }

    let cancelled = false
    void (async () => {
      setLoadingDetail(true)
      try {
        const data = await apiFetch<ReceiptRow>(`purchase-receipts/${selectedReceipt.id}`)
        if (!cancelled) setSelectedReceiptDetail(data)
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudieron cargar los detalles de la recepción.")
        if (!cancelled) setSelectedReceiptDetail(null)
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedReceipt?.id])

  const showInitialSkeleton = loading && rows === null

  function openDetail(row: ReceiptRow) {
    setSelectedRowId(row.id)
    setSelectedReceipt(row)
  }

  return (
    <div className="po-list-shell">
      <CatalogPageShell
        title="Recepción de material"
        subtitle="Historial de ingresos registrados en inventario: factura, proveedor y cruce con órdenes de compra."
        icon={PackagePlus}
        action={
          <Button type="button" asChild className="shadow-sm">
            <Link to="/recepciones-nueva">
              <PackagePlus className="mr-2 size-4" aria-hidden />
              Nueva recepción
            </Link>
          </Button>
        }
      >
        {showInitialSkeleton ? (
          <div className="space-y-4">
            <PageLoadingBlock />
            <PageLoadingBlock />
          </div>
        ) : (
          <>
            <div className="po-filter-bar space-y-4 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="size-4 text-primary" aria-hidden />
                <p className="text-sm font-medium">Filtrar listado</p>
              </div>
              <div className="grid gap-3 md:grid-cols-12">
                <CatalogLabeledField label="Fecha desde" className="md:col-span-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-11 w-full justify-between font-normal",
                          catalogSelectTriggerClass,
                          !fromInput && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">
                          {fromInput ? formatDateInputDisplay(fromInput) : "Seleccione…"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <UiCalendar
                        mode="single"
                        selected={parseDateInputValue(fromInput)}
                        onSelect={(date) => setFromInput(date ? toDateInputValue(date) : "")}
                      />
                    </PopoverContent>
                  </Popover>
                </CatalogLabeledField>
                <CatalogLabeledField label="Fecha hasta" className="md:col-span-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-11 w-full justify-between font-normal",
                          catalogSelectTriggerClass,
                          !toInput && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">
                          {toInput ? formatDateInputDisplay(toInput) : "Seleccione…"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <UiCalendar
                        mode="single"
                        selected={parseDateInputValue(toInput)}
                        onSelect={(date) => setToInput(date ? toDateInputValue(date) : "")}
                      />
                    </PopoverContent>
                  </Popover>
                </CatalogLabeledField>
                <CatalogLabeledField label="Proveedor" icon={Truck} className="md:col-span-3">
                  <Input
                    id="rc-filter-supplier"
                    placeholder="Nombre de proveedor…"
                    value={supplierInput}
                    className={cn("h-11", catalogSelectTriggerClass)}
                    onChange={(ev) => setSupplierInput(ev.target.value)}
                  />
                </CatalogLabeledField>
                <CatalogLabeledField label="N° Factura" icon={Hash} className="md:col-span-2">
                  <Input
                    id="rc-filter-invoice"
                    placeholder="Número de factura…"
                    value={invoiceInput}
                    maxLength={15}
                    className={cn("h-11 uppercase", catalogSelectTriggerClass)}
                    onChange={(ev) => setInvoiceInput(ev.target.value.toUpperCase().slice(0, 15))}
                  />
                </CatalogLabeledField>
                <CatalogSearchField
                  id="rc-filter-material"
                  label="Material"
                  placeholder="Buscar por nombre o SKU…"
                  value={materialInput}
                  onChange={(ev) => setMaterialInput(ev.target.value)}
                  className="md:col-span-3"
                />
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Listado de entradas físicas al inventario. Use los filtros para acotar por fecha,
                proveedor, factura o material. Para registrar una nueva entrada use{" "}
                <Link to="/recepciones-nueva" className="text-primary underline underline-offset-4">
                  Nueva recepción
                </Link>
                .
              </p>
            </div>

            <div className="po-table-wrap overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <CatalogTableHead icon={ListOrdered} className="w-14">
                      N.º
                    </CatalogTableHead>
                    <CatalogTableHead icon={Barcode}>Recepción</CatalogTableHead>
                    <CatalogTableHead icon={Truck}>Proveedor</CatalogTableHead>
                    <CatalogTableHead icon={Layers} className="min-w-[10rem]">
                      Material
                    </CatalogTableHead>
                    <CatalogTableHead icon={Hash}>N° Factura</CatalogTableHead>
                    <CatalogTableHead icon={ClipboardList}>N° OC</CatalogTableHead>
                    <CatalogTableHead icon={CalendarDays} className="po-col-date whitespace-nowrap">
                      Fecha recepción
                    </CatalogTableHead>
                    <CatalogTableHeadRight icon={Settings2} className="whitespace-nowrap">
                      Acciones
                    </CatalogTableHeadRight>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingTableRow colSpan={8} />
                  ) : !rows?.data.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground">
                        Sin recepciones registradas con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((r, rowIndex) => {
                      const rowNum = (rows.from ?? 1) + rowIndex
                      return (
                        <TableRow
                          key={r.id}
                          data-selected={selectedRowId === r.id ? "true" : "false"}
                          className={cn(
                            "border-b transition-colors",
                            selectedRowId === r.id && "bg-primary/5",
                          )}
                        >
                          <TableCell className="p-3 align-middle tabular-nums text-muted-foreground">
                            {rowNum}
                          </TableCell>
                          <TableCell className="p-3 align-middle">
                            <span className="po-code-pill">{formatReceiptCode(r.id)}</span>
                          </TableCell>
                          <TableCell className="p-3 align-middle font-medium">
                            {receiptSupplierLabel(r)}
                          </TableCell>
                          <TableCell
                            className="max-w-[16rem] truncate p-3 align-middle text-sm"
                            title={receiptMaterialNamesSummary(r)}
                          >
                            {receiptMaterialNamesSummary(r)}
                          </TableCell>
                          <TableCell className="p-3 align-middle tabular-nums">
                            {r.invoice_number || "—"}
                          </TableCell>
                          <TableCell className="p-3 align-middle">
                            {r.without_purchase_order ? (
                              <span className="text-muted-foreground text-xs font-medium">Sin OC</span>
                            ) : (
                              r.purchase_order_reference || "—"
                            )}
                          </TableCell>
                          <TableCell className="po-col-date p-3 align-middle text-sm">
                            {formatDateTime(r.received_at)}
                          </TableCell>
                          <TableCell className="p-3 align-middle text-right">
                            <div className="inline-flex justify-end gap-1">
                              <button
                                type="button"
                                className={poActionEyeClass}
                                title="Ver detalle"
                                aria-label="Ver detalle de la recepción"
                                onClick={() => openDetail(r)}
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">Ver detalle</span>
                              </button>
                              <Link
                                to={`/recepciones-oc/${r.id}/vista-previa`}
                                className={poActionPrintClass}
                                title="Vista previa / PDF"
                              >
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">Vista previa</span>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {rows ? (
              <div className="po-pagination-bar">
                <div className="po-pagination-meta">
                  <p className="text-sm">
                    {rows.total === 0 ? (
                      "Sin resultados con los filtros actuales."
                    ) : (
                      <>
                        Mostrando <strong>{rows.from ?? 0}</strong> a <strong>{rows.to ?? 0}</strong> de{" "}
                        <strong>{rows.total}</strong> registros
                      </>
                    )}
                  </p>
                  {rows.last_page > 1 ? (
                    <p className="text-muted-foreground text-xs">
                      Página {rows.current_page} de {rows.last_page}
                    </p>
                  ) : null}
                </div>
                <div className="po-pagination-controls">
                  {rows.last_page > 1 ? (
                    <span className="po-page-indicator">
                      {rows.current_page} / {rows.last_page}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Por página</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={(v) => {
                        setPerPage(Number(v))
                        setPage(1)
                      }}
                    >
                      <SelectTrigger
                        id="purchase-receipts-per-page"
                        className={cn("h-9 w-[4.75rem] text-sm", catalogPaginationSelectTriggerClass)}
                        aria-label="Registros por página"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_PAGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={String(opt)}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-9 px-3", catalogPaginationOutlineButtonClass)}
                      disabled={rows.current_page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      type="button"
                    >
                      <ChevronLeft className="mr-1 size-4" aria-hidden />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-9 px-3", catalogPaginationOutlineButtonClass)}
                      disabled={rows.current_page >= rows.last_page || loading}
                      onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
                      type="button"
                    >
                      Siguiente
                      <ChevronRight className="ml-1 size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        <Dialog
          open={selectedReceipt !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReceipt(null)
              setSelectedReceiptDetail(null)
              setSelectedRowId(null)
            }
          }}
        >
          <DialogContent className="po-detail-dialog flex w-[min(calc(100vw-1.5rem),48rem)] max-w-none flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-none">
            <DialogHeader className="po-detail-dialog-header space-y-0 px-6 pb-4 pt-6 text-left">
              <DialogTitle className="text-xl">
                Detalle {formatReceiptCode(selectedReceiptDetail?.id ?? selectedReceipt?.id)}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Resumen operativo de la recepción y detalle de líneas / materiales.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="po-detail-hero grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-xs">Proveedor</p>
                  <p className="text-sm font-medium">
                    {receiptSupplierLabelNullable(selectedReceiptDetail ?? selectedReceipt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">N° Factura</p>
                  <p className="text-sm font-medium">
                    {selectedReceiptDetail?.invoice_number || selectedReceipt?.invoice_number || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fecha recepción</p>
                  <p className="text-sm font-medium">
                    {formatDateTime(
                      selectedReceiptDetail?.received_at ?? selectedReceipt?.received_at ?? null,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">N° OC (referencia)</p>
                  <p className="text-sm font-medium">
                    {selectedReceiptDetail?.purchase_order_reference ||
                      selectedReceipt?.purchase_order_reference ||
                      "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Líneas</p>
                  <p className="text-sm font-medium tabular-nums">
                    {selectedReceiptDetail?.lines_count ??
                      selectedReceiptDetail?.lines?.length ??
                      selectedReceipt?.lines_count ??
                      selectedReceipt?.lines?.length ??
                      "—"}
                  </p>
                </div>
              </div>

              <div className="po-table-wrap max-h-[52vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <CatalogTableHead icon={Barcode}>SKU</CatalogTableHead>
                      <CatalogTableHead icon={Layers}>Material</CatalogTableHead>
                      <CatalogTableHead icon={Type}>Tipo</CatalogTableHead>
                      <CatalogTableHead icon={Hash} className="text-right">
                        Cantidad
                      </CatalogTableHead>
                      <CatalogTableHead icon={Ruler}>Unidad</CatalogTableHead>
                      <CatalogTableHead icon={Ruler} className="text-right">
                        Micras
                      </CatalogTableHead>
                      <CatalogTableHead icon={Ruler} className="text-right">
                        Ancho
                      </CatalogTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingDetail ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <InlineSpinner />
                            Cargando detalle…
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : selectedReceiptDetail?.lines?.length ? (
                      selectedReceiptDetail.lines.map((line, index) => (
                        <TableRow key={`${selectedReceiptDetail.id}-${index}-${line.material?.sku || "linea"}`}>
                          <TableCell>{line.material?.sku || "—"}</TableCell>
                          <TableCell>{line.material?.name || "—"}</TableCell>
                          <TableCell>{line.item_type || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{line.quantity ?? "—"}</TableCell>
                          <TableCell>{line.unit || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{line.micras ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{line.ancho_mm ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground">
                          Sin detalle de líneas para esta recepción.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CatalogPageShell>
    </div>
  )
}
