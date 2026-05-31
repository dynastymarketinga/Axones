"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Droplet,
  FlaskConical,
  Layers,
  Package,
  PackagePlus,
  Plus,
  Ruler,
  Scale,
  X,
} from "lucide-react"

import { apiFetch } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
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
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { PoItemType } from "@/pages/axones/purchase-order-shared"
import {
  emptyLine,
  isPoLineUnit,
  normalizeLineByBusinessRules,
  PO_LINES_PAGE_SIZE,
  type PoLineEditDraft,
  type PoLineUnit,
  sanitizePositiveDecimalInput,
  shouldShowDims,
} from "@/pages/axones/purchase-order-line-draft"

const ADD_LINE_TOOLTIP =
  "Agregar otra línea al pedido. Las filas vacías se omiten al guardar si hay al menos una línea válida."

const PO_ROW_FIELD_CLASS = "border-white/60 bg-background/90 shadow-sm h-10 text-base"

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function mapPoItemTypeToInventoryArea(itemType: PoItemType): string {
  if (itemType === "tinta") return "tintas"
  if (itemType === "quimico") return "quimicos"
  if (itemType === "otros") return "miscelaneos"
  return "material"
}

function materialsForPoItemType(materialsList: MaterialRow[], itemType: PoItemType): MaterialRow[] {
  const area = mapPoItemTypeToInventoryArea(itemType)
  return materialsList.filter((m) => normalizeKey(m.inventory_area) === normalizeKey(area))
}

const PO_ITEM_TYPE_META: Record<
  PoItemType,
  {
    label: string
    icon: typeof Layers
    iconClass: string
    badgeClass: string
    rowClass: string
    selectTriggerClass: string
    rowNumberClass: string
  }
> = {
  sustrato: {
    label: "Sustrato",
    icon: Layers,
    iconClass: "text-emerald-600",
    badgeClass: "border-emerald-500/40 bg-emerald-50/90 text-emerald-950",
    rowClass:
      "border-l-4 border-l-emerald-600 !bg-emerald-100/85 hover:!bg-emerald-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-emerald-500/40 bg-emerald-50/95 text-emerald-950 shadow-sm",
    rowNumberClass: "border-emerald-500/40 bg-emerald-200/70 text-emerald-900",
  },
  tinta: {
    label: "Tinta",
    icon: Droplet,
    iconClass: "text-violet-600",
    badgeClass: "border-violet-500/40 bg-violet-50/90 text-violet-950",
    rowClass:
      "border-l-4 border-l-violet-600 !bg-violet-100/85 hover:!bg-violet-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-violet-500/40 bg-violet-50/95 text-violet-950 shadow-sm",
    rowNumberClass: "border-violet-500/40 bg-violet-200/70 text-violet-900",
  },
  quimico: {
    label: "Químico",
    icon: FlaskConical,
    iconClass: "text-sky-600",
    badgeClass: "border-sky-500/40 bg-sky-50/90 text-sky-950",
    rowClass:
      "border-l-4 border-l-sky-600 !bg-sky-100/85 hover:!bg-sky-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-sky-500/40 bg-sky-50/95 text-sky-950 shadow-sm",
    rowNumberClass: "border-sky-500/40 bg-sky-200/70 text-sky-900",
  },
  otros: {
    label: "Otros",
    icon: Package,
    iconClass: "text-amber-600",
    badgeClass: "border-amber-500/40 bg-amber-50/90 text-amber-950",
    rowClass:
      "border-l-4 border-l-amber-600 !bg-amber-100/85 hover:!bg-amber-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-amber-500/40 bg-amber-50/95 text-amber-950 shadow-sm",
    rowNumberClass: "border-amber-500/40 bg-amber-200/70 text-amber-900",
  },
}

const PO_ITEM_TYPE_OPTIONS = Object.keys(PO_ITEM_TYPE_META) as PoItemType[]

function poInvalidHighlightClass(hasError: boolean) {
  return hasError
    ? "border-destructive/80 bg-destructive/[0.06] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35),0_0_0_3px_rgba(239,68,68,0.12)]"
    : ""
}

function poFieldIconClass(hasError: boolean, disabled?: boolean) {
  return cn(
    "pointer-events-none absolute left-3 h-4 w-4 transition-colors",
    hasError
      ? "text-red-500"
      : disabled
        ? "text-muted-foreground/50"
        : "text-muted-foreground group-focus-within/field:text-primary",
  )
}

