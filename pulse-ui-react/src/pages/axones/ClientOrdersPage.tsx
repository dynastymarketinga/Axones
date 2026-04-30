"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Check, ChevronsUpDown, Eye, Pencil, Ban, HelpCircle } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type {
  ClientOrderRow,
  ClientRecord,
  LaravelPaginated,
} from "@/types/api"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  TableHead,
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
  clientOrderStatusBadgeClass,
  clientOrderStatusLabel,
  CLIENT_ORDER_STATUS_HELP,
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
      else toast.error("No se pudieron cargar los pedidos del cliente.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, clientId, status, awaitingOt])

  useEffect(() => {
    void load()
  }, [load])

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 w-full min-w-0 max-w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full min-w-0">
          <div className="min-w-0 flex-1 space-y-2 max-w-full">
            <h1 className="text-2xl font-semibold tracking-tight">Pedido del cliente</h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Listado de <strong className="text-foreground font-medium">pedidos del cliente</strong> — código, cliente y
              filtros.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/ordenes-cliente/nueva">Nuevo pedido del cliente</Link>
          </Button>
        </div>

        {showInitialSkeleton ? (
          <div className="space-y-4">
            <PageLoadingBlock />
            <PageLoadingBlock />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 w-full min-w-0 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="grid flex-1 min-w-0 gap-2 sm:min-w-[200px]">
            <Label htmlFor="co-q">Buscar por código de pedido</Label>
            <Input
              id="co-q"
              value={codeQuery}
              onChange={(ev) => setCodeQuery(ev.target.value)}
              placeholder="Ej. OC-CLI, prefijo, número…"
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  const next = ev.currentTarget.value.trim()
                  setSearch((prev) => (prev === next ? prev : next))
                  setPage(1)
                }
              }}
            />
          </div>
          <div className="grid w-full min-w-0 gap-1.5 sm:min-w-0 sm:max-w-xs lg:flex-1">
            <Label>Cliente</Label>
            <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientComboOpen}
                  className="h-10 w-full max-w-full justify-between font-normal px-3"
                >
                  <span className="truncate text-left">{selectedClientLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
          </div>
          <div className="grid w-full gap-1 lg:min-w-[12rem]">
            <div className="flex items-center gap-1.5">
              <Label>Estado</Label>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Ayuda estados"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3 text-left font-normal" side="top">
                  <p className="mb-2 font-medium">Estados del pedido del cliente</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    <li>
                      <strong>Abierta:</strong> el pedido sigue vigente para su flujo comercial.
                    </li>
                    <li>
                      <strong>Cumplida:</strong> se considera cerrada o entregada en lo comercial.
                    </li>
                    <li>
                      <strong>Anulada:</strong> deja de aplicar como pedido activo.
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
              <SelectTrigger>
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
          <div className="flex flex-col gap-1 pb-0.5 sm:max-w-md">
            <div className="flex items-center gap-2 min-h-9">
              <input
                type="checkbox"
                id="await-ot"
                checked={awaitingOt}
                onChange={(ev) => {
                  setAwaitingOt(ev.target.checked)
                  setPage(1)
                }}
                className="rounded border-input"
              />
              <label htmlFor="await-ot" className="font-normal text-sm leading-snug cursor-pointer">
                Solo sin orden de producción aún
              </label>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Qué significa este filtro"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3 text-left text-xs" side="top">
                  Si lo marca, verá pedidos <strong>abiertos</strong> que aún no tienen vinculado en el sistema un documento de
                  producción asociado a esta solicitud. Útil para ver qué falta por pasar a planta.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto w-full min-w-0">
          <Table className="w-full min-w-[560px] table-fixed">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="min-w-[7rem]" />
              <col className="w-28" />
              <col className="w-[8.5rem]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center tabular-nums w-12 px-2">#</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingTableRow colSpan={5} />
              ) : !rows?.data.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Sin pedidos del cliente.
                  </TableCell>
                </TableRow>
              ) : (
                rows.data.map((r, index) => {
                  const n = (rows.current_page - 1) * rows.per_page + index + 1
                  return (
                  <TableRow key={r.id}>
                    <TableCell className="text-center tabular-nums text-muted-foreground w-12 px-2">{n}</TableCell>
                    <TableCell className="min-w-0 font-mono text-sm">
                      <Link
                        to={`/ordenes-cliente/${r.id}`}
                        className="text-primary font-medium hover:underline underline-offset-2 break-all"
                      >
                        {r.code}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-0">{r.client?.name ?? `#${r.client_id}`}</TableCell>
                    <TableCell className="align-middle">
                      <Badge
                        variant="outline"
                        className={cn("font-medium border", clientOrderStatusBadgeClass(r.status))}
                      >
                        {clientOrderStatusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right align-middle p-2">
                      <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 shrink-0 bg-sky-100 text-sky-900 hover:bg-sky-200 border border-sky-300"
                          title="Ver detalle"
                          asChild
                        >
                          <Link to={`/ordenes-cliente/${r.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver</span>
                          </Link>
                        </Button>
                        {r.status === "open" ? (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 shrink-0 bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                            title="Editar"
                            asChild
                          >
                            <Link to={`/ordenes-cliente/${r.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 shrink-0 bg-muted/80 text-muted-foreground border"
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
                            variant="secondary"
                            className="h-8 w-8 shrink-0 bg-red-100 text-red-900 hover:bg-red-200 border border-red-300"
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
                            variant="secondary"
                            className="h-8 w-8 shrink-0 bg-muted/80 text-muted-foreground border"
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 text-sm">
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
                    id="co-per-page"
                    className="h-8 w-[4.5rem] text-sm"
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
                  className="h-8"
                  disabled={rows.current_page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
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
                  ¿Anular este pedido del cliente?
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogDescription className="px-6 py-4 text-sm leading-relaxed text-muted-foreground">
              El pedido quedará en estado <span className="font-medium text-foreground">Anulada</span>. Puede abrir el
              detalle de la orden cuando lo necesite.
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
      </div>
    </TooltipProvider>
  )
}
