import { useId, useMemo, useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  FileSearch,
  PackageCheck,
  PackageX,
  Plus,
  Trash2,
  Undo2,
  Warehouse,
  Weight,
} from "lucide-react"

import { MesSectionHeaderExtras, MesSectionShell, mesSectionTitle } from "@/components/axones/mes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { MaterialRow } from "@/types/api"
import {
  PRINTING_REJECT_REASONS,
  sumRejectedEntryBobinas,
  type WarehouseRejectedEntry,
  type WarehouseReturnDraft,
} from "./printing-turnos"

export type MesWarehouseReturnPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderCode: string
  draft: WarehouseReturnDraft
  onDraftChange: (patch: Partial<WarehouseReturnDraft>) => void
  onRejectedEntryChange: (id: string, patch: Partial<WarehouseRejectedEntry>) => void
  onAddRejectedEntry: () => void
  onRemoveRejectedEntry: (id: string) => void
  materialOptionsGood: MaterialRow[]
  materialOptionsBad: MaterialRow[]
  supplierOptions: Array<{ id: number | string; name: string }>
  loadingGood: boolean
  loadingBad: boolean
  loadingSuppliers: boolean
  submitting: boolean
  onSubmit: () => void | Promise<void>
}

export type MesWarehouseReturnSectionProps = {
  inputDisabled: boolean
  doneDevoluciones: boolean
  devolucionesPendienteAlmacen: boolean
  devolucionBuenaRaw: string
  onSetDevolucionBuena: (v: string) => void
  areaFlowLabel: string
  fieldPrefix: string
  warehouseReturn: MesWarehouseReturnPanelProps
}

function fieldLabel(htmlFor: string, icon: LucideIcon, text: ReactNode) {
  const I = icon
  return (
    <Label htmlFor={htmlFor} className="ot-label">
      <span className="inline-flex items-center gap-1.5">
        <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>{text}</span>
      </span>
    </Label>
  )
}

function isRejectedFieldComboOpen(
  open: { entryId: string; field: "motivo" | "proveedor" | "material" } | null,
  entryId: string,
  field: "motivo" | "proveedor" | "material",
): boolean {
  return open?.entryId === entryId && open.field === field
}

