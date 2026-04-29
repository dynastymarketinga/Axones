"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
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

type BobinaRow = {
  id: number
  status: string
  weight_kg: string | null
  material?: { sku: string; name: string }
  inventory_return?: { work_order_id: number | null }
}

export default function BobinasPage() {
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<BobinaRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<BobinaRow>>("bobinas", {
        query: {
          page,
          per_page: 50,
          status: status !== "all" ? status : undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las bobinas.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bobinas</h1>
          <p className="text-muted-foreground text-sm">
            Cada bobina es un registro único con su trazabilidad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/devoluciones">Devoluciones</Link>
          </Button>
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link to="/bobinas/registrar-rechazada">Registrar bobina rechazada</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-48 gap-2">
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
              <SelectItem value="available">available</SelectItem>
              <SelectItem value="issued">issued</SelectItem>
              <SelectItem value="consumed">consumed</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>
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
              <TableHead>Material</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Peso kg</TableHead>
              <TableHead>OT devolución</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Sin bobinas.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.id}</TableCell>
                  <TableCell>
                    {b.material
                      ? `${b.material.sku} · ${b.material.name}`
                      : "—"}
                  </TableCell>
                  <TableCell>{b.status}</TableCell>
                  <TableCell>{b.weight_kg ?? "—"}</TableCell>
                  <TableCell>
                    {b.inventory_return?.work_order_id ?? "—"}
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
