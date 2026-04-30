"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ClipboardCheck,
  ClipboardList,
  Droplets,
  Layers,
  NotebookPen,
  Package,
  Printer,
  ReceiptText,
  Scissors,
  Wrench,
} from "./ot-planilla-icons"

import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, MaterialRow, ProductRecord } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { WindingFigurePicker } from "./WindingFigurePicker"
import WorkOrderPrintingInkTable from "./WorkOrderPrintingInkTable"
import WorkOrderCorteOpsSection from "./WorkOrderCorteOpsSection"
import "./work-order-planilla.css"

type MachineValue =
  | ""
  | "COMEXI 1"
  | "COMEXI 3"
  | "Cortadora China"
  | "Cortadora Permaco"

const MACHINE_OPTIONS: Array<{
  group: string
  options: Array<{ value: Exclude<MachineValue, "">; label: string }>
}> = [
  {
    group: "Impresion",
    options: [
      { value: "COMEXI 1", label: "COMEXI 1" },
      { value: "COMEXI 3", label: "COMEXI 3" },
    ],
  },
  {
    group: "Laminacion",
    options: [
      { value: "Cortadora China", label: "Cortadora China" },
      { value: "Cortadora Permaco", label: "Cortadora Permaco" },
    ],
  },
]

type OrdenTrabajoPayload = {
  work_order_id: number
  code: string
  document_number?: string | null
  client_id?: number | null
  product_id?: number | null
  prefill: Record<string, unknown>
  form: Record<string, unknown> | null
}

type SustratoRow = { material_id: string; kg: string }

const MIN_SUSTRATO_ROWS = 1
const MAX_SUSTRATO_ROWS = 4

function ensureMinSustratoRows(rows: SustratoRow[], minRows = MIN_SUSTRATO_ROWS): SustratoRow[] {
  const next = [...rows]
  while (next.length < minRows) next.push({ material_id: "", kg: "" })
  return next
}

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

/** Alineado con `WorkOrderOrdenTrabajoService::buildPrefill()` (tipo de impresión según `print_type`). */
function prefillFromProduct(p: ProductRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {
    producto: p.name,
    cpe: p.cpe ?? null,
    mpps: p.mps ?? null,
    codigoBarra: null,
    estructuraMaterial: p.structure ?? null,
  }
  const raw = p.print_type
  if (raw == null) return out
  const t = readString(String(raw)).toLowerCase()
  if (t.includes("reverso")) out.tipoImpresion = "Reverso"
  else if (t.includes("superficie") || t.includes("superf")) out.tipoImpresion = "Superficie"
  return out
}

function normalizeTipoImpresion(v: unknown): "" | "superficie" | "reverso" {
  const s = readString(v).toLowerCase().trim()
  if (s === "superficie" || s === "superf") return "superficie"
  if (s === "reverso") return "reverso"
  return ""
}

function isDecimalLike(v: unknown): boolean {
  const s = readString(v).trim().replace(",", ".")
  if (!s) return false
  return /^-?\d+(\.\d+)?$/.test(s)
}

function isRatioLike(v: unknown): boolean {
  const s = readString(v).trim().replace(/\s+/g, "")
  if (!s) return false
  return /^\d+([.,]\d+)?\/\d+([.,]\d+)?$/.test(s)
}

function isPositiveIntLike(v: unknown): boolean {
  const s = readString(v).trim()
  if (!s) return false
  if (!/^\d+$/.test(s)) return false
  return Number(s) > 0
}

function isMetricLike(v: unknown): boolean {
  const s = readString(v).trim()
  if (!s) return false
  const n = String.raw`\d+(?:[.,]\d+)?`
  const decimal = new RegExp(`^${n}$`)
  const plusMinus = new RegExp(`^${n}\\s*±\\s*${n}$`)
  const range = new RegExp(`^${n}\\s*-\\s*${n}$`)
  return decimal.test(s) || plusMinus.test(s) || range.test(s)
}

function isMetricLikeOrNA(v: unknown): boolean {
  const s = readString(v).trim()
  if (!s) return false
  if (/^n\/a$/i.test(s)) return true
  return isMetricLike(s)
}

function sanitizeMetricInput(v: string): string {
  const cleaned = v.replace(/[^0-9.,±+\-/\s]/g, "")
  // Atajo de teclado: permitir "+" o "+/-" y convertirlo a "±" automáticamente.
  return cleaned
    .replace(/\+\s*[/]\s*-\s*/g, "±")
    .replace(/\+\s*-\s*/g, "±")
    .replace(/\+\s*/g, "±")
}

function sanitizePositiveIntInput(v: string): string {
  return v.replace(/\D/g, "")
}

function sanitizeMetrosEstimadosInput(v: string): string {
  const trimmed = v.trim()
  if (trimmed === "-") return "-"
  const digits = v.replace(/\D/g, "")
  return digits || "-"
}

function normalizeYesNo(v: unknown): "" | "si" | "no" {
  const s = readString(v).trim().toLowerCase()
  if (s === "si" || s === "sí") return "si"
  if (s === "no") return "no"
  return ""
}

function statusOtLabel(v: unknown): string {
  const s = readString(v).toLowerCase().trim()
  if (s === "open") return "Abierta"
  if (s === "in_progress") return "En proceso"
  if (s === "completed") return "Completada"
  if (s === "cancelled") return "Cancelada"
  return readString(v) || "—"
}

