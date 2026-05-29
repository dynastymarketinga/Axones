"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
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

const AREA_OPTIONS = [
  { value: "almacen", label: "Almacén" },
  { value: "impresion", label: "Impresión" },
  { value: "laminacion", label: "Laminación" },
  { value: "corte", label: "Corte" },
  { value: "montaje", label: "Montaje" },
  { value: "tintas", label: "Tintas" },
] as const

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "done", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
] as const

type AreaReqRow = {
  id: number
  area: string
  status: string
  title: string | null
  material_request_id: number
  requester?: { name: string }
}

export default function AreaRequestsPage() {
  const [area, setArea] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<AreaReqRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<AreaReqRow>>("area-requests", {
        query: {
          page,
          per_page: 20,
          insumos_only: "1",
          area: area !== "all" ? area : undefined,
          status: status !== "all" ? status : undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las solicitudes por área.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, area, status])

  useEffect(() => {
    void load()
  }, [load])

  function areaLabel(code: string) {
    return AREA_OPTIONS.find((o) => o.value === code)?.label ?? code
  }

  function statusLabel(code: string) {
    return STATUS_OPTIONS.find((o) => o.value === code)?.label ?? code
  }

  function areaRequestStatusBadgeClass(code: string) {
    switch (code) {
      case "pending":
        return "border-amber-300/80 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-50"
      case "done":
        return "border-emerald-300/80 bg-emerald-100 text-emerald-950 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-50"
      case "cancelled":
        return "border-border bg-muted text-muted-foreground"
      default:
        return "border-border bg-secondary text-secondary-foreground"
    }
  }

  const filterTriggerClass =
    "h-10 min-w-[10.5rem] border-zinc-200/90 bg-white font-medium text-foreground shadow-sm transition-colors hover:bg-zinc-50/90 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/80"

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes entre áreas</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Bandeja del almacén con las{" "}
          <Link className="text-primary font-medium underline-offset-4 hover:underline" to="/solicitudes-material">
            solicitudes de insumos
          </Link>{" "}
          registradas por las áreas (formulario{" "}
          <Link
            className="text-primary font-medium underline-offset-4 hover:underline"
            to="/solicitudes-material/nueva"
          >
            Nueva solicitud
          </Link>
          ). No incluye avisos automáticos de OT. Desde <strong>Ver insumos</strong> puede autorizar la salida y rebajar
          inventario; el historial queda en{" "}
          <Link className="text-primary font-medium underline-offset-4 hover:underline" to="/movimientos-inventario">
            Movimientos
          </Link>
          .
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid min-w-[10.5rem] gap-2">
            <Label className="text-foreground/90 text-sm font-semibold">Área</Label>
            <Select
              value={area}
              onValueChange={(v) => {
                setArea(v)
                setPage(1)
              }}
            >
              <SelectTrigger className={filterTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                <SelectItem value="all">Todas</SelectItem>
                {AREA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-[10.5rem] gap-2">
            <Label className="text-foreground/90 text-sm font-semibold">Estado</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger className={filterTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                <TableHead className="min-w-[100px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Área
                </TableHead>
                <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Título
                </TableHead>
                <TableHead className="min-w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Solicitante
                </TableHead>
                <TableHead className="min-w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado
                </TableHead>
                <TableHead className="min-w-[100px] pr-5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : !rows?.data.length ? (
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                    Sin solicitudes de insumos.
                  </TableCell>
                </TableRow>
              ) : (
                rows.data.map((r, idx) => (
                  <TableRow
                    key={r.id}
                    className={cn(
                      "border-border/60 transition-colors",
                      idx % 2 === 1 ? "bg-muted/25" : "bg-card/80",
                      "hover:bg-violet-500/[0.06]",
                    )}
                  >
                    <TableCell className="pl-5 align-middle">
                      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold text-primary tabular-nums ring-1 ring-primary/15">
                        {r.id}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle">
                      <span className="text-foreground text-sm font-medium">{areaLabel(r.area)}</span>
                    </TableCell>
                    <TableCell className="max-w-[240px] align-middle">
                      <p className="text-foreground truncate text-sm font-medium" title={r.title ?? undefined}>
                        {r.title ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="align-middle">
                      <span className="text-muted-foreground text-sm">{r.requester?.name ?? "—"}</span>
                    </TableCell>
                    <TableCell className="align-middle">
                      <Badge
                        variant="outline"
                        className={cn("font-medium shadow-none", areaRequestStatusBadgeClass(r.status))}
                      >
                        {statusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right align-middle">
                      <Button variant="outline" size="sm" className="h-9 border-primary/25 shadow-sm" asChild>
                        <Link to={`/solicitudes-area/insumos/${r.material_request_id}`}>Ver insumos</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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
