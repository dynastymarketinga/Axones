"use client"

import { useCallback, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { apiDownloadFile, ApiError } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export type ReportRangeQueryValue = string | number | undefined

/** HH:MM:SS, coherente con las vistas PDF/HTML de reportes de tiempos. */
export function formatDurationHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

/** Mensaje de tabla vacía para listados de OT con temporizador (Reporte de tiempos). */
export const REPORT_EMPTY_WORK_ORDER_TIMES =
  "Sin órdenes con tiempos en este período."

/** Mensaje de tabla vacía para agregado por área/máquina (Producción y tiempos). */
export const REPORT_EMPTY_PRODUCTION_TIME_BY_AREA =
  "Sin tiempos registrados en este período."

export const PRODUCTION_AREA_LABELS: Record<string, string> = {
  printing: "Impresión",
  laminacion: "Laminación",
  corte: "Corte",
  montaje: "Montaje",
  tintas: "Tintas",
}

/** Orden fijo de las cinco áreas de producción en tablas y KPI. */
export const PRODUCTION_AREA_ORDER = [
  "montaje",
  "printing",
  "laminacion",
  "corte",
  "tintas",
] as const

export type ProductionAreaKey = (typeof PRODUCTION_AREA_ORDER)[number]

export type ProductionTimeRawRow = {
  area: string
  segment_type: string
  machine_code: string
  total_seconds: number
  segment_count: number
}

export type ProductionTimeAggRow = {
  area: string
  machine_code: string
  mount_sec: number
  demount_sec: number
  prod_sec: number
  down_sec: number
  segment_count: number
}

export type ProductionTimeAreaSummaryRow = {
  area: string
  mount_sec: number
  demount_sec: number
  prod_sec: number
  down_sec: number
  segment_count: number
}

export type WorkOrderTimeCandidate = {
  work_order_id: number
  work_order_code: string
  client_name: string | null
  product_name: string | null
  areas: string[]
  production_seconds: number
  downtime_seconds: number
  mount_seconds: number
  demount_seconds: number
  total_seconds: number
  effective_percent: string
}

export function pivotProductionRows(rows: ProductionTimeRawRow[]): ProductionTimeAggRow[] {
  const agg = new Map<string, ProductionTimeAggRow>()
  for (const r of rows) {
    const area = String(r.area ?? "")
    const machine = String(r.machine_code ?? "")
    const type = String(r.segment_type ?? "")
    const sec = Number(r.total_seconds ?? 0)
    const cnt = Number(r.segment_count ?? 0)
    const k = `${area}|${machine}`
    let row = agg.get(k)
    if (!row) {
      row = {
        area,
        machine_code: machine,
        mount_sec: 0,
        demount_sec: 0,
        prod_sec: 0,
        down_sec: 0,
        segment_count: 0,
      }
      agg.set(k, row)
    }
    row.segment_count += cnt
    if (type === "mount") row.mount_sec += sec
    if (type === "demount") row.demount_sec += sec
    if (type === "production") row.prod_sec += sec
    if (type === "downtime") row.down_sec += sec
  }

  return Array.from(agg.values()).sort((a, b) => {
    const ia = PRODUCTION_AREA_ORDER.indexOf(a.area as ProductionAreaKey)
    const ib = PRODUCTION_AREA_ORDER.indexOf(b.area as ProductionAreaKey)
    const ao = (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    if (ao !== 0) return ao
    return a.machine_code.localeCompare(b.machine_code, "es")
  })
}

/** Agrupa filas por máquina en totales por área (las cinco áreas siempre presentes). */
export function rollupByArea(aggRows: ProductionTimeAggRow[]): ProductionTimeAreaSummaryRow[] {
  const map = new Map<string, ProductionTimeAreaSummaryRow>()
  for (const r of aggRows) {
    let row = map.get(r.area)
    if (!row) {
      row = {
        area: r.area,
        mount_sec: 0,
        demount_sec: 0,
        prod_sec: 0,
        down_sec: 0,
        segment_count: 0,
      }
      map.set(r.area, row)
    }
    row.mount_sec += r.mount_sec
    row.demount_sec += r.demount_sec
    row.prod_sec += r.prod_sec
    row.down_sec += r.down_sec
    row.segment_count += r.segment_count
  }

  return PRODUCTION_AREA_ORDER.map((area) => {
    const existing = map.get(area)
    if (existing) return existing
    return {
      area,
      mount_sec: 0,
      demount_sec: 0,
      prod_sec: 0,
      down_sec: 0,
      segment_count: 0,
    }
  })
}

export function buildWorkOrderTimeReportQuery(
  from: string,
  to: string,
  aggregateAll: boolean,
  woId: string,
): Record<string, string | number> {
  const q: Record<string, string | number> = { from, to }
  if (!aggregateAll && woId.trim() !== "") {
    q.work_order_id = Number(woId.trim())
  }
  return q
}

export function sumCandidateTotals(candidates: WorkOrderTimeCandidate[]) {
  let prod = 0
  let down = 0
  let mount = 0
  let demount = 0
  let total = 0
  for (const r of candidates) {
    prod += r.production_seconds
    down += r.downtime_seconds
    mount += r.mount_seconds
    demount += r.demount_seconds
    total += r.total_seconds
  }
  const eff = total > 0 ? ((prod / total) * 100).toFixed(2) : "0.00"
  return { prod, down, mount, demount, total, eff }
}

/** Áreas con al menos un segmento cerrado en el rango. */
export function areasWithRecordedTime(
  areaRows: ProductionTimeAreaSummaryRow[],
): ProductionAreaKey[] {
  return PRODUCTION_AREA_ORDER.filter((area) => {
    const row = areaRows.find((r) => r.area === area)
    return row != null && row.segment_count > 0
  })
}

/** OT sugerida para abrir Montaje (cronómetro / segmentos en planilla). */
export function resolveMontajeWorkOrderId(
  candidates: WorkOrderTimeCandidate[],
  woId: string,
): number | null {
  if (woId.trim() !== "") {
    const id = Number(woId.trim())
    return Number.isFinite(id) && id > 0 ? id : null
  }
  const withMontaje = candidates.filter((c) => c.areas.includes("montaje"))
  if (withMontaje.length >= 1) return withMontaje[0].work_order_id
  if (candidates.length === 1) return candidates[0].work_order_id
  return null
}

export function sumAggRowsTotals(rows: ProductionTimeAggRow[] | ProductionTimeAreaSummaryRow[]) {
  let prod = 0
  let down = 0
  let mount = 0
  let demount = 0
  let segments = 0
  for (const r of rows) {
    prod += r.prod_sec
    down += r.down_sec
    mount += r.mount_sec
    demount += r.demount_sec
    segments += r.segment_count
  }
  return { prod, down, mount, demount, segments }
}

/**
 * Hook compartido para todas las páginas de Reportes:
 * - Mantiene el rango global Desde/Hasta.
 * - Provee un `downloadCsv` con manejo de loading y errores.
 */
export function useReportRange() {
  const [from, setFrom] = useState<string>(defaultFrom)
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const downloadCsv = useCallback(
    async (
      path: string,
      fallbackName: string,
      query: Record<string, ReportRangeQueryValue>,
    ) => {
      setLoading(true)
      try {
        await apiDownloadFile(path, {
          query: { ...query, format: "csv" },
          fallbackName,
        })
        toast.success("Descarga iniciada.")
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo descargar el archivo.")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { from, setFrom, to, setTo, loading, setLoading, downloadCsv }
}

type ReportPageShellProps = {
  title: string
  description?: string
  from?: string
  to?: string
  onFromChange?: (v: string) => void
  onToChange?: (v: string) => void
  /** Título de la tarjeta Desde/Hasta (por defecto: «Rango de fechas global»). */
  rangeCardTitle?: string
  /** Si es false, no renderiza la tarjeta de Desde/Hasta (filtros de fecha van en el panel del reporte). */
  showRange?: boolean
  children: ReactNode
}

/**
 * Layout reusable para cada página de reporte: encabezado + tarjeta de rango global + slot.
 */
export function ReportPageShell({
  title,
  description,
  from,
  to,
  onFromChange,
  onToChange,
  rangeCardTitle = "Rango de fechas global",
  showRange = true,
  children,
}: ReportPageShellProps) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>

      {showRange && from != null && to != null && onFromChange && onToChange ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{rangeCardTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="grid gap-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={from}
                onChange={(ev) => onFromChange(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={to}
                onChange={(ev) => onToChange(ev.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">{children}</div>
    </div>
  )
}
