"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Barcode,
  Boxes,
  CalendarDays,
  ListOrdered,
  Package,
  Pencil,
  Printer,
  Rows3,
  Settings2,
  Users,
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
import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 320
const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "—"
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
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

export default function ProductsPage() {
  const location = useLocation()
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ProductRecord> | null>(null)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const debounceRef = useRef<number | null>(null)
  const skipSearchPageReset = useRef(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 500, page: 1 },
        })
        if (!cancelled) setClients(res.data)
      } catch {
        if (!cancelled) setClients([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (page > 1) params.set("page", String(page))
    if (perPage !== 20) params.set("per_page", String(perPage))
    if (clientFilter !== "all") params.set("client_id", clientFilter)
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [clientFilter, location.pathname, page, perPage, search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const clientId = clientFilter !== "all" ? Number(clientFilter) : undefined
      const data = await apiFetch<LaravelPaginated<ProductRecord>>("products", {
        query: {
          q: search || undefined,
          page,
          per_page: perPage,
          client_id: clientId,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.message)
      } else {
        toast.error("No se pudo cargar la lista de productos.")
      }
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, clientFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setSearch(query.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    if (skipSearchPageReset.current) {
      skipSearchPageReset.current = false
      return
    }
    setPage(1)
  }, [search])

  const showInitialSkeleton = loading && rows === null

  const colSpan = 9

  return (
    <CatalogPageShell
      title="Productos"
      subtitle="Nombre, CPE, MPS, tipo de impresión y estructura."
      icon={Package}
      action={
        <Button type="button" asChild>
          <Link to="/productos/form" state={{ from }}>
            Nuevo producto
          </Link>
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
              id="product-q"
              placeholder="Ej. nombre, CPE, MPS…"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  const next = ev.currentTarget.value.trim()
                  setSearch((prev) => (prev === next ? prev : next))
                  setPage(1)
                }
              }}
              className="min-w-0 lg:col-span-6"
            />
            <CatalogLabeledField label="Cliente" htmlFor="product-client" className="lg:col-span-6">
              <Select
                value={clientFilter}
                onValueChange={(v) => {
                  setClientFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  id="product-client"
                  className={cn("w-full font-normal", catalogSelectTriggerClass)}
                >
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <p className="text-muted-foreground text-xs lg:col-span-12">
              El texto de búsqueda se aplica automáticamente al escribir.
            </p>
          </CatalogFilterGrid>

          <div className="bg-card w-full min-w-0 overflow-x-auto rounded-2xl border shadow-sm">
            <Table className="w-full min-w-[720px]">
              <TableHeader>
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={ListOrdered} className="w-16">
                    N.º
                  </CatalogTableHead>
                  <CatalogTableHead icon={Package}>Nombre</CatalogTableHead>
                  <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
                  <CatalogTableHead icon={Barcode}>CPE</CatalogTableHead>
                  <CatalogTableHead icon={Rows3}>M.P.P.S</CatalogTableHead>
                  <CatalogTableHead icon={Printer}>Tipo impresión</CatalogTableHead>
                  <CatalogTableHead icon={Boxes} className="min-w-[180px]">
                    Estructura
                  </CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays}>Creado</CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={colSpan} />
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-muted-foreground">
                      Sin productos.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((p, index) => {
                    const n = (rows.current_page - 1) * rows.per_page + index + 1
                    return (
                      <TableRow key={p.id} className={catalogTableBodyRowClass}>
                        <TableCell
                          className={cn(
                            "tabular-nums text-muted-foreground",
                            catalogTableBodyCellClass,
                          )}
                        >
                          {n}
                        </TableCell>
                        <TableCell className={cn("font-medium", catalogTableBodyCellClass)}>
                          {p.name}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {p.client?.name ?? "—"}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>{p.cpe ?? "—"}</TableCell>
                        <TableCell className={catalogTableBodyCellClass}>{p.mps ?? "—"}</TableCell>
                        <TableCell className={catalogTableBodyCellClass}>{p.print_type ?? "—"}</TableCell>
                        <TableCell
                          className={cn(
                            "max-w-[240px] text-sm text-muted-foreground",
                            catalogTableBodyCellClass,
                          )}
                          title={p.structure ?? undefined}
                        >
                          {truncate(p.structure, 80)}
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap", catalogTableBodyCellClass)}>
                          {formatDateDMY(p.created_at)}
                        </TableCell>
                        <TableCell className={cn("p-2 text-right", catalogTableBodyCellClass)}>
                          <Button
                            variant="outline"
                            size="icon"
                            className={catalogActionButtonClass}
                            title="Editar producto"
                            aria-label="Editar producto"
                            asChild
                          >
                            <Link to={`/productos/form?id=${p.id}`} state={{ from }}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Link>
                          </Button>
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
                      id="products-per-page"
                      className="h-8 w-[4.5rem] text-sm"
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
    </CatalogPageShell>
  )
}
