"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Hash,
  Layers,
  Package,
  PackageOpen,
  Scale,
  Settings2,
  Tag,
  Truck,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogPaginationOutlineButtonClass,
  catalogPaginationSelectTriggerClass,
} from "@/components/axones/catalog-list-classes"
import { AxonesInventoryModuleNav } from "@/components/axones/inventory-page-layout"
import { LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch, ApiError } from "@/lib/api"
import { labelInventoryArea } from "@/lib/inventory-area-labels"
import { getMaterialAreaPillClass } from "@/lib/material-area-theme"
import { cn } from "@/lib/utils"
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

type ReturnRow = {
  id: number
  material_id?: number
  work_order_id: number | null
  status: string
  quantity: string
  destination_area: string
  material?: Pick<MaterialRow, "sku" | "name"> & {
    supplier?: { id: number; name: string } | null
  }
  work_order?: { code: string }
}

type ReturnKindTab = "all" | "good" | "rejected" | "tintas"

function viewHint(kind: ReturnKindTab): string {
  const kindText =
    kind === "good"
      ? "Las devoluciones buenas incrementan el stock de sustrato en Materiales al registrarse desde producción."
      : kind === "rejected"
        ? "Las devoluciones malas quedan pendientes hasta verificar el ingreso en bobinas rechazadas."
        : kind === "tintas"
          ? "Devoluciones de sobrantes desde el encargado de tintas (tintas o cementerio). Leonardo acepta para subir stock."
          : "Las buenas alimentan sustrato de inmediato; las malas quedan pendientes hasta verificar."
  return `Las devoluciones registradas desde Impresión, Laminación, Tintas u otros flujos aparecen aquí. ${kindText}`
}

