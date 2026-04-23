"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ClipboardCheck,
  ClipboardList,
  Droplets,
  Layers,
  NotebookPen,
  Package,
  Palette,
  Printer,
  ReceiptText,
  Scissors,
  Wrench,
} from "./ot-planilla-icons"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WindingFigurePicker } from "./WindingFigurePicker"
import "./work-order-planilla.css"

type MachineValue =
  | ""
  | "COMEXI 1"
  | "COMEXI 2"
  | "COMEXI 3"
  | "NEXUS"
  | "NEXUS 2"
  | "Cortadora China"
  | "Cortadora Permaco"
  | "Cortadora Novograf"

const MACHINE_OPTIONS: Array<{
  group: string
  options: Array<{ value: Exclude<MachineValue, "">; label: string }>
}> = [
  {
    group: "Impresion",
    options: [
      { value: "COMEXI 1", label: "COMEXI 1 (Planchas 067)" },
      { value: "COMEXI 2", label: "COMEXI 2" },
      { value: "COMEXI 3", label: "COMEXI 3 (Planchas 045)" },
    ],
  },
  {
    group: "Laminacion",
    options: [
      { value: "NEXUS", label: "NEXUS (Principal)" },
      { value: "NEXUS 2", label: "NEXUS 2" },
    ],
  },
  {
    group: "Corte",
    options: [
      { value: "Cortadora China", label: "Cortadora China" },
      { value: "Cortadora Permaco", label: "Cortadora Permaco" },
      { value: "Cortadora Novograf", label: "Cortadora Novograf" },
    ],
  },
]

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  document_number?: string | null
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

type SustratoRow = { material_id: string; kg: string }

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v
  return ""
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  return { ...prefill, ...(form ?? {}) }
}

function normalizeTipoImpresion(v: unknown): "" | "superficie" | "reverso" {
  const s = readString(v).toLowerCase().trim()
  if (s === "superficie" || s === "superf") return "superficie"
  if (s === "reverso") return "reverso"
  return ""
}

function setKey(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  key: string,
  value: unknown,
) {
  setForm((prev) => ({ ...prev, [key]: value }))
}

function getSustratosLam(form: Record<string, unknown>): SustratoRow[] {
  const raw = form.sustratosVirgenLam
  if (!Array.isArray(raw)) return [{ material_id: "", kg: "" }]
  const out: SustratoRow[] = raw
    .map((r) => {
      const o = r as Record<string, unknown>
      return { material_id: readString(o.material_id), kg: readNumberString(o.kg) }
    })
    .filter((r) => r.material_id !== "" || r.kg !== "")
  return out.length ? out : [{ material_id: "", kg: "" }]
}

function setSustratosLam(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  rows: SustratoRow[],
) {
  setForm((prev) => ({ ...prev, sustratosVirgenLam: rows }))
}

/** Sustratos virgen en impresión (repetible; p. ej. trilaminado). */
function getSustratosImp(form: Record<string, unknown>): SustratoRow[] {
  const raw = form.sustratosVirgenImp
  if (Array.isArray(raw)) {
    const out: SustratoRow[] = raw
      .map((r) => {
        const o = r as Record<string, unknown>
        return { material_id: readString(o.material_id), kg: readNumberString(o.kg) }
      })
      .filter((r) => r.material_id !== "" || r.kg !== "")
    if (out.length) return out
  }
  const mid = readString(form.sustratoVirgenImp1)
  const kg = readNumberString(form.kgUtilizarImp1)
  if (mid || kg) return [{ material_id: mid, kg }]
  return [{ material_id: "", kg: "" }]
}

function setSustratosImp(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  rows: SustratoRow[],
) {
  setForm((prev) => ({ ...prev, sustratosVirgenImp: rows }))
}

