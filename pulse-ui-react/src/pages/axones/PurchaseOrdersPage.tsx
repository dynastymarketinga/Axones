"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import {
  Ban,
  Barcode,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Printer,
  RotateCcw,
  Settings2,
  ShoppingCart,
  ClipboardList,
  Truck,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogPaginationOutlineButtonClass,
  catalogPaginationSelectTriggerClass,
  catalogSelectTriggerClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { EntityDetailDialog } from "@/components/axones/EntityDetailDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getStoredUser } from "@/lib/auth-storage"
import { isAxonesFullAccess } from "@/lib/axones-roles"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch, ApiError } from "@/lib/api"
import type {
  LaravelPaginated,
  PurchaseOrderRow,
  SupplierRecord,
} from "@/types/api"

const PURCHASE_ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  partial: "Parcial",
  completed: "Completada",
  /** Historial si llegara un valor antiguo antes de migrar */
  cancelled: "Completada",
}

function purchaseOrderStatusLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return PURCHASE_ORDER_STATUS_LABELS[value] ?? value
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

type ViewTab = "pending" | "history"

function parseViewTab(raw: string | null): ViewTab {
  return raw === "history" ? "history" : "pending"
}

function formatReceiptCode(id: number): string {
  if (!Number.isFinite(id) || id < 1) return "REC-———"
  return `REC-${String(Math.trunc(id)).padStart(6, "0")}`
}

/** Botones de acción en fila: colores distintos por función */
const poActionIconBase =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm"

const poActionPrintClass = cn(
  poActionIconBase,
  "border-sky-400/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400",
)
const poActionEyeClass = cn(
  poActionIconBase,
  "border-violet-400/50 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400",
)
const poActionEditClass = cn(
  poActionIconBase,
  "border-amber-400/55 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400",
)
const poActionDeactivateClass = cn(
  poActionIconBase,
  "border-destructive/40 text-destructive hover:bg-destructive/10",
)
const poActionReactivateClass = cn(
  poActionIconBase,
  "border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400",
)

function formatDateDMY(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function PurchaseOrderStatusBadge({
  status,
  manuallyClosedAt,
}: {
  status: string
  manuallyClosedAt?: string | null
}) {
  const normalized = status === "cancelled" ? "completed" : status
  const label = purchaseOrderStatusLabel(status)
  const wasManualClose = normalized === "completed" && Boolean(manuallyClosedAt)

  if (normalized === "completed") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-emerald-600"
        title={
          wasManualClose
            ? "Cerrada manualmente por jefatura"
            : "Cerrada automáticamente al despachar todas las OTs"
        }
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
        {wasManualClose ? (
          <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            manual
          </span>
        ) : null}
      </span>
    )
  }

  if (normalized === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </span>
    )
  }

  if (normalized === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700">
        <span
          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.65)]"
          aria-hidden
        />
        <span className="text-sm font-medium">{label}</span>
      </span>
    )
  }

  return <span className="text-muted-foreground text-sm">{label}</span>
}

type PurchaseOrderSheetDetail = {
  id: number
  code: string
  status: string
  supplier_id: number
  ordered_at: string | null
  created_at?: string | null
  notes: string | null
  tax_applies?: boolean
  manually_closed_at?: string | null
  manual_close_reason?: string | null
  manuallyClosedBy?: { id: number; name: string } | null
  supplier?: { id: number; name: string; rif?: string | null } | null
  lines?: Array<{
    id: number
    description?: string | null
    quantity_ordered: string | number
    quantity_received?: string | number
    unit?: string
    material?: { name?: string; sku?: string } | null
  }>
  receipts?: Array<{
    id: number
    invoice_number?: string | null
    received_at?: string | null
    lines?: unknown[]
  }>
}

