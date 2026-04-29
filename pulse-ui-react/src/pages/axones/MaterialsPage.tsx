"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
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

const AREAS = [
  "material",
  "tintas",
  "cementerio_tintas",
  "quimicos",
  "bobinas_rechazadas",
  "miscelaneos",
]

export default function MaterialsPage() {
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [area, setArea] = useState<string>("all")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<MaterialRow> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: {
          q: search || undefined,
          page,
          per_page: 30,
          inventory_area: area !== "all" ? area : undefined,
          include_inactive: status === "all" ? "1" : undefined,
          is_active: status === "active" ? "1" : status === "inactive" ? "0" : undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar los materiales.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, search, area, status])

  async function toggleActive(row: MaterialRow) {
    try {
      await apiFetch<MaterialRow>(`materials/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !(row.is_active ?? true) }),
      })
      toast.success(`Material ${row.is_active ? "inactivado" : "activado"}.`)
      await load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo actualizar el estado del material.")
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Materiales</h1>
        <p className="text-muted-foreground text-sm">
          Existencias por SKU y por área de almacén.
        </p>
      </div>

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/materiales/nuevo">Nuevo material</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="mat-q">Buscar</Label>
          <Input
            id="mat-q"
            placeholder="SKU, nombre, código de barras…"
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
        <div className="grid w-full gap-2 lg:w-56">
          <Label>Área</Label>
          <Select
            value={area}
            onValueChange={(v) => {
              setArea(v)
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
        <div className="grid w-full gap-2 lg:w-52">
          <Label>Estado</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as "all" | "active" | "inactive")
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
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
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mín.</TableHead>
              <TableHead>Unidad</TableHead>
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
                  Sin materiales.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.inventory_area}</TableCell>
                  <TableCell>{m.is_active ?? true ? "Activo" : "Inactivo"}</TableCell>
                  <TableCell>{m.quantity_on_hand}</TableCell>
                  <TableCell>{m.min_stock}</TableCell>
                  <TableCell>{m.unit}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/materiales/${m.id}/editar`}>Editar</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void toggleActive(m)}
                      >
                        {m.is_active ?? true ? "Inactivar" : "Activar"}
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
