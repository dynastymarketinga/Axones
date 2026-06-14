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
  CLIENT_ORDER_LINE_DESCRIPTION_LABEL,
  CLIENT_ORDER_LINE_DESCRIPTION_PLACEHOLDER,
  CLIENT_ORDER_LINE_MATERIAL_EMPTY,
  CLIENT_ORDER_LINE_MATERIAL_LABEL,
  CLIENT_ORDER_LINE_MATERIAL_PLACEHOLDER,
  CLIENT_ORDER_LINE_MATERIAL_SEARCH_PLACEHOLDER,
  CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER,
  CLIENT_ORDER_LINES_ADD_BUTTON,
  CLIENT_ORDER_LINES_PAGE_SIZE,
  clientOrderLinesPagerLabel,
} from "@/pages/axones/client-order-i18n"

const CLIENT_ORDER_MASTER_SECONDARY_HOVER =
  "transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-primary/12 hover:text-foreground hover:shadow-md active:translate-y-0 active:shadow-sm dark:hover:bg-primary/18"

const NEW_LINE_GRID =
  "grid grid-cols-[2.5rem_minmax(11rem,1.4fr)_6.5rem_6.5rem_minmax(10rem,1.1fr)_minmax(12rem,1.2fr)_8.5rem_2.75rem] items-start gap-x-3 gap-y-1"

const EDIT_LINE_GRID =
  "grid grid-cols-[2.5rem_minmax(11rem,1.4fr)_6.5rem_6.5rem_8.5rem_6rem_2.75rem] items-start gap-x-3 gap-y-1"

export type ClientOrderLineProductOption = {
  id: string
  name: string
  cpe: string | null
  mps: string | null
}

