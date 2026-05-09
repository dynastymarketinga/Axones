"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CalendarDays, Eraser, Eye, FileText, Hash, ListOrdered, Search, Tags, Truck } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
import {
  AXONES_INVENTORY_FILTER_INPUT_CLASS,
  AXONES_INVENTORY_PAGE_CLASS,
  AxonesInventoryModuleNav,
  AxonesPageHeader,
  AxonesTableCard,
} from "@/components/axones/inventory-page-layout"
import { InlineSpinner, LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ReceiptRow = {
  id: number
  purchase_order_id?: number | null
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

function formatApiDateToDisplay(value: string): string {
  const trimmed = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return "01/01/2001"
  return `${match[3]}/${match[2]}/${match[1]}`
}

function parseApiDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined
  }
  return parsed
}

function formatDateToApi(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

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

export default function PurchaseReceiptsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialPage = Number(searchParams.get("page") || "1")
  const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1)
  const [supplierInput, setSupplierInput] = useState(searchParams.get("supplier_name") || "")
  const [invoiceInput, setInvoiceInput] = useState(searchParams.get("invoice_number") || "")
  const [materialInput, setMaterialInput] = useState(searchParams.get("material_term") || "")
  const [fromInput, setFromInput] = useState(searchParams.get("from") || "")
  const [toInput, setToInput] = useState(searchParams.get("to") || "")
  const [supplierFilter, setSupplierFilter] = useState(searchParams.get("supplier_name") || "")
  const [invoiceFilter, setInvoiceFilter] = useState(searchParams.get("invoice_number") || "")
  const [materialFilter, setMaterialFilter] = useState(searchParams.get("material_term") || "")
  const [fromFilter, setFromFilter] = useState(searchParams.get("from") || "")
  const [toFilter, setToFilter] = useState(searchParams.get("to") || "")
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ReceiptRow> | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRow | null>(null)
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<ReceiptRow | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  function syncQuery(next: {
    page: number
    supplier_name?: string
    invoice_number?: string
    material_term?: string
    from?: string
    to?: string
  }) {
    const params = new URLSearchParams()
    if (next.page > 1) params.set("page", String(next.page))
    if (next.supplier_name) params.set("supplier_name", next.supplier_name)
    if (next.invoice_number) params.set("invoice_number", next.invoice_number)
    if (next.material_term) params.set("material_term", next.material_term)
    if (next.from) params.set("from", next.from)
    if (next.to) params.set("to", next.to)
    setSearchParams(params)
  }

  function setPageAndQuery(nextPage: number) {
    setPage(nextPage)
    syncQuery({
      page: nextPage,
      supplier_name: supplierFilter || undefined,
      invoice_number: invoiceFilter || undefined,
      material_term: materialFilter || undefined,
      from: fromFilter || undefined,
      to: toFilter || undefined,
    })
  }

  function applyFilters() {
    if (fromInput && toInput && fromInput > toInput) {
      toast.error("La fecha desde no puede ser mayor que la fecha hasta.")
      return
    }

    setPage(1)
    const supplier = supplierInput.trim()
    const invoice = invoiceInput.trim()
    const material = materialInput.trim()
    setSupplierFilter(supplier)
    setInvoiceFilter(invoice)
    setMaterialFilter(material)
    setFromFilter(fromInput)
    setToFilter(toInput)
    syncQuery({
      page: 1,
      supplier_name: supplier || undefined,
      invoice_number: invoice || undefined,
      material_term: material || undefined,
      from: fromInput || undefined,
      to: toInput || undefined,
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ReceiptRow>>(
        "purchase-receipts",
        {
          query: {
            page,
            per_page: 20,
            supplier_name: supplierFilter || undefined,
            invoice_number: invoiceFilter || undefined,
            material_term: materialFilter || undefined,
            from: fromFilter || undefined,
            to: toFilter || undefined,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las recepciones.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [fromFilter, invoiceFilter, materialFilter, page, supplierFilter, toFilter])

  useEffect(() => {
    const nextSupplier = searchParams.get("supplier_name") || ""
    const nextInvoice = searchParams.get("invoice_number") || ""
    const nextMaterial = searchParams.get("material_term") || ""
    const nextFrom = searchParams.get("from") || ""
    const nextTo = searchParams.get("to") || ""
    const nextPageRaw = Number(searchParams.get("page") || "1")
    const nextPage = Number.isFinite(nextPageRaw) && nextPageRaw > 0 ? nextPageRaw : 1

    setSupplierInput(nextSupplier)
    setInvoiceInput(nextInvoice)
    setMaterialInput(nextMaterial)
    setFromInput(nextFrom)
    setToInput(nextTo)
    setSupplierFilter(nextSupplier)
    setInvoiceFilter(nextInvoice)
    setMaterialFilter(nextMaterial)
    setFromFilter(nextFrom)
    setToFilter(nextTo)
    setPage(nextPage)
  }, [searchParams])

  function receiptSkus(row: ReceiptRow) {
    return Array.from(new Set((row.lines ?? [])
      .map((line) => line.material)
      .filter((material): material is NonNullable<typeof material> => Boolean(material))
      .map((material) => {
        const sku = (material.sku || "").trim()
        return sku
      })
      .filter(Boolean)))
  }

  function receiptSkuSummary(row: ReceiptRow) {
    const unique = receiptSkus(row)
    if (!unique.length) return "—"
    if (unique.length <= 2) return unique.join(" · ")
    return `${unique.slice(0, 2).join(" · ")} +${unique.length - 2} más`
  }

  useEffect(() => {
    void load()
  }, [load])

  const showInitialSkeleton = loading && rows === null

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

  return (
    <div className={AXONES_INVENTORY_PAGE_CLASS}>
      <AxonesPageHeader
        title="Recepción de material"
        description="Historial de ingresos registrados en inventario."
        actions={
          <Button type="button" asChild>
            <Link to="/recepciones-nueva">Nueva recepción</Link>
          </Button>
        }
      />

      <AxonesInventoryModuleNav active="recepciones-oc" />

      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <AxonesTableCard>
          <div className="border-b p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12">
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor="receipt-from" className="inline-flex items-center gap-2 font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Fecha desde
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="receipt-from"
                type="button"
                variant="outline"
                className={`w-full justify-start text-left font-normal ${AXONES_INVENTORY_FILTER_INPUT_CLASS}`}
              >
                {formatApiDateToDisplay(fromInput)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <UiCalendar
                mode="single"
                selected={parseApiDate(fromInput)}
                onSelect={(date) => setFromInput(date ? formatDateToApi(date) : "")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor="receipt-to" className="inline-flex items-center gap-2 font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Fecha hasta
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="receipt-to"
                type="button"
                variant="outline"
                className={`w-full justify-start text-left font-normal ${AXONES_INVENTORY_FILTER_INPUT_CLASS}`}
              >
                {formatApiDateToDisplay(toInput)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <UiCalendar
                mode="single"
                selected={parseApiDate(toInput)}
                onSelect={(date) => setToInput(date ? formatDateToApi(date) : "")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor="receipt-supplier" className="inline-flex items-center gap-2 font-semibold text-foreground">
            <Truck className="h-4 w-4 text-primary" />
            Proveedor
          </Label>
          <Input
            id="receipt-supplier"
            placeholder="Nombre de proveedor..."
            value={supplierInput}
            className={AXONES_INVENTORY_FILTER_INPUT_CLASS}
            onChange={(ev) => setSupplierInput(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") applyFilters()
            }}
          />
        </div>
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor="receipt-invoice" className="inline-flex items-center gap-2 font-semibold text-foreground">
            <Hash className="h-4 w-4 text-primary" />
            N° Factura
          </Label>
          <Input
            id="receipt-invoice"
            placeholder="Número de factura..."
            value={invoiceInput}
            className={AXONES_INVENTORY_FILTER_INPUT_CLASS}
            onChange={(ev) => setInvoiceInput(ev.target.value.toUpperCase().slice(0, 15))}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") applyFilters()
            }}
          />
        </div>
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor="receipt-material" className="inline-flex items-center gap-2 font-semibold text-foreground">
            <Tags className="h-4 w-4 text-primary" />
            Código
          </Label>
          <Input
            id="receipt-material"
            placeholder="Código de material..."
            value={materialInput}
            className={AXONES_INVENTORY_FILTER_INPUT_CLASS}
            onChange={(ev) => setMaterialInput(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") applyFilters()
            }}
          />
        </div>
        <div className="flex w-full items-end gap-2 xl:col-span-2 xl:justify-end">
          <Button
            type="button"
            onClick={applyFilters}
            className="flex-1 px-3 sm:min-w-28 sm:px-4 lg:flex-1 xl:min-w-40 xl:flex-none xl:px-6"
          >
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Limpiar filtros"
                  className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                  onClick={() => {
                    setPage(1)
                    setSupplierInput("")
                    setInvoiceInput("")
                    setMaterialInput("")
                    setFromInput("")
                    setToInput("")
                    setSupplierFilter("")
                    setInvoiceFilter("")
                    setMaterialFilter("")
                    setFromFilter("")
                    setToFilter("")
                    setSearchParams(new URLSearchParams())
                  }}
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpiar filtros</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
          </div>
          </div>

          <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold text-foreground">
                <ListOrdered className="h-4 w-4" />
              </TableHead>
              <TableHead className="font-bold text-foreground">Proveedor</TableHead>
              <TableHead className="font-bold text-foreground">Código</TableHead>
              <TableHead className="font-bold text-foreground">N° Factura</TableHead>
              <TableHead className="font-bold text-foreground">N° OC (referencia)</TableHead>
              <TableHead className="font-bold text-foreground">Fecha recepción</TableHead>
              <TableHead className="text-right font-bold text-foreground">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingTableRow colSpan={7} />
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Sin recepciones registradas todavía.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((r) => (
                <TableRow
                  key={r.id}
                  className="group hover:bg-transparent data-[state=selected]:bg-transparent focus-within:bg-transparent"
                >
                  <TableCell className="transition-colors group-hover:bg-muted/60">{formatReceiptCode(r.id)}</TableCell>
                  <TableCell className="transition-colors group-hover:bg-muted/60">{receiptSupplierLabel(r)}</TableCell>
                  <TableCell className="max-w-[26rem] truncate transition-colors group-hover:bg-muted/60" title={receiptSkuSummary(r)}>
                    {receiptSkuSummary(r)}
                  </TableCell>
                  <TableCell className="transition-colors group-hover:bg-muted/60">{r.invoice_number || "—"}</TableCell>
                  <TableCell className="transition-colors group-hover:bg-muted/60">{r.purchase_order_reference || "—"}</TableCell>
                  <TableCell className="transition-colors group-hover:bg-muted/60">
                    {r.received_at
                      ? String(r.received_at).slice(0, 19).replace("T", " ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right transition-colors group-hover:bg-muted/60">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                        title="Ver detalles"
                        aria-label="Ver detalles"
                        onClick={() => setSelectedReceipt(r)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
                        title="Vista previa"
                        aria-label="Vista previa"
                        asChild
                      >
                        <Link to={`/recepciones-oc/${r.id}/vista-previa`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
          </div>
          </AxonesTableCard>

          {rows && rows.last_page > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Página {rows.current_page} de {rows.last_page} · {rows.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rows.current_page <= 1 || loading}
                  onClick={() => setPageAndQuery(Math.max(1, page - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rows.current_page >= rows.last_page || loading}
                  onClick={() => setPageAndQuery(Math.min(rows.last_page, page + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={selectedReceipt !== null}
        onOpenChange={(open) => (!open ? (setSelectedReceipt(null), setSelectedReceiptDetail(null)) : null)}
      >
        <DialogContent className="w-[95vw] max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              Detalle de recepción #{selectedReceipt?.id ?? "—"}
            </DialogTitle>
            <DialogDescription>
              Resumen operativo de la recepción y detalle de líneas/materiales.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">ID</p>
              <p className="font-medium">{formatReceiptCode(selectedReceiptDetail?.id ?? selectedReceipt?.id)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fecha recepción</p>
              <p className="font-medium">
                {(selectedReceiptDetail?.received_at ?? selectedReceipt?.received_at)
                  ? String(selectedReceiptDetail?.received_at ?? selectedReceipt?.received_at)
                    .slice(0, 19)
                    .replace("T", " ")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">N° OC (referencia)</p>
              <p className="font-medium">{selectedReceiptDetail?.purchase_order_reference || selectedReceipt?.purchase_order_reference || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Proveedor</p>
              <p className="font-medium">
                {receiptSupplierLabelNullable(selectedReceiptDetail ?? selectedReceipt)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">N° Factura</p>
              <p className="font-medium">{selectedReceiptDetail?.invoice_number || selectedReceipt?.invoice_number || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Líneas</p>
              <p className="font-medium">
                {selectedReceiptDetail?.lines_count
                  ?? selectedReceiptDetail?.lines?.length
                  ?? selectedReceipt?.lines_count
                  ?? selectedReceipt?.lines?.length
                  ?? "—"}
              </p>
            </div>
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-card">SKU</TableHead>
                  <TableHead className="sticky left-[12rem] z-20 bg-card">Material</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Micras</TableHead>
                  <TableHead>Ancho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingDetail ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <InlineSpinner />
                        Cargando detalle...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : selectedReceiptDetail?.lines?.length ? (
                  selectedReceiptDetail.lines.map((line, index) => (
                    <TableRow key={`${selectedReceiptDetail.id}-${index}-${line.material?.sku || "linea"}`}>
                      <TableCell className="sticky left-0 z-10 bg-card">{line.material?.sku || "—"}</TableCell>
                      <TableCell className="sticky left-[12rem] z-10 bg-card">{line.material?.name || "—"}</TableCell>
                      <TableCell>{line.item_type || "—"}</TableCell>
                      <TableCell>{line.quantity ?? "—"}</TableCell>
                      <TableCell>{line.unit || "—"}</TableCell>
                      <TableCell>{line.micras ?? "—"}</TableCell>
                      <TableCell>{line.ancho_mm ?? "—"}</TableCell>
                    </TableRow>
                  ))
                ) : selectedReceipt && receiptSkus(selectedReceipt).length ? (
                  receiptSkus(selectedReceipt).map((sku) => (
                    <TableRow key={sku}>
                      <TableCell className="sticky left-0 z-10 bg-card">{sku}</TableCell>
                      <TableCell className="sticky left-[12rem] z-10 bg-card">—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
