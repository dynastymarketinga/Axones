"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  CalendarDays,
  Droplets,
  Layers,
  ListOrdered,
  Package,
  UserCircle,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated } from "@/types/api"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import { CatalogTableHead } from "@/components/axones/CatalogTableHead"
import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const MIX_SEARCH_DEBOUNCE_MS = 320

type MixRow = {
  id: number
  created_at: string
  output_material?: { sku: string; name: string }
  creator?: { name: string }
  components_count?: number
}

export default function TintaMixturesPage() {
  const [page, setPage] = useState(1)
  const [qInput, setQInput] = useState("")
  const [qApi, setQApi] = useState("")
  const qDebounceRef = useRef<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<MixRow> | null>(null)

  useEffect(() => {
    if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    qDebounceRef.current = window.setTimeout(() => {
      setQApi(qInput.trim())
    }, MIX_SEARCH_DEBOUNCE_MS)
    return () => {
      if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    }
  }, [qInput])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MixRow>>("tinta-mixtures", {
        query: {
          page,
          per_page: 20,
          q: qApi || undefined,
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las mezclas.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, qApi])

  useEffect(() => {
    void load()
  }, [load])

  const showInitialSkeleton = loading && rows === null
  const rowStart = rows ? (rows.current_page - 1) * rows.per_page : 0

  return (
    <CatalogPageShell
      title="Mezclas de tinta"
      subtitle="Listado de mezclas y lotes de tinta."
      icon={Droplets}
      action={
        <Button type="button" variant="outline" onClick={() => void load()}>
          Actualizar
        </Button>
      }
    >
      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <CatalogFilterGrid>
            <CatalogSearchField
              id="mix-q"
              label="Buscar (material de salida, SKU o creador)"
              placeholder="Nombre, SKU…"
              value={qInput}
              onChange={(ev) => {
                setPage(1)
                setQInput(ev.target.value)
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  setPage(1)
                  setQApi(ev.currentTarget.value.trim())
                }
              }}
              className="min-w-0 md:col-span-12"
            />
            <p className="text-muted-foreground text-xs md:col-span-12">
              Filtra al escribir (demora breve). Pulse Actualizar para forzar recarga desde el servidor.
            </p>
          </CatalogFilterGrid>

          <div className="bg-card w-full min-w-0 overflow-x-auto rounded-2xl border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={ListOrdered} className="w-14">
                    N.º
                  </CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays} className="whitespace-nowrap">
                    Fecha
                  </CatalogTableHead>
                  <CatalogTableHead icon={Package}>Material salida</CatalogTableHead>
                  <CatalogTableHead icon={UserCircle}>Creador</CatalogTableHead>
                  <CatalogTableHead icon={Layers}>Componentes</CatalogTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={5} />
                ) : !rows?.data.length ? (
                  <TableRow className={catalogTableBodyRowClass}>
                    <TableCell
                      colSpan={5}
                      className={cn("text-muted-foreground", catalogTableBodyCellClass)}
                    >
                      Sin mezclas con estos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((m, index) => {
                    const n = rowStart + index + 1
                    return (
                      <TableRow key={m.id} className={catalogTableBodyRowClass}>
                        <TableCell
                          className={cn(
                            "tabular-nums text-muted-foreground w-14",
                            catalogTableBodyCellClass,
                          )}
                        >
                          {n}
                        </TableCell>
                        <TableCell className={cn("whitespace-nowrap", catalogTableBodyCellClass)}>
                          {m.created_at
                            ? String(m.created_at).slice(0, 19).replace("T", " ")
                            : "—"}
                        </TableCell>
                        <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>
                          {m.output_material
                            ? `${m.output_material.sku} · ${m.output_material.name}`
                            : "—"}
                        </TableCell>
                        <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>
                          {m.creator?.name ?? "—"}
                        </TableCell>
                        <TableCell className={cn(catalogTableBodyCellClass)}>
                          {m.components_count ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {rows && rows.last_page > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
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
        </>
      )}
    </CatalogPageShell>
  )
}
