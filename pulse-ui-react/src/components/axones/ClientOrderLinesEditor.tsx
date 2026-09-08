"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Hash,
  Layers,
  Package,
  Plus,
  Scale,
  Trash2,
  Printer,
  Box,
  type LucideIcon,
} from "lucide-react"

import {
  catalogMasterFormInputClass,
  catalogMasterFormPlainInputClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatDecimalTwoOnBlur,
  sanitizeDecimalTwoInput,
} from "@/lib/decimal-two-input"
import type { MaterialRow } from "@/types/api"
import { cn } from "@/lib/utils"
import {
  CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER,
  CLIENT_ORDER_LINES_ADD_BUTTON,
  CLIENT_ORDER_LINES_PAGE_SIZE,
  clientOrderLinesPagerLabel,
} from "@/pages/axones/client-order-i18n"

const CLIENT_ORDER_MASTER_SECONDARY_HOVER =
  "transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-primary/12 hover:text-foreground hover:shadow-md active:translate-y-0 active:shadow-sm dark:hover:bg-primary/18"

// 🔥 Grilla para Crear: Sin M. Legado ni Unidad (7 columnas)
const NEW_LINE_GRID =
  "grid grid-cols-[2.5rem_8.5rem_minmax(18rem,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_2.75rem] items-start gap-x-3 gap-y-1"

// 🔥 Grilla para Editar: Incluye M. Legado y Unidad (9 columnas)
const EDIT_LINE_GRID =
  "grid grid-cols-[2.5rem_8.5rem_minmax(14rem,2fr)_minmax(8rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_4.5rem_2.75rem] items-start gap-x-3 gap-y-1"

export type ClientOrderLineProductOption = {
  id: string
  name: string
  cpe: string | null
  mps: string | null
}

export type ClientOrderLineDraft = {
  key: string
  product_id: string
  quantity: string
  material_id?: string             
  material_imprimir_id?: string
  material_laminar_id?: string
  material_trilaminar_id?: string
  unit?: string
}

type LineFieldErrors = { product?: string; quantity?: string }

type MasterLink = {
  pathname: string
  search?: string
  state?: unknown
}

type ClientOrderLinesEditorProps = {
  variant: "new" | "edit"
  lines: ClientOrderLineDraft[]
  disabled?: boolean
  clientMissing?: boolean
  productsForClient: ClientOrderLineProductOption[]
  materials?: MaterialRow[]
  
  productComboOpenKey: string | null
  onProductComboOpenKeyChange: (key: string | null) => void
  
  imprimirComboOpenKey?: string | null
  onImprimirComboOpenKeyChange?: (key: string | null) => void
  laminarComboOpenKey?: string | null
  onLaminarComboOpenKeyChange?: (key: string | null) => void
  trilaminarComboOpenKey?: string | null
  onTrilaminarComboOpenKeyChange?: (key: string | null) => void

  selectedProductByLineKey: Map<string, ClientOrderLineProductOption | null>
  selectedImprimirByLineKey?: Map<string, MaterialRow | null>
  selectedLaminarByLineKey?: Map<string, MaterialRow | null>
  selectedTrilaminarByLineKey?: Map<string, MaterialRow | null>

  lineFieldErrorsByKey?: Map<string, LineFieldErrors>
  qtyBlurKeys?: Set<string>
  newProductLink: MasterLink
  newMaterialLink?: MasterLink
  productPlaceholder?: string
  onUpdateLine: (globalIndex: number, patch: Partial<ClientOrderLineDraft>) => void
  onRemoveLine: (globalIndex: number) => void
  onAddLine: () => void
  onQuantityBlur?: (
    rowKey: string,
    globalIndex: number,
    productId: string,
    quantity: string,
  ) => void
}

