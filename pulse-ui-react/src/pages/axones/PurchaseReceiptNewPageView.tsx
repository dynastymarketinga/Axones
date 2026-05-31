"use client"

import type React from "react"
import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  Hash,
  Info,
  Layers,
  MapPin,
  Package,
  PackagePlus,
  Plus,
  Ruler,
  Scale,
  ShoppingCart,
  UserPlus,
  X,
} from "lucide-react"

import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  DOCUMENT_ROW_FIELD_CLASS,
  documentFieldIconClass,
  documentInvalidHighlightClass,
  formatDateInputDisplay,
  formatLinesCount,
  parseDateInputValue,
  sanitizePositiveDecimalInput,
  toDateInputValue,
} from "@/pages/axones/purchase-document-form-ui"
import {
  itemTypeKeyToReceiptUiLabel,
  PURCHASE_ITEM_TYPE_KEYS,
  PURCHASE_ITEM_TYPE_META,
  PurchaseItemTypeLabel,
  receiptUiLabelToItemTypeKey,
  shouldShowDimsForItemType,
  type PurchaseItemTypeKey,
} from "@/pages/axones/purchase-item-type-meta"
import type {
  DuplicateReceiptMatch,
  FreeLine,
  PurchaseOrderDetailPayload,
  PurchaseOrderLineDetail,
  ReceiptFieldErrors,
  ReceiptLineFieldErrors,
} from "@/pages/axones/PurchaseReceiptNewPage"

type SupplierOption = {
  id: number
  name?: string | null
  rif?: string | null
  address?: string | null
}

type PurchaseOrderOption = {
  id: number
  code?: string | null
  status: string
  supplier_id: number
  supplier?: { name?: string | null } | null
}

type MaterialOption = {
  id: number | string
  sku: string
}

type UnitOption = {
  value: string
  label: string
}

type PaginatedLineEntry = {
  line: FreeLine
  index: number
}

const ADD_RECEIPT_LINE_TOOLTIP =
  "Agregar otra linea a la recepcion. Las filas vacias se omiten al guardar si hay al menos una linea valida."

export type PurchaseReceiptNewPageViewProps = {
  saving: boolean
  supplierComboOpen: boolean
  setSupplierComboOpen: (open: boolean) => void
  supplierOptions: SupplierOption[]
  supplierId: number | null
  setSupplierId: (id: number | null) => void
  selectedSupplier: SupplierOption | null
  persistReceiptDraftAndGoToNewSupplier: () => void
  invoiceNumber: string
  setInvoiceNumber: (value: string) => void
  notes: string
  setNotes: (value: string) => void
  receivedAtOpen: boolean
  setReceivedAtOpen: (open: boolean) => void
  receivedAtDateValue: string
  setReceivedAt: (value: string) => void
  todayDate: string
  poComboOpen: boolean
  setPoComboOpen: (open: boolean) => void
  poListLoading: boolean
  purchaseOrderId: number | null
  purchaseOrderDetail: PurchaseOrderDetailPayload | null
  selectedPurchaseOrderRow: PurchaseOrderOption | null
  purchaseOrderOptions: PurchaseOrderOption[]
  clearPurchaseOrder: () => void
  setPurchaseOrderId: (id: number | null) => void
  navigateToNewPurchaseOrder: () => void
  hasPurchaseOrder: boolean
  fieldErrors: ReceiptFieldErrors
  lineErrors: Record<number, ReceiptLineFieldErrors>
  freeLines: FreeLine[]
  paginatedLineEntries: PaginatedLineEntry[]
  showDimensionColumns: boolean
  materialComboOpenRow: number | null
  setMaterialComboOpenRow: (index: number | null) => void
  materialComboSearch: string
  setMaterialComboSearch: (value: string) => void
  materialsForItemType: (itemType: string) => MaterialOption[]
  updateFreeLine: (index: number, patch: Partial<FreeLine>) => void
  allowedUnitsByItemType: (itemType: string) => readonly UnitOption[]
  removeFreeLine: (index: number) => void
  addFreeLine: () => void
  reachedItemLimit: boolean
  maxReceiptLines: number
  goToCreateMaterialFromReceipt: (preferredRowIndex?: number) => void
  goToMaterialMaster: (
    rowIndex: number,
    itemType: string,
    preset?: { sku?: string; name?: string },
  ) => void
  linesPageCount: number
  safeLinesPage: number
  setLinesPage: React.Dispatch<React.SetStateAction<number>>
  submit: (ev: React.FormEvent) => void
  estimatedNextReceiptId: number | null
  formatReceiptCode: (id: number | null | undefined) => string
  formatPolLabel: (pol: PurchaseOrderLineDetail) => string
  purchaseOrderStatusHint: (status: string) => string
  confirmCreateOpen: boolean
  setConfirmCreateOpen: (open: boolean) => void
  confirmAndCreateReceipt: () => Promise<void>
  payloadLinesPreviewCount: number
  duplicateDialogOpen: boolean
  setDuplicateDialogOpen: (open: boolean) => void
  duplicateMatches: DuplicateReceiptMatch[]
  pendingPayload: Record<string, unknown> | null
  persistReceipt: (payload: Record<string, unknown>) => Promise<void>
}

