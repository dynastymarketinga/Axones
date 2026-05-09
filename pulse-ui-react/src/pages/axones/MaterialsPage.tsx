"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import {
  AXONES_INVENTORY_FILTER_INPUT_CLASS,
  AXONES_INVENTORY_PAGE_CLASS,
  AxonesInventoryModuleNav,
  AxonesPageHeader,
  AxonesTableCard,
} from "@/components/axones/inventory-page-layout"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import { getMaterialAreaTheme, getMaterialsListTabTheme } from "@/lib/material-area-theme"
import { cn } from "@/lib/utils"
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
  { value: "quimicos", label: "Químicos" },
  { value: "miscelaneos", label: "Misceláneos" },
] as const

type AreaValue = (typeof AREAS)[number]["value"]
type SortBy = "sku" | "name" | "quantity_on_hand"
type SortDir = "asc" | "desc"
type StockState = "all" | "sin_stock" | "bajo_minimo" | "ok"
type TintaSubarea = "all" | "laminacion" | "superficie" | "prueba_laminacion" | "laminacion_nueva"

type SortPreset =
  | "name_asc"
  | "name_desc"
  | "sku_asc"
  | "sku_desc"
  | "stock_asc"
  | "stock_desc"

const SORT_PRESET_MAP: Record<SortPreset, { sortBy: SortBy; sortDir: SortDir }> = {
  name_asc: { sortBy: "name", sortDir: "asc" },
  name_desc: { sortBy: "name", sortDir: "desc" },
  sku_asc: { sortBy: "sku", sortDir: "asc" },
  sku_desc: { sortBy: "sku", sortDir: "desc" },
  stock_asc: { sortBy: "quantity_on_hand", sortDir: "asc" },
  stock_desc: { sortBy: "quantity_on_hand", sortDir: "desc" },
}

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

const SEARCH_DEBOUNCE_MS = 350

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true
  return e instanceof Error && e.name === "AbortError"
}