export default function PurchaseOrdersPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isBoss = isAxonesFullAccess(getStoredUser()?.role, getStoredUser()?.id)

  const [supplierId, setSupplierId] = useState<string>(() => {
    const raw = searchParams.get("supplier_id")
    return raw && raw.trim() ? raw : "all"
  })
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [status, setStatus] = useState<string>(() => {
    const raw = searchParams.get("status")?.trim()
    if (!raw) return "all"
    if (raw === "cancelled") return "completed"
    return raw
  })
  const [page, setPage] = useState(() => {
    const raw = searchParams.get("page")
    const n = raw ? Number(raw) : 1
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
  })
  const [qInput, setQInput] = useState(() => searchParams.get("q")?.trim() ?? "")
  const [qApi, setQApi] = useState(() => searchParams.get("q")?.trim() ?? "")
  const qDebounceRef = useRef<number | null>(null)

  const [visibility, setVisibility] = useState<"active" | "all" | "inactive">(() => {
    const v = searchParams.get("visibility")
    if (v === "all" || v === "inactive") return v
    return "active"
  })
  const [viewTab, setViewTab] = useState<ViewTab>(() => parseViewTab(searchParams.get("tab")))

  const isHistoryTab = viewTab === "history"
  const tableColSpan = isHistoryTab ? 7 : 5

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<PurchaseOrderRow> | null>(
    null,
  )
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<PurchaseOrderSheetDetail | null>(null)

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editPo, setEditPo] = useState<PurchaseOrderRow | null>(null)
  const [editNotes, setEditNotes] = useState("")
  const [editOrderedAt, setEditOrderedAt] = useState("")
  const [editChangeReason, setEditChangeReason] = useState("")
  const [editTaxApplies, setEditTaxApplies] = useState(true)
  const [editFormLoading, setEditFormLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const editBaselineRef = useRef<{
    notes: string
    orderedAt: string
    taxApplies: boolean
  } | null>(null)

  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivatePo, setDeactivatePo] = useState<PurchaseOrderRow | null>(null)
  const [deactivateReason, setDeactivateReason] = useState("")
  const [deactivateSaving, setDeactivateSaving] = useState(false)

  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [reactivatePo, setReactivatePo] = useState<PurchaseOrderRow | null>(null)
  const [reactivateReason, setReactivateReason] = useState("")
  const [reactivateSaving, setReactivateSaving] = useState(false)

  const [perPage, setPerPage] = useState(20)

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set("page", String(page))
    if (supplierId !== "all") params.set("supplier_id", supplierId)
    if (status !== "all") params.set("status", status)
    if (qApi.trim()) params.set("q", qApi.trim())
    if (isBoss && visibility !== "active") params.set("visibility", visibility)
    if (viewTab === "history") params.set("tab", "history")
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, status, supplierId, qApi, isBoss, visibility, viewTab])

  useEffect(() => {
    if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    qDebounceRef.current = window.setTimeout(() => {
      setQApi(qInput.trim())
    }, 320)
    return () => {
      if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    }
  }, [qInput])

  useEffect(() => {
    if (!isBoss && visibility !== "active") {
      setVisibility("active")
    }
  }, [isBoss, visibility])

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set("page", String(page))
    if (supplierId !== "all") next.set("supplier_id", supplierId)
    if (status !== "all") next.set("status", status)
    if (qApi.trim()) next.set("q", qApi.trim())
    if (isBoss && visibility !== "active") next.set("visibility", visibility)
    if (viewTab === "history") next.set("tab", "history")
    setSearchParams(next, { replace: true })
  }, [page, setSearchParams, status, supplierId, qApi, visibility, isBoss, viewTab])

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<SupplierRecord>>(
          "suppliers",
          { query: { per_page: 100, page: 1 } },
        )
        if (!c) setSuppliers(res.data)
      } catch {
        if (!c) setSuppliers([])
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sid =
        supplierId !== "all" ? Number(supplierId) : undefined
      const st = status !== "all" ? status : undefined
      const vis = isBoss ? visibility : "active"
      const data = await apiFetch<LaravelPaginated<PurchaseOrderRow>>(
        "purchase-orders",
        {
          query: {
            page,
            per_page: perPage,
            supplier_id: sid,
            status: st,
            q: qApi.trim() || undefined,
            visibility: vis === "active" ? undefined : vis,
            has_receipts: isHistoryTab ? "true" : "false",
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes de compra.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, supplierId, status, qApi, visibility, isBoss, isHistoryTab])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!detailOpen || detailId == null) return
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    void (async () => {
      try {
        const data = await apiFetch<PurchaseOrderSheetDetail>(
          `purchase-orders/${detailId}`,
        )
        if (!cancelled) setDetail(data)
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudo cargar la orden.")
          setDetailOpen(false)
          setDetailId(null)
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailOpen, detailId])

  const showInitialSkeleton = loading && rows === null

  const openEditDialog = useCallback((r: PurchaseOrderRow) => {
    setEditPo(r)
    setEditChangeReason("")
    editBaselineRef.current = null
    setEditOpen(true)
    setEditFormLoading(true)
    void (async () => {
      try {
        const d = await apiFetch<PurchaseOrderSheetDetail>(`purchase-orders/${r.id}`)
        setEditNotes(d.notes ?? "")
        const ord = toDateInputValue(d.ordered_at)
        setEditOrderedAt(ord)
        const ta = d.tax_applies !== false
        setEditTaxApplies(ta)
        editBaselineRef.current = {
          notes: (d.notes ?? "").trim(),
          orderedAt: ord,
          taxApplies: ta,
        }
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo cargar la orden para editar.")
        setEditOpen(false)
        setEditPo(null)
      } finally {
        setEditFormLoading(false)
      }
    })()
  }, [])

  const submitEdit = useCallback(async () => {
    if (!editPo) return
    const base = editBaselineRef.current
    if (!base) {
      toast.error("Espere a que termine de cargar el formulario.")
      return
    }
    const notesTrim = editNotes.trim()
    const orderedTrim = editOrderedAt.trim()
    const changed =
      notesTrim !== base.notes ||
      orderedTrim !== base.orderedAt ||
      editTaxApplies !== base.taxApplies
    if (!changed) {
      toast.message("Sin cambios en la cabecera.")
      setEditOpen(false)
      setEditPo(null)
      return
    }
    const reason = editChangeReason.trim()
    if (reason.length < 5) {
      toast.error("El motivo del cambio debe tener al menos 5 caracteres.")
      return
    }
    setEditSaving(true)
    try {
      await apiFetch(`purchase-orders/${editPo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          notes: notesTrim === "" ? null : notesTrim,
          ordered_at: orderedTrim === "" ? null : orderedTrim,
          tax_applies: editTaxApplies,
          change_reason: reason,
        }),
      })
      toast.success("Orden actualizada.")
      setEditOpen(false)
      setEditPo(null)
      editBaselineRef.current = null
      await load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar el cambio.")
    } finally {
      setEditSaving(false)
    }
  }, [editPo, editNotes, editOrderedAt, editTaxApplies, editChangeReason, load])

  const submitDeactivate = useCallback(async () => {
    if (!deactivatePo) return
    const reason = deactivateReason.trim()
    if (reason.length < 5) {
      toast.error("Indique el motivo de desactivación (mínimo 5 caracteres).")
      return
    }
    setDeactivateSaving(true)
    try {
      await apiFetch(`purchase-orders/${deactivatePo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: false,
          deactivation_reason: reason,
        }),
      })
      toast.success("Orden desactivada.")
      setDeactivateOpen(false)
      setDeactivatePo(null)
      setDeactivateReason("")
      setSelectedRowId((cur) => (cur === deactivatePo.id ? null : cur))
      await load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo desactivar la orden.")
    } finally {
      setDeactivateSaving(false)
    }
  }, [deactivatePo, deactivateReason, load])

  const submitReactivate = useCallback(async () => {
    if (!reactivatePo) return
    const reason = reactivateReason.trim()
    if (reason.length < 5) {
      toast.error("Indique el motivo de la reactivación (mínimo 5 caracteres).")
      return
    }
    setReactivateSaving(true)
    try {
      await apiFetch(`purchase-orders/${reactivatePo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: true,
          change_reason: reason,
        }),
      })
      toast.success("Orden reactivada.")
      setReactivateOpen(false)
      setReactivatePo(null)
      setReactivateReason("")
      setSelectedRowId((cur) => (cur === reactivatePo.id ? null : cur))
      await load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo reactivar la orden.")
    } finally {
      setReactivateSaving(false)
    }
  }, [reactivatePo, reactivateReason, load])

  const poDetailFields =
    detail && !detailLoading
      ? [
          { label: "Código", value: detail.code, mono: true, icon: Barcode },
          {
            label: "Proveedor",
            value: detail.supplier?.name ?? `#${detail.supplier_id}`,
            icon: Truck,
          },
          {
            label: "Estado",
            value:
              detail.manually_closed_at && detail.status === "completed"
                ? `${purchaseOrderStatusLabel(detail.status)} · cerrada manualmente`
                : purchaseOrderStatusLabel(detail.status),
            icon: CircleDot,
          },
          { label: "Creado", value: formatDateTime(detail.created_at), icon: CalendarDays },
          { label: "Ordenado", value: formatDateDMY(detail.ordered_at), icon: CalendarDays },
          {
            label: "Notas",
            value: detail.notes?.trim() || "—",
            full: true,
            icon: FileText,
          },
        ]
      : []

  return (
    <CatalogPageShell
      title="Órdenes de compra"
      subtitle="Material solicitado a proveedores."
      icon={ShoppingCart}
      action={
        <Button type="button" asChild>
          <Link to="/ordenes-compra/nueva" state={{ from }}>
            Nueva OC
          </Link>
        </Button>
      }
    >
      <EntityDetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setDetailId(null)
            setDetail(null)
          }
        }}
        title="Detalle de orden de compra"
        description="Cabecera y líneas de la orden seleccionada."
        loading={detailLoading}
        fields={poDetailFields}
        footer={
          detailId != null ? (
            <Button type="button" variant="outline" asChild>
              <Link
                to={`/ordenes-compra/${detailId}/vista-previa`}
                className="inline-flex items-center gap-2"
              >
                <Printer className="h-4 w-4 shrink-0" />
                Vista previa
              </Link>
            </Button>
          ) : null
        }
      >
        {!detailLoading && detail ? (
          detail.lines?.length ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Líneas ({detail.lines.length})
              </p>
              <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[10rem]">Material / descripción</TableHead>
                      <TableHead className="w-24">SKU</TableHead>
                      <TableHead className="w-28 text-right">Cantidad</TableHead>
                      <TableHead className="w-24">Unidad</TableHead>
                      <TableHead className="w-28 text-right">Recibido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.lines.map((ln) => (
                      <TableRow key={ln.id}>
                        <TableCell className="align-top text-sm">
                          {(ln.material?.name ?? ln.description?.trim()) || `Línea #${ln.id}`}
                        </TableCell>
                        <TableCell className="font-mono text-xs align-top">
                          {ln.material?.sku ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums align-top">
                          {String(ln.quantity_ordered)}
                        </TableCell>
                        <TableCell className="align-top">{ln.unit ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums align-top">
                          {ln.quantity_received != null && String(ln.quantity_received) !== ""
                            ? String(ln.quantity_received)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin líneas en esta orden.</p>
          )
        ) : null}
        {!detailLoading && detail?.receipts?.length ? (
          <div className="mt-4 space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Recepciones vinculadas ({detail.receipts.length})
            </p>
            <div className="max-h-[min(16rem,40vh)] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recepción</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Ítems</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.receipts.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-mono text-sm">{formatReceiptCode(rec.id)}</TableCell>
                      <TableCell>{rec.invoice_number?.trim() || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(rec.received_at ?? null)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Array.isArray(rec.lines) ? rec.lines.length : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link to={`/recepciones-oc/${rec.id}/vista-previa`}>Ver</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </EntityDetailDialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditPo(null)
            editBaselineRef.current = null
            setEditFormLoading(false)
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,36rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar orden {editPo?.code ?? ""}</DialogTitle>
            <DialogDescription>
              Si cambias notas, fecha de pedido o si aplica impuesto, indica el motivo; quedará registrado en auditoría.
            </DialogDescription>
          </DialogHeader>
          {editFormLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-sm">Cargando datos…</span>
            </div>
          ) : (
            <>
              {editPo ? (
                <div className="rounded-lg border bg-muted/40 px-3 py-3 text-sm">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Solo lectura
                  </p>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground text-xs">Código</dt>
                      <dd className="font-mono font-medium">{editPo.code}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Proveedor</dt>
                      <dd>{editPo.supplier?.name ?? `#${editPo.supplier_id}`}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground text-xs">Estado</dt>
                      <dd>
                        <PurchaseOrderStatusBadge
                          status={editPo.status}
                          manuallyClosedAt={editPo.manually_closed_at ?? null}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Líneas</dt>
                      <dd>{editPo.lines_count ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Creado</dt>
                      <dd>{formatDateTime(editPo.created_at ?? null)}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
              <div className="grid gap-4 py-2">
                <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="po-edit-tax" className="text-base">
                      Aplica impuesto (cabecera)
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Indica si esta OC lleva impuesto según lo acordado con el proveedor.
                    </p>
                  </div>
                  <Switch
                    id="po-edit-tax"
                    checked={editTaxApplies}
                    onCheckedChange={setEditTaxApplies}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="po-edit-notes">Notas</Label>
                  <Textarea
                    id="po-edit-notes"
                    value={editNotes}
                    onChange={(ev) => setEditNotes(ev.target.value)}
                    rows={3}
                    className="resize-y"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="po-edit-ordered">Fecha de pedido</Label>
                  <Input
                    id="po-edit-ordered"
                    type="date"
                    value={editOrderedAt}
                    onChange={(ev) => setEditOrderedAt(ev.target.value)}
                    className={catalogSelectTriggerClass}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="po-edit-reason">Motivo del cambio</Label>
                  <Textarea
                    id="po-edit-reason"
                    value={editChangeReason}
                    onChange={(ev) => setEditChangeReason(ev.target.value)}
                    placeholder="Obligatorio si altera notas, fecha o impuesto. Mínimo 5 caracteres."
                    rows={3}
                    className="resize-y"
                  />
                </div>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={editSaving || editFormLoading}
              onClick={() => void submitEdit()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deactivateOpen}
        onOpenChange={(open) => {
          setDeactivateOpen(open)
          if (!open) {
            setDeactivatePo(null)
            setDeactivateReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar orden {deactivatePo?.code ?? ""}</DialogTitle>
            <DialogDescription>
              La orden dejará de mostrarse en el listado para el equipo y no podrán registrarse recepciones contra ella.
              Solo jefatura puede volver a listarla y reactivarla desde aquí, con motivo registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="po-deact-reason">Motivo</Label>
            <Textarea
              id="po-deact-reason"
              value={deactivateReason}
              onChange={(ev) => setDeactivateReason(ev.target.value)}
              placeholder="Mínimo 5 caracteres."
              rows={4}
              className="resize-y"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeactivateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivateSaving}
              onClick={() => void submitDeactivate()}
            >
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reactivateOpen}
        onOpenChange={(open) => {
          setReactivateOpen(open)
          if (!open) {
            setReactivatePo(null)
            setReactivateReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivar orden {reactivatePo?.code ?? ""}</DialogTitle>
            <DialogDescription>
              La orden volverá a estar activa en el sistema. Indique el motivo; quedará en auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="po-react-reason">Motivo</Label>
            <Textarea
              id="po-react-reason"
              value={reactivateReason}
              onChange={(ev) => setReactivateReason(ev.target.value)}
              placeholder="Mínimo 5 caracteres."
              rows={4}
              className="resize-y"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReactivateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={reactivateSaving}
              onClick={() => void submitReactivate()}
            >
              Reactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <Tabs
            value={viewTab}
            onValueChange={(value) => {
              setViewTab(parseViewTab(value))
              setPage(1)
              setSelectedRowId(null)
            }}
            className="w-full"
          >
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
              <TabsTrigger value="pending" className="text-xs sm:text-sm">
                Pendientes
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm">
                Historial de recepción
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <CatalogFilterGrid>
            <CatalogLabeledField label="Proveedor" className="md:col-span-3">
              <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={supplierOpen}
                    className={cn(
                      "h-11 w-full justify-between font-normal",
                      catalogSelectTriggerClass,
                    )}
                  >
                    <span
                      className={cn(
                        "truncate text-left",
                        supplierId === "all" && "text-muted-foreground",
                      )}
                    >
                      {supplierId === "all"
                        ? "Todos"
                        : suppliers.find((s) => String(s.id) === supplierId)?.name ??
                          `#${supplierId}`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                        <CommandItem
                          value="__all__"
                          onSelect={() => {
                            setSupplierId("all")
                            setPage(1)
                            setSupplierOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              supplierId === "all" ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          <span>Todos</span>
                        </CommandItem>
                        {suppliers.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name} ${s.rif ?? ""}`}
                            onSelect={() => {
                              setSupplierId(String(s.id))
                              setPage(1)
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
            </CatalogLabeledField>
            <CatalogLabeledField label="Estado" className="md:col-span-3">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <CatalogSearchField
              id="po-q"
              placeholder="Código de OC…"
              value={qInput}
              onChange={(ev) => {
                setPage(1)
                setQInput(ev.target.value)
              }}
              className="min-w-0 md:col-span-6"
            />
            {isBoss ? (
              <CatalogLabeledField label="Vigencia" className="md:col-span-3">
                <Select
                  value={visibility}
                  onValueChange={(v) => {
                    setVisibility(v as "active" | "all" | "inactive")
                    setPage(1)
                  }}
                >
                  <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Solo activas</SelectItem>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="inactive">Solo inactivas</SelectItem>
                  </SelectContent>
                </Select>
              </CatalogLabeledField>
            ) : null}
            <p className="text-muted-foreground text-xs md:col-span-12">
              {isHistoryTab ? (
                <>
                  Aparecen aquí las OC con al menos una recepción de entrada vinculada. Las parciales pueden seguir
                  recibiendo material desde{" "}
                  <Link to="/recepciones-nueva" className="text-primary underline underline-offset-4">
                    Recepción
                  </Link>
                  .
                </>
              ) : (
                <>
                  Órdenes sin recepción registrada. Al vincular una recepción con OC, la orden pasa al historial.{" "}
                  <span className="font-medium">Parcial</span> aparece al registrar la primera recepción.{" "}
                  <span className="font-medium">Completada</span> se marca cuando todas las órdenes de trabajo que
                  usaron material de esta OC tienen su nota de entrega despachada (o cuando el jefe la cierra
                  manualmente desde el detalle).
                </>
              )}
              {!isBoss ? (
                <>
                  {" "}
                  Las órdenes desactivadas solo las gestiona jefatura (listado y reactivación).
                </>
              ) : null}
            </p>
          </CatalogFilterGrid>

          <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
                  <CatalogTableHead icon={Truck}>Proveedor</CatalogTableHead>
                  <CatalogTableHead icon={CircleDot}>Estado</CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays} className="whitespace-nowrap">
                    Creado
                  </CatalogTableHead>
                  {isHistoryTab ? (
                    <>
                      <CatalogTableHead icon={ClipboardList} className="whitespace-nowrap text-right">
                        Recepciones
                      </CatalogTableHead>
                      <CatalogTableHead icon={CalendarDays} className="whitespace-nowrap">
                        Última recepción
                      </CatalogTableHead>
                    </>
                  ) : null}
                  <CatalogTableHeadRight icon={Settings2} className="whitespace-nowrap">
                    Acciones
                  </CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={tableColSpan} />
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={tableColSpan} className="text-muted-foreground">
                      {isHistoryTab
                        ? "Aún no hay órdenes con recepción registrada."
                        : "Sin órdenes pendientes de recepción."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((r) => {
                    const inactive = r.is_active === false
                    return (
                    <TableRow
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRowId(r.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault()
                          setSelectedRowId(r.id)
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b transition-colors",
                        inactive && "bg-muted/30",
                        selectedRowId === r.id
                          ? "bg-primary/12 hover:bg-primary/16"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <TableCell className="p-2 align-middle font-mono text-sm">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {r.code}
                          {inactive ? (
                            <Badge variant="secondary" className="text-xs font-normal">
                              Inactiva
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="p-2 align-middle">
                        {r.supplier?.name ?? `#${r.supplier_id}`}
                      </TableCell>
                      <TableCell className="p-2 align-middle">
                        <PurchaseOrderStatusBadge
                          status={r.status}
                          manuallyClosedAt={r.manually_closed_at ?? null}
                        />
                      </TableCell>
                      <TableCell className="p-2 align-middle whitespace-nowrap">
                        {formatDateDMY(r.created_at ?? r.ordered_at)}
                      </TableCell>
                      {isHistoryTab ? (
                        <>
                          <TableCell className="p-2 align-middle text-right tabular-nums">
                            {r.receipts_count ?? 0}
                          </TableCell>
                          <TableCell className="p-2 align-middle whitespace-nowrap">
                            {formatDateTime(r.last_receipt_at ?? null)}
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell className="p-2 align-middle text-right">
                        <div className="inline-flex justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                          <Link
                            to={`/ordenes-compra/${r.id}/vista-previa`}
                            onClick={(ev) => ev.stopPropagation()}
                            className={poActionPrintClass}
                            title="Vista previa imprimible"
                          >
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">Vista previa imprimible</span>
                          </Link>
                          <button
                            type="button"
                            className={poActionEyeClass}
                            title="Ver detalle"
                            aria-label="Ver detalle de la orden"
                            onClick={() => {
                              setDetailId(r.id)
                              setDetailOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver detalle</span>
                          </button>
                          {!inactive && !isHistoryTab ? (
                            <button
                              type="button"
                              className={poActionEditClass}
                              title="Editar cabecera"
                              aria-label="Editar orden de compra"
                              onClick={() => openEditDialog(r)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </button>
                          ) : null}
                          {inactive && isBoss ? (
                            <button
                              type="button"
                              className={poActionReactivateClass}
                              title="Reactivar orden"
                              aria-label="Reactivar orden de compra"
                              onClick={() => {
                                setReactivatePo(r)
                                setReactivateReason("")
                                setReactivateOpen(true)
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span className="sr-only">Reactivar</span>
                            </button>
                          ) : null}
                          {!inactive && !isHistoryTab ? (
                            <button
                              type="button"
                              className={poActionDeactivateClass}
                              title="Desactivar orden"
                              aria-label="Desactivar orden de compra"
                              onClick={() => {
                                setDeactivatePo(r)
                                setDeactivateReason("")
                                setDeactivateOpen(true)
                              }}
                            >
                              <Ban className="h-4 w-4" />
                              <span className="sr-only">Desactivar</span>
                            </button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {rows ? (
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="text-muted-foreground min-w-0">
                {rows.total === 0
                  ? "Sin resultados con los filtros actuales."
                  : rows.last_page > 1
                    ? `Mostrando ${rows.from ?? 0} a ${rows.to ?? 0} de ${rows.total} · página ${rows.current_page} de ${rows.last_page}`
                    : `Mostrando ${rows.from ?? 0} a ${rows.to ?? 0} de ${rows.total} registros`}
              </p>
              <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Por página</span>
                  <Select
                    value={String(perPage)}
                    onValueChange={(v) => {
                      setPerPage(Number(v))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger
                      id="purchase-orders-per-page"
                      className={cn(
                        "h-8 w-[4.5rem] text-sm",
                        catalogPaginationSelectTriggerClass,
                      )}
                      aria-label="Registros por página"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PER_PAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={String(opt)}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-8", catalogPaginationOutlineButtonClass)}
                    disabled={rows.current_page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-8", catalogPaginationOutlineButtonClass)}
                    disabled={rows.current_page >= rows.last_page || loading}
                    onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
                    type="button"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </CatalogPageShell>
  )
}
