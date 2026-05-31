"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  ClipboardList,
  FileText,
  Hash,
  Info,
  Loader2,
  Save,
  ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { translateApiValidationMessage } from "@/lib/api-validation-es"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import {
  PurchaseOrderLinesEditor,
  type PoLineFieldErrors,
} from "@/components/axones/PurchaseOrderLinesEditor"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  formatDateTime,
  PurchaseOrderStatusBadge,
  toDateInputValue,
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
  tax_applies?: boolean
  manually_closed_at?: string | null
  supplier?: { id: number; name: string } | null
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
  notes: string
  orderedAt: string
  taxApplies: boolean
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
  const [notes, setNotes] = useState("")
  const [orderedAt, setOrderedAt] = useState("")
  const [taxApplies, setTaxApplies] = useState(true)
  const [changeReason, setChangeReason] = useState("")
  const [lines, setLines] = useState<PoLineEditDraft[]>([emptyLine()])
  const [lineErrors, setLineErrors] = useState<Record<number, PoLineFieldErrors>>({})
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<EditBaseline | null>(null)

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
        const notesVal = (data.notes ?? "").trim()
        const ord = toDateInputValue(data.ordered_at)
        const tax = data.tax_applies !== false
        const mappedLines =
          data.lines?.length && data.lines.length > 0
            ? data.lines.map((ln) => apiLineToDraft(ln))
            : [emptyLine()]
        setNotes(data.notes ?? "")
        setOrderedAt(ord)
        setTaxApplies(tax)
        setLines(mappedLines)
        baselineRef.current = {
          notes: notesVal,
          orderedAt: ord,
          taxApplies: tax,
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

    const notesTrim = notes.trim()
    const orderedTrim = orderedAt.trim()
    const linesSnapshot = serializeLinesSnapshot(lines)
    const changed =
      notesTrim !== base.notes ||
      orderedTrim !== base.orderedAt ||
      taxApplies !== base.taxApplies ||
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
          notes: notesTrim === "" ? null : notesTrim,
          ordered_at: orderedTrim === "" ? null : orderedTrim,
          tax_applies: taxApplies,
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
  }, [detail, notes, orderedAt, taxApplies, changeReason, lines, navigate, listFrom])

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="po-list-shell po-edit-shell space-y-4 p-4 md:p-6">
        <p className="text-muted-foreground">Identificador de orden no válido.</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/ordenes-compra">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="po-list-shell po-edit-shell mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" asChild>
            <Link to={listFrom} aria-label="Volver al listado">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ShoppingCart className="size-7 text-primary" aria-hidden />
              <h1 className="text-3xl font-semibold tracking-tight">Editar orden de compra</h1>
            </div>
            <p className="text-muted-foreground mt-2 text-base">
              Modifique cabecera y artículos del pedido. Cualquier cambio requiere motivo registrado en
              auditoría.
            </p>
          </div>
        </div>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="size-5 text-primary" aria-hidden />
        <AlertDescription className="text-base">
          Puede editar notas, fecha, impuesto y líneas del pedido. Las líneas con material recibido no se
          pueden eliminar y su cantidad no puede quedar por debajo de lo recibido.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-base text-muted-foreground">
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
        <>
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5">
              <Badge variant="secondary" className="border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary">
                Orden de compra
              </Badge>
              <p className="font-mono text-2xl font-bold tracking-tight text-primary">{detail.code}</p>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="po-detail-hero grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-start gap-2.5">
                  <Hash className="mt-0.5 size-5 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-sm">Código</p>
                    <p className="font-mono text-base font-semibold">{detail.code}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Building2 className="mt-0.5 size-5 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-sm">Proveedor</p>
                    <p className="text-base font-medium">
                      {detail.supplier?.name ?? `#${detail.supplier_id}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-sm">Estado</p>
                    <PurchaseOrderStatusBadge
                      status={detail.status}
                      manuallyClosedAt={detail.manually_closed_at ?? null}
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CalendarIcon className="mt-0.5 size-5 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-sm">Registrada</p>
                    <p className="text-base font-medium">{formatDateTime(detail.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="grid gap-2 lg:col-span-2">
                  <Label htmlFor="po-edit-notes" className="text-base">
                    Notas / observación
                  </Label>
                  <div className="relative">
                    <FileText
                      className="text-muted-foreground pointer-events-none absolute left-3 top-3.5 size-5"
                      aria-hidden
                    />
                    <Textarea
                      id="po-edit-notes"
                      value={notes}
                      onChange={(ev) => setNotes(ev.target.value)}
                      rows={4}
                      className="resize-y pl-11 text-base"
                      placeholder="Observaciones para el proveedor o el equipo interno…"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="po-edit-ordered" className="text-base">
                    Fecha de pedido
                  </Label>
                  <div className="relative">
                    <CalendarIcon
                      className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2"
                      aria-hidden
                    />
                    <Input
                      id="po-edit-ordered"
                      type="date"
                      value={orderedAt}
                      onChange={(ev) => setOrderedAt(ev.target.value)}
                      className="h-12 pl-11 text-base"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border px-5 py-4">
                  <div className="space-y-1">
                    <Label htmlFor="po-edit-tax" className="text-base">
                      Aplica impuesto
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Según lo acordado con el proveedor (solo referencia documental).
                    </p>
                  </div>
                  <Switch id="po-edit-tax" checked={taxApplies} onCheckedChange={setTaxApplies} />
                </div>

                <div className="grid gap-2 lg:col-span-2">
                  <Label htmlFor="po-edit-reason" className="text-base">
                    Motivo del cambio
                  </Label>
                  <Textarea
                    id="po-edit-reason"
                    value={changeReason}
                    onChange={(ev) => setChangeReason(ev.target.value)}
                    placeholder="Obligatorio al guardar cualquier cambio. Mínimo 5 caracteres."
                    rows={4}
                    className="resize-y text-base"
                  />
                </div>
              </div>
            </div>
          </div>

          <PurchaseOrderLinesEditor
            lines={lines}
            onLinesChange={setLines}
            saving={saving}
            lineErrors={lineErrors}
            returnPath={editPath}
            supplierId={detail.supplier_id}
          />

          <div className="flex flex-wrap justify-center gap-4 pb-6">
            <Button type="button" variant="outline" size="lg" className="min-w-[140px]" asChild>
              <Link to={listFrom}>Cancelar</Link>
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-w-[180px]"
              disabled={saving}
              onClick={() => void submit()}
            >
              <Save className="mr-2 size-5" aria-hidden />
              <LoadingButtonLabel loading={saving} loadingText="Guardando…" idleText="Guardar cambios" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
