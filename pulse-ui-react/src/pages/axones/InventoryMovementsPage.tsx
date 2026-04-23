"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { InventoryMovementRow, LaravelPaginated } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const MOVEMENT_TYPES = ["in", "out", "adjustment_add", "adjustment_sub"]
const AREAS = [
  "material",
  "tintas",
  "cementerio_tintas",
  "quimicos",
  "bobinas_rechazadas",
  "miscelaneos",
]

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export default function InventoryMovementsPage() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [movementType, setMovementType] = useState<string>("all")
  const [inventoryArea, setInventoryArea] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<InventoryMovementRow> | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<InventoryMovementRow>>(
        "inventory-movements",
        {
          query: {
            from,
            to,
            page,
            per_page: 50,
            movement_type:
              movementType !== "all" ? movementType : undefined,
            inventory_area:
              inventoryArea !== "all" ? inventoryArea : undefined,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar los movimientos.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, page, movementType, inventoryArea])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Movimientos de inventario
        </h1>
        <p className="text-muted-foreground text-sm">
          Entradas y salidas · <code>/inventory-movements</code>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div className="grid gap-2">
          <Label>Desde</Label>
          <Input
            type="date"
            value={from}
            onChange={(ev) => {
              setFrom(ev.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={to}
            onChange={(ev) => {
              setTo(ev.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Tipo</Label>
          <Select
            value={movementType}
            onValueChange={(v) => {
              setMovementType(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MOVEMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Área inventario</Label>
          <Select
            value={inventoryArea}
            onValueChange={(v) => {
              setInventoryArea(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={() => void load()}>
            Aplicar
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Ref.</TableHead>
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
                  Sin movimientos en el rango.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {m.occurred_at?.replace("T", " ").slice(0, 19)}
                  </TableCell>
                  <TableCell>{m.movement_type}</TableCell>
                  <TableCell>
                    {m.material
                      ? `${m.material.sku} · ${m.material.name}`
                      : "—"}
                  </TableCell>
                  <TableCell>{m.material?.inventory_area ?? "—"}</TableCell>
                  <TableCell>
                    {m.quantity} {m.material?.unit ?? ""}
                  </TableCell>
                  <TableCell>{m.user?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {m.reference_type && m.reference_id != null
                      ? `${m.reference_type} #${m.reference_id}`
                      : "—"}
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
