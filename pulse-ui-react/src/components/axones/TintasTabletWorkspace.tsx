"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Beaker,
  ClipboardList,
  Droplets,
  RotateCcw,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import { TintasMaterialInventoryTable } from "@/components/axones/TintasMaterialInventoryTable"
import { TintaColorSwatch } from "@/components/axones/TintaColorSwatch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { MaterialRow } from "@/types/api"

import "@/pages/axones/tintas-tablet-workspace.css"

/** Pantallas del encargado según flujo operativo de planta (Val / Víctor). */
type EncargadoScreen = "inicio" | "tintas" | "quimicos" | "devolucion" | "mezcla"

type InkOriginType = "original" | "solventada" | "real"

type InkLineDraft = {
  material_id: string
  origin_type: InkOriginType
  quantity_kg: string
}

type ChemDraft = {
  chemical_type: string
  quantity_loaded_kg: string
}

const CHEMICALS: { type: string; label: string; hint?: string }[] = [
  { type: "alcohol", label: "Alcohol" },
  { type: "metoxil", label: "Metoxil" },
  { type: "npa", label: "NPA (acetato)", hint: "N-propil acetato" },
]

const ORIGIN_LABELS: Record<InkOriginType, string> = {
  original: "Original (almacén)",
  solventada: "Solventada / preparada",
  real: "Real (consumo neto)",
}

function notifyWarehouseRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("alerts:refresh"))
  }
}

const HUB_ITEMS: {
  id: EncargadoScreen
  title: string
  subtitle: string
  icon: typeof Droplets
}[] = [
  {
    id: "tintas",
    title: "1. Tintas usadas",
    subtitle: "Elija del inventario y kilos usados",
    icon: Droplets,
  },
  {
    id: "quimicos",
    title: "2. Químicos",
    subtitle: "Alcohol, metoxil, acetato…",
    icon: Beaker,
  },
  {
    id: "devolucion",
    title: "3. Devolución",
    subtitle: "Sobrantes — Leonardo aprueba",
    icon: RotateCcw,
  },
  {
    id: "mezcla",
    title: "4. Mezcla",
    subtitle: "Receta, nombre y código → solicitudes",
    icon: ClipboardList,
  },
]

export type TintasTabletWorkspaceProps = {
  workOrderId: number
  workOrderCode?: string | null
  tintaMaterials: MaterialRow[]
  invTintas: MaterialRow[]
  invCementerio: MaterialRow[]
  onMixCreated?: () => void
}

function materialName(materials: MaterialRow[], id: string): string {
  return materials.find((x) => String(x.id) === id)?.name ?? "Tinta"
}

function TintasMaterialCardBody({ name, meta }: { name: string; meta?: string }) {
  return (
    <>
      <TintaColorSwatch name={name} size="lg" />
      <span className="tintas-tablet__material-card-body">
        <span className="tintas-tablet__material-name">{name}</span>
        {meta ? <span className="tintas-tablet__material-meta">{meta}</span> : null}
      </span>
    </>
  )
}

function inkLineToApi(L: InkLineDraft, position: number) {
  const kg = L.quantity_kg.trim() ? Number(L.quantity_kg) : 0
  return {
    material_id: Number(L.material_id),
    quantity_original_kg: L.origin_type === "original" || L.origin_type === "real" ? kg : 0,
    quantity_solventada_kg: L.origin_type === "solventada" ? kg : 0,
    quantity_return_kg: 0,
    notes: L.origin_type === "real" ? "tipo: real" : null,
    position,
  }
}

