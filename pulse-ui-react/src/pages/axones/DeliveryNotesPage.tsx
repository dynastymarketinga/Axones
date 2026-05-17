"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  Barcode,
  CalendarDays,
  CircleDot,
  ClipboardList,
  Eye,
  Hash,
  ListOrdered,
  Settings2,
  Users,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import { LoadingTableRow } from "@/components/axones/LoadingStates"
import {
  catalogActionButtonClass,
  catalogPaginationOutlineButtonClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type NoteRow = {
  id: number
  code: string | null
  sequential_number: number | null
  status: string
  document_date: string | null
  work_order_id: number | null
  work_order?: { code: string; client?: { name: string } }
}

type StatusFilter = "all" | "draft" | "dispatched" | "cancelled"

const STATUS_TAB_DEFS: Array<{
  filter: StatusFilter
  label: string
  icon: typeof ListOrdered
  active: string
  inactive: string
  iconActive: string
  iconIdle: string
}> = [
  {
    filter: "all",
    label: "Todas",
    icon: ListOrdered,
    active: "border-primary bg-primary text-primary-foreground shadow-sm",
    inactive:
      "border-primary/25 bg-background text-foreground hover:bg-primary/8 dark:hover:bg-primary/12",
    iconActive: "text-primary-foreground",
    iconIdle: "text-primary",
  },
  {
    filter: "draft",
    label: "Borrador",
    icon: ClipboardList,
    active: "border-sky-500/50 bg-sky-500/15 text-sky-950 shadow-sm dark:text-sky-100",
    inactive:
      "border-sky-500/25 bg-background text-foreground hover:bg-sky-500/10 dark:hover:bg-sky-500/15",
    iconActive: "text-sky-700 dark:text-sky-200",
    iconIdle: "text-sky-600 dark:text-sky-400",
  },
  {
    filter: "dispatched",
    label: "Despachada",
    icon: CircleDot,
    active: "border-emerald-500/50 bg-emerald-500/15 text-emerald-950 shadow-sm dark:text-emerald-100",
    inactive:
      "border-emerald-500/25 bg-background text-foreground hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15",
    iconActive: "text-emerald-700 dark:text-emerald-200",
    iconIdle: "text-emerald-600 dark:text-emerald-400",
  },
  {
    filter: "cancelled",
    label: "Cancelada",
    icon: CircleDot,
    active: "border-rose-500/50 bg-rose-500/15 text-rose-950 shadow-sm dark:text-rose-100",
    inactive:
      "border-rose-500/25 bg-background text-foreground hover:bg-rose-500/10 dark:hover:bg-rose-500/15",
    iconActive: "text-rose-700 dark:text-rose-200",
    iconIdle: "text-rose-600 dark:text-rose-400",
  },
]

const TAB_BTN_CLASS =
  "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

function deliveryNoteStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Borrador"
    case "dispatched":
      return "Despachada"
    case "cancelled":
      return "Cancelada"
    default:
      return status
  }
}

export default function DeliveryNotesPage() {
  const [status, setStatus] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<NoteRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<NoteRow>>("delivery-notes", {
        query: {
          page,
          per_page: 20,
          status: status !== "all" ? status : undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las notas de entrega.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <CatalogPageShell
      title="Notas de entrega"
      subtitle="Listado de notas emitidas y su estado. El listado se actualiza al cambiar de pestaña."
      icon={ClipboardList}
    >
      <div
        role="tablist"
        aria-label="Filtro por estado"
        className="flex flex-wrap items-center gap-2"
      >
        {STATUS_TAB_DEFS.map(({ filter: f, label, icon: Icon, active, inactive, iconActive, iconIdle }) => {
          const isActive = status === f
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(TAB_BTN_CLASS, isActive ? active : inactive)}
              onClick={() => {
                setStatus(f)
                setPage(1)
              }}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", isActive ? iconActive : iconIdle)}
                aria-hidden
              />
              {label}
            </button>
          )
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Use Acciones para abrir la vista previa de cada nota emitida.
      </p>

      <div className="w-full min-w-0 overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={Hash}>ID</CatalogTableHead>
              <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
              <CatalogTableHead icon={ListOrdered}>Nº sec.</CatalogTableHead>
              <CatalogTableHead icon={CircleDot}>Estado</CatalogTableHead>
              <CatalogTableHead icon={CalendarDays}>Fecha doc.</CatalogTableHead>
              <CatalogTableHead icon={Barcode}>OT</CatalogTableHead>
              <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
              <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingTableRow colSpan={8} />
            ) : !rows?.data.length ? (
              <TableRow className={catalogTableBodyRowClass}>
                <TableCell
                  colSpan={8}
                  className={cn("text-muted-foreground", catalogTableBodyCellClass)}
                >
                  Sin notas para este filtro.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((n) => (
                <TableRow key={n.id} className={catalogTableBodyRowClass}>
                  <TableCell className={catalogTableBodyCellClass}>{n.id}</TableCell>
                  <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                    {n.code ?? "—"}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {n.sequential_number ?? "—"}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {deliveryNoteStatusLabel(n.status)}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {n.document_date ? String(n.document_date).slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {n.work_order?.code ?? n.work_order_id ?? "—"}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {n.work_order?.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={catalogActionButtonClass}
                      asChild
                      title="Vista previa"
                    >
                      <Link to={`/notas-entrega/${n.id}/vista-previa`}>
                        <Eye className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Vista previa</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {rows && rows.last_page > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            Página {rows.current_page} de {rows.last_page} · {rows.total} nota(s)
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={catalogPaginationOutlineButtonClass}
              disabled={rows.current_page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={catalogPaginationOutlineButtonClass}
              disabled={rows.current_page >= rows.last_page || loading}
              onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </CatalogPageShell>
  )
}
