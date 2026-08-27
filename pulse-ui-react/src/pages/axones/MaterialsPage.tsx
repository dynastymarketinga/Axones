"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Barcode,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Scale,
  Settings2,
  SlidersHorizontal,
  Tag,
  Truck,
  Upload,
  Warehouse // <-- IMPORTANTE: Importamos el icono
} from "lucide-react"
import { toast } from "sonner"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogFilterCol3Class,
  catalogFilterCol4Class,
  catalogFilterCol5Class,
  catalogFilterGridClass,
  catalogPaginationOutlineButtonClass,
  catalogPaginationSelectTriggerClass,
  catalogSelectTriggerClass,
} from "@/components/axones/catalog-list-classes"
import { AxonesInventoryModuleNav } from "@/components/axones/inventory-page-layout"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { MaterialsVictorExcelDialog } from "@/components/axones/MaterialsVictorExcelDialog"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch, ApiError, isApiAbortError } from "@/lib/api"
import { exportVictorExcel, exportVictorTemplateExcel } from "@/lib/materials-victor-excel"
import { getStoredUser } from "@/lib/auth-storage"
import { canSeeWarehouseInventoryCounts } from "@/lib/axones-roles"
import {
  getMaterialAreaPillClass,
  getMaterialsListTabTheme,
} from "@/lib/material-area-theme"
import { cn } from "@/lib/utils"
import { useWarehouseTintasPendingCounts } from "@/hooks/useWarehouseTintasPendingCounts"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import "./materials-list.css"

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

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

function areaFilterHint(area: AreaValue): string {
  if (area === "material") {
    return "Sustratos (films y láminas). El stock se expresa en la unidad registrada (kg, m, etc.)."
  }
  if (area === "tintas") {
    return "Tintas por subárea (laminación, superficie…). Use «Más filtros» para acotar por subárea."
  }
  if (area === "quimicos") {
    return "Químicos de proceso (adhesivos, catalizadores, solventes…)."
  }
  if (area === "miscelaneos") {
    return "Insumos varios que no son sustrato, tinta ni químico de proceso."
  }
  return "Catálogo de insumos con stock por área. No incluye producto terminado: el terminado se declara en Corte."
}

function formatToTwoDecimals(value: string | number | null | undefined) {
  const n = Number(String(value ?? "0").replace(",", "."))
  if (!Number.isFinite(n)) return "0.00"
  return n.toFixed(2)
}

