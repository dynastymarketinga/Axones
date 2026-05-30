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
  ClipboardList,
  Factory,
  Inbox,
  PackageX,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { DashboardSummary, MaterialRow } from "@/types/api"
 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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

const otScrapChartConfig = {
  impresion_kg: { label: "Impresión", color: "hsl(var(--chart-1))" },
  laminacion_kg: { label: "Laminación", color: "hsl(var(--chart-2))" },
  corte_kg: { label: "Corte", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig

function parseKgNumber(raw?: string | null): number {
  const n = Number.parseFloat(String(raw ?? "0").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

type KpiItem = {
  title: string
  hint: string
  value: number
  displayValue?: string
  href?: string
  icon: LucideIcon
  ringClass: string
  iconClass: string
}

function formatKgDisplay(raw?: string | null): string {
  const n = Number.parseFloat(String(raw ?? "0").replace(",", "."))
  if (!Number.isFinite(n)) return "0 kg"
  return `${n.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`
}

function KpiCard({ item }: { item: KpiItem }) {
  const Icon = item.icon
  const shownValue = item.displayValue ?? String(item.value)
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
          {shownValue}
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

  const scrapByOtChart = useMemo(() => {
    const rows = data?.recent_finalized_ot_scrap ?? []
    return rows.map((row) => ({
      ...row,
      impresion_kg: parseKgNumber(row.impresion_kg),
      laminacion_kg: parseKgNumber(row.laminacion_kg),
      corte_kg: parseKgNumber(row.corte_kg),
      total_kg: parseKgNumber(row.total_kg),
    }))
  }, [data?.recent_finalized_ot_scrap])

  const lowStockRows = useMemo(
    () => (Array.isArray(data?.materials_low_stock) ? data!.materials_low_stock : []),
    [data?.materials_low_stock],
  )

  const kpiItems: KpiItem[] = useMemo(() => {
    if (!data) return []
    const monthHint = data.month_label
      ? `Acumulado de ${data.month_label}.`
      : "Acumulado del mes en curso."
    const scrapByArea = data.scrap_month_by_area_kg
    const scrapHint = scrapByArea
      ? `${monthHint} Impresión, laminación y corte (kg).`
      : `${monthHint} Desperdicio registrado en planilla.`

    return [
      {
        title: "Producción del mes",
        hint: `${monthHint} Kg terminados en corte (turnos cerrados).`,
        value: 0,
        displayValue: formatKgDisplay(data.corte_production_month_kg),
        href: "/corte",
        icon: Factory,
        ringClass: "border-l-emerald-500/80",
        iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
      {
        title: "Desperdicio del mes",
        hint: scrapHint,
        value: 0,
        displayValue: formatKgDisplay(data.scrap_month_kg),
        href: "/reportes/mermas",
        icon: Trash2,
        ringClass: "border-l-orange-500/80",
        iconClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      },
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
        title: "Devoluciones rechazadas",
        hint: `${monthHint} Bobinas registradas por devolución a inventario rechazado.`,
        value: data.rejected_returns_bobinas_month ?? 0,
        href: "/devoluciones",
        icon: PackageX,
        ringClass: "border-l-amber-500/80",
        iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      },
      {
        title: "Órdenes sin producir",
        hint: "OT abiertas o en curso, pendientes de terminar en planta.",
        value: data.work_orders_pending_production ?? 0,
        href: "/ordenes-trabajo",
        icon: ClipboardList,
        ringClass: "border-l-violet-500/80",
        iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
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
            Vista de producción, inventario, solicitudes, órdenes y alertas. Los valores se
            actualizan al recargar la página con lo último del sistema.
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
              <CardTitle className="text-base">Desperdicio por órdenes finalizadas</CardTitle>
              <CardDescription>
                Últimas 10 OT con corte cerrado o producción completa (4 áreas). Solo suma kg del área
                cuando está finalizada en planilla: impresión, laminación y corte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <ChartContainer config={otScrapChartConfig} className="h-[min(340px,55vh)] w-full">
                  <BarChart
                    data={scrapByOtChart}
                    margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="label"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals
                      width={48}
                      tickLine={false}
                      axisLine={false}
                      domain={scrapByOtChart.length > 0 ? [0, "auto"] : [0, 10]}
                      tickFormatter={(v) => `${v} kg`}
                    />
                    <ChartTooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as
                              | { code?: string; closure?: string }
                              | undefined
                            if (!row?.code) return "OT"
                            const hint =
                              row.closure === "closed_complete"
                                ? " · 4 áreas listas"
                                : row.closure === "closed"
                                  ? " · Corte cerrado"
                                  : ""
                            return `${row.code}${hint}`
                          }}
                          formatter={(value, name) => {
                            const n = typeof value === "number" ? value : parseKgNumber(String(value))
                            const label =
                              otScrapChartConfig[name as keyof typeof otScrapChartConfig]?.label ??
                              String(name)
                            return (
                              <span className="font-mono tabular-nums">
                                {label}: {n.toLocaleString("es-VE", { maximumFractionDigits: 3 })} kg
                              </span>
                            )
                          }}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="impresion_kg"
                      stackId="scrap"
                      fill="var(--color-impresion_kg)"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={48}
                    />
                    <Bar
                      dataKey="laminacion_kg"
                      stackId="scrap"
                      fill="var(--color-laminacion_kg)"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={48}
                    />
                    <Bar
                      dataKey="corte_kg"
                      stackId="scrap"
                      fill="var(--color-corte_kg)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ChartContainer>
                {scrapByOtChart.length === 0 ? (
                  <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center text-sm text-muted-foreground">
                    Sin OT finalizadas aún. La gráfica se actualiza al cerrar corte o completar las 4 áreas.
                  </p>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-2 text-center text-sm">
                <Link to="/reportes/mermas" className="text-primary font-medium hover:underline">
                  Ver reporte completo de mermas
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
