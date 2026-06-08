"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ListOrdered,
  Pencil,
  Phone,
  Plus,
  SearchX,
  Settings2,
  User,
  Users,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogActiveStatusBadge } from "@/components/axones/CatalogActiveStatusBadge"
import { CatalogEmptyState } from "@/components/axones/CatalogEmptyState"
import { CatalogFilterPanel } from "@/components/axones/CatalogFilterPanel"
import { CatalogListPagination } from "@/components/axones/CatalogListPagination"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogActionButtonClass,
  catalogMasterTablePanelClass,
  catalogRowActionsClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { catalogCountLabel } from "@/lib/catalog-count-label"
import { apiFetch, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, VendorRecord } from "@/types/api"

const SEARCH_DEBOUNCE_MS = 320

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

type ViewTab = "active" | "inactive"

function parseViewTab(raw: string | null): ViewTab {
  if (raw === "inactive") return "inactive"
  return "active"
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

function vendorCountLabel(total: number): string {
  return catalogCountLabel(total, "vendedor", "vendedores")
}

function vendorEmptyState(viewTab: ViewTab, hasSearch: boolean) {
  if (hasSearch) {
    return {
      icon: SearchX,
      title: "Sin resultados",
      description: "Prueba otro término de búsqueda.",
    }
  }
  if (viewTab === "inactive") {
    return {
      icon: Ban,
      title: "Sin vendedores desactivados",
      description: "Los vendedores retirados del listado operativo aparecerán aquí.",
    }
  }
  return {
    icon: Users,
    title: "Sin vendedores",
    description: "Crea el primero para asignarlo a tus clientes comerciales.",
  }
}

export default function VendorsPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get("q")?.trim() ?? "")
  const [search, setSearch] = useState(() => searchParams.get("q")?.trim() ?? "")
  const [viewTab, setViewTab] = useState<ViewTab>(() => parseViewTab(searchParams.get("tab")))
  const [page, setPage] = useState(() => {
    const raw = searchParams.get("page")
    const n = raw ? Number(raw) : 1
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
  })
  const [perPage, setPerPage] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [rows, setRows] = useState<LaravelPaginated<VendorRecord> | null>(null)
  const debounceRef = useRef<number | null>(null)
  const skipSearchPageReset = useRef(true)

  const isInactiveTab = viewTab === "inactive"

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (isInactiveTab) params.set("tab", "inactive")
    if (page > 1) params.set("page", String(page))
    if (perPage !== 20) params.set("per_page", String(perPage))
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, perPage, search, isInactiveTab])

  useEffect(() => {
    const next = new URLSearchParams()
    if (search.trim()) next.set("q", search.trim())
    if (isInactiveTab) next.set("tab", "inactive")
    if (page > 1) next.set("page", String(page))
    if (perPage !== 20) next.set("per_page", String(perPage))
    setSearchParams(next, { replace: true })
  }, [page, perPage, search, isInactiveTab, setSearchParams])

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<VendorRecord>>("vendors", {
        query: {
          q: search || undefined,
          page,
          per_page: perPage,
          active: isInactiveTab ? 0 : 1,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar vendedores.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, isInactiveTab])

  useEffect(() => {
    void load()
  }, [load])

  const toggleActive = useCallback(async (vendor: VendorRecord) => {
    setTogglingId(vendor.id)
    try {
      const nextActive = !vendor.active
      await apiFetch<VendorRecord>(`vendors/${vendor.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      })
      if (nextActive) {
        setViewTab("active")
        setPage(1)
        toast.success("Vendedor activado.")
      } else {
        setViewTab("inactive")
        setPage(1)
        toast.success("Vendedor desactivado. Consulte la pestaña Desactivados.")
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo actualizar el estado.")
    } finally {
      setTogglingId(null)
    }
  }, [])

  const showInitialSkeleton = loading && rows === null
  const hasSearch = search.trim() !== ""
  const totalCount = rows?.total ?? 0
  const emptyState = vendorEmptyState(viewTab, hasSearch)
  const newVendorButton = (
    <Button type="button" asChild className="gap-2 shadow-sm">
      <Link to="/vendedores/form" state={{ from }}>
        <Plus className="h-4 w-4" aria-hidden />
        Nuevo vendedor
      </Link>
    </Button>
  )

  return (
    <CatalogPageShell
      title="Vendedores"
      subtitle="Asignación comercial por cliente."
      icon={Users}
      headerVariant="elevated"
      statBadge={
        rows && !loading ? (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {vendorCountLabel(totalCount)}
          </Badge>
        ) : null
      }
      action={newVendorButton}
    >
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
            }}
            className="w-full"
          >
            <TabsList className="inline-flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-primary/15 bg-primary/5 p-1 sm:w-auto">
              <TabsTrigger
                value="active"
                className="text-xs data-[state=active]:border data-[state=active]:border-primary/20 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm sm:text-sm"
              >
                Activos
              </TabsTrigger>
              <TabsTrigger
                value="inactive"
                className="text-xs data-[state=active]:border data-[state=active]:border-primary/20 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm sm:text-sm"
              >
                Desactivados
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <CatalogFilterPanel
            hint={
              <p className="text-muted-foreground text-xs">
                Búsqueda automática al escribir · Enter fuerza la búsqueda inmediata
              </p>
            }
          >
            <CatalogSearchField
              id="vendor-q"
              placeholder="Ej. nombre, teléfono…"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  const next = ev.currentTarget.value.trim()
                  setSearch((prev) => (prev === next ? prev : next))
                  setPage(1)
                }
              }}
              className="min-w-0"
            />
          </CatalogFilterPanel>

          <div className={catalogMasterTablePanelClass}>
            <Table className="w-full min-w-[560px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={ListOrdered} className="w-16">
                    N.º
                  </CatalogTableHead>
                  <CatalogTableHead icon={User}>Nombre</CatalogTableHead>
                  <CatalogTableHead icon={Phone}>Teléfono</CatalogTableHead>
                  <CatalogTableHead icon={CircleDot}>Activo</CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays}>Creado</CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={6} />
                ) : !rows?.data.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="p-0">
                      <CatalogEmptyState
                        icon={emptyState.icon}
                        title={emptyState.title}
                        description={emptyState.description}
                        action={
                          hasSearch || isInactiveTab ? undefined : newVendorButton
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((v, index) => {
                    const n = (rows.current_page - 1) * rows.per_page + index + 1
                    const phone = v.phone_primary || v.phone_secondary

                    return (
                      <TableRow key={v.id} className={catalogTableBodyRowClass}>
                        <TableCell
                          className={cn(
                            "tabular-nums text-muted-foreground",
                            catalogTableBodyCellClass,
                          )}
                        >
                          {n}
                        </TableCell>
                        <TableCell className={cn("font-medium", catalogTableBodyCellClass)}>
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <User className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            {v.name}
                          </span>
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {phone ? (
                            <span className="inline-flex items-center gap-1.5 tabular-nums text-sm">
                              <Phone className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                              {phone}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          <CatalogActiveStatusBadge active={v.active} />
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap tabular-nums", catalogTableBodyCellClass)}>
                          {formatDateDMY(v.created_at)}
                        </TableCell>
                        <TableCell className={cn("p-2 text-right", catalogTableBodyCellClass)}>
                          <div className={catalogRowActionsClass}>
                            <Button
                              variant="outline"
                              size="icon"
                              className={catalogActionButtonClass}
                              asChild
                              title="Editar vendedor"
                              aria-label="Editar vendedor"
                            >
                              <Link to={`/vendedores/form?id=${v.id}`} state={{ from }}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Editar</span>
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className={cn(
                                "h-9 w-9",
                                v.active
                                  ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200",
                              )}
                              disabled={togglingId === v.id}
                              onClick={() => void toggleActive(v)}
                              title={v.active ? "Desactivar vendedor" : "Activar vendedor"}
                              aria-label={v.active ? "Desactivar vendedor" : "Activar vendedor"}
                            >
                              {v.active ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {togglingId === v.id
                                  ? "Procesando"
                                  : v.active
                                    ? "Desactivar"
                                    : "Activar"}
                              </span>
                            </Button>
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
            selectId="vendor-per-page"
          />
        </>
      )}
    </CatalogPageShell>
  )
}
