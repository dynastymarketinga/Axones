"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow, WorkOrderListRow } from "@/types/api"
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

export default function AreaTintasPage() {
  const [mode, setMode] = useState<"list" | "consumo">("list")
  const [activeTab, setActiveTab] = useState<"mias" | "historial">("mias")
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)

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

  const loadAreaRows = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string | number | undefined> = {
        page,
        per_page: 20,
        status: status !== "all" ? status : undefined,
        client_order_reference: search || undefined,
      }
      if (activeTab === "mias") query.mi_area = "tintas"
      else query.historial_area = "tintas"

      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", { query })
      setRows(data)
      setWorkOrders(data.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes.")
      setRows(null)
      setWorkOrders([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, search, status])

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
        `work-orders/${woNum}/printing`,
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
      await apiFetch(`work-orders/${woNum}/printing/consumables`, {
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Área: Tintas</h1>
          <p className="text-muted-foreground text-[13px]">
            Órdenes con solicitud pendiente para tu área (sin depender del tablero).
            Historial: todas las OT que tuvieron solicitud hacia esta área.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (mode === "list") {
                void loadAreaRows()
                return
              }
              void loadLists()
              void loadWorkOrderConsumables()
            }}
            disabled={loading}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {mode === "list" ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as "mias" | "historial")
            setPage(1)
          }}
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="mias" className="text-xs">
              En mi fase
            </TabsTrigger>
            <TabsTrigger value="historial" className="text-xs">
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mias" className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="tintas-q-mias" className="text-xs font-medium">
                  Ref. pedido cliente
                </Label>
                <Input
                  id="tintas-q-mias"
                  placeholder="Buscar por referencia..."
                  className="h-8 text-xs"
                  value={q}
                  onChange={(ev) => setQ(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      setPage(1)
                      setSearch(q.trim())
                    }
                  }}
                />
              </div>
              <div className="grid w-48 gap-2">
                <Label className="text-xs font-medium">Estado</Label>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Abierta</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-[#6f42c1] text-white hover:bg-[#6137ae]"
                onClick={() => {
                  setPage(1)
                  setSearch(q.trim())
                }}
              >
                Buscar
              </Button>
            </div>

            <div className="bg-card border rounded-xl shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 py-2 text-xs">Código</TableHead>
                    <TableHead className="h-8 py-2 text-xs">Cliente</TableHead>
                    <TableHead className="h-8 py-2 text-xs">Producto</TableHead>
                    <TableHead className="h-8 py-2 text-xs">Tablero</TableHead>
                    <TableHead className="h-8 py-2 text-right text-xs">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : !rows?.data.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Sin órdenes en esta fase.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((o) => (
                      <TableRow key={o.id} className="h-9">
                        <TableCell className="py-2 font-mono text-xs">{o.code}</TableCell>
                        <TableCell className="py-2 text-xs">{o.client?.name ?? "—"}</TableCell>
                        <TableCell className="py-2 text-xs">{o.product?.name ?? "—"}</TableCell>
                        <TableCell className="py-2 text-xs">{stageLabel(o.board_stage)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs"
                              onClick={() => {
                                setWoId(String(o.id))
                                setMode("consumo")
                              }}
                            >
                              Registrar consumo
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="historial" className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="tintas-q-historial" className="text-xs font-medium">
                  Ref. pedido cliente
                </Label>
                <Input
                  id="tintas-q-historial"
                  placeholder="Buscar por referencia..."
                  className="h-8 text-xs"
                  value={q}
                  onChange={(ev) => setQ(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      setPage(1)
                      setSearch(q.trim())
                    }
                  }}
                />
              </div>
              <div className="grid w-48 gap-2">
                <Label className="text-xs font-medium">Estado</Label>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Abierta</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-[#6f42c1] text-white hover:bg-[#6137ae]"
                onClick={() => {
                  setPage(1)
                  setSearch(q.trim())
                }}
              >
                Buscar
              </Button>
            </div>

            <div className="bg-card border rounded-xl shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 py-2 text-xs">Código</TableHead>
                    <TableHead className="h-8 py-2 text-xs">Cliente</TableHead>
                    <TableHead className="h-8 py-2 text-xs">Producto</TableHead>
                    <TableHead className="h-8 py-2 text-xs">Tablero</TableHead>
                    <TableHead className="h-8 py-2 text-xs">Estado</TableHead>
                    <TableHead className="h-8 py-2 text-right text-xs">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : !rows?.data.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Sin resultados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.data.map((o) => (
                      <TableRow key={o.id} className="h-9">
                        <TableCell className="py-2 font-mono text-xs">{o.code}</TableCell>
                        <TableCell className="py-2 text-xs">{o.client?.name ?? "—"}</TableCell>
                        <TableCell className="py-2 text-xs">{o.product?.name ?? "—"}</TableCell>
                        <TableCell className="py-2 text-xs">{stageLabel(o.board_stage)}</TableCell>
                        <TableCell className="py-2 text-xs">{o.status}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs"
                              onClick={() => {
                                setWoId(String(o.id))
                                setMode("consumo")
                              }}
                            >
                              Registrar consumo
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                      <Label className="text-xs">Tablero</Label>
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
                  className="h-8 bg-[#6f42c1] text-white hover:bg-[#6137ae]"
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

      {rows && rows.last_page > 1 && mode === "list" ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {rows.current_page} de {rows.last_page} · {rows.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.current_page >= rows.last_page || loading}
              onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}