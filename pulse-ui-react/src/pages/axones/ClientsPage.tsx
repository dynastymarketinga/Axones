"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ListOrdered, Search, Tags } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated } from "@/types/api"
import { LoadingButtonLabel, LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
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

const CLIENT_FORM_NAV_DELAY_MS = 180

export default function ClientsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ClientRecord> | null>(null)
  const [creatingClient, setCreatingClient] = useState(false)

  const from = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (page > 1) params.set("page", String(page))
    const qs = params.toString()
    return `${location.pathname}${qs ? `?${qs}` : ""}`
  }, [location.pathname, page, search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
        query: { q: search || undefined, page, per_page: 20 },
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
  }, [page, search])

  useEffect(() => {
    void load()
  }, [load])

  const showInitialSkeleton = loading && rows === null

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            Catálogo de clientes del sistema.
          </p>
        </div>
        <Button
          type="button"
          disabled={creatingClient}
          onClick={() => {
            if (creatingClient) return
            setCreatingClient(true)
            window.setTimeout(() => {
              navigate("/clientes/form", { state: { from } })
            }, CLIENT_FORM_NAV_DELAY_MS)
          }}
        >
          <LoadingButtonLabel loading={creatingClient} loadingText="Abriendo..." idleText="Nuevo cliente" />
        </Button>
      </div>

      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12">
            <div className="grid gap-2 xl:col-span-10">
              <Label
                htmlFor="client-q"
                className="inline-flex items-center gap-2 font-semibold text-foreground"
              >
                <Tags className="h-4 w-4 text-primary" />
                Buscar
              </Label>
              <Input
                id="client-q"
                placeholder="Nombre, RIF o ciudad…"
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

          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-foreground">
                    <ListOrdered className="h-4 w-4" />
                  </TableHead>
                  <TableHead className="font-bold text-foreground">Nombre</TableHead>
                  <TableHead className="font-bold text-foreground">RIF</TableHead>
                  <TableHead className="font-bold text-foreground">Estado / Ciudad</TableHead>
                  <TableHead className="font-bold text-foreground">Correo</TableHead>
                  <TableHead className="font-bold text-foreground">Teléfono</TableHead>
                  <TableHead className="text-right font-bold text-foreground">Editar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={7} />
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No hay clientes{search ? " con ese criterio" : ""}.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((c) => (
                    <TableRow
                      key={c.id}
                      className="group hover:bg-transparent data-[state=selected]:bg-transparent focus-within:bg-transparent"
                    >
                      <TableCell className="transition-colors group-hover:bg-muted/60">
                        #{c.id}
                      </TableCell>
                      <TableCell className="font-medium transition-colors group-hover:bg-muted/60">{c.name}</TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">{c.rif ?? "—"}</TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">
                        {[c.state, c.city].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">{c.email ?? "—"}</TableCell>
                      <TableCell className="transition-colors group-hover:bg-muted/60">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-right transition-colors group-hover:bg-muted/60">
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
        </>
      )}
    </div>
  )
}
