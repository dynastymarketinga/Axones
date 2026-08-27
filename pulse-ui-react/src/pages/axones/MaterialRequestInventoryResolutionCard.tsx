"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, CircleCheck, PackageSearch, Search } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { formatQuantityDisplay } from "@/lib/numeric-display"
import {
  defaultApprovalQty,
  INVENTORY_RESOLUTION_TABS,
  lineLabel,
  lineRemaining,
  lineUnit,
  stockOnHand,
  usesBobinaPicker,
  // validateApprovalQty, <-- YA NO LO NECESITAMOS, LO COMENTO
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

function lineAssignedToMaterialId(
  assignments: Record<number, LineAssignment>,
  materialId: number,
  excludeLineId?: number | null,
): number | null {
  for (const [lineIdStr, assignment] of Object.entries(assignments)) {
    const lineId = Number(lineIdStr)
    if (excludeLineId != null && lineId === excludeLineId) continue
    if (assignment.material.id === materialId) return lineId
  }
  return null
}

function isLineAssignmentReady(
  ln: MaterialRequestDispatchLine,
  assignment: LineAssignment | undefined,
  bobinasByMaterial: Record<number, BobinaDispatchRow[]>,
  selectedBobinaIds: Record<number, Record<string, boolean>>,
): boolean {
  if (!assignment) return false
  const rem = lineRemaining(ln)
  const bobinas = bobinasByMaterial[assignment.material.id] ?? []
  const bobinaPicker = usesBobinaPicker(assignment.material.inventory_area, bobinas)

  if (bobinaPicker) {
    const sel = selectedBobinaIds[ln.id] ?? {}
    const ids = Object.keys(sel).filter((k) => sel[k])
    if (!ids.length) return false
    const total = ids.reduce((acc, idStr) => {
      const b = bobinas.find((x) => x.id === Number(idStr))
      const w = b?.weight_kg ? Number(b.weight_kg) : 0
      return acc + (Number.isFinite(w) ? w : 0)
    }, 0)
    // ==========================================
    // CAMBIO: Volamos la validación visual de exceso para las bobinas también
    // if (!Number.isFinite(total) || total <= 0 || total > rem + 0.0005) return false
    // ==========================================
    if (!Number.isFinite(total) || total <= 0) return false
    return true
  }

  const qn = Number(assignment.quantity)
  if (!Number.isFinite(qn) || qn <= 0) return false
  
  // ==========================================
  // CAMBIO: Volamos la validación de qty aquí para que el botón se ponga verde (activo)
  // const unit = assignment.material.unit || lineUnit(ln)
  // const stock = stockOnHand(assignment.material)
  // return validateApprovalQty(rem, qn, unit, stock, false, true) == null
  // ==========================================
  
  return true; // Siempre está ready si el número es > 0
}

export function MaterialRequestInventoryResolutionCard({
  detail,
  disabled = false,
  dispatching = false,
  onApprove,
}: Props) {
  const pending = useMemo(() => pendingLines(detail.lines), [detail.lines])
  const inventoryPanelRef = useRef<HTMLDivElement>(null)

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
  }, [detail.id])

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
          quantity: rem > 0 ? formatQuantityDisplay(rem) : "",
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

  const unassignedCount = pending.filter((ln) => !assignments[ln.id]).length
  const readyCount = pending.filter((ln) =>
    isLineAssignmentReady(ln, assignments[ln.id], bobinasByMaterial, selectedBobinaIds),
  ).length
  const canApprove =
    pending.length > 0 &&
    pending.every((ln) =>
      isLineAssignmentReady(ln, assignments[ln.id], bobinasByMaterial, selectedBobinaIds),
    )

  function activateLine(lineId: number) {
    setActiveLineId(lineId)
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => {
        inventoryPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }

  async function assignMaterialToActiveLine(material: MaterialRow) {
    if (activeLineId == null || !activeLine) {
      toast.error("Seleccione primero una línea del pedido (izquierda).")
      return
    }
    // ==========================================
    // NOTA: Podrías querer quitar esto también si quieres permitir
    // asignar un material incluso si el stock es 0 (y que quede en negativo). 
    // Por ahora lo dejé para evitar locuras.
    if (stockOnHand(material) <= 0.0005) {
      toast.error(`Sin stock para ${material.sku} · ${material.name}.`)
      return
    }
    // ==========================================
    
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
    toast.success(
      `${material.sku} · ${material.name} asignado a ${lineLabel(activeLine)}`,
    )
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

      // const rem = lineRemaining(ln) <-- Ya no lo usamos para bloquear
      // const unit = assignment.material.unit || lineUnit(ln) <-- Ya no lo usamos
      const bobinas = bobinasByMaterial[assignment.material.id] ?? []
      const bobinaPicker = usesBobinaPicker(assignment.material.inventory_area, bobinas)
      // const stock = stockOnHand(assignment.material) <-- Ya no lo usamos

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
        
        // ==========================================
        // CAMBIO: Volamos la alerta visual que bloqueaba las bobinas si te pasabas
        // if (total > rem + 0.0005) {
        //   toast.error(`La selección de rollos excede lo pendiente (${formatQuantityDisplay(rem)} ${unit}).`)
        //   return null
        // }
        // ==========================================

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
      
      // ==========================================
      // CAMBIO: Volamos la validación a la hora de enviar.
      // const err = validateApprovalQty(rem, qn, unit, stock, false, true)
      // if (err) {
      //   toast.error(err)
      //   return null
      // }
      // ==========================================

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

  function renderInventoryRow(m: MaterialRow, layout: "table" | "card") {
    const stock = stockOnHand(m)
    const activeRem = activeLine ? lineRemaining(activeLine) : 0
    const enoughStock = stock >= activeRem - 0.0005 && activeRem > 0
    const isSelectedForActive =
      activeLineId != null && assignments[activeLineId]?.material.id === m.id
    const assignedOtherLineId = lineAssignedToMaterialId(assignments, m.id, activeLineId)
    const noStock = stock <= 0.0005

    const rowClass = cn(
      "cursor-pointer transition-all duration-200",
      noStock && "cursor-not-allowed opacity-45",
      isSelectedForActive &&
        "bg-primary/20 ring-2 ring-primary shadow-sm shadow-primary/20 dark:bg-primary/25",
      !isSelectedForActive &&
        assignedOtherLineId != null &&
        "bg-muted/40 ring-1 ring-border",
      !isSelectedForActive &&
        assignedOtherLineId == null &&
        enoughStock &&
        "hover:bg-muted/50 hover:ring-1 hover:ring-primary/30",
      !isSelectedForActive &&
        assignedOtherLineId == null &&
        !enoughStock &&
        !noStock &&
        "hover:bg-muted/30",
    )

    const onSelect = () => {
      if (noStock) {
        toast.error(`Sin stock para ${m.sku}.`)
        return
      }
      void assignMaterialToActiveLine(m)
    }

    if (layout === "card") {
      return (
        <button
          key={m.id}
          type="button"
          className={cn(
            "flex min-h-11 w-full items-start gap-3 rounded-xl border border-border/60 p-3 text-left",
            rowClass,
          )}
          onClick={onSelect}
        >
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
              isSelectedForActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background",
            )}
          >
            {isSelectedForActive ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold">{m.sku}</span>
              {isSelectedForActive ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Seleccionado
                </span>
              ) : assignedOtherLineId != null ? (
                <span className="text-muted-foreground text-[10px]">Otra línea</span>
              ) : enoughStock ? (
                <span className="rounded-full border border-emerald-300/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Disponible
                </span>
              ) : null}
            </span>
            <span className={cn("block truncate text-sm", isSelectedForActive && "font-semibold")}>
              {m.name}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              Stock:{" "}
              <span
                className={cn(
                  "font-medium",
                  enoughStock ? "text-emerald-700 dark:text-emerald-300" : "text-foreground",
                )}
              >
                {formatQuantityDisplay(stock)} {m.unit}
              </span>
            </span>
          </span>
        </button>
      )
    }

    return (
      <TableRow key={m.id} className={rowClass} onClick={onSelect}>
        <TableCell className="w-10 pl-3">
          <span
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full border",
              isSelectedForActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background",
            )}
          >
            {isSelectedForActive ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
          </span>
        </TableCell>
        <TableCell className="font-mono text-xs font-medium">{m.sku}</TableCell>
        <TableCell className="max-w-[10rem]">
          <div className={cn("truncate text-sm", isSelectedForActive && "font-semibold")}>
            {m.name}
          </div>
          {isSelectedForActive ? (
            <span className="text-primary text-[10px] font-semibold uppercase tracking-wide">
              Seleccionado
            </span>
          ) : assignedOtherLineId != null ? (
            <span className="text-muted-foreground text-[10px]">Asignado a otra línea</span>
          ) : enoughStock ? (
            <span className="text-emerald-700 dark:text-emerald-300 text-[10px]">Disponible</span>
          ) : null}
        </TableCell>
        <TableCell
          className={cn(
            "text-right tabular-nums font-medium",
            enoughStock && "text-emerald-700 dark:text-emerald-300",
          )}
        >
          {formatQuantityDisplay(stock)}
        </TableCell>
        <TableCell className="text-muted-foreground pr-3 text-xs">{m.unit}</TableCell>
      </TableRow>
    )
  }

  if (!pending.length || detail.status === "cancelled" || detail.status === "dispatched") {
    return null
  }

  const approveButton = (
    <Button
      type="button"
      disabled={disabled || dispatching || !canApprove}
      onClick={() => void handleApproveClick()}
      className="w-full shadow-md shadow-primary/20 lg:w-auto"
    >
      {dispatching ? "Procesando…" : "Aprobar salida de inventario"}
    </Button>
  )

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-md shadow-primary/5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="space-y-5 p-5 md:p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PackageSearch className="text-primary h-5 w-5" aria-hidden />
            <h3 className="text-lg font-semibold tracking-tight">
              Resolver salida desde inventario
            </h3>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            El solicitante describe lo que necesita (sin SKU). Compare con el stock real,{" "}
            <strong className="text-foreground">haga clic en el material que sale</strong> y confirme
            la cantidad.
          </p>
          <ol className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <li>
              <span className="text-primary font-semibold">1.</span> Elija línea
            </li>
            <li>
              <span className="text-primary font-semibold">2.</span> Clic en inventario
            </li>
            <li>
              <span className="text-primary font-semibold">3.</span> Confirme cantidad
            </li>
            <li>
              <span className="text-primary font-semibold">4.</span> Aprobar
            </li>
          </ol>
          <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
            <p className="text-muted-foreground text-xs tabular-nums">
              {readyCount}/{pending.length} líneas listas
              {unassignedCount > 0 ? ` · faltan ${unassignedCount} por vincular` : ""}
            </p>
            {approveButton}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Lo que pidió el cliente</p>
            <div className="space-y-2">
              {pending.map((ln) => {
                const rem = lineRemaining(ln)
                const assignment = assignments[ln.id]
                const isActive = ln.id === activeLineId
                const isReady = isLineAssignmentReady(
                  ln,
                  assignment,
                  bobinasByMaterial,
                  selectedBobinaIds,
                )
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
                    onClick={() => activateLine(ln.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault()
                        activateLine(ln.id)
                      }
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-sm transition-all",
                      isActive && !assignment && "border-amber-400/70 bg-amber-50/50 ring-2 ring-amber-400/30 dark:bg-amber-950/20",
                      isActive && assignment && "border-primary/50 bg-primary/[0.08] ring-2 ring-primary/30",
                      !isActive && assignment && isReady && "border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/15",
                      !isActive && !assignment && "border-border/60 bg-muted/15 hover:border-primary/20",
                      !isActive && assignment && !isReady && "border-border/60 bg-muted/15 hover:border-primary/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{lineLabel(ln)}</div>
                      {isReady ? (
                        <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : null}
                    </div>
                    <div className="text-muted-foreground mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums">
                      <div>
                        <span className="block uppercase tracking-wide">Solicitado</span>
                        <span className="text-foreground font-semibold">
                          {formatQuantityDisplay(ln.quantity_requested)} {lineUnit(ln)}
                        </span>
                      </div>
                      <div>
                        <span className="block uppercase tracking-wide">Aprobado</span>
                        <span>{formatQuantityDisplay(ln.quantity_dispatched)}</span>
                      </div>
                      <div>
                        <span className="block uppercase tracking-wide">Pendiente</span>
                        <span className="text-primary font-semibold">
                          {formatQuantityDisplay(rem)} {lineUnit(ln)}
                        </span>
                      </div>
                    </div>

                    {assignment ? (
                      <div className="mt-3 space-y-2 rounded-lg border border-emerald-400/40 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-950/25">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Saldrá del inventario: {assignment.material.sku} ·{" "}
                          {assignment.material.name}
                        </p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          Stock disponible:{" "}
                          <span className="text-foreground font-medium">
                            {formatQuantityDisplay(stockOnHand(assignment.material))}{" "}
                            {assignment.material.unit}
                          </span>
                        </p>
                        {bobinaPicker ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Rollos seleccionados:{" "}
                              <span className="font-medium text-foreground">
                                {formatQuantityDisplay(selectedKg)} kg
                              </span>
                            </p>
                            <div className="max-h-32 overflow-auto rounded-md border bg-background/80 p-2">
                              {bobinas.map((b) => (
                                <label
                                  key={b.id}
                                  className="flex min-h-9 cursor-pointer items-center justify-between gap-2 py-1 text-xs"
                                >
                                  <span className="font-mono">
                                    #{b.id} {b.code ? `· ${b.code}` : ""}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatQuantityDisplay(b.weight_kg) || "—"} kg
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sel[String(b.id)])}
                                    
                                    // ==========================================
                                    // CAMBIO: Volamos la validación visual que inhabilitaba 
                                    // más bobinas si el peso ya superaba el rem
                                    disabled={rem <= 0}
                                    // ==========================================
                                    
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
                            className="h-11 bg-background/90"
                            // CAMBIO DE PLACEHOLDER: Para no decir "max X" ya que se puede pasar
                            placeholder="Cantidad a aprobar (puede ser mayor a lo pendiente)"
                            value={assignment.quantity}
                            onChange={(ev) => updateAssignmentQuantity(ln.id, ev.target.value)}
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        )}
                      </div>
                    ) : (
                      <p
                        className={cn(
                          "mt-2 text-xs font-medium",
                          isActive
                            ? "text-amber-800 dark:text-amber-200"
                            : "text-muted-foreground",
                        )}
                      >
                        {isActive
                          ? "Paso 2: elija un material en la lista de inventario →"
                          : "Sin material asignado — haga clic para activar"}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div ref={inventoryPanelRef} className="space-y-3 scroll-mt-4">
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
                      className={cn("min-h-10 text-xs sm:text-sm", theme.tabTriggerClass)}
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
                className="h-11 pl-9"
                placeholder="Buscar SKU, nombre o código de barras…"
                value={inventorySearch}
                onChange={(ev) => setInventorySearch(ev.target.value)}
              />
            </div>

            {/* Mobile: card list */}
            <div className="space-y-2 md:hidden">
              {inventoryLoading && !inventoryByArea[inventoryTab]?.length ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Cargando inventario…
                </p>
              ) : visibleInventory.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Sin materiales en esta área.
                </p>
              ) : (
                visibleInventory.map((m) => renderInventoryRow(m, "card"))
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-xl border border-border/60 md:block">
              <div className="max-h-[min(24rem,50vh)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-10 pl-3" />
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Material</TableHead>
                      <TableHead className="text-right text-xs">Stock</TableHead>
                      <TableHead className="pr-3 text-xs">Unid.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryLoading && !inventoryByArea[inventoryTab]?.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground py-8 text-center text-sm"
                        >
                          Cargando inventario…
                        </TableCell>
                      </TableRow>
                    ) : visibleInventory.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground py-8 text-center text-sm"
                        >
                          Sin materiales en esta área.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleInventory.map((m) => renderInventoryRow(m, "table"))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {activeLine ? (
              <p className="text-muted-foreground text-xs">
                Línea activa:{" "}
                <span className="text-foreground font-medium">{lineLabel(activeLine)}</span>
                {" · "}
                {assignments[activeLine.id]
                  ? "Material vinculado. Ajuste cantidad si hace falta."
                  : "Toque una fila del inventario para marcarla."}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-4 lg:hidden">
          <p className="text-muted-foreground text-center text-xs tabular-nums">
            {readyCount}/{pending.length} líneas listas
            {unassignedCount > 0 ? ` · faltan ${unassignedCount} por vincular al inventario` : ""}
          </p>
          {approveButton}
        </div>
      </div>
    </div>
  )
}