"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Droplets,
  History,
  Inbox,
  ListOrdered,
  Rows3,
  Search,
  SlidersHorizontal,
  Timer,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  INSUMOS_BANDEJA_TABLE_COLSPAN,
  InsumosBandejaTableCard,
  insumosBandejaDataRowClassName,
  insumosBandejaIdLinkClassName,
} from "@/components/axones/InsumosBandejaTable"
import { catalogSelectTriggerClass } from "@/components/axones/catalog-list-classes"
import { apiFetch, ApiError } from "@/lib/api"
import {
  BANDEJA_COLLECT_MAX_PAGES,
  collectBandejaWorkOrderIds,
  countUnseenActivasInIds,
  fetchBandejaTotal,
  loadSeenActivasIds,
  mergeIdsIntoSeenActivas,
  type BandejaListFilters,
  type MiAreaApi,
} from "@/lib/axones-area-bandeja"
import {
  areaRequestBadgeClass,
  areaRequestStatusGlyph,
  areaRequestStatusLabel,
} from "@/lib/axones-area-request-display"
import { getStoredUser } from "@/lib/auth-storage"
import { MesBandejaTimerCell } from "@/components/axones/MesBandejaTimerCell"
import {
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowTitle,
} from "@/lib/mes-timer-band-shared"
import { tintasMesBandFromWorkOrderRow } from "@/lib/tintas-mes-band-status"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, MaterialRow, WorkOrderListRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type TintasBandejaTab = "activas" | "historial"

const MI_AREA_TINTAS: MiAreaApi = "tintas"
const TINTAS_BANDEJA_COLSPAN = 5

function tintasWorkOrderProduccionUrl(woId: number): string {
  return `/ordenes-trabajo/${woId}/produccion?tab=tintas`
}