function FieldErrorSlot({ message }: { message?: string }) {
  return (
    <p
      className={cn(
        "mt-0.5 h-4 truncate text-xs leading-4",
        message ? "text-destructive" : "invisible",
      )}
      aria-hidden={!message}
    >
      {message || "\u00a0"}
    </p>
  )
}

function ColumnHeader({
  icon: Icon,
  label,
  action,
}: {
  icon: LucideIcon
  label: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 pb-1">
      <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      {action}
    </div>
  )
}

function MaterialDropdown({
  disabled,
  open,
  onOpenChange,
  selectedMat,
  options,
  onSelect,
  onClear,
  placeholder = "Seleccione...",
}: {
  disabled?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMat: MaterialRow | null
  options: MaterialRow[]
  onSelect: (id: string) => void
  onClear: () => void
  placeholder?: string
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            catalogMasterFormPlainInputClass,
            "h-11 w-full justify-between gap-2 px-3 font-normal"
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left text-foreground">
            {selectedMat ? `${selectedMat.sku} — ${selectedMat.name}` : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[18rem]" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Buscar material..." />
          <CommandList>
            <CommandEmpty>No hay materiales que coincidan.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="sin-material" onSelect={onClear}>
                <Check className={cn("mr-2 h-4 w-4", !selectedMat ? "opacity-100" : "opacity-0")} />
                Ninguno (Opcional)
              </CommandItem>
              {options.map((m) => (
                <CommandItem key={m.id} value={`${m.sku} ${m.name}`} onSelect={() => onSelect(String(m.id))}>
                  <Check className={cn("mr-2 h-4 w-4", selectedMat?.id === m.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{m.sku} — {m.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ClientOrderLinesPaginator({
  page,
  totalPages,
  totalItems,
  onPageChange,
  disabled,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
  disabled?: boolean
}) {
  if (totalPages <= 1) return null

  const from = (page - 1) * CLIENT_ORDER_LINES_PAGE_SIZE + 1
  const to = Math.min(page * CLIENT_ORDER_LINES_PAGE_SIZE, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-muted-foreground text-xs tabular-nums">
        {clientOrderLinesPagerLabel(from, to, totalItems, page, totalPages)}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button" variant="outline" size="icon" className="h-8 w-8 shadow-sm" disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)} aria-label="Página anterior de líneas"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button" variant="outline" size="icon" className="h-8 w-8 shadow-sm" disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)} aria-label="Página siguiente de líneas"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

export function ClientOrderLinesEditor({
  variant,
  lines,
  disabled = false,
  clientMissing = false,
  productsForClient,
  materials = [],
  
  productComboOpenKey,
  onProductComboOpenKeyChange,
  imprimirComboOpenKey,
  onImprimirComboOpenKeyChange,
  laminarComboOpenKey,
  onLaminarComboOpenKeyChange,
  trilaminarComboOpenKey,
  onTrilaminarComboOpenKeyChange,

  selectedProductByLineKey,
  selectedImprimirByLineKey,
  selectedLaminarByLineKey,
  selectedTrilaminarByLineKey,

  lineFieldErrorsByKey,
  qtyBlurKeys,
  newProductLink,
  newMaterialLink,
  productPlaceholder = "Seleccione un producto",
  onUpdateLine,
  onRemoveLine,
  onAddLine,
  onQuantityBlur,
}: ClientOrderLinesEditorProps) {
  const [linesPage, setLinesPage] = useState(1)
  
  const [legacyComboOpenKey, setLegacyComboOpenKey] = useState<string | null>(null)

  const isNew = variant === "new"
  const gridClass = isNew ? NEW_LINE_GRID : EDIT_LINE_GRID
  const minWidth = isNew ? "min-w-[70rem]" : "min-w-[85rem]"

  const imprimirMaterials = useMemo(() => materials.filter((m) => (m as any).is_imprimir === true), [materials])
  const laminarMaterials = useMemo(() => materials.filter((m) => (m as any).is_laminar === true), [materials])
  const trilaminarMaterials = useMemo(() => materials.filter((m) => (m as any).is_trilaminar === true), [materials])

  const selectedLegacyByLineKey = useMemo(() => {
    const map = new Map<string, MaterialRow | null>()
    for (const row of lines) {
      const mid = row.material_id?.trim()
      map.set(row.key, mid ? materials.find((m) => String(m.id) === mid) ?? null : null)
    }
    return map
  }, [lines, materials])

  const totalPages = Math.max(1, Math.ceil(lines.length / CLIENT_ORDER_LINES_PAGE_SIZE))
  const safePage = Math.min(linesPage, totalPages)

  const visibleLines = useMemo(() => {
    const start = (safePage - 1) * CLIENT_ORDER_LINES_PAGE_SIZE
    return lines.slice(start, start + CLIENT_ORDER_LINES_PAGE_SIZE).map((line, offset) => ({
      line,
      globalIndex: start + offset,
    }))
  }, [lines, safePage])

  useEffect(() => {
    setLinesPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  function handleAddLine() {
    const nextTotal = lines.length + 1
    const nextPages = Math.max(1, Math.ceil(nextTotal / CLIENT_ORDER_LINES_PAGE_SIZE))
    onAddLine()
    setLinesPage(nextPages)
  }

  function handleRemoveLine(globalIndex: number) {
    const start = (safePage - 1) * CLIENT_ORDER_LINES_PAGE_SIZE
    const isLastOnPage = lines.length > 1 && globalIndex === lines.length - 1
    const willEmptyPage = visibleLines.length === 1 && safePage > 1 && globalIndex === start
    onRemoveLine(globalIndex)
    if (willEmptyPage) {
      setLinesPage((p) => Math.max(1, p - 1))
    } else if (isLastOnPage && safePage > 1 && visibleLines.length === 1) {
      setLinesPage((p) => Math.max(1, p - 1))
    }
  }

  const newProductHeaderAction =
    clientMissing || disabled ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" disabled>
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Seleccione un cliente primero</TooltipContent>
      </Tooltip>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-primary" asChild>
            <Link to={{ pathname: newProductLink.pathname, search: newProductLink.search }} state={newProductLink.state}>
              <Plus className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Nuevo producto</TooltipContent>
      </Tooltip>
    )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
          <div className={cn("rounded-xl border border-border bg-muted/20 p-3", minWidth)}>
            <div className={cn(gridClass, "border-border/60 border-b pb-3")}>
              <ColumnHeader icon={Hash} label="#" />
              <ColumnHeader icon={Scale} label="Cantidad *" />
              <ColumnHeader icon={Package} label="Producto *" action={newProductHeaderAction} />
              
              {!isNew && <ColumnHeader icon={Box} label="M. Legado" />}
              
              <ColumnHeader icon={Printer} label="Imprimir" />
              <ColumnHeader icon={Layers} label="Laminar" />
              <ColumnHeader icon={Box} label="Trilaminar" />
              
              {!isNew && <ColumnHeader icon={Hash} label="Unidad" />}
              
              <span className="sr-only">Quitar</span>
            </div>

            {lines.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No hay líneas. Pulse «Añadir línea».</p>
            ) : (
              visibleLines.map(({ line, globalIndex }) => {
                const selected = selectedProductByLineKey.get(line.key) ?? null
                const lineErr = lineFieldErrorsByKey?.get(line.key)
                const prodErr = lineErr?.product
                const qtyErrGate = lineErr?.quantity
                const qtyErrBlur = qtyBlurKeys?.has(line.key) && line.product_id.trim()
                    ? CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER
                    : undefined
                const qtyErr = qtyErrGate ?? qtyErrBlur

                return (
                  <div key={line.key} className={cn(gridClass, "border-border/40 border-b py-2 last:border-b-0")}>
                    
                    <div className="flex h-11 items-center justify-center">
                      <span className="text-muted-foreground text-sm font-semibold tabular-nums">{globalIndex + 1}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="group/qty relative">
                        <Scale className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", qtyErr ? "text-destructive" : "text-muted-foreground group-focus-within/qty:text-primary")} aria-hidden />
                        <Input
                          id={`co-qty-${line.key}`}
                          type="text" inputMode="decimal" disabled={disabled} aria-invalid={Boolean(qtyErr)}
                          className={cn(catalogMasterFormInputClass, "h-11", qtyErr ? "border-destructive bg-destructive/5 focus-visible:ring-destructive" : "")}
                          value={line.quantity}
                          onChange={(e) => {
                            const raw = sanitizeDecimalTwoInput(e.target.value)
                            onUpdateLine(globalIndex, { quantity: raw })
                          }}
                          onBlur={() => {
                            const formatted = formatDecimalTwoOnBlur(line.quantity)
                            if (formatted !== line.quantity) onUpdateLine(globalIndex, { quantity: formatted })
                            onQuantityBlur?.(line.key, globalIndex, line.product_id, formatted || line.quantity)
                          }}
                          placeholder="Ej. 1000"
                        />
                      </div>
                      <FieldErrorSlot message={qtyErr} />
                    </div>

                    <div className="min-w-0">
                      <Popover open={productComboOpenKey === line.key} onOpenChange={(open) => onProductComboOpenKeyChange(open ? line.key : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button" variant="outline" role="combobox" disabled={disabled}
                            id={`co-product-${line.key}`} aria-expanded={productComboOpenKey === line.key} aria-invalid={Boolean(prodErr)}
                            className={cn(catalogMasterFormPlainInputClass, "h-11 w-full justify-between gap-2 px-3 font-normal", prodErr ? "border-destructive bg-destructive/5 focus-visible:ring-destructive" : "")}
                          >
                            <Package className={cn("h-4 w-4 shrink-0", prodErr ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                            <span className={cn("min-w-0 flex-1 truncate text-left", selected ? "text-foreground" : prodErr ? "text-destructive" : "text-muted-foreground")}>
                              {selected ? selected.name : productPlaceholder}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[28rem]" align="start">
                          <Command shouldFilter>
                            <CommandInput placeholder="Buscar por nombre, C.P.E. o M.P.P.S…" />
                            <CommandList>
                              <CommandEmpty>
                                <div className="space-y-2 p-2 text-sm">
                                  <p>No hay productos que coincidan.</p>
                                  {!clientMissing && !disabled ? (
                                    <Button type="button" variant="secondary" size="sm" asChild>
                                      <Link className="inline-flex items-center" to={{ pathname: newProductLink.pathname, search: newProductLink.search }} state={newProductLink.state} onClick={() => onProductComboOpenKeyChange(null)}>
                                        <Plus className="mr-2 h-4 w-4" /> Crear producto
                                      </Link>
                                    </Button>
                                  ) : null}
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem value="sin-producto" onSelect={() => { onUpdateLine(globalIndex, { product_id: "" }); onProductComboOpenKeyChange(null) }}>
                                  <Check className={cn("mr-2 h-4 w-4", line.product_id ? "opacity-0" : "opacity-100")} /> Sin producto
                                </CommandItem>
                                {productsForClient.map((p) => (
                                  <CommandItem key={p.id} value={`${p.name} ${p.cpe ?? ""} ${p.mps ?? ""}`} onSelect={() => { onUpdateLine(globalIndex, { product_id: p.id }); onProductComboOpenKeyChange(null) }}>
                                    <Check className={cn("mr-2 h-4 w-4", line.product_id === p.id ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{p.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FieldErrorSlot message={prodErr} />
                    </div>

                    {!isNew && (
                      <div className="min-w-0">
                        <MaterialDropdown
                          open={legacyComboOpenKey === line.key}
                          onOpenChange={(o) => setLegacyComboOpenKey(o ? line.key : null)}
                          selectedMat={selectedLegacyByLineKey.get(line.key) ?? null}
                          options={materials}
                          onSelect={(id) => { onUpdateLine(globalIndex, { material_id: id }); setLegacyComboOpenKey(null) }}
                          onClear={() => { onUpdateLine(globalIndex, { material_id: "" }); setLegacyComboOpenKey(null) }}
                          placeholder="M. Legado..."
                          disabled={disabled}
                        />
                      </div>
                    )}

                    <div className="min-w-0">
                      <MaterialDropdown
                        open={imprimirComboOpenKey === line.key}
                        onOpenChange={(o) => onImprimirComboOpenKeyChange?.(o ? line.key : null)}
                        selectedMat={selectedImprimirByLineKey?.get(line.key) ?? null}
                        options={imprimirMaterials}
                        onSelect={(id) => { onUpdateLine(globalIndex, { material_imprimir_id: id }); onImprimirComboOpenKeyChange?.(null) }}
                        onClear={() => { onUpdateLine(globalIndex, { material_imprimir_id: "" }); onImprimirComboOpenKeyChange?.(null) }}
                        placeholder="M. Imprimir..."
                        disabled={disabled}
                      />
                    </div>
                    
                    <div className="min-w-0">
                      <MaterialDropdown
                        open={laminarComboOpenKey === line.key}
                        onOpenChange={(o) => onLaminarComboOpenKeyChange?.(o ? line.key : null)}
                        selectedMat={selectedLaminarByLineKey?.get(line.key) ?? null}
                        options={laminarMaterials}
                        onSelect={(id) => { onUpdateLine(globalIndex, { material_laminar_id: id }); onLaminarComboOpenKeyChange?.(null) }}
                        onClear={() => { onUpdateLine(globalIndex, { material_laminar_id: "" }); onLaminarComboOpenKeyChange?.(null) }}
                        placeholder="M. Laminar..."
                        disabled={disabled}
                      />
                    </div>
                    
                    <div className="min-w-0">
                      <MaterialDropdown
                        open={trilaminarComboOpenKey === line.key}
                        onOpenChange={(o) => onTrilaminarComboOpenKeyChange?.(o ? line.key : null)}
                        selectedMat={selectedTrilaminarByLineKey?.get(line.key) ?? null}
                        options={trilaminarMaterials}
                        onSelect={(id) => { onUpdateLine(globalIndex, { material_trilaminar_id: id }); onTrilaminarComboOpenKeyChange?.(null) }}
                        onClear={() => { onUpdateLine(globalIndex, { material_trilaminar_id: "" }); onTrilaminarComboOpenKeyChange?.(null) }}
                        placeholder="M. Trilaminar..."
                        disabled={disabled}
                      />
                    </div>

                    {!isNew && (
                      <Input
                        disabled={disabled} value={line.unit ?? "kg"}
                        onChange={(e) => onUpdateLine(globalIndex, { unit: e.target.value })}
                        className={cn(catalogMasterFormPlainInputClass, "h-11")} placeholder="kg"
                      />
                    )}

                    <div className="flex h-11 items-center justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button" variant="ghost" size="icon" disabled={disabled || lines.length <= 1}
                            onClick={() => handleRemoveLine(globalIndex)} aria-label={`Quitar línea ${globalIndex + 1}`}
                            className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Quitar línea</TooltipContent>
                      </Tooltip>
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>

        <ClientOrderLinesPaginator
          page={safePage} totalPages={totalPages} totalItems={lines.length}
          onPageChange={setLinesPage} disabled={disabled}
        />

        <div className="flex justify-center sm:justify-start">
          <Button type="button" variant="secondary" className={CLIENT_ORDER_MASTER_SECONDARY_HOVER} disabled={disabled} onClick={handleAddLine}>
            <Plus className="mr-2 h-4 w-4" /> {CLIENT_ORDER_LINES_ADD_BUTTON}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}