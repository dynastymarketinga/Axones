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

  const loadLists = useCallback(async () => {
    setLoading(true)
    try {
      const [woRes, mats, invT, invC, mixes] = await Promise.all([
        apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
          query: { board_stage: "impresion", per_page: 50, page: 1 },
        }),
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
      setWorkOrders(woRes.data ?? [])
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
    void loadLists()
  }, [loadLists])

  useEffect(() => {
    void loadWorkOrderConsumables()
  }, [loadWorkOrderConsumables])

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Área: Tintas</h1>
          <p className="text-muted-foreground text-sm">
            Seleccione una OT y registre el consumo de tintas y químicos. Los
            cambios quedan guardados al confirmar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void loadLists()} disabled={loading}>
            Actualizar
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-trabajo">Ir a OTs</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="consumo" className="w-full">
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="consumo">Consumo por OT</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="cementerio">Cementerio</TabsTrigger>
          <TabsTrigger value="mezclas">Mezclas (Pantone)</TabsTrigger>
        </TabsList>

        <TabsContent value="consumo" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seleccionar OT (en impresión)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>OT</Label>
                <Select value={woId} onValueChange={setWoId}>
                  <SelectTrigger>
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
                {selectedWo ? (
                  <p className="text-muted-foreground text-xs">
                    {selectedWo.product?.name ?? "—"} · tablero{" "}
                    {selectedWo.board_stage ?? "—"}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tintas y cementerio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
          {inkLines.map((L, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-12">
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
                  <SelectTrigger>
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
                  onClick={() => setInkLines((rows) => rows.filter((_, j) => j !== i))}
                  disabled={inkLines.length <= 1}
                >
                  Quitar
                </Button>
              </div>
              <div className="md:col-span-12">
                <Input
                  placeholder="Notas línea"
                  value={L.notes}
                  onChange={(ev) =>
                    setInkLines((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, notes: ev.target.value } : r)),
                    )
                  }
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            size="sm"
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
            <CardHeader>
              <CardTitle className="text-base">Químicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
          {chemRows.map((r, i) => (
            <div key={r.chemical_type} className="grid gap-2 rounded-md border p-2 md:grid-cols-4">
              <div className="font-medium capitalize">{r.chemical_type}</div>
              <Input
                placeholder="Cargado kg"
                inputMode="decimal"
                value={r.quantity_loaded_kg}
                onChange={(ev) =>
                  setChemRows((rows) =>
                    rows.map((x, j) => (j === i ? { ...x, quantity_loaded_kg: ev.target.value } : x)),
                  )
                }
              />
              <Input
                placeholder="Devuelto kg"
                inputMode="decimal"
                value={r.quantity_return_kg}
                onChange={(ev) =>
                  setChemRows((rows) =>
                    rows.map((x, j) => (j === i ? { ...x, quantity_return_kg: ev.target.value } : x)),
                  )
                }
              />
              <Input
                placeholder="Notas"
                value={r.notes}
                onChange={(ev) =>
                  setChemRows((rows) =>
                    rows.map((x, j) => (j === i ? { ...x, notes: ev.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving || loading}>
              {saving ? "Guardando…" : "Guardar consumo"}
            </Button>
            {Number.isFinite(woNum) && woNum > 0 ? (
              <Button type="button" variant="outline" asChild>
                <Link to={`/ordenes-trabajo/${woNum}?tab=printing`}>
                  Abrir OT (Impresión)
                </Link>
              </Button>
            ) : null}
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
                    <TableHead>Stock</TableHead>
                    <TableHead>Unidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!invTintas.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Sin ítems.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invTintas.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.quantity_on_hand}</TableCell>
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
                    <TableHead>Stock</TableHead>
                    <TableHead>Unidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!invCementerio.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Sin ítems.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invCementerio.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.sku}</TableCell>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.quantity_on_hand}</TableCell>
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
              <CardTitle className="text-base">Nueva mezcla (receta / Pantone)</CardTitle>
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
              <CardTitle className="text-base">Historial de mezclas</CardTitle>
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
  )
}

