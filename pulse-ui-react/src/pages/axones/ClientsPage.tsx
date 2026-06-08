"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
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
  User,
  Users,
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
import { LoadingButtonLabel, LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiFetch, ApiError } from "@/lib/api"
import { catalogCountLabel } from "@/lib/catalog-count-label"
import type { ClientRecord, LaravelPaginated, VendorRecord } from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import { normalizeRole } from "@/lib/axones-roles"
import { cn } from "@/lib/utils"

const CLIENT_FORM_NAV_DELAY_MS = 180
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

type ClientDetailRecord = ClientRecord & {
  vendor?: Pick<VendorRecord, "id" | "name"> | null
}

export default function ClientsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ClientRecord> | null>(null)
  const [creatingClient, setCreatingClient] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailRowNumber, setDetailRowNumber] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<ClientDetailRecord | null>(null)
  const debounceRef = useRef<number | null>(null)
  const skipSearchPageReset = useRef(true)

  const session = getStoredUser()
  const isInventory = (() => {
    const r = normalizeRole(session?.role)
    return r === "inventory" || r === "inventario"
  })()

  const searchLabel = isInventory ? "Buscar por nombre o RIF" : "Buscar por nombre, RIF o ciudad"

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
      const data = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
        query: { q: search || undefined, page, per_page: perPage },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.message)
      } else {
        toast.error("No se pudo cargar la lista de clientes.")
      }
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
        const d = await apiFetch<ClientDetailRecord>(`clients/${detailId}`)
        if (!cancelled) setDetail(d)
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudo cargar el cliente.")
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

  const newClientButton = (
    <Button
      type="button"
      disabled={creatingClient}
      className="gap-2 shadow-sm"
      onClick={() => {
        if (creatingClient) return
        setCreatingClient(true)
        window.setTimeout(() => {
          navigate("/clientes/form", { state: { from } })
        }, CLIENT_FORM_NAV_DELAY_MS)
      }}
    >
      {!creatingClient ? <Plus className="h-4 w-4" aria-hidden /> : null}
      <LoadingButtonLabel loading={creatingClient} loadingText="Abriendo..." idleText="Nuevo cliente" />
    </Button>
  )

  const vendorLabel =
    detail && !detailLoading
      ? detail.vendor?.name?.trim() ||
        (typeof detail.vendor_id === "number" && detail.vendor_id > 0
          ? `Vendedor #${detail.vendor_id}`
          : "—")
      : "—"

  const detailFields =
    detail && !detailLoading
      ? [
          {
            label: "N.º",
            value: detailRowNumber ?? "—",
            mono: true,
            icon: ListOrdered,
          },
          { label: "Nombre", value: detail.name, icon: User },
          { label: "RIF", value: detail.rif?.trim() || "—", mono: true, icon: Barcode },
          ...(!isInventory
            ? [
                { label: "Estado", value: detail.state?.trim() || "—", icon: MapPin },
                { label: "Ciudad", value: detail.city?.trim() || "—", icon: MapPin },
                { label: "Vendedor", value: vendorLabel, icon: Users },
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
      title="Clientes"
      subtitle="Catálogo de clientes del sistema."
      icon={Users}
      headerVariant="elevated"
      statBadge={
        rows && !loading ? (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {catalogCountLabel(totalCount, "cliente", "clientes")}
          </Badge>
        ) : null
      }
      action={newClientButton}
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
            title="Detalle del cliente"
            description="Información completa del registro seleccionado."
            loading={detailLoading}
            fields={detailFields}
            footer={
              detailId != null ? (
                <Button type="button" variant="outline" asChild>
                  <Link to={`/clientes/form?id=${detailId}`} state={{ from }}>
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
                id="client-q"
                label={searchLabel}
                placeholder={isInventory ? "Ej. nombre, RIF…" : "Ej. nombre, RIF, ciudad…"}
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
                  <CatalogTableHead icon={User}>Nombre</CatalogTableHead>
                  <CatalogTableHead icon={Barcode}>RIF</CatalogTableHead>
                  {!isInventory ? (
                    <>
                      <CatalogTableHead icon={MapPin}>Estado / Ciudad</CatalogTableHead>
                      <CatalogTableHead icon={Mail}>Correo</CatalogTableHead>
                      <CatalogTableHead icon={Phone}>Teléfono</CatalogTableHead>
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
                        icon={hasActiveFilters ? SearchX : Users}
                        title={hasActiveFilters ? "Sin resultados" : "Sin clientes"}
                        description={
                          hasActiveFilters
                            ? "Prueba otro término de búsqueda."
                            : "Crea el primero para gestionar pedidos y órdenes de trabajo."
                        }
                        action={hasActiveFilters ? undefined : newClientButton}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((c, index) => {
                    const n = (rows.current_page - 1) * rows.per_page + index + 1
                    return (
                      <TableRow key={c.id} className={catalogTableBodyRowClass}>
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
                            {c.name}
                          </span>
                        </TableCell>
                        <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                          {c.rif ?? "—"}
                        </TableCell>
                        {!isInventory ? (
                          <>
                            <TableCell className={catalogTableBodyCellClass}>
                              {[c.state, c.city].filter(Boolean).join(", ") || "—"}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>
                              {c.email ? (
                                <span className="inline-flex items-center gap-1.5 text-sm">
                                  <Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                                  <span className="truncate">{c.email}</span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell
                              className={cn("max-w-[11rem]", catalogTableBodyCellClass)}
                              title={c.phone ?? undefined}
                            >
                              {c.phone ? (
                                <span className="inline-flex items-center gap-1.5 tabular-nums text-sm">
                                  <Phone className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                                  <span className="truncate">{c.phone}</span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell className={cn("whitespace-nowrap", catalogTableBodyCellClass)}>
                          {formatDateDMY(c.created_at)}
                        </TableCell>
                        <TableCell className={cn("p-2 text-right", catalogTableBodyCellClass)}>
                          <div className={catalogRowActionsClass}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className={catalogActionButtonClass}
                              title="Ver detalle"
                              aria-label="Ver detalle del cliente"
                              onClick={() => {
                                setDetailRowNumber(n)
                                setDetailId(c.id)
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
                              title="Editar cliente"
                              aria-label="Editar cliente"
                              asChild
                            >
                              <Link to={`/clientes/form?id=${c.id}`} state={{ from }}>
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
            selectId="clients-per-page"
          />
        </>
      )}
    </CatalogPageShell>
  )
}
