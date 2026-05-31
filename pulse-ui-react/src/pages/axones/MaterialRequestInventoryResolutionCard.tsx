"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PackageSearch, Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import {
  defaultApprovalQty,
  INVENTORY_RESOLUTION_TABS,
  lineLabel,
  lineRemaining,
  lineUnit,
  stockOnHand,
  usesBobinaPicker,
  validateApprovalQty,
  type BobinaDispatchRow,
  type InventoryResolutionTab,
  type MaterialRequestDispatchLine,
} from "@/lib/material-request-dispatch-utils"
import { getMaterialsListTabTheme } from "@/lib/material-area-theme"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LineAssignment = {
  material: MaterialRow
  quantity: string
  bobinaIds: number[]
}

export type MaterialRequestDetailForResolution = {
  id: number
  status: string
  authorized_by?: number | null
  lines: MaterialRequestDispatchLine[]
}

type Props = {
  detail: MaterialRequestDetailForResolution
  disabled?: boolean
  dispatching?: boolean
  onApprove: (payload: {
    lines: Array<{
      material_request_line_id: number
      quantity: number
      material_id?: number
      bobina_ids?: number[]
    }>
  }) => Promise<void>
}

function pendingLines(lines: MaterialRequestDispatchLine[]): MaterialRequestDispatchLine[] {
  return lines.filter((ln) => lineRemaining(ln) > 0.0005)
}

function filterMaterials(rows: MaterialRow[], search: string): MaterialRow[] {
  const q = search.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (m) =>
      m.sku.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      (m.barcode?.toLowerCase().includes(q) ?? false),
  )
}