export type ClientOrderLineDraft = {
  key: string
  product_id: string
  material_id?: string
  description?: string
  quantity: string
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
  materialComboOpenKey?: string | null
  onMaterialComboOpenKeyChange?: (key: string | null) => void
  selectedProductByLineKey: Map<string, ClientOrderLineProductOption | null>
  selectedMaterialByLineKey?: Map<string, MaterialRow | null>
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
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shadow-sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior de líneas"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shadow-sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente de líneas"
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
  materialComboOpenKey = null,
  onMaterialComboOpenKeyChange,
  selectedProductByLineKey,
  selectedMaterialByLineKey,
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
  const isNew = variant === "new"
  const gridClass = isNew ? NEW_LINE_GRID : EDIT_LINE_GRID
  const minWidth = isNew ? "min-w-[72rem]" : "min-w-[52rem]"

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
    const willEmptyPage =
      visibleLines.length === 1 && safePage > 1 && globalIndex === start
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            disabled
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="sr-only">Nuevo producto</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Seleccione un cliente primero</TooltipContent>
      </Tooltip>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary"
            asChild
          >
            <Link
              to={{ pathname: newProductLink.pathname, search: newProductLink.search }}
              state={newProductLink.state}
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="sr-only">Nuevo producto</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Nuevo producto</TooltipContent>
      </Tooltip>
    )

  const newMaterialHeaderAction =
    newMaterialLink && !disabled ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary"
            asChild
          >
            <Link to={newMaterialLink.pathname} state={newMaterialLink.state}>
              <Plus className="h-4 w-4" aria-hidden />
              <span className="sr-only">Nuevo material</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Nuevo material</TooltipContent>
      </Tooltip>
    ) : null

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
          <div className={cn("rounded-xl border border-border bg-muted/20 p-3", minWidth)}>
            <div className={cn(gridClass, "border-border/60 border-b pb-3")}>
              <ColumnHeader icon={Hash} label="#" />
              <ColumnHeader icon={Package} label="Producto *" action={newProductHeaderAction} />
              <ColumnHeader icon={Hash} label="C.P.E." />
              <ColumnHeader icon={Hash} label="M.P.P.S." />
              {isNew ? (
                <>
                  <ColumnHeader
                    icon={Layers}
                    label={CLIENT_ORDER_LINE_MATERIAL_LABEL}
                    action={newMaterialHeaderAction}
                  />
                  <ColumnHeader icon={Hash} label={CLIENT_ORDER_LINE_DESCRIPTION_LABEL} />
                </>
              ) : null}
              <ColumnHeader icon={Scale} label="Cantidad *" />
              {!isNew ? <ColumnHeader icon={Hash} label="Unidad" /> : null}
              <span className="sr-only">Quitar</span>
            </div>

            {lines.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No hay líneas. Pulse «Añadir línea».
              </p>
            ) : (
              visibleLines.map(({ line, globalIndex }) => {
                const selected = selectedProductByLineKey.get(line.key) ?? null
                const selectedMat = selectedMaterialByLineKey?.get(line.key) ?? null
                const lineErr = lineFieldErrorsByKey?.get(line.key)
                const prodErr = lineErr?.product
                const qtyErrGate = lineErr?.quantity
                const qtyErrBlur =
                  qtyBlurKeys?.has(line.key) && line.product_id.trim()
                    ? CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER
                    : undefined
                const qtyErr = qtyErrGate ?? qtyErrBlur

                return (
                  <div
                    key={line.key}
                    className={cn(gridClass, "border-border/40 border-b py-2 last:border-b-0")}
                  >
                    <div className="flex h-11 items-center justify-center">
                      <span className="text-muted-foreground text-sm font-semibold tabular-nums">
                        {globalIndex + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <Popover
                        open={productComboOpenKey === line.key}
                        onOpenChange={(open) =>
                          onProductComboOpenKeyChange(open ? line.key : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            disabled={disabled}
                            id={`co-product-${line.key}`}
                            aria-expanded={productComboOpenKey === line.key}
                            aria-invalid={Boolean(prodErr)}
                            className={cn(
                              catalogMasterFormPlainInputClass,
                              "h-11 w-full justify-between gap-2 px-3 font-normal",
                              prodErr
                                ? "border-destructive bg-destructive/5 focus-visible:ring-destructive"
                                : "",
                            )}
                          >
                            <Package
                              className={cn(
                                "h-4 w-4 shrink-0",
                                prodErr ? "text-destructive" : "text-muted-foreground",
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-left",
                                selected
                                  ? "text-foreground"
                                  : prodErr
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                              )}
                            >
                              {selected ? selected.name : productPlaceholder}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[18rem]"
                          align="start"
                        >
                          <Command shouldFilter>
                            <CommandInput placeholder="Buscar por nombre, C.P.E. o M.P.P.S…" />
                            <CommandList>
                              <CommandEmpty>
                                <div className="space-y-2 p-2 text-sm">
                                  <p>No hay productos que coincidan.</p>
                                  {!clientMissing && !disabled ? (
                                    <Button type="button" variant="secondary" size="sm" asChild>
                                      <Link
                                        className="inline-flex items-center"
                                        to={{
                                          pathname: newProductLink.pathname,
                                          search: newProductLink.search,
                                        }}
                                        state={newProductLink.state}
                                        onClick={() => onProductComboOpenKeyChange(null)}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Crear producto
                                      </Link>
                                    </Button>
                                  ) : null}
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {isNew ? (
                                  <CommandItem
                                    value="sin-producto"
                                    onSelect={() => {
                                      onUpdateLine(globalIndex, { product_id: "" })
                                      onProductComboOpenKeyChange(null)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        line.product_id ? "opacity-0" : "opacity-100",
                                      )}
                                    />
                                    Sin producto
                                  </CommandItem>
                                ) : null}
                                {productsForClient.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name} ${p.cpe ?? ""} ${p.mps ?? ""}`}
                                    onSelect={() => {
                                      onUpdateLine(globalIndex, { product_id: p.id })
                                      onProductComboOpenKeyChange(null)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        line.product_id === p.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
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

                    <Input
                      value={selected?.cpe ?? ""}
                      readOnly
                      tabIndex={-1}
                      className={cn(catalogMasterFormPlainInputClass, "h-11 bg-muted/30")}
                      placeholder="—"
                    />

                    <Input
                      value={selected?.mps ?? ""}
                      readOnly
                      tabIndex={-1}
                      className={cn(catalogMasterFormPlainInputClass, "h-11 bg-muted/30")}
                      placeholder="—"
                    />

                    {isNew ? (
                      <>
                        <div className="min-w-0">
                          <Popover
                            open={materialComboOpenKey === line.key}
                            onOpenChange={(open) =>
                              onMaterialComboOpenKeyChange?.(open ? line.key : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                disabled={disabled}
                                id={`co-material-${line.key}`}
                                aria-expanded={materialComboOpenKey === line.key}
                                className={cn(
                                  catalogMasterFormPlainInputClass,
                                  "h-11 w-full justify-between gap-2 px-3 font-normal",
                                )}
                              >
                                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 flex-1 truncate text-left">
                                  {selectedMat
                                    ? `${selectedMat.sku} — ${selectedMat.name}`
                                    : CLIENT_ORDER_LINE_MATERIAL_PLACEHOLDER}
                                </span>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[18rem]"
                              align="start"
                            >
                              <Command shouldFilter>
                                <CommandInput
                                  placeholder={CLIENT_ORDER_LINE_MATERIAL_SEARCH_PLACEHOLDER}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    <div className="space-y-2 p-2 text-sm">
                                      <p>No hay materiales que coincidan.</p>
                                      {newMaterialLink ? (
                                        <Button type="button" variant="secondary" size="sm" asChild>
                                          <Link
                                            className="inline-flex items-center"
                                            to={newMaterialLink.pathname}
                                            state={newMaterialLink.state}
                                            onClick={() => onMaterialComboOpenKeyChange?.(null)}
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Crear material
                                          </Link>
                                        </Button>
                                      ) : null}
                                    </div>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="sin-material"
                                      onSelect={() => {
                                        onUpdateLine(globalIndex, { material_id: "" })
                                        onMaterialComboOpenKeyChange?.(null)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          line.material_id ? "opacity-0" : "opacity-100",
                                        )}
                                      />
                                      {CLIENT_ORDER_LINE_MATERIAL_EMPTY}
                                    </CommandItem>
                                    {materials.map((m) => (
                                      <CommandItem
                                        key={m.id}
                                        value={`${m.sku} ${m.name}`}
                                        onSelect={() => {
                                          onUpdateLine(globalIndex, { material_id: String(m.id) })
                                          onMaterialComboOpenKeyChange?.(null)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            line.material_id === String(m.id)
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        <span className="truncate">
                                          {m.sku} — {m.name}
                                        </span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <Input
                          id={`co-line-desc-${line.key}`}
                          type="text"
                          maxLength={512}
                          disabled={disabled}
                          value={line.description ?? ""}
                          onChange={(e) =>
                            onUpdateLine(globalIndex, { description: e.target.value })
                          }
                          placeholder={CLIENT_ORDER_LINE_DESCRIPTION_PLACEHOLDER}
                          className={cn(catalogMasterFormPlainInputClass, "h-11")}
                        />
                      </>
                    ) : null}

                    <div className="min-w-0">
                      <div className="group/qty relative">
                        <Scale
                          className={cn(
                            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                            qtyErr
                              ? "text-destructive"
                              : "text-muted-foreground group-focus-within/qty:text-primary",
                          )}
                          aria-hidden
                        />
                        <Input
                          id={`co-qty-${line.key}`}
                          type="text"
                          inputMode="decimal"
                          disabled={disabled}
                          aria-invalid={Boolean(qtyErr)}
                          className={cn(
                            catalogMasterFormInputClass,
                            "h-11",
                            qtyErr
                              ? "border-destructive bg-destructive/5 focus-visible:ring-destructive"
                              : "",
                          )}
                          value={line.quantity}
                          onChange={(e) => {
                            const raw = sanitizeDecimalTwoInput(e.target.value)
                            onUpdateLine(globalIndex, { quantity: raw })
                          }}
                          onBlur={() => {
                            const formatted = formatDecimalTwoOnBlur(line.quantity)
                            if (formatted !== line.quantity) {
                              onUpdateLine(globalIndex, { quantity: formatted })
                            }
                            onQuantityBlur?.(
                              line.key,
                              globalIndex,
                              line.product_id,
                              formatted || line.quantity,
                            )
                          }}
                          placeholder="Ej. 1000"
                        />
                      </div>
                      <FieldErrorSlot message={qtyErr} />
                    </div>

                    {!isNew ? (
                      <Input
                        disabled={disabled}
                        value={line.unit ?? "kg"}
                        onChange={(e) => onUpdateLine(globalIndex, { unit: e.target.value })}
                        className={cn(catalogMasterFormPlainInputClass, "h-11")}
                        placeholder="kg"
                      />
                    ) : null}

                    <div className="flex h-11 items-center justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            disabled={disabled || lines.length <= 1}
                            onClick={() => handleRemoveLine(globalIndex)}
                            aria-label={`Quitar línea ${globalIndex + 1}`}
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
          page={safePage}
          totalPages={totalPages}
          totalItems={lines.length}
          onPageChange={setLinesPage}
          disabled={disabled}
        />

        <div className="flex justify-center sm:justify-start">
          <Button
            type="button"
            variant="secondary"
            className={CLIENT_ORDER_MASTER_SECONDARY_HOVER}
            disabled={disabled}
            onClick={handleAddLine}
          >
            <Plus className="mr-2 h-4 w-4" />
            {CLIENT_ORDER_LINES_ADD_BUTTON}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
