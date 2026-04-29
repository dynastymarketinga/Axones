"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, VendorRecord } from "@/types/api"
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

export default function ClientsPage() {
  const location = useLocation()
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [vendorFilter, setVendorFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ClientRecord> | null>(null)
  const [vendors, setVendors] = useState<VendorRecord[]>([])

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (page > 1) params.set("page", String(page))
    if (vendorFilter !== "all") params.set("vendor_id", vendorFilter)
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, search, vendorFilter])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<VendorRecord>>("vendors", {
          query: { per_page: 100, page: 1, active: 1 },
        })
        if (!cancelled) setVendors(res.data)
      } catch {
        if (!cancelled) setVendors([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const vid = vendorFilter !== "all" ? Number(vendorFilter) : undefined
      const data = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
        query: { q: search || undefined, vendor_id: vid, page, per_page: 20 },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.message)
      } else {
        toast.error("No se pudo cargar la lista de clientes.")
      }
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, search, vendorFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de clientes del sistema.
          </p>
        </div>
        <Button type="button" asChild>
          <Link to="/clientes/form" state={{ from }}>
            Nuevo cliente
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-2">
          <label className="text-sm font-medium" htmlFor="client-q">
            Buscar
          </label>
          <Input
            id="client-q"
            placeholder="Nombre, RIF o ciudad…"
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
        <div className="grid w-full gap-2 lg:w-64">
          <Label>Vendedor</Label>
          <Select
            value={vendorFilter}
            onValueChange={(v) => {
              setVendorFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="shrink-0"
          onClick={() => {
            setPage(1)
            setSearch(q.trim())
          }}
        >
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RIF</TableHead>
              <TableHead>Estado / Ciudad</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Editar</TableHead>
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
                  No hay clientes{search ? " con ese criterio" : ""}.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.rif ?? "—"}</TableCell>
                  <TableCell>
                    {[c.state, c.city].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>{c.vendor?.name ?? c.vendor_name ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link to={`/clientes/form?id=${c.id}`} state={{ from }}>
                        Editar
                      </Link>
                    </Button>
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
            Página {rows.current_page} de {rows.last_page} · {rows.total}{" "}
            registros
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
              onClick={() =>
                setPage((p) => Math.min(rows.last_page, p + 1))
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