function parseStock(value: string | number | null | undefined): number {
  const n = Number(String(value ?? "0").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

const SEARCH_DEBOUNCE_MS = 320

export default function MaterialsPage() {
  const session = getStoredUser()
  const showWarehouseTintasBanner = canSeeWarehouseInventoryCounts(session?.role)
  const { counts: tintasPending } = useWarehouseTintasPendingCounts({
    enabled: showWarehouseTintasBanner,
  })
  const [qInput, setQInput] = useState("")
  const [qApi, setQApi] = useState("")
  const qDebounceRef = useRef<number | null>(null)

  const [activeArea, setActiveArea] = useState<AreaValue>("all")
  const [sortPreset, setSortPreset] = useState<SortPreset>("name_asc")
  const [stockState, setStockState] = useState<StockState>("all")
  const [tintaSubarea, setTintaSubarea] = useState<TintaSubarea>("all")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all") // <-- FILTRO DE ALMACEN
  const [stockMin, setStockMin] = useState("")
  const [stockMax, setStockMax] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<MaterialRow> | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const loadAbortRef = useRef<AbortController | null>(null)

  const showDimensions = activeArea === "material"
  const showTintaSubareaFilter = activeArea === "all" || activeArea === "tintas"
  const tableColSpan = showDimensions ? 10 : 8 // <-- SUMAMOS 1 A LA COLUMNA

  const { sortBy, sortDir } = SORT_PRESET_MAP[sortPreset]

  useEffect(() => {
    if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    qDebounceRef.current = window.setTimeout(() => {
      setQApi(qInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    }
  }, [qInput])

  useEffect(() => {
    setPage(1)
  }, [qApi])

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
            q: qApi || undefined,
            page,
            per_page: perPage,
            inventory_area: activeArea !== "all" ? activeArea : undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
            stock_state: stockState !== "all" ? stockState : undefined,
            tinta_subarea: tintaSubarea !== "all" ? tintaSubarea : undefined,
            warehouse_location: warehouseFilter !== "all" ? warehouseFilter : undefined, // <-- SE ENVIA EL ALMACEN LIMPIO (Sin tildes)
            stock_min: stockMin.trim() ? stockMin.trim() : undefined,
            stock_max: stockMax.trim() ? stockMax.trim() : undefined,
          },
          signal: ac.signal,
        },
      )
      if (ac.signal.aborted) return
      setRows(data)
    } catch (e) {
      if (isApiAbortError(e)) return
      if (e instanceof ApiError) {
        if (e.status === 0) return
        toast.error(e.message)
      } else toast.error("No se pudieron cargar los materiales.")
      if (!ac.signal.aborted) setRows(null)
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [page, perPage, qApi, activeArea, sortBy, sortDir, stockState, tintaSubarea, warehouseFilter, stockMin, stockMax])

  useEffect(() => {
    void load()
  }, [load])

  const handleExportVictor = useCallback(async () => {
    setExporting(true)
    try {
      const all: MaterialRow[] = []
      let pageNum = 1
      let lastPage = 1
      do {
        const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: {
            page: pageNum,
            per_page: 500,
            inventory_area: activeArea !== "all" ? activeArea : undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
          },
        })
        all.push(...data.data)
        lastPage = data.last_page
        pageNum += 1
      } while (pageNum <= lastPage)

      if (all.length === 0) {
        toast.error("No hay materiales para exportar.")
        return
      }

      await exportVictorExcel(all)
      toast.success("Excel exportado.")
    } catch {
      toast.error("No se pudo exportar el Excel.")
    } finally {
      setExporting(false)
    }
  }, [activeArea, sortBy, sortDir])

  const handleDownloadTemplate = useCallback(async () => {
    setDownloadingTemplate(true)
    try {
      await exportVictorTemplateExcel()
      toast.success("Plantilla descargada.")
    } catch {
      toast.error("No se pudo generar la plantilla.")
    } finally {
      setDownloadingTemplate(false)
    }
  }, [])

  const showInitialSkeleton = loading && rows === null

  const hasActiveFilters =
    qApi.trim() !== "" ||
    stockState !== "all" ||
    sortPreset !== "name_asc" ||
    tintaSubarea !== "all" ||
    warehouseFilter !== "all" ||
    stockMin.trim() !== "" ||
    stockMax.trim() !== ""

  return (
    <div className="mat-list-shell">
      <CatalogPageShell
        title="Materiales (insumos)"
        subtitle="Sustratos, tintas, químicos y misceláneos con stock por área. No incluye producto terminado: el terminado se declara en Corte."
        icon={Boxes}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="shadow-sm"
              disabled={downloadingTemplate}
              onClick={() => void handleDownloadTemplate()}
            >
              {downloadingTemplate ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="mr-2 size-4" aria-hidden />
              )}
              Plantilla vacía
            </Button>
            <Button
              type="button"
              variant="outline"
              className="shadow-sm"
              disabled={exporting}
              onClick={() => void handleExportVictor()}
            >
              {exporting ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-2 size-4" aria-hidden />
              )}
              Exportar Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="shadow-sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="mr-2 size-4" aria-hidden />
              Importar Excel
            </Button>
            <Button type="button" asChild className="shadow-sm">
              <Link to="/materiales/nuevo">
                <Plus className="mr-2 size-4" aria-hidden />
                Nuevo material
              </Link>
            </Button>
          </div>
        }
      >
        <AxonesInventoryModuleNav active="materiales" variant="catalog" />

        {showWarehouseTintasBanner && tintasPending.materiales > 0 ? (
          <div className="mb-4 rounded-lg border border-violet-200/80 bg-violet-50/80 px-4 py-3 text-sm text-violet-950">
            <strong>{tintasPending.materiales}</strong> acción(es) pendiente(s) de tintas (consumo, mezcla o
            devolución). Revise{" "}
            <Link className="font-medium underline underline-offset-2" to="/solicitudes-area">
              Solicitudes entre áreas
            </Link>{" "}
            y{" "}
            <Link className="font-medium underline underline-offset-2" to="/devoluciones">
              Devoluciones
            </Link>
            .
          </div>
        ) : null}

        {showInitialSkeleton ? (
          <div className="space-y-4">
            <PageLoadingBlock />
            <PageLoadingBlock />
          </div>
        ) : (
          <>
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
              <TabsList className="mat-area-tab-list">
                {AREAS.map((a) => (
                  <TabsTrigger
                    key={a.value}
                    value={a.value}
                    className={cn(
                      "mat-area-tab-trigger",
                      getMaterialsListTabTheme(a.value).tabTriggerClass,
                    )}
                  >
                    {a.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="mat-filter-bar space-y-4 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="size-4 text-primary" aria-hidden />
                <p className="text-sm font-medium">Filtrar listado</p>
              </div>

              <div className={catalogFilterGridClass}>
                <CatalogSearchField
                  id="mat-q"
                  placeholder="Código o nombre…"
                  value={qInput}
                  onChange={(ev) => {
                    setPage(1)
                    setQInput(ev.target.value)
                  }}
                  className={catalogFilterCol5Class}
                />
                <CatalogLabeledField label="Estado de stock" className={catalogFilterCol3Class}>
                  <Select
                    value={stockState}
                    onValueChange={(value) => {
                      setStockState(value as StockState)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sin_stock">Sin stock</SelectItem>
                      <SelectItem value="bajo_minimo">Bajo mínimo</SelectItem>
                      <SelectItem value="ok">OK</SelectItem>
                    </SelectContent>
                  </Select>
                </CatalogLabeledField>
                <CatalogLabeledField label="Ordenar lista" className={catalogFilterCol4Class}>
                  <Select
                    value={sortPreset}
                    onValueChange={(value) => {
                      setSortPreset(value as SortPreset)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                      <SelectValue placeholder="Nombre (A → Z)" />
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
                </CatalogLabeledField>
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <SlidersHorizontal className="size-4" aria-hidden />
                    Más filtros
                    <ChevronDown
                      className={cn("size-4 transition-transform", advancedOpen && "rotate-180")}
                      aria-hidden
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div
                    className={cn(
                      "grid gap-3",
                      showTintaSubareaFilter ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3",
                    )}
                  >
                    {/* NUEVO FILTRO ALMACÉN FÍSICO */}
                    <CatalogLabeledField label="Almacén físico">
                      <Select
                        value={warehouseFilter}
                        onValueChange={(value) => {
                          setWarehouseFilter(value)
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* El value NO tiene tildes. El usuario SÍ ve las tildes. */}
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="La Dinastia">La Dinastía</SelectItem>
                          <SelectItem value="Galpon">Galpón</SelectItem>
                          <SelectItem value="Empresa">Empresa</SelectItem>
                        </SelectContent>
                      </Select>
                    </CatalogLabeledField>
                    
                    {showTintaSubareaFilter ? (
                      <CatalogLabeledField label="Subárea (tintas)">
                        <Select
                          value={tintaSubarea}
                          onValueChange={(value) => {
                            setTintaSubarea(value as TintaSubarea)
                            setPage(1)
                          }}
                        >
                          <SelectTrigger className={cn("font-normal", catalogSelectTriggerClass)}>
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="laminacion">Laminación</SelectItem>
                            <SelectItem value="superficie">Superficie</SelectItem>
                            <SelectItem value="prueba_laminacion">Prueba laminación</SelectItem>
                            <SelectItem value="laminacion_nueva">Laminación nueva</SelectItem>
                          </SelectContent>
                        </Select>
                      </CatalogLabeledField>
                    ) : null}
                    <CatalogLabeledField label="Stock mín. (cantidad)" htmlFor="stock-min">
                      <Input
                        id="stock-min"
                        type="number"
                        min="0"
                        step="0.001"
                        className={cn("h-11 font-normal", catalogSelectTriggerClass)}
                        value={stockMin}
                        onChange={(ev) => {
                          setStockMin(ev.target.value)
                          setPage(1)
                        }}
                      />
                    </CatalogLabeledField>
                    <CatalogLabeledField label="Stock máx. (cantidad)" htmlFor="stock-max">
                      <Input
                        id="stock-max"
                        type="number"
                        min="0"
                        step="0.001"
                        className={cn("h-11 font-normal", catalogSelectTriggerClass)}
                        value={stockMax}
                        onChange={(ev) => {
                          setStockMax(ev.target.value)
                          setPage(1)
                        }}
                      />
                    </CatalogLabeledField>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="mat-filter-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("h-9", catalogPaginationOutlineButtonClass)}
                  disabled={!hasActiveFilters}
                  onClick={() => {
                    setQInput("")
                    setQApi("")
                    setSortPreset("name_asc")
                    setStockState("all")
                    setTintaSubarea("all")
                    setWarehouseFilter("all") // <-- LIMPIAR ALMACEN
                    setStockMin("")
                    setStockMax("")
                    setAdvancedOpen(false)
                    setPage(1)
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>

              <p className="text-muted-foreground text-xs leading-relaxed">
                {areaFilterHint(activeArea)}
              </p>
            </div>

            <div className="mat-table-wrap overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <CatalogTableHead icon={Barcode}>SKU</CatalogTableHead>
                    <CatalogTableHead icon={Tag}>Nombre</CatalogTableHead>
                    <CatalogTableHead icon={Truck} className="min-w-[8rem]">
                      Proveedor
                    </CatalogTableHead>
                    <CatalogTableHead icon={Layers}>Área</CatalogTableHead>
                    {/* NUEVA COLUMNA ALMACEN EN LA TABLA */}
                    <CatalogTableHead icon={Warehouse}>Almacén Físico</CatalogTableHead>

                    {showDimensions ? (
                      <CatalogTableHead icon={SlidersHorizontal}>Micras</CatalogTableHead>
                    ) : null}
                    {showDimensions ? (
                      <CatalogTableHead icon={SlidersHorizontal}>Ancho (mm)</CatalogTableHead>
                    ) : null}
                    <CatalogTableHead icon={Package} className="text-right">
                      Stock
                    </CatalogTableHead>
                    <CatalogTableHead icon={Scale}>Unidad</CatalogTableHead>
                    <CatalogTableHeadRight icon={Settings2} className="whitespace-nowrap">
                      Acciones
                    </CatalogTableHeadRight>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingTableRow colSpan={tableColSpan} />
                  ) : !rows?.data.length ? (
                    <TableRow>
                      <TableCell colSpan={tableColSpan} className="text-muted-foreground">
                        Sin materiales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((m) => {
                      const stock = parseStock(m.quantity_on_hand)
                      const areaPillClass = getMaterialAreaPillClass(m.inventory_area)
                      
                      // LOGICA PARA MOSTRAR LA TILDE SOLO EN LA VISTA
                      let warehouseDisplay = "—";
                      const rawWarehouse = (m as MaterialRow & { warehouse_location?: string }).warehouse_location;
                      if (rawWarehouse === "La Dinastia") warehouseDisplay = "La Dinastía";
                      else if (rawWarehouse === "Galpon") warehouseDisplay = "Galpón";
                      else if (rawWarehouse) warehouseDisplay = rawWarehouse;

                      return (
                        <TableRow
                          key={m.id}
                          data-mat-area={m.inventory_area}
                          className="border-b"
                        >
                          <TableCell className="p-3 align-middle">
                            <span className="mat-sku-pill">{m.sku}</span>
                          </TableCell>
                          <TableCell className="max-w-[14rem] p-3 align-middle font-semibold">
                            {m.name}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "max-w-[12rem] truncate p-3 align-middle",
                              m.supplier?.name?.trim() ? "font-medium" : "text-muted-foreground",
                            )}
                            title={m.supplier?.name?.trim() || undefined}
                          >
                            {m.supplier?.name?.trim() ? m.supplier.name : "—"}
                          </TableCell>
                          <TableCell className="p-3 align-middle whitespace-nowrap">
                            <span className={cn("mat-area-pill", areaPillClass)}>
                              {areaLabel(m.inventory_area)}
                            </span>
                          </TableCell>
                          {/* MOSTRAMOS EL ALMACÉN CON LA TILDE CORREGIDA */}
                          <TableCell className="p-3 align-middle whitespace-nowrap text-muted-foreground font-medium">
                            {warehouseDisplay}
                          </TableCell>

                          {showDimensions ? (
                            <TableCell className="p-3 align-middle tabular-nums">
                              {m.micras ?? "—"}
                            </TableCell>
                          ) : null}
                          {showDimensions ? (
                            <TableCell className="p-3 align-middle tabular-nums">
                              {m.ancho ?? "—"}
                            </TableCell>
                          ) : null}
                          <TableCell
                            className={cn(
                              "p-3 align-middle text-right tabular-nums font-semibold",
                              stock <= 0 && "text-destructive",
                            )}
                          >
                            {formatToTwoDecimals(m.quantity_on_hand)}
                          </TableCell>
                          <TableCell className="p-3 align-middle whitespace-nowrap">
                            {m.unit}
                          </TableCell>
                          <TableCell className="p-3 align-middle text-right">
                            <Link
                              to={`/materiales/${m.id}/editar`}
                              className="mat-action-edit"
                              title="Editar material"
                            >
                              <Pencil className="size-3.5" aria-hidden />
                              Editar
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {rows ? (
              <div className="mat-pagination-bar">
                <div className="mat-pagination-meta">
                  <p className="text-sm">
                    {rows.total === 0 ? (
                      "Sin resultados con los filtros actuales."
                    ) : (
                      <>
                        Mostrando <strong>{rows.from ?? 0}</strong> a <strong>{rows.to ?? 0}</strong> de{" "}
                        <strong>{rows.total}</strong> registros
                      </>
                    )}
                  </p>
                  {rows.last_page > 1 ? (
                    <p className="text-muted-foreground text-xs">
                      Página {rows.current_page} de {rows.last_page}
                    </p>
                  ) : null}
                </div>
                <div className="mat-pagination-controls">
                  {rows.last_page > 1 ? (
                    <span className="mat-page-indicator">
                      {rows.current_page} / {rows.last_page}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Por página</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={(v) => {
                        setPerPage(Number(v))
                        setPage(1)
                      }}
                    >
                      <SelectTrigger
                        id="materials-per-page"
                        className={cn(
                          "h-9 w-[4.75rem] text-sm",
                          catalogPaginationSelectTriggerClass,
                        )}
                        aria-label="Registros por página"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_PAGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={String(opt)}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-9 px-3", catalogPaginationOutlineButtonClass)}
                      disabled={rows.current_page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      type="button"
                    >
                      <ChevronLeft className="mr-1 size-4" aria-hidden />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-9 px-3", catalogPaginationOutlineButtonClass)}
                      disabled={rows.current_page >= rows.last_page || loading}
                      onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
                      type="button"
                    >
                      Siguiente
                      <ChevronRight className="ml-1 size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CatalogPageShell>

      <MaterialsVictorExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void load()}
      />
    </div>
  )
}