function PoItemTypeLabel({ type }: { type: PoItemType }) {
  const meta = PO_ITEM_TYPE_META[type]
  const Icon = meta.icon
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className={cn("size-4 shrink-0", meta.iconClass)} aria-hidden />
      <span className="truncate">{meta.label}</span>
    </span>
  )
}

export type PoLineFieldErrors = {
  description?: string
  quantity?: string
  unit?: string
}

type PurchaseOrderLinesEditorProps = {
  lines: PoLineEditDraft[]
  onLinesChange: (lines: PoLineEditDraft[]) => void
  saving?: boolean
  lineErrors?: Record<number, PoLineFieldErrors>
  returnPath?: string
  supplierId?: number
}

export function PurchaseOrderLinesEditor({
  lines,
  onLinesChange,
  saving = false,
  lineErrors = {},
  returnPath,
  supplierId,
}: PurchaseOrderLinesEditorProps) {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [materialPickerOpenRow, setMaterialPickerOpenRow] = useState<number | null>(null)
  const [linesPage, setLinesPage] = useState(1)

  const showDimensionColumns = useMemo(
    () => lines.some((line) => shouldShowDims(line.item_type)),
    [lines],
  )

  const linesPageCount = useMemo(
    () => Math.max(1, Math.ceil(lines.length / PO_LINES_PAGE_SIZE)),
    [lines.length],
  )

  const safeLinesPage = Math.min(linesPage, linesPageCount)

  const paginatedLineEntries = useMemo(() => {
    const start = (safeLinesPage - 1) * PO_LINES_PAGE_SIZE
    return lines.slice(start, start + PO_LINES_PAGE_SIZE).map((line, offset) => ({
      line,
      index: start + offset,
    }))
  }, [lines, safeLinesPage])

  useEffect(() => {
    setLinesPage((p) => (p > linesPageCount ? linesPageCount : p))
  }, [linesPageCount])

  async function refreshMaterialsList() {
    try {
      const matRes = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { per_page: 200, page: 1 },
      })
      setMaterials(matRes.data ?? [])
    } catch {
      /* mantener listado previo */
    }
  }

  function updateLine(i: number, patch: Partial<PoLineEditDraft>) {
    onLinesChange(
      lines.map((row, j) => (j === i ? normalizeLineByBusinessRules({ ...row, ...patch }) : row)),
    )
  }

  function addLine() {
    const next = [...lines, emptyLine()]
    onLinesChange(next)
    setLinesPage(Math.ceil(next.length / PO_LINES_PAGE_SIZE))
  }

  function removeLine(i: number) {
    const line = lines[i]
    if ((line?.quantity_received ?? 0) > 0) return
    const next = lines.filter((_, j) => j !== i)
    onLinesChange(next.length ? next : [emptyLine()])
    setLinesPage((p) => Math.min(p, Math.max(1, Math.ceil(next.length / PO_LINES_PAGE_SIZE))))
  }

  function openMaterialPicker(rowIndex: number) {
    setMaterialPickerOpenRow(rowIndex)
    void refreshMaterialsList()
  }

  function selectMaterialFromCatalog(rowIndex: number, material: MaterialRow) {
    const unitRaw = (material.unit || "kg").trim()
    const unit: PoLineUnit = isPoLineUnit(unitRaw) ? unitRaw : "kg"
    updateLine(rowIndex, {
      material_id: String(material.id),
      description: material.sku || material.name || "",
      micras: material.micras?.trim() ?? "",
      ancho_mm: material.ancho?.trim() ?? "",
      unit,
    })
    setMaterialPickerOpenRow(null)
  }

  function goToCreateMaterial(rowIndex: number) {
    const row = lines[rowIndex]
    if (!row) return
    navigate("/materiales/nuevo", {
      state: {
        from: returnPath ?? "/ordenes-compra",
        materialPrefillFromReceipt: {
          tab: mapPoItemTypeToInventoryArea(row.item_type),
          sku: row.description.trim().toUpperCase(),
          name: row.description.trim(),
          micras: row.micras.trim(),
          ancho: row.ancho_mm.trim(),
          supplierId: supplierId && supplierId > 0 ? supplierId : null,
        },
      },
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/15 bg-gradient-to-b from-muted/20 to-background p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            <Package className="size-5 text-primary" aria-hidden />
            Artículos del pedido
            <Badge
              variant="outline"
              className="min-w-[1.75rem] justify-center border-primary/30 bg-primary/5 px-2 text-xs font-semibold tabular-nums text-primary"
            >
              {lines.length}
            </Badge>
          </h2>
          <p className="text-muted-foreground text-sm">
            Edite material, cantidad y unidad por línea. Puede agregar o quitar filas (no se eliminan
            líneas con recepciones registradas).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={saving}
                className="h-9 w-9 shrink-0 shadow-sm"
                aria-label="Crear material en inventario"
                onClick={() => goToCreateMaterial(0)}
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
                disabled={saving}
                className="h-9 w-9 shrink-0 shadow-md"
                aria-label="Agregar línea al pedido"
                onClick={addLine}
              >
                <Plus aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[15rem] text-left">
              {ADD_LINE_TOOLTIP}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="po-doc-lines-table overflow-x-auto rounded-xl border border-primary/10 bg-card shadow-inner">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-14 text-sm">N°</TableHead>
              <TableHead className="min-w-[280px] text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Package className="size-3.5 text-primary" aria-hidden />
                  Material solicitado
                </span>
              </TableHead>
              <TableHead className="w-40 text-sm">Tipo</TableHead>
              {showDimensionColumns ? (
                <>
                  <TableHead className="w-28 text-sm">Micras</TableHead>
                  <TableHead className="w-28 text-sm">Ancho</TableHead>
                </>
              ) : null}
              <TableHead className="w-36 text-sm">Cantidad *</TableHead>
              <TableHead className="w-36 text-sm">Unidad</TableHead>
              <TableHead className="w-24 text-sm">Recibido</TableHead>
              <TableHead className="w-[4.5rem] p-0 text-center">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLineEntries.map(({ line, index: i }) => {
              const rowHasError = Boolean(lineErrors[i] && Object.keys(lineErrors[i]).length > 0)
              const typeMeta = PO_ITEM_TYPE_META[line.item_type]
              const receivedQty = line.quantity_received ?? 0
              const canRemove = lines.length > 1 && receivedQty <= 0 && !saving
              return (
                <TableRow
                  key={line.line_id ?? `new-${i}`}
                  id={`po-line-row-${i}`}
                  data-po-line-type={line.item_type}
                  className={cn(typeMeta.rowClass, rowHasError && "ring-2 ring-inset ring-destructive/35")}
                >
                  <TableCell className="align-middle">
                    <div
                      className={cn(
                        "flex h-10 items-center justify-center rounded-md border px-2 text-sm font-semibold",
                        typeMeta.rowNumberClass,
                      )}
                    >
                      {i + 1}
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Popover
                      open={materialPickerOpenRow === i}
                      onOpenChange={(open) => setMaterialPickerOpenRow(open ? i : null)}
                    >
                      <div className="group/field relative">
                        <Package
                          className={cn(
                            poFieldIconClass(Boolean(lineErrors[i]?.description), saving),
                            "top-1/2 -translate-y-1/2",
                          )}
                          aria-hidden
                        />
                        <PopoverAnchor asChild>
                          <Input
                            role="combobox"
                            aria-expanded={materialPickerOpenRow === i}
                            value={line.description}
                            onFocus={() => openMaterialPicker(i)}
                            onClick={() => openMaterialPicker(i)}
                            onChange={(ev) => {
                              updateLine(i, {
                                description: ev.target.value,
                                material_id: "",
                              })
                            }}
                            placeholder="Escriba o elija del inventario…"
                            aria-label={`Material solicitado, fila ${i + 1}`}
                            disabled={saving}
                            className={cn(
                              "pl-10 pr-8",
                              PO_ROW_FIELD_CLASS,
                              poInvalidHighlightClass(Boolean(lineErrors[i]?.description)),
                            )}
                          />
                        </PopoverAnchor>
                        <ChevronsUpDown
                          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
                          aria-hidden
                        />
                      </div>
                      <PopoverContent
                        className="w-[min(100vw-2rem,28rem)] min-w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                        side="bottom"
                        onOpenAutoFocus={(ev) => ev.preventDefault()}
                      >
                        <Command shouldFilter>
                          <CommandInput placeholder="Buscar SKU o nombre…" />
                          <CommandList className="max-h-60">
                            <CommandEmpty>Sin coincidencias. Escriba libremente o cree el material.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="sin seleccion solo texto libre"
                                onSelect={() => {
                                  updateLine(i, { material_id: "" })
                                  setMaterialPickerOpenRow(null)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !line.material_id ? "opacity-100" : "opacity-0",
                                  )}
                                  aria-hidden
                                />
                                Solo texto libre
                              </CommandItem>
                              {materialsForPoItemType(materials, line.item_type).map((m) => {
                                const search = [m.sku, m.name, String(m.id)].filter(Boolean).join(" ")
                                return (
                                  <CommandItem
                                    key={m.id}
                                    value={search}
                                    onSelect={() => selectMaterialFromCatalog(i, m)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        line.material_id === String(m.id) ? "opacity-100" : "opacity-0",
                                      )}
                                      aria-hidden
                                    />
                                    <span className="truncate">
                                      {m.sku}
                                      {m.name ? ` · ${m.name}` : ""}
                                    </span>
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Select
                      value={line.item_type}
                      disabled={saving}
                      onValueChange={(v) => {
                        const next = v as PoItemType
                        updateLine(i, {
                          item_type: next,
                          material_id: "",
                          ...(shouldShowDims(next) ? {} : { micras: "", ancho_mm: "" }),
                        })
                      }}
                    >
                      <SelectTrigger className={cn("h-10 font-medium text-base", typeMeta.selectTriggerClass)}>
                        <SelectValue placeholder="Tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PO_ITEM_TYPE_OPTIONS.map((type) => (
                          <SelectItem
                            key={type}
                            value={type}
                            className={cn("my-0.5 rounded-md", PO_ITEM_TYPE_META[type].badgeClass)}
                          >
                            <PoItemTypeLabel type={type} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {showDimensionColumns ? (
                    shouldShowDims(line.item_type) ? (
                      <>
                        <TableCell className="align-middle">
                          <Input
                            inputMode="numeric"
                            value={line.micras}
                            onChange={(ev) =>
                              updateLine(i, {
                                micras: sanitizePositiveDecimalInput(ev.target.value, 3),
                              })
                            }
                            placeholder="20"
                            disabled={saving}
                            className={PO_ROW_FIELD_CLASS}
                          />
                        </TableCell>
                        <TableCell className="align-middle">
                          <Input
                            inputMode="numeric"
                            value={line.ancho_mm}
                            onChange={(ev) =>
                              updateLine(i, {
                                ancho_mm: sanitizePositiveDecimalInput(ev.target.value, 3),
                              })
                            }
                            placeholder="520"
                            disabled={saving}
                            className={PO_ROW_FIELD_CLASS}
                          />
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell aria-hidden />
                        <TableCell aria-hidden />
                      </>
                    )
                  ) : null}
                  <TableCell className="align-middle">
                    <Input
                      inputMode="decimal"
                      value={line.quantity_ordered}
                      disabled={saving}
                      placeholder="Ej: 500"
                      onChange={(ev) =>
                        updateLine(i, {
                          quantity_ordered: sanitizePositiveDecimalInput(ev.target.value, 6),
                        })
                      }
                      className={cn(
                        PO_ROW_FIELD_CLASS,
                        poInvalidHighlightClass(Boolean(lineErrors[i]?.quantity)),
                      )}
                    />
                  </TableCell>
                  <TableCell className="align-middle">
                    <Select
                      value={isPoLineUnit(line.unit.trim()) ? line.unit.trim() : "kg"}
                      onValueChange={(v) => updateLine(i, { unit: v as PoLineUnit })}
                      disabled={saving}
                    >
                      <SelectTrigger className={cn("h-10 text-base", PO_ROW_FIELD_CLASS)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="unidad">Unidad</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="rollo">Rollo</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-middle text-sm tabular-nums text-muted-foreground">
                    {receivedQty > 0 ? `${receivedQty} ${line.unit}` : "—"}
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex items-center justify-center gap-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        disabled={saving}
                        onClick={() => goToCreateMaterial(i)}
                        aria-label={`Crear material desde fila ${i + 1}`}
                      >
                        <PackagePlus className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        disabled={!canRemove}
                        onClick={() => removeLine(i)}
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
      </div>

      {lines.length > PO_LINES_PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            Mostrando {(safeLinesPage - 1) * PO_LINES_PAGE_SIZE + 1}–
            {Math.min(safeLinesPage * PO_LINES_PAGE_SIZE, lines.length)} de {lines.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safeLinesPage <= 1 || saving}
              onClick={() => setLinesPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-muted-foreground tabular-nums">
              Pág. {safeLinesPage} / {linesPageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safeLinesPage >= linesPageCount || saving}
              onClick={() => setLinesPage((p) => Math.min(linesPageCount, p + 1))}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
