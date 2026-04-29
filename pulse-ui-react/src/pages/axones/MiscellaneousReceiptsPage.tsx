"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type MiscRow = {
  id: number
  material_id: number
  quantity: string
  received_at: string | null
  notes: string | null
  material?: Pick<MaterialRow, "sku" | "name">
  attachments_count?: number
}

export default function MiscellaneousReceiptsPage() {
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<MiscRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MiscRow>>(
        "miscellaneous-receipts",
        { query: { page, per_page: 20 } },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las recepciones misceláneas.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recepciones misceláneas
          </h1>
          <p className="text-muted-foreground text-sm">
            Recepciones con comprobantes adjuntos.
          </p>
        </div>
        <Button type="button" asChild>
          <Link to="/miscelaneos/nuevo">Nueva recepción</Link>
        </Button>
      </div>

      <Button type="button" variant="secondary" onClick={() => void load()}>
        Actualizar
      </Button>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Adjuntos</TableHead>
              <TableHead>Notas</TableHead>
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
                  Sin registros.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>
                    {r.received_at
                      ? String(r.received_at).slice(0, 10)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.material
                      ? `${r.material.sku} · ${r.material.name}`
                      : `#${r.material_id}`}
                  </TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>{r.attachments_count ?? 0}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {r.notes ?? "—"}
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
