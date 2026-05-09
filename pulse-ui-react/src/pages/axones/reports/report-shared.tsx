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
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  /** Título de la tarjeta Desde/Hasta (por defecto: «Rango de fechas global»). */
  rangeCardTitle?: string
  /** Si es false, no renderiza la tarjeta de Desde/Hasta (útil para reportes que no la usan). */
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

      {showRange ? (
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
