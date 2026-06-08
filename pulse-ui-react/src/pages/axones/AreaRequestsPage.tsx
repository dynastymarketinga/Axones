"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CircleDot, ClipboardList, Filter, Layers, Package } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { catalogFilterGridCompactClass, catalogSelectTriggerClass } from "@/components/axones/catalog-list-classes"
import { AxonesInventoryModuleNav } from "@/components/axones/inventory-page-layout"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWarehouseInsumosPendingCount } from "@/hooks/useWarehouseInsumosPendingCount"
import { cn } from "@/lib/utils"

import "./materials-list.css"

function TabCountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  )
}

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

type InsumosTrayTab = "manual" | "ot_planilla"

const TRAY_TABS: Array<{ value: InsumosTrayTab; label: string; hint: string }> = [
  {
    value: "manual",
    label: "Solicitudes de insumos",
    hint: "Formulario Nueva solicitud y pedidos manuales de las áreas.",
  },
  {
    value: "ot_planilla",
    label: "Desde orden de trabajo",
    hint: "Sustratos virgen (impresión / laminación) al guardar la planilla OT.",
  },
]

type AreaReqRow = {
  id: number
  area: string
  status: string
  title: string | null
  material_request_id: number
  requester?: { name: string }
}

export default function AreaRequestsPage() {
  const [trayTab, setTrayTab] = useState<InsumosTrayTab>("manual")
  const [area, setArea] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<AreaReqRow> | null>(null)

  const activeTray = TRAY_TABS.find((t) => t.value === trayTab) ?? TRAY_TABS[0]
  const { breakdown: pendingBreakdown, reload: reloadPendingCounts } =
    useWarehouseInsumosPendingCount()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<AreaReqRow>>("area-requests", {
        query: {
          page,
          per_page: 20,
          insumos_only: "1",
          insumos_origin: trayTab,
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
  }, [page, area, status, trayTab])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void reloadPendingCounts()
  }, [reloadPendingCounts, load])

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

  return (
    <div className="mat-list-shell">
      <CatalogPageShell
        title="Solicitudes entre áreas"
        subtitle={
          <>
            Bandeja del almacén para autorizar salidas de inventario. Use la pestaña{" "}
            <strong>Solicitudes de insumos</strong> para pedidos del formulario{" "}
            <Link
              className="text-primary font-medium underline-offset-4 hover:underline"
              to="/solicitudes-material/nueva"
            >
              Nueva solicitud
            </Link>
            ; la pestaña <strong>Desde orden de trabajo</strong> agrupa los sustratos virgen guardados en la{" "}
            <Link className="text-primary font-medium underline-offset-4 hover:underline" to="/ordenes-trabajo">
              planilla OT
            </Link>
            . Desde <strong>Ver insumos</strong> puede autorizar y despachar; el historial queda en{" "}
            <Link className="text-primary font-medium underline-offset-4 hover:underline" to="/movimientos-inventario">
              Movimientos
            </Link>
            .
          </>
        }
        icon={ClipboardList}
      >
        <AxonesInventoryModuleNav active="solicitudes-area" variant="catalog" />

      <Tabs
        value={trayTab}
        onValueChange={(v) => {
          setTrayTab(v as InsumosTrayTab)
          setPage(1)
        }}
        className="w-full"
      >
        <TabsList className="mat-view-tab-list">
          <TabsTrigger value="manual" className="mat-view-tab-trigger inline-flex items-center gap-2">
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
            Solicitudes de insumos
            <TabCountBadge count={pendingBreakdown.manual} />
          </TabsTrigger>
          <TabsTrigger value="ot_planilla" className="mat-view-tab-trigger inline-flex items-center gap-2">
            <Package className="h-4 w-4 shrink-0" aria-hidden />
            Desde orden de trabajo
            <TabCountBadge count={pendingBreakdown.otPlanilla} />
          </TabsTrigger>
        </TabsList>

        <p className="text-muted-foreground mt-3 text-sm">{activeTray.hint}</p>

        <TabsContent value={trayTab} className="mt-4 space-y-4">
          <div className="mat-filter-bar space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-medium">Filtrar listado</p>
            </div>
            <div className={catalogFilterGridCompactClass}>
              <CatalogLabeledField label="Área" icon={Layers}>
                <Select
                  value={area}
                  onValueChange={(v) => {
                    setArea(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {AREA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CatalogLabeledField>
              <CatalogLabeledField label="Estado" icon={CircleDot}>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CatalogLabeledField>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Solicitudes de insumos y sustratos entre áreas. Use los filtros para acotar por área o
              estado; desde <strong>Ver insumos</strong> puede autorizar y despachar.
            </p>
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
                    {trayTab === "ot_planilla"
                      ? "Sin solicitudes de sustratos desde orden de trabajo."
                      : "Sin solicitudes de insumos manuales."}
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
        </TabsContent>
      </Tabs>
      </CatalogPageShell>
    </div>
  )
}
