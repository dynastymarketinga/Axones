"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  Hash,
  Info,
  Loader2,
  MapPin,
  Save,
  ShoppingCart,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { translateApiValidationMessage } from "@/lib/api-validation-es"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, SupplierRecord } from "@/types/api"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import {
  PurchaseOrderLinesEditor,
  type PoLineFieldErrors,
} from "@/components/axones/PurchaseOrderLinesEditor"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatDateInputDisplay,
  parseDateInputValue,
  poFieldIconClass,
  purchaseOrderStatusLabel,
  toDateInputValue,
  toDateTimeLocalInputValue,
} from "@/pages/axones/purchase-order-shared"
import {
  apiLineToDraft,
  buildLinesPayload,
  emptyLine,
  isPoLineSubmitReady,
  isPoLineUnit,
  lineHasAnyValue,
  parseDecimalInput,
  type PoLineEditDraft,
  serializeLinesSnapshot,
} from "@/pages/axones/purchase-order-line-draft"
import "./purchase-order-list.css"

type PurchaseOrderEditDetail = {
  id: number
  code: string
  status: string
  supplier_id: number
  ordered_at: string | null
  created_at?: string | null
  notes: string | null
  manually_closed_at?: string | null
  supplier?: { id: number; name: string; rif?: string | null; address?: string | null } | null
  lines?: Array<{
    id: number
    description?: string | null
    quantity_ordered: string | number
    quantity_received?: string | number
    unit?: string | null
    material_id?: number | null
    material?: { name?: string | null } | null
  }>
}

type EditBaseline = {
  supplierId: string
  registeredAt: string
  notes: string
  orderedAt: string
  linesSnapshot: string
}

function validateLines(lines: PoLineEditDraft[]): {
  ok: boolean
  lineErrors: Record<number, PoLineFieldErrors>
  general?: string
} {
  const lineErrors: Record<number, PoLineFieldErrors> = {}
  const editedIndexes = lines
    .map((line, idx) => (lineHasAnyValue(line) ? idx : -1))
    .filter((idx) => idx >= 0)

  if (editedIndexes.length === 0) {
    return {
      ok: false,
      lineErrors,
      general: "Agregue al menos una línea con material y cantidad ≥ 0,001.",
    }
  }

  for (const i of editedIndexes) {
    const line = lines[i]
    const errs: PoLineFieldErrors = {}
    if (!line.description.trim()) {
      errs.description = "Escriba el material solicitado."
    }
    const qty = parseDecimalInput(line.quantity_ordered)
    const minQty = Math.max(0.001, line.quantity_received ?? 0)
    if (!Number.isFinite(qty) || qty < minQty) {
      errs.quantity =
        (line.quantity_received ?? 0) > 0
          ? `La cantidad no puede ser menor a lo recibido (${line.quantity_received}).`
          : "Indique cantidad ≥ 0,001."
    }
    const unitTrim = line.unit.trim() || "kg"
    if (!isPoLineUnit(unitTrim)) {
      errs.unit = "Unidad no válida."
    }
    if (Object.keys(errs).length) lineErrors[i] = errs
  }

  const readyCount = lines.filter(isPoLineSubmitReady).length
  if (readyCount === 0) {
    return {
      ok: false,
      lineErrors,
      general: "Complete al menos una línea válida antes de guardar.",
    }
  }

  return { ok: Object.keys(lineErrors).length === 0, lineErrors }
}

