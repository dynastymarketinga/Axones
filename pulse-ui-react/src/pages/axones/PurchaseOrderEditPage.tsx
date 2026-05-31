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
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  formatDateTime,
  parsePoLineItemType,
  poLinePrimaryLabel,
  PO_ITEM_TYPE_DISPLAY,
  PoLineTypeBadge,
  PurchaseOrderStatusBadge,
  toDateInputValue,
} from "@/pages/axones/purchase-order-shared"
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
    unit?: string | null
    material?: { name?: string | null } | null
  }>
}

export default function PurchaseOrderEditPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const id = Number(routeId ?? "")
  const navigate = useNavigate()
  const location = useLocation()
  const listFrom =
    (location.state as { from?: string } | null)?.from ?? "/ordenes-compra"

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<PurchaseOrderEditDetail | null>(null)
  const [notes, setNotes] = useState("")
  const [orderedAt, setOrderedAt] = useState("")
  const [taxApplies, setTaxApplies] = useState(true)
  const [changeReason, setChangeReason] = useState("")
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<{ notes: string; orderedAt: string; taxApplies: boolean } | null>(
    null,
  )

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
        setNotes(data.notes ?? "")
        setOrderedAt(ord)
        setTaxApplies(tax)
        baselineRef.current = { notes: notesVal, orderedAt: ord, taxApplies: tax }
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
    const changed =
      notesTrim !== base.notes ||
      orderedTrim !== base.orderedAt ||
      taxApplies !== base.taxApplies
    if (!changed) {
      toast.message("Sin cambios en la cabecera.")
      navigate(listFrom)
      return
    }
    const reason = changeReason.trim()
    if (reason.length < 5) {
      toast.error("Indique el motivo del cambio (mínimo 5 caracteres).")
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
        }),
      })
      toast.success("Orden actualizada.")
      navigate(listFrom)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar el cambio.")
    } finally {
      setSaving(false)
    }
  }, [detail, notes, orderedAt, taxApplies, changeReason, navigate, listFrom])

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="po-list-shell space-y-4 p-4 md:p-6">
        <p className="text-muted-foreground">Identificador de orden no válido.</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/ordenes-compra">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="po-list-shell space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button type="button" variant="outline" size="icon" className="shrink-0" asChild>
            <Link to={listFrom} aria-label="Volver al listado">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ShoppingCart className="size-6 text-primary" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight">Editar orden de compra</h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Modifique notas, fecha de pedido o impuesto. Los artículos del pedido no se editan aquí.
            </p>
          </div>
        </div>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="size-4 text-primary" aria-hidden />
        <AlertDescription>
          Si altera notas, fecha o impuesto debe indicar un motivo; quedará registrado en auditoría.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                Orden de compra · cabecera
              </Badge>
              <p className="font-mono text-xl font-bold tracking-tight text-primary">{detail.code}</p>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="po-detail-hero grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  <Hash className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-xs">Código</p>
                    <p className="font-mono text-sm font-semibold">{detail.code}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-xs">Proveedor</p>
                    <p className="text-sm font-medium">
                      {detail.supplier?.name ?? `#${detail.supplier_id}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-xs">Estado</p>
                    <PurchaseOrderStatusBadge
                      status={detail.status}
                      manuallyClosedAt={detail.manually_closed_at ?? null}
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CalendarIcon className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
                  <div>
                    <p className="text-muted-foreground text-xs">Registrada</p>
                    <p className="text-sm font-medium">{formatDateTime(detail.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="po-edit-notes">Notas / observación</Label>
                  <div className="relative">
                    <FileText
                      className="text-muted-foreground pointer-events-none absolute left-3 top-3 size-4"
                      aria-hidden
                    />
                    <Textarea
                      id="po-edit-notes"
                      value={notes}
                      onChange={(ev) => setNotes(ev.target.value)}
                      rows={3}
                      className="resize-y pl-10"
                      placeholder="Observaciones para el proveedor o el equipo interno…"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="po-edit-ordered">Fecha de pedido</Label>
                  <div className="relative">
                    <CalendarIcon
                      className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                      aria-hidden
                    />
                    <Input
                      id="po-edit-ordered"
                      type="date"
                      value={orderedAt}
                      onChange={(ev) => setOrderedAt(ev.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="po-edit-tax" className="text-base">
                      Aplica impuesto
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Según lo acordado con el proveedor (solo referencia documental).
                    </p>
                  </div>
                  <Switch
                    id="po-edit-tax"
                    checked={taxApplies}
                    onCheckedChange={setTaxApplies}
                  />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="po-edit-reason">Motivo del cambio</Label>
                  <Textarea
                    id="po-edit-reason"
                    value={changeReason}
                    onChange={(ev) => setChangeReason(ev.target.value)}
                    placeholder="Obligatorio si altera notas, fecha o impuesto. Mínimo 5 caracteres."
                    rows={3}
                    className="resize-y"
                  />
                </div>
              </div>
            </div>
          </div>

          {detail.lines?.length ? (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold">
                Artículos del pedido
                <span className="text-muted-foreground ml-1.5 font-normal">(solo lectura)</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {detail.lines.map((ln, idx) => {
                  const itemType = parsePoLineItemType(ln.description)
                  const accent = PO_ITEM_TYPE_DISPLAY[itemType].rowAccent
                  return (
                    <li key={ln.id} className={cn("po-line-card border-l-4", accent)}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                            {idx + 1}
                          </span>
                          <PoLineTypeBadge type={itemType} />
                          <span className="text-sm font-medium">{poLinePrimaryLabel(ln)}</span>
                        </div>
                        <span className="text-sm tabular-nums">
                          {String(ln.quantity_ordered)} {ln.unit ?? ""}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="text-muted-foreground mt-3 text-xs">
                Para cambiar artículos o cantidades debe crear una nueva orden de compra.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-center gap-3 pb-4">
            <Button type="button" variant="outline" asChild>
              <Link to={listFrom}>Cancelar</Link>
            </Button>
            <Button type="button" disabled={saving} onClick={() => void submit()}>
              <Save className="mr-2 size-4" aria-hidden />
              <LoadingButtonLabel loading={saving} loadingText="Guardando…" idleText="Guardar cambios" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
