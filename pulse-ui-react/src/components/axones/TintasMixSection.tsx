"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CalendarDays,
  Hash,
  Layers,
  ListOrdered,
  Package,
  Palette,
  Plus,
  UserCircle,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogTableHead } from "@/components/axones/CatalogTableHead"
import { TintasPaneHead } from "@/components/axones/TintasPaneHead"
import { TintaColorSwatch } from "@/components/axones/TintaColorSwatch"
import { catalogSelectTriggerClass } from "@/components/axones/catalog-list-classes"
import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { apiFetch, ApiError } from "@/lib/api"
import { formatQuantityDisplayEs } from "@/lib/numeric-display"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type MixRow = {
  id: number
  created_at: string
  output_material?: { sku: string; name: string }
  creator?: { name: string }
  components_count?: number
}

type MixComponentDraft = { material_id: string; quantity: string }

export type TintasMixSectionProps = {
  workOrderId?: number
  tintaMaterials: MaterialRow[]
  onMixCreated?: () => void
  /** form: solo mezcla; recetario: tabla; all: ambos (legacy) */
  layout?: "all" | "form" | "recetario"
}

export function TintasMixSection({
  workOrderId,
  tintaMaterials,
  onMixCreated,
  layout = "all",
}: TintasMixSectionProps) {
  const showForm = layout === "all" || layout === "form"
  const showRecetario = layout === "all" || layout === "recetario"
  const [mixName, setMixName] = useState("")
  const [mixArea, setMixArea] = useState<"tintas" | "cementerio_tintas">("tintas")
  const [mixNotes, setMixNotes] = useState("")
  const [mixComponents, setMixComponents] = useState<MixComponentDraft[]>([
    { material_id: "", quantity: "" },
  ])
  const [mixRows, setMixRows] = useState<LaravelPaginated<MixRow> | null>(null)
  const [mixPage, setMixPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const reloadMixes = useCallback(async () => {
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
  }, [mixPage])

  useEffect(() => {
    if (!showRecetario) return
    void reloadMixes()
  }, [reloadMixes, showRecetario])

  function addMixComponent() {
    setMixComponents((p) => [...p, { material_id: "", quantity: "" }])
  }

  function updateMixComponent(i: number, patch: Partial<MixComponentDraft>) {
    setMixComponents((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  async function createMix() {
    const name = mixName.trim()
    if (!name) {
      toast.error("Indique el nombre del color o referencia Pantone.")
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
      toast.error("Agregue al menos un componente con cantidad en kg.")
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
          work_order_id:
            workOrderId && Number.isFinite(workOrderId) && workOrderId > 0 ? workOrderId : null,
          output_inventory_area: mixArea,
          output_tinta_subarea: mixArea === "tintas" ? "superficie" : null,
          unit: "kg",
          notes: mixNotes.trim() || null,
          components: comps,
        }),
      })
      toast.success("Mezcla registrada en inventario.")
      setMixName("")
      setMixNotes("")
      setMixComponents([{ material_id: "", quantity: "" }])
      void reloadMixes()
      onMixCreated?.()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la mezcla.")
    } finally {
      setSaving(false)
    }
  }

  const mixDesc =
    workOrderId
      ? "Prepare colores Pantone o especiales. Los componentes se descuentan del inventario; la salida queda vinculada a la OT seleccionada."
      : "Prepare colores Pantone o especiales. Seleccione una OT arriba para asociar la mezcla."

  const formFields = (
    <>
      <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Nombre del color / Pantone</Label>
              <Input
                value={mixName}
                onChange={(ev) => setMixName(ev.target.value)}
                placeholder="Ej. Pantone 286 C"
                className={catalogSelectTriggerClass}
              />
            </div>
            <div className="grid gap-2">
              <Label>Destino en inventario</Label>
              <Select
                value={mixArea}
                onValueChange={(v) =>
                  setMixArea(v === "cementerio_tintas" ? "cementerio_tintas" : "tintas")
                }
              >
                <SelectTrigger className={catalogSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tintas">Tintas (superficie)</SelectItem>
                  <SelectItem value="cementerio_tintas">Cementerio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Notas de la mezcla</Label>
              <Textarea
                rows={2}
                value={mixNotes}
                onChange={(ev) => setMixNotes(ev.target.value)}
                placeholder="Observaciones, lote, operador…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Componentes</p>
            {mixComponents.map((c, i) => (
              <div
                key={i}
                className={cn(
                  "grid gap-2 rounded-xl border p-3 md:grid-cols-12 md:items-end",
                  layout === "form"
                    ? "tintas-mix-component border-border/70"
                    : "border-border/70 bg-muted/20",
                )}
              >
                <div className="md:col-span-8 grid gap-2">
                  <Label className="text-xs">Material (tinta o cementerio)</Label>
                  <Select
                    value={c.material_id || undefined}
                    onValueChange={(v) => updateMixComponent(i, { material_id: v })}
                  >
                    <SelectTrigger className={catalogSelectTriggerClass}>
                      <SelectValue placeholder="Seleccione material…" />
                    </SelectTrigger>
                    <SelectContent>
                      {tintaMaterials.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          <span className="flex items-center gap-2">
                            <TintaColorSwatch name={m.name} size="sm" />
                            {m.sku} — {m.name} ({formatQuantityDisplayEs(m.quantity_on_hand)} {m.unit})
                          </span>
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
                    onChange={(ev) => updateMixComponent(i, { quantity: ev.target.value })}
                    className={catalogSelectTriggerClass}
                  />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={addMixComponent}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                Añadir componente
              </Button>
              <Button
                type="button"
                className={cn(layout === "form" && "tintas-create-mix")}
                onClick={() => void createMix()}
                disabled={saving || loading}
              >
                {saving ? "Creando…" : "Crear mezcla"}
              </Button>
            </div>
          </div>
    </>
  )

  const recetarioCard = (
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-5 w-5 text-primary" aria-hidden />
            Recetario reciente
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => void reloadMixes()} disabled={loading}>
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className={catalogTableHeaderRowClass}>
                  <CatalogTableHead icon={Hash} className="w-14">
                    ID
                  </CatalogTableHead>
                  <CatalogTableHead icon={CalendarDays}>Fecha</CatalogTableHead>
                  <CatalogTableHead icon={Package}>Salida</CatalogTableHead>
                  <CatalogTableHead icon={UserCircle}>Creador</CatalogTableHead>
                  <CatalogTableHead icon={ListOrdered}>Componentes</CatalogTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!mixRows?.data?.length ? (
                  <TableRow className={catalogTableBodyRowClass}>
                    <TableCell
                      colSpan={5}
                      className={cn("text-muted-foreground py-8 text-center", catalogTableBodyCellClass)}
                    >
                      {loading ? "Cargando…" : "Sin mezclas registradas."}
                    </TableCell>
                  </TableRow>
                ) : (
                  mixRows.data.map((m) => (
                    <TableRow key={m.id} className={catalogTableBodyRowClass}>
                      <TableCell className={cn("tabular-nums", catalogTableBodyCellClass)}>{m.id}</TableCell>
                      <TableCell className={cn("whitespace-nowrap text-xs", catalogTableBodyCellClass)}>
                        {m.created_at
                          ? String(m.created_at).slice(0, 19).replace("T", " ")
                          : "—"}
                      </TableCell>
                      <TableCell className={catalogTableBodyCellClass}>
                        {m.output_material
                          ? `${m.output_material.sku} · ${m.output_material.name}`
                          : "—"}
                      </TableCell>
                      <TableCell className={catalogTableBodyCellClass}>{m.creator?.name ?? "—"}</TableCell>
                      <TableCell className={catalogTableBodyCellClass}>{m.components_count ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {mixRows && mixRows.last_page > 1 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
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
  )

  if (layout === "form") {
    return (
      <div id="tintas-mezcla" className="scroll-mt-6">
        <TintasPaneHead variant="mezcla" title="Mezcla de tinta" description={mixDesc} />
        <div className="space-y-4">{formFields}</div>
      </div>
    )
  }

  if (layout === "recetario") {
    return <div className="space-y-4">{recetarioCard}</div>
  }

  return (
    <div id="tintas-mezcla" className="space-y-4 scroll-mt-6">
      <Card className="overflow-hidden border-primary/20 shadow-sm">
        <CardHeader className="border-b border-primary/10 bg-primary/[0.04] pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-5 w-5 text-primary" aria-hidden />
            Mezcla de tinta
          </CardTitle>
          <CardDescription>{mixDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">{formFields}</CardContent>
      </Card>
      {recetarioCard}
    </div>
  )
}