export default function AreaTintasPage() {
  const navigate = useNavigate()
  const session = getStoredUser()
  const [mode, setMode] = useState<"list" | "consumo">("list")
  const [activeTab, setActiveTab] = useState<TintasBandejaTab>("activas")
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [onlyPendingArea, setOnlyPendingArea] = useState(false)
  const [historialIncludePending, setHistorialIncludePending] = useState(false)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)
  const [totalActivas, setTotalActivas] = useState(0)
  const [unseenActivas, setUnseenActivas] = useState(0)
  const [mesBandNowMs, setMesBandNowMs] = useState(() => Date.now())

  const [workOrders, setWorkOrders] = useState<WorkOrderListRow[]>([])
  const [woId, setWoId] = useState<string>("")
  const woNum = Number(woId)

  const [tintaMaterials, setTintaMaterials] = useState<MaterialRow[]>([])
  const [invTintas, setInvTintas] = useState<MaterialRow[]>([])
  const [invCementerio, setInvCementerio] = useState<MaterialRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  type InkLineDraft = {
    material_id: string
    quantity_original_kg: string
    quantity_solventada_kg: string
    quantity_return_kg: string
    notes: string
  }
  type ChemDraft = {
    chemical_type: string
    quantity_loaded_kg: string
    quantity_return_kg: string
    notes: string
  }

  const [inkLines, setInkLines] = useState<InkLineDraft[]>([
    {
      material_id: "",
      quantity_original_kg: "",
      quantity_solventada_kg: "",
      quantity_return_kg: "",
      notes: "",
    },
  ])
  const [chemRows, setChemRows] = useState<ChemDraft[]>([
    { chemical_type: "alcohol", quantity_loaded_kg: "", quantity_return_kg: "", notes: "" },
    { chemical_type: "metoxil", quantity_loaded_kg: "", quantity_return_kg: "", notes: "" },
    { chemical_type: "npa", quantity_loaded_kg: "", quantity_return_kg: "", notes: "" },
  ])

  type MixRow = {
    id: number
    created_at: string
    output_material?: { sku: string; name: string }
    creator?: { name: string }
    components_count?: number
  }

  type MixComponentDraft = { material_id: string; quantity: string }
  const [mixName, setMixName] = useState("")
  const [mixArea, setMixArea] = useState<"tintas" | "cementerio_tintas">("tintas")
  const [mixNotes, setMixNotes] = useState("")
  const [mixComponents, setMixComponents] = useState<MixComponentDraft[]>([
    { material_id: "", quantity: "" },
  ])
  const [mixRows, setMixRows] = useState<LaravelPaginated<MixRow> | null>(null)
  const [mixPage, setMixPage] = useState(1)

  const selectedWo = useMemo(
    () => workOrders.find((w) => w.id === woNum) ?? null,
    [workOrders, woNum],
  )

  const bandejaListFilters = useMemo((): BandejaListFilters => {
    return {
      status: status !== "all" ? status : undefined,
      client_order_reference: search || undefined,
    }
  }, [status, search])

  const refreshBandejaMeta = useCallback(async () => {
    if (mode !== "list") return
    const base = bandejaListFilters
    const uid = session?.id
    try {
      const [activas, ids] = await Promise.all([
        fetchBandejaTotal(MI_AREA_TINTAS, "active", base),
        collectBandejaWorkOrderIds(
          MI_AREA_TINTAS,
          "active",
          base,
          BANDEJA_COLLECT_MAX_PAGES,
        ),
      ])
      setTotalActivas(activas)
      const seen = loadSeenActivasIds(uid, MI_AREA_TINTAS)
      setUnseenActivas(countUnseenActivasInIds(ids, seen))
    } catch {
      /* silencioso */
    }
  }, [bandejaListFilters, mode, session?.id])

  const markActivasBandejaSeen = useCallback(async () => {
    const uid = session?.id
    try {
      const ids = await collectBandejaWorkOrderIds(
        MI_AREA_TINTAS,
        "active",
        bandejaListFilters,
        BANDEJA_COLLECT_MAX_PAGES,
      )
      mergeIdsIntoSeenActivas(uid, MI_AREA_TINTAS, ids)
      const seen = loadSeenActivasIds(uid, MI_AREA_TINTAS)
      setUnseenActivas(countUnseenActivasInIds(ids, seen))
    } catch {
      /* ignore */
    }
  }, [bandejaListFilters, session?.id])

  useEffect(() => {
    if (mode !== "list") return
    void refreshBandejaMeta()
  }, [mode, refreshBandejaMeta])

  useEffect(() => {
    if (mode !== "list") return
    const fn = () => {
      if (document.visibilityState === "visible") void refreshBandejaMeta()
    }
    document.addEventListener("visibilitychange", fn)
    return () => document.removeEventListener("visibilitychange", fn)
  }, [mode, refreshBandejaMeta])

  useEffect(() => {
    if (mode !== "list" || activeTab !== "activas" || loading || rows === null) return
    void markActivasBandejaSeen()
  }, [mode, activeTab, loading, rows, markActivasBandejaSeen])

  const loadAreaRows = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const query: Record<string, string | number | undefined> = {
        page,
        per_page: 20,
        status: status !== "all" ? status : undefined,
        client_order_reference: search || undefined,
      }
      if (activeTab === "activas") {
        query.mi_area = "tintas"
        query.area_process_tag = "active"
      } else {
        query.historial_area = "tintas"
        if (onlyPendingArea) {
          query.only_pending_area = 1
        } else if (!historialIncludePending) {
          query.historial_exclude_pending = 1
        }
      }

      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", { query })
      setRows(data)
      setWorkOrders(data.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes.")
      setRows(null)
      setWorkOrders([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeTab, page, search, status, onlyPendingArea, historialIncludePending])

  useEffect(() => {
    if (mode !== "list" || activeTab !== "activas") return
    const id = window.setInterval(() => setMesBandNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [mode, activeTab])

  useEffect(() => {
    if (mode !== "list" || activeTab !== "activas") return
    const id = window.setInterval(() => {
      void loadAreaRows({ silent: true })
    }, 8000)
    return () => window.clearInterval(id)
  }, [mode, activeTab, loadAreaRows])

  const loadLists = useCallback(async () => {
    setLoading(true)
    try {
      const [mats, invT, invC, mixes] = await Promise.all([
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { per_page: 400, page: 1 },
        }),
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "tintas", per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "cementerio_tintas", per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<MixRow>>("tinta-mixtures", {
          query: { page: mixPage, per_page: 20 },
        }).catch(() => null),
      ])
      setTintaMaterials(
        (mats.data ?? []).filter(
          (m) =>
            m.inventory_area === "tintas" ||
            m.inventory_area === "cementerio_tintas",
        ),
      )
      setInvTintas(invT.data ?? [])
      setInvCementerio(invC.data ?? [])
      if (mixes) setMixRows(mixes)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar OTs o materiales.")
      setWorkOrders([])
      setTintaMaterials([])
      setInvTintas([])
      setInvCementerio([])
      setMixRows(null)
    } finally {
      setLoading(false)
    }
  }, [mixPage])

  const loadWorkOrderConsumables = useCallback(async () => {
    if (!Number.isFinite(woNum) || woNum < 1) return
    setLoading(true)
    try {
      const data = await apiFetch<Record<string, unknown>>(
        `work-orders/${woNum}/tintas`,
      )
      const inks = (data.ink_control_lines as unknown[]) ?? []
      setInkLines(
        inks.length
          ? (inks as Record<string, unknown>[]).map((row) => ({
              material_id: String(row.material_id ?? ""),
              quantity_original_kg: String(row.quantity_original_kg ?? ""),
              quantity_solventada_kg: String(row.quantity_solventada_kg ?? ""),
              quantity_return_kg: String(row.quantity_return_kg ?? ""),
              notes: typeof row.notes === "string" ? row.notes : "",
            }))
          : [
              {
                material_id: "",
                quantity_original_kg: "",
                quantity_solventada_kg: "",
                quantity_return_kg: "",
                notes: "",
              },
            ],
      )
      const chems = (data.chemical_usages as Record<string, unknown>[]) ?? []
      const byType = Object.fromEntries(
        chems.map((c) => [String(c.chemical_type), c]),
      )
      setChemRows(
        ["alcohol", "metoxil", "npa"].map((t) => {
          const c = byType[t] as Record<string, unknown> | undefined
          return {
            chemical_type: t,
            quantity_loaded_kg: c ? String(c.quantity_loaded_kg ?? "") : "",
            quantity_return_kg: c ? String(c.quantity_return_kg ?? "") : "",
            notes: c && typeof c.notes === "string" ? c.notes : "",
          }
        }),
      )
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar consumos de la OT.")
    } finally {
      setLoading(false)
    }
  }, [woNum])

  useEffect(() => {
    if (mode !== "list") return
    void loadAreaRows()
  }, [loadAreaRows, mode])

  useEffect(() => {
    if (mode === "list") return
    void loadLists()
  }, [loadLists, mode])

  useEffect(() => {
    if (mode === "list") return
    void loadWorkOrderConsumables()
  }, [loadWorkOrderConsumables, mode])

  async function save() {
    if (!Number.isFinite(woNum) || woNum < 1) {
      toast.error("Seleccione una OT.")
      return
    }
    const ink_lines = inkLines
      .filter((L) => L.material_id.trim() !== "")
      .map((L, idx) => ({
        material_id: Number(L.material_id),
        quantity_original_kg: L.quantity_original_kg.trim()
          ? Number(L.quantity_original_kg)
          : 0,
        quantity_solventada_kg: L.quantity_solventada_kg.trim()
          ? Number(L.quantity_solventada_kg)
          : 0,
        quantity_return_kg: L.quantity_return_kg.trim()
          ? Number(L.quantity_return_kg)
          : 0,
        notes: L.notes.trim() || null,
        position: idx,
      }))
    const chemical_usages = chemRows.map((r) => ({
      chemical_type: r.chemical_type,
      quantity_loaded_kg: r.quantity_loaded_kg.trim()
        ? Number(r.quantity_loaded_kg)
        : 0,
      quantity_return_kg: r.quantity_return_kg.trim()
        ? Number(r.quantity_return_kg)
        : 0,
      notes: r.notes.trim() || null,
    }))

    setSaving(true)
    try {
      await apiFetch(`work-orders/${woNum}/tintas/consumables`, {
        method: "PUT",
        body: JSON.stringify({ ink_lines, chemical_usages }),
      })
      toast.success("Tintas y químicos guardados.")
      void loadWorkOrderConsumables()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function reloadMixes() {
    setLoading(true)
    try {
      const mixes = await apiFetch<LaravelPaginated<MixRow>>("tinta-mixtures", {
        query: { page: mixPage, per_page: 20 },
      })
      setMixRows(mixes)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las mezclas.")
      setMixRows(null)
    } finally {
      setLoading(false)
    }
  }

  function addMixComponent() {
    setMixComponents((p) => [...p, { material_id: "", quantity: "" }])
  }

  function updateMixComponent(i: number, patch: Partial<MixComponentDraft>) {
    setMixComponents((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  async function createMix() {
    const name = mixName.trim()
    if (!name) {
      toast.error("Indique el nombre del color / Pantone.")
      return
    }
    const comps = mixComponents
      .map((c) => ({ material_id: Number(c.material_id), quantity: Number(c.quantity) }))
      .filter(
        (c) =>
          Number.isFinite(c.material_id) &&
          c.material_id > 0 &&
          Number.isFinite(c.quantity) &&
          c.quantity > 0,
      )
    if (!comps.length) {
      toast.error("Agregue al menos 1 componente con cantidad.")
      return
    }

    const skuBase = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24)
    const output_sku = `PANT-${skuBase || "MIX"}-${String(Date.now()).slice(-5)}`

    setSaving(true)
    try {
      await apiFetch("tinta-mixtures", {
        method: "POST",
        body: JSON.stringify({
          output_sku,
          output_name: name,
          work_order_id: Number.isFinite(woNum) && woNum > 0 ? woNum : null,
          output_inventory_area: mixArea,
          output_tinta_subarea: mixArea === "tintas" ? "superficie" : null,
          unit: "kg",
          notes: mixNotes.trim() || null,
          components: comps,
        }),
      })
      toast.success("Mezcla creada y registrada en inventario.")
      setMixName("")
      setMixNotes("")
      setMixComponents([{ material_id: "", quantity: "" }])
      void reloadMixes()
      void loadLists()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la mezcla.")
    } finally {
      setSaving(false)
    }
  }

  function stageLabel(boardStage?: string | null): string {
    if (boardStage === "nueva") return "Pendiente por OT"
    if (boardStage === "pendiente") return "Programación"
    if (boardStage === "montaje") return "Montaje"
    if (boardStage === "impresion") return "Impresión"
    if (boardStage === "laminacion") return "Laminación"
    if (boardStage === "corte") return "Corte"
    if (boardStage === "completada") return "Completada"
    return boardStage ?? "—"
  }

  const totalOriginalKg = useMemo(
    () =>
      inkLines.reduce((acc, row) => {
        const value = Number(row.quantity_original_kg || 0)
        return acc + (Number.isFinite(value) ? value : 0)
      }, 0),
    [inkLines],
  )
  const totalSolventadaKg = useMemo(
    () =>
      inkLines.reduce((acc, row) => {
        const value = Number(row.quantity_solventada_kg || 0)
        return acc + (Number.isFinite(value) ? value : 0)
      }, 0),
    [inkLines],
  )
  const totalDevolucionKg = useMemo(
    () =>
      inkLines.reduce((acc, row) => {
        const value = Number(row.quantity_return_kg || 0)
        return acc + (Number.isFinite(value) ? value : 0)
      }, 0),
    [inkLines],
  )
  const totalQuimicosKg = useMemo(
    () =>
      chemRows.reduce((acc, row) => {
        const value = Number(row.quantity_loaded_kg || 0)
        return acc + (Number.isFinite(value) ? value : 0)
      }, 0),
    [chemRows],
  )

  const tintasPagination =
    rows && rows.last_page > 1 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Página {rows.current_page} de {rows.last_page} · {rows.total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={rows.current_page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.current_page >= rows.last_page || loading}
            onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            className="gap-1.5"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    ) : null

  const tintasFilterHint = (
    <p className="text-muted-foreground flex items-start gap-2 text-xs md:col-span-12">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>
        Pulse <strong className="font-medium text-foreground">Buscar</strong> o Enter para filtrar por código de OT,
        referencia de pedido o nombre de cliente. El estado se aplica al cambiar el valor.
      </span>
    </p>
  )

  const tintasHistorialFilterHint = (
    <p className="text-muted-foreground flex items-start gap-2 text-xs md:col-span-12">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>
        Pulse <strong className="font-medium text-foreground">Buscar</strong> o Enter para aplicar el texto. Use las
        casillas de arriba para acotar el historial.
      </span>
    </p>
  )

  const applyTintasSearch = () => {
    setPage(1)
    setSearch(q.trim())
  }

  return (
    <CatalogPageShell
      title="Área: Tintas"
      subtitle={
        mode === "list" ? (
          <>
            En curso: solicitudes pendientes de tintas con la OT en etapa de impresión. Historial: solicitudes cerradas;
            opcional incluir pendientes o solo pendientes.
          </>
        ) : (
          "Registre consumos, consulte inventario de tintas, cementerio y mezclas para la OT seleccionada."
        )
      }
      icon={Droplets}
      action={
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (mode === "list") {
              void loadAreaRows()
              void refreshBandejaMeta()
              return
            }
            void loadLists()
            void loadWorkOrderConsumables()
          }}
          disabled={loading}
        >
          Actualizar
        </Button>
      }
    >
      {mode === "list" ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as TintasBandejaTab)
            if (v !== "historial") {
              setOnlyPendingArea(false)
              setHistorialIncludePending(false)
            }
            setPage(1)
          }}
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger
              value="activas"
              className="inline-flex max-w-full flex-wrap items-center gap-2"
            >
              <Rows3 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>En curso</span>
              <span className="text-muted-foreground font-normal tabular-nums">({totalActivas})</span>
              {unseenActivas > 0 ? (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold leading-none"
                >
                  {unseenActivas}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="historial" className="inline-flex items-center gap-2">
              <History className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activas" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Solicitud pendiente: OT en cola (antes de esta etapa) o ya en la etapa de tintas con impresión en
                  curso.
                </span>
              </p>
              <Badge
                variant="outline"
                className={cn(
                  areaRequestBadgeClass("pending"),
                  "inline-flex items-center gap-1.5",
                )}
              >
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                {`En curso: ${totalActivas}`}
              </Badge>
            </div>

            <CatalogFilterGrid>
              <CatalogSearchField
                id="tintas-q-act"
                label="Ref. pedido cliente"
                placeholder="Código OT, referencia, cliente…"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") applyTintasSearch()
                }}
                className="min-w-0 md:col-span-6"
              />
              <CatalogLabeledField label="Estado" icon={SlidersHorizontal} className="md:col-span-3">
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="gap-2">
                      <Rows3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Todos
                    </SelectItem>
                    <SelectItem value="open" className="gap-2">
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Abierta
                    </SelectItem>
                    <SelectItem value="completed" className="gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Completada
                    </SelectItem>
                    <SelectItem value="cancelled" className="gap-2">
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Cancelada
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CatalogLabeledField>
              <CatalogLabeledField label="Aplicar" className="md:col-span-3">
                <Button type="button" className="h-11 w-full" onClick={applyTintasSearch}>
                  Buscar
                </Button>
              </CatalogLabeledField>
              {tintasFilterHint}
            </CatalogFilterGrid>

            <InsumosBandejaTableCard>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                    <TableHead className="h-10 w-[88px] px-2 pl-5 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      ID
                    </TableHead>
                    <TableHead className="h-10 min-w-[140px] px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Estado
                    </TableHead>
                    <TableHead className="h-10 min-w-[11.5rem] px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        Temporizador
                      </span>
                    </TableHead>
                    <TableHead className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Material
                    </TableHead>
                    <TableHead className="h-10 w-[120px] px-2 pr-5 text-right align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell
                        colSpan={TINTAS_BANDEJA_COLSPAN}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : !rows?.data.length ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell
                        colSpan={TINTAS_BANDEJA_COLSPAN}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Sin solicitudes.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((o, idx) => {
                      const reqStatus =
                        (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ?? "pending"
                      const mesBand = tintasMesBandFromWorkOrderRow(o, mesBandNowMs)
                      const rowAccent = mesBand ? mesBandejaRowAccentClass(mesBand.workflow) : ""
                      const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                      return (
                        <TableRow key={o.id} className={insumosBandejaDataRowClassName(idx, rowAccent)}>
                          <TableCell className="pl-5 align-middle">
                            <Link to={tintasWorkOrderProduccionUrl(o.id)} className={insumosBandejaIdLinkClassName}>
                              {o.code}
                            </Link>
                          </TableCell>
                          <TableCell className="align-middle">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              {mesBand ? (
                                <span className={mesBandejaStatePillClass(mesBand.workflow)} role="status">
                                  {mesBandejaWorkflowTitle(mesBand.workflow)}
                                </span>
                              ) : null}
                              <Badge
                                variant="outline"
                                className={cn(
                                  areaRequestBadgeClass(reqStatus),
                                  "inline-flex h-5 w-fit shrink-0 items-center gap-1 px-1.5 py-0 text-[10px] leading-none",
                                )}
                              >
                                {areaRequestStatusGlyph(reqStatus)}
                                {areaRequestStatusLabel(reqStatus)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[11.5rem] align-middle">
                            <MesBandejaTimerCell
                              mesBand={mesBand}
                              onOpenDetail={() => navigate(tintasWorkOrderProduccionUrl(o.id))}
                            />
                          </TableCell>
                          <TableCell className="max-w-md align-middle">
                            <p
                              className="text-foreground line-clamp-2 text-sm font-medium leading-snug"
                              title={materialTitle}
                            >
                              {o.product?.name?.trim() ? o.product.name : "—"}
                            </p>
                            <p className="text-muted-foreground text-xs leading-snug">
                              {o.client?.name?.trim() ? o.client.name : "—"}
                            </p>
                          </TableCell>
                          <TableCell className="pr-5 text-right align-middle">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-sm text-primary"
                              onClick={() => {
                                setWoId(String(o.id))
                                setMode("consumo")
                              }}
                            >
                              Registrar consumo
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </InsumosBandejaTableCard>
            {tintasPagination}
          </TabsContent>

          <TabsContent value="historial" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Archivo de solicitudes cerradas en tintas (hechas o canceladas). Use las casillas para acotar qué
                  solicitudes incluye el listado.
                </span>
              </p>
              <Badge
                variant="outline"
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight border-muted-foreground/35 bg-muted/70 text-muted-foreground"
              >
                <ListOrdered className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                En listado: {rows?.total ?? 0}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-4 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={onlyPendingArea}
                  onChange={(ev) => {
                    const on = ev.target.checked
                    setOnlyPendingArea(on)
                    if (on) setHistorialIncludePending(false)
                    setPage(1)
                  }}
                />
                Solo pendientes
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={historialIncludePending}
                  disabled={onlyPendingArea}
                  onChange={(ev) => {
                    setHistorialIncludePending(ev.target.checked)
                    setPage(1)
                  }}
                />
                Ver también solicitudes abiertas
              </label>
            </div>

            <CatalogFilterGrid>
              <CatalogSearchField
                id="tintas-q-historial"
                label="Ref. pedido cliente"
                placeholder="Código OT, referencia, cliente…"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") applyTintasSearch()
                }}
                className="min-w-0 md:col-span-6"
              />
              <CatalogLabeledField label="Estado" icon={SlidersHorizontal} className="md:col-span-3">
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="gap-2">
                      <Rows3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Todos
                    </SelectItem>
                    <SelectItem value="open" className="gap-2">
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Abierta
                    </SelectItem>
                    <SelectItem value="completed" className="gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Completada
                    </SelectItem>
                    <SelectItem value="cancelled" className="gap-2">
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Cancelada
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CatalogLabeledField>
              <CatalogLabeledField label="Aplicar" className="md:col-span-3">
                <Button type="button" className="h-11 w-full" onClick={applyTintasSearch}>
                  Buscar
                </Button>
              </CatalogLabeledField>
              {tintasHistorialFilterHint}
            </CatalogFilterGrid>

            <InsumosBandejaTableCard>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                    <TableHead className="h-10 w-[88px] px-2 pl-5 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      ID
                    </TableHead>
                    <TableHead className="h-10 min-w-[140px] px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Estado
                    </TableHead>
                    <TableHead className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Material
                    </TableHead>
                    <TableHead className="h-10 w-[120px] px-2 pr-5 text-right align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell
                        colSpan={INSUMOS_BANDEJA_TABLE_COLSPAN}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : !rows?.data.length ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell
                        colSpan={INSUMOS_BANDEJA_TABLE_COLSPAN}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Sin solicitudes.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((o, idx) => {
                      const reqStatus =
                        (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ?? null
                      const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                      return (
                        <TableRow key={o.id} className={insumosBandejaDataRowClassName(idx)}>
                          <TableCell className="pl-5 align-middle">
                            <Link to={tintasWorkOrderProduccionUrl(o.id)} className={insumosBandejaIdLinkClassName}>
                              {o.code}
                            </Link>
                          </TableCell>
                          <TableCell className="align-middle">
                            <div className="flex flex-col gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  areaRequestBadgeClass(reqStatus),
                                  "inline-flex w-fit items-center gap-1 px-1.5 py-0 text-[10px] leading-none",
                                )}
                              >
                                {areaRequestStatusGlyph(reqStatus)}
                                {areaRequestStatusLabel(reqStatus)}
                              </Badge>
                              {o.status ? (
                                <span className="text-muted-foreground text-xs">OT: {o.status}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md align-middle">
                            <p
                              className="text-foreground line-clamp-2 text-sm font-medium leading-snug"
                              title={materialTitle}
                            >
                              {o.product?.name?.trim() ? o.product.name : "—"}
                            </p>
                            <p className="text-muted-foreground text-xs leading-snug">
                              {o.client?.name?.trim() ? o.client.name : "—"}
                            </p>
                          </TableCell>
                          <TableCell className="pr-5 text-right align-middle">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-sm text-primary"
                              onClick={() => {
                                setWoId(String(o.id))
                                setMode("consumo")
                              }}
                            >
                              Registrar consumo
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </InsumosBandejaTableCard>
            {tintasPagination}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Consumo por OT</p>
              <p className="text-muted-foreground text-xs">
                {selectedWo ? `${selectedWo.code} · ${selectedWo.client?.name ?? "—"}` : "Sin OT seleccionada"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMode("list")}>
                Volver al listado
              </Button>
            </div>
          </div>

          <Tabs defaultValue="consumo" className="w-full">
            <TabsList className="flex h-auto min-h-9 w-full flex-wrap justify-start gap-1 p-1">
              <TabsTrigger value="consumo" className="text-xs">Consumo por OT</TabsTrigger>
              <TabsTrigger value="inventario" className="text-xs">Inventario</TabsTrigger>
              <TabsTrigger value="cementerio" className="text-xs">Cementerio</TabsTrigger>
              <TabsTrigger value="mezclas" className="text-xs">Mezclas (Pantone)</TabsTrigger>
            </TabsList>

            <TabsContent value="consumo" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Seleccionar OT (en impresión)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="grid gap-2 md:col-span-6">
                      <Label className="text-xs">OT</Label>
                      <Select value={woId} onValueChange={setWoId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {workOrders.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                              {w.code} — {w.client?.name ?? "—"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-3">
                      <Label className="text-xs">Estado</Label>
                      <Input value={selectedWo?.status ?? "Sin OT"} disabled className="h-8 text-xs" />
                    </div>
                    <div className="grid gap-2 md:col-span-3">
                      <Label className="text-xs">Etapa en planta</Label>
                      <Input
                        value={selectedWo ? stageLabel(selectedWo.board_stage) : "—"}
                        disabled
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  {selectedWo ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs">
                      <p>
                        <span className="font-medium">Cliente:</span>{" "}
                        {selectedWo.client?.name ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Producto:</span>{" "}
                        {selectedWo.product?.name ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Código OT:</span> {selectedWo.code}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Tintas y cementerio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {inkLines.map((L, i) => (
                      <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-12">
                        <div className="md:col-span-4">
                          <Label className="text-xs">Tinta / cementerio</Label>
                          <Select
                            value={L.material_id || undefined}
                            onValueChange={(v) =>
                              setInkLines((rows) =>
                                rows.map((r, j) => (j === i ? { ...r, material_id: v } : r)),
                              )
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Material…" />
                            </SelectTrigger>
                            <SelectContent>
                              {tintaMaterials.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                  {m.sku} — {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Original kg</Label>
                          <Input
                            inputMode="decimal"
                            className="h-8 text-xs"
                            value={L.quantity_original_kg}
                            onChange={(ev) =>
                              setInkLines((rows) =>
                                rows.map((r, j) =>
                                  j === i ? { ...r, quantity_original_kg: ev.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Solventada kg</Label>
                          <Input
                            inputMode="decimal"
                            className="h-8 text-xs"
                            value={L.quantity_solventada_kg}
                            onChange={(ev) =>
                              setInkLines((rows) =>
                                rows.map((r, j) =>
                                  j === i
                                    ? { ...r, quantity_solventada_kg: ev.target.value }
                                    : r,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Devolución kg</Label>
                          <Input
                            inputMode="decimal"
                            className="h-8 text-xs"
                            value={L.quantity_return_kg}
                            onChange={(ev) =>
                              setInkLines((rows) =>
                                rows.map((r, j) =>
                                  j === i ? { ...r, quantity_return_kg: ev.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="md:col-span-2 flex items-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => setInkLines((rows) => rows.filter((_, j) => j !== i))}
                            disabled={inkLines.length <= 1}
                          >
                            Quitar
                          </Button>
                        </div>
                        <div className="md:col-span-12">
                          <Input
                            placeholder="Notas línea"
                            className="h-8 text-xs"
                            value={L.notes}
                            onChange={(ev) =>
                              setInkLines((rows) =>
                                rows.map((r, j) =>
                                  j === i ? { ...r, notes: ev.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <div className="grid gap-2 text-sm md:grid-cols-3">
                      <div className="rounded-md border bg-muted/30 p-2">
                        <span className="text-muted-foreground">Total original:</span>{" "}
                        <strong>{totalOriginalKg.toFixed(2)} kg</strong>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2">
                        <span className="text-muted-foreground">Total solventada:</span>{" "}
                        <strong>{totalSolventadaKg.toFixed(2)} kg</strong>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2">
                        <span className="text-muted-foreground">Total devolución:</span>{" "}
                        <strong>{totalDevolucionKg.toFixed(2)} kg</strong>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setInkLines((rows) => [
                          ...rows,
                          {
                            material_id: "",
                            quantity_original_kg: "",
                            quantity_solventada_kg: "",
                            quantity_return_kg: "",
                            notes: "",
                          },
                        ])
                      }
                    >
                      Añadir línea de tinta
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Químicos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {chemRows.map((r, i) => (
                      <div
                        key={r.chemical_type}
                        className="grid gap-2 rounded-md border p-2 md:grid-cols-4"
                      >
                        <div className="text-sm font-medium capitalize">{r.chemical_type}</div>
                        <Input
                          placeholder="Cargado kg"
                          inputMode="decimal"
                          className="h-8 text-xs"
                          value={r.quantity_loaded_kg}
                          onChange={(ev) =>
                            setChemRows((rows) =>
                              rows.map((x, j) =>
                                j === i ? { ...x, quantity_loaded_kg: ev.target.value } : x,
                              ),
                            )
                          }
                        />
                        <Input
                          placeholder="Devuelto kg"
                          inputMode="decimal"
                          className="h-8 text-xs"
                          value={r.quantity_return_kg}
                          onChange={(ev) =>
                            setChemRows((rows) =>
                              rows.map((x, j) =>
                                j === i ? { ...x, quantity_return_kg: ev.target.value } : x,
                              ),
                            )
                          }
                        />
                        <Input
                          placeholder="Notas"
                          className="h-8 text-xs"
                          value={r.notes}
                          onChange={(ev) =>
                            setChemRows((rows) =>
                              rows.map((x, j) => (j === i ? { ...x, notes: ev.target.value } : x)),
                            )
                          }
                        />
                      </div>
                    ))}
                    <div className="rounded-md border bg-muted/30 p-2 text-sm">
                      <span className="text-muted-foreground">Total químicos cargados:</span>{" "}
                      <strong>{totalQuimicosKg.toFixed(2)} kg</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => void save()}
                  disabled={saving || loading}
                >
                  {saving ? "Guardando…" : "Guardar consumo"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="inventario" className="mt-4 space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inventario de tintas</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Lote / notas</TableHead>
                    <TableHead>Unidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!invTintas.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">
                        Sin ítems.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invTintas.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.tinta_subareas?.[0]?.subarea ?? "—"}</TableCell>
                        <TableCell>{m.quantity_on_hand}</TableCell>
                        <TableCell>{m.supplier?.name ?? "—"}</TableCell>
                        <TableCell>{m.notes || "—"}</TableCell>
                        <TableCell>{m.unit}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="cementerio" className="mt-4 space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cementerio de tintas</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Motivo / notas</TableHead>
                    <TableHead>Unidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!invCementerio.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">
                        Sin ítems.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invCementerio.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.tinta_subareas?.[0]?.subarea ?? "—"}</TableCell>
                        <TableCell>{m.quantity_on_hand}</TableCell>
                        <TableCell>{m.supplier?.name ?? "—"}</TableCell>
                        <TableCell>{m.notes || "—"}</TableCell>
                        <TableCell>{m.unit}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="mezclas" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Crear nueva mezcla (Pantone)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nombre del color / Pantone *</Label>
                  <Input
                    value={mixName}
                    onChange={(ev) => setMixName(ev.target.value)}
                    placeholder="Ej: Pantone 286C"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Destino</Label>
                  <Select
                    value={mixArea}
                    onValueChange={(v) =>
                      setMixArea(v === "cementerio_tintas" ? "cementerio_tintas" : "tintas")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tintas">Tintas</SelectItem>
                      <SelectItem value="cementerio_tintas">Cementerio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Notas</Label>
                  <Textarea
                    rows={2}
                    value={mixNotes}
                    onChange={(ev) => setMixNotes(ev.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Componentes</p>
                {mixComponents.map((c, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-lg border p-3 md:grid-cols-12 md:items-end"
                  >
                    <div className="md:col-span-8 grid gap-2">
                      <Label className="text-xs">Material (tintas/cementerio)</Label>
                      <Select
                        value={c.material_id || undefined}
                        onValueChange={(v) => updateMixComponent(i, { material_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {tintaMaterials.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.sku} — {m.name} ({m.quantity_on_hand} {m.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-4 grid gap-2">
                      <Label className="text-xs">Cantidad (kg)</Label>
                      <Input
                        inputMode="decimal"
                        value={c.quantity}
                        onChange={(ev) =>
                          updateMixComponent(i, { quantity: ev.target.value })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={addMixComponent}>
                    Añadir componente
                  </Button>
                  <Button type="button" onClick={() => void createMix()} disabled={saving || loading}>
                    {saving ? "Creando…" : "Crear mezcla"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recetario de mezclas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => void reloadMixes()} disabled={loading}>
                  Actualizar
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/mezclas-tinta">Ver pantalla completa</Link>
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Salida</TableHead>
                      <TableHead>Creador</TableHead>
                      <TableHead>Componentes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!mixRows?.data?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          Sin mezclas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      mixRows.data.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.id}</TableCell>
                          <TableCell>
                            {m.created_at
                              ? String(m.created_at).slice(0, 19).replace("T", " ")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {m.output_material
                              ? `${m.output_material.sku} · ${m.output_material.name}`
                              : "—"}
                          </TableCell>
                          <TableCell>{m.creator?.name ?? "—"}</TableCell>
                          <TableCell>{m.components_count ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {mixRows && mixRows.last_page > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Página {mixRows.current_page} de {mixRows.last_page} · {mixRows.total}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mixRows.current_page <= 1 || loading}
                      onClick={() => setMixPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mixRows.current_page >= mixRows.last_page || loading}
                      onClick={() => setMixPage((p) => Math.min(mixRows.last_page, p + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </CatalogPageShell>
  )
}