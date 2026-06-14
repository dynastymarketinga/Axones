"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Ban,
  Barcode,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Eye,
  List,
  ListOrdered,
  Package,
  Pencil,
  Plus,
  Scale,
  ScrollText,
  SearchX,
  Settings2,
  Users,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientOrderDetailRecord, ClientOrderRow, LaravelPaginated } from "@/types/api"
import { CatalogEmptyState } from "@/components/axones/CatalogEmptyState"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogListPagination } from "@/components/axones/CatalogListPagination"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import { InsumosBandejaTableCard } from "@/components/axones/InsumosBandejaTable"
import {
  MesBandejaCriteriaField,
  mesBandejaCriteriaSelectClass,
} from "@/components/axones/MesBandejaCriteriaField"
import { MesBandejaFiltersPanel } from "@/components/axones/MesBandejaFiltersPanel"
import {
  catalogActionButtonClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { catalogCountLabel } from "@/lib/catalog-count-label"
import { formatDecimalTwoDisplay } from "@/lib/decimal-two-input"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  clientOrderAwaitingOtBadgeClass,
  clientOrderAwaitingProductionOt,
  clientOrderStatusBadgeClass,
  clientOrderStatusLabel,
  CLIENT_ORDER_AWAITING_OT_BADGE,
  CLIENT_ORDER_CANCEL_DIALOG_TITLE,
  CLIENT_ORDER_DETAIL_LINE_CPE_COLUMN,
  CLIENT_ORDER_DETAIL_LINE_MPPS_COLUMN,
  CLIENT_ORDER_DETAIL_LINE_UNIT_COLUMN,
  CLIENT_ORDER_DETAIL_LINES_HELPER,
  CLIENT_ORDER_DETAIL_NO_OT_LINK,
  CLIENT_ORDER_EDIT_LINES_SECTION_TITLE,
  CLIENT_ORDER_LINE_DESCRIPTION_LABEL,
  CLIENT_ORDER_LINE_MATERIAL_LABEL,
  CLIENT_ORDER_MODULE_LIST_FOCUS,
  CLIENT_ORDER_MODULE_TITLE,
  CLIENT_ORDER_LIST_FILTERS_HINT,
  CLIENT_ORDER_LIST_FILTERS_SUBTITLE,
  CLIENT_ORDER_LIST_PRODUCT_COLUMN,
  CLIENT_ORDER_LIST_QUANTITY_COLUMN,
  CLIENT_ORDER_LIST_SEARCH_LABEL,
  CLIENT_ORDER_LIST_SEARCH_PLACEHOLDER,
  CLIENT_ORDER_LIST_SUBTITLE,
  CLIENT_ORDER_NEW_BUTTON_LABEL,
  CLIENT_ORDER_STATUS_HELP,
  CLIENT_ORDER_TOAST_LOAD_FAILED,
  clientOrderListExtraLinesCount,
  clientOrderListProductLabel,
  clientOrderListQuantityLabel,
  clientOrderOrderedAtDisplay,
} from "@/pages/axones/client-order-i18n"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"

const SEARCH_DEBOUNCE_MS = 400

const CLIENT_ORDER_DETAIL_LINE_GRID =
  "grid grid-cols-[2.5rem_minmax(11rem,1.4fr)_6.5rem_6.5rem_minmax(10rem,1.1fr)_minmax(12rem,1.2fr)_8.5rem_6rem] items-start gap-x-3 gap-y-1"

