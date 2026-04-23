"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type {
  LaravelPaginated,
  PurchaseOrderRow,
  SupplierRecord,
} from "@/types/api"
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

export default function PurchaseOrdersPage() {
  const location = useLocation()
  const [supplierId, setSupplierId] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<PurchaseOrderRow> | null>(
    null,
  )
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set("page", String(page))
    if (supplierId !== "all") params.set("supplier_id", supplierId)
    if (status !== "all") params.set("status", status)
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, status, supplierId])

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<SupplierRecord>>(
          "suppliers",
          { query: { per_page: 100, page: 1 } },
        )
        if (!c) setSuppliers(res.data)
      } catch {
        if (!c) setSuppliers([])
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sid =
        supplierId !== "all" ? Number(supplierId) : undefined
      const st = status !== "all" ? status : undefined
      const data = await apiFetch<LaravelPaginated<PurchaseOrderRow>>(
        "purchase-orders",
        {
          query: {
            page,
            per_page: 20,
            supplier_id: sid,
            status: st,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes de compra.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, supplierId, status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Órdenes de compra
          </h1>
          <p className="text-muted-foreground text-sm">
            Material solicitado a proveedores · <code>/purchase-orders</code>
          </p>
        </div>
        <Button type="button" asChild>
          <Link to="/axones/ordenes-compra/nueva" state={{ from }}>
            Nueva OC
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid w-full gap-2 lg:w-56">
          <Label>Proveedor</Label>
          <Select
            value={supplierId}
            onValueChange={(v) => {
              setSupplierId(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full gap-2 lg:w-48">
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
              <SelectItem value="open">open</SelectItem>
              <SelectItem value="partial">partial</SelectItem>
              <SelectItem value="completed">completed</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          <Search className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Líneas</TableHead>
              <TableHead>Fecha</TableHead>
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
                  Sin órdenes.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.code}</TableCell>
                  <TableCell>{r.supplier?.name ?? `#${r.supplier_id}`}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.lines_count ?? "—"}</TableCell>
                  <TableCell>
                    {r.ordered_at
                      ? String(r.ordered_at).slice(0, 10)
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