export default function PurchaseOrderEditPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const id = Number(routeId ?? "")
  const navigate = useNavigate()
  const location = useLocation()
  const listFrom =
    (location.state as { from?: string } | null)?.from ?? "/ordenes-compra"
  const editPath = `/ordenes-compra/${id}/editar`

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<PurchaseOrderEditDetail | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [supplierId, setSupplierId] = useState("")
  const [registeredAt, setRegisteredAt] = useState("")
  const [notes, setNotes] = useState("")
  const [orderedAt, setOrderedAt] = useState("")
  const [orderedAtOpen, setOrderedAtOpen] = useState(false)
  const [changeReason, setChangeReason] = useState("")
  const [lines, setLines] = useState<PoLineEditDraft[]>([emptyLine()])
  const [lineErrors, setLineErrors] = useState<Record<number, PoLineFieldErrors>>({})
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<EditBaseline | null>(null)

  const selectedSupplier = useMemo(
    () => suppliers.find((x) => String(x.id) === supplierId) ?? null,
    [suppliers, supplierId],
  )

  const supplierTriggerDisplay = useMemo(() => {
    if (!supplierId.trim()) return { text: "Seleccione…", muted: true }
    if (selectedSupplier) {
      const name = selectedSupplier.name?.trim() || "Sin nombre"
      return {
        text: `${name}${selectedSupplier.rif ? ` · ${selectedSupplier.rif}` : ""}`,
        muted: false,
      }
    }
    const fallbackName = detail?.supplier?.name?.trim()
    if (fallbackName) {
      return {
        text: `${fallbackName}${detail?.supplier?.rif ? ` · ${detail.supplier.rif}` : ""}`,
        muted: false,
      }
    }
    return { text: `#${supplierId}`, muted: false }
  }, [supplierId, selectedSupplier, detail?.supplier])

  const supplierAddress = useMemo(() => {
    const fromList = selectedSupplier?.address?.trim()
    if (fromList) return fromList
    return detail?.supplier?.address?.trim() ?? ""
  }, [selectedSupplier, detail?.supplier?.address])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
          query: { per_page: 200, page: 1 },
        })
        if (!cancelled) setSuppliers(res.data)
      } catch {
        if (!cancelled) setSuppliers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await apiFetch<PurchaseOrderEditDetail>(`purchase-orders/${id}`)
        if (cancelled) return
        setDetail(data)
        const sid = String(data.supplier_id)
        const reg = toDateTimeLocalInputValue(data.created_at)
        const notesVal = (data.notes ?? "").trim()
        const ord = toDateInputValue(data.ordered_at)
        const mappedLines =
          data.lines?.length && data.lines.length > 0
            ? data.lines.map((ln) => apiLineToDraft(ln))
            : [emptyLine()]
        setSupplierId(sid)
        setRegisteredAt(reg)
        setNotes(data.notes ?? "")
        setOrderedAt(ord)
        setLines(mappedLines)
        baselineRef.current = {
          supplierId: sid,
          registeredAt: reg,
          notes: notesVal,
          orderedAt: ord,
          linesSnapshot: serializeLinesSnapshot(mappedLines),
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof ApiError ? e.message : "No se pudo cargar la orden.")
          setDetail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const submit = useCallback(async () => {
    if (!detail) return
    const base = baselineRef.current
    if (!base) {
      toast.error("Espere a que termine de cargar el formulario.")
      return
    }

    const sid = Number(supplierId)
    if (!Number.isFinite(sid) || sid < 1) {
      toast.error("Seleccione un proveedor.")
      return
    }

    const registeredTrim = registeredAt.trim()
    const notesTrim = notes.trim()
    const orderedTrim = orderedAt.trim()
    const linesSnapshot = serializeLinesSnapshot(lines)
    const changed =
      supplierId !== base.supplierId ||
      registeredTrim !== base.registeredAt ||
      notesTrim !== base.notes ||
      orderedTrim !== base.orderedAt ||
      linesSnapshot !== base.linesSnapshot

    if (!changed) {
      toast.message("Sin cambios.")
      navigate(listFrom)
      return
    }

    const reason = changeReason.trim()
    if (reason.length < 5) {
      toast.error("Indique el motivo del cambio (mínimo 5 caracteres).")
      return
    }

    const lineValidation = validateLines(lines)
    if (!lineValidation.ok) {
      setLineErrors(lineValidation.lineErrors)
      toast.error(lineValidation.general ?? "Revise las líneas del pedido.")
      return
    }
    setLineErrors({})

    const payloadLines = buildLinesPayload(lines)
    if (payloadLines.length === 0) {
      toast.error("Agregue al menos una línea válida.")
      return
    }

    setSaving(true)
    try {
      await apiFetch(`purchase-orders/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          supplier_id: sid,
          created_at: registeredTrim === "" ? undefined : registeredTrim,
          notes: notesTrim === "" ? null : notesTrim,
          ordered_at: orderedTrim === "" ? null : orderedTrim,
          change_reason: reason,
          lines: payloadLines,
        }),
      })
      toast.success("Orden actualizada.")
      navigate(listFrom)
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.body?.errors) {
        const errs = e.body.errors as Record<string, string[] | string>
        const flat = Object.values(errs)
          .flat()
          .map((s) => translateApiValidationMessage(String(s).trim()))
          .filter(Boolean)
        toast.error(flat.length ? flat.join("\n") : translateApiValidationMessage(e.message))
      } else {
        toast.error(e instanceof ApiError ? e.message : "No se pudo guardar el cambio.")
      }
    } finally {
      setSaving(false)
    }
  }, [detail, supplierId, registeredAt, notes, orderedAt, changeReason, lines, navigate, listFrom])

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-muted-foreground">Identificador de orden no válido.</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/ordenes-compra">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
              <ShoppingCart className="size-7 shrink-0 text-primary" aria-hidden />
              Editar orden de compra
            </h1>
            <Alert className="border-primary/40 bg-gradient-to-r from-primary/12 via-primary/8 to-primary/5 shadow-sm">
              <Info className="h-5 w-5 text-primary" aria-hidden />
              <AlertTitle className="text-base font-semibold text-foreground">
                ¿Qué puede modificar en esta pantalla?
              </AlertTitle>
              <AlertDescription className="space-y-2 text-sm leading-relaxed text-foreground/90">
                <p>
                  <strong>Proveedor, fechas, notas y artículos del pedido.</strong> Cualquier cambio
                  requiere <strong>motivo registrado en auditoría</strong> (mínimo 5 caracteres).
                </p>
                <p>
                  Las líneas con material recibido <strong>no se pueden eliminar</strong> y su
                  cantidad no puede quedar por debajo de lo ya recibido.
                </p>
              </AlertDescription>
            </Alert>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="shrink-0 shadow-sm" asChild>
                <Link to={listFrom} aria-label="Volver al listado de órdenes de compra">
                  <ArrowLeft aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[16rem] text-left">
              Vuelve al listado de órdenes de compra.
            </TooltipContent>
          </Tooltip>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="size-7 animate-spin" aria-hidden />
            <span>Cargando orden…</span>
          </div>
        ) : !detail ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">No se encontró la orden solicitada.</p>
            <Button type="button" variant="outline" asChild>
              <Link to={listFrom}>Volver al listado</Link>
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault()
              void submit()
            }}
            className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-3">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Documento de compra</p>
                <Badge
                  variant="outline"
                  className="mt-1 rounded-md border-primary/35 bg-primary/5 px-2.5 py-1 text-sm font-semibold text-primary shadow-sm"
                >
                  <ClipboardList className="mr-1.5 size-3.5" aria-hidden />
                  Orden de compra · {purchaseOrderStatusLabel(detail.status)}
                </Badge>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-muted-foreground text-xs">Código del pedido</p>
                <h2 className="text-primary text-3xl font-bold tracking-tight">{detail.code}</h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="po-edit-supplier">Proveedor *</Label>
                <div className="flex items-center gap-2">
                  <div className="group/field relative min-w-0 flex-1">
                    <Building2
                      className={cn(poFieldIconClass(false, saving), "top-1/2 -translate-y-1/2")}
                      aria-hidden
                    />
                    <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="po-edit-supplier"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={supplierOpen}
                          disabled={saving}
                          className={cn(
                            "h-10 w-full justify-between pl-10 pr-3 font-normal",
                            "border-primary/25 bg-background/90",
                          )}
                        >
                          <span
                            className={cn(
                              "truncate text-left",
                              supplierTriggerDisplay.muted && "text-muted-foreground",
                            )}
                          >
                            {supplierTriggerDisplay.text}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
                        align="start"
                      >
                        <Command shouldFilter>
                          <CommandInput placeholder="Buscar proveedor..." />
                          <CommandList className="max-h-60">
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup>
                              {suppliers.map((s) => (
                                <CommandItem
                                  key={s.id}
                                  value={`${s.name} ${s.rif ?? ""}`}
                                  onSelect={() => {
                                    setSupplierId(String(s.id))
                                    setSupplierOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      String(s.id) === supplierId ? "opacity-100" : "opacity-0",
                                    )}
                                    aria-hidden
                                  />
                                  <span className="truncate">{s.name}</span>
                                  {s.rif ? (
                                    <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                                      {s.rif}
                                    </span>
                                  ) : null}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 shadow-sm"
                        disabled={saving}
                        aria-label="Crear proveedor nuevo"
                        asChild
                      >
                        <Link
                          to="/proveedores/form"
                          state={{ from: editPath }}
                        >
                          <UserPlus aria-hidden />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Crear proveedor nuevo</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="grid min-w-0 gap-2">
                <Label htmlFor="po-edit-code" className="inline-flex w-fit items-center gap-1.5">
                  <Hash className="size-3.5 text-primary" aria-hidden />
                  Código único
                </Label>
                <div className="group/field relative">
                  <Hash
                    className={cn(poFieldIconClass(false, saving), "top-1/2 -translate-y-1/2")}
                    aria-hidden
                  />
                  <Input
                    id="po-edit-code"
                    value={detail.code}
                    readOnly
                    disabled={saving}
                    className="cursor-default bg-muted/40 pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <div className="grid gap-2">
                <Label htmlFor="po-edit-date" className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-primary" aria-hidden />
                  Fecha pedido
                </Label>
                <Popover open={orderedAtOpen} onOpenChange={setOrderedAtOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="po-edit-date"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={orderedAtOpen}
                      disabled={saving}
                      className={cn(
                        "group/field h-9 w-full justify-between pl-3 pr-3 font-normal",
                        "border-primary/25 bg-background/90 shadow-sm",
                        !orderedAt && "text-muted-foreground",
                      )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <CalendarIcon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            saving
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground group-focus-visible:text-primary",
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{formatDateInputDisplay(orderedAt)}</span>
                      </span>
                      <ChevronDown className="ml-1 size-4 shrink-0 opacity-50" aria-hidden />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <UiCalendar
                      mode="single"
                      selected={parseDateInputValue(orderedAt)}
                      defaultMonth={parseDateInputValue(orderedAt) ?? new Date()}
                      onSelect={(date) => {
                        if (!date) return
                        const y = date.getFullYear()
                        const m = String(date.getMonth() + 1).padStart(2, "0")
                        const day = String(date.getDate()).padStart(2, "0")
                        setOrderedAt(`${y}-${m}-${day}`)
                        setOrderedAtOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid min-w-0 gap-2">
                <Label htmlFor="po-edit-notes" className="inline-flex items-center gap-1.5">
                  <FileText className="size-3.5 text-primary" aria-hidden />
                  Notas / observación
                </Label>
                <div className="group/field relative">
                  <FileText
                    className={cn(poFieldIconClass(false, saving), "top-1/2 -translate-y-1/2")}
                    aria-hidden
                  />
                  <Input
                    id="po-edit-notes"
                    value={notes}
                    disabled={saving}
                    onChange={(ev) => setNotes(ev.target.value)}
                    placeholder="Ej: Entrega 15 días · FOB Caracas · Ref. cotización #4521"
                    className="h-9 pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <div className="grid gap-2">
                <Label htmlFor="po-edit-registered" className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-primary" aria-hidden />
                  Registrada
                </Label>
                <div className="group/field relative">
                  <CalendarIcon
                    className={cn(poFieldIconClass(false, saving), "top-1/2 -translate-y-1/2")}
                    aria-hidden
                  />
                  <Input
                    id="po-edit-registered"
                    type="datetime-local"
                    value={registeredAt}
                    disabled={saving}
                    onChange={(ev) => setRegisteredAt(ev.target.value)}
                    className="h-9 pl-10"
                  />
                </div>
              </div>

              <div className="grid min-w-0 gap-2">
                <Label htmlFor="po-edit-reason" className="inline-flex items-center gap-1.5">
                  <FileText className="size-3.5 text-primary" aria-hidden />
                  Motivo del cambio *
                </Label>
                <div className="group/field relative">
                  <FileText
                    className={cn(poFieldIconClass(false, saving), "top-1/2 -translate-y-1/2")}
                    aria-hidden
                  />
                  <Input
                    id="po-edit-reason"
                    value={changeReason}
                    disabled={saving}
                    onChange={(ev) => setChangeReason(ev.target.value)}
                    placeholder="Obligatorio al guardar. Mínimo 5 caracteres."
                    className="h-9 pl-10"
                  />
                </div>
              </div>
            </div>

            {supplierId && (selectedSupplier || detail.supplier) ? (
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-muted/30 p-4 text-sm shadow-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden />
                  Dirección del proveedor
                </p>
                <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                  {supplierAddress || "Sin dirección registrada en el proveedor."}
                </p>
                {!supplierAddress ? (
                  <Link
                    to={`/proveedores/form?id=${supplierId}`}
                    state={{ from: editPath }}
                    className="text-primary mt-2 inline-block text-xs underline underline-offset-4"
                  >
                    Registrar dirección del proveedor
                  </Link>
                ) : null}
              </div>
            ) : null}

            <PurchaseOrderLinesEditor
              lines={lines}
              onLinesChange={setLines}
              saving={saving}
              lineErrors={lineErrors}
              returnPath={editPath}
              supplierId={Number(supplierId) || detail.supplier_id}
            />

            <div className="flex w-full justify-center pt-1">
              <Button type="submit" disabled={saving} className="min-w-[12rem] shadow-md">
                <Save aria-hidden />
                <LoadingButtonLabel
                  loading={saving}
                  loadingText="Guardando…"
                  idleText="Guardar cambios"
                />
              </Button>
            </div>
          </form>
        )}
      </div>
    </TooltipProvider>
  )
}
