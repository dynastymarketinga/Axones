"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const AREAS = [
  { value: "all", label: "Todos" },
  { value: "material", label: "Sustrato" },
  { value: "tintas", label: "Tintas" },
  { value: "cementerio_tintas", label: "Cementerio tintas" },
  { value: "quimicos", label: "Químicos" },
  { value: "bobinas_rechazadas", label: "Bobinas rechazadas" },
  { value: "miscelaneos", label: "Misceláneos" },
] as const

type AreaValue = (typeof AREAS)[number]["value"]
type SortBy = "sku" | "name" | "quantity_on_hand"
type SortDir = "asc" | "desc"
type StockState = "all" | "sin_stock" | "bajo_minimo" | "ok"
type TintaSubarea = "all" | "laminacion" | "superficie" | "prueba_laminacion" | "laminacion_nueva"

function areaLabel(area: string) {
  if (area === "all") return "Todas"
  if (area === "material") return "Sustrato"
  if (area === "tintas") return "Tintas"
  if (area === "cementerio_tintas") return "Cementerio tintas"
  if (area === "quimicos") return "Químicos"
  if (area === "bobinas_rechazadas") return "Bobinas rechazadas"
  if (area === "miscelaneos") return "Misceláneos"
  return area
}

function formatToTwoDecimals(value: string | number | null | undefined) {
  const n = Number(String(value ?? "0").replace(",", "."))
  if (!Number.isFinite(n)) return "0.00"
  return n.toFixed(2)
}

export default function MaterialsPage() {
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [activeArea, setActiveArea] = useState<AreaValue>("all")
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [stockState, setStockState] = useState<StockState>("all")
  const [unit, setUnit] = useState("all")
  const [tintaSubarea, setTintaSubarea] = useState<TintaSubarea>("all")
  const [stockMin, setStockMin] = useState("")
  const [stockMax, setStockMax] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<MaterialRow> | null>(null)

  const showDimensions = activeArea === "material" || activeArea === "bobinas_rechazadas"
  const showTintaSubareaFilter = activeArea === "all" || activeArea === "tintas"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: {
          q: search || undefined,
          page,
          per_page: 30,
          inventory_area: activeArea !== "all" ? activeArea : undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
          stock_state: stockState !== "all" ? stockState : undefined,
          unit: unit !== "all" ? unit : undefined,
          tinta_subarea: tintaSubarea !== "all" ? tintaSubarea : undefined,
          stock_min: stockMin.trim() ? stockMin.trim() : undefined,
          stock_max: stockMax.trim() ? stockMax.trim() : undefined,
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
  }, [page, search, activeArea, sortBy, sortDir, stockState, unit, tintaSubarea, stockMin, stockMax])

  useEffect(() => {
    void load()
  }, [load])

  const showInitialSkeleton = loading && rows === null

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Materiales</h1>
        <p className="text-muted-foreground text-sm">
          Gestión de stock por área con búsqueda y edición.
        </p>
      </div>

      <Tabs
        value={activeArea}
        onValueChange={(value) => {
          setActiveArea(value as AreaValue)
          if (value !== "all" && value !== "tintas") {
            setTintaSubarea("all")
          }
          setPage(1)
        }}
        className="w-full"
      >
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {AREAS.map((a) => (
            <TabsTrigger key={a.value} value={a.value} className="text-xs sm:text-sm">
              {a.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/materiales/nuevo">Nuevo material</Link>
        </Button>
      </div>

      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-primary/20 bg-card/70 p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="grid gap-2 lg:col-span-2">
                <Label htmlFor="mat-q">Buscar</Label>
                <Input
                  id="mat-q"
                  placeholder="Código o nombre…"
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
              <div className="grid gap-2">
                <Label>Ordenar por</Label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value as SortBy)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nombre</SelectItem>
                    <SelectItem value="sku">SKU</SelectItem>
                    <SelectItem value="quantity_on_hand">Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Dirección</Label>
                <Select
                  value={sortDir}
                  onValueChange={(value) => {
                    setSortDir(value as SortDir)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascendente</SelectItem>
                    <SelectItem value="desc">Descendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Estado de stock</Label>
                <Select
                  value={stockState}
                  onValueChange={(value) => {
                    setStockState(value as StockState)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sin_stock">Sin stock</SelectItem>
                    <SelectItem value="bajo_minimo">Bajo mínimo</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Unidad</Label>
                <Select
                  value={unit}
                  onValueChange={(value) => {
                    setUnit(value)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="unidad">unidad</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="rollo">rollo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Subárea de tintas</Label>
                <Select
                  value={tintaSubarea}
                  onValueChange={(value) => {
                    setTintaSubarea(value as TintaSubarea)
                    setPage(1)
                  }}
                  disabled={!showTintaSubareaFilter}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="laminacion">Laminación</SelectItem>
                    <SelectItem value="superficie">Superficie</SelectItem>
                    <SelectItem value="prueba_laminacion">Prueba laminación</SelectItem>
                    <SelectItem value="laminacion_nueva">Laminación nueva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-min">Stock mínimo (rango)</Label>
                <Input
                  id="stock-min"
                  type="number"
                  min="0"
                  step="0.001"
                  value={stockMin}
                  onChange={(ev) => {
                    setStockMin(ev.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-max">Stock máximo (rango)</Label>
                <Input
                  id="stock-max"
                  type="number"
                  min="0"
                  step="0.001"
                  value={stockMax}
                  onChange={(ev) => {
                    setStockMax(ev.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQ("")
                  setSearch("")
                  setSortBy("name")
                  setSortDir("asc")
                  setStockState("all")
                  setUnit("all")
                  setTintaSubarea("all")
                  setStockMin("")
                  setStockMax("")
                  setPage(1)
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>

          <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  {showDimensions ? <TableHead>Micras (u)</TableHead> : null}
                  {showDimensions ? <TableHead>Ancho (mm)</TableHead> : null}
                  <TableHead>Stock</TableHead>
                  <TableHead>Mín.</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={showDimensions ? 9 : 7} />
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={showDimensions ? 9 : 7} className="text-muted-foreground">
                      Sin materiales.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                      <TableCell>{m.name}</TableCell>
                      <TableCell>{areaLabel(m.inventory_area)}</TableCell>
                      {showDimensions ? <TableCell>{m.micras ?? "-"}</TableCell> : null}
                      {showDimensions ? <TableCell>{m.ancho ?? "-"}</TableCell> : null}
                      <TableCell>{formatToTwoDecimals(m.quantity_on_hand)}</TableCell>
                      <TableCell>{formatToTwoDecimals(m.min_stock)}</TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/materiales/${m.id}/editar`}>Editar</Link>
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
        </>
      )}
    </div>
  )
}
