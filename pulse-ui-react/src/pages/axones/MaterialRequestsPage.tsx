"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Truck } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRequestRow } from "@/types/api"
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
import { MaterialRequestNewDialog } from "@/components/axones/MaterialRequestNewDialog"

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
            status: status !== "all" ? status : undefined,
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

  async function authorize(id: number) {
    try {
      await apiFetch(`material-requests/${id}/authorize`, { method: "POST" })
      toast.success("Solicitud autorizada.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo autorizar.")
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Solicitudes de insumos
        </h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Bandeja de inventario: las áreas cargan solicitudes y llegan aquí para
          autorización y entrega de existencias cuando la solicitud tiene líneas.
          Al <strong>entregar</strong> desde el detalle, las cantidades se registran como{" "}
          <strong>salida</strong> y el stock disponible se actualiza automáticamente (véase{" "}
          <Link className="text-primary underline-offset-4 hover:underline" to="movimientos-inventario">
            Movimientos
          </Link>
          ).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-52 gap-2">
          <Label>Estado</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="partial">Entrega parcial</SelectItem>
              <SelectItem value="dispatched">Entregada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <MaterialRequestNewDialog onCreated={() => void load()} />
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>OT</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Líneas</TableHead>
              <TableHead className="text-right">Detalle / entrega</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
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
                  Sin solicitudes.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>
                    <Link
                      className="text-primary underline-offset-4 hover:underline"
                      to={`/ordenes-trabajo/${r.work_order_id}`}
                    >
                      {r.work_order?.code ?? r.work_order_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.work_order?.client?.name ?? "—"}
                  </TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.lines_count ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link to={`/solicitudes-material/${r.id}`}>
                          Abrir
                        </Link>
                      </Button>
                      {(r.status === "pending" || r.status === "partial") ? (
                        <Button variant="default" size="sm" className="h-8" asChild>
                          <Link to={`/solicitudes-material/${r.id}?despacho=1`} title="Abrir detalle en inventario para registrar la entrega">
                            <Truck className="mr-1 h-3.5 w-3.5" />
                            Entregar
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void authorize(r.id)}
                      >
                        Autorizar
                      </Button>
                    ) : (
                      "—"
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
