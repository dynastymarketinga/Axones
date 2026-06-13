"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import {
  AtSign,
  Ban,
  CalendarDays,
  ChevronDown,
  CircleDot,
  History,
  ListOrdered,
  Mail,
  Pencil,
  Plus,
  SearchX,
  Settings2,
  Shield,
  User,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogActiveStatusBadge } from "@/components/axones/CatalogActiveStatusBadge"
import { CatalogEmptyState } from "@/components/axones/CatalogEmptyState"
import { CatalogFilterPanel } from "@/components/axones/CatalogFilterPanel"
import { CatalogListPagination } from "@/components/axones/CatalogListPagination"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import { CatalogTableHead, CatalogTableHeadRight } from "@/components/axones/CatalogTableHead"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { catalogCountLabel } from "@/lib/catalog-count-label"
import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import { formatAxonesRoleLabel } from "@/lib/axones-role-labels"
import {
  formatUserAdminActorName,
  formatUserAdminEventDetail,
  formatUserAdminEventLabel,
  formatUserAdminTargetName,
} from "@/lib/user-admin-event-labels"
import type { LaravelPaginated, UserAdminEventRecord, UserRecord } from "@/types/api"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 320
const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

type ViewTab = "active" | "inactive"

function parseViewTab(raw: string | null): ViewTab {
  return raw === "inactive" ? "inactive" : "active"
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

function userCountLabel(total: number): string {
  return catalogCountLabel(total, "usuario", "usuarios")
}

export default function UsersPage() {
  const location = useLocation()
  const session = getStoredUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get("q")?.trim() ?? "")
  const [search, setSearch] = useState(() => searchParams.get("q")?.trim() ?? "")
  const [viewTab, setViewTab] = useState<ViewTab>(() => parseViewTab(searchParams.get("tab")))
  const [page, setPage] = useState(() => {
    const raw = searchParams.get("page")
    const n = raw ? Number(raw) : 1
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
  })
  const [perPage, setPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [rows, setRows] = useState<LaravelPaginated<UserRecord> | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditRows, setAuditRows] = useState<LaravelPaginated<UserAdminEventRecord> | null>(null)
  const debounceRef = useRef<number | null>(null)

  const from = location.pathname + location.search
  const isInactiveTab = viewTab === "inactive"
  const hasSearch = search.trim() !== ""

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    const next = new URLSearchParams()
    if (search) next.set("q", search)
    if (viewTab === "inactive") next.set("tab", "inactive")
    if (page > 1) next.set("page", String(page))
    setSearchParams(next, { replace: true })
  }, [search, viewTab, page, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<UserRecord>>("users", {
        query: {
          page,
          per_page: perPage,
          q: search || undefined,
          active: isInactiveTab ? "false" : "true",
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar usuarios.")
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, isInactiveTab])

  useEffect(() => {
    void load()
  }, [load])

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<UserAdminEventRecord>>("user-admin-events", {
        query: { per_page: 50 },
      })
      setAuditRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la actividad reciente.")
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    if (auditOpen && auditRows === null) {
      void loadAudit()
    }
  }, [auditOpen, auditRows, loadAudit])

  const toggleActive = useCallback(
    async (user: UserRecord) => {
      if (session?.id === user.id && user.active) {
        toast.error("No puede desactivar su propia cuenta.")
        return
      }
      setTogglingId(user.id)
      try {
        const nextActive = !user.active
        await apiFetch<UserRecord>(`users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive }),
        })
        if (nextActive) {
          setViewTab("active")
          setPage(1)
        toast.success("Usuario activado.")
        void loadAudit()
      } else {
        setViewTab("inactive")
        setPage(1)
        toast.success("Usuario desactivado. Ya no podrá iniciar sesión.")
        void loadAudit()
        }
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo actualizar el estado.")
      } finally {
        setTogglingId(null)
      }
    },
    [session?.id, loadAudit],
  )

  const emptyState = useMemo(() => {
    if (hasSearch) {
      return {
        icon: SearchX,
        title: "Sin resultados",
        description: "Prueba otro término de búsqueda.",
      }
    }
    if (isInactiveTab) {
      return {
        icon: Ban,
        title: "Sin usuarios desactivados",
        description: "Las cuentas retiradas del acceso aparecerán aquí.",
      }
    }
    return {
      icon: Users,
      title: "Sin usuarios",
      description: "Crea cuentas para el personal de planta.",
    }
  }, [hasSearch, isInactiveTab])

  const newUserButton = (
    <Button type="button" asChild className="gap-2 shadow-sm">
      <Link to="/account/users/form" state={{ from }}>
        <Plus className="h-4 w-4" aria-hidden />
        Nuevo usuario
      </Link>
    </Button>
  )

  const totalCount = rows?.total ?? 0
  const showInitialSkeleton = loading && rows === null

  return (
    <CatalogPageShell
      title="Usuarios"
      subtitle="Gestiona cuentas, roles y acceso al sistema. Desactivar retira el login sin borrar historial."
      icon={Users}
      headerVariant="elevated"
      statBadge={
        rows && !loading ? (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {userCountLabel(totalCount)}
          </Badge>
        ) : null
      }
      action={newUserButton}
    >
      {showInitialSkeleton ? (
        <PageLoadingBlock />
      ) : (
        <>
          <Tabs
            value={viewTab}
            onValueChange={(value) => {
              setViewTab(parseViewTab(value))
              setPage(1)
            }}
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
                Busca por nombre, correo, usuario o rol
              </p>
            }
          >
            <CatalogSearchField
              id="user-q"
              placeholder="Ej. inventario, @axones.local…"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  const next = ev.currentTarget.value.trim()
                  setSearch((prev) => (prev === next ? prev : next))
                  setPage(1)
                }
              }}
            />
          </CatalogFilterPanel>

          <div className={catalogMasterTablePanelClass}>
            <Table className="w-full min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={ListOrdered} className="w-16">
                    N.º
                  </CatalogTableHead>
                  <CatalogTableHead icon={User}>Nombre</CatalogTableHead>
                  <CatalogTableHead icon={Mail}>Correo</CatalogTableHead>
                  <CatalogTableHead icon={AtSign}>Usuario</CatalogTableHead>
                  <CatalogTableHead icon={Shield}>Rol</CatalogTableHead>
                  <CatalogTableHead icon={CircleDot}>Activo</CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays}>Creado</CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={8} />
                ) : !rows?.data.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-0">
                      <CatalogEmptyState
                        icon={emptyState.icon}
                        title={emptyState.title}
                        description={emptyState.description}
                        action={hasSearch || isInactiveTab ? undefined : newUserButton}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((u, index) => {
                    const n = (rows.current_page - 1) * rows.per_page + index + 1
                    const isSelf = session?.id === u.id

                    return (
                      <TableRow key={u.id} className={catalogTableBodyRowClass}>
                        <TableCell className={catalogTableBodyCellClass}>{n}</TableCell>
                        <TableCell className={catalogTableBodyCellClass}>{u.name}</TableCell>
                        <TableCell className={catalogTableBodyCellClass}>{u.email}</TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {u.username ?? "—"}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          <Badge variant="secondary" className="font-normal">
                            {formatAxonesRoleLabel(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          <CatalogActiveStatusBadge active={u.active} />
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {formatDateDMY(u.created_at)}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          <div className={catalogRowActionsClass}>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className={catalogActionButtonClass}
                              title="Editar usuario"
                              asChild
                            >
                              <Link to={`/account/users/form?id=${u.id}`} state={{ from }}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className={catalogActionButtonClass}
                              disabled={togglingId === u.id || (isSelf && u.active)}
                              title={
                                isSelf && u.active
                                  ? "No puede desactivar su propia cuenta"
                                  : u.active
                                    ? "Desactivar usuario"
                                    : "Activar usuario"
                              }
                              onClick={() => void toggleActive(u)}
                            >
                              {u.active ? (
                                <Ban className="h-4 w-4" />
                              ) : (
                                <CircleDot className="h-4 w-4" />
                              )}
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

          {rows && rows.total > 0 ? (
            <CatalogListPagination
              rows={rows}
              loading={loading}
              perPage={perPage}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n)
                setPage(1)
              }}
              selectId="user-per-page"
            />
          ) : null}

          <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
            <div className={catalogMasterTablePanelClass}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 h-auto font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" aria-hidden />
                    Actividad reciente
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      auditOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/60 px-2 pb-2 pt-1">
                  <Table className="w-full min-w-[860px]">
                    <TableHeader>
                      <TableRow className={catalogTableHeaderRowClass}>
                        <CatalogTableHead icon={CalendarDays}>Fecha</CatalogTableHead>
                        <CatalogTableHead icon={User}>Quién</CatalogTableHead>
                        <CatalogTableHead icon={History}>Acción</CatalogTableHead>
                        <CatalogTableHead icon={Users}>Usuario afectado</CatalogTableHead>
                        <CatalogTableHead icon={ListOrdered}>Detalle</CatalogTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLoading ? (
                        <LoadingTableRow colSpan={5} />
                      ) : !auditRows?.data.length ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className={catalogTableBodyCellClass}>
                            <p className="text-muted-foreground py-6 text-center text-sm">
                              Aún no hay eventos registrados.
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditRows.data.map((event) => (
                          <TableRow key={event.id} className={catalogTableBodyRowClass}>
                            <TableCell className={catalogTableBodyCellClass}>
                              {formatDateDMY(event.created_at)}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>
                              {formatUserAdminActorName(event.actor)}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>
                              {formatUserAdminEventLabel(event.event_type)}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>
                              {formatUserAdminTargetName(event.target)}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>
                              {formatUserAdminEventDetail(event.event_type, event.metadata)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </>
      )}
    </CatalogPageShell>
  )
}
