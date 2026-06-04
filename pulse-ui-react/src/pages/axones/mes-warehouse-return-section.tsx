import { useId, useMemo, useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsUpDown,
  FileSearch,
  NotebookPen,
  PackageCheck,
  PackageX,
  Plus,
  Trash2,
  Undo2,
  UserRound,
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
  sumRejectedEntryKg,
  type WarehouseRejectedEntry,
  type WarehouseReturnDraft,
} from "./printing-turnos"
import {
  materialSpecificationsLabel,
  rejectReasonLabel,
  todayIsoDate,
} from "./warehouse-return-helpers"

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
  /** Operador por defecto en líneas de devolución mala. */
  operadorDefault?: string
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

function isRejectedMotivoComboOpen(
  open: { entryId: string } | null,
  entryId: string,
): boolean {
  return open?.entryId === entryId
}

function num(v: string): number {
  const raw = String(v ?? "").trim().replace(",", ".")
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function MesWarehouseReturnSection(props: MesWarehouseReturnSectionProps) {
  const { inputDisabled, fieldPrefix, areaFlowLabel, warehouseReturn } = props
  const [openRejectedCombo, setOpenRejectedCombo] = useState<{ entryId: string } | null>(null)
  const [buenaComboOpen, setBuenaComboOpen] = useState(false)

  const formFieldId = useId().replace(/:/g, "")
  const mk = (suffix: string) => `${formFieldId}-${suffix}`
  const fn = (suffix: string) => `${fieldPrefix}${suffix}`

  const rechKgFromEntries = sumRejectedEntryKg(warehouseReturn.draft.rechazadaEntries)
  const rechKg = rechKgFromEntries
  const operadorDefault = props.operadorDefault?.trim() ?? ""

  const buenaMaterialSelected = useMemo(
    () =>
      warehouseReturn.materialOptionsGood.find(
        (m) => String(m.id) === warehouseReturn.draft.buenaMaterialId,
      ),
    [warehouseReturn.draft.buenaMaterialId, warehouseReturn.materialOptionsGood],
  )

  function rejectedMotivoLabel(entry: WarehouseRejectedEntry): string {
    const kg = num(entry.kg)
    if (inputDisabled || kg <= 0) return "— (indique kilos rechazados primero)"
    const id = entry.motivo.trim()
    if (!id) return "Seleccione motivo (obligatorio)"
    return rejectReasonLabel(id)
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
        Estas devoluciones llegan a <span className="font-medium text-foreground">Inventario → Devoluciones</span>{" "}
        para aceptación. Las <span className="font-medium text-foreground">buenas</span> entran al inventario y las{" "}
        <span className="font-medium text-foreground">malas</span> van a bobinas rechazadas; además alimentan el
        reporte.
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
                <span className="min-w-0 truncate">Registrar envío a almacén</span>
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

            <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
              <div className="flex h-full flex-col rounded-2xl border border-emerald-300/60 bg-gradient-to-b from-emerald-50/90 via-emerald-50/50 to-background p-5 shadow-sm dark:border-emerald-800/50 dark:from-emerald-950/40 dark:via-emerald-950/20">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-emerald-200/70 pb-3 dark:border-emerald-800/40">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Devolución buena
                    </span>
                    <p className="text-[11px] leading-snug text-emerald-900/70 dark:text-emerald-200/80">
                      Material que regresa a inventario.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/60 bg-emerald-600 text-[10px] text-white shadow-sm hover:bg-emerald-600"
                  >
                    Reingreso inventario
                  </Badge>
                </div>
                <div className="grid flex-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label
                      htmlFor={mk("warehouse-material-buena")}
                      className="text-xs font-medium text-emerald-900/90 dark:text-emerald-200/90"
                    >
                      Material
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
                          className="h-9 w-full justify-between gap-2 rounded-md border border-emerald-200/80 bg-white px-3 font-normal shadow-sm transition-colors hover:border-emerald-300 dark:bg-white dark:text-slate-900"
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
                                    warehouseReturn.onDraftChange({
                                      buenaMaterialId: String(m.id),
                                      buenaEspecificaciones: materialSpecificationsLabel(m),
                                    })
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
                  <div className="space-y-1.5">
                    {fieldLabel(mk("devolucion-buena-especificaciones"), FileSearch, "Especificaciones")}
                    <Input
                      id={mk("devolucion-buena-especificaciones")}
                      name={fn("DevolucionBuenaEspecificaciones")}
                      className="ot-input-unified h-9 border-emerald-200/80 bg-white dark:bg-white dark:text-slate-900"
                      value={warehouseReturn.draft.buenaEspecificaciones}
                      onChange={(e) =>
                        warehouseReturn.onDraftChange({ buenaEspecificaciones: e.target.value })
                      }
                      placeholder="Micras, ancho, proveedor…"
                      disabled={inputDisabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {fieldLabel(mk("devolucion-buena-kg"), PackageCheck, "Kilos total")}
                    <Input
                      id={mk("devolucion-buena-kg")}
                      name={fn("DevolucionBuenaKg")}
                      className="ot-input-unified h-9 border-emerald-200/80 bg-white dark:bg-white dark:text-slate-900"
                      inputMode="decimal"
                      value={props.devolucionBuenaRaw}
                      onChange={(e) => props.onSetDevolucionBuena(e.target.value)}
                      placeholder="0"
                      disabled={inputDisabled}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    {fieldLabel(mk("devolucion-buena-motivo"), NotebookPen, "Motivo")}
                    <Textarea
                      id={mk("devolucion-buena-motivo")}
                      name={fn("DevolucionBuenaMotivo")}
                      className="min-h-[5rem] border-emerald-200/80 bg-white dark:bg-white dark:text-slate-900"
                      value={warehouseReturn.draft.buenaMotivo}
                      onChange={(e) => warehouseReturn.onDraftChange({ buenaMotivo: e.target.value })}
                      placeholder="Motivo de la devolución buena"
                      disabled={inputDisabled}
                    />
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col rounded-2xl border border-rose-300/60 bg-gradient-to-b from-rose-50/90 via-rose-50/45 to-background p-5 shadow-sm dark:border-rose-800/50 dark:from-rose-950/40 dark:via-rose-950/20">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-rose-200/70 pb-3 dark:border-rose-800/40">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-rose-900 dark:text-rose-200">Devolución mala</span>
                    <p className="text-[11px] leading-snug text-rose-900/70 dark:text-rose-200/80">
                      Registre cada bobina rechazada en una línea.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive" className="text-[10px]">
                      Bobinas rechazadas
                    </Badge>
                    {!inputDisabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 border-rose-300/80 bg-white text-xs text-rose-900 shadow-sm hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
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
                    const entryKg = num(entry.kg)
                    const motivoDisabled = inputDisabled || entryKg <= 0
                    const isMotivoComboOpen = isRejectedMotivoComboOpen(openRejectedCombo, entry.id)
                    const canRemove = warehouseReturn.draft.rechazadaEntries.length > 1

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "space-y-3 rounded-xl border border-rose-200/75 bg-white/80 p-3.5 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20",
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

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            {fieldLabel(
                              mk(`devolucion-rechazada-fecha-bobina-${entry.id}`),
                              CalendarDays,
                              "Fecha de la bobina",
                            )}
                            <Input
                              id={mk(`devolucion-rechazada-fecha-bobina-${entry.id}`)}
                              name={`${fn("DevolucionRechazadaFechaBobina")}_${entryIndex + 1}`}
                              type="date"
                              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                              value={entry.fechaBobina}
                              onChange={(e) =>
                                warehouseReturn.onRejectedEntryChange(entry.id, {
                                  fechaBobina: e.target.value,
                                })
                              }
                              disabled={inputDisabled}
                            />
                          </div>
                          <div className="space-y-1">
                            {fieldLabel(
                              mk(`devolucion-rechazada-creada-${entry.id}`),
                              CalendarDays,
                              "Creada",
                            )}
                            <Input
                              id={mk(`devolucion-rechazada-creada-${entry.id}`)}
                              name={`${fn("DevolucionRechazadaCreada")}_${entryIndex + 1}`}
                              type="date"
                              className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                              value={entry.creadaFecha || todayIsoDate()}
                              onChange={(e) =>
                                warehouseReturn.onRejectedEntryChange(entry.id, {
                                  creadaFecha: e.target.value,
                                })
                              }
                              disabled={inputDisabled}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          {fieldLabel(mk(`devolucion-rechazada-kg-${entry.id}`), Weight, "Kilos")}
                          <Input
                            id={mk(`devolucion-rechazada-kg-${entry.id}`)}
                            name={`${fn("DevolucionRechazadaKg")}_${entryIndex + 1}`}
                            className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                            inputMode="decimal"
                            value={entry.kg}
                            onChange={(e) => {
                              const raw = String(e.target.value ?? "").trim().replace(",", ".")
                              const n = raw === "" ? 0 : Number(raw)
                              const rechZero = !Number.isFinite(n) || n <= 0
                              warehouseReturn.onRejectedEntryChange(entry.id, {
                                kg: e.target.value,
                                motivo: rechZero ? "" : entry.motivo,
                              })
                            }}
                            placeholder="0"
                            disabled={inputDisabled}
                          />
                        </div>

                        <div className="space-y-1">
                          {fieldLabel(
                            mk(`devolucion-rechazada-operador-${entry.id}`),
                            UserRound,
                            "Operador",
                          )}
                          <Input
                            id={mk(`devolucion-rechazada-operador-${entry.id}`)}
                            name={`${fn("DevolucionRechazadaOperador")}_${entryIndex + 1}`}
                            className="ot-input-unified h-9 bg-white dark:bg-white dark:text-slate-900"
                            value={entry.operador}
                            onChange={(e) =>
                              warehouseReturn.onRejectedEntryChange(entry.id, { operador: e.target.value })
                            }
                            placeholder={operadorDefault || "Operador"}
                            disabled={inputDisabled}
                          />
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
                                setOpenRejectedCombo(o ? { entryId: entry.id } : null)
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
                          <Input
                            id={mk(`warehouse-proveedor-rechazada-${entry.id}`)}
                            name={`${fn("WarehouseProveedorRechazada")}_${entryIndex + 1}`}
                            className="ot-input-unified h-9 border-rose-200/80 bg-white dark:bg-white dark:text-slate-900"
                            value={entry.proveedorId}
                            onChange={(e) =>
                              warehouseReturn.onRejectedEntryChange(entry.id, {
                                proveedorId: e.target.value,
                              })
                            }
                            list={mk(`warehouse-proveedor-rechazada-options-${entry.id}`)}
                            placeholder={
                              warehouseReturn.loadingSuppliers
                                ? "Cargando proveedores…"
                                : "— (opcional)"
                            }
                            disabled={inputDisabled}
                          />
                          <datalist id={mk(`warehouse-proveedor-rechazada-options-${entry.id}`)}>
                            {warehouseReturn.supplierOptions.map((s) => (
                              <option key={s.id} value={s.name} />
                            ))}
                          </datalist>
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
                          <Input
                            id={mk(`warehouse-material-rechazada-${entry.id}`)}
                            name={`${fn("WarehouseMaterialRechazada")}_${entryIndex + 1}`}
                            className="ot-input-unified h-9 border-rose-200/80 bg-white dark:bg-white dark:text-slate-900"
                            value={entry.materialId}
                            onChange={(e) =>
                              warehouseReturn.onRejectedEntryChange(entry.id, {
                                materialId: e.target.value,
                              })
                            }
                            list={mk(`warehouse-material-rechazada-options-${entry.id}`)}
                            placeholder={
                              warehouseReturn.loadingBad ? "Cargando materiales…" : "— (opcional)"
                            }
                            disabled={inputDisabled}
                          />
                          <datalist id={mk(`warehouse-material-rechazada-options-${entry.id}`)}>
                            {warehouseReturn.materialOptionsBad.map((m) => (
                              <option key={m.id} value={`${m.sku} · ${m.name}`} />
                            ))}
                          </datalist>
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
                  {rechKg > 0 ? (
                    <p className="text-muted-foreground text-[11px] font-medium">
                      Total devolución mala en este envío: {rechKg.toFixed(2)} Kg
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-[11px] leading-snug sm:max-w-[55%]">
                En rechazadas: motivo obligatorio; proveedor y material opcionales. Pulse{" "}
                <span className="font-medium text-foreground">Enviar a almacén</span> para registrar la solicitud.
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
