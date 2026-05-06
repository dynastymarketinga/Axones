"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ListOrdered,
  Pencil,
  Phone,
  Settings2,
  User,
  Users,
  XCircle,
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
import type { LaravelPaginated, VendorRecord } from "@/types/api"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 320

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

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

export default function VendorsPage() {
  const location = useLocation()
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [rows, setRows] = useState<LaravelPaginated<VendorRecord> | null>(null)
  const debounceRef = useRef<number | null>(null)
  const skipSearchPageReset = useRef(true)

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (activeFilter !== "all") params.set("active", activeFilter)
    if (page > 1) params.set("page", String(page))
    if (perPage !== 20) params.set("per_page", String(perPage))
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, perPage, search, activeFilter])

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
          ...(activeFilter !== "all"
            ? { active: activeFilter === "true" ? 1 : 0 }
            : {}),
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
  }, [page, perPage, search, activeFilter])

  useEffect(() => {
    void load()
  }, [load])

  const toggleActive = useCallback(async (vendor: VendorRecord) => {
    setTogglingId(vendor.id)
    try {
      const nextActive = !vendor.active
      const updated = await apiFetch<VendorRecord>(`vendors/${vendor.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      })
      setRows((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          data: prev.data.map((v) => (v.id === vendor.id ? { ...v, ...updated } : v)),
        }
      })
      toast.success(nextActive ? "Vendedor activado." : "Vendedor desactivado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo actualizar el estado.")
    } finally {
      setTogglingId(null)
    }
  }, [])

  const showInitialSkeleton = loading && rows === null

  return (
    <CatalogPageShell
      title="Vendedores"
      subtitle="Asignación comercial por cliente."
      icon={Users}
      action={
        <Button type="button" asChild>
          <Link to="/vendedores/form" state={{ from }}>
            Nuevo vendedor
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
            <CatalogLabeledField label="Estado" className="lg:col-span-3">
              <Select
                value={activeFilter}
                onValueChange={(v) => {
                  setActiveFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Activos</SelectItem>
                  <SelectItem value="false">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
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
              className="min-w-0 lg:col-span-6"
            />
            <p className="text-muted-foreground text-xs lg:col-span-12">
              El texto de búsqueda se aplica automáticamente al escribir.
            </p>
          </CatalogFilterGrid>

          <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
            <Table className="w-full min-w-[560px]">
              <TableHeader>
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
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Sin vendedores.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((v, index) => {
                    const n = (rows.current_page - 1) * rows.per_page + index + 1
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
                          {v.name}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {v.phone_primary || v.phone_secondary || "—"}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {v.active ? "Sí" : "No"}
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap", catalogTableBodyCellClass)}>
                          {formatDateDMY(v.created_at)}
                        </TableCell>
                        <TableCell className={cn("p-2 text-right", catalogTableBodyCellClass)}>
                          <div className="inline-flex flex-wrap justify-end gap-1">
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
                      id="vendor-per-page"
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
