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

type ReceiptRow = {
  id: number
  purchase_order_id: number | null
  without_purchase_order: boolean
  received_at: string | null
  lines_count?: number
  purchase_order?: {
    code: string
    supplier?: { name: string }
  }
}

export default function PurchaseReceiptsPage() {
  const [withoutPo, setWithoutPo] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ReceiptRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ReceiptRow>>(
        "purchase-receipts",
        {
          query: {
            page,
            per_page: 20,
            without_purchase_order:
              withoutPo === "yes"
                ? 1
                : withoutPo === "no"
                  ? 0
                  : undefined,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las recepciones.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, withoutPo])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recepciones (OC)
          </h1>
          <p className="text-muted-foreground text-sm">
            Ingreso casado con orden de compra · <code>/purchase-receipts</code>
          </p>
        </div>
        <Button type="button" asChild>
          <Link to="/axones/recepciones-nueva">Nueva recepción</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-56 gap-2">
          <Label>Sin / con OC</Label>
          <Select
            value={withoutPo}
            onValueChange={(v) => {
              setWithoutPo(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="no">Con orden de compra</SelectItem>
              <SelectItem value="yes">Sin orden (stock)</SelectItem>
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
              <TableHead>Fecha recepción</TableHead>
              <TableHead>OC</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Sin OC</TableHead>
              <TableHead>Líneas</TableHead>
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
                  Sin recepciones.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>
                    {r.received_at
                      ? String(r.received_at).slice(0, 19).replace("T", " ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.purchase_order?.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.purchase_order?.supplier?.name ?? "—"}
                  </TableCell>
                  <TableCell>{r.without_purchase_order ? "Sí" : "No"}</TableCell>
                  <TableCell>{r.lines_count ?? "—"}</TableCell>
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
