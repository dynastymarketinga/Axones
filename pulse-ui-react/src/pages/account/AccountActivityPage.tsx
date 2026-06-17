"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarDays, History, ListOrdered, User, Users } from "lucide-react"
import { toast } from "sonner"

import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogTableHead } from "@/components/axones/CatalogTableHead"
import {
  catalogMasterTablePanelClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { apiFetch, ApiError } from "@/lib/api"
import {
  formatUserAdminActorName,
  formatUserAdminEventDetail,
  formatUserAdminEventLabel,
  formatUserAdminTargetName,
} from "@/lib/user-admin-event-labels"
import type { LaravelPaginated, UserAdminEventRecord } from "@/types/api"

function formatDateDMY(value: string | null | undefined): string {
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

export default function AccountActivityPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<UserAdminEventRecord> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<UserAdminEventRecord>>("user-admin-events", {
        query: { per_page: 50 },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la actividad reciente.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const showInitialSkeleton = loading && rows === null

  return (
    <CatalogPageShell
      title="Actividad reciente"
      subtitle="Historial de cambios en cuentas, roles y contraseñas del sistema."
      icon={History}
      headerVariant="elevated"
    >
      {showInitialSkeleton ? (
        <PageLoadingBlock />
      ) : (
        <div className={catalogMasterTablePanelClass}>
          <Table className="w-full min-w-[860px]">
            <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm">
              <TableRow className={catalogTableHeaderRowClass}>
                <CatalogTableHead icon={CalendarDays}>Fecha</CatalogTableHead>
                <CatalogTableHead icon={User}>Quién</CatalogTableHead>
                <CatalogTableHead icon={History}>Acción</CatalogTableHead>
                <CatalogTableHead icon={Users}>Usuario afectado</CatalogTableHead>
                <CatalogTableHead icon={ListOrdered}>Detalle</CatalogTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingTableRow colSpan={5} />
              ) : !rows?.data.length ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className={catalogTableBodyCellClass}>
                    <p className="text-muted-foreground py-6 text-center text-sm">
                      Aún no hay eventos registrados.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.data.map((event) => (
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
      )}
    </CatalogPageShell>
  )
}
