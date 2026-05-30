"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  Bell,
  CalendarClock,
  CalendarDays,
  Inbox,
  RotateCcw,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { DashboardSummary, MaterialRow } from "@/types/api"
 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const AREA_LABELS: Record<string, string> = {
  material: "Material",
  tintas: "Tintas",
  cementerio_tintas: "Cementerio de tintas",
  quimicos: "Químicos",
  miscelaneos: "Misceláneos",
  bobinas_rechazadas: "Bobinas rechazadas",
}

function areaLabel(key: string): string {
  return AREA_LABELS[key] ?? key.replace(/_/g, " ")
}

const workOrderChartConfig = {
  cantidad: { label: "Cantidad" },
} satisfies ChartConfig

type KpiItem = {
  title: string
  hint: string
  value: number
  href?: string
  icon: LucideIcon
  ringClass: string
  iconClass: string
}

function KpiCard({ item }: { item: KpiItem }) {
  const Icon = item.icon
  const body = (
    <div
      className={cn(
        "flex h-full min-h-[96px] flex-1 items-start justify-between gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        "border-l-4 pl-3",
        item.ringClass,
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium leading-tight text-muted-foreground">
          {item.title}
        </p>
        <p
          className="text-2xl font-semibold tabular-nums tracking-tight text-foreground"
          translate="no"
        >
          {item.value}
        </p>
        <p className="text-[11px] text-muted-foreground/90">{item.hint}</p>
      </div>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50",
          item.iconClass,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )

  if (item.href) {
    return (
      <Link to={item.href} className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        {body}
      </Link>
    )
  }
  return <div className="min-w-0">{body}</div>
}

export default function AxonesDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardSummary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await apiFetch<DashboardSummary>("dashboard/summary")
      setData(s)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el resumen.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const workOrderBars = useMemo(() => {
    if (!data) return []
    return [
      { etapa: "En espera de programación", cantidad: data.work_orders_pending_programming },
      { etapa: "En programación", cantidad: data.work_orders_in_programming },
    ]
  }, [data])

  const lowStockRows = useMemo(
    () => (Array.isArray(data?.materials_low_stock) ? data!.materials_low_stock : []),
    [data?.materials_low_stock],
  )

  const kpiItems: KpiItem[] = useMemo(() => {
    if (!data) return []
    return [
      {
        title: "Solicitudes de insumos pendientes",
        hint: "Pendiente o con entrega parcial en inventario.",
        value: data.material_requests_pending,
        href: "/solicitudes-material",
        icon: Inbox,
        ringClass: "border-l-sky-500/80",
        iconClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      },
      {
        title: "Devoluciones por revisar",
        hint: "Aún no aprobadas.",
        value: data.inventory_returns_pending,
        icon: RotateCcw,
        ringClass: "border-l-amber-500/80",
        iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      },
      {
        title: "Órdenes sin fecha de programa",
        hint: "Candidatas a asignar en el tablero.",
        value: data.work_orders_pending_programming,
        href: "/programacion",
        icon: CalendarClock,
        ringClass: "border-l-violet-500/80",
        iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      },
      {
        title: "Órdenes en programación",
        hint: "En curso en el calendario de planta.",
        value: data.work_orders_in_programming,
        href: "/programacion",
        icon: CalendarDays,
        ringClass: "border-l-fuchsia-500/80",
        iconClass: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
      },
      {
        title: "Alertas sin leer",
        hint: "Pendiente de atención del equipo.",
        value: data.operational_alerts_unread,
        href: "/alertas",
        icon: Bell,
        ringClass: "border-l-rose-500/80",
        iconClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      },
      {
        title: "Movimientos hoy en inventario",
        hint: "Entradas, salidas y ajustes del día.",
        value: data.movements_today,
        href: "/movimientos-inventario",
        icon: TrendingUp,
        ringClass: "border-l-cyan-500/80",
        iconClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      },
    ]
  }, [data])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Axones · Resumen</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Vista de inventario, solicitudes, órdenes y alertas. Los valores se actualizan al
            pulsar <span className="text-foreground/90">Actualizar</span> con lo último del sistema.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : !data ? (
        <p className="text-destructive">Sin datos. Compruebe la conexión con el servidor.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpiItems.map((item) => (
              <KpiCard key={item.title} item={item} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Órdenes de trabajo y programación</CardTitle>
              <CardDescription>
                Comparación rápida entre las que aún no tienen programa asignado y las que ya están
                en el calendario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={workOrderChartConfig} className="h-[min(300px,50vh)] w-full">
                <BarChart
                  data={workOrderBars}
                  margin={{ top: 12, right: 12, left: 8, bottom: 64 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="etapa"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fontSize: 11 }}
                    angle={-12}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={40}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent indicator="dashed" />}
                    cursor={false}
                  />
                  <Bar
                    dataKey="cantidad"
                    name="Órdenes"
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ChartContainer>
              <p className="text-muted-foreground mt-2 text-center text-sm">
                <Link to="/programacion" className="text-primary font-medium hover:underline">
                  Ir al tablero de programación
                </Link>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Materiales con existencia baja</CardTitle>
              <CardDescription>
                Listado donde el stock actual está por debajo del mínimo definido. Valide
                reabastecimiento o ajuste de mínimos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ningún material bajo el mínimo ahora.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead>Unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockRows.map((m: MaterialRow) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{m.name}</TableCell>
                          <TableCell className="text-sm">
                            {areaLabel(m.inventory_area)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.quantity_on_hand}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.min_stock}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
