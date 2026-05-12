"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRequestRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"

function materialRequestStatusLabel(status: string): string {
  const m: Record<string, string> = {
    pending: "Pendiente",
    partial: "Recibido parcial",
    dispatched: "Recibido",
    cancelled: "Cancelada",
  }
  return m[status] ?? status
}

function materialRequestStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-300/80 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-50"
    case "partial":
      return "border-teal-300/80 bg-teal-100 text-teal-950 shadow-sm dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-50"
    case "dispatched":
      return "border-emerald-300/80 bg-emerald-100 text-emerald-950 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-50"
    case "cancelled":
      return "border-border bg-muted text-muted-foreground"
    default:
      return "border-border bg-secondary text-secondary-foreground"
  }
}

function formatMaterialSummary(r: MaterialRequestRow): string {
  const lines = r.lines
  if (!lines?.length) {
    const n = r.lines_count
    return n != null && n > 0 ? `${n} ${n === 1 ? "línea" : "líneas"}` : "—"
  }
  const parts = lines.map((ln) => {
    if (ln.material) {
      return `${ln.material.sku} · ${ln.material.name}`
    }
    const d = ln.description?.trim()
    return d || "Sin catálogo"
  })
  const total = r.lines_count ?? lines.length
  if (total > lines.length) {
    return `${parts.join(" · ")} (+${total - lines.length} más)`
  }
  return parts.join(" · ")
}

export default function MaterialRequestsPage() {
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<MaterialRequestRow> | null>(
    null,
  )
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRequestRow>>(
        "material-requests",
        {
          query: {
            page,
            per_page: 20,
            ...(status === "all" ? {} : { status }),
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las solicitudes.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Solicitudes de insumos
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Bandeja interna de solicitudes registradas por las áreas. Las entregas que impactan stock quedan reflejadas
          en{" "}
          <Link className="text-primary font-medium underline-offset-4 hover:underline" to="/movimientos-inventario">
            Movimientos
          </Link>
          . Use el ID para abrir el detalle (solo consulta).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid min-w-[11rem] gap-2">
          <Label className="text-foreground/90 font-semibold">Estado</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger
              className={cn(
                "h-10 min-w-[11rem] font-semibold shadow-md transition-all",
                "focus:ring-2 focus:ring-primary/30 focus:ring-offset-0",
                "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:opacity-80",
                status === "all" &&
                  "border-primary/35 bg-gradient-to-br from-primary/18 via-violet-500/14 to-primary/10 text-primary shadow-md hover:border-primary/50 hover:from-primary/25 hover:via-violet-500/20 hover:to-primary/14 [&_svg]:text-primary",
                status === "pending" &&
                  "border-amber-400/55 bg-gradient-to-br from-amber-100 to-amber-50/95 text-amber-950 shadow-md hover:border-amber-500/70 hover:from-amber-200/90 hover:to-amber-100 dark:border-amber-600/80 dark:from-amber-950/65 dark:to-amber-950/45 dark:text-amber-50 dark:shadow-none [&_svg]:text-amber-800 dark:[&_svg]:text-amber-200",
                status === "received" &&
                  "border-emerald-400/55 bg-gradient-to-br from-emerald-100 to-emerald-50/95 text-emerald-950 shadow-md hover:border-emerald-500/70 hover:from-emerald-200/90 hover:to-emerald-100 dark:border-emerald-600/80 dark:from-emerald-950/65 dark:to-emerald-950/45 dark:text-emerald-50 dark:shadow-none [&_svg]:text-emerald-800 dark:[&_svg]:text-emerald-200",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/20 shadow-lg">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="received">Recibido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button type="button" asChild>
            <Link to="/solicitudes-material/nueva">Nueva solicitud de insumos</Link>
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-violet-500/[0.07] shadow-md shadow-primary/5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                <TableHead className="w-[88px] pl-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  ID
                </TableHead>
                <TableHead className="min-w-[140px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Material
                </TableHead>
                <TableHead className="w-[120px] pr-5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : !rows?.data.length ? (
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    Sin solicitudes.
                  </TableCell>
                </TableRow>
              ) : (
                rows.data.map((r, idx) => {
                  const materialText = formatMaterialSummary(r)
                  return (
                    <TableRow
                      key={r.id}
                      className={cn(
                        "border-border/60 transition-colors",
                        idx % 2 === 1 ? "bg-muted/25" : "bg-card/80",
                        "hover:bg-violet-500/[0.06]",
                      )}
                    >
                      <TableCell className="pl-5 align-middle">
                        <Link
                          className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold text-primary tabular-nums ring-1 ring-primary/15 transition-colors hover:bg-primary/15"
                          to={`/solicitudes-material/${r.id}`}
                        >
                          {r.id}
                        </Link>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium shadow-none",
                            materialRequestStatusBadgeClass(r.status),
                          )}
                        >
                          {materialRequestStatusLabel(r.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md align-middle">
                        <p
                          className="text-foreground text-sm leading-snug line-clamp-2 font-medium"
                          title={materialText}
                        >
                          {materialText}
                        </p>
                      </TableCell>
                      <TableCell className="pr-5 text-right align-middle">
                        <span className="text-muted-foreground text-sm">—</span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {rows && rows.last_page > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {rows.current_page} de {rows.last_page} · {rows.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page >= rows.last_page || loading}
              onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
