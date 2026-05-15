"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, ClipboardList, Info } from "lucide-react"

import { ProductionAreaPanel } from "@/components/axones/ProductionAreaPanel"
import { WorkOrderDocumentSheet } from "@/components/axones/WorkOrderDocumentSheet"
import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import { isAxonesFullAccess } from "@/lib/axones-roles"
import WorkOrderPrintingControlPanel from "@/pages/axones/WorkOrderPrintingControlPanel"
import WorkOrderMontajeControlPanel from "@/pages/axones/WorkOrderMontajeControlPanel"
import WorkOrderLaminacionControlPanel from "@/pages/axones/WorkOrderLaminacionControlPanel"
import WorkOrderCorteControlPanel from "@/pages/axones/WorkOrderCorteControlPanel"
import { WorkOrderPrintingPlanillaSnapshot } from "@/pages/axones/WorkOrderPrintingPlanillaSnapshot"
import { WorkOrderMontajePlanillaSnapshot } from "@/pages/axones/WorkOrderMontajePlanillaSnapshot"
import type { WorkOrderDetailRecord } from "@/types/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function WorkOrderDetailPage() {
  const { woId } = useParams<{ woId: string }>()
  const id = Number(woId)
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const isBoss = isAxonesFullAccess(role)
  const canUsePrintingOps = isBoss || role === "impresion" || role === "printing"
  const canUseLaminacionOps = isBoss || role === "laminacion"
  const canUseTintasOps = isBoss || role === "tintas"
  const canUseMontajeOps = isBoss || role === "montaje" || role === "planificador" || role === "supervisor"
  const isPrintingOperator = role === "impresion" || role === "printing"
  const isMontajeOperator = role === "montaje"
  const isCorteOperator = role === "corte"
  const headerBackPath = isPrintingOperator
    ? "/impresion"
    : isMontajeOperator
      ? "/montaje"
      : isCorteOperator
        ? "/corte"
        : "/ordenes-trabajo"
  const [searchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") ?? "").toLowerCase().trim()
  const initialTab = (() => {
    if (tabParam === "printing" && canUsePrintingOps) return "printing"
    if (tabParam === "laminacion" && canUseLaminacionOps) return "laminacion"
    if (tabParam === "tintas" && canUseTintasOps) return "tintas"
    if (tabParam === "montaje" && canUseMontajeOps) return "montaje"
    if (tabParam === "corte") return "corte"
    if (canUsePrintingOps) return "printing"
    if (canUseMontajeOps) return "montaje"
    if (canUseLaminacionOps) return "laminacion"
    if (canUseTintasOps) return "tintas"
    if (role === "corte") return "corte"
    return "montaje"
  })()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<WorkOrderDetailRecord | null>(null)

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setLoading(true)
    try {
      const o = await apiFetch<WorkOrderDetailRecord>(`work-orders/${id}`)
      setOrder(o)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OT.")
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  if (!Number.isFinite(id)) {
    return (
      <div className="p-6">
        <p className="text-destructive">ID de orden inválido.</p>
        <Link to="/ordenes-trabajo" className="text-primary underline">
          Volver al listado
        </Link>
      </div>
    )
  }

  const client = order?.client
  const product = order?.product
  const code = order?.code ?? `OT #${id}`
  const form = (order?.technical_document?.form ?? {}) as Record<string, unknown>
  const isPrintingFocusedView = tabParam === "printing" && canUsePrintingOps
  const isMontajeFocusedView = tabParam === "montaje" && canUseMontajeOps
  const isCorteFocusedView = tabParam === "corte"
  const showPrintingPrefill = isPrintingFocusedView && isBoss
  const showMontajePrefill = isMontajeFocusedView && isBoss
  const showMasterDataOnProduction =
    !isMontajeFocusedView && !isPrintingFocusedView && !isCorteFocusedView

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={headerBackPath}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/70"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {isPrintingOperator
            ? "Área Impresión"
            : isMontajeOperator
              ? "Área Montaje"
              : isCorteOperator
                ? "Área Corte"
                : "Órdenes de trabajo"}
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : !order ? (
        <p className="text-destructive">No se encontró la orden.</p>
      ) : (
        <>
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground font-mono">
              <ClipboardList className="h-6 w-6 shrink-0 text-primary" aria-hidden />
              {code}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              <span className="font-medium text-foreground">
                {client?.name ?? "—"}
              </span>
              <span className="text-border mx-2">·</span>
              <span className="font-medium text-foreground">
                {product?.name ?? "—"}
              </span>
            </p>
            <p className="text-muted-foreground mt-3 flex gap-2 rounded-lg border border-primary/10 bg-primary/[0.04] px-3 py-2 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                {isMontajeFocusedView ? (
                  <>
                    Registre turno de planta, cronómetro, kg y mermas. Pulse <strong>Guardar</strong> para enviar al
                    sistema (base de datos de la empresa).
                  </>
                ) : isPrintingFocusedView ? (
                  <>
                    Registre turno, cronómetro y producción. Pulse <strong>Guardar</strong> para enviar al sistema.
                  </>
                ) : (
                  <>
                    Seleccione una pestaña de fase para temporizadores, consumos y mermas. Los datos se guardan en el
                    sistema por área.
                  </>
                )}
              </span>
            </p>
          </div>

          {showMasterDataOnProduction ? (
            <WorkOrderDocumentSheet
              workOrder={order}
              workOrderId={id}
              readOnly={isPrintingOperator && !isBoss}
              onSaved={() => void loadOrder()}
            />
          ) : null}

          {showPrintingPrefill ? <WorkOrderPrintingPlanillaSnapshot form={form} /> : null}
          {showMontajePrefill ? <WorkOrderMontajePlanillaSnapshot form={form} /> : null}

          {isPrintingFocusedView ? (
            <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
          ) : isMontajeFocusedView ? (
            <WorkOrderMontajeControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
          ) : isCorteFocusedView ? (
            <WorkOrderCorteControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
          ) : (
            <Tabs defaultValue={initialTab} className="w-full">
              {initialTab !== "laminacion" && initialTab !== "corte" ? (
                <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
                  {canUseMontajeOps ? <TabsTrigger value="montaje">Montaje</TabsTrigger> : null}
                  {canUsePrintingOps ? (
                    <TabsTrigger value="printing">Impresión</TabsTrigger>
                  ) : null}
                  {canUseLaminacionOps ? (
                    <TabsTrigger value="laminacion">Laminación</TabsTrigger>
                  ) : null}
                  {canUseTintasOps ? <TabsTrigger value="tintas">Tintas</TabsTrigger> : null}
                  <TabsTrigger value="corte">Corte</TabsTrigger>
                </TabsList>
              ) : null}
              <TabsContent value="montaje" className="mt-4">
                {canUseMontajeOps ? (
                  <WorkOrderMontajeControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                ) : null}
              </TabsContent>
              {canUsePrintingOps ? (
                <TabsContent value="printing" className="mt-4">
                  <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                </TabsContent>
              ) : null}
              {canUseLaminacionOps ? (
                <TabsContent value="laminacion" className="mt-4">
                  <WorkOrderLaminacionControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                </TabsContent>
              ) : null}
              {canUseTintasOps ? (
                <TabsContent value="tintas" className="mt-4">
                  <ProductionAreaPanel
                    workOrderId={id}
                    title="Tintas"
                    areaPath="tintas"
                    usageMode="none"
                  />
                </TabsContent>
              ) : null}
              <TabsContent value="corte" className="mt-4">
                <WorkOrderCorteControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
              </TabsContent>
            </Tabs>
          )}

        </>
      )}
    </div>
  )
}
