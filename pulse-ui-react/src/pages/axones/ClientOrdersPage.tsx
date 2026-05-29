"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Ban,
  Barcode,
  Check,
  ChevronsUpDown,
  CircleDot,
  Eye,
  HelpCircle,
  ListOrdered,
  Pencil,
  ScrollText,
  Settings2,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type {
  ClientOrderDetailRecord,
  ClientOrderRow,
  ClientRecord,
  LaravelPaginated,
} from "@/types/api"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogActionButtonClass,
  catalogPaginationOutlineButtonClass,
  catalogPaginationSelectTriggerClass,
  catalogSelectTriggerClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  clientOrderAwaitingOtBadgeClass,
  clientOrderAwaitingProductionOt,
  clientOrderStatusBadgeClass,
  clientOrderStatusLabel,
  CLIENT_ORDER_AWAITING_OT_BADGE,
  CLIENT_ORDER_CANCEL_DIALOG_TITLE,
  CLIENT_ORDER_DETAIL_NO_OT_LINK,
  CLIENT_ORDER_EDIT_LINES_SECTION_TITLE,
  CLIENT_ORDER_MODULE_LIST_FOCUS,
  CLIENT_ORDER_MODULE_TITLE,
  CLIENT_ORDER_NEW_BUTTON_LABEL,
  CLIENT_ORDER_STATUS_HELP,
  CLIENT_ORDER_TOAST_LOAD_FAILED,
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

const CODE_SEARCH_DEBOUNCE_MS = 400

/** Valores de `per_page` usados en la petición (paginación en servidor). */
const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

