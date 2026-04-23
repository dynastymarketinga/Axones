"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function WorkOrdersPage() {
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>(
        "work-orders",
        {
          query: {
            page,
            per_page: 20,
            client_order_reference: search || undefined,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes de trabajo.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Órdenes de trabajo
          </h1>
          <p className="text-muted-foreground text-sm">
            Documento maestro · <code>/work-orders</code>
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/axones/ordenes-trabajo">Ir a órdenes de trabajo</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="wo-ref">Ref. pedido cliente</Label>
          <Input
            id="wo-ref"
            placeholder="Texto en referencia…"
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                setPage(1)
                setSearch(q.trim())
              }
            }}
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            setPage(1)
            setSearch(q.trim())
          }}
        >
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tablero</TableHead>
              <TableHead></TableHead>
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
                  Sin órdenes.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.code}</TableCell>
                  <TableCell>{o.client?.name ?? "—"}</TableCell>
                  <TableCell>{o.product?.name ?? "—"}</TableCell>
                  <TableCell>{o.status}</TableCell>
                  <TableCell>{o.board_stage ?? "—"}</TableCell>
                  <TableCell>
                    <Link
                      className="text-primary text-sm underline-offset-4 hover:underline"
                      to={`/axones/ordenes-trabajo/${o.id}`}
                    >
                      Abrir
                    </Link>
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
