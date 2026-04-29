"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import type { LaravelPaginated } from "@/types/api"
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
            Incidencias y avisos que requieren atención.
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
                  Sin alertas.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.id}</TableCell>
                  <TableCell>{a.alert_type}</TableCell>
                  <TableCell>{a.severity}</TableCell>
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