export function TintasTabletWorkspace({
  workOrderId,
  workOrderCode,
  tintaMaterials,
  invTintas,
  invCementerio,
  onMixCreated,
}: TintasTabletWorkspaceProps) {
  const base = `work-orders/${workOrderId}/tintas`

  const [screen, setScreen] = useState<EncargadoScreen>("inicio")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [inkLines, setInkLines] = useState<InkLineDraft[]>([])
  const [chemRows, setChemRows] = useState<ChemDraft[]>(
    CHEMICALS.map((c) => ({ chemical_type: c.type, quantity_loaded_kg: "" })),
  )

  const [materialArea, setMaterialArea] = useState<"tintas" | "cementerio_tintas">("tintas")

  const [returnMaterialId, setReturnMaterialId] = useState("")
  const [returnKg, setReturnKg] = useState("")
  const [returnDest, setReturnDest] = useState<"tintas" | "cementerio_tintas">("tintas")
  const [returnNotes, setReturnNotes] = useState("")

  const [mixName, setMixName] = useState("")
  const [mixCode, setMixCode] = useState("")
  const [mixNotes, setMixNotes] = useState("")
  const [mixComponents, setMixComponents] = useState<{ material_id: string; quantity: string }[]>([
    { material_id: "", quantity: "" },
  ])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Record<string, unknown>>(base)
      const inks = (data.ink_control_lines as Record<string, unknown>[]) ?? []
      setInkLines(
        inks
          .filter((row) => String(row.material_id ?? "").trim() !== "")
          .map((row) => {
            const orig = Number(row.quantity_original_kg ?? 0)
            const sol = Number(row.quantity_solventada_kg ?? 0)
            const notes = typeof row.notes === "string" ? row.notes : ""
            let origin_type: InkOriginType = "original"
            let quantity_kg = String(orig || "")
            if (sol > 0) {
              origin_type = "solventada"
              quantity_kg = String(sol)
            } else if (notes.includes("tipo: real")) {
              origin_type = "real"
            }
            return {
              material_id: String(row.material_id ?? ""),
              origin_type,
              quantity_kg,
            }
          }),
      )

      const chems = (data.chemical_usages as Record<string, unknown>[]) ?? []
      const byType = Object.fromEntries(chems.map((c) => [String(c.chemical_type), c]))
      setChemRows(
        CHEMICALS.map((c) => {
          const row = byType[c.type] as Record<string, unknown> | undefined
          const kg = row ? Number(row.quantity_loaded_kg ?? 0) : 0
          return {
            chemical_type: c.type,
            quantity_loaded_kg: Number.isFinite(kg) && kg > 0 ? String(kg) : "",
          }
        }),
      )
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) toast.error(e.message)
      else if (!(e instanceof ApiError)) toast.error("No se pudo cargar el registro.")
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load])

  const areaMaterials = useMemo(() => {
    const fromInv = materialArea === "tintas" ? invTintas : invCementerio
    const fromCatalog = tintaMaterials.filter((m) => m.inventory_area === materialArea)
    const byId = new Map<number, MaterialRow>()
    for (const m of fromCatalog) byId.set(m.id, m)
    for (const m of fromInv) {
      const prev = byId.get(m.id)
      byId.set(m.id, prev ? { ...prev, ...m } : m)
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
  }, [materialArea, invTintas, invCementerio, tintaMaterials])

  function addInkLine(materialId: string) {
    if (inkLines.some((L) => L.material_id === materialId)) {
      toast.message("Esa tinta ya está en la lista.")
      return
    }
    setInkLines((rows) => [...rows, { material_id: materialId, origin_type: "original", quantity_kg: "" }])
  }

  async function saveTintas() {
    const lines = inkLines.filter((L) => L.material_id.trim() !== "")
    if (!lines.length) {
      toast.error("Agregue al menos una tinta con kilos usados.")
      return
    }
    for (const L of lines) {
      const kg = Number(L.quantity_kg)
      if (!Number.isFinite(kg) || kg <= 0) {
        toast.error(`Indique kilos usados para ${materialName(tintaMaterials, L.material_id)}.`)
        return
      }
    }
    setSaving(true)
    try {
      const ink_lines = lines.map((L, idx) => inkLineToApi(L, idx))
      await apiFetch(`${base}/consumables`, {
        method: "PUT",
        body: JSON.stringify({
          ink_lines,
          chemical_usages: chemRows.map((r) => ({
            chemical_type: r.chemical_type,
            quantity_loaded_kg: r.quantity_loaded_kg.trim() ? Number(r.quantity_loaded_kg) : 0,
            quantity_return_kg: 0,
            notes: null,
          })),
        }),
      })
      toast.success("Tintas usadas guardadas. Solicitud enviada a almacén — Leonardo autoriza y despacha.")
      notifyWarehouseRefresh()
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function saveQuimicos() {
    setSaving(true)
    try {
      const ink_lines = inkLines.filter((L) => L.material_id.trim() !== "").map((L, idx) => inkLineToApi(L, idx))
      await apiFetch(`${base}/consumables`, {
        method: "PUT",
        body: JSON.stringify({
          ink_lines,
          chemical_usages: chemRows.map((r) => ({
            chemical_type: r.chemical_type,
            quantity_loaded_kg: r.quantity_loaded_kg.trim() ? Number(r.quantity_loaded_kg) : 0,
            quantity_return_kg: 0,
            notes: null,
          })),
        }),
      })
      toast.success("Químicos guardados. Solicitud enviada a almacén — Leonardo autoriza y despacha.")
      notifyWarehouseRefresh()
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function saveDevolucion() {
    const mid = Number(returnMaterialId)
    const qty = Number(returnKg)
    if (!Number.isFinite(mid) || mid < 1) {
      toast.error("Seleccione la tinta que sobró.")
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Indique cuántos kilos sobraron.")
      return
    }
    setSaving(true)
    try {
      await apiFetch("inventory-returns", {
        method: "POST",
        body: JSON.stringify({
          material_id: mid,
          work_order_id: workOrderId,
          destination_area: returnDest,
          quantity: qty,
          reason: returnNotes.trim() || `Devolución tintas OT ${workOrderCode ?? workOrderId}`,
        }),
      })
      toast.success("Devolución enviada. Leonardo (almacén) debe aprobarla para cuadrar stock.")
      notifyWarehouseRefresh()
      setReturnMaterialId("")
      setReturnKg("")
      setReturnNotes("")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la devolución.")
    } finally {
      setSaving(false)
    }
  }

  async function saveMezcla() {
    const name = mixName.trim()
    const code = mixCode.trim()
    if (!name) {
      toast.error("Indique el nombre del color.")
      return
    }
    if (!code) {
      toast.error("Indique el código alfanumérico (lo define el encargado de tintas).")
      return
    }
    const comps = mixComponents
      .map((c) => ({ material_id: Number(c.material_id), quantity: Number(c.quantity) }))
      .filter((c) => c.material_id > 0 && c.quantity > 0)
    if (!comps.length) {
      toast.error("Agregue al menos un componente con cantidad.")
      return
    }

    setSaving(true)
    try {
      await apiFetch("tinta-mixtures", {
        method: "POST",
        body: JSON.stringify({
          output_sku: code.toUpperCase(),
          output_name: name,
          work_order_id: workOrderId,
          output_inventory_area: "tintas",
          output_tinta_subarea: "superficie",
          unit: "kg",
          notes: mixNotes.trim() || null,
          components: comps,
        }),
      })
      toast.success(
        "Mezcla registrada. Llegó como solicitud a almacén — Leonardo autoriza y despacha (descuenta bases y da de alta el color).",
      )
      notifyWarehouseRefresh()
      setMixName("")
      setMixCode("")
      setMixNotes("")
      setMixComponents([{ material_id: "", quantity: "" }])
      onMixCreated?.()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo enviar la mezcla.")
    } finally {
      setSaving(false)
    }
  }

  if (loading && screen === "inicio") {
    return (
      <div className="tintas-tablet py-12 text-center text-muted-foreground">Cargando…</div>
    )
  }

  return (
    <div className={cn("tintas-tablet", screen === "tintas" && "tintas-tablet--wide")}>
      <header className="tintas-tablet__hero">
        <div>
          <p className="tintas-tablet__step-label">Encargado de tintas</p>
          <p className="tintas-tablet__ot">
            {workOrderCode ? (
              <>
                OT <span className="font-mono">{workOrderCode}</span>
              </>
            ) : (
              "Orden de trabajo"
            )}
          </p>
        </div>
       
      </header>

      {screen === "inicio" ? (
        <section className="space-y-3">
          <p className="tintas-tablet__hint mb-4">
            Elija qué necesita hacer. Cada paso es independiente; no hay turnos ni temporizador.
          </p>
          <div className="grid gap-3">
            {HUB_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className="tintas-tablet__hub-card"
                  onClick={() => setScreen(item.id)}
                >
                  <span className="tintas-tablet__hub-icon" aria-hidden>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="flex flex-col items-start gap-0.5 text-left">
                    <span className="tintas-tablet__hub-title">{item.title}</span>
                    <span className="tintas-tablet__hub-sub">{item.subtitle}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            className="mb-4 min-h-11 gap-1 px-0 text-base"
            onClick={() => setScreen("inicio")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Volver al menú
          </Button>

          {screen === "tintas" ? (
            <section className="space-y-4">
              <h2 className="tintas-tablet__question">Tintas usadas en esta OT</h2>
              <p className="tintas-tablet__hint">
                A la izquierda, los colores que usa en esta OT. A la derecha, el inventario — toque
                una fila para agregar la tinta e indique kilos y tipo.
              </p>

              <div className="tintas-tablet__tintas-split">
                <div className="tintas-tablet__selected-panel space-y-3">
                  <p className="text-sm font-semibold text-violet-900">Colores seleccionados</p>
                  {inkLines.length === 0 ? (
                    <p className="tintas-tablet__empty-selected">
                      Ninguna tinta aún. Toque una fila del inventario (derecha) para agregarla.
                    </p>
                  ) : (
                    inkLines.map((L, i) => (
                      <div key={`${L.material_id}-${i}`} className="tintas-tablet__line-card space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="tintas-tablet__line-card-header">
                            <TintaColorSwatch
                              name={materialName(tintaMaterials, L.material_id)}
                              size="md"
                            />
                            <p className="tintas-tablet__material-name">
                              {materialName(tintaMaterials, L.material_id)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive shrink-0"
                            onClick={() => setInkLines((rows) => rows.filter((_, j) => j !== i))}
                          >
                            Quitar
                          </Button>
                        </div>
                        <div className="tintas-tablet__origin-tabs">
                          {(["original", "solventada", "real"] as InkOriginType[]).map((t) => (
                            <Button
                              key={t}
                              type="button"
                              size="lg"
                              variant={L.origin_type === t ? "default" : "outline"}
                              className="tintas-tablet__origin-tab text-xs sm:text-sm"
                              onClick={() =>
                                setInkLines((rows) =>
                                  rows.map((r, j) => (j === i ? { ...r, origin_type: t } : r)),
                                )
                              }
                            >
                              {ORIGIN_LABELS[t]}
                            </Button>
                          ))}
                        </div>
                        <div className="tintas-tablet__kg-field">
                          <Label htmlFor={`kg-${i}`}>Kilos usados</Label>
                          <Input
                            id={`kg-${i}`}
                            inputMode="decimal"
                            placeholder="0"
                            className="mt-1"
                            value={L.quantity_kg}
                            onChange={(e) =>
                              setInkLines((rows) =>
                                rows.map((r, j) =>
                                  j === i ? { ...r, quantity_kg: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="tintas-tablet__inv-panel space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                  <p className="text-sm font-semibold text-violet-900">Inventario disponible</p>
                  <div className="tintas-tablet__area-tabs">
                    <Button
                      type="button"
                      size="lg"
                      variant={materialArea === "tintas" ? "default" : "outline"}
                      className="tintas-tablet__area-tab"
                      onClick={() => setMaterialArea("tintas")}
                    >
                      Almacén base
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant={materialArea === "cementerio_tintas" ? "default" : "outline"}
                      className="tintas-tablet__area-tab"
                      onClick={() => setMaterialArea("cementerio_tintas")}
                    >
                      Cementerio
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Toque una fila para agregarla a la OT. Solo lectura — Leonardo modifica el stock
                    real.
                  </p>
                  <div className="tintas-tablet__inv-table-wrap">
                    <TintasMaterialInventoryTable
                      materials={areaMaterials}
                      notesColumnLabel={
                        materialArea === "cementerio_tintas" ? "Cliente / notas" : "Lote / notas"
                      }
                      emptyMessage={
                        materialArea === "tintas"
                          ? "No hay tintas en almacén base. Leonardo debe darlas de alta en Materiales."
                          : "No hay tintas en cementerio."
                      }
                      onRowClick={(m) => addInkLine(String(m.id))}
                      selectedMaterialId={
                        inkLines.length > 0 ? inkLines[inkLines.length - 1]?.material_id : undefined
                      }
                    />
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                className="tintas-tablet__primary w-full"
                disabled={saving}
                onClick={() => void saveTintas()}
              >
                <Save className="mr-2 h-5 w-5" aria-hidden />
                {saving ? "Guardando…" : "Guardar tintas usadas"}
              </Button>
            </section>
          ) : null}

          {screen === "quimicos" ? (
            <section className="space-y-4">
              <h2 className="tintas-tablet__question">Químicos usados</h2>
              <p className="tintas-tablet__hint">Indique cuántos kilos entraron a la máquina.</p>
              {CHEMICALS.map((chem, i) => (
                <div key={chem.type} className="tintas-tablet__chem-block">
                  <p className="tintas-tablet__chem-title">
                    {chem.label}
                    {chem.hint ? (
                      <span className="text-muted-foreground ml-1 text-sm font-normal">({chem.hint})</span>
                    ) : null}
                  </p>
                  <div className="tintas-tablet__kg-field">
                    <Label htmlFor={`chem-${chem.type}`}>Kilos usados</Label>
                    <Input
                      id={`chem-${chem.type}`}
                      inputMode="decimal"
                      placeholder="0"
                      className="mt-1"
                      value={chemRows[i]?.quantity_loaded_kg ?? ""}
                      onChange={(e) =>
                        setChemRows((rows) =>
                          rows.map((r, j) =>
                            j === i ? { ...r, quantity_loaded_kg: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="lg"
                className="tintas-tablet__primary w-full"
                disabled={saving}
                onClick={() => void saveQuimicos()}
              >
                <Save className="mr-2 h-5 w-5" aria-hidden />
                {saving ? "Guardando…" : "Guardar químicos"}
              </Button>
            </section>
          ) : null}

          {screen === "devolucion" ? (
            <section className="space-y-4">
              <h2 className="tintas-tablet__question">Devolución de sobrantes</h2>
              <p className="tintas-tablet__hint">
                Lo que sobró al terminar la impresión queda <strong>pendiente</strong> hasta que
                Leonardo (almacén) lo apruebe. No modifica stock hasta entonces.
              </p>
              <div className="tintas-tablet__area-tabs">
                <Button
                  type="button"
                  size="lg"
                  variant={returnDest === "tintas" ? "default" : "outline"}
                  className="tintas-tablet__area-tab"
                  onClick={() => setReturnDest("tintas")}
                >
                  Volver a almacén
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant={returnDest === "cementerio_tintas" ? "default" : "outline"}
                  className="tintas-tablet__area-tab"
                  onClick={() => setReturnDest("cementerio_tintas")}
                >
                  Cementerio
                </Button>
              </div>
              <div className="tintas-tablet__material-grid max-h-48">
                {(returnDest === "tintas" ? invTintas : invCementerio).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={cn(
                      "tintas-tablet__material-card",
                      returnMaterialId === String(m.id) && "tintas-tablet__material-card--selected",
                    )}
                    onClick={() => setReturnMaterialId(String(m.id))}
                  >
                    <TintasMaterialCardBody name={m.name} />
                  </button>
                ))}
              </div>
              <div className="tintas-tablet__kg-field">
                <Label htmlFor="return-kg">Kilos que sobraron</Label>
                <Input
                  id="return-kg"
                  inputMode="decimal"
                  placeholder="0"
                  className="mt-1"
                  value={returnKg}
                  onChange={(e) => setReturnKg(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="return-notes">Notas (opcional)</Label>
                <Textarea
                  id="return-notes"
                  className="mt-1 min-h-20 text-base"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="lg"
                className="tintas-tablet__primary w-full"
                disabled={saving}
                onClick={() => void saveDevolucion()}
              >
                <Save className="mr-2 h-5 w-5" aria-hidden />
                {saving ? "Enviando…" : "Enviar devolución a Leonardo"}
              </Button>
            </section>
          ) : null}

          {screen === "mezcla" ? (
            <section className="space-y-4">
              <h2 className="tintas-tablet__question">Nueva mezcla</h2>
              <p className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm text-violet-950">
                Usted define el <strong>nombre</strong> y el <strong>código</strong> del color. Al guardar llega
                como <strong>solicitud a almacén</strong>; Leonardo aprueba y despacha (descuenta bases y da de alta
                el color).
              </p>
              <div className="tintas-tablet__kg-field">
                <Label htmlFor="mix-name">Nombre del color</Label>
                <div className="mt-1 flex items-center gap-2">
                  {mixName.trim() ? <TintaColorSwatch name={mixName} size="md" /> : null}
                  <Input
                    id="mix-name"
                    placeholder="Ej. Dorado Café Amanecer"
                    className="flex-1"
                    value={mixName}
                    onChange={(e) => setMixName(e.target.value)}
                  />
                </div>
              </div>
              <div className="tintas-tablet__kg-field">
                <Label htmlFor="mix-code">Código alfanumérico</Label>
                <Input
                  id="mix-code"
                  placeholder="Ej. DCA-2026-01"
                  className="mt-1 font-mono uppercase"
                  value={mixCode}
                  onChange={(e) => setMixCode(e.target.value)}
                />
              </div>
              {mixComponents.map((c, i) => (
                <div key={i} className="tintas-tablet__line-card grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Componente (tinta base)</Label>
                    <div className="mt-1 flex items-center gap-2">
                      {c.material_id ? (
                        <TintaColorSwatch
                          name={materialName(tintaMaterials, c.material_id)}
                          size="md"
                        />
                      ) : null}
                      <select
                        className="flex h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base"
                        value={c.material_id}
                        onChange={(e) =>
                          setMixComponents((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, material_id: e.target.value } : r,
                            ),
                          )
                        }
                      >
                        <option value="">Seleccione…</option>
                        {tintaMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="tintas-tablet__kg-field">
                    <Label>Cantidad (kg)</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      className="mt-1"
                      value={c.quantity}
                      onChange={(e) =>
                        setMixComponents((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-11"
                onClick={() =>
                  setMixComponents((rows) => [...rows, { material_id: "", quantity: "" }])
                }
              >
                + Añadir componente
              </Button>
              <div>
                <Label htmlFor="mix-notes">Notas de la receta</Label>
                <Textarea
                  id="mix-notes"
                  className="mt-1 min-h-20 text-base"
                  value={mixNotes}
                  onChange={(e) => setMixNotes(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="lg"
                className="tintas-tablet__primary w-full"
                disabled={saving}
                onClick={() => void saveMezcla()}
              >
                <Save className="mr-2 h-5 w-5" aria-hidden />
                {saving ? "Enviando…" : "Enviar mezcla"}
              </Button>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
