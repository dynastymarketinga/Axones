"use client"

import { useCallback, useEffect, useState } from "react"
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

type NoteRow = {
  id: number
  code: string | null
  sequential_number: number | null
  status: string
  document_date: string | null
  work_order_id: number | null
  work_order?: { code: string; client?: { name: string } }
}

function deliveryNoteStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Borrador"
    case "dispatched":
      return "Despachada"
    case "cancelled":
      return "Cancelada"
    default:
      return status
  }
}

export default function DeliveryNotesPage() {
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<NoteRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<NoteRow>>("delivery-notes", {
        query: {
          page,
          per_page: 20,
          status: status !== "all" ? status : undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las notas de entrega.")
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Notas de entrega
        </h1>
        <p className="text-muted-foreground text-sm">
          Listado de notas emitidas y su estado.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-44 gap-2">
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
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="dispatched">Despachada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
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
              <TableHead>Código</TableHead>
              <TableHead>Nº sec.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha doc.</TableHead>
              <TableHead>OT</TableHead>
              <TableHead>Cliente</TableHead>
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
                  Sin notas.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.id}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {n.code ?? "—"}
                  </TableCell>
                  <TableCell>{n.sequential_number ?? "—"}</TableCell>
                  <TableCell>{deliveryNoteStatusLabel(n.status)}</TableCell>
                  <TableCell>
                    {n.document_date ? String(n.document_date).slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell>
                    {n.work_order?.code ?? n.work_order_id ?? "—"}
                  </TableCell>
                  <TableCell>{n.work_order?.client?.name ?? "—"}</TableCell>
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