export default function MaterialsPage() {
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [activeArea, setActiveArea] = useState<AreaValue>("all")
  const [sortPreset, setSortPreset] = useState<SortPreset>("name_asc")
  const [stockState, setStockState] = useState<StockState>("all")
  const [tintaSubarea, setTintaSubarea] = useState<TintaSubarea>("all")
  const [stockMin, setStockMin] = useState("")
  const [stockMax, setStockMax] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<MaterialRow> | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)

  const showDimensions = activeArea === "material"
  const showTintaSubareaFilter = activeArea === "all" || activeArea === "tintas"

  const { sortBy, sortDir } = SORT_PRESET_MAP[sortPreset]

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQ(q.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const load = useCallback(async () => {
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>(
        "materials",
        {
          query: {
            q: debouncedQ || undefined,
            page,
            per_page: 30,
            inventory_area: activeArea !== "all" ? activeArea : undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
            stock_state: stockState !== "all" ? stockState : undefined,
            tinta_subarea: tintaSubarea !== "all" ? tintaSubarea : undefined,
            stock_min: stockMin.trim() ? stockMin.trim() : undefined,
            stock_max: stockMax.trim() ? stockMax.trim() : undefined,
          },
          signal: ac.signal,
        },
      )
      if (ac.signal.aborted) return
      setRows(data)
    } catch (e) {
      if (isAbortError(e)) return
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar los materiales.")
      if (!ac.signal.aborted) setRows(null)
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [page, debouncedQ, activeArea, sortBy, sortDir, stockState, tintaSubarea, stockMin, stockMax])

  useEffect(() => {
    void load()
  }, [load])

  const showInitialSkeleton = loading && rows === null

  return (
    <div className={AXONES_INVENTORY_PAGE_CLASS}>
      <AxonesPageHeader
        title="Materiales (insumos)"
        description="Sustratos, tintas, químicos y misceláneos con stock por área. No incluye producto terminado: el terminado se declara en Corte."
        actions={
          <Button asChild>
            <Link to="/materiales/nuevo">Nuevo material</Link>
          </Button>
        }
      />

      <AxonesInventoryModuleNav active="materiales" />

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
            <TabsTrigger
              key={a.value}
              value={a.value}
              className={cn("text-xs sm:text-sm", getMaterialsListTabTheme(a.value).tabTriggerClass)}
            >
              {a.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showInitialSkeleton ? (
        <div className="space-y-4">
          <PageLoadingBlock />
          <PageLoadingBlock />
        </div>
      ) : (
        <>
          <AxonesTableCard>
            <div className="border-b p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2 md:col-span-1">
                  <Label htmlFor="mat-q">Buscar</Label>
                  <div className="group/field relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary"
                      aria-hidden
                    />
                    <Input
                      id="mat-q"
                      placeholder="Código o nombre…"
                      value={q}
                      className={cn("min-w-0 pl-10", AXONES_INVENTORY_FILTER_INPUT_CLASS)}
                      onChange={(ev) => setQ(ev.target.value)}
                      autoComplete="off"
                    />
                  </div>
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
                    <SelectTrigger className={AXONES_INVENTORY_FILTER_INPUT_CLASS}>
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
                  <Label>Ordenar lista</Label>
                  <Select
                    value={sortPreset}
                    onValueChange={(value) => {
                      setSortPreset(value as SortPreset)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className={AXONES_INVENTORY_FILTER_INPUT_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name_asc">Nombre (A → Z)</SelectItem>
                      <SelectItem value="name_desc">Nombre (Z → A)</SelectItem>
                      <SelectItem value="sku_asc">SKU (A → Z)</SelectItem>
                      <SelectItem value="sku_desc">SKU (Z → A)</SelectItem>
                      <SelectItem value="stock_asc">Stock (menor primero)</SelectItem>
                      <SelectItem value="stock_desc">Stock (mayor primero)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-4">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
                    Más filtros
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div
                    className={cn(
                      "grid gap-4",
                      showTintaSubareaFilter ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
                    )}
                  >
                    {showTintaSubareaFilter ? (
                      <div className="grid gap-2">
                        <Label>Subárea (tintas)</Label>
                        <Select
                          value={tintaSubarea}
                          onValueChange={(value) => {
                            setTintaSubarea(value as TintaSubarea)
                            setPage(1)
                          }}
                        >
                          <SelectTrigger className={AXONES_INVENTORY_FILTER_INPUT_CLASS}>
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
                    ) : null}
                    <div className="grid gap-2">
                      <Label htmlFor="stock-min">Stock mín. (cantidad)</Label>
                      <Input
                        id="stock-min"
                        type="number"
                        min="0"
                        step="0.001"
                        className={AXONES_INVENTORY_FILTER_INPUT_CLASS}
                        value={stockMin}
                        onChange={(ev) => {
                          setStockMin(ev.target.value)
                          setPage(1)
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="stock-max">Stock máx. (cantidad)</Label>
                      <Input
                        id="stock-max"
                        type="number"
                        min="0"
                        step="0.001"
                        className={AXONES_INVENTORY_FILTER_INPUT_CLASS}
                        value={stockMax}
                        onChange={(ev) => {
                          setStockMax(ev.target.value)
                          setPage(1)
                        }}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQ("")
                    setDebouncedQ("")
                    setSortPreset("name_asc")
                    setStockState("all")
                    setTintaSubarea("all")
                    setStockMin("")
                    setStockMax("")
                    setAdvancedOpen(false)
                    setPage(1)
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="min-w-[8rem]">Proveedor</TableHead>
                  <TableHead>Área</TableHead>
                  {showDimensions ? <TableHead>Micras</TableHead> : null}
                  {showDimensions ? <TableHead>Ancho (mm)</TableHead> : null}
                  <TableHead className="text-right tabular-nums">Stock</TableHead>
                  <TableHead className="text-right tabular-nums">Mín.</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingTableRow colSpan={showDimensions ? 10 : 8} />
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={showDimensions ? 10 : 8} className="text-muted-foreground">
                      Sin materiales.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((m) => {
                    const areaTheme = getMaterialAreaTheme(m.inventory_area)
                    return (
                    <TableRow key={m.id} className={cn(areaTheme.rowClass, "[&>td]:bg-inherit")}>
                      <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                      <TableCell className="max-w-[14rem] font-medium">{m.name}</TableCell>
                      <TableCell
                        className={cn(
                          "max-w-[12rem] truncate",
                          m.supplier?.name?.trim() ? "" : "text-muted-foreground",
                        )}
                        title={m.supplier?.name?.trim() || undefined}
                      >
                        {m.supplier?.name?.trim() ? m.supplier.name : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{areaLabel(m.inventory_area)}</TableCell>
                      {showDimensions ? <TableCell>{m.micras ?? "—"}</TableCell> : null}
                      {showDimensions ? <TableCell>{m.ancho ?? "—"}</TableCell> : null}
                      <TableCell className="text-right tabular-nums">{formatToTwoDecimals(m.quantity_on_hand)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatToTwoDecimals(m.min_stock)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{m.unit}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/materiales/${m.id}/editar`}>Editar</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            </div>
          </AxonesTableCard>

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
