"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { TintasPaneHead } from "@/components/axones/TintasPaneHead"
import { cn } from "@/lib/utils"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SEGMENT_TYPES = ["mount", "demount", "production", "downtime"] as const

const MOUNT_OVER_SECONDS = 3600
const SCRAP_WARN_PERCENT = 10

function segmentLabel(t: string): string {
  if (t === "mount") return "Montaje"
  if (t === "demount") return "Desmontaje"
  if (t === "production") return "Producción"
  if (t === "downtime") return "Tiempo muerto"
  return t
}

const CHEMICAL_LABELS: Record<string, string> = {
  alcohol: "Alcohol",
  metoxil: "Metoxil",
  npa: "NPA",
}

function chemicalLabel(type: string): string {
  return CHEMICAL_LABELS[type] ?? type
}

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":")
}

type OpenSeg = {
  id: number
  segment_type: string
  started_at: string
  ended_at: string | null
  user?: { name?: string }
}

type AreaPath = "montaje" | "printing" | "laminacion" | "corte" | "tintas"

function supportsInkConsumables(areaPath: AreaPath): boolean {
  return areaPath === "printing" || areaPath === "tintas"
}

export type ProductionAreaPanelProps = {
  workOrderId: number
  title: string
  areaPath: AreaPath
  /** montaje usa material_usages; el resto bobina_usages */
  usageMode: "montaje" | "bobina" | "none"
  /** Solo laminación: campos de solvente en resumen */
  laminacionSolvent?: boolean
  /** Layout premium unificado (solo área tintas). */
  presentation?: "default" | "tintas-premium"
  /** Columna derecha: formulario de mezcla. */
  mixColumn?: ReactNode
}

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

