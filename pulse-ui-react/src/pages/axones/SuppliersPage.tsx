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
  Settings2,
  Truck,
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

  const colCount = isInventory ? 5 : 8

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
      action={
        <Button type="button" asChild>
          <Link to="/proveedores/form" state={{ from }}>
            Nuevo proveedor
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
              className="min-w-0 lg:col-span-6"
            />
            <p className="text-muted-foreground text-xs lg:col-span-12">
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
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-muted-foreground">
                      Sin proveedores.
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
                          {s.name}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>{s.rif ?? "—"}</TableCell>
                        {!isInventory ? (
                          <>
                            <TableCell className={catalogTableBodyCellClass}>{s.email ?? "—"}</TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{s.phone ?? "—"}</TableCell>
                            <TableCell
                              className={cn("max-w-[200px] truncate", catalogTableBodyCellClass)}
                            >
                              {s.address ?? "—"}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell className={cn("whitespace-nowrap", catalogTableBodyCellClass)}>
                          {formatDateDMY(s.created_at)}
                        </TableCell>
                        <TableCell className={cn("p-2 text-right", catalogTableBodyCellClass)}>
                          <div className="inline-flex justify-end gap-1">
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
                      id="suppliers-per-page"
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