export default function InventoryReturnsPage() {
  const [kindTab, setKindTab] = useState<ReturnKindTab>("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ReturnRow> | null>(null)
  const colCount = 8

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const destinationAreaFilter =
        kindTab === "good"
          ? "material"
          : kindTab === "rejected"
            ? "bobinas_rechazadas"
            : undefined
      const destinationAreasFilter =
        kindTab === "tintas" ? "tintas,cementerio_tintas" : undefined
      const data = await apiFetch<LaravelPaginated<ReturnRow>>(
        "inventory-returns",
        {
          query: {
            page,
            per_page: perPage,
            destination_area: destinationAreaFilter,
            destination_areas: destinationAreasFilter,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las devoluciones.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, kindTab])

  useEffect(() => {
    void load()
  }, [load])

  async function acceptReturn(id: number, reason: string) {
    try {
      await apiFetch(`inventory-returns/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      toast.success("Devolución verificada; ingreso aplicado al inventario.")
      window.dispatchEvent(new Event("alerts:refresh"))
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo aceptar la devolución.")
    }
  }

  const showInitialSkeleton = loading && rows === null

  return (
    <div className="mat-list-shell">
      <CatalogPageShell
        title="Devoluciones a inventario"
        subtitle="Buenas → sustrato al registrar; malas → verificar ingreso."
        icon={PackageOpen}
      >
        <AxonesInventoryModuleNav active="devoluciones" variant="catalog" />

        {showInitialSkeleton ? (
          <div className="space-y-4">
            <PageLoadingBlock />
            <PageLoadingBlock />
          </div>
        ) : (
          <>
            <Tabs
              value={kindTab}
              onValueChange={(v) => {
                setKindTab(v as ReturnKindTab)
                setPage(1)
              }}
              className="w-full"
            >
              <TabsList className="mat-view-tab-list">
                <TabsTrigger value="all" className="mat-view-tab-trigger">
                  Todas
                </TabsTrigger>
                <TabsTrigger value="good" className="mat-view-tab-trigger">
                  Buenas
                </TabsTrigger>
                <TabsTrigger value="rejected" className="mat-view-tab-trigger">
                  Malas
                </TabsTrigger>
                <TabsTrigger value="tintas" className="mat-view-tab-trigger">
                  Tintas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mat-filter-bar space-y-4 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="size-4 text-primary" aria-hidden />
                <p className="text-sm font-medium">Filtrar listado</p>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {viewHint(kindTab)}
              </p>
            </div>

            <div className="mat-table-wrap overflow-x-auto">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <CatalogTableHead icon={Hash} className="w-16">
                      ID
                    </CatalogTableHead>
                    <CatalogTableHead icon={Tag}>Tipo</CatalogTableHead>
                    <CatalogTableHead icon={ClipboardList}>OT</CatalogTableHead>
                    <CatalogTableHead icon={Package}>Material</CatalogTableHead>
                    <CatalogTableHead icon={Truck} className="min-w-[8rem]">
                      Proveedor
                    </CatalogTableHead>
                    <CatalogTableHead icon={Scale} className="text-right">
                      Cantidad
                    </CatalogTableHead>
                    <CatalogTableHead icon={Layers}>Área destino</CatalogTableHead>
                    <CatalogTableHeadRight icon={Settings2} className="whitespace-nowrap">
                      Acciones
                    </CatalogTableHeadRight>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingTableRow colSpan={colCount} />
                  ) : !rows?.data.length ? (
                    <TableRow>
                      <TableCell colSpan={colCount} className="p-0">
                        <div className="mat-empty-state">
                          <div className="mat-empty-state__icon">
                            <PackageOpen className="size-8" aria-hidden />
                          </div>
                          <div className="max-w-sm space-y-2">
                            <p className="text-foreground text-sm font-medium">
                              Sin devoluciones
                            </p>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {viewHint(kindTab)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((r) => {
                      const isRechazada = r.destination_area === "bobinas_rechazadas"
                      const areaPillClass = getMaterialAreaPillClass(r.destination_area)
                      return (
                        <TableRow
                          key={r.id}
                          data-ret-kind={isRechazada ? "rejected" : "good"}
                          className="border-b"
                        >
                          <TableCell className="p-3 align-middle tabular-nums text-muted-foreground">
                            {r.id}
                          </TableCell>
                          <TableCell className="p-3 align-middle">
                            <span
                              className={cn(
                                "mat-ret-badge",
                                isRechazada ? "mat-ret-badge--rejected" : "mat-ret-badge--good",
                              )}
                            >
                              {isRechazada ? "Rechazada" : "Buena"}
                            </span>
                          </TableCell>
                          <TableCell className="p-3 align-middle font-medium">
                            {r.work_order?.code ?? r.work_order_id ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[14rem] p-3 align-middle">
                            {r.material ? (
                              <span className="block truncate">
                                <span className="mat-sku-pill mr-2">{r.material.sku}</span>
                                <span className="font-semibold">{r.material.name}</span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "max-w-[10rem] truncate p-3 align-middle",
                              r.material?.supplier?.name?.trim()
                                ? "font-medium"
                                : "text-muted-foreground",
                            )}
                            title={r.material?.supplier?.name ?? undefined}
                          >
                            {r.material?.supplier?.name?.trim()
                              ? r.material.supplier.name
                              : "—"}
                          </TableCell>
                          <TableCell className="p-3 align-middle text-right tabular-nums font-semibold">
                            {r.quantity}
                          </TableCell>
                          <TableCell className="p-3 align-middle whitespace-nowrap">
                            <span className={cn("mat-area-pill", areaPillClass)}>
                              {labelInventoryArea(r.destination_area)}
                            </span>
                          </TableCell>
                          <TableCell className="p-3 align-middle text-right">
                            {r.status === "pending" ? (
                              <button
                                type="button"
                                className="mat-action-accept"
                                onClick={() => void acceptReturn(r.id, "Verificado en devoluciones")}
                              >
                                <CheckCircle2 className="size-3.5" aria-hidden />
                                Verificar
                              </button>
                            ) : (
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                Verificado
                              </span>
                            )}
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
                        id="returns-per-page"
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
    </div>
  )
}
