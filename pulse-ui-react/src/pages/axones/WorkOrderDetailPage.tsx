"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

const PRODUCTION_TABS = ["montaje", "printing", "laminacion", "tintas", "corte"] as const
type ProductionTab = (typeof PRODUCTION_TABS)[number]

function isProductionTab(value: string): value is ProductionTab {
  return (PRODUCTION_TABS as readonly string[]).includes(value)
}

function defaultTabForRole(
  role: string,
  opts: {
    isBoss: boolean
    canUsePrintingOps: boolean
    canUseMontajeOps: boolean
    canUseLaminacionOps: boolean
    canUseTintasOps: boolean
  },
): ProductionTab {
  if (opts.canUsePrintingOps) return "printing"
  if (opts.canUseMontajeOps) return "montaje"
  if (opts.canUseLaminacionOps) return "laminacion"
  if (opts.canUseTintasOps) return "tintas"
  if (role === "corte") return "corte"
  return "montaje"
}

function canAccessProductionTab(
  tab: ProductionTab,
  opts: {
    canUsePrintingOps: boolean
    canUseMontajeOps: boolean
    canUseLaminacionOps: boolean
    canUseTintasOps: boolean
  },
): boolean {
  if (tab === "printing") return opts.canUsePrintingOps
  if (tab === "montaje") return opts.canUseMontajeOps
  if (tab === "laminacion") return opts.canUseLaminacionOps
  if (tab === "tintas") return opts.canUseTintasOps
  return true
}

function isFocusedProductionTab(tab: ProductionTab): boolean {
  return tab === "printing" || tab === "laminacion" || tab === "montaje" || tab === "corte"
}

function tabLabel(tab: ProductionTab): string {
  if (tab === "printing") return "Impresión"
  if (tab === "laminacion") return "Laminación"
  if (tab === "montaje") return "Montaje"
  if (tab === "tintas") return "Tintas"
  return "Corte"
}

function productionAreaListPath(tab: ProductionTab): string {
  if (tab === "printing") return "/impresion"
  if (tab === "laminacion") return "/laminacion"
  if (tab === "montaje") return "/montaje"
  if (tab === "corte") return "/corte"
  return "/tintas"
}

