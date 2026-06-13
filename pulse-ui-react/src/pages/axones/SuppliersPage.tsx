"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Barcode,
  CalendarDays,
  Eye,
  ListOrdered,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  SearchX,
  Settings2,
  Truck,
} from "lucide-react"
import { toast } from "sonner"

import { EntityDetailDialog } from "@/components/axones/EntityDetailDialog"
import { CatalogEmptyState } from "@/components/axones/CatalogEmptyState"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch, ApiError } from "@/lib/api"
import { catalogCountLabel } from "@/lib/catalog-count-label"
import type { LaravelPaginated, SupplierRecord } from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import { normalizeRole } from "@/lib/axones-roles"
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

export default function SuppliersPage() {
  const location = useLocation()
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<SupplierRecord> | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailRowNumber, setDetailRowNumber] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<SupplierRecord | null>(null)
  const debounceRef = useRef<number | null>(null)
  const skipSearchPageReset = useRef(true)

  const session = getStoredUser()
  const isInventory = (() => {
    const r = normalizeRole(session?.role)
    return r === "inventory" || r === "inventario"
  })()

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (page > 1) params.set("page", String(page))
    if (perPage !== 20) params.set("per_page", String(perPage))
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, perPage, search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
        query: { q: search || undefined, page, per_page: perPage },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar proveedores.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search])

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

  useEffect(() => {
    if (!detailOpen || detailId == null) return
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    void (async () => {
      try {
        const d = await apiFetch<SupplierRecord>(`suppliers/${detailId}`)
        if (!cancelled) setDetail(d)
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudo cargar el proveedor.")
          setDetailOpen(false)
          setDetailId(null)
          setDetailRowNumber(null)
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
  const hasActiveFilters = search.trim() !== ""
  const totalCount = rows?.total ?? 0
  const colCount = isInventory ? 5 : 8

  const newSupplierButton = (
    <Button type="button" asChild className="gap-2 shadow-sm">
      <Link to="/proveedores/form" state={{ from }}>
        <Plus className="h-4 w-4" aria-hidden />
        Nuevo proveedor
      </Link>
    </Button>
  )

  const detailFields =
    detail && !detailLoading
      ? [
          {
            label: "N.º",
            value: detailRowNumber ?? "—",
            mono: true,
            icon: ListOrdered,
          },
          { label: "Nombre", value: detail.name, icon: Truck },
          { label: "RIF", value: detail.rif?.trim() || "—", mono: true, icon: Barcode },
          ...(!isInventory
            ? [
                { label: "Correo", value: detail.email?.trim() || "—", icon: Mail },
                { label: "Teléfono", value: detail.phone?.trim() || "—", icon: Phone },
                {
                  label: "Dirección",
                  value: detail.address?.trim() || "—",
                  full: true as const,
                  icon: MapPin,
                },
              ]
            : []),
          { label: "Creado", value: formatDateTime(detail.created_at), icon: CalendarDays },
          { label: "Actualizado", value: formatDateTime(detail.updated_at), icon: CalendarDays },
        ]
      : []

  return (
    <CatalogPageShell
      title="Proveedores"
      subtitle="Proveedores usados en compras y órdenes de compra."
      icon={Truck}
      headerVariant="elevated"
      statBadge={
        rows && !loading ? (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {catalogCountLabel(totalCount, "proveedor", "proveedores")}
          </Badge>
        ) : null
      }
      action={newSupplierButton}
    >
      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <EntityDetailDialog
            open={detailOpen}
            onOpenChange={(open) => {
              setDetailOpen(open)
              if (!open) {
                setDetailId(null)
                setDetailRowNumber(null)
                setDetail(null)
              }
            }}
            title="Detalle del proveedor"
            description="Información completa del registro seleccionado."
            loading={detailLoading}
            fields={detailFields}
            footer={
              detailId != null ? (
                <Button type="button" variant="outline" asChild>
                  <Link to={`/proveedores/form?id=${detailId}`} state={{ from }}>
                    Editar
                  </Link>
                </Button>
              ) : null
            }
          />

          <CatalogFilterPanel
            hint={
              <p className="text-muted-foreground text-xs">
                Búsqueda automática al escribir · Enter fuerza la búsqueda inmediata
              </p>
            }
          >
            <CatalogFilterGrid>
              <CatalogSearchField
                id="sup-q"
                label="Buscar por nombre o RIF"
                placeholder="Ej. razón social, RIF…"
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    const next = ev.currentTarget.value.trim()
                    setSearch((prev) => (prev === next ? prev : next))
                    setPage(1)
                  }
                }}
                className="min-w-0 md:col-span-12"
              />
            </CatalogFilterGrid>
          </CatalogFilterPanel>

          <div className={cn(catalogMasterTablePanelClass, "w-full min-w-0")}>
            <Table className={cn(!isInventory && "min-w-[720px]")}>
              <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={ListOrdered} className="w-16">
                    N.º
                  </CatalogTableHead>
                  <CatalogTableHead icon={Truck}>Nombre</CatalogTableHead>
                  <CatalogTableHead icon={Barcode}>RIF</CatalogTableHead>
                  {!isInventory ? (
                    <>
                      <CatalogTableHead icon={Mail}>Correo</CatalogTableHead>
                      <CatalogTableHead icon={Phone}>Teléfono</CatalogTableHead>
                      <CatalogTableHead icon={MapPin}>Dirección</CatalogTableHead>
                    </>
                  ) : null}
                  <CatalogTableHead icon={CalendarDays}>Creado</CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={colCount} />
                ) : !rows?.data.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={colCount} className="p-0">
                      <CatalogEmptyState
                        icon={hasActiveFilters ? SearchX : Truck}
                        title={hasActiveFilters ? "Sin resultados" : "Sin proveedores"}
                        description={
                          hasActiveFilters
                            ? "Prueba otro término de búsqueda."
                            : "Registra proveedores para usar en compras y órdenes de compra."
                        }
                        action={hasActiveFilters ? undefined : newSupplierButton}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((s, index) => {
                    const n = (rows.current_page - 1) * rows.per_page + index + 1
                    return (
                      <TableRow key={s.id} className={catalogTableBodyRowClass}>
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
                              <Truck className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            {s.name}
                          </span>
                        </TableCell>
                        <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                          {s.rif ?? "—"}
                        </TableCell>
                        {!isInventory ? (
                          <>
                            <TableCell className={catalogTableBodyCellClass}>
                              {s.email ? (
                                <span className="inline-flex items-center gap-1.5 text-sm">
                                  <Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                                  <span className="truncate">{s.email}</span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>
                              {s.phone ? (
                                <span className="inline-flex items-center gap-1.5 tabular-nums text-sm">
                                  <Phone className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                                  {s.phone}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell
                              className={cn("max-w-[200px] truncate", catalogTableBodyCellClass)}
                              title={s.address ?? undefined}
                            >
                              {s.address ?? "—"}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell className={cn("whitespace-nowrap tabular-nums", catalogTableBodyCellClass)}>
                          {formatDateDMY(s.created_at)}
                        </TableCell>
                        <TableCell className={cn("p-2 text-right", catalogTableBodyCellClass)}>
                          <div className={catalogRowActionsClass}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className={catalogActionButtonClass}
                              title="Ver detalle"
                              aria-label="Ver detalle del proveedor"
                              onClick={() => {
                                setDetailRowNumber(n)
                                setDetailId(s.id)
                                setDetailOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Ver detalle</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className={catalogActionButtonClass}
                              title="Editar proveedor"
                              aria-label="Editar proveedor"
                              asChild
                            >
                              <Link to={`/proveedores/form?id=${s.id}`} state={{ from }}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Editar</span>
                              </Link>
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
            selectId="suppliers-per-page"
          />
        </>
      )}
    </CatalogPageShell>
  )
}
