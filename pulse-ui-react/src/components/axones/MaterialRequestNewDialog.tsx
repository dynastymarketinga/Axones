"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

const DESTINATION_OPTIONS: { value: string; label: string }[] = [
  { value: "presidencia", label: "Presidencia" },
  { value: "administracion", label: "Administración" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "servicios_generales", label: "Servicios generales" },
  { value: "vigilancia", label: "Vigilancia" },
  { value: "almacen", label: "Almacén" },
  { value: "produccion", label: "Producción" },
  { value: "montaje", label: "Montaje" },
  { value: "otros", label: "Otros" },
]

type DraftLine = {
  key: string
  material_id: string
  description: string
  quantity_requested: string
  unit: string
}

function newLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    material_id: "",
    description: "",
    quantity_requested: "",
    unit: "",
  }
}

type Props = {
  onCreated?: () => void
}

export function MaterialRequestNewDialog({ onCreated }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [workOrderId, setWorkOrderId] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()])
  const [destinationPick, setDestinationPick] = useState<Record<string, boolean>>({})
  const [materialSearch, setMaterialSearch] = useState("")
  const [materialOptions, setMaterialOptions] = useState<MaterialRow[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)

  const loadMaterials = useCallback(async (q: string) => {
    setMaterialsLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: {
          q: q.trim() || undefined,
          per_page: 80,
          sort_by: "name",
          sort_dir: "asc",
        },
      })
      setMaterialOptions(Array.isArray(data?.data) ? data.data : [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar materiales.")
      setMaterialOptions([])
    } finally {
      setMaterialsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => void loadMaterials(materialSearch), 250)
    return () => window.clearTimeout(t)
  }, [open, materialSearch, loadMaterials])

  const resetForm = () => {
    setWorkOrderId("")
    setNotes("")
    setLines([newLine()])
    setDestinationPick({})
    setMaterialSearch("")
  }

  const toggleDestination = (value: string, checked: boolean) => {
    setDestinationPick((prev) => ({ ...prev, [value]: checked }))
  }

  async function submit() {
    const wo = Number(workOrderId)
    if (!Number.isFinite(wo) || wo < 1) {
      toast.error("Indique un número de orden de trabajo válido.")
      return
    }

    const payloadLines: Array<{
      material_id?: number
      description?: string
      quantity_requested: string
      unit?: string
    }> = []

    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx]
      const mid = ln.material_id.trim()
      const qty = ln.quantity_requested.trim().replace(",", ".")
      const desc = ln.description.trim()
      if (!qty || Number(qty) <= 0) {
        toast.error(`Línea ${idx + 1}: indicar cantidad mayor que cero.`)
        return
      }
      if (!mid && !desc) {
        toast.error(
          `Línea ${idx + 1}: elija un material del inventario o escriba una descripción (repuesto no catalogado).`,
        )
        return
      }
      payloadLines.push({
        ...(mid ? { material_id: Number(mid) } : {}),
        ...(desc ? { description: desc } : {}),
        quantity_requested: qty,
        ...(ln.unit.trim() ? { unit: ln.unit.trim() } : {}),
      })
    }

    const destinations = DESTINATION_OPTIONS.filter((o) => destinationPick[o.value]).map(
      (o) => o.value,
    )

    try {
      setSubmitting(true)
      const created = await apiFetch<{ id: number }>("material-requests", {
        method: "POST",
        body: JSON.stringify({
          work_order_id: wo,
          notes: notes.trim() || undefined,
          destination_areas: destinations.length ? destinations : undefined,
          lines: payloadLines,
        }),
      })
      toast.success("Solicitud de insumos creada.")
      setOpen(false)
      resetForm()
      onCreated?.()
      navigate(`/solicitudes-material/${created.id}`)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear la solicitud.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">Nueva solicitud de insumos</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva solicitud de insumos</DialogTitle>
          <DialogDescription>
            Ligada a una orden de trabajo. Tras{" "}
            <strong>autorizar</strong> y <strong>entregar</strong> desde el detalle, el sistema{" "}
            <strong>rebaja inventario</strong> y deja constancia en{" "}
            <Link className="text-primary underline-offset-4 hover:underline" to="movimientos-inventario">
              Movimientos
            </Link>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="mr-wo">Orden de trabajo (ID numérico)</Label>
            <Input
              id="mr-wo"
              inputMode="numeric"
              placeholder="Ej. 42"
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div className="grid gap-2">
            <Label>Áreas de destino (opcional)</Label>
            <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-3 text-sm">
              {DESTINATION_OPTIONS.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={!!destinationPick[o.value]}
                    onCheckedChange={(c) => toggleDestination(o.value, c === true)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mr-notes">Observaciones</Label>
            <Textarea
              id="mr-notes"
              rows={2}
              placeholder="Motivo, máquina, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <Label>Líneas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, newLine()])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Añadir línea
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Busque material por nombre o SKU; si no está catalogado, deje material vacío y use descripción.
            </p>
            <Input
              placeholder="Buscar material…"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              disabled={materialsLoading}
            />

            <div className="space-y-3 rounded-md border p-3">
              {lines.map((ln, i) => (
                <div key={ln.key} className="grid gap-2 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs font-medium">Línea {i + 1}</span>
                    {lines.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive"
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== ln.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs">Material</Label>
                      <Select
                        value={ln.material_id || "__none__"}
                        onValueChange={(v) => {
                          const id = v === "__none__" ? "" : v
                          const mat = materialOptions.find((m) => String(m.id) === id)
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === ln.key
                                ? {
                                    ...row,
                                    material_id: id,
                                    unit: mat?.unit ?? row.unit,
                                  }
                                : row,
                            ),
                          )
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin catálogo (solo descripción)</SelectItem>
                          {materialOptions.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.sku} · {m.name} ({m.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Cantidad solicitada</Label>
                      <Input
                        inputMode="decimal"
                        value={ln.quantity_requested}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === ln.key
                                ? { ...row, quantity_requested: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Unidad</Label>
                      <Input
                        placeholder="Ej. kg, par"
                        value={ln.unit}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === ln.key ? { ...row, unit: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs">Descripción (si no hay material)</Label>
                      <Input
                        placeholder="Repuesto, ítem no catalogado…"
                        value={ln.description}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === ln.key ? { ...row, description: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              {materialsLoading ? (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Cargando materiales…
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void submit()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Crear solicitud"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
