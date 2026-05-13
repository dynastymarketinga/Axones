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
  Settings2,
  User,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { EntityDetailDialog } from "@/components/axones/EntityDetailDialog"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
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
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingButtonLabel, LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
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

  const colCount = isInventory ? 5 : 8

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
      action={
        <Button
          type="button"
          disabled={creatingClient}
          onClick={() => {
            if (creatingClient) return
            setCreatingClient(true)
            window.setTimeout(() => {
              navigate("/clientes/form", { state: { from } })
            }, CLIENT_FORM_NAV_DELAY_MS)
          }}
        >
          <LoadingButtonLabel loading={creatingClient} loadingText="Abriendo..." idleText="Nuevo cliente" />
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
              className="min-w-0 md:col-span-6"
            />
            <p className="text-muted-foreground text-xs md:col-span-12">
              El filtro se aplica automáticamente al escribir.
            </p>
          </CatalogFilterGrid>

          <div className="bg-card w-full min-w-0 overflow-x-auto rounded-2xl border shadow-sm">
            <Table className={cn(!isInventory && "min-w-[720px]")}>
              <TableHeader>
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
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-muted-foreground">
                      Sin clientes.
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
                          {c.name}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>{c.rif ?? "—"}</TableCell>
                        {!isInventory ? (
                          <>
                            <TableCell className={catalogTableBodyCellClass}>
                              {[c.state, c.city].filter(Boolean).join(", ") || "—"}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{c.email ?? "—"}</TableCell>
                            <TableCell
                              className={cn("max-w-[11rem]", catalogTableBodyCellClass)}
                              title={c.phone ?? undefined}
                            >
                              <span className="block truncate">{c.phone ?? "—"}</span>
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell className={cn("whitespace-nowrap", catalogTableBodyCellClass)}>
                          {formatDateDMY(c.created_at)}
                        </TableCell>
                        <TableCell className={cn("p-2 text-right", catalogTableBodyCellClass)}>
                          <div className="inline-flex justify-end gap-1">
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
                      id="clients-per-page"
                      className={cn(
                        "h-8 w-[4.5rem] text-sm",
                        catalogPaginationSelectTriggerClass,
                      )}
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
  )
}
