"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const AREAS = [
  "material",
  "tintas",
  "cementerio_tintas",
  "quimicos",
  "bobinas_rechazadas",
  "miscelaneos",
] as const

const UNITS_BY_AREA: Record<(typeof AREAS)[number], string[]> = {
  material: ["kg", "m", "rollo"],
  bobinas_rechazadas: ["kg", "m", "rollo"],
  tintas: ["kg", "litro"],
  miscelaneos: ["unidad", "caja", "pack", "kg"],
  quimicos: ["kg", "litro", "unidad"],
  cementerio_tintas: ["kg", "litro"],
}

type DuplicateCheckResponse = {
  has_duplicates: boolean
  total_matches: number
  matches: Array<{
    id: number
    sku: string
    name: string
    inventory_area: string
    is_active: boolean
  }>
}

export default function MaterialFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const materialId = Number(id)
  const isEdit = Number.isFinite(materialId) && materialId > 0

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [barcode, setBarcode] = useState("")
  const [inventoryArea, setInventoryArea] = useState<(typeof AREAS)[number]>("material")
  const [unit, setUnit] = useState("kg")
  const [tintaPresentacion, setTintaPresentacion] = useState<"original" | "solventada" | "">("")
  const [micras, setMicras] = useState("")
  const [ancho, setAncho] = useState("")
  const [minStock, setMinStock] = useState("0")
  const [notes, setNotes] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateCheckResponse["matches"]>([])
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/materiales"
  }, [location.state])

  const load = useCallback(async () => {
    if (!isEdit || !materialId) return
    setLoading(true)
    try {
      const row = await apiFetch<MaterialRow>(`materials/${materialId}`)
      setSku(row.sku ?? "")
      setName(row.name ?? "")
      setBarcode(row.barcode ?? "")
      setInventoryArea((AREAS.includes((row.inventory_area ?? "") as (typeof AREAS)[number]) ? row.inventory_area : "material") as (typeof AREAS)[number])
      setUnit(row.unit ?? "kg")
      setTintaPresentacion((row.tinta_presentacion as "original" | "solventada" | null) ?? "")
      setMicras(row.micras ?? "")
      setAncho(row.ancho ?? "")
      setMinStock(row.min_stock ?? "0")
      setNotes(row.notes ?? "")
      setIsActive(row.is_active ?? true)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el material.")
    } finally {
      setLoading(false)
    }
  }, [isEdit, materialId])

  useEffect(() => {
    void load()
  }, [load])

  const requiresDimensions = inventoryArea === "material" || inventoryArea === "bobinas_rechazadas"
  const requiresTintaPresentacion = inventoryArea === "tintas"
  const availableUnits = UNITS_BY_AREA[inventoryArea] ?? ["kg"]

  useEffect(() => {
    if (!availableUnits.includes(unit)) {
      setUnit(availableUnits[0] ?? "kg")
    }
  }, [availableUnits, unit])

  useEffect(() => {
    if (!requiresDimensions) {
      setMicras("")
      setAncho("")
    }
    if (!requiresTintaPresentacion) {
      setTintaPresentacion("")
    }
  }, [requiresDimensions, requiresTintaPresentacion])

  function buildPayload() {
    return {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      barcode: barcode.trim() || null,
      inventory_area: inventoryArea,
      unit: unit.trim() || "kg",
      tinta_presentacion: requiresTintaPresentacion ? tintaPresentacion || null : null,
      micras: requiresDimensions ? Number(micras || "0") : null,
      ancho: requiresDimensions ? Number(ancho || "0") : null,
      min_stock: Number(minStock || "0"),
      notes: notes.trim() || null,
      is_active: isActive,
    }
  }

  async function persist(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      if (isEdit && materialId) {
        await apiFetch<MaterialRow>(`materials/${materialId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        toast.success("Material actualizado.")
      } else {
        await apiFetch<MaterialRow>("materials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        toast.success("Material creado.")
      }
      navigate(returnTo)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar el material.")
    } finally {
      setSaving(false)
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!sku.trim() || !name.trim()) {
      toast.error("SKU y nombre son obligatorios.")
      return
    }
    if (requiresDimensions && (!micras.trim() || !ancho.trim())) {
      toast.error("Micras y ancho son obligatorios para sustrato/bobinas.")
      return
    }
    if (requiresTintaPresentacion && !tintaPresentacion) {
      toast.error("La presentación es obligatoria para tintas.")
      return
    }

    const payload = buildPayload()
    try {
      const d = await apiFetch<DuplicateCheckResponse>("materials/check-duplicates", {
        query: {
          sku: String(payload.sku ?? ""),
          name: String(payload.name ?? ""),
          inventory_area: String(payload.inventory_area ?? ""),
          except_id: isEdit && materialId ? String(materialId) : undefined,
        },
      })
      if (d.has_duplicates) {
        setDuplicateMatches(d.matches)
        setPendingPayload(payload)
        setDuplicateDialogOpen(true)
        return
      }
    } catch {
      // warning is preventive; don't block create/update
    }

    await persist(payload)
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Editar material" : "Nuevo material"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestione datos maestros de materiales para recepción y producción.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to={returnTo}>Volver al listado</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : (
        <form onSubmit={(ev) => void submit(ev)} className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="m-sku">Código / SKU *</Label>
              <Input id="m-sku" value={sku} onChange={(ev) => setSku(ev.target.value.toUpperCase())} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-name">Nombre *</Label>
              <Input id="m-name" value={name} onChange={(ev) => setName(ev.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-area">Área</Label>
              <select
                id="m-area"
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                value={inventoryArea}
                onChange={(ev) => setInventoryArea(ev.target.value as (typeof AREAS)[number])}
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-unit">Unidad</Label>
              <select
                id="m-unit"
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                value={unit}
                onChange={(ev) => setUnit(ev.target.value)}
              >
                {availableUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-min">Stock mínimo</Label>
              <Input id="m-min" type="number" min="0" step="0.001" value={minStock} onChange={(ev) => setMinStock(ev.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-barcode">Código de barras</Label>
              <Input id="m-barcode" value={barcode} onChange={(ev) => setBarcode(ev.target.value)} />
            </div>
            {requiresTintaPresentacion ? (
              <div className="grid gap-2">
                <Label htmlFor="m-tinta-presentacion">Presentación tinta *</Label>
                <select
                  id="m-tinta-presentacion"
                  className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                  value={tintaPresentacion}
                  onChange={(ev) => setTintaPresentacion(ev.target.value as "original" | "solventada" | "")}
                  required
                >
                  <option value="">Seleccione...</option>
                  <option value="original">Original</option>
                  <option value="solventada">Solventada</option>
                </select>
              </div>
            ) : null}
            {requiresDimensions ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="m-micras">Micras *</Label>
                  <Input
                    id="m-micras"
                    type="number"
                    min="0"
                    step="0.001"
                    value={micras}
                    onChange={(ev) => setMicras(ev.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="m-ancho">Ancho *</Label>
                  <Input
                    id="m-ancho"
                    type="number"
                    min="0"
                    step="0.001"
                    value={ancho}
                    onChange={(ev) => setAncho(ev.target.value)}
                    required
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Estado</p>
              <p className="text-muted-foreground text-xs">Inactivo no aparece para nuevas recepciones.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{isActive ? "Activo" : "Inactivo"}</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="m-notes">Notas</Label>
            <Textarea id="m-notes" rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear material"}
          </Button>
        </form>
      )}

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Posible duplicado detectado</DialogTitle>
            <DialogDescription>
              Se encontraron materiales similares por SKU o por Nombre + Área.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-56 overflow-auto rounded-md border p-2 text-sm">
            {duplicateMatches.map((m) => (
              <div key={m.id} className="border-b px-2 py-1 last:border-b-0">
                {m.sku} — {m.name} ({m.inventory_area}) · {m.is_active ? "Activo" : "Inactivo"}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Revisar
            </Button>
            <Button
              type="button"
              onClick={() => {
                const payload = pendingPayload
                setDuplicateDialogOpen(false)
                if (payload) void persist(payload)
              }}
            >
              Continuar y guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

