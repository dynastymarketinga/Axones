"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import {
  AXONES_INVENTORY_FILTER_INPUT_CLASS,
  AXONES_INVENTORY_PAGE_CLASS,
  AxonesFormCard,
  AxonesPageHeader,
} from "@/components/axones/inventory-page-layout"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"
import { labelInventoryArea } from "@/lib/inventory-area-labels"
import type { LaravelPaginated, MaterialRow, WorkOrderListRow } from "@/types/api"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const BOBINAS_RECHAZADAS = "bobinas_rechazadas"

export default function InventoryReturnNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const demoMode = searchParams.get("demo") === "1"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderListRow[]>([])
  const [loadingWos, setLoadingWos] = useState(false)
  const [materialId, setMaterialId] = useState("")
  const [workOrderId, setWorkOrderId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [demoHintOpen, setDemoHintOpen] = useState(false)

  const demoMaterialAppliedRef = useRef(false)
  const demoWoAppliedRef = useRef(false)

  useEffect(() => {
    if (!demoMode) {
      demoMaterialAppliedRef.current = false
      demoWoAppliedRef.current = false
    }
  }, [demoMode])

  const selectedMaterial = useMemo(
    () => materials.find((m) => String(m.id) === materialId),
    [materials, materialId],
  )

  const needsWorkOrder = selectedMaterial?.inventory_area === BOBINAS_RECHAZADAS

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { per_page: 200, page: 1 },
      })
      setMaterials(data.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar los materiales.")
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadWorkOrders = useCallback(async () => {
    setLoadingWos(true)
    try {
      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
        query: { per_page: 100, page: 1 },
      })
      const rows = (data.data ?? []).filter((w) => w.status !== "cancelled")
      setWorkOrders(rows)
    } catch {
      setWorkOrders([])
    } finally {
      setLoadingWos(false)
    }
  }, [])

  useEffect(() => {
    void loadMaterials()
  }, [loadMaterials])

  useEffect(() => {
    if (needsWorkOrder) void loadWorkOrders()
    else {
      setWorkOrderId("")
      setWorkOrders([])
    }
  }, [needsWorkOrder, loadWorkOrders])

  useEffect(() => {
    if (!demoMode || demoMaterialAppliedRef.current || materials.length === 0) return
    const m = materials[0]
    if (!m) return
    demoMaterialAppliedRef.current = true
    setMaterialId(String(m.id))
    setQuantity("18,75")
    setReason("Ejemplo: sobrante de turno (solo vista previa con ?demo=1).")
    toast("Datos de ejemplo", {
      description: "Revise o borre antes de guardar en producción.",
    })
  }, [demoMode, materials])

  useEffect(() => {
    if (!demoMode || !needsWorkOrder || workOrders.length === 0 || demoWoAppliedRef.current) return
    if (workOrderId) return
    demoWoAppliedRef.current = true
    setWorkOrderId(String(workOrders[0].id))
  }, [demoMode, needsWorkOrder, workOrders, workOrderId])

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!materialId) {
      toast.error("Seleccione un material.")
      return
    }
    const mat = materials.find((m) => String(m.id) === materialId)
    if (!mat) {
      toast.error("Material no válido.")
      return
    }
    const qty = quantity.replace(",", ".").trim()
    if (!qty || Number(qty) <= 0) {
      toast.error("Indique una cantidad mayor a cero.")
      return
    }
    if (needsWorkOrder && !workOrderId) {
      toast.error("Las devoluciones a bobinas rechazadas requieren una orden de trabajo.")
      return
    }

    const body: Record<string, unknown> = {
      material_id: Number(materialId),
      destination_area: mat.inventory_area,
      quantity: Number(qty),
    }
    if (reason.trim()) body.reason = reason.trim()
    if (needsWorkOrder && workOrderId) body.work_order_id = Number(workOrderId)

    setSaving(true)
    try {
      await apiFetch("inventory-returns", {
        method: "POST",
        body: JSON.stringify(body),
      })
      toast.success("Devolución registrada; queda pendiente hasta aceptar el ingreso.")
      navigate("/devoluciones", { replace: true })
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la devolución.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={AXONES_INVENTORY_PAGE_CLASS}>
      <AxonesPageHeader
        title="Nueva devolución"
        description="Ingreso pendiente hasta aceptarlo en el listado. Bobinas rechazadas: elija OT."
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/devoluciones">Volver al listado</Link>
          </Button>
        }
      />

      {loading ? (
        <PageLoadingBlock />
      ) : (
        <AxonesFormCard className="w-full space-y-6">
          {demoMode ? (
            <p className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Modo ejemplo: valores precargados. Cámbielos o quite{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">?demo=1</code> de la URL antes de
              registrar en serio.
            </p>
          ) : (
            <Collapsible open={demoHintOpen} onOpenChange={setDemoHintOpen} className="rounded-xl border border-primary/15 bg-muted/20">
              <CollapsibleTrigger
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/50",
                  demoHintOpen && "border-b border-border/60",
                )}
              >
                <span className="text-muted-foreground">Vista previa con datos de muestra</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    demoHintOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border/40 px-4 pb-4 pt-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Puede abrir esta pantalla con el parámetro{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">?demo=1</code> para
                  precargar material, cantidad y motivo de ejemplo (solo para revisar el flujo).
                </p>
                <p className="mt-2">
                  <Link
                    className="text-primary text-sm font-medium underline underline-offset-4 hover:text-primary/90"
                    to="/devoluciones/nueva?demo=1"
                  >
                    Abrir con ?demo=1
                  </Link>
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
            <div className="grid gap-2">
              <Label className="text-base" htmlFor="irn-material">
                Material
              </Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger
                  id="irn-material"
                  className={cn(AXONES_INVENTORY_FILTER_INPUT_CLASS, "h-11 min-h-11 text-base")}
                >
                  <SelectValue placeholder="Ej. BOB-001 · Kraft 80g · Material" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.sku} · {m.name} · {labelInventoryArea(m.inventory_area)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMaterial ? (
                <p className="text-muted-foreground text-xs">
                  Destino:{" "}
                  <span className="font-medium text-foreground">
                    {labelInventoryArea(selectedMaterial.inventory_area)}
                  </span>
                </p>
              ) : null}
            </div>

            {needsWorkOrder ? (
              <div className="grid gap-2">
                <Label htmlFor="irn-wo">Orden de trabajo</Label>
                {loadingWos ? (
                  <p className="text-muted-foreground text-sm">Cargando órdenes…</p>
                ) : (
                  <Select value={workOrderId} onValueChange={setWorkOrderId}>
                    <SelectTrigger
                      id="irn-wo"
                      className={cn(AXONES_INVENTORY_FILTER_INPUT_CLASS, "h-11 min-h-11 text-base")}
                    >
                      <SelectValue placeholder="Ej. OT-2026-0042" />
                    </SelectTrigger>
                    <SelectContent>
                      {workOrders.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.code}
                          {w.status ? ` · ${w.status}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label className="text-base" htmlFor="irn-qty">
                Cantidad (kg)
              </Label>
              <Input
                id="irn-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="12,50"
                className={cn(AXONES_INVENTORY_FILTER_INPUT_CLASS, "h-11 min-h-11 text-base")}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-base" htmlFor="irn-reason">
                Motivo (opcional)
              </Label>
              <Textarea
                id="irn-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Retorno de bobina tras control de calidad…"
                className={cn(AXONES_INVENTORY_FILTER_INPUT_CLASS, "min-h-[100px] resize-y text-base")}
              />
            </div>

            <div className="flex flex-wrap gap-3 border-t border-border/50 pt-4">
              <Button className="h-11 min-h-11 px-6 text-base" type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Registrar devolución"}
              </Button>
            </div>
          </form>
        </AxonesFormCard>
      )}
    </div>
  )
}
