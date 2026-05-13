"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, ClipboardList, Info } from "lucide-react"

import { ProductionAreaPanel } from "@/components/axones/ProductionAreaPanel"
import { WorkOrderDocumentSheet } from "@/components/axones/WorkOrderDocumentSheet"
import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import WorkOrderPrintingControlPanel from "@/pages/axones/WorkOrderPrintingControlPanel"
import WorkOrderLaminacionControlPanel from "@/pages/axones/WorkOrderLaminacionControlPanel"
import WorkOrderCorteControlPanel from "@/pages/axones/WorkOrderCorteControlPanel"
import { WorkOrderPrintingPlanillaSnapshot } from "@/pages/axones/WorkOrderPrintingPlanillaSnapshot"
import type { WorkOrderDetailRecord } from "@/types/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function WorkOrderDetailPage() {
  const { woId } = useParams<{ woId: string }>()
  const id = Number(woId)
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const isBoss =
    role === "boss" ||
    role === "admin" ||
    role === "jefe_supremo" ||
    role === "superadmin"
  const canUsePrintingOps = isBoss || role === "impresion" || role === "printing"
  const canUseLaminacionOps = isBoss || role === "laminacion"
  const canUseTintasOps = isBoss || role === "tintas"
  const isPrintingOperator = role === "impresion" || role === "printing"
  const otBackPath = isPrintingOperator ? "/impresion" : "/ordenes-trabajo"
  const [searchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") ?? "").toLowerCase().trim()
  const initialTab = (() => {
    if (tabParam === "printing" && canUsePrintingOps) return "printing"
    if (tabParam === "laminacion" && canUseLaminacionOps) return "laminacion"
    if (tabParam === "tintas" && canUseTintasOps) return "tintas"
    if (tabParam === "montaje" || tabParam === "corte") return tabParam
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
        <Link to={otBackPath} className="text-primary underline">
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
  const isCorteFocusedView = tabParam === "corte"
  const showPrintingPrefill = isPrintingFocusedView

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={otBackPath}
          className="text-muted-foreground inline-flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {isPrintingOperator ? "Área Impresión" : "Órdenes de trabajo"}
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
                Seleccione una pestaña de fase para temporizadores, consumos y mermas. Los datos se guardan en el
                sistema por área.
              </span>
            </p>
          </div>

          <WorkOrderDocumentSheet
            workOrder={order}
            workOrderId={id}
            readOnly={isPrintingOperator && !isBoss}
            onSaved={() => void loadOrder()}
          />

          {showPrintingPrefill ? <WorkOrderPrintingPlanillaSnapshot form={form} /> : null}

          {isPrintingFocusedView ? (
            <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
          ) : isCorteFocusedView ? (
            <WorkOrderCorteControlPanel workOrderId={id} />
          ) : (
            <Tabs defaultValue={initialTab} className="w-full">
              {initialTab !== "laminacion" && initialTab !== "corte" ? (
                <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="montaje">Montaje</TabsTrigger>
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
                <ProductionAreaPanel
                  workOrderId={id}
                  title="Montaje"
                  areaPath="montaje"
                  usageMode="montaje"
                />
              </TabsContent>
              {canUsePrintingOps ? (
                <TabsContent value="printing" className="mt-4">
                  <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                </TabsContent>
              ) : null}
              {canUseLaminacionOps ? (
                <TabsContent value="laminacion" className="mt-4">
                  <WorkOrderLaminacionControlPanel workOrderId={id} />
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
                <WorkOrderCorteControlPanel workOrderId={id} />
              </TabsContent>
            </Tabs>
          )}

        </>
      )}
    </div>
  )
}
