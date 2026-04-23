"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
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

export default function CorteDispatchPage() {
  const [wo, setWo] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const wid = wo.trim() ? Number(wo) : NaN
      const data = await apiFetch<{ rows: Record<string, unknown>[] }>(
        "corte-dispatch/available",
        {
          query: {
            work_order_id: Number.isFinite(wid) ? wid : undefined,
          },
        },
      )
      setRows(data.rows ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el disponible para despacho.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [wo])

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Despacho · saldo corte
        </h1>
        <p className="text-muted-foreground text-sm">
          Material terminado pendiente de nota de entrega ·{" "}
          <code>/corte-dispatch/available</code>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-40 gap-2">
          <Label htmlFor="cd-wo">OT id (opcional)</Label>
          <Input
            id="cd-wo"
            inputMode="numeric"
            placeholder="Todos"
            value={wo}
            onChange={(ev) => setWo(ev.target.value)}
          />
        </div>
        <Button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "…" : "Consultar"}
        </Button>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datos (JSON filas)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows.length ? (
              <TableRow>
                <TableCell className="text-muted-foreground">
                  {loading ? "Cargando…" : "Sin filas disponibles."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <pre className="max-w-[900px] overflow-x-auto text-xs">
                      {JSON.stringify(r, null, 2)}
                    </pre>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
