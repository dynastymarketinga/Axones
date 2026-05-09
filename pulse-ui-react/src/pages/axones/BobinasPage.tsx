"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { AxonesInventoryModuleNav } from "@/components/axones/inventory-page-layout"
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
  code?: string | null
  material_id?: number
  status: string
  weight_kg: string | null
  material?: { sku: string; name: string; supplier?: { id: number; name: string } | null }
  inventory_return?: { work_order_id: number | null }
}

function bobinaStatusLabel(status: string): string {
  if (status === "available") return "Disponible"
  if (status === "issued") return "Despachada"
  if (status === "consumed") return "Consumida"
  if (status === "rejected") return "Rechazada"
  return status
}

export default function BobinasPage() {
  const [status, setStatus] = useState<string>("all")
  const [materialId, setMaterialId] = useState<string>("all")
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<BobinaRow> | null>(null)

  const loadMaterials = useCallback(async () => {
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { per_page: 200, page: 1 },
      })
      setMaterials(data.data ?? [])
    } catch {
      setMaterials([])
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<BobinaRow>>("bobinas", {
        query: {
          page,
          per_page: 50,
          status: status !== "all" ? status : undefined,
          material_id: materialId !== "all" ? materialId : undefined,
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
  }, [page, status, materialId])

  useEffect(() => {
    void loadMaterials()
  }, [loadMaterials])

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
          <Button type="button" variant="default" size="sm" asChild>
            <Link to="/bobinas/nueva">Registrar</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/devoluciones">Devoluciones</Link>
          </Button>
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link to="/bobinas/registrar-rechazada">Registrar bobina rechazada</Link>
          </Button>
        </div>
      </div>

      <AxonesInventoryModuleNav active="bobinas" />

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-56 gap-2">
          <Label>Material</Label>
          <Select
            value={materialId}
            onValueChange={(v) => {
              setMaterialId(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los materiales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los materiales</SelectItem>
              {materials.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.sku} · {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              <SelectItem value="available">{bobinaStatusLabel("available")}</SelectItem>
              <SelectItem value="issued">{bobinaStatusLabel("issued")}</SelectItem>
              <SelectItem value="consumed">{bobinaStatusLabel("consumed")}</SelectItem>
              <SelectItem value="rejected">{bobinaStatusLabel("rejected")}</SelectItem>
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
              <TableHead>Material</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Peso kg</TableHead>
              <TableHead>OT devolución</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Sin bobinas.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.id}</TableCell>
                  <TableCell className="font-mono text-sm">{b.code?.trim() ? b.code : "—"}</TableCell>
                  <TableCell>
                    {b.material
                      ? `${b.material.sku} · ${b.material.name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[10rem] truncate" title={b.material?.supplier?.name ?? undefined}>
                    {b.material?.supplier?.name?.trim() ? b.material.supplier.name : "—"}
                  </TableCell>
                  <TableCell>{bobinaStatusLabel(b.status)}</TableCell>
                  <TableCell>{b.weight_kg ?? "—"}</TableCell>
                  <TableCell>
                    {b.inventory_return?.work_order_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                        <Link to={`/bobinas/${b.id}`}>Visualizar</Link>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                        <Link to={`/bobinas/${b.id}/editar`}>Editar</Link>
                      </Button>
                    </div>
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
