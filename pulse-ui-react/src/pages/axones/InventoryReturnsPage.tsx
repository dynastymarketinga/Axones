"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
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

type ReturnRow = {
  id: number
  work_order_id: number | null
  status: string
  quantity: string
  destination_area: string
  material?: Pick<MaterialRow, "sku" | "name">
  work_order?: { code: string }
}

export default function InventoryReturnsPage() {
  const [retStatus, setRetStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ReturnRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ReturnRow>>(
        "inventory-returns",
        {
          query: {
            page,
            per_page: 20,
            status: retStatus !== "all" ? retStatus : undefined,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las devoluciones.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, retStatus])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Devoluciones a inventario
        </h1>
        <p className="text-muted-foreground text-sm">
          Casadas con OT de impresión · <code>/inventory-returns</code>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-44 gap-2">
          <Label>Estado</Label>
          <Select
            value={retStatus}
            onValueChange={(v) => {
              setRetStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="accepted">accepted</SelectItem>
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
              <TableHead>OT</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Área destino</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Sin devoluciones.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>
                    {r.work_order?.code ?? r.work_order_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.material
                      ? `${r.material.sku} · ${r.material.name}`
                      : "—"}
                  </TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>{r.destination_area}</TableCell>
                  <TableCell>{r.status}</TableCell>
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