export default function ClientOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [awaitingOt, setAwaitingOt] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ClientOrderRow> | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null)
  const [detailModalId, setDetailModalId] = useState<number | null>(null)
  const [detailModalRecord, setDetailModalRecord] = useState<ClientOrderDetailRecord | null>(null)
  const [detailModalLoading, setDetailModalLoading] = useState(false)

  const skipSearchDrivenPageReset = useRef(true)

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = searchQuery.trim()
      setSearch((prev) => (prev === next ? prev : next))
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [searchQuery])

  useEffect(() => {
    if (skipSearchDrivenPageReset.current) {
      skipSearchDrivenPageReset.current = false
      return
    }
    setPage(1)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const st = status !== "all" ? status : undefined
      const data = await apiFetch<LaravelPaginated<ClientOrderRow>>("client-orders", {
        query: {
          page,
          per_page: perPage,
          q: search || undefined,
          status: st,
          awaiting_ot: awaitingOt ? 1 : undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error(`No se pudieron cargar las ${CLIENT_ORDER_MODULE_LIST_FOCUS}.`)
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, status, awaitingOt])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (detailModalId == null) return
    let cancelled = false
    setDetailModalLoading(true)
    setDetailModalRecord(null)
    void (async () => {
      try {
        const data = await apiFetch<ClientOrderDetailRecord>(`client-orders/${detailModalId}`)
        if (!cancelled) setDetailModalRecord(data)
      } catch (e) {
        if (!cancelled) {
          setDetailModalRecord(null)
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error(CLIENT_ORDER_TOAST_LOAD_FAILED)
        }
      } finally {
        if (!cancelled) setDetailModalLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailModalId])

  const showInitialSkeleton = loading && rows === null

  async function runCancelAnular() {
    if (pendingCancelId == null) return
    const id = pendingCancelId
    setCancellingId(id)
    try {
      await apiFetch(`client-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      })
      toast.success("Orden anulada.")
      setPendingCancelId(null)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo anular.")
    } finally {
      setCancellingId(null)
    }
  }

  const hasActiveFilters = status !== "all" || awaitingOt || search.trim() !== ""

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (status !== "all") n++
    if (awaitingOt) n++
    if (search.trim()) n++
    return n
  }, [status, awaitingOt, search])

  const clearFilters = useCallback(() => {
    setSearchQuery("")
    setSearch("")
    setStatus("all")
    setAwaitingOt(false)
    setPage(1)
  }, [])

  const totalCount = rows?.total ?? 0

  const newOrderButton = (
    <Button asChild className="gap-2 shrink-0 shadow-sm">
      <Link to="/ordenes-cliente/nueva">
        <Plus className="h-4 w-4" aria-hidden />
        {CLIENT_ORDER_NEW_BUTTON_LABEL}
      </Link>
    </Button>
  )

  const criteriaRow = (
    <CatalogFilterGrid>
      <MesBandejaCriteriaField
        label="Estado"
        icon={CircleDot}
        accent="sky"
        active={status !== "all"}
        className="min-w-0 sm:col-span-6 md:col-span-6"
      >
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={mesBandejaCriteriaSelectClass("sky", status !== "all")}>
            <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              {status === "open" ? (
                <CircleDot className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              ) : status === "fulfilled" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : status === "cancelled" ? (
                <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              ) : (
                <List className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent className="border-sky-500/20">
            <SelectItem value="all" title="Incluye abiertas, cumplidas y anuladas" className="gap-2.5 font-medium">
              <List className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Todos los estados
            </SelectItem>
            <SelectItem value="open" title={CLIENT_ORDER_STATUS_HELP["open"]} className="gap-2.5 font-medium">
              <CircleDot className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              Abierta
            </SelectItem>
            <SelectItem value="fulfilled" title={CLIENT_ORDER_STATUS_HELP["fulfilled"]} className="gap-2.5 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              Cumplida
            </SelectItem>
            <SelectItem value="cancelled" title={CLIENT_ORDER_STATUS_HELP["cancelled"]} className="gap-2.5 font-medium">
              <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              Anulada
            </SelectItem>
          </SelectContent>
        </Select>
      </MesBandejaCriteriaField>

      <MesBandejaCriteriaField
        label="Pendiente OT"
        icon={ClipboardList}
        accent="amber"
        active={awaitingOt}
        className="min-w-0 sm:col-span-6 md:col-span-6"
      >
        <Select
          value={awaitingOt ? "awaiting" : "all"}
          onValueChange={(v) => {
            setAwaitingOt(v === "awaiting")
            setPage(1)
          }}
        >
          <SelectTrigger className={mesBandejaCriteriaSelectClass("amber", awaitingOt)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-amber-500/20">
            <SelectItem value="all" className="gap-2.5 font-medium">
              Todos
            </SelectItem>
            <SelectItem value="awaiting" className="gap-2.5 font-medium">
              Solo sin OT
            </SelectItem>
          </SelectContent>
        </Select>
      </MesBandejaCriteriaField>
    </CatalogFilterGrid>
  )

  const searchFields = (
    <CatalogSearchField
      id="co-q"
      label={CLIENT_ORDER_LIST_SEARCH_LABEL}
      placeholder={CLIENT_ORDER_LIST_SEARCH_PLACEHOLDER}
      value={searchQuery}
      onChange={(ev) => setSearchQuery(ev.target.value)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") {
          const next = ev.currentTarget.value.trim()
          setSearch((prev) => (prev === next ? prev : next))
          setPage(1)
        }
      }}
      className="min-w-0"
    />
  )

  return (
    <>
      <CatalogPageShell
        title={CLIENT_ORDER_MODULE_TITLE}
        subtitle={CLIENT_ORDER_LIST_SUBTITLE}
        icon={ScrollText}
        headerVariant="elevated"
        statBadge={
          rows && !loading ? (
            <Badge variant="secondary" className="font-normal tabular-nums">
              {catalogCountLabel(totalCount, "pedido", "pedidos")}
            </Badge>
          ) : null
        }
        action={newOrderButton}
      >
          {showInitialSkeleton ? (
            <div className="space-y-4">
              <PageLoadingBlock />
              <PageLoadingBlock />
            </div>
          ) : (
          <>
            <MesBandejaFiltersPanel
              title="Filtros del listado"
              headerSubtitle={CLIENT_ORDER_LIST_FILTERS_SUBTITLE}
              activeFilterCount={activeFilterCount}
              onClear={clearFilters}
              criteriaRow={criteriaRow}
              searchFields={searchFields}
              hint={
                <p className="text-muted-foreground text-xs">{CLIENT_ORDER_LIST_FILTERS_HINT}</p>
              }
            />

            <InsumosBandejaTableCard>
              <Table className="w-full min-w-[760px]">
                <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
                  <TableRow className={catalogTableHeaderRowClass}>
                    <CatalogTableHead icon={ListOrdered} className="w-14">
                      N.º
                    </CatalogTableHead>
                    <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
                    <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
                    <CatalogTableHead icon={Package}>{CLIENT_ORDER_LIST_PRODUCT_COLUMN}</CatalogTableHead>
                    <CatalogTableHead icon={Scale}>{CLIENT_ORDER_LIST_QUANTITY_COLUMN}</CatalogTableHead>
                    <CatalogTableHead icon={CircleDot}>Estado</CatalogTableHead>
                    <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingTableRow colSpan={7} />
                  ) : !rows?.data.length ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="p-0">
                        <CatalogEmptyState
                          icon={hasActiveFilters ? SearchX : ScrollText}
                          title={hasActiveFilters ? "Sin resultados" : "Sin pedidos cliente (OC)"}
                          description={
                            hasActiveFilters
                              ? "Prueba otros filtros o pulsa Limpiar."
                              : "Registre el primero para vincular órdenes de producción (OT)."
                          }
                          action={hasActiveFilters ? undefined : newOrderButton}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                      rows.data.map((r, index) => {
                        const n = (rows.current_page - 1) * rows.per_page + index + 1
                        return (
                          <TableRow key={r.id} className={catalogTableBodyRowClass}>
                            <TableCell
                              className={cn(
                                "text-center tabular-nums text-muted-foreground w-14 px-2",
                                catalogTableBodyCellClass,
                              )}
                            >
                              {n}
                            </TableCell>
                            <TableCell className={cn("min-w-0 font-mono text-sm", catalogTableBodyCellClass)}>
                              <Link
                                to={`/ordenes-cliente/${r.id}`}
                                className="text-primary font-medium hover:underline underline-offset-2 break-all"
                              >
                                {r.code}
                              </Link>
                            </TableCell>
                            <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>
                              {r.client?.name ?? `#${r.client_id}`}
                            </TableCell>
                            <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="truncate">{clientOrderListProductLabel(r)}</span>
                                {clientOrderListExtraLinesCount(r) > 0 ? (
                                  <Badge variant="secondary" className="shrink-0 font-normal tabular-nums">
                                    +{clientOrderListExtraLinesCount(r)}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell
                              className={cn(
                                "min-w-0 font-mono text-sm tabular-nums whitespace-nowrap",
                                catalogTableBodyCellClass,
                              )}
                            >
                              {clientOrderListQuantityLabel(r)}
                            </TableCell>
                            <TableCell className={cn("align-middle", catalogTableBodyCellClass)}>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn("font-medium border", clientOrderStatusBadgeClass(r.status))}
                                >
                                  {clientOrderStatusLabel(r.status)}
                                </Badge>
                                {clientOrderAwaitingProductionOt(r) ? (
                                  <Badge
                                    variant="outline"
                                    className={cn("font-medium border", clientOrderAwaitingOtBadgeClass())}
                                  >
                                    {CLIENT_ORDER_AWAITING_OT_BADGE}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className={cn("text-right align-middle p-2", catalogTableBodyCellClass)}>
                              <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className={cn("shrink-0", catalogActionButtonClass)}
                                  title="Ver detalle"
                                  type="button"
                                  onClick={() => setDetailModalId(r.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">Ver detalle</span>
                                </Button>
                                {r.status === "open" ? (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className={cn("shrink-0", catalogActionButtonClass)}
                                    title="Editar"
                                    asChild
                                  >
                                    <Link to={`/ordenes-cliente/${r.id}`}>
                                      <Pencil className="h-4 w-4" />
                                      <span className="sr-only">Editar</span>
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 shrink-0 bg-muted/80 text-muted-foreground border"
                                    title="Solo se edita en estado Abierta"
                                    disabled
                                    type="button"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    <span className="sr-only">Editar</span>
                                  </Button>
                                )}
                                {r.status === "open" ? (
                                  <Button
                                    size="icon"
                                    variant="destructive"
                                    className="h-9 w-9 shrink-0 border border-destructive/30"
                                    title="Anular orden"
                                    disabled={cancellingId === r.id}
                                    onClick={() => setPendingCancelId(r.id)}
                                    type="button"
                                  >
                                    <Ban className="h-4 w-4" />
                                    <span className="sr-only">Anular</span>
                                  </Button>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 shrink-0 bg-muted/80 text-muted-foreground border"
                                    title="Solo se puede anular en estado Abierta"
                                    disabled
                                    type="button"
                                  >
                                    <Ban className="h-4 w-4" />
                                    <span className="sr-only">Anular</span>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                  )}
                </TableBody>
              </Table>
            </InsumosBandejaTableCard>

            <CatalogListPagination
              rows={rows}
              loading={loading}
              perPage={perPage}
              onPerPageChange={(v) => {
                setPerPage(v)
                setPage(1)
              }}
              onPageChange={setPage}
              selectId="co-per-page"
            />
          </>
        )}
      </CatalogPageShell>

        <Dialog
          open={detailModalId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDetailModalId(null)
              setDetailModalRecord(null)
            }
          }}
        >
          <DialogContent
            overlayClassName="z-[100] !bg-black/50 backdrop-blur-sm duration-200 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            className="z-[100] flex max-h-[min(90vh,calc(100dvh-2rem))] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:max-w-3xl"
          >
            <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-6 py-4 pr-14 text-left">
              <DialogTitle className="text-lg leading-tight">{CLIENT_ORDER_MODULE_TITLE}</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 pt-1 text-sm text-muted-foreground">
                  {detailModalLoading ? (
                    <p className="font-mono text-foreground/80">Cargando…</p>
                  ) : detailModalRecord ? (
                    <>
                      <p className="font-mono text-base font-medium text-foreground">{detailModalRecord.code}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium border",
                            clientOrderStatusBadgeClass(detailModalRecord.status),
                          )}
                        >
                          {clientOrderStatusLabel(detailModalRecord.status)}
                        </Badge>
                        {clientOrderAwaitingProductionOt({
                          status: detailModalRecord.status,
                          active_work_orders_count:
                            detailModalRecord.workOrders?.filter(
                              (w) => (w.status ?? "").toLowerCase() !== "cancelled",
                            ).length ?? 0,
                        }) ? (
                          <Badge
                            variant="outline"
                            className={cn("font-medium border", clientOrderAwaitingOtBadgeClass())}
                          >
                            {CLIENT_ORDER_AWAITING_OT_BADGE}
                          </Badge>
                        ) : null}
                        <span>
                          Cliente:{" "}
                          <span className="font-medium text-foreground">
                            {detailModalRecord.client?.name ?? `#${detailModalRecord.client_id}`}
                          </span>
                        </span>
                        {detailModalRecord.ordered_at ? (
                          <span className="text-xs">
                            Pedido: {clientOrderOrderedAtDisplay(detailModalRecord.ordered_at)}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p>No se pudo mostrar el detalle.</p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {detailModalLoading ? (
                <p className="text-muted-foreground text-sm">Obteniendo líneas y órdenes de trabajo…</p>
              ) : detailModalRecord ? (
                <Card className="shadow-sm">
                  <CardContent className="space-y-6 p-6">
                    {detailModalRecord.notes ? (
                      <section className="space-y-2">
                        <h3 className="text-base font-semibold tracking-tight">Notas</h3>
                        <p className="text-sm whitespace-pre-wrap text-foreground">{detailModalRecord.notes}</p>
                      </section>
                    ) : null}

                    <section
                      className={cn(
                        "space-y-3",
                        detailModalRecord.notes && "border-t border-border/60 pt-6",
                      )}
                    >
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold tracking-tight">
                          {CLIENT_ORDER_EDIT_LINES_SECTION_TITLE}
                        </h3>
                        <p className="text-sm text-muted-foreground">{CLIENT_ORDER_DETAIL_LINES_HELPER}</p>
                      </div>
                      {!detailModalRecord.lines?.length ? (
                        <p className="text-muted-foreground text-sm">Sin líneas en este pedido.</p>
                      ) : (
                        <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
                          <div className="min-w-[56rem] rounded-xl border border-border bg-muted/20 p-3">
                            <div
                              className={cn(
                                CLIENT_ORDER_DETAIL_LINE_GRID,
                                "border-border/60 border-b pb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                              )}
                            >
                              <span>#</span>
                              <span>{CLIENT_ORDER_LIST_PRODUCT_COLUMN}</span>
                              <span>{CLIENT_ORDER_DETAIL_LINE_CPE_COLUMN}</span>
                              <span>{CLIENT_ORDER_DETAIL_LINE_MPPS_COLUMN}</span>
                              <span>{CLIENT_ORDER_LINE_MATERIAL_LABEL}</span>
                              <span>{CLIENT_ORDER_LINE_DESCRIPTION_LABEL}</span>
                              <span>{CLIENT_ORDER_LIST_QUANTITY_COLUMN}</span>
                              <span>{CLIENT_ORDER_DETAIL_LINE_UNIT_COLUMN}</span>
                            </div>
                            <div className="divide-y divide-border/50">
                              {detailModalRecord.lines.map((ln, index) => {
                                const materialLabel = ln.material
                                  ? `${ln.material.sku} — ${ln.material.name}`
                                  : "—"
                                const description = ln.description?.trim() || "—"
                                return (
                                  <div
                                    key={ln.id}
                                    className={cn(CLIENT_ORDER_DETAIL_LINE_GRID, "py-2.5 text-sm")}
                                  >
                                    <span className="text-muted-foreground tabular-nums">{index + 1}</span>
                                    <span className="min-w-0 font-medium leading-snug text-foreground">
                                      {ln.product?.name ?? "—"}
                                    </span>
                                    <span className="font-mono text-xs tabular-nums">
                                      {ln.product?.cpe?.trim() || "—"}
                                    </span>
                                    <span className="font-mono text-xs tabular-nums">
                                      {ln.product?.mps?.trim() || "—"}
                                    </span>
                                    <span className="min-w-0 text-xs leading-snug">{materialLabel}</span>
                                    <span className="min-w-0 text-xs leading-snug text-muted-foreground">
                                      {description}
                                    </span>
                                    <span className="font-mono tabular-nums">
                                      {formatDecimalTwoDisplay(ln.quantity)}
                                    </span>
                                    <span>{ln.unit?.trim() || "—"}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="space-y-3 border-t border-border/60 pt-6">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold tracking-tight">
                          Órdenes de trabajo vinculadas
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          OT generadas o enlazadas desde este pedido; abra la vista de producción si aplica.
                        </p>
                      </div>
                      {(detailModalRecord.workOrders ?? []).length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground">{CLIENT_ORDER_DETAIL_NO_OT_LINK}</p>
                      ) : (
                        <ul className="space-y-3">
                          {(detailModalRecord.workOrders ?? []).map((w) => (
                            <li
                              key={w.id}
                              className="flex flex-col gap-2 rounded-lg bg-muted/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Código OT
                                </p>
                                <p className="mt-0.5 font-mono text-sm font-medium">{w.code}</p>
                              </div>
                              <Button variant="outline" size="sm" className="shrink-0 sm:self-center" asChild>
                                <Link to={`/ordenes-trabajo/${w.id}/produccion`}>Ver producción</Link>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Intente de nuevo o abra el detalle en página completa.
                </p>
              )}
            </div>
            <DialogFooter className="shrink-0 flex-row flex-wrap gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-end">
              {detailModalId != null && detailModalRecord ? (
                <Button variant="outline" type="button" asChild>
                  <Link to={`/ordenes-cliente/${detailModalId}`}>Abrir página completa</Link>
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => setDetailModalId(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={pendingCancelId !== null}
          onOpenChange={(open) => {
            if (!open) setPendingCancelId(null)
          }}
        >
          <DialogContent
            overlayClassName="z-[100] !bg-black/50 backdrop-blur-sm duration-200 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            className="z-[100] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:max-w-md"
          >
            <DialogHeader className="space-y-0 border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-6 py-5 pr-14 text-center sm:text-left">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:text-left">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive"
                  aria-hidden
                >
                  <Ban className="h-6 w-6" />
                </div>
                <DialogTitle className="text-center sm:text-left sm:leading-tight">
                  {CLIENT_ORDER_CANCEL_DIALOG_TITLE}
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="px-6 py-4 text-sm leading-relaxed text-muted-foreground">
              La orden quedará en estado <span className="font-medium text-foreground">Anulada</span>. Puede abrir el detalle
              cuando lo necesite.
            </DialogDescription>
            <DialogFooter className="flex flex-row items-center justify-center border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-center">
              <Button
                type="button"
                variant="destructive"
                className="min-w-[12rem]"
                onClick={() => void runCancelAnular()}
                disabled={cancellingId === pendingCancelId}
              >
                {cancellingId === pendingCancelId ? "Anulando…" : "Confirmar anulación"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  )
}