export function MaterialRequestInventoryResolutionCard({
  detail,
  disabled = false,
  dispatching = false,
  onApprove,
}: Props) {
  const pending = useMemo(() => pendingLines(detail.lines), [detail.lines])

  const [activeLineId, setActiveLineId] = useState<number | null>(null)
  const [inventoryTab, setInventoryTab] = useState<InventoryResolutionTab>("material")
  const [inventorySearch, setInventorySearch] = useState("")
  const [inventoryByArea, setInventoryByArea] = useState<
    Partial<Record<InventoryResolutionTab, MaterialRow[]>>
  >({})
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [assignments, setAssignments] = useState<Record<number, LineAssignment>>({})
  const [bobinasByMaterial, setBobinasByMaterial] = useState<
    Record<number, BobinaDispatchRow[]>
  >({})
  const [selectedBobinaIds, setSelectedBobinaIds] = useState<
    Record<number, Record<string, boolean>>
  >({})

  const loadBobinasForMaterial = useCallback(async (materialId: number): Promise<BobinaDispatchRow[]> => {
    try {
      const res = await apiFetch<LaravelPaginated<BobinaDispatchRow>>("bobinas", {
        query: {
          material_id: materialId,
          status: "available",
          per_page: 200,
          page: 1,
        },
      })
      const rows = res.data ?? []
      setBobinasByMaterial((prev) => ({ ...prev, [materialId]: rows }))
      return rows
    } catch {
      setBobinasByMaterial((prev) => ({ ...prev, [materialId]: [] }))
      return []
    }
  }, [])

  useEffect(() => {
    if (!pending.length) {
      setActiveLineId(null)
      return
    }
    setActiveLineId((cur) => {
      if (cur != null && pending.some((ln) => ln.id === cur)) return cur
      return pending[0]?.id ?? null
    })
  }, [pending])

  useEffect(() => {
    setAssignments({})
    setSelectedBobinaIds({})
    setBobinasByMaterial({})
    setInventoryByArea({})
  }, [detail.id, detail.status])

  useEffect(() => {
    if (disabled || !pending.length) return

    const next: Record<number, LineAssignment> = {}
    for (const ln of pending) {
      if (ln.material_id != null && ln.material) {
        const rem = lineRemaining(ln)
        const materialRow: MaterialRow = {
          id: ln.material_id,
          sku: ln.material.sku,
          name: ln.material.name,
          unit: ln.material.unit,
          inventory_area: ln.material.inventory_area ?? "material",
          quantity_on_hand: ln.material.quantity_on_hand ?? "0",
          min_stock: "0",
        }
        next[ln.id] = {
          material: materialRow,
          quantity: rem > 0 ? String(rem) : "",
          bobinaIds: [],
        }
        const area = (ln.material.inventory_area ?? "material") as InventoryResolutionTab
        if (INVENTORY_RESOLUTION_TABS.some((t) => t.value === area)) {
          setInventoryTab(area)
        }
        if (ln.material.inventory_area === "material") {
          void loadBobinasForMaterial(ln.material_id)
        }
      }
    }
    if (Object.keys(next).length) {
      setAssignments(next)
    }
  }, [detail.id, detail.lines, disabled, loadBobinasForMaterial, pending])

  const loadInventory = useCallback(async (area: InventoryResolutionTab) => {
    setInventoryLoading(true)
    try {
      const res = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: {
          inventory_area: area,
          per_page: 200,
          page: 1,
          sort_by: "name",
          sort_dir: "asc",
        },
      })
      setInventoryByArea((prev) => ({ ...prev, [area]: res.data ?? [] }))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el inventario.")
    } finally {
      setInventoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (disabled) return
    if (inventoryByArea[inventoryTab]?.length) return
    void loadInventory(inventoryTab)
  }, [disabled, inventoryTab, inventoryByArea, loadInventory])

  const activeLine = pending.find((ln) => ln.id === activeLineId) ?? null
  const visibleInventory = filterMaterials(inventoryByArea[inventoryTab] ?? [], inventorySearch)

  async function assignMaterialToActiveLine(material: MaterialRow) {
    if (activeLineId == null || !activeLine) return
    const bobinas = await loadBobinasForMaterial(material.id)
    const qty = defaultApprovalQty(activeLine, material, bobinas)
    setAssignments((prev) => ({
      ...prev,
      [activeLineId]: {
        material,
        quantity: qty,
        bobinaIds: [],
      },
    }))
    setSelectedBobinaIds((prev) => ({ ...prev, [activeLineId]: {} }))
  }

  function updateAssignmentQuantity(lineId: number, quantity: string) {
    setAssignments((prev) => {
      const cur = prev[lineId]
      if (!cur) return prev
      return { ...prev, [lineId]: { ...cur, quantity } }
    })
  }

  function buildDispatchPayload(): Array<{
    material_request_line_id: number
    quantity: number
    material_id?: number
    bobina_ids?: number[]
  }> | null {
    const out: Array<{
      material_request_line_id: number
      quantity: number
      material_id?: number
      bobina_ids?: number[]
    }> = []

    for (const ln of pending) {
      const assignment = assignments[ln.id]
      if (!assignment) {
        toast.error(`Asigne un material de inventario para: ${lineLabel(ln)}`)
        return null
      }

      const rem = lineRemaining(ln)
      const unit = assignment.material.unit || lineUnit(ln)
      const bobinas = bobinasByMaterial[assignment.material.id] ?? []
      const bobinaPicker = usesBobinaPicker(assignment.material.inventory_area, bobinas)
      const stock = stockOnHand(assignment.material)

      if (bobinaPicker) {
        const sel = selectedBobinaIds[ln.id] ?? {}
        const ids = Object.keys(sel)
          .filter((k) => sel[k])
          .map((k) => Number(k))
          .filter((n) => Number.isFinite(n) && n > 0)
        if (!ids.length) {
          toast.error(`Seleccione rollos para: ${lineLabel(ln)}`)
          return null
        }
        const total = ids.reduce((acc, id) => {
          const b = bobinas.find((x) => x.id === id)
          const w = b?.weight_kg ? Number(b.weight_kg) : 0
          return acc + (Number.isFinite(w) ? w : 0)
        }, 0)
        if (!Number.isFinite(total) || total <= 0) {
          toast.error(`Rollos inválidos para: ${lineLabel(ln)}`)
          return null
        }
        if (total > rem + 0.0005) {
          toast.error(`La selección de rollos excede lo pendiente (${rem.toFixed(3)} ${unit}).`)
          return null
        }
        const entry: {
          material_request_line_id: number
          quantity: number
          material_id?: number
          bobina_ids?: number[]
        } = {
          material_request_line_id: ln.id,
          quantity: total,
          bobina_ids: ids,
        }
        if (ln.material_id == null) entry.material_id = assignment.material.id
        out.push(entry)
        continue
      }

      const qn = Number(assignment.quantity)
      if (!Number.isFinite(qn) || qn <= 0) {
        toast.error(`Indique la cantidad a aprobar para: ${lineLabel(ln)}`)
        return null
      }
      const err = validateApprovalQty(rem, qn, unit, stock, false, true)
      if (err) {
        toast.error(err)
        return null
      }
      const entry: {
        material_request_line_id: number
        quantity: number
        material_id?: number
      } = {
        material_request_line_id: ln.id,
        quantity: qn,
      }
      if (ln.material_id == null) entry.material_id = assignment.material.id
      out.push(entry)
    }

    if (!out.length) {
      toast.error("No hay líneas pendientes para aprobar.")
      return null
    }
    return out
  }

  async function handleApproveClick() {
    const lines = buildDispatchPayload()
    if (!lines) return
    await onApprove({ lines })
    setAssignments({})
    setSelectedBobinaIds({})
  }

  if (!pending.length || detail.status === "cancelled" || detail.status === "dispatched") {
    return null
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-md shadow-primary/5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="space-y-5 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PackageSearch className="text-primary h-5 w-5" aria-hidden />
              <h3 className="text-lg font-semibold tracking-tight">
                Resolver salida desde inventario
              </h3>
            </div>
            <p className="text-muted-foreground max-w-2xl text-sm">
              Compare lo solicitado con el stock real. Seleccione una línea, elija el material en
              la pestaña correspondiente y confirme la cantidad o los rollos.
            </p>
          </div>
          <Button
            type="button"
            disabled={disabled || dispatching}
            onClick={() => void handleApproveClick()}
            className="shadow-md shadow-primary/20"
          >
            {dispatching ? "Procesando…" : "Aprobar salida de inventario"}
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Lo que pidió el cliente</p>
            <div className="space-y-2">
              {pending.map((ln) => {
                const rem = lineRemaining(ln)
                const assignment = assignments[ln.id]
                const isActive = ln.id === activeLineId
                const bobinas =
                  assignment != null
                    ? (bobinasByMaterial[assignment.material.id] ?? [])
                    : []
                const bobinaPicker =
                  assignment != null &&
                  usesBobinaPicker(assignment.material.inventory_area, bobinas)
                const sel = selectedBobinaIds[ln.id] ?? {}
                const selectedKg = Object.keys(sel)
                  .filter((k) => sel[k])
                  .reduce((acc, idStr) => {
                    const b = bobinas.find((x) => x.id === Number(idStr))
                    const w = b?.weight_kg ? Number(b.weight_kg) : 0
                    return acc + (Number.isFinite(w) ? w : 0)
                  }, 0)

                return (
                  <div
                    key={ln.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveLineId(ln.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault()
                        setActiveLineId(ln.id)
                      }
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-sm transition-all",
                      isActive
                        ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20"
                        : "border-border/60 bg-muted/15 hover:border-primary/20",
                    )}
                  >
                    <div className="font-medium">{lineLabel(ln)}</div>
                    <div className="text-muted-foreground mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums">
                      <div>
                        <span className="block uppercase tracking-wide">Solicitado</span>
                        <span className="text-foreground font-semibold">
                          {ln.quantity_requested} {lineUnit(ln)}
                        </span>
                      </div>
                      <div>
                        <span className="block uppercase tracking-wide">Aprobado</span>
                        <span>{ln.quantity_dispatched}</span>
                      </div>
                      <div>
                        <span className="block uppercase tracking-wide">Pendiente</span>
                        <span className="text-primary font-semibold">
                          {rem.toFixed(3)} {lineUnit(ln)}
                        </span>
                      </div>
                    </div>

                    {assignment ? (
                      <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-background/80 p-3">
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                          Asignado: {assignment.material.sku} · {assignment.material.name}
                        </p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          Stock disponible:{" "}
                          <span className="text-foreground font-medium">
                            {stockOnHand(assignment.material).toFixed(3)}{" "}
                            {assignment.material.unit}
                          </span>
                        </p>
                        {bobinaPicker ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Rollos seleccionados:{" "}
                              <span className="font-medium text-foreground">
                                {selectedKg.toFixed(3)} kg
                              </span>
                            </p>
                            <div className="max-h-32 overflow-auto rounded-md border p-2">
                              {bobinas.map((b) => (
                                <label
                                  key={b.id}
                                  className="flex cursor-pointer items-center justify-between gap-2 py-1 text-xs"
                                >
                                  <span className="font-mono">
                                    #{b.id} {b.code ? `· ${b.code}` : ""}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {b.weight_kg ?? "—"} kg
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sel[String(b.id)])}
                                    disabled={
                                      rem <= 0 ||
                                      (!sel[String(b.id)] && selectedKg >= rem - 0.0005)
                                    }
                                    onChange={(ev) => {
                                      const checked = ev.target.checked
                                      setSelectedBobinaIds((prev) => ({
                                        ...prev,
                                        [ln.id]: {
                                          ...(prev[ln.id] ?? {}),
                                          [String(b.id)]: checked,
                                        },
                                      }))
                                    }}
                                    onClick={(ev) => ev.stopPropagation()}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Input
                            inputMode="decimal"
                            className="h-9"
                            placeholder={`Cantidad a aprobar (máx. ${rem.toFixed(3)} ${assignment.material.unit})`}
                            value={assignment.quantity}
                            onChange={(ev) => updateAssignmentQuantity(ln.id, ev.target.value)}
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-xs">
                        {isActive
                          ? "Seleccione un material del inventario →"
                          : "Sin material asignado — haga clic para activar"}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Inventario disponible</p>
            <Tabs
              value={inventoryTab}
              onValueChange={(v) => setInventoryTab(v as InventoryResolutionTab)}
            >
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/50 p-1 md:grid-cols-4">
                {INVENTORY_RESOLUTION_TABS.map((tab) => {
                  const theme = getMaterialsListTabTheme(tab.value)
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn("text-xs sm:text-sm", theme.tabTriggerClass)}
                    >
                      {tab.label}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Buscar SKU, nombre o código de barras…"
                value={inventorySearch}
                onChange={(ev) => setInventorySearch(ev.target.value)}
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="max-h-[min(24rem,50vh)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Material</TableHead>
                      <TableHead className="text-right text-xs">Stock</TableHead>
                      <TableHead className="text-xs">Unid.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryLoading && !inventoryByArea[inventoryTab]?.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                          Cargando inventario…
                        </TableCell>
                      </TableRow>
                    ) : visibleInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                          Sin materiales en esta área.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleInventory.map((m) => {
                        const stock = stockOnHand(m)
                        const activeRem = activeLine ? lineRemaining(activeLine) : 0
                        const enoughStock = stock >= activeRem - 0.0005 && activeRem > 0
                        const isSelected =
                          activeLineId != null &&
                          assignments[activeLineId]?.material.id === m.id
                        return (
                          <TableRow
                            key={m.id}
                            className={cn(
                              "cursor-pointer transition-colors",
                              stock <= 0.0005 && "opacity-50",
                              enoughStock && !isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20",
                              isSelected && "bg-primary/10",
                              "hover:bg-primary/5",
                            )}
                            onClick={() => void assignMaterialToActiveLine(m)}
                          >
                            <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                            <TableCell className="max-w-[10rem] truncate text-sm">{m.name}</TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums font-medium",
                                enoughStock && "text-emerald-700 dark:text-emerald-300",
                              )}
                            >
                              {stock.toFixed(3)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">{m.unit}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            {activeLine ? (
              <p className="text-muted-foreground text-xs">
                Línea activa: <span className="text-foreground font-medium">{lineLabel(activeLine)}</span>
                {" · "}Clic en una fila para asignar el SKU de salida.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