export function PurchaseReceiptNewPageView(props: PurchaseReceiptNewPageViewProps) {
  const supplierHasError = Boolean(props.fieldErrors.supplier)
  const invoiceHasError = Boolean(props.fieldErrors.invoice)
  const dateHasError = Boolean(props.fieldErrors.receivedAt)
  const purchaseOrderHasError = Boolean(props.fieldErrors.purchaseOrder)

  const linkedPoCode =
    props.purchaseOrderDetail?.code?.trim() ||
    props.selectedPurchaseOrderRow?.code?.trim() ||
    null

  const primaryItemTypeKey = useMemo(() => {
    const firstLine = props.freeLines.find((line) => line.item_type.trim())
    return firstLine ? receiptUiLabelToItemTypeKey(firstLine.item_type) : "sustrato"
  }, [props.freeLines])

  const primaryItemTypeMeta = PURCHASE_ITEM_TYPE_META[primaryItemTypeKey]

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
              <PackagePlus className="size-7 shrink-0 text-primary" aria-hidden />
              Ingreso de material
            </h1>
            <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
              Punto de partida del stock: registre aquí las cantidades físicas que entran al
              inventario (con factura; la orden de compra es opcional).
            </p>
            <Alert className="border-primary/40 bg-gradient-to-r from-primary/12 via-primary/8 to-primary/5 shadow-sm">
              <Info className="h-5 w-5 text-primary" aria-hidden />
              <AlertTitle className="text-base font-semibold text-foreground">
                ¿Qué registra esta pantalla?
              </AlertTitle>
              <AlertDescription className="space-y-2 text-sm leading-relaxed text-foreground/90">
                <p>
                  <strong>Registra la entrada física al inventario.</strong> Lo guardado aquí suma stock
                  real, queda trazado en movimientos y puede vincularse a una orden de compra.
                </p>
                <p>
                  Use <strong>cantidades reales</strong> (balanza o factura). Si elige una OC, el sistema
                  actualiza lo recibido; si no, puede registrar una <strong>entrada directa</strong>.
                </p>
              </AlertDescription>
            </Alert>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild type="button" variant="outline" size="icon" className="shrink-0 shadow-sm">
                <Link to="/recepciones-oc" aria-label="Volver al listado de recepciones">
                  <ArrowLeft aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[16rem] text-left">
              Vuelve al listado de recepciones. Si tenía borrador en esta pantalla, se conserva al
              regresar.
            </TooltipContent>
          </Tooltip>
        </div>

        <form
          noValidate
          onSubmit={(ev) => void props.submit(ev)}
          className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-muted-foreground text-xs">Documento de recepción</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-md border-primary/35 bg-primary/5 px-2.5 py-1 text-sm font-semibold text-primary shadow-sm"
                >
                  <Scale className="mr-1.5 size-3.5" aria-hidden />
                  Recepción · Entrada al inventario
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("rounded-md px-2.5 py-1 text-sm font-semibold shadow-sm", primaryItemTypeMeta.badgeClass)}
                >
                  <PurchaseItemTypeLabel typeKey={primaryItemTypeKey} />
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                Área de ingreso según el tipo de la primera línea válida.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-muted-foreground text-xs">Correlativo de recepción</p>
              <h2 className="text-primary text-3xl font-bold tracking-tight">
                {props.formatReceiptCode(props.estimatedNextReceiptId)}
              </h2>
            </div>
          </div>

          <Alert className="border-primary/35 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-sm">
            <Scale className="h-5 w-5 text-primary" aria-hidden />
            <AlertTitle className="text-base font-semibold text-foreground">
              Cantidades reales en inventario
            </AlertTitle>
            <AlertDescription className="space-y-2 text-sm leading-relaxed text-foreground/90">
              <p>
                Esta pantalla es el registro oficial de <strong>entrada física</strong> al inventario:
                lo que guarde aquí es lo que suma al stock del material y queda trazado en movimientos.
              </p>
              <p>
                Use <strong>kg reales en báscula</strong> o lo documentado en la factura de este despacho.
                Si vincula una orden de compra, el sistema cruza líneas y respeta lo pendiente; sin OC
                registra la cantidad que indique.
              </p>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rc-supplier-trigger" className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" aria-hidden />
                Proveedor *
              </Label>
              <div className="flex items-center gap-2">
                <Popover open={props.supplierComboOpen} onOpenChange={props.setSupplierComboOpen}>
                  <PopoverTrigger asChild>
                    <div className="group/field relative flex-1">
                      <Building2
                        className={cn(documentFieldIconClass(supplierHasError, props.saving), "top-1/2 -translate-y-1/2")}
                        aria-hidden
                      />
                      <Button
                        id="rc-supplier-trigger"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={props.supplierComboOpen}
                        aria-invalid={supplierHasError}
                        disabled={props.saving}
                        className={cn(
                          "h-10 w-full justify-between pl-10 pr-3 font-normal",
                          "border-primary/25 bg-background/90 shadow-sm",
                          documentInvalidHighlightClass(supplierHasError),
                        )}
                      >
                        <span className={cn("truncate text-left", !props.selectedSupplier && "text-muted-foreground")}>
                          {props.selectedSupplier?.name || "Escriba o seleccione proveedor..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                    <Command shouldFilter>
                      <CommandInput placeholder="Buscar proveedor..." />
                      <CommandList className="max-h-60">
                        <CommandEmpty>
                          {props.supplierOptions.length === 0 ? (
                            <div className="space-y-3 px-2 py-4 text-center">
                              <p className="text-muted-foreground text-sm">No hay proveedores registrados.</p>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={props.saving}
                                onClick={() => {
                                  props.setSupplierComboOpen(false)
                                  props.persistReceiptDraftAndGoToNewSupplier()
                                }}
                              >
                                Crear proveedor
                              </Button>
                            </div>
                          ) : (
                            "No hay coincidencias."
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {props.supplierOptions.map((supplier) => (
                            <CommandItem
                              key={supplier.id}
                              value={`${supplier.name ?? ""} ${supplier.rif ?? ""}`}
                              onSelect={() => {
                                props.setSupplierId(supplier.id)
                                props.setSupplierComboOpen(false)
                              }}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", props.supplierId === supplier.id ? "opacity-100" : "opacity-0")}
                                aria-hidden
                              />
                              <span>{supplier.name}</span>
                              {supplier.rif ? (
                                <span className="text-muted-foreground ml-2 text-xs">{supplier.rif}</span>
                              ) : null}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 shadow-sm"
                      onClick={props.persistReceiptDraftAndGoToNewSupplier}
                      disabled={props.saving}
                      aria-label="Crear proveedor"
                    >
                      <UserPlus className="size-4" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Crear proveedor</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rc-invoice" className="inline-flex items-center gap-1.5">
                <Hash className="size-3.5 text-primary" aria-hidden />
                N° Factura *
              </Label>
              <div className="group/field relative">
                <FileText
                  className={cn(documentFieldIconClass(invoiceHasError, props.saving), "top-1/2 -translate-y-1/2")}
                  aria-hidden
                />
                <Input
                  id="rc-invoice"
                  value={props.invoiceNumber}
                  onChange={(ev) => props.setInvoiceNumber(ev.target.value.toUpperCase().slice(0, 15))}
                  maxLength={15}
                  placeholder="Número de factura"
                  disabled={props.saving}
                  aria-invalid={invoiceHasError}
                  className={cn(
                    "pl-10",
                    "border-primary/25 bg-background/90 shadow-sm",
                    documentInvalidHighlightClass(invoiceHasError),
                  )}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rc-date" className="inline-flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-primary" aria-hidden />
                Fecha recibido *
              </Label>
              <Popover open={props.receivedAtOpen} onOpenChange={props.setReceivedAtOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="rc-date"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={props.receivedAtOpen}
                    aria-invalid={dateHasError}
                    disabled={props.saving}
                    className={cn(
                      "group/field h-10 w-full justify-between pl-3 pr-3 font-normal",
                      "border-primary/25 bg-background/90 shadow-sm",
                      !props.receivedAtDateValue && "text-muted-foreground",
                      documentInvalidHighlightClass(dateHasError),
                    )}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <CalendarIcon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          props.saving ? "text-muted-foreground/50" : "text-muted-foreground group-focus-visible:text-primary",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{formatDateInputDisplay(props.receivedAtDateValue)}</span>
                    </span>
                    <ChevronDown className="ml-1 size-4 shrink-0 opacity-50" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <UiCalendar
                    mode="single"
                    selected={parseDateInputValue(props.receivedAtDateValue)}
                    defaultMonth={parseDateInputValue(props.receivedAtDateValue) ?? new Date()}
                    disabled={(date) => toDateInputValue(date) > props.todayDate}
                    onSelect={(date) => {
                      if (!date) return
                      const next = toDateInputValue(date)
                      if (next > props.todayDate) return
                      props.setReceivedAt(`${next}T00:00`)
                      props.setReceivedAtOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div id="purchase-order-field" className="grid gap-2">
              <Label className="inline-flex items-center gap-1.5">
                <ClipboardList className="size-3.5 text-primary" aria-hidden />
                Orden de compra (opcional)
              </Label>
              <div className="flex items-center gap-2">
                <Popover open={props.poComboOpen} onOpenChange={props.setPoComboOpen}>
                  <PopoverTrigger asChild>
                    <div className="group/field relative flex-1">
                      <ClipboardList
                        className={cn(documentFieldIconClass(purchaseOrderHasError, props.saving), "top-1/2 -translate-y-1/2")}
                        aria-hidden
                      />
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={props.poComboOpen}
                        disabled={props.saving || props.poListLoading}
                        className={cn(
                          "h-10 w-full justify-between pl-10 pr-3 font-normal",
                          "border-primary/25 bg-background/90 shadow-sm",
                          documentInvalidHighlightClass(purchaseOrderHasError),
                        )}
                      >
                        <span className={cn("truncate text-left", !props.purchaseOrderId && "text-muted-foreground")}>
                          {props.poListLoading
                            ? "Cargando ordenes..."
                            : props.purchaseOrderId
                              ? `${props.purchaseOrderDetail?.code ?? props.selectedPurchaseOrderRow?.code ?? "..."} · ${props.purchaseOrderStatusHint(
                                  props.purchaseOrderDetail?.status ?? props.selectedPurchaseOrderRow?.status ?? "",
                                )}`
                              : "Entrada directa (sin OC)..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                    <Command shouldFilter>
                      <CommandInput placeholder="Buscar por codigo OC..." />
                      <CommandList className="max-h-60">
                        <CommandEmpty>
                          {props.poListLoading
                            ? "Cargando ordenes de compra..."
                            : "No hay ordenes abiertas o parciales. Use 'Sin orden de compra' para entrada directa."}
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="sin orden de compra entrada directa" onSelect={() => props.clearPurchaseOrder()}>
                            <Check
                              className={cn("mr-2 h-4 w-4", !props.purchaseOrderId ? "opacity-100" : "opacity-0")}
                              aria-hidden
                            />
                            <span className="font-medium">Sin orden de compra</span>
                            <span className="text-muted-foreground ml-2 text-xs">Entrada directa al inventario</span>
                          </CommandItem>
                          {props.purchaseOrderOptions.map((po) => (
                            <CommandItem
                              key={po.id}
                              value={`${po.code ?? ""} ${po.supplier?.name ?? ""} ${po.status}`}
                              onSelect={() => {
                                props.setPurchaseOrderId(po.id)
                                if (po.supplier_id > 0 && po.supplier_id !== props.supplierId) {
                                  props.setSupplierId(po.supplier_id)
                                }
                                props.setPoComboOpen(false)
                              }}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", props.purchaseOrderId === po.id ? "opacity-100" : "opacity-0")}
                                aria-hidden
                              />
                              <span className="truncate">{po.code}</span>
                              <span className="text-muted-foreground ml-2 truncate text-xs">
                                {props.purchaseOrderStatusHint(po.status)}
                                {po.supplier?.name ? ` · ${po.supplier.name}` : ""}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 shadow-sm"
                      disabled={props.saving}
                      onClick={props.navigateToNewPurchaseOrder}
                      aria-label="Crear orden de compra"
                    >
                      <ShoppingCart className="size-4" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Crear orden de compra</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Sin orden de compra:</strong> elija tipo, material y la cantidad física que entra
                (kg en báscula o factura); no hay tope de pedido.{" "}
                <strong>Con orden de compra:</strong> en cada fila use la línea de la OC; en cantidad
                recibida registre lo recibido en este despacho (puede ser menor al sugerido, pero no
                mayor que lo pendiente de esa línea).
              </p>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="rc-notes" className="inline-flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" aria-hidden />
                Observaciones
              </Label>
              <div className="group/field relative">
                <FileText
                  className={cn(documentFieldIconClass(false, props.saving), "top-3.5")}
                  aria-hidden
                />
                <Textarea
                  id="rc-notes"
                  rows={2}
                  maxLength={650}
                  value={props.notes}
                  onChange={(ev) => props.setNotes(ev.target.value.slice(0, 650))}
                  placeholder="Notas adicionales de la recepción..."
                  disabled={props.saving}
                  className="border-primary/25 bg-background/90 pl-10 shadow-sm"
                />
              </div>
            </div>
          </div>

          {props.supplierId && props.selectedSupplier ? (
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-muted/30 p-4 text-sm shadow-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <MapPin className="size-4 text-primary" aria-hidden />
                Dirección del proveedor
              </p>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                {props.selectedSupplier.address?.trim() || "Sin dirección registrada en el proveedor."}
              </p>
              {!props.selectedSupplier.address?.trim() ? (
                <Link
                  to={`/proveedores/form?id=${props.supplierId}`}
                  className="text-primary mt-2 inline-block text-xs underline underline-offset-4"
                >
                  Registrar dirección del proveedor
                </Link>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              "space-y-3 rounded-xl border border-primary/15 bg-gradient-to-b from-muted/20 to-background p-4 shadow-sm transition-shadow",
              props.fieldErrors.linesGeneral && documentInvalidHighlightClass(true),
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="grid min-w-0 gap-1">
                <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <Package className="size-4 text-primary" aria-hidden />
                  Items recibidos
                  <Badge
                    variant="outline"
                    className="min-w-[1.75rem] justify-center border-primary/30 bg-primary/5 px-2 text-xs font-semibold tabular-nums text-primary"
                  >
                    {props.freeLines.length}
                  </Badge>
                </h2>
              <p className="text-muted-foreground text-xs">
                Registre tipo, material del catálogo y cantidad física por línea. Las filas vacías se
                omiten al guardar.
              </p>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={props.saving}
                      className="h-8 w-8 shrink-0 shadow-sm"
                      aria-label="Crear material en catálogo"
                      onClick={() => props.goToCreateMaterialFromReceipt()}
                    >
                      <PackagePlus className="size-4" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Crear material</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      disabled={props.saving || props.reachedItemLimit}
                      className="h-8 w-8 shrink-0 shadow-md"
                      aria-label="Agregar linea de recepcion"
                      onClick={props.addFreeLine}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[15rem] text-left">
                    {props.reachedItemLimit
                      ? `Limite alcanzado (${props.maxReceiptLines} items)`
                      : ADD_RECEIPT_LINE_TOOLTIP}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="po-doc-lines-table overflow-x-auto rounded-xl border border-primary/10 bg-card shadow-inner">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-14">N°</TableHead>
                    {props.hasPurchaseOrder ? (
                      <TableHead className="min-w-[230px]">
                        <span className="inline-flex items-center gap-1.5">
                          <ClipboardList className="size-3.5 text-primary" aria-hidden />
                          Ítem solicitado (OC)
                        </span>
                      </TableHead>
                    ) : null}
                    <TableHead className="w-40">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="size-3.5 text-primary" aria-hidden />
                        Tipo
                      </span>
                    </TableHead>
                    <TableHead className="min-w-[210px]">
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="size-3.5 text-primary" aria-hidden />
                        Material *
                      </span>
                    </TableHead>
                    {props.showDimensionColumns ? (
                      <>
                        <TableHead className="w-24">
                          <span className="inline-flex items-center gap-1.5">
                            <Layers className="size-3.5 text-primary" aria-hidden />
                            Micras
                          </span>
                        </TableHead>
                        <TableHead className="w-24">
                          <span className="inline-flex items-center gap-1.5">
                            <Ruler className="size-3.5 text-primary" aria-hidden />
                            Ancho
                          </span>
                        </TableHead>
                      </>
                    ) : null}
                    <TableHead className="w-32 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Scale className="size-3.5 text-primary" aria-hidden />
                        Cantidad *
                      </span>
                    </TableHead>
                    <TableHead className="w-32">Unidad</TableHead>
                    <TableHead className="w-[4.5rem] p-0 text-center">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.paginatedLineEntries.map(({ line, index: i }) => {
                    const typeKey = receiptUiLabelToItemTypeKey(line.item_type)
                    const typeMeta = PURCHASE_ITEM_TYPE_META[typeKey]
                    const rowHasError = Boolean(props.lineErrors[i] && Object.keys(props.lineErrors[i]).length > 0)
                    const selectedMaterial = props
                      .materialsForItemType(line.item_type)
                      .find((m) => String(m.id) === line.material_id)
                    const shouldShowDims = shouldShowDimsForItemType(typeKey)
                    return (
                      <TableRow
                        key={i}
                        id={`receipt-row-${i}`}
                        data-po-line-type={typeKey}
                        className={cn(
                          typeMeta.rowClass,
                          rowHasError && "ring-2 ring-inset ring-destructive/35",
                        )}
                      >
                        <TableCell className="align-middle">
                          <div
                            className={cn(
                              "flex h-9 items-center justify-center rounded-md border px-2 text-sm font-semibold",
                              typeMeta.rowNumberClass,
                            )}
                          >
                            {i + 1}
                          </div>
                        </TableCell>
                        {props.hasPurchaseOrder ? (
                          <TableCell className="align-middle">
                            {line.purchase_order_line_id ? (
                              (() => {
                                const pol = props.purchaseOrderDetail?.lines?.find(
                                  (ln) => String(ln.id) === String(line.purchase_order_line_id),
                                )
                                if (!pol) return null
                                return (
                                  <div className="group/field relative">
                                    <Package
                                      className={cn(
                                        documentFieldIconClass(false, props.saving),
                                        "top-1/2 -translate-y-1/2",
                                      )}
                                      aria-hidden
                                    />
                                    <div className="flex h-9 items-center rounded-md border border-white/60 bg-background/90 px-3 pl-10 text-sm font-medium shadow-sm">
                                      {props.formatPolLabel(pol)}
                                    </div>
                                  </div>
                                )
                              })()
                            ) : (
                              <div className="flex h-9 min-w-0 items-center truncate rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                                Seleccione OC arriba para cargar items...
                              </div>
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell className="align-middle">
                          <Select
                            value={typeKey}
                            disabled={props.saving}
                            onValueChange={(v) => {
                              const nextKey = v as PurchaseItemTypeKey
                              const shouldHideDimensions = !shouldShowDimsForItemType(nextKey)
                              props.updateFreeLine(i, {
                                item_type: itemTypeKeyToReceiptUiLabel(nextKey),
                                ...(shouldHideDimensions ? { micras: "", ancho_mm: "" } : {}),
                              })
                            }}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-9 gap-2 font-medium [&>span]:flex [&>span]:min-w-0 [&>span]:flex-1",
                                typeMeta.selectTriggerClass,
                              )}
                            >
                              <PurchaseItemTypeLabel typeKey={typeKey} />
                            </SelectTrigger>
                            <SelectContent>
                              {PURCHASE_ITEM_TYPE_KEYS.map((itemType) => (
                                <SelectItem
                                  key={itemType}
                                  value={itemType}
                                  className={cn("my-0.5 rounded-md", PURCHASE_ITEM_TYPE_META[itemType].badgeClass)}
                                >
                                  <PurchaseItemTypeLabel typeKey={itemType} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Popover
                            open={props.materialComboOpenRow === i}
                            onOpenChange={(open) => {
                              if (open) props.setMaterialComboSearch("")
                              props.setMaterialComboOpenRow(open ? i : null)
                            }}
                          >
                            <PopoverTrigger asChild>
                              <div className="group/field relative">
                                <Package
                                  className={cn(
                                    documentFieldIconClass(Boolean(props.lineErrors[i]?.material), props.saving),
                                    "top-1/2 -translate-y-1/2",
                                  )}
                                  aria-hidden
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={props.materialComboOpenRow === i}
                                  disabled={props.saving}
                                  className={cn(
                                    "h-9 w-full justify-between pl-10 font-normal",
                                    DOCUMENT_ROW_FIELD_CLASS,
                                    documentInvalidHighlightClass(Boolean(props.lineErrors[i]?.material)),
                                  )}
                                >
                                  <span className={cn("min-w-0 flex-1 text-left", !line.material_id && "text-muted-foreground")}>
                                    {selectedMaterial?.sku || "Seleccione material del catálogo..."}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                              <Command shouldFilter>
                                <CommandInput
                                  placeholder="Buscar SKU..."
                                  value={props.materialComboOpenRow === i ? props.materialComboSearch : ""}
                                  onValueChange={props.setMaterialComboSearch}
                                />
                                <CommandList className="max-h-60">
                                  <CommandEmpty>
                                    {props.materialComboSearch.trim() ? (
                                      <div className="space-y-2 px-2">
                                        <p className="text-muted-foreground">No hay coincidencias con la busqueda.</p>
                                        {line.item_type ? (
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="h-auto w-full whitespace-normal py-2 text-xs"
                                            onClick={() => {
                                              const q = props.materialComboSearch.trim()
                                              props.goToMaterialMaster(i, line.item_type, { sku: q, name: q })
                                              props.setMaterialComboOpenRow(null)
                                              props.setMaterialComboSearch("")
                                            }}
                                          >
                                            Ir a nuevo material con "{props.materialComboSearch.trim()}"
                                          </Button>
                                        ) : (
                                          <p className="text-muted-foreground text-xs">
                                            Seleccione primero el tipo de item en esta fila.
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      "No hay SKU disponibles."
                                    )}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {props.materialsForItemType(line.item_type).map((m) => (
                                      <CommandItem
                                        key={m.id}
                                        value={m.sku}
                                        onSelect={() => {
                                          props.updateFreeLine(i, { material_id: String(m.id) })
                                          props.setMaterialComboOpenRow(null)
                                          props.setMaterialComboSearch("")
                                        }}
                                      >
                                        <Check
                                          className={cn("mr-2 h-4 w-4", line.material_id === String(m.id) ? "opacity-100" : "opacity-0")}
                                          aria-hidden
                                        />
                                        {m.sku}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        {props.showDimensionColumns ? (
                          shouldShowDims ? (
                            <>
                              <TableCell className="align-middle">
                                <div className="group/field relative">
                                  <Layers
                                    className={cn(documentFieldIconClass(Boolean(props.lineErrors[i]?.micras), props.saving), "top-1/2 -translate-y-1/2")}
                                    aria-hidden
                                  />
                                  <Input
                                    inputMode="numeric"
                                    value={line.micras}
                                    onChange={(ev) =>
                                      props.updateFreeLine(i, { micras: sanitizePositiveDecimalInput(ev.target.value, 3) })
                                    }
                                    placeholder="20"
                                    disabled={props.saving}
                                    aria-label={`Micras, fila ${i + 1}`}
                                    className={cn(
                                      "pl-9",
                                      DOCUMENT_ROW_FIELD_CLASS,
                                      documentInvalidHighlightClass(Boolean(props.lineErrors[i]?.micras)),
                                    )}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="group/field relative">
                                  <Ruler
                                    className={cn(documentFieldIconClass(Boolean(props.lineErrors[i]?.ancho), props.saving), "top-1/2 -translate-y-1/2")}
                                    aria-hidden
                                  />
                                  <Input
                                    inputMode="numeric"
                                    value={line.ancho_mm}
                                    onChange={(ev) =>
                                      props.updateFreeLine(i, { ancho_mm: sanitizePositiveDecimalInput(ev.target.value, 3) })
                                    }
                                    placeholder="520"
                                    disabled={props.saving}
                                    aria-label={`Ancho mm, fila ${i + 1}`}
                                    className={cn(
                                      "pl-9",
                                      DOCUMENT_ROW_FIELD_CLASS,
                                      documentInvalidHighlightClass(Boolean(props.lineErrors[i]?.ancho)),
                                    )}
                                  />
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="align-middle" aria-hidden />
                              <TableCell className="align-middle" aria-hidden />
                            </>
                          )
                        ) : null}
                        <TableCell className="align-middle">
                          <div className="group/field relative">
                            <Scale
                              className={cn(documentFieldIconClass(Boolean(props.lineErrors[i]?.quantity), props.saving), "top-1/2 -translate-y-1/2")}
                              aria-hidden
                            />
                            <Input
                              id={`receipt-line-${i}-qty`}
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.,]?[0-9]*"
                              autoComplete="off"
                              aria-label={`Cantidad recibida, fila ${i + 1}`}
                              aria-invalid={Boolean(props.lineErrors[i]?.quantity)}
                              value={line.quantity}
                              onChange={(ev) =>
                                props.updateFreeLine(i, { quantity: sanitizePositiveDecimalInput(ev.target.value, 2) })
                              }
                              placeholder="Cantidad"
                              disabled={props.saving}
                              className={cn(
                                "h-9 pl-9",
                                DOCUMENT_ROW_FIELD_CLASS,
                                documentInvalidHighlightClass(Boolean(props.lineErrors[i]?.quantity)),
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Select
                            value={line.unit || "kg"}
                            disabled={props.saving}
                            onValueChange={(v) => props.updateFreeLine(i, { unit: v })}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-9",
                                DOCUMENT_ROW_FIELD_CLASS,
                                documentInvalidHighlightClass(Boolean(props.lineErrors[i]?.unit)),
                              )}
                              aria-label={`Unidad, fila ${i + 1}`}
                            >
                              <SelectValue placeholder="..." />
                            </SelectTrigger>
                            <SelectContent>
                              {props.allowedUnitsByItemType(line.item_type).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex items-center justify-center gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                  disabled={props.saving}
                                  aria-label={`Crear material desde fila ${i + 1}`}
                                  onClick={() => props.goToCreateMaterialFromReceipt(i)}
                                >
                                  <PackagePlus className="size-4" aria-hidden />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Crear material</TooltipContent>
                            </Tooltip>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => props.removeFreeLine(i)}
                              aria-label={`Eliminar fila ${i + 1}`}
                            >
                              <X className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {props.linesPageCount > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-muted-foreground text-xs">
                    Lineas {(props.safeLinesPage - 1) * 8 + 1}-
                    {Math.min(props.safeLinesPage * 8, props.freeLines.length)} de{" "}
                    {formatLinesCount(props.freeLines.length)}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shadow-sm"
                      disabled={props.safeLinesPage <= 1 || props.saving}
                      onClick={() => props.setLinesPage((p) => Math.max(1, p - 1))}
                      aria-label="Pagina anterior de lineas"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </Button>
                    <span className="text-muted-foreground min-w-[5.5rem] text-center text-xs font-medium">
                      Pag. {props.safeLinesPage} / {props.linesPageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shadow-sm"
                      disabled={props.safeLinesPage >= props.linesPageCount || props.saving}
                      onClick={() => props.setLinesPage((p) => Math.min(props.linesPageCount, p + 1))}
                      aria-label="Pagina siguiente de lineas"
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex w-full justify-center pt-1">
            <Button type="submit" disabled={props.saving} className="min-w-[12rem] shadow-md">
              <PackagePlus aria-hidden />
              <LoadingButtonLabel
                loading={props.saving}
                loadingText="Guardando..."
                idleText="Registrar recepción"
              />
            </Button>
          </div>
        </form>

        <AlertDialog open={props.confirmCreateOpen} onOpenChange={props.setConfirmCreateOpen}>
          <AlertDialogContent className="po-detail-dialog po-confirm-dialog flex flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-none">
            <div className="po-detail-dialog-header shrink-0 px-8 pb-6 pt-7">
              <div className="flex items-start gap-4">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20"
                  aria-hidden
                >
                  <PackagePlus className="size-6" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                    ¿Registrar recepción?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="px-0 py-0 text-base text-muted-foreground">
                    Confirme los datos antes de ingresar material al inventario.
                  </AlertDialogDescription>
                </div>
              </div>
            </div>

            <div className="px-8 pb-7">
              <div className="po-confirm-code-hero">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Correlativo de recepción
                </span>
                <span className="po-confirm-code-value">
                  {props.formatReceiptCode(props.estimatedNextReceiptId)}
                </span>
              </div>

              <div className="po-confirm-stats mt-4">
                <div className="po-confirm-stat-chip">
                  <Building2 aria-hidden />
                  <span className="po-confirm-stat-label">Proveedor</span>
                  <span className="po-confirm-stat-value line-clamp-2 w-full">
                    {props.selectedSupplier?.name?.trim() || "—"}
                  </span>
                </div>
                <div className="po-confirm-stat-chip">
                  <ClipboardList aria-hidden />
                  <span className="po-confirm-stat-label">Líneas</span>
                  <span className="po-confirm-stat-value">
                    {formatLinesCount(props.payloadLinesPreviewCount)}
                  </span>
                </div>
                <div className="po-confirm-stat-chip">
                  <CalendarIcon aria-hidden />
                  <span className="po-confirm-stat-label">Recibido</span>
                  <span className="po-confirm-stat-value tabular-nums">
                    {formatDateInputDisplay(props.receivedAtDateValue)}
                  </span>
                </div>
              </div>

              <p className="po-confirm-footnote">
                Factura <strong>{props.invoiceNumber.trim() || "—"}</strong>
                {linkedPoCode ? (
                  <>
                    {" "}
                    · OC <strong>{linkedPoCode}</strong>
                  </>
                ) : (
                  " · entrada directa (sin OC)"
                )}
                {" · "}
                actualiza stock y movimientos de inventario.
              </p>
            </div>

            <AlertDialogFooter className="po-confirm-footer border-t border-border/60 bg-muted/20">
              <AlertDialogCancel disabled={props.saving} className="min-w-[10rem]">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={props.saving}
                className="min-w-[10rem] bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-primary"
                onClick={(ev) => {
                  ev.preventDefault()
                  void props.confirmAndCreateReceipt()
                }}
              >
                {props.saving ? (
                  "Guardando…"
                ) : (
                  <>
                    <Check className="size-4" aria-hidden />
                    Registrar recepción
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={props.duplicateDialogOpen} onOpenChange={props.setDuplicateDialogOpen}>
          <DialogContent className="po-detail-dialog flex w-[min(calc(100vw-1.5rem),44rem)] flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-none">
            <div className="po-detail-dialog-header shrink-0 px-8 pb-6 pt-7">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-start gap-4">
                  <div
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400"
                    aria-hidden
                  >
                    <Hash className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <DialogTitle className="text-xl font-semibold tracking-tight">
                      Posible recepción duplicada
                    </DialogTitle>
                    <DialogDescription className="text-base text-muted-foreground">
                      Hay recepciones previas con el mismo proveedor y N° factura u OC. Si es un
                      despacho parcial puede continuar.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>
            <div className="px-8 pb-6">
              <div className="max-h-64 overflow-auto rounded-xl border border-primary/10 bg-card shadow-inner">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>N° Recepción</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>N° Factura</TableHead>
                      <TableHead>N° OC (referencia)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {props.duplicateMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell className="font-medium">{props.formatReceiptCode(match.id)}</TableCell>
                        <TableCell>
                          {match.received_at
                            ? String(match.received_at).slice(0, 19).replace("T", " ")
                            : "—"}
                        </TableCell>
                        <TableCell>{match.invoice_number || "—"}</TableCell>
                        <TableCell>{match.purchase_order_reference || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter className="po-confirm-footer border-t border-border/60 bg-muted/20">
              <Button type="button" variant="outline" className="min-w-[10rem]" onClick={() => props.setDuplicateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-w-[10rem] bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                onClick={() => {
                  const payload = props.pendingPayload
                  props.setDuplicateDialogOpen(false)
                  if (payload) void props.persistReceipt(payload)
                }}
              >
                <Check className="size-4" aria-hidden />
                Continuar y guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
