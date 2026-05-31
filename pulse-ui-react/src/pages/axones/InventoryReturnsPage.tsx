"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Filter,
  Hash,
  Layers,
  Package,
  PackageOpen,
  RefreshCw,
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
import { ReasonModal } from "@/components/axones/ReasonModal"
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

function returnStatusLabel(status: string): string {
  if (status === "pending") return "Pendiente"
  if (status === "accepted") return "Aceptada"
  return status
}

function viewHint(tab: "pending" | "history"): string {
  if (tab === "pending") {
    return "Las devoluciones registradas desde otros flujos aparecerán aquí hasta que se acepte el ingreso."
  }
  return "Devoluciones ya aceptadas e ingresadas al inventario. Las pendientes están en la pestaña Pendientes."
}

export default function InventoryReturnsPage() {
  const [listTab, setListTab] = useState<"pending" | "history">("pending")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<ReturnRow> | null>(null)
  const [reasonModalOpen, setReasonModalOpen] = useState(false)
  const [pendingAcceptId, setPendingAcceptId] = useState<number | null>(null)
  const [lastReason, setLastReason] = useState("")

  const isHistoryTab = listTab === "history"
  const colCount = isHistoryTab ? 9 : 8

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const statusFilter = listTab === "pending" ? "pending" : "accepted"
      const data = await apiFetch<LaravelPaginated<ReturnRow>>(
        "inventory-returns",
        {
          query: {
            page,
            per_page: perPage,
            status: statusFilter,
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
  }, [page, perPage, listTab])

  useEffect(() => {
    void load()
  }, [load])

  async function acceptReturn(id: number, reason: string) {
    try {
      await apiFetch(`inventory-returns/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      toast.success("Devolución aceptada; ingreso aplicado al inventario.")
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
        subtitle="Pendiente hasta aceptar ingreso."
        icon={PackageOpen}
        action={
          <Button
            type="button"
            variant="outline"
            className={cn("shadow-sm", catalogPaginationOutlineButtonClass)}
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("mr-2 size-4", loading && "animate-spin")} aria-hidden />
            Actualizar
          </Button>
        }
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
              value={listTab}
              onValueChange={(v) => {
                setListTab(v as "pending" | "history")
                setPage(1)
              }}
              className="w-full"
            >
              <TabsList className="mat-view-tab-list">
                <TabsTrigger value="pending" className="mat-view-tab-trigger">
                  Pendientes
                </TabsTrigger>
                <TabsTrigger value="history" className="mat-view-tab-trigger">
                  Historial
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mat-filter-bar space-y-4 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="size-4 text-primary" aria-hidden />
                <p className="text-sm font-medium">Filtrar listado</p>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {viewHint(listTab)}
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
                    {isHistoryTab ? (
                      <CatalogTableHead icon={CircleDot}>Estado</CatalogTableHead>
                    ) : null}
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
                              {listTab === "pending"
                                ? "Sin devoluciones pendientes"
                                : "Sin registros en el historial"}
                            </p>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {listTab === "pending" ? (
                                viewHint("pending")
                              ) : (
                                <>
                                  Las devoluciones aceptadas aparecen aquí. Las pendientes están en la
                                  pestaña{" "}
                                  <button
                                    type="button"
                                    className="text-primary font-medium underline underline-offset-4"
                                    onClick={() => {
                                      setListTab("pending")
                                      setPage(1)
                                    }}
                                  >
                                    Pendientes
                                  </button>
                                  .
                                </>
                              )}
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
                          {isHistoryTab ? (
                            <TableCell className="p-3 align-middle text-sm">
                              {returnStatusLabel(r.status)}
                            </TableCell>
                          ) : null}
                          <TableCell className="p-3 align-middle text-right">
                            {!isHistoryTab && r.status === "pending" ? (
                              <button
                                type="button"
                                className="mat-action-accept"
                                onClick={() => {
                                  setPendingAcceptId(r.id)
                                  setReasonModalOpen(true)
                                }}
                              >
                                <CheckCircle2 className="size-3.5" aria-hidden />
                                Aceptar ingreso
                              </button>
                            ) : null}
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

      <ReasonModal
        open={reasonModalOpen}
        initialValue={lastReason}
        title="Razón del ingreso"
        description="Para aceptar la devolución debe indicar una razón operativa."
        confirmLabel="Aceptar ingreso"
        onCancel={() => {
          setReasonModalOpen(false)
          setPendingAcceptId(null)
        }}
        onConfirm={(reason) => {
          const id = pendingAcceptId
          if (!id) return
          setLastReason(reason)
          setReasonModalOpen(false)
          setPendingAcceptId(null)
          void acceptReturn(id, reason)
        }}
      />
    </div>
  )
}
