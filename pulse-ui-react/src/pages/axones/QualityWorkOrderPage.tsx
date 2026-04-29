"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import {
  apiFetch,
  ApiError,
} from "@/lib/api"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type QualityRecord = {
  outcome: string
  notes: string | null
  certificate_body: string | null
  updated_at?: string
  recorder?: { id: number; name: string } | null
} | null

type QualityResponse = {
  work_order_id: number
  record: QualityRecord
}

function statusLabel(value: string | null | undefined): string {
  const v = (value ?? "").toLowerCase().trim()
  if (v === "open") return "Abierta"
  if (v === "in_progress") return "En proceso"
  if (v === "completed") return "Completada"
  if (v === "cancelled") return "Cancelada"
  return value?.trim() || "—"
}

function boardStageLabel(value: string | null | undefined): string {
  const v = (value ?? "").toLowerCase().trim()
  if (v === "nueva") return "Creada"
  if (v === "pendiente") return "Programación"
  if (v === "montaje") return "Montaje"
  if (v === "impresion") return "Impresión"
  if (v === "laminacion") return "Laminación"
  if (v === "corte") return "Corte"
  if (v === "completada") return "Completada"
  return value?.trim() || "—"
}

export default function QualityWorkOrderPage() {
  const navigate = useNavigate()
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "completed">("all")
  const [qualityFilter, setQualityFilter] = useState<"all" | "with_record" | "without_record">("all")
  const [qualityPresenceByOrder, setQualityPresenceByOrder] = useState<Record<number, boolean>>({})
  const [loadingQualityFilter, setLoadingQualityFilter] = useState(false)

  useEffect(() => {
    void loadOrders()
  }, [page])

  const filteredOrders = useMemo(() => {
    const currentRows = rows?.data ?? []
    if (qualityFilter === "all") return currentRows
    return currentRows.filter((row) => {
      const hasRecord = qualityPresenceByOrder[row.id]
      if (qualityFilter === "with_record") return hasRecord === true
      return hasRecord === false
    })
  }, [rows?.data, qualityFilter, qualityPresenceByOrder])

  async function loadOrders() {
    setLoadingOrders(true)
    try {
      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
        query: {
          page,
          per_page: 12,
          q: search.trim() || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el listado de órdenes.")
      setRows(null)
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    const currentRows = rows?.data ?? []
    if (qualityFilter === "all" || currentRows.length === 0) return
    const unresolved = currentRows
      .map((row) => row.id)
      .filter((id) => qualityPresenceByOrder[id] === undefined)
    if (unresolved.length === 0) return

    let cancelled = false
    setLoadingQualityFilter(true)
    void (async () => {
      try {
        const pairs = await Promise.all(
          unresolved.map(async (id) => {
            try {
              const q = await apiFetch<QualityResponse>(`work-orders/${id}/quality`)
              return [id, q.record != null] as const
            } catch {
              return [id, false] as const
            }
          }),
        )
        if (cancelled) return
        setQualityPresenceByOrder((prev) => {
          const next = { ...prev }
          for (const [id, hasRecord] of pairs) {
            next[id] = hasRecord
          }
          return next
        })
      } finally {
        if (!cancelled) setLoadingQualityFilter(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rows?.data, qualityFilter, qualityPresenceByOrder])

  function goToPreview(id: number): void {
    navigate(`/calidad/vista-previa?ot=${id}`)
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calidad</h1>
        <p className="text-muted-foreground text-sm">
          Reporte de calidad por orden de trabajo y certificado imprimible para cliente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Órdenes de producción disponibles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="quality-search">Buscar OT (código/cliente)</Label>
              <Input
                id="quality-search"
                placeholder="Ej: OT-2026, Cliente demo"
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    setPage(1)
                    void loadOrders()
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quality-status">Estado OT</Label>
              <select
                id="quality-status"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(ev) => {
                  setStatusFilter(ev.target.value as "all" | "open" | "in_progress" | "completed")
                  setPage(1)
                }}
              >
                <option value="all">Todas</option>
                <option value="open">Abiertas</option>
                <option value="in_progress">En proceso</option>
                <option value="completed">Completadas</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quality-record-filter">Registro de calidad</Label>
              <select
                id="quality-record-filter"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={qualityFilter}
                onChange={(ev) => {
                  setQualityFilter(ev.target.value as "all" | "with_record" | "without_record")
                  setPage(1)
                }}
              >
                <option value="all">Todas</option>
                <option value="with_record">Con registro de calidad</option>
                <option value="without_record">Sin registro de calidad</option>
              </select>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadOrders()} disabled={loadingOrders}>
              {loadingOrders ? "Cargando…" : "Actualizar listado"}
            </Button>
          </div>
          {loadingQualityFilter ? (
            <p className="text-muted-foreground text-xs">
              Verificando registro de calidad para las OTs filtradas...
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OT</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOrders ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Cargando órdenes…
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Sin órdenes para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.code}</TableCell>
                      <TableCell>{row.client?.name ?? "—"}</TableCell>
                      <TableCell>{row.product?.name ?? "—"}</TableCell>
                      <TableCell>{boardStageLabel(row.board_stage)}</TableCell>
                      <TableCell>{statusLabel(row.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => goToPreview(row.id)}
                        >
                          Ver vista previa
                        </Button>
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
                Página {rows.current_page} de {rows.last_page} · {rows.total} órdenes
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={rows.current_page <= 1 || loadingOrders}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={rows.current_page >= rows.last_page || loadingOrders}
                  onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