export function ProductionAreaPanel({
  workOrderId,
  title,
  areaPath,
  usageMode,
  laminacionSolvent,
  presentation = "default",
  mixColumn,
}: ProductionAreaPanelProps) {
  const base = `work-orders/${workOrderId}/${areaPath}`
  /** El área Tintas no registra tiempos MES en planta. */
  const showTimer = areaPath !== "tintas"
  const tintasPremium = presentation === "tintas-premium" && areaPath === "tintas"

  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<Record<string, unknown> | null>(null)
  const [tick, setTick] = useState(0)

  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [tintaMaterials, setTintaMaterials] = useState<MaterialRow[]>([])

  const [machineCode, setMachineCode] = useState("")
  const [startNotes, setStartNotes] = useState("")

  const [matId, setMatId] = useState("")
  const [bobinaId, setBobinaId] = useState("")
  const [qtyUsed, setQtyUsed] = useState("")
  const [qtyFinished, setQtyFinished] = useState("")
  const [usageNotes, setUsageNotes] = useState("")

  const [montajeQty, setMontajeQty] = useState("")
  const [montajeUnit, setMontajeUnit] = useState("kg")

  const [scrapPct, setScrapPct] = useState("")
  const [summaryNotes, setSummaryNotes] = useState("")
  const [solventKg, setSolventKg] = useState("")
  const [solventNotes, setSolventNotes] = useState("")

  const [inkLines, setInkLines] = useState<InkLineDraft[]>([])
  const [chemRows, setChemRows] = useState<ChemDraft[]>([
    { chemical_type: "alcohol", quantity_loaded_kg: "", quantity_return_kg: "", notes: "" },
    { chemical_type: "metoxil", quantity_loaded_kg: "", quantity_return_kg: "", notes: "" },
    { chemical_type: "npa", quantity_loaded_kg: "", quantity_return_kg: "", notes: "" },
  ])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Record<string, unknown>>(base)
      setState(data)
      const summ = data.summary as Record<string, unknown> | null | undefined
      if (summ) {
        setScrapPct(
          summ.scrap_percent != null ? String(summ.scrap_percent) : "",
        )
        setSummaryNotes(
          typeof summ.notes === "string" ? summ.notes : "",
        )
        if (laminacionSolvent) {
          setSolventKg(
            summ.solvent_quantity_kg != null
              ? String(summ.solvent_quantity_kg)
              : "",
          )
          setSolventNotes(
            typeof summ.solvent_notes === "string" ? summ.solvent_notes : "",
          )
        }
      }
      if (supportsInkConsumables(areaPath)) {
        const inks = (data.ink_control_lines as unknown[]) ?? []
        setInkLines(
          inks.length
            ? (inks as Record<string, unknown>[]).map((row) => ({
                material_id: String(row.material_id ?? ""),
                quantity_original_kg: String(row.quantity_original_kg ?? ""),
                quantity_solventada_kg: String(
                  row.quantity_solventada_kg ?? "",
                ),
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
              quantity_loaded_kg: c
                ? String(c.quantity_loaded_kg ?? "")
                : "",
              quantity_return_kg: c
                ? String(c.quantity_return_kg ?? "")
                : "",
              notes: c && typeof c.notes === "string" ? c.notes : "",
            }
          }),
        )
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error(`No se pudo cargar ${title}.`)
      setState(null)
    } finally {
      setLoading(false)
    }
  }, [base, title, areaPath, laminacionSolvent])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const [mat, tin] = await Promise.all([
          apiFetch<LaravelPaginated<MaterialRow>>("materials", {
            query: { inventory_area: "material", per_page: 200, page: 1 },
          }),
          apiFetch<LaravelPaginated<MaterialRow>>("materials", {
            query: { per_page: 300, page: 1 },
          }),
        ])
        if (c) return
        const tintas = tin.data.filter(
          (m) =>
            m.inventory_area === "tintas" ||
            m.inventory_area === "cementerio_tintas",
        )
        setMaterials(mat.data)
        setTintaMaterials(tintas)
      } catch {
        if (!c) {
          setMaterials([])
          setTintaMaterials([])
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    if (!showTimer) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [showTimer])

  const openSeg = state?.open_time_segment as OpenSeg | null | undefined
  const totals = state?.time_totals_seconds as
    | Record<string, string>
    | undefined

  let openElapsedSec = 0
  if (openSeg?.started_at && !openSeg.ended_at) {
    const start = new Date(openSeg.started_at).getTime()
    openElapsedSec = Math.max(0, Math.floor((Date.now() - start) / 1000))
  }

  const mountOver =
    openSeg &&
    openSeg.segment_type === "mount" &&
    openElapsedSec > MOUNT_OVER_SECONDS

  const scrapVal = Number(scrapPct)
  const scrapHigh =
    Number.isFinite(scrapVal) && scrapVal >= SCRAP_WARN_PERCENT

  async function startSegment(t: (typeof SEGMENT_TYPES)[number]) {
    try {
      await apiFetch(`${base}/time-segments/start`, {
        method: "POST",
        body: JSON.stringify({
          segment_type: t,
          machine_code: machineCode.trim() || null,
          notes: startNotes.trim() || null,
        }),
      })
      toast.success(`Segmento: ${segmentLabel(t)}`)
      setStartNotes("")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo iniciar el temporizador.")
    }
  }

  async function stopSegment() {
    if (!openSeg?.id) return
    try {
      await apiFetch(
        `${base}/time-segments/${openSeg.id}/stop`,
        { method: "POST", body: JSON.stringify({}) },
      )
      toast.success("Segmento cerrado.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo detener el segmento.")
    }
  }

  async function submitUsage() {
    if (usageMode === "none") return
    if (usageMode === "montaje") {
      const mid = Number(matId)
      const q = Number(montajeQty)
      if (!Number.isFinite(mid) || mid < 1) {
        toast.error("Seleccione material.")
        return
      }
      if (!Number.isFinite(q) || q <= 0) {
        toast.error("Indique cantidad.")
        return
      }
      try {
        await apiFetch(`${base}/material-usages`, {
          method: "POST",
          body: JSON.stringify({
            material_id: mid,
            quantity: q,
            unit: montajeUnit.trim() || "kg",
            notes: usageNotes.trim() || null,
          }),
        })
        toast.success("Uso de material registrado.")
        setMontajeQty("")
        setUsageNotes("")
        void load()
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo registrar.")
      }
      return
    }

    const mid = Number(matId)
    const u = Number(qtyUsed)
    if (!Number.isFinite(mid) || mid < 1) {
      toast.error("Seleccione material.")
      return
    }
    if (!Number.isFinite(u) || u <= 0) {
      toast.error("Indique kg usados.")
      return
    }
    const body: Record<string, unknown> = {
      material_id: mid,
      quantity_used_kg: u,
      quantity_finished_kg: qtyFinished.trim()
        ? Number(qtyFinished)
        : null,
      notes: usageNotes.trim() || null,
    }
    const bid = bobinaId.trim() ? Number(bobinaId) : null
    if (bid && Number.isFinite(bid)) body.bobina_id = bid

    try {
      await apiFetch(`${base}/bobina-usages`, {
        method: "POST",
        body: JSON.stringify(body),
      })
      toast.success("Uso por bobina registrado.")
      setQtyUsed("")
      setQtyFinished("")
      setBobinaId("")
      setUsageNotes("")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar.")
    }
  }

  async function saveSummary() {
    const body: Record<string, unknown> = {
      scrap_percent: scrapPct.trim() ? Number(scrapPct) : null,
      notes: summaryNotes.trim() || null,
    }
    if (laminacionSolvent) {
      body.solvent_quantity_kg = solventKg.trim() ? Number(solventKg) : null
      body.solvent_notes = solventNotes.trim() || null
    }
    try {
      await apiFetch(`${base}/summary`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      toast.success("Resumen guardado.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar el resumen.")
    }
  }

  async function saveConsumables() {
    if (!supportsInkConsumables(areaPath)) return
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
    try {
      const consumablesPath =
        areaPath === "tintas"
          ? `work-orders/${workOrderId}/tintas/consumables`
          : `work-orders/${workOrderId}/printing/consumables`
      await apiFetch(consumablesPath, {
        method: "PUT",
        body: JSON.stringify({ ink_lines, chemical_usages }),
      })
      toast.success("Consumo de tintas y químicos guardado.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar consumibles.")
    }
  }

  const recent = (state?.time_segments_recent as OpenSeg[]) ?? []

  const inkConsumablesBlock =
    supportsInkConsumables(areaPath) && state ? (
      <>
        {tintasPremium ? (
          <TintasPaneHead
            variant="consumo"
            title="Consumo de tintas y químicos"
            description="Registre tintas del almacén o cementerio y los químicos de la OT. Al guardar se reemplazan todas las líneas de consumo."
          />
        ) : null}
        {!tintasPremium ? (
          <p className="text-muted-foreground text-xs">
            Registre tintas del almacén o cementerio y los químicos de la OT. Al guardar se
            reemplazan todas las líneas de consumo.
          </p>
        ) : null}
        {inkLines.map((L, i) => (
          <div
            key={i}
            className={cn(
              "grid gap-2 rounded-lg border p-3 md:grid-cols-12",
              tintasPremium && "tintas-ink-row",
            )}
          >
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
                      j === i ? { ...r, quantity_solventada_kg: ev.target.value } : r,
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
        <div className="space-y-2">
          <p className="text-sm font-medium">Químicos</p>
          {chemRows.map((r, i) => (
            <div
              key={r.chemical_type}
              className={cn(
                "grid gap-2 rounded-md border p-2 md:grid-cols-4",
                tintasPremium && "tintas-chem-row",
              )}
            >
              <div className="font-medium">{chemicalLabel(r.chemical_type)}</div>
              <Input
                placeholder="Cargado kg"
                inputMode="decimal"
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
                value={r.notes}
                onChange={(ev) =>
                  setChemRows((rows) =>
                    rows.map((x, j) => (j === i ? { ...x, notes: ev.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          className={cn(tintasPremium && "tintas-save-consumo")}
          onClick={() => void saveConsumables()}
        >
          Guardar consumo
        </Button>
      </>
    ) : null

  const summaryBlock =
    state ? (
      <>
        {!tintasPremium ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de área</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>% Merma</Label>
                  <Input
                    inputMode="decimal"
                    value={scrapPct}
                    onChange={(ev) => setScrapPct(ev.target.value)}
                  />
                </div>
                {laminacionSolvent ? (
                  <div className="grid gap-2">
                    <Label>Solvente (kg)</Label>
                    <Input
                      inputMode="decimal"
                      value={solventKg}
                      onChange={(ev) => setSolventKg(ev.target.value)}
                    />
                  </div>
                ) : null}
              </div>
              {laminacionSolvent ? (
                <div className="grid gap-2">
                  <Label>Notas solvente</Label>
                  <Textarea
                    rows={2}
                    value={solventNotes}
                    onChange={(ev) => setSolventNotes(ev.target.value)}
                  />
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label>Notas generales</Label>
                <Textarea
                  rows={3}
                  value={summaryNotes}
                  onChange={(ev) => setSummaryNotes(ev.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => void saveSummary()}>
                Guardar resumen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="tintas-workspace__summary-inner space-y-3">
            <p className="text-sm font-semibold text-violet-950/90">Resumen de área</p>
            <div className="grid gap-3 lg:grid-cols-[minmax(8rem,10rem)_1fr_auto] lg:items-end">
              <div className="grid gap-2">
                <Label className="text-xs">% Merma</Label>
                <Input
                  inputMode="decimal"
                  className="h-9 bg-white/90"
                  value={scrapPct}
                  onChange={(ev) => setScrapPct(ev.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Notas generales</Label>
                <Textarea
                  rows={2}
                  className="min-h-[2.5rem] resize-y bg-white/90"
                  value={summaryNotes}
                  onChange={(ev) => setSummaryNotes(ev.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-9 shrink-0 border-violet-200 bg-white/90"
                onClick={() => void saveSummary()}
              >
                Guardar resumen
              </Button>
            </div>
          </div>
        )}
      </>
    ) : null

  if (tintasPremium) {
    return (
      <>
        {scrapHigh ? (
          <Alert variant="destructive" className="mx-4 mt-3 rounded-lg">
            <AlertTitle>Merma elevada</AlertTitle>
            <AlertDescription>
              El % de merma registrado ({scrapVal}%) alcanza o supera el umbral de aviso (
              {SCRAP_WARN_PERCENT}%).
            </AlertDescription>
          </Alert>
        ) : null}
        {loading && !state ? (
          <p className="text-muted-foreground px-5 py-8 text-center text-sm">Cargando…</p>
        ) : null}
        {state ? (
          <>
            <div className="tintas-workspace__main">
              <div className="tintas-workspace__pane tintas-workspace__pane--consumo space-y-4">
                {inkConsumablesBlock}
              </div>
              <div className="tintas-workspace__pane tintas-workspace__pane--mezcla">
                {mixColumn}
              </div>
            </div>
            <div className="tintas-workspace__summary">{summaryBlock}</div>
          </>
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          Actualizar
        </Button>
      </div>

      {showTimer && mountOver ? (
        <Alert variant="destructive">
          <AlertTitle>Montaje prolongado</AlertTitle>
          <AlertDescription>
            El segmento de montaje supera {MOUNT_OVER_SECONDS / 3600} h (
            {formatHms(openElapsedSec)}). Revise la OT o cierre el temporizador.
          </AlertDescription>
        </Alert>
      ) : null}

      {scrapHigh ? (
        <Alert variant="destructive">
          <AlertTitle>Merma elevada</AlertTitle>
          <AlertDescription>
            El % de merma registrado ({scrapVal}%) alcanza o supera el umbral
            de aviso ({SCRAP_WARN_PERCENT}%). Verifique calidad y proceso.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !state ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : null}

      {state ? (
        <>
          {showTimer ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["mount", "production", "downtime"] as const).map((k) => (
                  <Card key={k}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Tiempo {segmentLabel(k)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="font-mono text-lg">
                      {formatHms(Number(totals?.[k] ?? 0))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Temporizador</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {openSeg && !openSeg.ended_at ? (
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <p className="text-sm font-medium">
                        Activo: {segmentLabel(openSeg.segment_type)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Desde {openSeg.started_at} · Operador:{" "}
                        {openSeg.user?.name ?? "—"}
                      </p>
                      <p className="mt-2 font-mono text-2xl tabular-nums">
                        {formatHms(openElapsedSec)}
                      </p>
                      <Button
                        type="button"
                        className="mt-3"
                        variant="destructive"
                        size="sm"
                        onClick={() => void stopSegment()}
                      >
                        Detener segmento
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No hay segmento abierto. Inicie montaje, desmontaje, producción o tiempo
                      muerto.
                    </p>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Código máquina (opcional)</Label>
                      <Input
                        value={machineCode}
                        onChange={(ev) => setMachineCode(ev.target.value)}
                        placeholder="ej. IMP-01"
                      />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Notas al iniciar</Label>
                      <Input
                        value={startNotes}
                        onChange={(ev) => setStartNotes(ev.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {SEGMENT_TYPES.map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(openSeg && !openSeg.ended_at)}
                        onClick={() => void startSegment(t)}
                      >
                        Iniciar {segmentLabel(t)}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Últimos segmentos de tiempo
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead>Usuario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.slice(0, 20).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{segmentLabel(r.segment_type)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {String(r.started_at ?? "").slice(0, 19)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.ended_at
                              ? String(r.ended_at).slice(0, 19)
                              : "…"}
                          </TableCell>
                          <TableCell>{r.user?.name ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}

          {usageMode !== "none" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {usageMode === "montaje"
                    ? "Material usado en montaje"
                    : "Material por bobina"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2 md:col-span-2">
                  <Label>Material</Label>
                  <Select value={matId} onValueChange={setMatId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.sku} — {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {usageMode === "montaje" ? (
                  <>
                    <div className="grid gap-2">
                      <Label>Cantidad</Label>
                      <Input
                        inputMode="decimal"
                        value={montajeQty}
                        onChange={(ev) => setMontajeQty(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Unidad</Label>
                      <Input
                        value={montajeUnit}
                        onChange={(ev) => setMontajeUnit(ev.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label>Kg usados</Label>
                      <Input
                        inputMode="decimal"
                        value={qtyUsed}
                        onChange={(ev) => setQtyUsed(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Kg terminados (opc.)</Label>
                      <Input
                        inputMode="decimal"
                        value={qtyFinished}
                        onChange={(ev) => setQtyFinished(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Bobina ID (opc.)</Label>
                      <Input
                        inputMode="numeric"
                        value={bobinaId}
                        onChange={(ev) => setBobinaId(ev.target.value)}
                        placeholder="ID entidad bobina"
                      />
                    </div>
                  </>
                )}
                <div className="grid gap-2 md:col-span-3">
                  <Label>Notas</Label>
                  <Input
                    value={usageNotes}
                    onChange={(ev) => setUsageNotes(ev.target.value)}
                  />
                </div>
              </div>
              <Button type="button" onClick={() => void submitUsage()}>
                Registrar uso
              </Button>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageMode === "montaje"
                      ? (
                          (state.material_usages as Record<string, unknown>[]) ??
                          []
                        ).map((u) => (
                          <TableRow key={String(u.id)}>
                            <TableCell>
                              {(u.material as { sku?: string; name?: string })
                                ?.sku ?? "—"}{" "}
                              ·{" "}
                              {(u.material as { name?: string })?.name ?? ""}
                            </TableCell>
                            <TableCell>
                              {String(u.quantity ?? "")}{" "}
                              {String(u.unit ?? "")}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {String(u.notes ?? "")}
                            </TableCell>
                          </TableRow>
                        ))
                      : (
                          (state.bobina_usages as Record<string, unknown>[]) ??
                          []
                        ).map((u) => (
                          <TableRow key={String(u.id)}>
                            <TableCell>
                              {(u.material as { sku?: string })?.sku ?? "—"}
                            </TableCell>
                            <TableCell>
                              uso {String(u.quantity_used_kg ?? "")} · fin{" "}
                              {String(u.quantity_finished_kg ?? "—")}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {String(u.notes ?? "")}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
              </CardContent>
            </Card>
          ) : null}

          {inkConsumablesBlock ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {areaPath === "tintas"
                    ? "Consumo de tintas y químicos"
                    : "Tintas, cementerio y químicos (impresión)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">{inkConsumablesBlock}</CardContent>
            </Card>
          ) : null}

          {summaryBlock}
        </>
      ) : null}
      {showTimer ? <span className="sr-only">{tick}</span> : null}
    </div>
  )
}
