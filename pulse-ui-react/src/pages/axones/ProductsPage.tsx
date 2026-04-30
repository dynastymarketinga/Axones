"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Search, Tags, UserRound } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type {
  ClientRecord,
  LaravelPaginated,
  ProductRecord,
} from "@/types/api"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "—"
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export default function ProductsPage() {
  const location = useLocation()
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ProductRecord> | null>(
    null,
  )
  const [clients, setClients] = useState<ClientRecord[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 100, page: 1 },
        })
        if (!cancelled) setClients(res.data)
      } catch {
        if (!cancelled) setClients([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (page > 1) params.set("page", String(page))
    if (clientFilter !== "all") params.set("client_id", clientFilter)
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [clientFilter, location.pathname, page, search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const clientId =
        clientFilter !== "all" ? Number(clientFilter) : undefined
      const data = await apiFetch<LaravelPaginated<ProductRecord>>("products", {
        query: {
          q: search || undefined,
          page,
          per_page: 20,
          client_id: clientId,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.message)
      } else {
        toast.error("No se pudo cargar la lista de productos.")
      }
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, search, clientFilter])

  useEffect(() => {
    void load()
  }, [load])

  const showInitialSkeleton = loading && rows === null

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-muted-foreground text-sm">
            Nombre, CPE, MPS, tipo de impresión y estructura.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" asChild>
            <Link to="/productos/form" state={{ from }}>
              Nuevo producto
            </Link>
          </Button>
        </div>
      </div>

      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12">
            <div className="grid gap-2 xl:col-span-6">
              <Label
                htmlFor="product-q"
                className="inline-flex items-center gap-2 font-semibold text-foreground"
              >
                <Tags className="h-4 w-4 text-primary" />
                Buscar
              </Label>
              <Input
                id="product-q"
                placeholder="Nombre, CPE o MPS…"
                value={q}
                className="border-primary/25 bg-background/90 focus-visible:ring-primary/40"
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    setPage(1)
                    setSearch(q.trim())
                  }
                }}
              />
            </div>
            <div className="grid gap-2 xl:col-span-4">
              <Label className="inline-flex items-center gap-2 font-semibold text-foreground">
                <UserRound className="h-4 w-4 text-primary" />
                Cliente
              </Label>
              <Select
                value={clientFilter}
                onValueChange={(v) => {
                  setClientFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full border-primary/25 bg-background/90 focus:ring-primary/40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full items-end gap-2 xl:col-span-2 xl:justify-end">
              <Button
                type="button"
                className="flex-1 px-3 sm:min-w-28 sm:px-4 lg:flex-1 xl:min-w-40 xl:flex-none xl:px-6"
                onClick={() => {
                  setPage(1)
                  setSearch(q.trim())
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>

          <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-foreground">Nombre</TableHead>
                  <TableHead className="font-bold text-foreground">Cliente</TableHead>
                  <TableHead className="font-bold text-foreground">CPE</TableHead>
                  <TableHead className="font-bold text-foreground">M.P.P.S</TableHead>
                  <TableHead className="font-bold text-foreground">Tipo impresión</TableHead>
                  <TableHead className="min-w-[180px] font-bold text-foreground">Estructura</TableHead>
                  <TableHead className="text-right font-bold text-foreground">Editar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={7} />
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No hay productos{search ? " con ese criterio" : ""}.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((p) => (
                    <TableRow
                      key={p.id}
                      className="group hover:bg-transparent data-[state=selected]:bg-transparent focus-within:bg-transparent"
                    >
                      <TableCell className="font-medium transition-colors group-hover:bg-muted/60">{p.name}</TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">{p.client?.name ?? "—"}</TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">{p.cpe ?? "—"}</TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">{p.mps ?? "—"}</TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">{p.print_type ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[240px] text-muted-foreground text-sm transition-colors group-hover:bg-muted/60"
                        title={p.structure ?? undefined}
                      >
                        {truncate(p.structure, 80)}
                      </TableCell>
                      <TableCell className="text-right transition-colors group-hover:bg-muted/60">
                        <Button variant="link" className="h-auto p-0" asChild>
                          <Link to={`/productos/form?id=${p.id}`} state={{ from }}>
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
        </>
      )}
    </div>
  )
}
