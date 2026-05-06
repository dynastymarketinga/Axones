"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import {
  Barcode,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Eye,
  ListOrdered,
  Printer,
  Rows3,
  Settings2,
  ShoppingCart,
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
  catalogActionButtonClass,
  catalogSelectTriggerClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

type PurchaseOrderSheetDetail = {
  id: number
  code: string
  status: string
  supplier_id: number
  ordered_at: string | null
  created_at?: string | null
  notes: string | null
  supplier?: { id: number; name: string; rif?: string | null } | null
  lines?: Array<{
    id: number
    description?: string | null
    quantity_ordered: string | number
    quantity_received?: string | number
    unit?: string
    material?: { name?: string; sku?: string } | null
  }>
}

export default function PurchaseOrdersPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

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

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<PurchaseOrderRow> | null>(
    null,
  )
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<PurchaseOrderSheetDetail | null>(null)

  const perPage = 20

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set("page", String(page))
    if (supplierId !== "all") params.set("supplier_id", supplierId)
    if (status !== "all") params.set("status", status)
    if (qApi.trim()) params.set("q", qApi.trim())
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, status, supplierId, qApi])

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
    const next = new URLSearchParams()
    if (page > 1) next.set("page", String(page))
    if (supplierId !== "all") next.set("supplier_id", supplierId)
    if (status !== "all") next.set("status", status)
    if (qApi.trim()) next.set("q", qApi.trim())
    setSearchParams(next, { replace: true })
  }, [page, setSearchParams, status, supplierId, qApi])

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
      const data = await apiFetch<LaravelPaginated<PurchaseOrderRow>>(
        "purchase-orders",
        {
          query: {
            page,
            per_page: perPage,
            supplier_id: sid,
            status: st,
            q: qApi.trim() || undefined,
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
  }, [page, perPage, supplierId, status, qApi])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!sheetOpen || detailId == null) return
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
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sheetOpen, detailId])

  const showInitialSkeleton = loading && rows === null

  const rowStart = useMemo(() => (page - 1) * perPage, [page, perPage])

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
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            setDetailId(null)
            setDetail(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalle de orden</SheetTitle>
            <SheetDescription>
              Vista rápida de la orden de compra seleccionada.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 text-sm">
            {detailLoading ? (
              <p className="text-muted-foreground">Cargando…</p>
            ) : detail ? (
              <>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Código
                  </p>
                  <p className="font-mono font-medium">{detail.code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Proveedor
                  </p>
                  <p>{detail.supplier?.name ?? `#${detail.supplier_id}`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Estado
                  </p>
                  <p>{purchaseOrderStatusLabel(detail.status)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Fechas
                  </p>
                  <p className="text-muted-foreground">
                    Creado: {formatDateDMY(detail.created_at)}
                  </p>
                  <p className="text-muted-foreground">
                    Ordenado: {formatDateDMY(detail.ordered_at)}
                  </p>
                </div>
                {detail.notes?.trim() ? (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Notas
                    </p>
                    <p className="whitespace-pre-wrap">{detail.notes}</p>
                  </div>
                ) : null}
                {detail.lines?.length ? (
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                      Líneas ({detail.lines.length})
                    </p>
                    <ul className="space-y-2 border-t pt-2">
                      {detail.lines.map((ln) => (
                        <li key={ln.id} className="border-b pb-2 last:border-0">
                          <p className="font-medium">
                            {(ln.material?.name ?? ln.description?.trim()) ||
                              `Línea #${ln.id}`}
                          </p>
                          {ln.material?.sku ? (
                            <p className="text-muted-foreground text-xs">
                              SKU: {ln.material.sku}
                            </p>
                          ) : null}
                          <p className="text-muted-foreground text-xs">
                            Cantidad: {ln.quantity_ordered} {ln.unit ?? ""}
                            {ln.quantity_received != null &&
                            String(ln.quantity_received) !== ""
                              ? ` · Recibido: ${ln.quantity_received}`
                              : null}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Sin datos.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <CatalogFilterGrid>
            <CatalogLabeledField label="Proveedor" className="lg:col-span-3">
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
            <CatalogLabeledField label="Estado" className="lg:col-span-3">
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
              className="min-w-0 lg:col-span-6"
            />
            <p className="text-muted-foreground text-xs lg:col-span-12">
              Escribe para filtrar automáticamente por código. Parcial y Completada se calculan según las recepciones de
              inventario ligadas a cada OC.
            </p>
          </CatalogFilterGrid>

          <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={ListOrdered} className="w-16">
                    N.º
                  </CatalogTableHead>
                  <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
                  <CatalogTableHead icon={Truck}>Proveedor</CatalogTableHead>
                  <CatalogTableHead icon={CircleDot}>Estado</CatalogTableHead>
                  <CatalogTableHead icon={Rows3}>Líneas</CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays} className="whitespace-nowrap">
                    Creado
                  </CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2} className="whitespace-nowrap">
                    Acciones
                  </CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={7} />
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Sin órdenes.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((r, idx) => (
                    <TableRow key={r.id} className={catalogTableBodyRowClass}>
                      <TableCell
                        className={cn(
                          "tabular-nums text-muted-foreground",
                          catalogTableBodyCellClass,
                        )}
                      >
                        {rowStart + idx + 1}
                      </TableCell>
                      <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                        {r.code}
                      </TableCell>
                      <TableCell className={catalogTableBodyCellClass}>
                        {r.supplier?.name ?? `#${r.supplier_id}`}
                      </TableCell>
                      <TableCell className={catalogTableBodyCellClass}>
                        {purchaseOrderStatusLabel(r.status)}
                      </TableCell>
                      <TableCell className={catalogTableBodyCellClass}>
                        {r.lines_count ?? "—"}
                      </TableCell>
                      <TableCell className={cn("whitespace-nowrap", catalogTableBodyCellClass)}>
                        {formatDateDMY(r.created_at ?? r.ordered_at)}
                      </TableCell>
                      <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                        <div className="inline-flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={catalogActionButtonClass}
                            title="Vista previa imprimible"
                            asChild
                          >
                            <Link to={`/ordenes-compra/${r.id}/vista-previa`}>
                              <Printer className="h-4 w-4" />
                              <span className="sr-only">Vista previa imprimible</span>
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={catalogActionButtonClass}
                            title="Ver detalle"
                            aria-label="Ver detalle de la orden"
                            onClick={() => {
                              setDetailId(r.id)
                              setSheetOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver detalle</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {rows && rows.last_page > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Página {rows.current_page} de {rows.last_page} · {rows.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rows.current_page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rows.current_page >= rows.last_page || loading}
                  onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </CatalogPageShell>
  )
}