export default function WorkOrderPlanillaPage() {
  const nav = useNavigate()
  const { woId } = useParams<{ woId: string }>()
  const id = Number(woId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})

  const [materials, setMaterials] = useState<MaterialRow[]>([])

  const loadMaterials = useCallback(async () => {
    try {
      const data = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { inventory_area: "material", per_page: 200, page: 1 },
      })
      setMaterials(data.data ?? [])
    } catch {
      setMaterials([])
    }
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id < 1) return
    setLoading(true)
    try {
      const payload = await apiFetch<OrdenTrabajoPayload>(
        `work-orders/${id}/orden-trabajo`,
      )
      setPrefill(payload.prefill ?? {})
      const merged = mergePrefill(payload.prefill ?? {}, payload.form)
      if (!Array.isArray(merged.sustratosVirgenImp)) {
        const mid = readString(merged.sustratoVirgenImp1)
        const kg = readNumberString(merged.kgUtilizarImp1)
        if (mid || kg) merged.sustratosVirgenImp = [{ material_id: mid, kg }]
      }
      setForm(merged)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la orden de trabajo.")
      setPrefill({})
      setForm({})
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
    void loadMaterials()
  }, [load, loadMaterials])

  const tipoImpresion = useMemo(
    () => normalizeTipoImpresion(form.tipoImpresionEstructura ?? form.tipoImpresion),
    [form.tipoImpresionEstructura, form.tipoImpresion],
  )

  const maquina = readString(form.maquina) as MachineValue
  const showPlanchas = maquina === "COMEXI 1" || maquina === "COMEXI 3"

  const sustratosLam = useMemo(() => getSustratosLam(form), [form])
  const sustratosImp = useMemo(() => getSustratosImp(form), [form])

  async function guardar() {
    if (!Number.isFinite(id) || id < 1) return
    setSaving(true)
    try {
      const rowsImp = getSustratosImp(form)
      const formOut: Record<string, unknown> = {
        ...form,
        sustratosVirgenImp: rowsImp,
        sustratoVirgenImp1: rowsImp[0]?.material_id ?? "",
        kgUtilizarImp1: rowsImp[0]?.kg ?? "",
      }
      await apiFetch(`work-orders/${id}/orden-trabajo`, {
        method: "PUT",
        body: JSON.stringify({ form: formOut }),
      })
      toast.success("Orden guardada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar la orden.")
    } finally {
      setSaving(false)
    }
  }

  function limpiar() {
    // Mantener precarga (cliente/producto/pedido) y limpiar el resto.
    const base = { ...prefill }
    setForm(base)
    toast.message("Formulario limpiado.")
  }

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="p-6">
        <p className="text-destructive">ID inválido.</p>
        <Link to="/axones/ordenes-trabajo" className="underline">
          Volver
        </Link>
      </div>
    )
  }

  return (
    <div className="ax-ot p-2 sm:p-4 md:p-6">

      {/* Header (igual estilo “Ver órdenes / Imprimir / Limpiar / Guardar”) */}
      <div className="no-print mb-4 ax-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Orden de trabajo</h2>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Esta pantalla es la planilla digital de <span className="font-medium text-foreground">esta</span> orden. Edita los campos que
            correspondan y, cuando quieras guardar los cambios en el servidor, pulsa{" "}
            <span className="font-medium text-foreground">Guardar orden</span> (arriba o al final del formulario).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => nav("/axones/ordenes-trabajo?tab=lista")}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Ver órdenes
          </Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button type="button" variant="outline" onClick={() => limpiar()} disabled={loading}>
            Limpiar
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={saving || loading}>
            {saving ? "Guardando…" : "Guardar orden"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void guardar()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
              e.preventDefault()
            }
          }}
        >
          <div className="ax-section mb-3">
            <div className="ax-section__header ax-hdr-brand justify-center">
              <div className="ax-section__headerLeft">
                <strong>ORDEN DE TRABAJO</strong>
              </div>
            </div>
          </div>

          {/* Row: Cabecera OC + datos producto */}
          <div className="ot-section">
            <div className="ot-two-col">
              {/* Cabecera vinculada a la orden de cliente */}
              <div>
                <div className="section-header">
                  <span className="inline-flex items-center gap-2">
                    <ReceiptText className="h-4 w-4" />
                    CABECERA (ORDEN DE CLIENTE)
                  </span>
                </div>
                <div className="section-body">
                  <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
                    <span className="font-medium text-foreground">Maestro</span> = datos de cliente o producto del sistema.{" "}
                    <span className="font-medium text-foreground">Inventario</span> = elige material en bodega. En figura de embobinado, los
                    botones 1–8 son atajos; el cuadrito es solo una vista previa.
                  </p>
                  <div className="ot-grid ot-cols-3">
                    <div className="ot-field">
                      <label className="ot-label required">Fecha</label>
                      <input
                        type="date"
                        className="ot-input"
                        value={readString(form.fechaOrden) || readString(prefill.fechaOrden)}
                        onChange={(ev) => setKey(setForm, "fechaOrden", ev.target.value)}
                      />
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">N° Orden</label>
                      <input
                        className="ot-input"
                        readOnly
                        value={readString(form.numeroOrden) || readString(prefill.numeroOrden) || readString(form.document_number) || ""}
                        onChange={() => {}}
                      />
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Cantidad solicitada (Kg)</label>
                      <input
                        type="number"
                        className="ot-input"
                        step="0.01"
                        min="0"
                        value={readNumberString(form.pedidoKg) || readNumberString(prefill.pedidoKg)}
                        onChange={(ev) => setKey(setForm, "pedidoKg", ev.target.value)}
                      />
                    </div>
                  </div>

                  <div className="ot-grid ot-cols-2">
                    <div className="ot-field">
                      <label className="ot-label required">Maquina</label>
                      <select
                        className="ot-select"
                        value={maquina}
                        onChange={(ev) => setKey(setForm, "maquina", ev.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        {MACHINE_OPTIONS.map((g) => (
                          <optgroup key={g.group} label={g.group}>
                            {g.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Metros Est.</label>
                      <input
                        className="ot-input"
                        value={readNumberString(form.metrosEstimados) || "-"}
                        onChange={(ev) => setKey(setForm, "metrosEstimados", ev.target.value)}
                      />
                    </div>
                  </div>

                  {showPlanchas ? (
                    <div className="ot-grid ot-cols-1">
                      <div className="ot-field">
                        <label className="ot-label">Planchas</label>
                        <input
                          className="ot-input"
                          value={readString(form.planchas)}
                          onChange={(ev) => setKey(setForm, "planchas", ev.target.value)}
                          placeholder="Ej: 067"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Datos del producto */}
              <div>
                <div className="section-header">
                  <span className="inline-flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    DATOS DEL PRODUCTO
                  </span>
                </div>
                <div className="section-body">
                  <div className="ot-grid ot-cols-2-asym">
                    <div className="ot-field">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="ot-label !font-black required">Cliente</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input
                        readOnly
                        className="ot-input-unified h-9 bg-muted/50 text-sm"
                        value={readString(form.cliente) || readString(prefill.cliente)}
                      />
                    </div>
                    <div className="ot-field">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="ot-label !font-black">RIF</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input
                        readOnly
                        className="ot-input-unified h-9 bg-muted/50 text-sm"
                        value={readString(form.clienteRif) || readString(prefill.clienteRif)}
                      />
                    </div>
                  </div>

                  <div className="ot-grid ot-cols-2-asym">
                    <div className="ot-field">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="ot-label !font-black required">Producto</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input
                        readOnly
                        className="ot-input-unified h-9 bg-muted/50 text-sm"
                        value={readString(form.producto) || readString(prefill.producto)}
                      />
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Tipo Impresion</label>
                      <select
                        className="ot-select"
                        value={tipoImpresion}
                        onChange={(ev) => setKey(setForm, "tipoImpresionEstructura", ev.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="superficie">Superficie</option>
                        <option value="reverso">Reverso</option>
                      </select>
                    </div>
                  </div>

                  {tipoImpresion === "superficie" ? (
                    <div className="ot-grid ot-cols-1">
                      <div className="ot-field">
                        <label className="ot-label">Estructura (1 capa)</label>
                        <input
                          className="ot-input"
                          value={readString(form.estructuraCapa1) || readString(prefill.estructuraMaterial)}
                          onChange={(ev) => setKey(setForm, "estructuraCapa1", ev.target.value)}
                          placeholder="Ej: BOPP NORMAL"
                        />
                      </div>
                    </div>
                  ) : null}

                  {tipoImpresion === "reverso" ? (
                    <div className="ot-grid ot-cols-3">
                      <div className="ot-field">
                        <label className="ot-label">Capa 1</label>
                        <input
                          className="ot-input"
                          value={readString(form.estructuraCapa1Rev)}
                          onChange={(ev) => setKey(setForm, "estructuraCapa1Rev", ev.target.value)}
                          placeholder="Ej: BOPP NORMAL"
                        />
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Capa 2</label>
                        <input
                          className="ot-input"
                          value={readString(form.estructuraCapa2Rev)}
                          onChange={(ev) => setKey(setForm, "estructuraCapa2Rev", ev.target.value)}
                          placeholder="Ej: CAST"
                        />
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Capa 3</label>
                        <input
                          className="ot-input"
                          value={readString(form.estructuraCapa3Rev)}
                          onChange={(ev) => setKey(setForm, "estructuraCapa3Rev", ev.target.value)}
                          placeholder="Ej: PEBD"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="ot-grid ot-cols-3">
                    <div className="ot-field">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="ot-label !font-black">C.P.E.</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input readOnly className="ot-input-unified h-9 bg-muted/50 text-sm" value={readString(prefill.cpe)} />
                    </div>
                    <div className="ot-field">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="ot-label !font-black">M.P.P.S.</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input readOnly className="ot-input-unified h-9 bg-muted/50 text-sm" value={readString(prefill.mpps)} />
                    </div>
                    <div className="ot-field">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="ot-label !font-black">Cod. Barra</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input readOnly className="ot-input-unified h-9 bg-muted/50 text-sm" value={readString(prefill.codigoBarra)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Montaje */}
          <div className="ot-section">
            <div className="section-header">
              <span className="inline-flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                AREA DE MONTAJE
              </span>
            </div>
            <div className="section-body">
              <div className="ot-grid ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Frecuencia (mm)</label>
                  <input className="ot-input" value={readString(form.frecuencia)} onChange={(e) => setKey(setForm,"frecuencia",e.target.value)} placeholder="250±2" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">N° Bandas</label>
                  <input className="ot-input" value={readString(form.numBandas)} onChange={(e) => setKey(setForm,"numBandas",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Tipo Impresion</label>
                  <input className="ot-input" value={readString(form.tipoImpresionMontaje)} onChange={(e) => setKey(setForm,"tipoImpresionMontaje",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Ancho Corte (mm)</label>
                  <input className="ot-input" value={readString(form.anchoCorteMontaje)} onChange={(e) => setKey(setForm,"anchoCorteMontaje",e.target.value)} placeholder="330±2" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">N° Repeticion o Frecuencia</label>
                  <input className="ot-input" value={readString(form.numRepeticion)} onChange={(e) => setKey(setForm,"numRepeticion",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Desarrollo (mm) (auto)</label>
                  <input className="ot-input" value={readString(form.desarrollo)} onChange={(e) => setKey(setForm,"desarrollo",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Ancho Montaje (mm) (auto)</label>
                  <input className="ot-input" value={readString(form.anchoMontaje)} onChange={(e) => setKey(setForm,"anchoMontaje",e.target.value)} placeholder="Ancho montaje" />
                </div>
                <div className="ot-field sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="ot-label">Figura embobinado (1-8 o libre)</label>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                      title="Botones 1–8 = atajo. El cuadro pequeño es solo vista previa del valor (no guarda nada aparte)."
                    >
                      Figura
                    </Badge>
                  </div>
                  <WindingFigurePicker
                    value={readString(form.figuraEmbobinadoMontaje)}
                    onChange={(v) => setKey(setForm, "figuraEmbobinadoMontaje", v)}
                  />
                </div>
                <div className="ot-field">
                  <label className="ot-label">N° Colores</label>
                  <input className="ot-input" value={readString(form.numColores)} onChange={(e) => setKey(setForm,"numColores",e.target.value)} />
                </div>
              </div>
              <div className="ot-grid ot-cols-1">
                <div className="ot-field">
                  <label className="ot-label">Observaciones montaje</label>
                  <input className="ot-input" value={readString(form.obsMontaje)} onChange={(e) => setKey(setForm,"obsMontaje",e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Impresión */}
          <div className="ot-section">
            <div className="section-header">
              <span className="inline-flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                AREA DE IMPRESION
              </span>
            </div>
            <div className="section-body">
              <div className="ot-grid ot-cols-3">
                <div className="ot-field">
                  <label className="ot-label">Piñon (dientes)</label>
                  <input className="ot-input" value={readString(form.pinonImp)} onChange={(e) => setKey(setForm,"pinonImp",e.target.value)} placeholder="Ej: 840" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Linea de corte</label>
                  <input className="ot-input" value={readString(form.lineaCorte)} onChange={(e) => setKey(setForm,"lineaCorte",e.target.value)} />
                </div>
                <div className="ot-field sm:col-span-2 lg:col-span-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="ot-label">Figura emb. (1-8)</label>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                      title="Botones 1–8 = atajo. El cuadro pequeño es solo vista previa del valor (no guarda nada aparte)."
                    >
                      Figura
                    </Badge>
                  </div>
                  <WindingFigurePicker
                    value={readString(form.figEmbImpDisplay)}
                    onChange={(v) => setKey(setForm, "figEmbImpDisplay", v)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ot-label">Sustratos virgen (inventario)</span>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Inventario
                  </Badge>
                </div>
                {sustratosImp.map((r, idx) => (
                  <div
                    key={idx}
                    className="ot-grid ot-cols-2-asym"
                  >
                    <div className="ot-field">
                      <label className="ot-label">{`Sustrato ${idx + 1}`}</label>
                      <select
                        className="ot-select"
                        value={r.material_id}
                        onChange={(e) => {
                          const next = [...sustratosImp]
                          next[idx] = { ...next[idx], material_id: e.target.value }
                          setSustratosImp(setForm, next)
                        }}
                      >
                        <option value="">Seleccionar del inventario...</option>
                        {materials.map((m) => (
                          <option key={m.id} value={String(m.id)}>
                            {m.sku} · {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Kg a utilizar</label>
                      <input
                        className="ot-input"
                        value={r.kg}
                        onChange={(e) => {
                          const next = [...sustratosImp]
                          next[idx] = { ...next[idx], kg: e.target.value }
                          setSustratosImp(setForm, next)
                        }}
                        placeholder="Ej: 430"
                      />
                    </div>
                  </div>
                ))}
                <div className="no-print">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSustratosImp(setForm, [...sustratosImp, { material_id: "", kg: "" }])
                    }
                  >
                    Agregar sustrato (p. ej. trilaminado)
                  </Button>
                </div>
              </div>

              <div className="ot-grid ot-metrics-before-nested ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg ingresado</label>
                  <input className="ot-input" value={readNumberString(form.kgIngresadoImp)} onChange={(e) => setKey(setForm,"kgIngresadoImp",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida</label>
                  <input className="ot-input" value={readNumberString(form.kgSalidaImp)} onChange={(e) => setKey(setForm,"kgSalidaImp",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Merma</label>
                  <input className="ot-input" value={readNumberString(form.mermaImp)} onChange={(e) => setKey(setForm,"mermaImp",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metros</label>
                  <input className="ot-input" value={readNumberString(form.metrosImp)} onChange={(e) => setKey(setForm,"metrosImp",e.target.value)} />
                </div>
              </div>

              <div className="ot-section">
                <div className="section-header">
                  <span className="inline-flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    DESCRIPCION DE TINTAS
                  </span>
                </div>
                <div className="section-body">
                  <div className="ot-tintas-wrap">
                  <table className="table-tintas">
                    <thead>
                      <tr>
                        <th>POSICION</th>
                        <th>COLOR</th>
                        <th>ANILOX</th>
                        <th>VISC (seg)</th>
                        <th>OBSERVACIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 8 }).map((_, idx) => {
                        const n = idx + 1
                        return (
                          <tr key={n}>
                            <td>{n}</td>
                            <td>
                              <input
                                value={readString((form as any)[`tintaColor${n}`])}
                                onChange={(e) => setKey(setForm, `tintaColor${n}`, e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                value={readString((form as any)[`tintaAnilox${n}`])}
                                onChange={(e) => setKey(setForm, `tintaAnilox${n}`, e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                value={readString((form as any)[`tintaVisc${n}`])}
                                onChange={(e) => setKey(setForm, `tintaVisc${n}`, e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                value={readString((form as any)[`tintaObs${n}`])}
                                onChange={(e) => setKey(setForm, `tintaObs${n}`, e.target.value)}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Laminación */}
          <div className="ot-section">
            <div className="section-header">
              <span className="inline-flex items-center gap-2">
                <Layers className="h-4 w-4" />
                AREA DE LAMINACION
              </span>
            </div>
            <div className="section-body">
              <div className="ot-grid ot-cols-4">
                <div className="ot-field sm:col-span-2 lg:col-span-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="ot-label">Figura embobinado</label>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                      title="Botones 1–8 = atajo. El cuadro pequeño es solo vista previa del valor (no guarda nada aparte)."
                    >
                      Figura
                    </Badge>
                  </div>
                  <WindingFigurePicker
                    value={readString(form.figuraEmbobinadoLam)}
                    onChange={(v) => setKey(setForm, "figuraEmbobinadoLam", v)}
                  />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Gramaje adhesivo (g/m2)</label>
                  <input className="ot-input" value={readString(form.gramajeAdhesivo)} onChange={(e) => setKey(setForm,"gramajeAdhesivo",e.target.value)} placeholder="1,5 a 2,0" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Relacion mezcla</label>
                  <input className="ot-input" value={readString(form.relacionMezcla)} onChange={(e) => setKey(setForm,"relacionMezcla",e.target.value)} placeholder="100/80" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Observaciones</label>
                  <input className="ot-input" value={readString(form.obsLaminacion)} onChange={(e) => setKey(setForm,"obsLaminacion",e.target.value)} />
                </div>
              </div>

              <div className="ot-grid ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg entrada</label>
                  <input className="ot-input" value={readNumberString(form.kgEntradaLam)} onChange={(e) => setKey(setForm,"kgEntradaLam",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida</label>
                  <input className="ot-input" value={readNumberString(form.kgSalidaLam)} onChange={(e) => setKey(setForm,"kgSalidaLam",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metraje</label>
                  <input className="ot-input" value={readNumberString(form.metrajeLam)} onChange={(e) => setKey(setForm,"metrajeLam",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Merma</label>
                  <input className="ot-input" value={readNumberString(form.mermaLam)} onChange={(e) => setKey(setForm,"mermaLam",e.target.value)} />
                </div>
              </div>

              <div className="ot-grid ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg entrada 2 (trilam.)</label>
                  <input className="ot-input" value={readNumberString(form.kgEntradaLam2)} onChange={(e) => setKey(setForm,"kgEntradaLam2",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida 2 (trilam.)</label>
                  <input className="ot-input" value={readNumberString(form.kgSalidaLam2)} onChange={(e) => setKey(setForm,"kgSalidaLam2",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metraje 2</label>
                  <input className="ot-input" value={readNumberString(form.metrajeLam2)} onChange={(e) => setKey(setForm,"metrajeLam2",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Merma 2</label>
                  <input className="ot-input" value={readNumberString(form.mermaLam2)} onChange={(e) => setKey(setForm,"mermaLam2",e.target.value)} />
                </div>
              </div>

              {/* Sección morada: sustratos virgen laminación (repetible) */}
              <div className="ot-section">
                <div className="section-header section-sublam">
                  <span className="inline-flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    SUSTRATOS VIRGEN A UTILIZAR (LAMINACION)
                  </span>
                </div>
                <div className="section-body">
                  {sustratosLam.map((r, idx) => (
                    <div
                      key={idx}
                      className="ot-grid ot-cols-2-asym ot-sustrato-lam"
                    >
                      <div className="ot-field">
                        <label className="ot-label">{`Sustrato ${idx + 1}`}</label>
                        <select
                          className="ot-select"
                          value={r.material_id}
                          onChange={(e) => {
                            const next = [...sustratosLam]
                            next[idx] = { ...next[idx], material_id: e.target.value }
                            setSustratosLam(setForm, next)
                          }}
                        >
                          <option value="">Seleccionar del inventario...</option>
                          {materials.map((m) => (
                            <option key={m.id} value={String(m.id)}>
                              {m.sku} · {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Kg a utilizar</label>
                        <input
                          className="ot-input"
                          value={r.kg}
                          onChange={(e) => {
                            const next = [...sustratosLam]
                            next[idx] = { ...next[idx], kg: e.target.value }
                            setSustratosLam(setForm, next)
                          }}
                          placeholder="Ej: 430"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="no-print">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setSustratosLam(setForm, [...sustratosLam, { material_id: "", kg: "" }])
                      }
                    >
                      Agregar otro sustrato
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Corte / Embalaje */}
          <div className="ot-section">
            <div className="section-header">
              <span className="inline-flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                AREA DE CORTE / EMBALAJE
              </span>
            </div>
            <div className="section-body">
              <div className="ot-grid ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Ancho corte (mm)</label>
                  <input className="ot-input" value={readString(form.anchoCorteFinal)} onChange={(e) => setKey(setForm,"anchoCorteFinal",e.target.value)} placeholder="320±0" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Peso bobina (Kg)</label>
                  <input className="ot-input" value={readString(form.pesoBobina)} onChange={(e) => setKey(setForm,"pesoBobina",e.target.value)} placeholder="19-20" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metros/Bobina (m)</label>
                  <input className="ot-input" value={readString(form.metrosBobina)} onChange={(e) => setKey(setForm,"metrosBobina",e.target.value)} placeholder="1020 ± 20" />
                </div>
                <div className="ot-field sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="ot-label">Figura embobinado (1-8 o libre)</label>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                      title="Botones 1–8 = atajo. El cuadro pequeño es solo vista previa del valor (no guarda nada aparte)."
                    >
                      Figura
                    </Badge>
                  </div>
                  <WindingFigurePicker
                    value={readString(form.orientacionEmbalaje)}
                    onChange={(v) => setKey(setForm, "orientacionEmbalaje", v)}
                  />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Ubic. fotocelda</label>
                  <input className="ot-input" value={readString(form.ubicFotoceldaCorte)} onChange={(e) => setKey(setForm,"ubicFotoceldaCorte",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Dist. fotocelda al borde (mm)</label>
                  <input className="ot-input" value={readString(form.distFotoceldaBorde)} onChange={(e) => setKey(setForm,"distFotoceldaBorde",e.target.value)} placeholder="1±1" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Dist. figura lado contrario (mm)</label>
                  <input className="ot-input" value={readString(form.distFiguraLadoContrario)} onChange={(e) => setKey(setForm,"distFiguraLadoContrario",e.target.value)} placeholder="20±1" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Dist. figura lado fotocelda (mm)</label>
                  <input className="ot-input" value={readString(form.distFiguraLadoFotocelda)} onChange={(e) => setKey(setForm,"distFiguraLadoFotocelda",e.target.value)} placeholder="30±1" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Max. empates</label>
                  <input className="ot-input" value={readString(form.maxEmpates)} onChange={(e) => setKey(setForm,"maxEmpates",e.target.value)} placeholder="1" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Diam. bobina (mm)</label>
                  <input className="ot-input" value={readString(form.diamBobina)} onChange={(e) => setKey(setForm,"diamBobina",e.target.value)} placeholder="400 ± 5" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Ancho core (mm)</label>
                  <input className="ot-input" value={readString(form.anchoCore)} onChange={(e) => setKey(setForm,"anchoCore",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Diam. core (Plg)</label>
                  <input className="ot-input" value={readString(form.diamCorePlg)} onChange={(e) => setKey(setForm,"diamCorePlg",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Cant. cores</label>
                  <input className="ot-input" value={readString(form.cantCores)} onChange={(e) => setKey(setForm,"cantCores",e.target.value)} />
                </div>
              </div>

              <div className="ot-grid ot-metrics-before-nested ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg ingresados</label>
                  <input className="ot-input" value={readString(form.kgIngresadosCorte)} onChange={(e) => setKey(setForm,"kgIngresadosCorte",e.target.value)} placeholder="kg ingresados" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida</label>
                  <input className="ot-input" value={readString(form.kgSalidaCorte)} onChange={(e) => setKey(setForm,"kgSalidaCorte",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg merma</label>
                  <input className="ot-input" value={readString(form.kgMermaCorte)} onChange={(e) => setKey(setForm,"kgMermaCorte",e.target.value)} placeholder="Ej: 10/100" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metraje</label>
                  <input className="ot-input" value={readString(form.metrajeCorte)} onChange={(e) => setKey(setForm,"metrajeCorte",e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones + Programación */}
          <div className="ot-section">
            <div className="ot-two-col">
              <div>
                <div className="section-header">
                  <span className="inline-flex items-center gap-2">
                    <NotebookPen className="h-4 w-4" />
                    OBSERVACIONES GENERALES
                  </span>
                </div>
                <div className="section-body">
                  <Textarea
                    className="min-h-[5rem] resize-y"
                    value={readString(form.observacionesGenerales)}
                    onChange={(e) => setKey(setForm, "observacionesGenerales", e.target.value)}
                    placeholder="Instrucciones especiales, notas adicionales..."
                  />
                </div>
              </div>
              <div>
                <div className="section-header header-blue">PROGRAMACION</div>
                <div className="section-body">
                  <div className="ot-grid ot-cols-2">
                    <div className="ot-field">
                      <label className="ot-label">F. Inicio</label>
                      <input
                        type="date"
                        className="ot-input"
                        value={readString(form.fechaInicio)}
                        onChange={(e) => setKey(setForm, "fechaInicio", e.target.value)}
                      />
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">F. Entrega</label>
                      <input
                        type="date"
                        className="ot-input"
                        value={readString(form.fechaEntrega)}
                        onChange={(e) => setKey(setForm, "fechaEntrega", e.target.value)}
                      />
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Prioridad</label>
                      <select
                        className="ot-select"
                        value={readString(form.prioridad) || "Normal"}
                        onChange={(e) => setKey(setForm, "prioridad", e.target.value)}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Urgente">Urgente</option>
                      </select>
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Estado</label>
                      <select
                        className="ot-select"
                        value={readString(form.estadoOrden) || "Pendiente"}
                        onChange={(e) => setKey(setForm, "estadoOrden", e.target.value)}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En proceso">En proceso</option>
                        <option value="Completada">Completada</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="no-print mt-4 flex justify-center">
            <Button type="button" onClick={() => void guardar()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar orden"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