export default function ClientOrdersPage() {
  const [codeQuery, setCodeQuery] = useState("")
  const [search, setSearch] = useState("")
  const [clientId, setClientId] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [awaitingOt, setAwaitingOt] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ClientOrderRow> | null>(null)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null)
  const [clientComboOpen, setClientComboOpen] = useState(false)
  const [detailModalId, setDetailModalId] = useState<number | null>(null)
  const [detailModalRecord, setDetailModalRecord] = useState<ClientOrderDetailRecord | null>(null)
  const [detailModalLoading, setDetailModalLoading] = useState(false)

  const selectedClientLabel = useMemo(() => {
    if (clientId === "all") return "Todos los clientes"
    const c = clients.find((x) => String(x.id) === clientId)
    if (!c) return "Cliente"
    return c.rif ? `${c.name} · ${c.rif}` : c.name
  }, [clientId, clients])

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 500, page: 1 },
        })
        if (!c) setClients(res.data)
      } catch {
        if (!c) setClients([])
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const skipSearchDrivenPageReset = useRef(true)

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = codeQuery.trim()
      setSearch((prev) => (prev === next ? prev : next))
    }, CODE_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [codeQuery])

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
      const cid = clientId !== "all" ? Number(clientId) : undefined
      const st = status !== "all" ? status : undefined
      const data = await apiFetch<LaravelPaginated<ClientOrderRow>>("client-orders", {
        query: {
          page,
          per_page: perPage,
          q: search || undefined,
          client_id: cid,
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
  }, [page, perPage, search, clientId, status, awaitingOt])

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

  const listSubtitle = "Filtros por código, cliente y estado."

  return (
    <TooltipProvider delayDuration={200}>
      <>
        <CatalogPageShell
          title={CLIENT_ORDER_MODULE_TITLE}
          subtitle={listSubtitle}
          icon={ScrollText}
          action={
            <Button asChild className="shrink-0">
              <Link to="/ordenes-cliente/nueva">{CLIENT_ORDER_NEW_BUTTON_LABEL}</Link>
            </Button>
          }
        >
          {showInitialSkeleton ? (
            <div className="space-y-4">
              <PageLoadingBlock />
              <PageLoadingBlock />
            </div>
          ) : (
            <>
              <CatalogFilterGrid>
                <CatalogSearchField
                  id="co-q"
                  label="Código (OC)"
                  placeholder="Ej. OC-CLI…"
                  value={codeQuery}
                  onChange={(ev) => setCodeQuery(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      const next = ev.currentTarget.value.trim()
                      setSearch((prev) => (prev === next ? prev : next))
                      setPage(1)
                    }
                  }}
                  className="min-w-0 md:col-span-5"
                />
                <CatalogLabeledField label="Cliente" className="min-w-0 md:col-span-4">
                  <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientComboOpen}
                        className={cn(
                          "h-11 w-full justify-between px-3 font-normal",
                          catalogSelectTriggerClass,
                        )}
                      >
                        <span className="truncate text-left">{selectedClientLabel}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[18rem] max-w-[100vw]"
                      align="start"
                      side="bottom"
                    >
                      <Command shouldFilter>
                        <CommandInput placeholder="Escriba para buscar (nombre, RIF)…" />
                        <CommandList>
                          <CommandEmpty>Ningún cliente coincide.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="todos"
                              onSelect={() => {
                                setClientId("all")
                                setPage(1)
                                setClientComboOpen(false)
                              }}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", clientId === "all" ? "opacity-100" : "opacity-0")}
                                aria-hidden
                              />
                              Todos los clientes
                            </CommandItem>
                            {clients.map((c) => {
                              const line = c.rif ? `${c.name} ${c.rif}` : c.name
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={line}
                                  onSelect={() => {
                                    setClientId(String(c.id))
                                    setPage(1)
                                    setClientComboOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      clientId === String(c.id) ? "opacity-100" : "opacity-0",
                                    )}
                                    aria-hidden
                                  />
                                  {c.rif ? `${c.name} · ${c.rif}` : c.name}
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </CatalogLabeledField>
                <div className="grid min-w-0 gap-2 md:col-span-3">
                  <div className="flex items-center gap-1.5">
                    <Label
                      htmlFor="co-status"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Estado
                    </Label>
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Ayuda estados"
                      >
                        <HelpCircle className="h-4 w-4 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-3 text-left font-normal" side="top">
                        <p className="mb-2 font-medium">Estados del pedido cliente (OC)</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                          <li>
                            <strong>Abierta:</strong> la orden sigue vigente para su flujo comercial.
                          </li>
                          <li>
                            <strong>Cumplida:</strong> se considera cerrada o entregada en lo comercial.
                          </li>
                          <li>
                            <strong>Anulada:</strong> deja de aplicar como orden activa.
                          </li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={status}
                    onValueChange={(v) => {
                      setStatus(v)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger
                      id="co-status"
                      className={cn("h-11 w-full font-normal", catalogSelectTriggerClass)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" title="Incluye abiertas, cumplidas y anuladas">
                        Todos los estados
                      </SelectItem>
                      <SelectItem value="open" title={CLIENT_ORDER_STATUS_HELP["open"]}>
                        Abierta
                      </SelectItem>
                      <SelectItem value="fulfilled" title={CLIENT_ORDER_STATUS_HELP["fulfilled"]}>
                        Cumplida
                      </SelectItem>
                      <SelectItem value="cancelled" title={CLIENT_ORDER_STATUS_HELP["cancelled"]}>
                        Anulada
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground text-xs md:col-span-12">Filtra al escribir.</p>
                <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-primary/20 bg-muted/30 px-3 py-2.5 md:col-span-12">
                  <Checkbox
                    id="await-ot"
                    checked={awaitingOt}
                    onCheckedChange={(v) => {
                      setAwaitingOt(v === true)
                      setPage(1)
                    }}
                    className="h-4 w-4 border-primary/50"
                  />
                  <label htmlFor="await-ot" className="cursor-pointer text-sm font-medium leading-snug text-foreground">
                    Solo sin orden de producción aún
                  </label>
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Qué significa este filtro"
                    >
                      <HelpCircle className="h-4 w-4 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs p-3 text-left text-xs" side="top">
                      Si lo marca, verá{" "}
                      <strong className="text-foreground">pedidos cliente (OC)</strong>{" "}
                      <strong>abiertas</strong> que aún no tienen vinculado en el sistema un documento de producción (OT)
                      asociado a esta solicitud. Útil para ver qué falta por pasar a planta.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CatalogFilterGrid>

              <div className="bg-card w-full min-w-0 overflow-x-auto rounded-2xl border shadow-sm">
                <Table className="w-full min-w-[560px]">
                  <TableHeader>
                    <TableRow className={catalogTableHeaderRowClass}>
                      <CatalogTableHead icon={ListOrdered} className="w-14">
                        N.º
                      </CatalogTableHead>
                      <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
                      <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
                      <CatalogTableHead icon={CircleDot}>Estado</CatalogTableHead>
                      <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <LoadingTableRow colSpan={5} />
                    ) : !rows?.data.length ? (
                      <TableRow className={catalogTableBodyRowClass}>
                        <TableCell
                          colSpan={5}
                          className={cn("text-muted-foreground", catalogTableBodyCellClass)}
                        >
                          Sin pedidos cliente (OC).
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
              </div>

              {rows ? (
                <div className="mt-4 flex flex-col items-center gap-3 text-center text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-left">
            <p className="text-muted-foreground min-w-0">
              {rows.total === 0
                ? "Sin resultados con los filtros actuales."
                : rows.last_page > 1
                  ? `Mostrando ${rows.from ?? 0} a ${rows.to ?? 0} de ${rows.total} · página ${rows.current_page} de ${rows.last_page}`
                  : `Mostrando ${rows.from ?? 0} a ${rows.to ?? 0} de ${rows.total} registros`}
            </p>
            <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
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
                    id="co-per-page"
                    className={cn(
                      "h-8 w-[4.5rem] text-sm",
                      catalogPaginationSelectTriggerClass,
                    )}
                    aria-label="Registros por página"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PER_PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
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
                            Pedido:{" "}
                            {new Date(detailModalRecord.ordered_at).toLocaleString("es-VE", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
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
                        <p className="text-sm text-muted-foreground">
                          Cada ítem muestra qué se pidió, con cantidad y unidad por separado.
                        </p>
                      </div>
                      {!detailModalRecord.lines?.length ? (
                        <p className="text-muted-foreground text-sm">Sin líneas en este pedido.</p>
                      ) : (
                        <ul className="space-y-4">
                          {detailModalRecord.lines.map((ln) => {
                            const label =
                              ln.product?.name ||
                              (ln.material ? `${ln.material.sku} — ${ln.material.name}` : null) ||
                              ln.description ||
                              "—"
                            return (
                              <li key={ln.id} className="space-y-3 rounded-lg bg-muted/35 px-4 py-3">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Producto / material / texto
                                  </p>
                                  <p className="mt-1 text-sm font-medium leading-snug text-foreground">{label}</p>
                                </div>
                                <dl className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Cantidad</dt>
                                    <dd className="mt-0.5 font-mono text-sm tabular-nums">{ln.quantity}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Unidad</dt>
                                    <dd className="mt-0.5 text-sm">{ln.unit ?? "—"}</dd>
                                  </div>
                                </dl>
                              </li>
                            )
                          })}
                        </ul>
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
    </TooltipProvider>
  )
}