function num(v: string): number {
  const raw = String(v ?? "").trim().replace(",", ".")
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function MesWarehouseReturnSection(props: MesWarehouseReturnSectionProps) {
  const { inputDisabled, fieldPrefix, areaFlowLabel, warehouseReturn } = props
  const [openRejectedCombo, setOpenRejectedCombo] = useState<{
    entryId: string
    field: "motivo" | "proveedor" | "material"
  } | null>(null)
  const [buenaComboOpen, setBuenaComboOpen] = useState(false)

  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`
  const fn = (suffix: string) => `${fieldPrefix}${suffix}`

  const rechBobinasFromEntries = sumRejectedEntryBobinas(warehouseReturn.draft.rechazadaEntries)
  const rechBobinas = rechBobinasFromEntries

  const buenaMaterialSelected = useMemo(
    () =>
      warehouseReturn.materialOptionsGood.find(
        (m) => String(m.id) === warehouseReturn.draft.buenaMaterialId,
      ),
    [warehouseReturn.draft.buenaMaterialId, warehouseReturn.materialOptionsGood],
  )

  function rejectedMotivoLabel(entry: WarehouseRejectedEntry): string {
    const bobinas = Math.max(0, Math.floor(num(entry.bobinas)))
    if (inputDisabled || bobinas <= 0) return "— (indique bobinas rechazadas primero)"
    const id = entry.motivo.trim()
    if (!id) return "Seleccione motivo (obligatorio si hay bobinas rechazadas)"
    return PRINTING_REJECT_REASONS.find((r) => r.id === id)?.label ?? id
  }

  function rejectedMaterialLabel(entry: WarehouseRejectedEntry): string {
    const material = warehouseReturn.materialOptionsBad.find((m) => String(m.id) === entry.materialId)
    if (warehouseReturn.loadingBad) return "Cargando…"
    if (!material) return "— (opcional)"
    return `${material.sku} · ${material.name}`
  }

  function rejectedSupplierLabel(entry: WarehouseRejectedEntry): string {
    const supplier = warehouseReturn.supplierOptions.find((s) => String(s.id) === entry.proveedorId)
    if (warehouseReturn.loadingSuppliers) return "Cargando…"
    if (!supplier) return "— (opcional)"
    return supplier.name
  }

  function rejectedMaterialsForEntry(entry: WarehouseRejectedEntry): MaterialRow[] {
    const all = warehouseReturn.materialOptionsBad
    const provId = entry.proveedorId.trim()
    if (!provId) return all
    return all.filter((m) => m.supplier_id != null && String(m.supplier_id) === provId)
  }

  return (
    <MesSectionShell
      title={mesSectionTitle(Undo2, "Devoluciones de bobina")}
      subtle
      headerRight={<MesSectionHeaderExtras isDone={props.doneDevoluciones} />}
    >
      {props.devolucionesPendienteAlmacen ? (
        <div className="-mt-1 mb-2 space-y-1.5">
          <span className="inline-flex items-center rounded-full border border-amber-500/80 bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950">
            Pendiente de registrar en almacén
          </span>
          <p className="text-[11px] leading-snug text-amber-950/90 dark:text-amber-100/90">
            El formulario de envío se abre solo en este caso: elija materiales y pulse{" "}
            <span className="font-semibold">Enviar a almacén</span>.
          </p>
        </div>
      ) : null}
      <p className="text-muted-foreground mb-3 text-[11px] leading-snug">
        Buena: kilos a reingreso. Rechazada: bobinas, motivo obligatorio; proveedor y material opcionales. Use{" "}
        <span className="font-medium text-foreground">Agregar línea</span> si hay distintos motivos. Al enviar, ver{" "}
        <Link to="/devoluciones" className="font-medium text-primary underline underline-offset-2">
          Inventario → Devoluciones
        </Link>{" "}
        y, si aplica, <span className="font-medium text-foreground">Inventario → Bobinas</span>.
      </p>

      <Collapsible
        open={warehouseReturn.open}
        onOpenChange={warehouseReturn.onOpenChange}
        className="mt-1"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            disabled={inputDisabled || warehouseReturn.submitting}
            className={cn(
              "group flex w-full items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5 text-left text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/35",
              (inputDisabled || warehouseReturn.submitting) && "pointer-events-none opacity-50",
            )}
          >
            <span className="inline-flex min-w-0 flex-1 items-center gap-2">
              <Warehouse className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <span className="min-w-0 truncate">Envío a almacén — devolución del turno</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                warehouseReturn.open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 space-y-4 rounded-xl border border-border/70 bg-card/40 p-4 shadow-inner sm:p-5">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-2 text-xs">
              <span className="text-muted-foreground">Orden</span>
              <span className="font-mono font-semibold text-foreground">{warehouseReturn.workOrderCode}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{areaFlowLabel}</span>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={mk("warehouse-bobina-ref")} className="ot-label text-xs">
                  Bobina / referencia (ambas devoluciones)
                </Label>
                <span className="text-[10px] text-muted-foreground">Opcional</span>
              </div>
              <Input
                id={mk("warehouse-bobina-ref")}
                name={fn("WarehouseBobinaRef")}
                className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                value={warehouseReturn.draft.bobinaCode}
                onChange={(e) => warehouseReturn.onDraftChange({ bobinaCode: e.target.value })}
                placeholder="Código de bobina, etiqueta o lote"
                disabled={inputDisabled}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="flex h-full flex-col rounded-xl border border-emerald-300/60 bg-gradient-to-b from-emerald-50/80 to-background p-4 dark:border-emerald-800/50 dark:from-emerald-950/35">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-3 dark:border-emerald-800/40">
                  <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Buena</span>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/50 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600"
                  >
                    Reingreso inventario
                  </Badge>
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <div className="space-y-1.5">
                    {fieldLabel(mk("devolucion-buena-kg"), PackageCheck, "Devolución buena (Kg)")}
                    <Input
                      id={mk("devolucion-buena-kg")}
                      name={fn("DevolucionBuenaKg")}
                      className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                      inputMode="decimal"
                      value={props.devolucionBuenaRaw}
                      onChange={(e) => props.onSetDevolucionBuena(e.target.value)}
                      placeholder="0"
                      disabled={inputDisabled}
                    />
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      Material apto para reingreso a inventario.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={mk("warehouse-material-buena")}
                      className="text-xs font-medium text-emerald-900/90 dark:text-emerald-200/90"
                    >
                      Material (área material)
                    </Label>
                    <Popover open={buenaComboOpen} onOpenChange={setBuenaComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          id={mk("warehouse-material-buena")}
                          name={fn("WarehouseMaterialBuena")}
                          variant="outline"
                          role="combobox"
                          aria-expanded={buenaComboOpen}
                          disabled={inputDisabled || warehouseReturn.loadingGood}
                          className="h-9 w-full justify-between gap-2 rounded-md border border-emerald-200/80 bg-white px-3 font-normal shadow-sm dark:bg-white dark:text-slate-900"
                        >
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-left text-sm",
                              !buenaMaterialSelected && "text-muted-foreground",
                            )}
                          >
                            {warehouseReturn.loadingGood
                              ? "Cargando…"
                              : buenaMaterialSelected
                                ? `${buenaMaterialSelected.sku} · ${buenaMaterialSelected.name}`
                                : "Seleccione material"}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                        <Command shouldFilter>
                          <CommandInput placeholder="Buscar por SKU o nombre…" />
                          <CommandList className="max-h-60">
                            <CommandEmpty>Sin coincidencias.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="limpiar material buena"
                                onSelect={() => {
                                  warehouseReturn.onDraftChange({ buenaMaterialId: "" })
                                  setBuenaComboOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    !warehouseReturn.draft.buenaMaterialId ? "opacity-100" : "opacity-0",
                                  )}
                                  aria-hidden
                                />
                                <span className="text-muted-foreground">— (sin material)</span>
                              </CommandItem>
                              {warehouseReturn.materialOptionsGood.map((m) => (
                                <CommandItem
                                  key={m.id}
                                  value={`${m.id} ${m.sku} ${m.name}`}
                                  onSelect={() => {
                                    warehouseReturn.onDraftChange({ buenaMaterialId: String(m.id) })
                                    setBuenaComboOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      String(m.id) === warehouseReturn.draft.buenaMaterialId
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                    aria-hidden
                                  />
                                  <span className="min-w-0 truncate">
                                    {m.sku} · {m.name}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col rounded-xl border border-rose-300/60 bg-gradient-to-b from-rose-50/80 to-background p-4 dark:border-rose-800/50 dark:from-rose-950/35">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/60 pb-3 dark:border-rose-800/40">
                  <span className="text-sm font-semibold text-rose-900 dark:text-rose-200">Rechazada</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive" className="text-[10px]">
                      Bobinas rechazadas
                    </Badge>
                    {!inputDisabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 border-rose-300/80 bg-white text-xs text-rose-900 hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
                        onClick={warehouseReturn.onAddRejectedEntry}
                        disabled={warehouseReturn.submitting}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Agregar línea
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4">
                  {warehouseReturn.draft.rechazadaEntries.map((entry, entryIndex) => {
                    const entryBobinas = Math.max(0, Math.floor(num(entry.bobinas)))
                    const motivoDisabled = inputDisabled || entryBobinas <= 0
                    const isMotivoComboOpen = isRejectedFieldComboOpen(openRejectedCombo, entry.id, "motivo")
                    const isProveedorComboOpen = isRejectedFieldComboOpen(openRejectedCombo, entry.id, "proveedor")
                    const isMaterialComboOpen = isRejectedFieldComboOpen(openRejectedCombo, entry.id, "material")
                    const canRemove = warehouseReturn.draft.rechazadaEntries.length > 1
                    const entryMaterials = rejectedMaterialsForEntry(entry)

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "space-y-3 rounded-lg border border-rose-200/70 bg-white/70 p-3 dark:border-rose-900/50 dark:bg-rose-950/20",
                          entryIndex > 0 && "mt-0",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-rose-900/80 dark:text-rose-200/80">
                            Línea {entryIndex + 1}
                          </span>
                          {canRemove && !inputDisabled ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs text-rose-800 hover:bg-rose-100 hover:text-rose-950 dark:text-rose-200 dark:hover:bg-rose-950/60"
                              onClick={() => warehouseReturn.onRemoveRejectedEntry(entry.id)}
                              disabled={warehouseReturn.submitting}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              Quitar
                            </Button>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          {fieldLabel(
                            mk(`devolucion-rechazada-bobinas-${entry.id}`),
                            PackageX,
                            "N° bobinas rechazadas",
                          )}
                          <Input
                            id={mk(`devolucion-rechazada-bobinas-${entry.id}`)}
                            name={`${fn("DevolucionRechazadaBobinas")}_${entryIndex + 1}`}
                            className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                            inputMode="numeric"
                            value={entry.bobinas}
                            onChange={(e) => {
                              const raw = String(e.target.value ?? "").trim().replace(",", ".")
                              const n = raw === "" ? 0 : Number(raw)
                              const rechZero = !Number.isFinite(n) || n <= 0
                              const bobinas = rechZero ? "" : String(Math.max(0, Math.floor(n)))
                              warehouseReturn.onRejectedEntryChange(entry.id, {
                                bobinas,
                                motivo: rechZero ? "" : entry.motivo,
                              })
                            }}
                            placeholder="0"
                            disabled={inputDisabled}
                          />
                          {entryIndex === 0 ? (
                            <p className="text-muted-foreground text-[11px]">
                              Cantidad de bobinas que pasan a inventario de rechazadas (no es peso en Kg).
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            {fieldLabel(
                              mk(`devolucion-rechazada-kg-${entry.id}`),
                              Weight,
                              "Peso rechazado (Kg)",
                            )}
                            <span className="text-[10px] text-muted-foreground">Opcional</span>
                          </div>
                          <Input
                            id={mk(`devolucion-rechazada-kg-${entry.id}`)}
                            name={`${fn("DevolucionRechazadaKg")}_${entryIndex + 1}`}
                            className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                            inputMode="decimal"
                            value={entry.kg}
                            onChange={(e) =>
                              warehouseReturn.onRejectedEntryChange(entry.id, { kg: e.target.value })
                            }
                            placeholder="0"
                            disabled={inputDisabled}
                          />
                          <p className="text-muted-foreground text-[11px]">
                            Peso de referencia de las bobinas rechazadas (informativo).
                          </p>
                        </div>

                        <div className="space-y-1">
                          {fieldLabel(
                            mk(`devolucion-rechazada-motivo-${entry.id}`),
                            FileSearch,
                            "Motivo (devolución rechazada)",
                          )}
                          <Popover
                            open={isMotivoComboOpen && !motivoDisabled}
                            onOpenChange={(o) => {
                              if (!motivoDisabled) {
                                setOpenRejectedCombo(o ? { entryId: entry.id, field: "motivo" } : null)
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                id={mk(`devolucion-rechazada-motivo-${entry.id}`)}
                                name={`${fn("DevolucionRechazadaMotivo")}_${entryIndex + 1}`}
                                variant="outline"
                                role="combobox"
                                aria-expanded={isMotivoComboOpen && !motivoDisabled}
                                disabled={motivoDisabled}
                                className={cn(
                                  "h-9 w-full justify-between gap-2 rounded-md border border-rose-200/80 bg-white px-3 font-normal shadow-sm hover:bg-white data-[state=open]:bg-white dark:bg-white dark:text-slate-900 dark:hover:bg-white dark:data-[state=open]:bg-white",
                                  motivoDisabled && "cursor-not-allowed opacity-60",
                                )}
                              >
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-left text-sm",
                                    (motivoDisabled || !entry.motivo.trim()) && "text-muted-foreground",
                                  )}
                                >
                                  {rejectedMotivoLabel(entry)}
                                </span>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandList className="max-h-60">
                                  <CommandGroup>
                                    <CommandItem
                                      value="limpiar motivo devolucion"
                                      onSelect={() => {
                                        warehouseReturn.onRejectedEntryChange(entry.id, { motivo: "" })
                                        setOpenRejectedCombo(null)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          !entry.motivo.trim() ? "opacity-100" : "opacity-0",
                                        )}
                                        aria-hidden
                                      />
                                      <span className="text-muted-foreground">— (sin motivo)</span>
                                    </CommandItem>
                                    {PRINTING_REJECT_REASONS.map((r) => (
                                      <CommandItem
                                        key={r.id}
                                        value={`${r.id} ${r.label}`}
                                        onSelect={() => {
                                          warehouseReturn.onRejectedEntryChange(entry.id, { motivo: r.id })
                                          setOpenRejectedCombo(null)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            r.id === entry.motivo.trim() ? "opacity-100" : "opacity-0",
                                          )}
                                          aria-hidden
                                        />
                                        {r.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label
                              htmlFor={mk(`warehouse-proveedor-rechazada-${entry.id}`)}
                              className="text-xs font-medium text-rose-900/90 dark:text-rose-200/90"
                            >
                              Proveedor
                            </Label>
                            <span className="text-[10px] text-muted-foreground">Opcional</span>
                          </div>
                          <Popover
                            open={isProveedorComboOpen}
                            onOpenChange={(o) => {
                              setOpenRejectedCombo(o ? { entryId: entry.id, field: "proveedor" } : null)
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                id={mk(`warehouse-proveedor-rechazada-${entry.id}`)}
                                name={`${fn("WarehouseProveedorRechazada")}_${entryIndex + 1}`}
                                variant="outline"
                                role="combobox"
                                aria-expanded={isProveedorComboOpen}
                                disabled={inputDisabled || warehouseReturn.loadingSuppliers}
                                className="h-9 w-full justify-between gap-2 rounded-md border border-rose-200/80 bg-white px-3 font-normal shadow-sm hover:bg-white data-[state=open]:bg-white dark:bg-white dark:text-slate-900 dark:hover:bg-white dark:data-[state=open]:bg-white"
                              >
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-left text-sm",
                                    !entry.proveedorId && "text-muted-foreground",
                                  )}
                                >
                                  {rejectedSupplierLabel(entry)}
                                </span>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
                              align="start"
                            >
                              <Command shouldFilter>
                                <CommandInput placeholder="Buscar proveedor…" />
                                <CommandList className="max-h-60">
                                  <CommandEmpty>Sin coincidencias.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="limpiar proveedor rechazada"
                                      className="data-[selected=true]:bg-rose-100 data-[selected=true]:text-rose-950"
                                      onSelect={() => {
                                        const keepMaterial =
                                          !entry.materialId ||
                                          !entry.proveedorId ||
                                          entryMaterials.some((m) => String(m.id) === entry.materialId)
                                        warehouseReturn.onRejectedEntryChange(entry.id, {
                                          proveedorId: "",
                                          materialId: keepMaterial ? entry.materialId : "",
                                        })
                                        setOpenRejectedCombo(null)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          !entry.proveedorId ? "opacity-100" : "opacity-0",
                                        )}
                                        aria-hidden
                                      />
                                      <span className="text-muted-foreground">— (sin proveedor)</span>
                                    </CommandItem>
                                    {warehouseReturn.supplierOptions.map((s) => (
                                      <CommandItem
                                        key={s.id}
                                        value={`${s.id} ${s.name}`}
                                        className="data-[selected=true]:bg-rose-100 data-[selected=true]:text-rose-950"
                                        onSelect={() => {
                                          const nextMaterials = warehouseReturn.materialOptionsBad.filter(
                                            (m) =>
                                              m.supplier_id != null && String(m.supplier_id) === String(s.id),
                                          )
                                          const keepMaterial =
                                            !entry.materialId ||
                                            nextMaterials.some((m) => String(m.id) === entry.materialId)
                                          warehouseReturn.onRejectedEntryChange(entry.id, {
                                            proveedorId: String(s.id),
                                            materialId: keepMaterial ? entry.materialId : "",
                                          })
                                          setOpenRejectedCombo(null)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            String(s.id) === entry.proveedorId ? "opacity-100" : "opacity-0",
                                          )}
                                          aria-hidden
                                        />
                                        <span className="min-w-0 truncate">{s.name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label
                              htmlFor={mk(`warehouse-material-rechazada-${entry.id}`)}
                              className="text-xs font-medium text-rose-900/90 dark:text-rose-200/90"
                            >
                              Material (rechazadas)
                            </Label>
                            <span className="text-[10px] text-muted-foreground">Opcional</span>
                          </div>
                          <Popover
                            open={isMaterialComboOpen}
                            onOpenChange={(o) => {
                              setOpenRejectedCombo(o ? { entryId: entry.id, field: "material" } : null)
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                id={mk(`warehouse-material-rechazada-${entry.id}`)}
                                name={`${fn("WarehouseMaterialRechazada")}_${entryIndex + 1}`}
                                variant="outline"
                                role="combobox"
                                aria-expanded={isMaterialComboOpen}
                                disabled={inputDisabled || warehouseReturn.loadingBad}
                                className="h-9 w-full justify-between gap-2 rounded-md border border-rose-200/80 bg-white px-3 font-normal shadow-sm hover:bg-white data-[state=open]:bg-white dark:bg-white dark:text-slate-900 dark:hover:bg-white dark:data-[state=open]:bg-white"
                              >
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-left text-sm",
                                    !entry.materialId && "text-muted-foreground",
                                  )}
                                >
                                  {rejectedMaterialLabel(entry)}
                                </span>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
                              align="start"
                            >
                              <Command shouldFilter>
                                <CommandInput placeholder="Buscar por SKU o nombre…" />
                                <CommandList className="max-h-60">
                                  <CommandEmpty>Sin coincidencias.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="limpiar material rechazada"
                                      className="data-[selected=true]:bg-rose-100 data-[selected=true]:text-rose-950"
                                      onSelect={() => {
                                        warehouseReturn.onRejectedEntryChange(entry.id, { materialId: "" })
                                        setOpenRejectedCombo(null)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          !entry.materialId ? "opacity-100" : "opacity-0",
                                        )}
                                        aria-hidden
                                      />
                                      <span className="text-muted-foreground">— (sin material)</span>
                                    </CommandItem>
                                    {entryMaterials.map((m) => (
                                      <CommandItem
                                        key={m.id}
                                        value={`${m.id} ${m.sku} ${m.name}`}
                                        className="data-[selected=true]:bg-rose-100 data-[selected=true]:text-rose-950"
                                        onSelect={() => {
                                          warehouseReturn.onRejectedEntryChange(entry.id, {
                                            materialId: String(m.id),
                                          })
                                          setOpenRejectedCombo(null)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            String(m.id) === entry.materialId ? "opacity-100" : "opacity-0",
                                          )}
                                          aria-hidden
                                        />
                                        <span className="min-w-0 truncate">
                                          {m.sku} · {m.name}
                                        </span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor={mk(`warehouse-rechazada-obs-${entry.id}`)}
                            className="text-xs font-medium text-rose-900/90 dark:text-rose-200/90"
                          >
                            Observación (opcional)
                          </Label>
                          <Textarea
                            id={mk(`warehouse-rechazada-obs-${entry.id}`)}
                            name={`${fn("WarehouseRechazadaObs")}_${entryIndex + 1}`}
                            className="min-h-[4.5rem] bg-white text-sm dark:bg-white dark:text-slate-900"
                            value={entry.obs}
                            onChange={(e) =>
                              warehouseReturn.onRejectedEntryChange(entry.id, { obs: e.target.value })
                            }
                            placeholder="Detalle adicional (si aplica)"
                            disabled={inputDisabled}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {rechBobinas > 0 ? (
                    <p className="text-muted-foreground text-[11px] font-medium">
                      Total rechazadas en este envío: {rechBobinas} bobina{rechBobinas === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-[11px] leading-snug sm:max-w-[55%]">
                Complete cantidades en cada columna. En rechazadas: motivo obligatorio; proveedor y material opcionales.
                Pulse <span className="font-medium text-foreground">Enviar a almacén</span> para registrar la
                solicitud.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-36"
                  onClick={() => warehouseReturn.onOpenChange(false)}
                  disabled={warehouseReturn.submitting}
                >
                  Cerrar panel
                </Button>
                <Button
                  type="button"
                  className="sm:min-w-48"
                  onClick={() => void warehouseReturn.onSubmit()}
                  disabled={inputDisabled || warehouseReturn.submitting}
                >
                  {warehouseReturn.submitting ? "Enviando…" : "Enviar a almacén"}
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </MesSectionShell>
  )
}
