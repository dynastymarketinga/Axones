"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { markAlertToastOnce } from "@/lib/alert-toast-once"
import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import { shouldPlayOperationalToast } from "@/lib/operational-alert-toast-policy"
import type { StreamAlertPayload } from "@/lib/operational-alerts-stream"
import { useOperationalAlertStreamSubscription } from "@/providers/use-operational-alert-stream-subscription"
import type { LaravelPaginated } from "@/types/api"
import { operationalAlertTypeLabel } from "@/lib/operational-alert-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AlertRow = {
  id: number
  alert_type: string
  severity: string
  message: string
  created_at: string
  acknowledged_at: string | null
  work_order?: { code: string }
  material?: { sku: string; name: string }
  metadata?: Record<string, unknown>
}

const MATERIAL_OPERATIONAL_TYPES = new Set([
  "ot_material_shortage",
  "scrap_threshold_exceeded",
  "material_low_stock",
  "material_request_pending_warehouse",
  "inventory_return_pending",
])

function alertTypeLabel(alertType?: string | null): string {
  return operationalAlertTypeLabel(alertType)
}

function severityLabel(severity?: string | null): string {
  const s = (severity ?? "").toLowerCase().trim()
  if (s === "info") return "Información"
  if (s === "warning") return "Advertencia"
  if (s === "critical") return "Crítica"
  return severity || "—"
}

function areaLabelFromRole(role?: string | null, userId?: number | null): string {
  if (Number(userId) === 1) return "Acceso total (ID 1)"
  const r = (role ?? "").toLowerCase().trim()
  if (r === "boss" || r === "admin" || r === "jefe_supremo" || r === "superadmin") return "Acceso total"
  if (r === "printing" || r === "impresion") return "Impresión"
  if (r === "laminacion") return "Laminación"
  if (r === "corte") return "Corte"
  if (r === "montaje") return "Montaje"
  if (r === "tintas") return "Tintas"
  return "General"
}

export default function AxonesOperationalAlertsPage() {
  const session = getStoredUser()
  const areaLabel = areaLabelFromRole(session?.role, session?.id)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<AlertRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<AlertRow>>("alerts", {
        query: { page, per_page: 30 },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las alertas.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => {
      setPage(1)
      void load()
    }
    window.addEventListener("alerts:refresh", onRefresh)
    return () => window.removeEventListener("alerts:refresh", onRefresh)
  }, [load])

  const onStreamRow = useCallback((row: StreamAlertPayload) => {
    if (!MATERIAL_OPERATIONAL_TYPES.has(row.alert_type.toLowerCase().trim())) {
      return
    }
    setRows((prev) => {
      if (!prev) return prev
      if (prev.data.some((x) => x.id === row.id)) return prev
      if (prev.current_page !== 1) return prev
      const mapped: AlertRow = {
        id: row.id,
        alert_type: row.alert_type,
        severity: row.severity,
        message: row.message,
        created_at: row.created_at,
        acknowledged_at: row.acknowledged_at,
        work_order: row.work_order?.code
          ? { code: row.work_order.code }
          : undefined,
        material: undefined,
        metadata: row.metadata,
      }
      return {
        ...prev,
        data: [mapped, ...prev.data],
        total: prev.total + 1,
      }
    })
    const session = getStoredUser()
    if (
      shouldPlayOperationalToast(session?.role, row.metadata) &&
      markAlertToastOnce(row.id)
    ) {
      toast.info(row.message)
    }
  }, [])

  useOperationalAlertStreamSubscription(onStreamRow)

  async function acknowledge(id: number) {
    try {
      await apiFetch(`alerts/${id}/acknowledge`, { method: "PATCH" })
      toast.success("Alerta reconocida.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo actualizar.")
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Alertas operativas
          </h1>
          <p className="text-muted-foreground text-sm">
            Mermas, falta de material, insumos por despachar, devoluciones y stock bajo.
          </p>
          <div className="mt-2">
            <Badge variant="outline">Área actual: {areaLabel}</Badge>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Actualizar
        </Button>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Severidad</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>OT</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Sin alertas de desperdicio o escasez de material.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.id}</TableCell>
                  <TableCell>{alertTypeLabel(a.alert_type)}</TableCell>
                  <TableCell>{severityLabel(a.severity)}</TableCell>
                  <TableCell className="max-w-[280px] text-sm">
                    {a.message}
                  </TableCell>
                  <TableCell>{a.work_order?.code ?? "—"}</TableCell>
                  <TableCell>
                    {a.material
                      ? `${a.material.sku} · ${a.material.name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.acknowledged_at ? (
                      <span className="text-muted-foreground text-xs">OK</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void acknowledge(a.id)}
                      >
                        Reconocer
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