function ProductionTabAccessNotice({ tab }: { tab: ProductionTab }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
      No tiene permiso para operar el área de <strong className="text-foreground">{tabLabel(tab)}</strong>.
    </p>
  )
}

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
  const accessOpts = useMemo(
    () => ({ canUsePrintingOps, canUseMontajeOps, canUseLaminacionOps, canUseTintasOps }),
    [canUseLaminacionOps, canUseMontajeOps, canUsePrintingOps, canUseTintasOps],
  )
  const isPrintingOperator = role === "impresion" || role === "printing"
  const isLaminacionOperator = role === "laminacion"
  const isMontajeOperator = role === "montaje"
  const isCorteOperator = role === "corte"
  const isTintasOperator = role === "tintas"
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = (searchParams.get("tab") ?? "").toLowerCase().trim()
  const layoutParam = (searchParams.get("layout") ?? "").toLowerCase().trim()
  const hasExplicitTab = isProductionTab(tabParam)
  const fallbackTab = useMemo(
    () => defaultTabForRole(role, { isBoss, ...accessOpts }),
    [accessOpts, isBoss, role],
  )
  const activeTab: ProductionTab = hasExplicitTab ? tabParam : fallbackTab
  const isTabbedLayout = layoutParam === "tabs" || !hasExplicitTab

  const headerBackPath = hasExplicitTab
    ? productionAreaListPath(activeTab)
    : isPrintingOperator
      ? "/impresion"
      : isLaminacionOperator
        ? "/laminacion"
        : isMontajeOperator
          ? "/montaje"
          : isCorteOperator
            ? "/corte"
            : isTintasOperator
              ? "/tintas"
              : "/ordenes-trabajo"
  const headerBackLabel = hasExplicitTab
    ? tabLabel(activeTab)
    : isPrintingOperator
      ? "Área Impresión"
      : isLaminacionOperator
        ? "Área Laminación"
        : isMontajeOperator
          ? "Área Montaje"
          : isCorteOperator
            ? "Área Corte"
            : isTintasOperator
              ? "Tintas"
              : "Órdenes de trabajo"

  const setActiveTab = useCallback(
    (tab: string) => {
      if (!isProductionTab(tab)) return
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set("tab", tab)
          next.set("layout", "tabs")
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const tabHasAccess = canAccessProductionTab(activeTab, accessOpts)
  const isFocusedView =
    hasExplicitTab &&
    !isTabbedLayout &&
    isFocusedProductionTab(activeTab) &&
    tabHasAccess
  const isPrintingFocusedView = isFocusedView && activeTab === "printing"
  const isLaminacionFocusedView = isFocusedView && activeTab === "laminacion"
  const isMontajeFocusedView = isFocusedView && activeTab === "montaje"
  const isCorteFocusedView = isFocusedView && activeTab === "corte"

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
  const showPrintingPrefill = isPrintingFocusedView && isBoss
  const showMontajePrefill = isMontajeFocusedView && isBoss
  const showMasterDataOnProduction = !isFocusedView

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to={headerBackPath}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/70"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {headerBackLabel}
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
                    Registre turno de planta, cronómetro, kg y mermas. Al terminar, pulse{" "}
                    <strong>Guardar</strong> y elija si cierra el turno de planta o finaliza el área Montaje en el
                    sistema.
                  </>
                ) : isPrintingFocusedView ? (
                  <>
                    Registre turno, cronómetro y producción. Pulse <strong>Guardar</strong> para enviar al sistema.
                  </>
                ) : isLaminacionFocusedView ? (
                  <>
                    Registre turno de planta, cronómetro y producción. Pulse <strong>Guardar</strong> para enviar al
                    sistema.
                  </>
                ) : !tabHasAccess ? (
                  <>
                    La pestaña <strong>{tabLabel(activeTab)}</strong> está seleccionada, pero su rol no puede operar
                    esta área.
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

          {isFocusedView ? (
            <>
              {isPrintingFocusedView ? (
                <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
              ) : null}
              {isLaminacionFocusedView ? (
                <WorkOrderLaminacionControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
              ) : null}
              {isMontajeFocusedView ? (
                <WorkOrderMontajeControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
              ) : null}
              {isCorteFocusedView ? (
                <WorkOrderCorteControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
              ) : null}
            </>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
                {canUseMontajeOps ? <TabsTrigger value="montaje">Montaje</TabsTrigger> : null}
                <TabsTrigger value="printing">Impresión</TabsTrigger>
                {canUseLaminacionOps ? <TabsTrigger value="laminacion">Laminación</TabsTrigger> : null}
                {canUseTintasOps ? <TabsTrigger value="tintas">Tintas</TabsTrigger> : null}
                <TabsTrigger value="corte">Corte</TabsTrigger>
              </TabsList>
              <TabsContent value="montaje" className="mt-4">
                {canUseMontajeOps ? (
                  <WorkOrderMontajeControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                ) : (
                  <ProductionTabAccessNotice tab="montaje" />
                )}
              </TabsContent>
              <TabsContent value="printing" className="mt-4">
                {canUsePrintingOps ? (
                  <>
                    {isBoss ? <WorkOrderPrintingPlanillaSnapshot form={form} /> : null}
                    <WorkOrderPrintingControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                  </>
                ) : (
                  <ProductionTabAccessNotice tab="printing" />
                )}
              </TabsContent>
              <TabsContent value="laminacion" className="mt-4">
                {canUseLaminacionOps ? (
                  <WorkOrderLaminacionControlPanel workOrderId={id} canFinalizeOrder={isBoss} />
                ) : (
                  <ProductionTabAccessNotice tab="laminacion" />
                )}
              </TabsContent>
              <TabsContent value="tintas" className="mt-4">
                {canUseTintasOps ? (
                  <ProductionAreaPanel
                    workOrderId={id}
                    title="Tintas"
                    areaPath="tintas"
                    usageMode="none"
                  />
                ) : (
                  <ProductionTabAccessNotice tab="tintas" />
                )}
              </TabsContent>
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
