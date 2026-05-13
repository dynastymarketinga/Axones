"use client"

import { useCallback, useEffect, useState } from "react"
import { Scissors } from "lucide-react"
import { toast } from "sonner"

import { ProductionAreaPanel } from "@/components/axones/ProductionAreaPanel"
import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiFetch, ApiError } from "@/lib/api"
import { WindingFigurePicker } from "./WindingFigurePicker"
import "./work-order-planilla.css"

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  return { ...prefill, ...(form ?? {}) }
}

export default function WorkOrderCorteControlPanel({ workOrderId }: { workOrderId: number }) {
  const [loading, setLoading] = useState(true)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})

  const load = useCallback(async () => {
    if (!Number.isFinite(workOrderId) || workOrderId < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(`work-orders/${workOrderId}/orden-trabajo`)
      const basePrefill = payload.prefill ?? {}
      setPrefill(basePrefill)
      setForm(mergePrefill(basePrefill, payload.form))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT para corte.")
      setPrefill({})
      setForm({})
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="text-muted-foreground text-sm">Cargando control de corte…</p>

  return (
    <div className="ax-mes space-y-4">
      <WorkOrderStageBadge current="corte" />
      <div className="ax-ot">
        <div className="ot-section">
          <div className="section-header">
            <span className="inline-flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              AREA DE CORTE / EMBALAJE
            </span>
          </div>
          <div className="section-body">
            <div className="ot-grid ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Ancho corte (mm)</label>
                <input className="ot-input" value={readString(form.anchoCorteFinal)} placeholder="320±0" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Peso bobina (Kg)</label>
                <input className="ot-input" value={readString(form.pesoBobina)} placeholder="19-20" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metros/Bobina (m)</label>
                <input className="ot-input" value={readString(form.metrosBobina)} placeholder="1020 ± 20" readOnly />
              </div>
              <div className="ot-field sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="ot-label">Figura embobinado (1-8 o libre)</label>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Figura
                  </Badge>
                </div>
                <WindingFigurePicker
                  value={readString(form.orientacionEmbalaje)}
                  onChange={() => undefined}
                  className="pointer-events-none"
                />
              </div>
              <div className="ot-field">
                <label className="ot-label">Ubic. fotocelda</label>
                <input className="ot-input" value={readString(form.ubicFotoceldaCorte)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Dist. fotocelda al borde (mm)</label>
                <input className="ot-input" value={readString(form.distFotoceldaBorde)} placeholder="1±1" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Dist. figura lado contrario (mm)</label>
                <input className="ot-input" value={readString(form.distFiguraLadoContrario)} placeholder="20±1" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Dist. figura lado fotocelda (mm)</label>
                <input className="ot-input" value={readString(form.distFiguraLadoFotocelda)} placeholder="30±1" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Max. empates</label>
                <input className="ot-input" value={readString(form.maxEmpates)} placeholder="1" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Diam. bobina (mm)</label>
                <input className="ot-input" value={readString(form.diamBobina)} placeholder="400 ± 5" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Ancho core (mm)</label>
                <input className="ot-input" value={readString(form.anchoCore)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Diam. core (Plg)</label>
                <input className="ot-input" value={readString(form.diamCorePlg)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Cant. cores</label>
                <input className="ot-input" value={readString(form.cantCores)} readOnly />
              </div>
            </div>

            <div className="ot-grid ot-metrics-before-nested ot-cols-4">
              <div className="ot-field">
                <label className="ot-label">Kg ingresados</label>
                <input className="ot-input" value={readString(form.kgIngresadosCorte)} placeholder="kg ingresados" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg salida</label>
                <input className="ot-input" value={readString(form.kgSalidaCorte)} readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Kg merma</label>
                <input className="ot-input" value={readString(form.kgMermaCorte)} placeholder="Ej: 10.00" readOnly />
              </div>
              <div className="ot-field">
                <label className="ot-label">Metraje</label>
                <input className="ot-input" value={readString(form.metrajeCorte)} readOnly />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Datos de pedido / OT (solo lectura)</h3>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
        </div>
        <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-muted-foreground">OT:</span> {readString(prefill.numeroOrden) || "—"}</div>
          <div><span className="text-muted-foreground">Cliente:</span> {readString(form.cliente) || "—"}</div>
          <div><span className="text-muted-foreground">Producto:</span> {readString(form.producto) || "—"}</div>
          <div><span className="text-muted-foreground">CPE:</span> {readString(form.cpe) || "—"}</div>
          <div><span className="text-muted-foreground">Estructura:</span> {readString(form.estructuraMaterial) || "—"}</div>
          <div><span className="text-muted-foreground">Tipo impresión:</span> {readString(form.tipoImpresionEstructura || form.tipoImpresion) || "—"}</div>
          <div><span className="text-muted-foreground">Cant. solicitada (Kg):</span> {readString(form.pedidoKg) || "—"}</div>
          <div><span className="text-muted-foreground">Ref. pedido:</span> {readString(form.client_order_code || form.client_order_reference) || "—"}</div>
        </div>
      </div>

      <ProductionAreaPanel
        workOrderId={workOrderId}
        title="Corte"
        areaPath="corte"
        usageMode="bobina"
      />
    </div>
  )
}