function stageOtLabel(v: unknown): string {
  const s = readString(v).toLowerCase().trim()
  if (s === "nueva") return "Pendiente por OT"
  if (s === "pendiente") return "Programación"
  if (s === "montaje") return "Montaje"
  if (s === "impresion") return "Impresión"
  if (s === "laminacion") return "Laminación"
  if (s === "corte") return "Corte"
  if (s === "completada") return "Completada"
  return readString(v) || "—"
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
  if (!Array.isArray(raw)) return ensureMinSustratoRows([])
  const out: SustratoRow[] = raw
    .map((r) => {
      const o = r as Record<string, unknown>
      return { material_id: readString(o.material_id), kg: readNumberString(o.kg) }
    })
  return ensureMinSustratoRows(out)
}

function setSustratosLam(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  rows: SustratoRow[],
) {
  setForm((prev) => ({ ...prev, sustratosVirgenLam: rows.slice(0, MAX_SUSTRATO_ROWS) }))
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
    return ensureMinSustratoRows(out)
  }
  const mid = readString(form.sustratoVirgenImp1)
  const kg = readNumberString(form.kgUtilizarImp1)
  if (mid || kg) return ensureMinSustratoRows([{ material_id: mid, kg }])
  return ensureMinSustratoRows([])
}

function setSustratosImp(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  rows: SustratoRow[],
) {
  setForm((prev) => ({ ...prev, sustratosVirgenImp: rows.slice(0, MAX_SUSTRATO_ROWS) }))
}

