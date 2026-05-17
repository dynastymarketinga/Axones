"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  ListOrdered,
  Package,
  Scale,
  Truck,
  Users,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { CortePaletaRollosPreview } from "@/components/axones/CortePaletaRollosPreview"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import { DeliveryNotePrefillPreviewDialog } from "@/components/axones/DeliveryNotePrefillPreviewDialog"
import { LoadingTableRow } from "@/components/axones/LoadingStates"
import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import {
  catalogActionButtonClass,
  catalogPaginationOutlineButtonClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { apiFetch, ApiError } from "@/lib/api"
import { corteDispatchRowMatchesSearch } from "@/lib/corte-dispatch-search"
import { CORTE_CONTROL_SAVED_EVENT } from "@/lib/corte-mes-band-status"
import {
  mergeDispatchSelection,
  readDispatchSelection,
  type DispatchSelectionItem,
  writeDispatchSelection,
} from "@/lib/dispatch-selection"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DispatchViewFilter = "all" | "ready" | "provisional"

const DISPATCH_TAB_BTN_CLASS =
  "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

const DISPATCH_VIEW_TABS: Array<{
  filter: DispatchViewFilter
  label: string
  icon: typeof ListOrdered
  active: string
  inactive: string
  iconActive: string
  iconIdle: string
}> = [
  {
    filter: "all",
    label: "Todas",
    icon: ListOrdered,
    active: "border-primary bg-primary text-primary-foreground shadow-sm",
    inactive:
      "border-primary/25 bg-background text-foreground hover:bg-primary/8 dark:hover:bg-primary/12",
    iconActive: "text-primary-foreground",
    iconIdle: "text-primary",
  },
  {
    filter: "ready",
    label: "Listas para nota",
    icon: CheckCircle2,
    active: "border-emerald-500/50 bg-emerald-500/15 text-emerald-950 shadow-sm dark:text-emerald-100",
    inactive:
      "border-emerald-500/25 bg-background text-foreground hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15",
    iconActive: "text-emerald-700 dark:text-emerald-200",
    iconIdle: "text-emerald-600 dark:text-emerald-400",
  },
  {
    filter: "provisional",
    label: "Provisional",
    icon: AlertCircle,
    active: "border-amber-500/50 bg-amber-500/15 text-amber-950 shadow-sm dark:text-amber-100",
    inactive:
      "border-amber-500/25 bg-background text-foreground hover:bg-amber-500/10 dark:hover:bg-amber-500/15",
    iconActive: "text-amber-800 dark:text-amber-100",
    iconIdle: "text-amber-700 dark:text-amber-400",
  },
]

type CorteDispatchRow = {
  corte_bobina_usage_id?: number
  work_order_id?: number
  work_order_code?: string
  client_name?: string
  product_id?: number
  product_name?: string
  product_cpe?: string
  material_sku?: string
  quantity_finished_kg?: string | number
  quantity_dispatched_kg?: string | number
  quantity_remaining_kg?: string | number
  pallet_code?: string
  pallet_label?: string
  paleta_id?: string
  rollos_kg?: string[]
  rollos_count?: number
  is_provisional?: boolean
}

function formatKg(value: string | number | undefined): string {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN
  if (!Number.isFinite(parsed)) return "-"
  return `${parsed.toLocaleString("es-DO", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`
}

function rowKey(r: CorteDispatchRow, idx: number): string {
  return r.corte_bobina_usage_id
    ? `u-${r.corte_bobina_usage_id}`
    : `row-${r.work_order_id ?? 0}-${r.paleta_id ?? idx}`
}

function corteTabUrl(row: CorteDispatchRow): string | null {
  const id = row.work_order_id
  if (id == null || !Number.isFinite(id) || id < 1) return null
  return `/ordenes-trabajo/${id}/produccion?tab=corte`
}

function isDispatchRowSelectable(row: CorteDispatchRow): boolean {
  return (
    !row.is_provisional &&
    !!row.corte_bobina_usage_id &&
    Number(row.quantity_remaining_kg) > 0
  )
}

function canPreviewDispatchRow(row: CorteDispatchRow): boolean {
  const id = row.work_order_id
  return !row.is_provisional && id != null && Number.isFinite(id) && id >= 1
}

export default function CorteDispatchPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [viewFilter, setViewFilter] = useState<DispatchViewFilter>("all")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<CorteDispatchRow[]>([])
  const [selectedUsageIds, setSelectedUsageIds] = useState<Record<number, boolean>>({})
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})
  const [previewTarget, setPreviewTarget] = useState<{
    workOrderId: number
    workOrderCode?: string
  } | null>(null)
  const [selectionAttempted, setSelectionAttempted] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 8

  const viewFilteredRows = useMemo(() => {
    if (viewFilter === "ready") return rows.filter((r) => !r.is_provisional)
    if (viewFilter === "provisional") return rows.filter((r) => r.is_provisional)
    return rows
  }, [rows, viewFilter])

  const tabCounts = useMemo(
    () => ({
      all: rows.length,
      ready: rows.filter((r) => !r.is_provisional).length,
      provisional: rows.filter((r) => r.is_provisional).length,
    }),
    [rows],
  )

  const filteredRows = useMemo(
    () => viewFilteredRows.filter((r) => corteDispatchRowMatchesSearch(r, search)),
    [viewFilteredRows, search],
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page])

  const selectedRows = useMemo(() => {
    return rows.filter(
      (r) =>
        !r.is_provisional &&
        r.corte_bobina_usage_id &&
        selectedUsageIds[r.corte_bobina_usage_id] &&
        Number(r.quantity_remaining_kg) > 0,
    )
  }, [rows, selectedUsageIds])

  const selectedTotalKg = useMemo(
    () =>
      selectedRows.reduce((acc, r) => acc + (Number(r.quantity_remaining_kg) || 0), 0),
    [selectedRows],
  )

  const selectableInView = useMemo(
    () => filteredRows.filter(isDispatchRowSelectable),
    [filteredRows],
  )

  const provisionalInView = useMemo(
    () => filteredRows.filter((r) => r.is_provisional),
    [filteredRows],
  )

  const pendingNoteSelectionCount = useMemo(
    () => readDispatchSelection().length,
    [selectedRows],
  )

  function explainProvisionalSelection() {
    toast.message(
      "Esta paleta sigue provisional en el servidor. En Corte pulse «Cerrar paleta», confirme el guardado y vuelva a esta pantalla: el listado se actualiza solo al guardar en Corte.",
      { duration: 11000 },
    )
  }

  function toggleUsage(row: CorteDispatchRow, checked: boolean) {
    if (!row.corte_bobina_usage_id) return
    if (checked) setSelectionAttempted(false)
    setSelectedUsageIds((prev) => ({ ...prev, [row.corte_bobina_usage_id!]: checked }))
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function createSelectionPayload(): DispatchSelectionItem[] {
    return selectedRows
      .filter((r) => r.corte_bobina_usage_id && r.work_order_id)
      .map((r) => ({
        corte_bobina_usage_id: Number(r.corte_bobina_usage_id),
        work_order_id: Number(r.work_order_id),
        work_order_code: r.work_order_code ?? undefined,
        client_name: r.client_name ?? undefined,
        product_id: r.product_id ? Number(r.product_id) : null,
        product_name: r.product_name ?? undefined,
        product_cpe: r.product_cpe ?? undefined,
        description:
          [
            r.client_name ? `Cliente: ${r.client_name}` : null,
            [r.product_name, r.product_cpe].filter(Boolean).join(" · "),
            r.pallet_label ? `Paleta: ${r.pallet_label}` : null,
          ]
            .filter(Boolean)
            .join(" | ") || "Línea de despacho",
        quantity_finished_kg: String(r.quantity_finished_kg ?? "0.000"),
        quantity_dispatched_kg: String(r.quantity_dispatched_kg ?? "0.000"),
        quantity_remaining_kg: String(r.quantity_remaining_kg ?? "0.000"),
        quantity_kg: String(r.quantity_remaining_kg ?? "0.000"),
        pallet_code:
          r.pallet_label ??
          r.pallet_code ??
          r.work_order_code ??
          (r.work_order_id ? `OT-${r.work_order_id}` : ""),
        bobbin_count: r.rollos_count ?? 1,
        rollos_kg: Array.isArray(r.rollos_kg) ? [...r.rollos_kg] : undefined,
      }))
      .filter((r) => Number(r.quantity_kg) > 0)
  }

  function proceedToNewNote() {
    setSelectionAttempted(true)
    const payload = createSelectionPayload()
    if (!payload.length) {
      const provisionalSelected = rows.some(
        (r) =>
          r.is_provisional &&
          r.corte_bobina_usage_id &&
          selectedUsageIds[r.corte_bobina_usage_id],
      )
      if (provisionalSelected) {
        toast.error(
          "Las paletas provisionales no pueden ir en la nota. Ciérrelas en Corte y vuelva a intentar.",
        )
        explainProvisionalSelection()
      } else {
        toast.error("Seleccione al menos una paleta cerrada con saldo pendiente.")
      }
      return
    }
    const existing = readDispatchSelection()
    const merged = mergeDispatchSelection(existing, payload)
    writeDispatchSelection(merged)
    const newlyAdded = merged.length - existing.length
    toast.success(
      newlyAdded > 0 && existing.length > 0
        ? `${merged.length} paleta(s) en la nota (${newlyAdded} agregada(s)).`
        : `${merged.length} paleta(s) listas para la nota.`,
    )
    navigate("/nota-entrega-nueva?source=despacho-corte")
  }

  useEffect(() => {
    const stored = readDispatchSelection()
    if (!stored.length) return
    setSelectedUsageIds((prev) => {
      const next = { ...prev }
      for (const item of stored) {
        next[item.corte_bobina_usage_id] = true
      }
      return next
    })
  }, [rows])

  useEffect(() => {
    setPage(1)
  }, [search, viewFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ rows: CorteDispatchRow[] }>("corte-dispatch/available")
      setRows(data.rows ?? [])
      setSelectedUsageIds({})
      setExpandedKeys({})
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el disponible para despacho.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onCorteSaved = () => {
      void load()
    }
    window.addEventListener(CORTE_CONTROL_SAVED_EVENT, onCorteSaved)
    return () => window.removeEventListener(CORTE_CONTROL_SAVED_EVENT, onCorteSaved)
  }, [load])

  return (
    <CatalogPageShell
      title="Despacho · producto terminado"
      subtitle="Paletas cerradas en Corte listas para nota de entrega. Las filas provisionales son solo consulta hasta cerrar la paleta."
      icon={Truck}
      headerExtras={<WorkOrderStageBadge current="despacho" />}
      action={
        <Button type="button" onClick={proceedToNewNote} disabled={!selectedRows.length}>
          Crear nota con seleccionadas
        </Button>
      }
    >
      <div
        role="tablist"
        aria-label="Filtro de paletas"
        className="flex flex-wrap items-center gap-2"
      >
        {DISPATCH_VIEW_TABS.map(({ filter: f, label, icon: Icon, active, inactive, iconActive, iconIdle }) => {
          const isActive = viewFilter === f
          const count = tabCounts[f]
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(DISPATCH_TAB_BTN_CLASS, isActive ? active : inactive)}
              onClick={() => setViewFilter(f)}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", isActive ? iconActive : iconIdle)}
                aria-hidden
              />
              {label} ({count})
            </button>
          )
        })}
      </div>

      <CatalogFilterGrid>
        <CatalogSearchField
          id="cd-search"
          label="Buscar OT, cliente, producto, paleta…"
          placeholder="Ej. OT-2026-00001, AAA, CPE, Paleta #01, 132"
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
          className="md:col-span-12"
        />
        <p className="text-muted-foreground text-xs md:col-span-12">
          El listado se actualiza al escribir y al guardar en Corte (sin botón de actualizar).
        </p>
      </CatalogFilterGrid>

      {provisionalInView.length > 0 && selectableInView.length === 0 ? (
        <div
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm leading-snug text-amber-950 dark:text-amber-100"
          role="status"
        >
          <p className="font-semibold">Paletas visibles pero aún no seleccionables para nota</p>
          <p className="mt-1 text-xs">
            Los kg ya están en despacho (provisional). En{" "}
            <span className="font-medium">Corte</span> pulse <span className="font-medium">Cerrar paleta</span>, guarde y
            vuelva aquí; marque el checkbox y use{" "}
            <span className="font-medium">Crear nota con seleccionadas</span>.
          </p>
        </div>
      ) : null}

      <Card
        className={cn(
          "rounded-2xl border shadow-sm",
          selectionAttempted &&
            !selectedRows.length &&
            "border-destructive ring-1 ring-destructive/30",
        )}
      >
        <CardContent className="p-4 text-sm">
          <p>
            Seleccionadas: <span className="font-medium">{selectedRows.length}</span> paleta(s) · Total:{" "}
            <span className="font-medium">
              {selectedTotalKg.toLocaleString("es-DO", {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}{" "}
              kg
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Marque el checkbox en paletas cerradas. «Crear nota con seleccionadas» suma a la nota en curso
            {pendingNoteSelectionCount > 0
              ? ` (${pendingNoteSelectionCount} paleta(s) ya en el borrador)`
              : ""}
            .
          </p>
          {selectionAttempted && !selectedRows.length ? (
            <p className="text-destructive mt-2 text-xs">
              Debe seleccionar al menos una paleta cerrada con kg disponible para continuar.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Expanda una fila para ver rollos. Use el icono de vista previa en paletas cerradas.
      </p>

      <div className="w-full min-w-0 overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <TableHead className="w-8" />
              <CatalogTableHead icon={Barcode}>OT de producción</CatalogTableHead>
              <CatalogTableHead icon={Layers}>Paleta</CatalogTableHead>
              <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
              <CatalogTableHead icon={Package}>Producto</CatalogTableHead>
              <CatalogTableHeadRight icon={Scale}>Terminado</CatalogTableHeadRight>
              <CatalogTableHeadRight icon={Scale}>En notas</CatalogTableHeadRight>
              <CatalogTableHeadRight icon={Scale}>Disponible</CatalogTableHeadRight>
              <CatalogTableHeadRight icon={Eye} className="w-14">
                Acciones
              </CatalogTableHeadRight>
              <CatalogTableHeadRight icon={CheckSquare}>Seleccionar</CatalogTableHeadRight>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingTableRow colSpan={10} />
            ) : !filteredRows.length ? (
              <TableRow className={catalogTableBodyRowClass}>
                <TableCell
                  className={cn("text-muted-foreground align-top", catalogTableBodyCellClass)}
                  colSpan={10}
                >
                  {rows.length ? (
                    "Sin resultados para esa búsqueda."
                  ) : (
                    <div className="space-y-2 py-1 text-sm">
                      <p className="font-medium text-foreground">Sin productos disponibles.</p>
                      <p>
                        Esta pantalla lee lo <span className="font-medium">guardado en el servidor</span> desde Corte,
                        no el borrador local del navegador.
                      </p>
                      <ol className="list-decimal space-y-1 pl-5">
                        <li>
                          En <span className="font-medium">Producción → Corte</span>, registre pesos en los rollos de
                          la paleta.
                        </li>
                        <li>
                          Pulse <span className="font-medium">Guardar</span> (sincroniza saldo provisional en despacho).
                        </li>
                        <li>
                          Para incluir en nota: <span className="font-medium">Cerrar paleta</span> y guarde de nuevo.
                        </li>
                        <li>Vuelva aquí tras guardar en Corte; el listado se actualiza solo.</li>
                      </ol>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.flatMap((r, idx) => {
                const key = rowKey(r, idx)
                const expanded = !!expandedKeys[key]
                const hasRollos = Array.isArray(r.rollos_kg) && r.rollos_kg.some((v) => Number(v) > 0)
                const paletaLabel = r.pallet_label ?? r.pallet_code ?? "—"
                const mainRow = (
                  <TableRow key={key} className={catalogTableBodyRowClass}>
                    <TableCell className={cn("p-1", catalogTableBodyCellClass)}>
                      {hasRollos ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleExpanded(key)}
                          aria-expanded={expanded}
                          title="Ver rollos (solo lectura)"
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      <div className="font-medium">
                        {r.work_order_code ?? r.work_order_id ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      <div className="font-medium">{paletaLabel}</div>
                      {r.is_provisional ? (
                        <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          Provisional (cierre en Corte)
                        </div>
                      ) : null}
                      {r.rollos_count ? (
                        <div className="text-muted-foreground text-xs">{r.rollos_count} rollo(s)</div>
                      ) : null}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>{r.client_name ?? "-"}</TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      <div>{r.product_name ?? "Producto"}</div>
                      <div className="text-muted-foreground text-xs">{r.product_cpe ?? "-"}</div>
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                      {formatKg(r.quantity_finished_kg)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                      {formatKg(r.quantity_dispatched_kg)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                      {formatKg(r.quantity_remaining_kg)}
                    </TableCell>
                    <TableCell className={cn("p-1 text-center", catalogTableBodyCellClass)}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={catalogActionButtonClass}
                        disabled={!canPreviewDispatchRow(r)}
                        title={
                          canPreviewDispatchRow(r)
                            ? `Vista previa de nota · ${r.work_order_code ?? r.work_order_id ?? "OT"}`
                            : "Solo paletas cerradas (no provisional)"
                        }
                        onClick={() => {
                          const id = r.work_order_id
                          if (id == null || !canPreviewDispatchRow(r)) return
                          setPreviewTarget({
                            workOrderId: id,
                            workOrderCode: r.work_order_code,
                          })
                        }}
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Vista previa</span>
                      </Button>
                    </TableCell>
                    <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                      {r.is_provisional ? (
                        <div className="flex flex-col items-end gap-1">
                          {corteTabUrl(r) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs whitespace-nowrap"
                              asChild
                            >
                              <Link
                                to={corteTabUrl(r)!}
                                title="Ir a Producción → Corte para cerrar esta paleta"
                              >
                                Cerrar en Corte
                              </Link>
                            </Button>
                          ) : null}
                          <button
                            type="button"
                            className="text-muted-foreground text-xs underline-offset-2 hover:underline"
                            onClick={explainProvisionalSelection}
                          >
                            ¿Por qué no puedo seleccionar?
                          </button>
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!selectedUsageIds[r.corte_bobina_usage_id ?? -1]}
                          onChange={(ev) => toggleUsage(r, ev.target.checked)}
                          disabled={
                            !r.corte_bobina_usage_id || Number(r.quantity_remaining_kg) <= 0
                          }
                          title="Incluir en nota de entrega"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
                if (!expanded || !hasRollos) return [mainRow]
                return [
                  mainRow,
                  <TableRow key={`${key}-detail`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={10} className="p-3">
                      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                        Rollos de {paletaLabel} (solo lectura)
                      </p>
                      <div className="max-w-3xl rounded-lg border bg-background p-2">
                        <CortePaletaRollosPreview rollosKg={r.rollos_kg} compact />
                      </div>
                    </TableCell>
                  </TableRow>,
                ]
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Mostrando {(page - 1) * pageSize + (pagedRows.length ? 1 : 0)}-
          {(page - 1) * pageSize + pagedRows.length} de {filteredRows.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={catalogPaginationOutlineButtonClass}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={catalogPaginationOutlineButtonClass}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <DeliveryNotePrefillPreviewDialog
        open={previewTarget != null}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null)
        }}
        workOrderId={previewTarget?.workOrderId ?? null}
        workOrderCode={previewTarget?.workOrderCode}
      />
    </CatalogPageShell>
  )
}
