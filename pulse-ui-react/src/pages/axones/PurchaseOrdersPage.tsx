"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  Ban,
  Barcode,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Eye,
  Filter,
  Layers,
  ListOrdered,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  SearchX,
  Settings2,
  ShoppingCart,
  Truck,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogEmptyState } from "@/components/axones/CatalogEmptyState"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogListPagination } from "@/components/axones/CatalogListPagination"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogFilterCol3Class,
  catalogFilterCol4Class,
  catalogFilterCol5Class,
  catalogFilterGridClass,
  catalogMasterFilterPanelClass,
  catalogSelectTriggerClass,
  mesBandejaFilterActiveControlClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
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
import { Label } from "@/components/ui/label"
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
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch, ApiError } from "@/lib/api"
import { catalogCountLabel } from "@/lib/catalog-count-label"
import type {
  LaravelPaginated,
  PurchaseOrderRow,
  SupplierRecord,
} from "@/types/api"
import { PurchaseOrderDetailSheet } from "@/pages/axones/PurchaseOrderDetailSheet"
import {
  formatDateDMY,
  formatDateTime,
  PurchaseOrderStatusBadge,
} from "@/pages/axones/purchase-order-shared"
import "./purchase-order-list.css"

function partialReceiptProgressTooltip(label: string | null | undefined): string | undefined {
  if (!label) return undefined
  const slashIdx = label.indexOf(" / ")
  if (slashIdx === -1) return undefined
  const received = label.slice(0, slashIdx).trim()
  const rest = label.slice(slashIdx + 3).trim()
  return `Recibido ${received} de ${rest} pedidos`
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

type ViewTab = "pending" | "history" | "inactive"

function parseViewTab(raw: string | null): ViewTab {
  if (raw === "history") return "history"
  if (raw === "inactive") return "inactive"
  return "pending"
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

function purchaseOrderEmptyState(viewTab: ViewTab, hasActiveFilters: boolean) {
  if (hasActiveFilters) {
    return {
      icon: SearchX,
      title: "Sin resultados",
      description: "Prueba otro código, proveedor o estado de la orden.",
    }
  }
  if (viewTab === "inactive") {
    return {
      icon: Ban,
      title: "Sin órdenes desactivadas",
      description: "Las órdenes retiradas del listado operativo aparecerán aquí.",
    }
  }
  if (viewTab === "history") {
    return {
      icon: ClipboardList,
      title: "Sin órdenes con recepción",
      description:
        "Cuando se registre la primera recepción de una orden, pasará a esta pestaña.",
    }
  }
  return {
    icon: ShoppingCart,
    title: "Sin órdenes pendientes",
    description:
      "Crea una orden de compra para solicitar material a proveedores.",
  }
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
  const isInactiveTab = viewTab === "inactive"
  const showReceiptProgressCol = !isInactiveTab
  const tableColSpan = (isHistoryTab ? 8 : 6) + (showReceiptProgressCol ? 1 : 0)

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
    if (viewTab === "inactive") params.set("tab", "inactive")
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
    if (viewTab === "inactive") next.set("tab", "inactive")
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
      const vis = isBoss
        ? isInactiveTab
          ? "inactive"
          : visibility
        : "active"
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
            has_receipts: isInactiveTab
              ? undefined
              : isHistoryTab
                ? "true"
                : "false",
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
  }, [page, perPage, supplierId, status, qApi, visibility, isBoss, isHistoryTab, isInactiveTab])

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
  const totalCount = rows?.total ?? 0
  const hasActiveFilters =
    supplierId !== "all" ||
    status !== "all" ||
    qApi.trim() !== "" ||
    (isBoss && !isInactiveTab && visibility !== "active")
  const emptyState = purchaseOrderEmptyState(viewTab, hasActiveFilters)

  const newPurchaseOrderButton = (
    <Button type="button" asChild className="gap-2 shadow-sm">
      <Link to="/ordenes-compra/nueva" state={{ from }}>
        <Plus className="h-4 w-4" aria-hidden />
        Nueva OC
      </Link>
    </Button>
  )

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
      toast.success("Orden desactivada. Consulte la pestaña Desactivadas.")
      setDeactivateOpen(false)
      setDeactivatePo(null)
      setDeactivateReason("")
      setSelectedRowId((cur) => (cur === deactivatePo.id ? null : cur))
      if (isBoss) {
        setViewTab("inactive")
        setVisibility("inactive")
        setPage(1)
      } else {
        await load()
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo desactivar la orden.")
    } finally {
      setDeactivateSaving(false)
    }
  }, [deactivatePo, deactivateReason, load, isBoss])

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
      if (isInactiveTab) {
        setViewTab("pending")
        setVisibility("active")
        setPage(1)
      } else {
        await load()
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo reactivar la orden.")
    } finally {
      setReactivateSaving(false)
    }
  }, [reactivatePo, reactivateReason, load, isInactiveTab])

  return (
    <div className="po-list-shell">
    <CatalogPageShell
      title="Órdenes de compra"
      subtitle="Pedidos a proveedores: material, cantidades y seguimiento de recepción."
      icon={ShoppingCart}
      headerVariant="elevated"
      statBadge={
        rows && !loading ? (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {catalogCountLabel(totalCount, "orden", "órdenes")}
          </Badge>
        ) : null
      }
      action={newPurchaseOrderButton}
    >
      <PurchaseOrderDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setDetailId(null)
            setDetail(null)
          }
        }}
        loading={detailLoading}
        detail={detail}
      />

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
        <DialogContent className="po-deactivate-dialog gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="space-y-0 border-b px-6 pb-4 pt-6 text-left">
            <div className="flex items-start gap-3 pr-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <div className="space-y-1.5">
                <DialogTitle className="text-xl">Desactivar orden {deactivatePo?.code ?? ""}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  La orden dejará de mostrarse en Sin recepción / Con recepción y pasará a la pestaña
                  Desactivadas. No se podrán registrar nuevas recepciones.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {deactivatePo ? (
              <div className="po-deactivate-summary grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-xs">Código</p>
                  <p className="font-mono text-sm font-semibold text-primary">{deactivatePo.code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Proveedor</p>
                  <p className="text-sm font-medium">
                    {deactivatePo.supplier?.name ?? `#${deactivatePo.supplier_id}`}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="po-deactivate-panel text-sm leading-relaxed">
                <p className="font-semibold text-destructive">Qué ocurre</p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-4">
                  <li>Dejará de mostrarse en las pestañas operativas (Sin / Con recepción).</li>
                  <li>No se podrán registrar recepciones contra esta orden.</li>
                </ul>
              </div>
              <div className="po-deactivate-panel text-sm leading-relaxed">
                <p className="font-semibold text-foreground">Reactivación</p>
                <p className="text-muted-foreground mt-2">
                  Solo jefatura puede volver a listarla y reactivarla, con motivo registrado en
                  auditoría.
                </p>
              </div>
            </div>

            <div className="po-deactivate-reason-box space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label htmlFor="po-deact-reason" className="text-base font-semibold">
                  Motivo de desactivación
                </Label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    deactivateReason.trim().length >= 5 ? "text-emerald-600" : "text-muted-foreground",
                  )}
                >
                  {deactivateReason.trim().length}/5 mínimo
                </span>
              </div>
              <Textarea
                id="po-deact-reason"
                value={deactivateReason}
                onChange={(ev) => setDeactivateReason(ev.target.value)}
                placeholder="Describa el motivo operativo: error de captura, duplicado, proveedor canceló, etc."
                rows={6}
                className="resize-y"
              />
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setDeactivateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivateSaving || deactivateReason.trim().length < 5}
              onClick={() => void submitDeactivate()}
            >
              {deactivateSaving ? "Desactivando…" : "Confirmar desactivación"}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reactivar orden {reactivatePo?.code ?? ""}</DialogTitle>
            <DialogDescription>
              La orden volverá a estar activa en el listado. Indique el motivo; quedará en auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor="po-react-reason">Motivo de reactivación</Label>
            <Textarea
              id="po-react-reason"
              value={reactivateReason}
              onChange={(ev) => setReactivateReason(ev.target.value)}
              placeholder="Mínimo 5 caracteres."
              rows={4}
              className="min-h-[7rem] resize-y"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReactivateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={reactivateSaving || reactivateReason.trim().length < 5}
              onClick={() => void submitReactivate()}
            >
              {reactivateSaving ? "Reactivando…" : "Reactivar orden"}
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
              const tab = parseViewTab(value)
              setViewTab(tab)
              if (tab === "inactive") {
                setVisibility("inactive")
              } else if (visibility === "inactive") {
                setVisibility("active")
              }
              setPage(1)
              setSelectedRowId(null)
            }}
            className="w-full"
          >
            <TabsList className="po-tab-list h-auto w-full flex-wrap justify-start sm:w-auto">
              <TabsTrigger value="pending" className="po-tab-trigger text-xs sm:text-sm">
                Sin recepción
              </TabsTrigger>
              <TabsTrigger value="history" className="po-tab-trigger text-xs sm:text-sm">
                Con recepción
              </TabsTrigger>
              {isBoss ? (
                <TabsTrigger value="inactive" className="po-tab-trigger text-xs sm:text-sm">
                  Desactivadas
                </TabsTrigger>
              ) : null}
            </TabsList>
          </Tabs>

          <div className={cn("po-filter-bar space-y-4 p-4 md:p-5", catalogMasterFilterPanelClass)}>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-medium">Filtrar listado</p>
            </div>
            <div className={catalogFilterGridClass}>
            <CatalogLabeledField label="Proveedor" className={catalogFilterCol4Class}>
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
                      supplierId !== "all" && mesBandejaFilterActiveControlClass,
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
            <CatalogLabeledField label="Estado de la orden" className={catalogFilterCol3Class}>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className={cn(
                    "font-normal",
                    catalogSelectTriggerClass,
                    status !== "all" && mesBandejaFilterActiveControlClass,
                  )}
                >
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="open">Abierta — sin recepción aún</SelectItem>
                  <SelectItem value="partial">Parcial — con recepción incompleta</SelectItem>
                  <SelectItem value="completed">Completada — cerrada</SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <CatalogSearchField
              id="po-q"
              placeholder="Buscar por código OC…"
              value={qInput}
              onChange={(ev) => {
                setPage(1)
                setQInput(ev.target.value)
              }}
              className={catalogFilterCol5Class}
            />
            {isBoss && !isInactiveTab ? (
              <CatalogLabeledField label="Mostrar en listado" className={catalogFilterCol4Class}>
                <Select
                  value={visibility}
                  onValueChange={(v) => {
                    setVisibility(v as "active" | "all" | "inactive")
                    setPage(1)
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "font-normal",
                      catalogSelectTriggerClass,
                      visibility !== "active" && mesBandejaFilterActiveControlClass,
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Solo órdenes activas</SelectItem>
                    <SelectItem value="all">Activas e inactivas</SelectItem>
                    <SelectItem value="inactive">Solo desactivadas</SelectItem>
                  </SelectContent>
                </Select>
              </CatalogLabeledField>
            ) : null}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {isInactiveTab ? (
                <>
                  Órdenes retiradas del listado operativo. Puede ver el detalle, imprimir y{" "}
                  <span className="font-medium">reactivar</span> con motivo registrado en auditoría.
                </>
              ) : isHistoryTab ? (
                <>
                  Órdenes que ya tienen al menos una recepción de entrada. Puede seguir recibiendo
                  material desde{" "}
                  <Link to="/recepciones-nueva" className="text-primary underline underline-offset-4">
                    Recepción de OC
                  </Link>
                  .
                </>
              ) : (
                <>
                  Órdenes aún sin recepción registrada. Al vincular la primera recepción, la orden
                  pasa a la pestaña <span className="font-medium">Con recepción</span>.
                  {isBoss ? (
                    <>
                      {" "}
                      Las desactivadas se consultan en{" "}
                      <span className="font-medium">Desactivadas</span> o con el filtro «Solo
                      desactivadas».
                    </>
                  ) : null}
                </>
              )}
              {!isBoss ? (
                <> Las órdenes desactivadas solo las gestiona jefatura.</>
              ) : null}
            </p>
          </div>

          <div className="po-table-wrap overflow-x-auto">
            <Table className="min-w-[880px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
                <TableRow className="hover:bg-transparent">
                  <CatalogTableHead icon={ListOrdered} className="w-14">
                    N.º
                  </CatalogTableHead>
                  <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
                  <CatalogTableHead icon={Truck}>Proveedor</CatalogTableHead>
                  <CatalogTableHead icon={CircleDot} className="po-col-status">
                    Estado
                  </CatalogTableHead>
                  {showReceiptProgressCol ? (
                    <CatalogTableHead icon={Scale} className="hidden whitespace-nowrap md:table-cell">
                      Recibido / Pedido
                    </CatalogTableHead>
                  ) : null}
                  <CatalogTableHead icon={Layers} className="po-col-articles text-right">
                    Artículos
                  </CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays} className="po-col-date">
                    Fecha pedido
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
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={tableColSpan} className="p-0">
                      <CatalogEmptyState
                        icon={emptyState.icon}
                        title={emptyState.title}
                        description={emptyState.description}
                        action={
                          hasActiveFilters || viewTab !== "pending"
                            ? undefined
                            : newPurchaseOrderButton
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((r, rowIndex) => {
                    const inactive = r.is_active === false
                    const rowNum = (rows.from ?? 1) + rowIndex
                    return (
                    <TableRow
                      key={r.id}
                      data-selected={selectedRowId === r.id ? "true" : "false"}
                      data-inactive={inactive ? "true" : undefined}
                      className={cn(
                        "border-b transition-colors",
                        inactive && "po-row-inactive",
                        !inactive && selectedRowId === r.id && "bg-primary/5",
                      )}
                    >
                      <TableCell className="p-3 align-middle tabular-nums text-muted-foreground">
                        {rowNum}
                      </TableCell>
                      <TableCell className="p-3 align-middle">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="po-code-pill">{r.code}</span>
                          {inactive ? (
                            <Badge className="po-badge-inactive text-[10px] uppercase">
                              Inactiva
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="p-3 align-middle font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Truck className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          {r.supplier?.name ?? `#${r.supplier_id}`}
                        </span>
                      </TableCell>
                      <TableCell className="po-col-status p-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <PurchaseOrderStatusBadge
                            status={r.status}
                            manuallyClosedAt={r.manually_closed_at ?? null}
                            prominent
                            title={
                              r.status === "partial"
                                ? partialReceiptProgressTooltip(r.receipt_progress_label)
                                : undefined
                            }
                          />
                          {r.status === "partial" && r.receipt_progress_label ? (
                            <span className="text-muted-foreground text-xs tabular-nums md:hidden">
                              {r.receipt_progress_label}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      {showReceiptProgressCol ? (
                        <TableCell className="hidden p-3 align-middle tabular-nums text-sm md:table-cell">
                          {r.receipt_progress_label ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="po-col-articles p-3 align-middle text-right tabular-nums font-semibold">
                        {r.lines_count ?? "—"}
                      </TableCell>
                      <TableCell className="po-col-date p-3 align-middle text-sm">
                        {formatDateDMY(r.ordered_at ?? r.created_at)}
                      </TableCell>
                      {isHistoryTab ? (
                        <>
                          <TableCell className="p-3 align-middle text-right tabular-nums">
                            {r.receipts_count ?? 0}
                          </TableCell>
                          <TableCell className="p-3 align-middle whitespace-nowrap text-sm">
                            {formatDateTime(r.last_receipt_at ?? null)}
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell className="p-3 align-middle text-right">
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
                              setSelectedRowId(r.id)
                              setDetailId(r.id)
                              setDetailOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver detalle</span>
                          </button>
                          {!inactive && !isHistoryTab && !isInactiveTab ? (
                            <Link
                              to={`/ordenes-compra/${r.id}/editar`}
                              state={{ from }}
                              onClick={(ev) => ev.stopPropagation()}
                              className={poActionEditClass}
                              title="Editar orden"
                              aria-label="Editar orden de compra (cabecera y líneas)"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Link>
                          ) : null}
                          {inactive && isBoss && (isInactiveTab || visibility !== "active") ? (
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
                          {!inactive && !isHistoryTab && !isInactiveTab ? (
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

          <CatalogListPagination
            rows={rows}
            loading={loading}
            perPage={perPage}
            onPerPageChange={setPerPage}
            onPageChange={setPage}
            perPageOptions={PER_PAGE_OPTIONS}
            selectId="purchase-orders-per-page"
          />
        </>
      )}
    </CatalogPageShell>
    </div>
  )
}