export default function WorkOrderPlanillaPage() {
  const nav = useNavigate()
  const { woId } = useParams<{ woId: string }>()
  const [searchParams] = useSearchParams()
  const id = Number(woId)
  const session = getStoredUser()
  const role = readString(session?.role).toLowerCase().trim()
  const isFullAccess = ["boss", "admin", "jefe_supremo", "superadmin"].includes(role)
  const routeTab = readString(searchParams.get("tab")).toLowerCase().trim()

  type WorkAreaScope = "planning" | "printing" | "laminacion" | "corte" | "tintas"
  const roleScope: WorkAreaScope = useMemo(() => {
    if (isFullAccess) return "planning"
    if (role === "impresion" || role === "printing") return "printing"
    if (role === "laminacion") return "laminacion"
    if (role === "corte") return "corte"
    if (role === "tintas") return "tintas"
    return "planning"
  }, [isFullAccess, role])
  const activeScope: WorkAreaScope = useMemo(() => {
    if (roleScope !== "planning") return roleScope
    if (routeTab === "printing") return "printing"
    if (routeTab === "laminacion") return "laminacion"
    if (routeTab === "corte") return "corte"
    if (routeTab === "tintas") return "tintas"
    return "planning"
  }, [roleScope, routeTab])

  const canEditShared = activeScope === "planning"
  const canViewMontaje = activeScope === "planning"
  const canViewImpresion = activeScope === "planning" || activeScope === "printing"
  const canViewTintas = activeScope === "planning" || activeScope === "printing" || activeScope === "tintas"
  const canViewLaminacion = activeScope === "planning" || activeScope === "laminacion"
  const canViewCorte = activeScope === "planning" || activeScope === "corte"
  const canViewProgramacion = activeScope === "planning"
  const isRestrictedAreaView = activeScope !== "planning"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [woClientId, setWoClientId] = useState<number | null>(null)
  const [woProductId, setWoProductId] = useState<number | null>(null)
  const [clientProducts, setClientProducts] = useState<ProductRecord[]>([])
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [updatingProduct, setUpdatingProduct] = useState(false)

  const [tintaMateriales, setTintaMateriales] = useState<MaterialRow[]>([])
  const [tintaMaterialesLoading, setTintaMaterialesLoading] = useState(false)

  const prefillRef = useRef(prefill)
  const formRef = useRef(form)
  const woProductIdRef = useRef(woProductId)
  prefillRef.current = prefill
  formRef.current = form
  woProductIdRef.current = woProductId

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
      setWoClientId(
        payload.client_id !== null && payload.client_id !== undefined ? Number(payload.client_id) : null,
      )
      setWoProductId(
        payload.product_id !== null && payload.product_id !== undefined ? Number(payload.product_id) : null,
      )
      const p = payload.prefill ?? {}
      const merged = mergePrefill(p, payload.form)
      if (!Array.isArray(merged.sustratosVirgenImp)) {
        const mid = readString(merged.sustratoVirgenImp1)
        const kg = readNumberString(merged.kgUtilizarImp1)
        if (mid || kg) merged.sustratosVirgenImp = [{ material_id: mid, kg }]
      }
      // Maestro: nombres de cliente/producto vienen del servidor, no de un borrador antiguo.
      if (readString(p.cliente)) merged.cliente = p.cliente
      if (Object.prototype.hasOwnProperty.call(p, "clienteRif")) merged.clienteRif = p.clienteRif
      if (readString(p.producto)) merged.producto = p.producto
      // Evita dos semánticas de estado: siempre reflejar estado/etapa reales del modelo OT.
      merged.estadoOt = statusOtLabel(p.estadoOt)
      merged.etapaOt = stageOtLabel(p.etapaOt)
      setForm(merged)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la orden de trabajo.")
      setPrefill({})
      setForm({})
      setWoClientId(null)
      setWoProductId(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
    void loadMaterials()
  }, [load, loadMaterials])

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) return
    if (isFullAccess) return
    if (role === "impresion" || role === "printing") {
      nav(`/ordenes-trabajo/${id}/produccion?tab=printing`, { replace: true })
    }
  }, [id, role, isFullAccess, nav])

  useEffect(() => {
    if (!woClientId) {
      setClientProducts([])
      return
    }
    let c = false
    void (async () => {
      try {
        const data = await apiFetch<LaravelPaginated<ProductRecord>>("products", {
          query: { client_id: woClientId, per_page: 200, page: 1 },
        })
        if (!c) setClientProducts(data.data ?? [])
      } catch {
        if (!c) setClientProducts([])
      }
    })()
    return () => {
      c = true
    }
  }, [woClientId])

  useEffect(() => {
    let c = false
    setTintaMaterialesLoading(true)
    void (async () => {
      try {
        const q: Record<string, string | number> = {
          inventory_area: "tintas",
          per_page: 500,
          page: 1,
        }
        if (woProductId) q.product_id = woProductId
        const d = await apiFetch<LaravelPaginated<MaterialRow>>("materials", { query: q })
        if (!c) setTintaMateriales(d.data ?? [])
      } catch {
        if (!c) setTintaMateriales([])
      } finally {
        if (!c) setTintaMaterialesLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [woProductId])

  const tipoImpresion = useMemo(
    () => normalizeTipoImpresion(form.tipoImpresionEstructura ?? form.tipoImpresion),
    [form.tipoImpresionEstructura, form.tipoImpresion],
  )

  const productComboLabel = useMemo(() => {
    const n = readString(form.producto) || readString(prefill.producto)
    return n || "—"
  }, [form.producto, prefill.producto])

  const applyProduct = useCallback(
    async (p: ProductRecord) => {
      if (p.id === woProductIdRef.current) {
        setProductPickerOpen(false)
        return
      }
      if (!Number.isFinite(id) || id < 1) return
      const snapshot = {
        prefill: { ...prefillRef.current },
        form: { ...formRef.current } as Record<string, unknown>,
        woProductId: woProductIdRef.current,
      }
      const delta = prefillFromProduct(p)
      // Actualización inmediata en pantalla (sin `load` → sin “Cargando…” de toda la página).
      setPrefill((prev) => ({ ...prev, ...delta }))
      setForm((f) => {
        const n: Record<string, unknown> = { ...f, producto: p.name }
        const s = p.structure
        if (typeof s === "string" && s !== "") n.estructuraCapa1 = s
        if (delta.tipoImpresion === "Reverso") n.tipoImpresionEstructura = "reverso"
        else if (delta.tipoImpresion === "Superficie") n.tipoImpresionEstructura = "superficie"
        n.tipoImpresion = delta.tipoImpresion ?? f.tipoImpresion
        return n
      })
      setWoProductId(p.id)
      setProductPickerOpen(false)

      setUpdatingProduct(true)
      try {
        await apiFetch(`work-orders/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ product_id: p.id }),
        })
        toast.success("Producto de la OT actualizado y guardado en el servidor.")
      } catch (e) {
        setPrefill(snapshot.prefill)
        setForm(snapshot.form)
        setWoProductId(snapshot.woProductId)
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo actualizar el producto de la OT.")
      } finally {
        setUpdatingProduct(false)
      }
    },
    [id],
  )

  const maquina = readString(form.maquina) as MachineValue

  const sustratosLam = useMemo(() => getSustratosLam(form), [form])
  const sustratosImp = useMemo(() => getSustratosImp(form), [form])
  const errorFor = (key: string) => fieldErrors[key]
  const renderError = (key: string) => {
    const message = errorFor(key)
    if (!message) return null
    return (
      <p className="mt-1 text-xs text-destructive" title={message}>
        {message}
      </p>
    )
  }
  const focusFieldSoft = useCallback((key: string) => {
    if (typeof document === "undefined") return
    const field = document.querySelector<HTMLElement>(`[data-field="${key}"]`)
    if (!field) return
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth"
    field.scrollIntoView({ behavior, block: "center", inline: "nearest" })
    window.setTimeout(() => {
      if ("focus" in field) {
        ;(field as HTMLInputElement).focus({ preventScroll: true })
      }
    }, prefersReducedMotion ? 0 : 140)
  }, [])

  async function guardar() {
    if (!Number.isFinite(id) || id < 1) return
    if (saving) return
    const errors: Record<string, string> = {}
    const addError = (key: string, message: string) => {
      if (!errors[key]) errors[key] = message
    }

    const pedidoKg = readNumberString(form.pedidoKg) || readNumberString(prefill.pedidoKg)
    if (!isDecimalLike(pedidoKg) || Number(pedidoKg.replace(",", ".")) <= 0) {
      addError("pedidoKg", "Cantidad solicitada (Kg) debe ser numérica y mayor a 0.")
    }
    if (!readString(form.maquina).trim()) {
      addError("maquina", "Seleccione una máquina antes de guardar.")
    }
    const metrosEstimadosRaw = readNumberString(form.metrosEstimados).trim()
    const metrosEstimados = metrosEstimadosRaw === "-" ? "" : metrosEstimadosRaw
    if (!metrosEstimados) {
      addError("metrosEstimados", "Metros Est. es obligatorio.")
    } else if (!/^\d+$/.test(metrosEstimados)) {
      addError("metrosEstimados", "Metros Est. debe ser numérico.")
    }
    if (!tipoImpresion) {
      addError("tipoImpresionEstructura", "Seleccione el tipo de impresión.")
    }
    if (!readString(form.cpe).trim()) {
      addError("cpe", "C.P.E. es obligatorio.")
    }
    if (!readString(form.mpps).trim()) {
      addError("mpps", "M.P.P.S. es obligatorio.")
    }
    if (!readString(form.codigoBarra).trim()) {
      addError("codigoBarra", "Cod. Barra es obligatorio.")
    }

    if (canEditShared && canViewMontaje) {
      if (!isMetricLike(readString(form.frecuencia))) {
        addError("frecuencia", "Formato válido: 250, 250±2 o 250-252.")
      }
      if (!isPositiveIntLike(form.numBandas)) {
        addError("numBandas", "Debe ser entero mayor a 0.")
      }
      if (!isMetricLike(readString(form.anchoCorteMontaje))) {
        addError("anchoCorteMontaje", "Formato válido: 330±2, 330 o 329-331.")
      }
      if (!isPositiveIntLike(form.numRepeticion)) {
        addError("numRepeticion", "Debe ser entero mayor a 0.")
      }
      if (!isPositiveIntLike(form.numColores)) {
        addError("numColores", "Debe ser entero mayor a 0.")
      }
    }

    if (canViewImpresion) {
      const pinon = readString(form.pinonImp).trim()
      if (pinon && !isPositiveIntLike(pinon)) {
        addError("pinonImp", "Piñón debe ser entero mayor a 0.")
      }
    }

    if (canViewLaminacion) {
      const gramaje = readString(form.gramajeAdhesivo).trim()
      if (gramaje && !isDecimalLike(gramaje)) {
        addError("gramajeAdhesivo", "Solo números decimales (ej: 1.5 o 2,0).")
      }
      const relacion = readString(form.relacionMezcla).trim()
      if (relacion && !isRatioLike(relacion)) {
        addError("relacionMezcla", "Use formato 100/80.")
      }
    }

    if (canViewCorte) {
      const metricChecks: Array<[key: string, label: string, value: unknown]> = [
        ["anchoCorteFinal", "Corte: Ancho corte (mm)", form.anchoCorteFinal],
        ["pesoBobina", "Corte: Peso bobina (Kg)", form.pesoBobina],
        ["metrosBobina", "Corte: Metros/Bobina (m)", form.metrosBobina],
        ["distFotoceldaBorde", "Corte: Dist. fotocelda al borde (mm)", form.distFotoceldaBorde],
        ["distFiguraLadoContrario", "Corte: Dist. figura lado contrario (mm)", form.distFiguraLadoContrario],
        ["distFiguraLadoFotocelda", "Corte: Dist. figura lado fotocelda (mm)", form.distFiguraLadoFotocelda],
        ["diamBobina", "Corte: Diám. bobina (mm)", form.diamBobina],
        ["anchoCore", "Corte: Ancho core (mm)", form.anchoCore],
        ["diamCorePlg", "Corte: Diám. core (Plg)", form.diamCorePlg],
      ]
      for (const [key, label, value] of metricChecks) {
        const s = readString(value).trim()
        if (!s) continue
        if (!isMetricLikeOrNA(s)) {
          addError(key, `${label} debe tener formato válido (ej: 400±5, 19-20, 460 o N/A).`)
        }
      }
      const wholeNumberChecks: Array<[key: string, label: string, value: unknown]> = [
        ["maxEmpates", "Corte: Max. empates", form.maxEmpates],
        ["cantCores", "Corte: Cant. cores", form.cantCores],
      ]
      for (const [key, label, value] of wholeNumberChecks) {
        const s = readString(value).trim()
        if (!s) continue
        if (!isPositiveIntLike(s)) {
          addError(key, `${label} debe ser entero mayor a 0.`)
        }
      }
    }

    const decimalChecks: Array<[key: string, label: string, value: unknown]> = [
      ["kgIngresadoImp", "Impresión: Kg ingresado", form.kgIngresadoImp],
      ["kgSalidaImp", "Impresión: Kg salida", form.kgSalidaImp],
      ["mermaImp", "Impresión: Merma", form.mermaImp],
      ["metrosImp", "Impresión: Metros", form.metrosImp],
      ["kgEntradaLam", "Laminación: Kg entrada", form.kgEntradaLam],
      ["kgSalidaLam", "Laminación: Kg salida", form.kgSalidaLam],
      ["metrajeLam", "Laminación: Metraje", form.metrajeLam],
      ["mermaLam", "Laminación: Merma", form.mermaLam],
      ["kgEntradaLam2", "Laminación: Kg entrada 2", form.kgEntradaLam2],
      ["kgSalidaLam2", "Laminación: Kg salida 2", form.kgSalidaLam2],
      ["metrajeLam2", "Laminación: Metraje 2", form.metrajeLam2],
      ["mermaLam2", "Laminación: Merma 2", form.mermaLam2],
      ["kgIngresadosCorte", "Corte: Kg ingresados", form.kgIngresadosCorte],
      ["kgSalidaCorte", "Corte: Kg salida", form.kgSalidaCorte],
      ["kgMermaCorte", "Corte: Kg merma", form.kgMermaCorte],
      ["metrajeCorte", "Corte: Metraje", form.metrajeCorte],
    ]
    for (const [key, label, value] of decimalChecks) {
      const s = readNumberString(value).trim()
      if (!s) continue
      if (!isDecimalLike(s)) {
        addError(key, `${label} debe ser numérico.`)
      }
    }

    for (let i = 0; i < sustratosImp.length; i += 1) {
      const kg = readString(sustratosImp[i]?.kg).trim()
      if (kg && !isDecimalLike(kg)) {
        addError("sustratosImp", `Impresión: 'Kg a utilizar' de sustrato ${i + 1} debe ser numérico.`)
      }
    }
    for (let i = 0; i < sustratosLam.length; i += 1) {
      const kg = readString(sustratosLam[i]?.kg).trim()
      if (kg && !isDecimalLike(kg)) {
        addError("sustratosLam", `Laminación: 'Kg a utilizar' de sustrato ${i + 1} debe ser numérico.`)
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const first = Object.entries(errors)[0]
      toast.error(first?.[1] ?? "Revise los campos del formulario.")
      if (first?.[0]) focusFieldSoft(first[0])
      return
    }

    setFieldErrors({})
    setSaving(true)
    try {
      const rowsImp = getSustratosImp(form)
      const formOut: Record<string, unknown> = {
        ...form,
        sustratosVirgenImp: rowsImp,
        sustratoVirgenImp1: rowsImp[0]?.material_id ?? "",
        kgUtilizarImp1: rowsImp[0]?.kg ?? "",
        cliente: readString(prefill.cliente) || readString(form.cliente),
        clienteRif: readString(prefill.clienteRif) || readString(form.clienteRif),
        producto: readString(prefill.producto) || readString(form.producto),
      }
      await apiFetch(`work-orders/${id}/orden-trabajo`, {
        method: "PUT",
        body: JSON.stringify({ form: formOut }),
      })
      await apiFetch(`work-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: "impresion" }),
      })
      toast.success("Orden guardada.")
      nav("/ordenes-trabajo?tab=lista")
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
    setFieldErrors({})
    toast.message("Formulario limpiado.")
  }

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div className="p-6">
        <p className="text-destructive">ID inválido.</p>
        <Link to="/ordenes-trabajo" className="underline">
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
            <span className="font-medium text-foreground">Guardar orden</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => nav("/ordenes-trabajo?tab=lista")}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Ver órdenes
          </Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button type="button" variant="outline" onClick={() => limpiar()} disabled={loading || isRestrictedAreaView}>
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
        <>
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
          className="pb-16"
        >
          {isRestrictedAreaView ? (
            <div className="no-print mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Vista por área: solo puede editar la sección de{" "}
              <span className="font-semibold text-foreground">
                {activeScope === "printing"
                  ? "Impresión"
                  : activeScope === "laminacion"
                    ? "Laminación"
                    : activeScope === "corte"
                      ? "Corte"
                      : "Tintas"}
              </span>
              . El resto de datos proviene de Planificación.
            </div>
          ) : null}
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
              {/* Cabecera vinculada al pedido del cliente */}
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
                        disabled={!canEditShared}
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
                        data-field="pedidoKg"
                        className="ot-input"
                        step="0.01"
                        min="0"
                        value={readNumberString(form.pedidoKg) || readNumberString(prefill.pedidoKg)}
                        onChange={(ev) => setKey(setForm, "pedidoKg", ev.target.value)}
                        disabled={!canEditShared}
                      />
                      {renderError("pedidoKg")}
                    </div>
                  </div>

                  <div className="ot-grid ot-cols-2">
                    <div className="ot-field">
                      <label className="ot-label required">Maquina</label>
                      <select
                        data-field="maquina"
                        className="ot-select"
                        value={maquina}
                        onChange={(ev) => setKey(setForm, "maquina", ev.target.value)}
                        disabled={!canEditShared}
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
                      {renderError("maquina")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Ref. planchas (opcional)</label>
                      <input
                        className="ot-input"
                        data-field="planchasReferencia"
                        value={readString(form.planchasReferencia)}
                        onChange={(ev) => setKey(setForm, "planchasReferencia", ev.target.value)}
                        placeholder="Ej: 067"
                        disabled={!canEditShared}
                      />
                    </div>
                  </div>

                  <div className="ot-grid ot-cols-2">
                    <div className="ot-field md:col-span-2">
                      <label className="ot-label required">Metros Est.</label>
                      <input
                        data-field="metrosEstimados"
                        className="ot-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={readNumberString(form.metrosEstimados) || "-"}
                        onChange={(ev) => {
                          setKey(setForm, "metrosEstimados", sanitizeMetrosEstimadosInput(ev.target.value))
                        }}
                        disabled={!canEditShared}
                      />
                      {renderError("metrosEstimados")}
                    </div>
                  </div>

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
                      <div className="flex flex-nowrap items-center gap-1.5">
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
                      <div className="flex flex-nowrap items-center gap-1.5">
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
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Label className="ot-label !font-black required">Producto</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      {!woClientId ? (
                        <Input
                          readOnly
                          className="ot-input-unified h-9 bg-muted/50 text-sm"
                          value={readString(form.producto) || readString(prefill.producto)}
                        />
                      ) : (
                        <>
                        <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              disabled={!canEditShared || updatingProduct || clientProducts.length === 0}
                              className="ot-input-unified h-9 w-full min-w-0 max-w-full justify-between px-2 font-normal print:hidden"
                            >
                              <span className="min-w-0 flex-1 truncate text-left text-sm">
                                {updatingProduct ? (
                                  <span className="text-muted-foreground">Actualizando…</span>
                                ) : clientProducts.length === 0 ? (
                                  <span className="text-muted-foreground">No hay productos de este cliente</span>
                                ) : (
                                  productComboLabel
                                )}
                              </span>
                              {updatingProduct ? (
                                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-60" />
                              ) : (
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0 no-print w-[min(100vw-2rem,28rem)] min-w-[var(--radix-popover-trigger-width)]"
                            align="start"
                            side="bottom"
                          >
                            <Command shouldFilter>
                              <CommandInput placeholder="Buscar por nombre, C.P.E. o M.P.P.S…" />
                              <CommandList>
                                <CommandEmpty>
                                  {clientProducts.length === 0
                                    ? "Cargue productos del cliente o intente otra búsqueda."
                                    : "Ningún producto coincide."}
                                </CommandEmpty>
                                <CommandGroup>
                                  {clientProducts.map((p) => {
                                    const v = [p.name, p.cpe ?? "", p.mps ?? ""].filter(Boolean).join(" ")
                                    return (
                                      <CommandItem
                                        key={p.id}
                                        value={v}
                                        onSelect={() => {
                                          void applyProduct(p)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            p.id === woProductId ? "opacity-100" : "opacity-0",
                                          )}
                                          aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate font-medium">{p.name}</div>
                                          {p.cpe || p.mps ? (
                                            <div className="text-muted-foreground truncate text-xs">
                                              {[p.cpe, p.mps].filter(Boolean).join(" · ")}
                                            </div>
                                          ) : null}
                                        </div>
                                      </CommandItem>
                                    )
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <div className="ot-input-unified hidden h-9 items-center px-2 text-sm print:flex">
                          {productComboLabel}
                        </div>
                        </>
                      )}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Tipo Impresion</label>
                      <select
                        data-field="tipoImpresionEstructura"
                        className="ot-select"
                        value={tipoImpresion}
                        onChange={(ev) => {
                          const next = ev.target.value
                          setKey(setForm, "tipoImpresionEstructura", next)
                          if (next === "superficie") {
                            setKey(setForm, "tipoImpresionMontaje", "Superficie")
                          } else if (next === "reverso") {
                            setKey(setForm, "tipoImpresionMontaje", "Reverso")
                          } else {
                            setKey(setForm, "tipoImpresionMontaje", "")
                          }
                        }}
                        disabled={!canEditShared}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="superficie">Superficie</option>
                        <option value="reverso">Reverso</option>
                      </select>
                      {renderError("tipoImpresionEstructura")}
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
                          disabled={!canEditShared}
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
                          disabled={!canEditShared}
                        />
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Capa 2</label>
                        <input
                          className="ot-input"
                          value={readString(form.estructuraCapa2Rev)}
                          onChange={(ev) => setKey(setForm, "estructuraCapa2Rev", ev.target.value)}
                          placeholder="Ej: CAST"
                          disabled={!canEditShared}
                        />
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Capa 3</label>
                        <input
                          className="ot-input"
                          value={readString(form.estructuraCapa3Rev)}
                          onChange={(ev) => setKey(setForm, "estructuraCapa3Rev", ev.target.value)}
                          placeholder="Ej: PEBD"
                          disabled={!canEditShared}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="ot-grid ot-cols-3">
                    <div className="ot-field">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Label className="ot-label !font-black required">C.P.E.</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input
                        data-field="cpe"
                        className="ot-input-unified h-9 text-sm"
                        value={readString(form.cpe)}
                        onChange={(ev) => setKey(setForm, "cpe", ev.target.value)}
                        disabled={!canEditShared}
                      />
                      {renderError("cpe")}
                    </div>
                    <div className="ot-field">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Label className="ot-label !font-black required">M.P.P.S.</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input
                        data-field="mpps"
                        className="ot-input-unified h-9 text-sm"
                        value={readString(form.mpps)}
                        onChange={(ev) => setKey(setForm, "mpps", ev.target.value)}
                        disabled={!canEditShared}
                      />
                      {renderError("mpps")}
                    </div>
                    <div className="ot-field">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Label className="ot-label !font-black required">Cod. Barra</Label>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Maestro
                        </Badge>
                      </div>
                      <Input
                        data-field="codigoBarra"
                        className="ot-input-unified h-9 text-sm"
                        value={readString(form.codigoBarra)}
                        onChange={(ev) => setKey(setForm, "codigoBarra", ev.target.value)}
                        disabled={!canEditShared}
                      />
                      {renderError("codigoBarra")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Montaje */}
          {canViewMontaje ? (
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
                  <input
                    data-field="frecuencia"
                    className="ot-input"
                    value={readString(form.frecuencia)}
                    onChange={(e) => setKey(setForm, "frecuencia", sanitizeMetricInput(e.target.value))}
                    placeholder="250±2"
                    inputMode="decimal"
                  />
                  {renderError("frecuencia")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">N° Bandas</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="ot-input"
                    value={readString(form.numBandas)}
                    onChange={(e) => setKey(setForm, "numBandas", sanitizePositiveIntInput(e.target.value))}
                    inputMode="numeric"
                  />
                  {renderError("numBandas")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">Tipo Impresion</label>
                  <select
                    className="ot-select"
                    value={readString(form.tipoImpresionMontaje)}
                    onChange={(e) => setKey(setForm, "tipoImpresionMontaje", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Superficie">Superficie</option>
                    <option value="Reverso">Reverso</option>
                  </select>
                </div>
                <div className="ot-field">
                  <label className="ot-label">Ancho Corte (mm)</label>
                  <input
                    data-field="anchoCorteMontaje"
                    className="ot-input"
                    value={readString(form.anchoCorteMontaje)}
                    onChange={(e) => setKey(setForm, "anchoCorteMontaje", sanitizeMetricInput(e.target.value))}
                    placeholder="330±2"
                    inputMode="decimal"
                  />
                  {renderError("anchoCorteMontaje")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">N° Repeticion o Frecuencia</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="ot-input"
                    value={readString(form.numRepeticion)}
                    onChange={(e) => setKey(setForm, "numRepeticion", sanitizePositiveIntInput(e.target.value))}
                    inputMode="numeric"
                  />
                  {renderError("numRepeticion")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">Desarrollo (mm) (auto)</label>
                  <input
                    data-field="desarrollo"
                    className="ot-input"
                    value={readString(form.desarrollo)}
                    onChange={(e) => setKey(setForm, "desarrollo", sanitizeMetricInput(e.target.value))}
                    inputMode="decimal"
                  />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Ancho Montaje (mm) (auto)</label>
                  <input
                    data-field="anchoMontaje"
                    className="ot-input"
                    value={readString(form.anchoMontaje)}
                    onChange={(e) => setKey(setForm, "anchoMontaje", sanitizeMetricInput(e.target.value))}
                    placeholder="Ancho montaje"
                    inputMode="decimal"
                  />
                </div>
                <div className="ot-field ot-field-figure sm:col-span-2">
                  <div className="ot-label-row">
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
                <div className="ot-field ot-field-align-figure">
                  <label className="ot-label">N° Colores</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="ot-input"
                    value={readString(form.numColores)}
                    onChange={(e) => setKey(setForm, "numColores", sanitizePositiveIntInput(e.target.value))}
                    inputMode="numeric"
                  />
                  {renderError("numColores")}
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
          ) : null}

          {/* Impresión */}
          {(canViewImpresion || canViewTintas) ? (
          <div className="ot-section">
            <div className="section-header">
              <span className="inline-flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                AREA DE IMPRESION
              </span>
            </div>
            <div className="section-body">
              {canViewImpresion ? (
              <>

              <div className="ot-grid ot-cols-3">
                <div className="ot-field">
                  <label className="ot-label">Piñon (dientes)</label>
                  <input data-field="pinonImp" className="ot-input" value={readString(form.pinonImp)} onChange={(e) => setKey(setForm,"pinonImp",e.target.value)} placeholder="Ej: 840" />
                  {renderError("pinonImp")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">Linea de corte</label>
                  <select
                    className="ot-select"
                    value={normalizeYesNo(form.lineaCorte)}
                    onChange={(e) => setKey(setForm, "lineaCorte", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="si">Si</option>
                    <option value="no">No</option>
                  </select>
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
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
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
                    disabled={sustratosImp.length >= MAX_SUSTRATO_ROWS}
                    onClick={() =>
                      setSustratosImp(
                        setForm,
                        sustratosImp.length >= MAX_SUSTRATO_ROWS
                          ? sustratosImp
                          : [...sustratosImp, { material_id: "", kg: "" }],
                      )
                    }
                  >
                    Agregar sustrato
                  </Button>
                </div>
                {renderError("sustratosImp")}
              </div>

              <div className="ot-grid ot-metrics-before-nested ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg ingresado</label>
                  <input data-field="kgIngresadoImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgIngresadoImp)} onChange={(e) => setKey(setForm,"kgIngresadoImp",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida</label>
                  <input data-field="kgSalidaImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgSalidaImp)} onChange={(e) => setKey(setForm,"kgSalidaImp",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Merma</label>
                  <input data-field="mermaImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.mermaImp)} onChange={(e) => setKey(setForm,"mermaImp",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metros</label>
                  <input data-field="metrosImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.metrosImp)} onChange={(e) => setKey(setForm,"metrosImp",e.target.value)} />
                </div>
              </div>

              </>
              ) : null}

              {canViewTintas ? (
                <WorkOrderPrintingInkTable
                  form={form}
                  tintaMateriales={tintaMateriales}
                  tintaMaterialesLoading={tintaMaterialesLoading}
                  onSetField={(k, v) => setKey(setForm, k, v)}
                />
              ) : null}

            </div>
          </div>
          ) : null}

          {/* Laminación */}
          {canViewLaminacion ? (
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
                  <input
                    data-field="gramajeAdhesivo"
                    className="ot-input"
                    value={readString(form.gramajeAdhesivo)}
                    onChange={(e) => setKey(setForm, "gramajeAdhesivo", e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="1,5 a 2,0"
                    inputMode="decimal"
                  />
                  {renderError("gramajeAdhesivo")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">Relacion mezcla</label>
                  <input
                    data-field="relacionMezcla"
                    className="ot-input"
                    value={readString(form.relacionMezcla)}
                    onChange={(e) =>
                      setKey(setForm, "relacionMezcla", e.target.value.replace(/[^0-9.,/]/g, "").replace(/\/{2,}/g, "/"))
                    }
                    placeholder="100/80"
                    inputMode="decimal"
                  />
                  {renderError("relacionMezcla")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">Observaciones</label>
                  <input className="ot-input" value={readString(form.obsLaminacion)} onChange={(e) => setKey(setForm,"obsLaminacion",e.target.value)} />
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
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
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
                      disabled={sustratosLam.length >= MAX_SUSTRATO_ROWS}
                      onClick={() =>
                        setSustratosLam(
                          setForm,
                          sustratosLam.length >= MAX_SUSTRATO_ROWS
                            ? sustratosLam
                            : [...sustratosLam, { material_id: "", kg: "" }],
                        )
                      }
                    >
                      Agregar otro sustrato
                    </Button>
                  </div>
                  {renderError("sustratosLam")}
                </div>
              </div>

              <div className="ot-grid ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg entrada</label>
                  <input data-field="kgEntradaLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgEntradaLam)} onChange={(e) => setKey(setForm,"kgEntradaLam",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida</label>
                  <input data-field="kgSalidaLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgSalidaLam)} onChange={(e) => setKey(setForm,"kgSalidaLam",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metraje</label>
                  <input data-field="metrajeLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.metrajeLam)} onChange={(e) => setKey(setForm,"metrajeLam",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Merma</label>
                  <input data-field="mermaLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.mermaLam)} onChange={(e) => setKey(setForm,"mermaLam",e.target.value)} />
                </div>
              </div>

              <div className="ot-grid ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg entrada 2 (trilam.)</label>
                  <input data-field="kgEntradaLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgEntradaLam2)} onChange={(e) => setKey(setForm,"kgEntradaLam2",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida 2 (trilam.)</label>
                  <input data-field="kgSalidaLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgSalidaLam2)} onChange={(e) => setKey(setForm,"kgSalidaLam2",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metraje 2</label>
                  <input data-field="metrajeLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.metrajeLam2)} onChange={(e) => setKey(setForm,"metrajeLam2",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Merma 2</label>
                  <input data-field="mermaLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.mermaLam2)} onChange={(e) => setKey(setForm,"mermaLam2",e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          ) : null}

          {/* Corte / Embalaje */}
          {canViewCorte ? (
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
                  <input data-field="anchoCorteFinal" className="ot-input" value={readString(form.anchoCorteFinal)} onChange={(e) => setKey(setForm,"anchoCorteFinal",e.target.value)} placeholder="320±0" />
                  {renderError("anchoCorteFinal")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">Peso bobina (Kg)</label>
                  <input data-field="pesoBobina" className="ot-input" value={readString(form.pesoBobina)} onChange={(e) => setKey(setForm,"pesoBobina",e.target.value)} placeholder="19-20" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metros/Bobina (m)</label>
                  <input data-field="metrosBobina" className="ot-input" value={readString(form.metrosBobina)} onChange={(e) => setKey(setForm,"metrosBobina",e.target.value)} placeholder="1020 ± 20" />
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
                  <input data-field="distFotoceldaBorde" className="ot-input" value={readString(form.distFotoceldaBorde)} onChange={(e) => setKey(setForm,"distFotoceldaBorde",e.target.value)} placeholder="1±1" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Dist. figura lado contrario (mm)</label>
                  <input data-field="distFiguraLadoContrario" className="ot-input" value={readString(form.distFiguraLadoContrario)} onChange={(e) => setKey(setForm,"distFiguraLadoContrario",e.target.value)} placeholder="20±1" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Dist. figura lado fotocelda (mm)</label>
                  <input data-field="distFiguraLadoFotocelda" className="ot-input" value={readString(form.distFiguraLadoFotocelda)} onChange={(e) => setKey(setForm,"distFiguraLadoFotocelda",e.target.value)} placeholder="30±1" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Max. empates</label>
                  <input data-field="maxEmpates" className="ot-input" value={readString(form.maxEmpates)} onChange={(e) => setKey(setForm,"maxEmpates",e.target.value)} placeholder="1" />
                  {renderError("maxEmpates")}
                </div>
                <div className="ot-field">
                  <label className="ot-label">Diam. bobina (mm)</label>
                  <input data-field="diamBobina" className="ot-input" value={readString(form.diamBobina)} onChange={(e) => setKey(setForm,"diamBobina",e.target.value)} placeholder="400 ± 5" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Ancho core (mm)</label>
                  <input data-field="anchoCore" className="ot-input" value={readString(form.anchoCore)} onChange={(e) => setKey(setForm,"anchoCore",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Diam. core (Plg)</label>
                  <input data-field="diamCorePlg" className="ot-input" value={readString(form.diamCorePlg)} onChange={(e) => setKey(setForm,"diamCorePlg",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Cant. cores</label>
                  <input data-field="cantCores" className="ot-input" value={readString(form.cantCores)} onChange={(e) => setKey(setForm,"cantCores",e.target.value)} />
                  {renderError("cantCores")}
                </div>
              </div>

              <div className="ot-grid ot-metrics-before-nested ot-cols-4">
                <div className="ot-field">
                  <label className="ot-label">Kg ingresados</label>
                  <input data-field="kgIngresadosCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.kgIngresadosCorte)} onChange={(e) => setKey(setForm,"kgIngresadosCorte",e.target.value)} placeholder="kg ingresados" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg salida</label>
                  <input data-field="kgSalidaCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.kgSalidaCorte)} onChange={(e) => setKey(setForm,"kgSalidaCorte",e.target.value)} />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Kg merma</label>
                  <input data-field="kgMermaCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.kgMermaCorte)} onChange={(e) => setKey(setForm,"kgMermaCorte",e.target.value)} placeholder="Ej: 10.00" />
                </div>
                <div className="ot-field">
                  <label className="ot-label">Metraje</label>
                  <input data-field="metrajeCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.metrajeCorte)} onChange={(e) => setKey(setForm,"metrajeCorte",e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          ) : null}

          {/* Observaciones + Programación */}
          {canViewProgramacion ? (
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
                      <label className="ot-label">Estado OT (modelo)</label>
                      <input
                        className="ot-input"
                        value={readString(form.estadoOt)}
                        readOnly
                      />
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Etapa tablero (modelo)</label>
                      <input
                        className="ot-input"
                        value={readString(form.etapaOt)}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : null}

          <div className="no-print mt-4 flex justify-center">
            <Button type="button" onClick={() => void guardar()} disabled={saving || loading}>
              {saving ? "Guardando…" : "Guardar orden"}
            </Button>
          </div>
        </form>
        {activeScope === "corte" ? (
          <div className="no-print mt-6 space-y-3">
            <WorkOrderCorteOpsSection
              form={form}
              setForm={setForm}
              pedidoTotalKg={Number(readNumberString(form.pedidoKg) || readNumberString(prefill.pedidoKg) || "0")}
            />
          </div>
        ) : null}
        </>
      )}
    </div>
  )
}

