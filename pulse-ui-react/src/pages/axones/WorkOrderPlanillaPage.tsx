"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ClipboardCheck,
  ClipboardList,
  Droplets,
  Eraser,
  Layers,
  NotebookPen,
  Package,
  ReceiptText,
  Save,
  Scissors,
  Shuffle,
  Wrench,
} from "./ot-planilla-icons"

import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"
import { cn } from "@/lib/utils"
import type { ClientOrderDetailRecord, LaravelPaginated, MaterialRow, ProductRecord } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

type NotificationAreaResult = {
  area: string
  status: string
  area_request?: string
  alert?: string
  note?: string
}

type NotificationSummary = {
  event: string
  work_order_id: number
  origin_area: string
  save_fingerprint?: string
  sent_to: string[]
  skipped: string[]
  errors: string[]
  areas: NotificationAreaResult[]
}

type AssignmentNotificationSummary = {
  event: string
  work_order_id: number
  priority?: string
  sent_to: string[]
  skipped?: string[]
  errors?: string[]
  areas?: NotificationAreaResult[]
}

type SaveOrdenTrabajoResponse = {
  work_order_id: number
  updated_at: string
  notification_summary?: {
    broadcast: NotificationSummary | null
    production: NotificationSummary | null
    assignment: AssignmentNotificationSummary | null
  } | null
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

function normalizeTipoImpresionEstructura(value: unknown): "superficie" | "reverso" {
  const raw = readString(value).toLowerCase().trim()
  if (raw.includes("superf")) return "superficie"
  if (raw.includes("revers")) return "reverso"
  return "reverso"
}

function toDateInputValue(iso: string | null | undefined): string {
  const s = readString(iso).trim()
  if (!s) return ""
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

function sumClientOrderLineQuantities(lines: ClientOrderDetailRecord["lines"]): string | null {
  if (!lines?.length) return null
  let sum = 0
  for (const l of lines) {
    const q = readNumberString(l.quantity).trim().replace(",", ".")
    if (!q) continue
    const n = Number(q)
    if (!Number.isFinite(n)) continue
    sum += n
  }
  if (!(sum > 0)) return null
  return sum.toFixed(3)
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
  const hasMinus = trimmed.startsWith("-")
  const digits = v.replace(/\D/g, "")
  if (!digits) return "-"
  return hasMinus ? `-${digits}` : digits
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

function toTitleArea(area: string): string {
  const raw = String(area || "").trim().toLowerCase()
  if (raw === "impresion") return "Impresión"
  if (raw === "laminacion") return "Laminación"
  if (raw === "corte") return "Corte"
  if (raw === "tintas") return "Tintas"
  if (raw === "montaje") return "Montaje"
  if (raw === "planificacion") return "Planificación"
  return area || "desconocida"
}

const PROGRAMACION_AREAS = ["impresion", "laminacion", "corte", "tintas"] as const
type ProgramacionAreaId = (typeof PROGRAMACION_AREAS)[number]

function readProgramacionAreas(form: Record<string, unknown>): string[] {
  const v = form.programacionAreas
  if (!Array.isArray(v)) return []
  const allowed = PROGRAMACION_AREAS as readonly string[]
  return v.filter((x): x is string => typeof x === "string" && allowed.includes(x))
}

function AreasMultiCheckbox({
  value,
}: {
  value: string[]
}) {
  const labels: Record<ProgramacionAreaId, string> = {
    impresion: "Impresión",
    laminacion: "Laminación",
    corte: "Corte",
    tintas: "Tintas",
  }
  return (
    <div className="flex flex-wrap gap-4 pt-1">
      {PROGRAMACION_AREAS.map((area) => (
        <label key={area} className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={value.includes(area)}
            disabled
          />
          <span>{labels[area]}</span>
        </label>
      ))}
    </div>
  )
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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Cabecera (orden de cliente) + datos del producto: solo criterio del usuario;
 * el relleno al azar no modifica estas claves aunque estén vacías.
 */
const USER_ONLY_RANDOM_SKIP = new Set<string>([
  "fechaOrden",
  "numeroOrden",
  "document_number",
  "pedidoKg",
  "maquina",
  "planchasReferencia",
  "metrosEstimados",
  "cliente",
  "clienteRif",
  "producto",
  "tipoImpresion",
  "tipoImpresionEstructura",
  "cpe",
  "mpps",
  "codigoBarra",
  "estructuraMaterial",
  "estructuraCapa1",
  "estructuraCapa1Rev",
  "estructuraCapa2Rev",
  "estructuraCapa3Rev",
  "client_order_code",
  "client_order_reference",
  "estadoOt",
  "etapaOt",
])

/** Datos del pedido / maestro (`prefill`): no los pisa el relleno al azar. */
const PREFILL_RANDOM_BLOCKLIST = new Set<string>([
  "cliente",
  "clienteRif",
  "producto",
  "cpe",
  "mpps",
  "pedidoKg",
  "fechaOrden",
  "numeroOrden",
  "client_order_code",
  "client_order_reference",
  "estadoOt",
  "etapaOt",
  "tipoImpresion",
  "estructuraMaterial",
])

function isEmptyForRandomFill(key: string, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (Array.isArray(value)) {
    if (value.length === 0) return true
    if (key === "sustratosVirgenImp" || key === "sustratosVirgenLam") {
      return (value as Array<Record<string, unknown>>).every(
        (row) => !readString(row.material_id).trim() && !readNumberString(row.kg).trim(),
      )
    }
    return false
  }
  const s = readString(value).trim() || readNumberString(value).trim()
  return s === "" || s === "-"
}

function isBlockedFromRandomByPrefill(key: string, prefill: Record<string, unknown>): boolean {
  if (!PREFILL_RANDOM_BLOCKLIST.has(key)) return false
  return !isEmptyForRandomFill(key, prefill[key])
}

function buildRandomPlanillaPatch(prev: Record<string, unknown>): Record<string, unknown> {
  const sImp = getSustratosImp(prev)
  const sLam = getSustratosLam(prev)
  const tipM = randomInt(0, 1) === 0 ? "Reverso" : "Superficie"
  const sustratosVirgenImp = [
    { material_id: readString(sImp[0]?.material_id), kg: String(randomInt(15, 120)) },
  ]
  const sustratosVirgenLam = [
    { material_id: readString(sLam[0]?.material_id), kg: String(randomInt(200, 520)) },
  ]

  const tintas: Record<string, unknown> = {}
  const demoColors = [
    "AMARILLO PROCESO — Superficie · TINSUP-0002",
    "CYAN PROCESO — Laminada · BL-1132",
    "MAGENTA PROCESO — Laminada · TINLAM-0002",
    "NEGRO PROCESO — Laminada · TINLAM-0003",
    "BLANCO — TINW-0001",
    "ROJO — TINR-0004",
    "VERDE — TING-0002",
    "AZUL — TINB-0006",
  ]
  for (let n = 1; n <= 8; n += 1) {
    tintas[`tintaColor${n}`] = demoColors[(n - 1) % demoColors.length] ?? demoColors[0]
    tintas[`tintaAnilox${n}`] = `${randomInt(2, 6)}.${randomInt(0, 9)}${randomInt(0, 9)}`
    tintas[`tintaVisc${n}`] = String(randomInt(12, 28))
    tintas[`tintaObs${n}`] = `Obs. tinta ${n} (al azar)`
  }

  return {
    tipoImpresionMontaje: tipM,
    frecuencia: `${randomInt(200, 360)}±${randomInt(1, 5)}`,
    numBandas: String(randomInt(1, 6)),
    anchoCorteMontaje: `${randomInt(300, 450)}±${randomInt(1, 4)}`,
    numRepeticion: String(randomInt(1, 8)),
    desarrollo: String(randomInt(380, 520)),
    anchoMontaje: String(randomInt(280, 440)),
    figuraEmbobinadoMontaje: String(randomInt(1, 8)),
    numColores: String(randomInt(1, 8)),
    obsMontaje: "Obs. montaje (relleno al azar)",
    pinonImp: String(randomInt(7000, 9200)),
    lineaCorte: randomInt(0, 1) === 0 ? "si" : "no",
    figEmbImpDisplay: String(randomInt(1, 8)),
    sustratosVirgenImp,
    kgIngresadoImp: String(randomInt(1, 50)),
    kgSalidaImp: String(randomInt(10, 120)),
    mermaImp: String(randomInt(1, 20)),
    metrosImp: String(randomInt(200, 5000)),
    figuraEmbobinadoLam: String(randomInt(1, 8)),
    gramajeAdhesivo: `${randomInt(1, 3)},${randomInt(0, 9)}`,
    relacionMezcla: `${randomInt(80, 120)}/${randomInt(50, 90)}`,
    obsLaminacion: "Obs. laminación (relleno al azar)",
    sustratosVirgenLam,
    kgEntradaLam: String(randomInt(5, 40)),
    kgSalidaLam: String(randomInt(5, 40)),
    metrajeLam: String(randomInt(100, 5000)),
    mermaLam: String(randomInt(1, 15)),
    kgEntradaLam2: String(randomInt(0, 30)),
    kgSalidaLam2: String(randomInt(0, 30)),
    metrajeLam2: String(randomInt(0, 3000)),
    mermaLam2: String(randomInt(0, 12)),
    anchoCorteFinal: `${randomInt(310, 360)}±${randomInt(0, 2)}`,
    pesoBobina: `${randomInt(15, 22)}-${randomInt(23, 28)}`,
    metrosBobina: `${randomInt(800, 1200)} ± ${randomInt(10, 40)}`,
    orientacionEmbalaje: String(randomInt(1, 4)),
    ubicFotoceldaCorte: randomInt(0, 1) === 0 ? "Borde líder" : "Borde arrastre",
    distFotoceldaBorde: `${randomInt(1, 3)}±${randomInt(1, 2)}`,
    distFiguraLadoContrario: `${randomInt(15, 35)}±${randomInt(1, 3)}`,
    distFiguraLadoFotocelda: `${randomInt(20, 45)}±${randomInt(1, 3)}`,
    maxEmpates: String(randomInt(1, 3)),
    diamBobina: `${randomInt(380, 450)} ± ${randomInt(3, 8)}`,
    anchoCore: `${randomInt(400, 480)}±${randomInt(2, 6)}`,
    diamCorePlg: String(randomInt(3, 10)),
    cantCores: String(randomInt(1, 4)),
    kgIngresadosCorte: String(randomInt(50, 400)),
    kgSalidaCorte: String(randomInt(40, 380)),
    kgMermaCorte: String(randomInt(1, 35)),
    metrajeCorte: String(randomInt(500, 9000)),
    observacionesGenerales: "Observaciones generales (relleno al azar para pruebas).",
    fechaInicio: `2026-${String(randomInt(6, 11)).padStart(2, "0")}-10`,
    fechaEntrega: `2026-${String(randomInt(7, 12)).padStart(2, "0")}-20`,
    ...tintas,
  }
}

function computeRandomFill(
  prevForm: Record<string, unknown>,
  prefill: Record<string, unknown>,
): { next: Record<string, unknown>; filled: number } {
  const merged: Record<string, unknown> = mergePrefill(prefill, prevForm)
  const patch = buildRandomPlanillaPatch(prevForm)
  const next: Record<string, unknown> = { ...prevForm }
  let filled = 0

  const tryScalar = (key: string, val: unknown) => {
    if (USER_ONLY_RANDOM_SKIP.has(key)) return
    if (isBlockedFromRandomByPrefill(key, prefill)) return
    if (!isEmptyForRandomFill(key, merged[key])) return
    next[key] = val
    merged[key] = val
    filled += 1
  }

  for (const [key, val] of Object.entries(patch)) {
    if (key === "sustratosVirgenImp" || key === "sustratosVirgenLam") continue
    tryScalar(key, val)
  }

  if (!isBlockedFromRandomByPrefill("sustratosVirgenImp", prefill) && isEmptyForRandomFill("sustratosVirgenImp", merged.sustratosVirgenImp)) {
    next.sustratosVirgenImp = patch.sustratosVirgenImp
    merged.sustratosVirgenImp = patch.sustratosVirgenImp
    filled += 1
  }

  if (!isBlockedFromRandomByPrefill("sustratosVirgenLam", prefill) && isEmptyForRandomFill("sustratosVirgenLam", merged.sustratosVirgenLam)) {
    next.sustratosVirgenLam = patch.sustratosVirgenLam
    merged.sustratosVirgenLam = patch.sustratosVirgenLam
    filled += 1
  }

  const impAfter = getSustratosImp(next)
  next.sustratoVirgenImp1 = readString(impAfter[0]?.material_id)
  next.kgUtilizarImp1 = readString(impAfter[0]?.kg)

  return { next, filled }
}

type PendingHeaderAction = "view" | "random" | "clear" | "save"

function getHeaderConfirmCopy(action: PendingHeaderAction, isDraftRoute: boolean) {
  switch (action) {
    case "view":
      return {
        title: "Salir a la lista de órdenes",
        description: "Saldrá de la planilla. Los cambios no guardados se perderán.",
        cta: "Salir",
      }
    case "random":
      return {
        title: "Rellenar con datos al azar",
        description:
          "Se rellenarán campos vacíos de las áreas técnicas con valores al azar. ¿Continuar?",
        cta: "Rellenar",
      }
    case "clear":
      return {
        title: "Limpiar formulario",
        description:
          "Se restablece la planilla a la precarga (cliente/producto/pedido). Se pierden los demás cambios sin guardar.",
        cta: "Limpiar",
      }
    case "save":
      return isDraftRoute
        ? {
            title: "Guardar orden de trabajo",
            description:
              "Se creará la OT, se guardará la planilla y se notificará a las áreas. ¿Continuar?",
            cta: "Guardar",
          }
        : {
            title: "Guardar cambios",
            description: "Se guardarán los cambios en el servidor.",
            cta: "Guardar",
          }
  }
}

export default function WorkOrderPlanillaPage() {
  const nav = useNavigate()
  const { woId } = useParams<{ woId: string }>()
  const [searchParams] = useSearchParams()
  const woIdRaw = readString(woId)
  const id = Number(woIdRaw)
  const isDraftRoute = woIdRaw === "nueva"
  const draftCoId = useMemo(() => {
    if (!isDraftRoute) return null
    const raw = readString(searchParams.get("client_order_id")).trim()
    const n = Number(raw)
    if (!raw || !Number.isFinite(n) || n < 1) return null
    return n
  }, [isDraftRoute, searchParams])
  const draftImportMaterialFromCo = useMemo(() => {
    if (!isDraftRoute) return false
    return readString(searchParams.get("import_material")).trim() === "1"
  }, [isDraftRoute, searchParams])
  const draftMaquinaQuery = useMemo(() => {
    if (!isDraftRoute) return ""
    return readString(searchParams.get("maquina")).trim()
  }, [isDraftRoute, searchParams])
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
  const [rellenoAzarDialogOpen, setRellenoAzarDialogOpen] = useState(false)
  const [rellenoAzarCount, setRellenoAzarCount] = useState(0)
  const [pendingHeaderAction, setPendingHeaderAction] = useState<PendingHeaderAction | null>(null)
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

  const draftImportMaterialRef = useRef(draftImportMaterialFromCo)
  draftImportMaterialRef.current = draftImportMaterialFromCo

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
    if (isDraftRoute) return
    if (!Number.isFinite(id) || id < 1) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Aquí se hace una petición a la API para obtener los datos de la orden de trabajo con el id dado.
      // La función apiFetch hace una solicitud HTTP (probablemente por GET) al endpoint 'work-orders/{id}/orden-trabajo'
      // y espera recibir como respuesta un objeto que cumple con el tipo OrdenTrabajoPayload.
      // El resultado de la petición se guarda en la variable 'payload', que luego se usa para poblar el estado del formulario, cliente, producto, etc.
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
      {
        const pRec = p as Record<string, unknown>
        merged.programacionAreas = [...PROGRAMACION_AREAS]
        if (!readString(merged.priority).trim()) {
          merged.priority = readString(pRec.priority) || "normal"
        }
        if (!Object.prototype.hasOwnProperty.call(merged, "programacionMotivo")) {
          merged.programacionMotivo = ""
        }
      }
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
  }, [id, isDraftRoute])

  const loadDraft = useCallback(async () => {
    if (!isDraftRoute || !draftCoId) return
    setLoading(true)
    try {
      const co = await apiFetch<ClientOrderDetailRecord>(`client-orders/${draftCoId}`)
      const lineWithProduct = co.lines?.find((l) => {
        const pid = l.product_id
        return pid != null && Number.isFinite(Number(pid)) && Number(pid) > 0
      })
      const productId =
        lineWithProduct?.product_id != null && Number.isFinite(Number(lineWithProduct.product_id))
          ? Number(lineWithProduct.product_id)
          : null

      let product: ProductRecord | null = null
      if (productId) {
        try {
          product = await apiFetch<ProductRecord>(`products/${productId}`)
        } catch {
          product = null
        }
      }

      const pedidoKg = sumClientOrderLineQuantities(co.lines ?? [])

      const p: Record<string, unknown> = {
        fechaOrden: toDateInputValue(co.ordered_at) || new Date().toISOString().slice(0, 10),
        // Mostrar el código real de la Orden de Producción (OC) incluso en modo "nueva".
        numeroOrden: readString(co.code) || "OC",
        pedidoKg,
        cliente: co.client?.name ?? null,
        clienteRif: co.client?.rif ?? null,
        producto: product?.name ?? lineWithProduct?.product?.name ?? null,
        estructuraMaterial: product?.structure ?? null,
        cpe: product?.cpe ?? null,
        mpps: product?.mps ?? null,
        codigoBarra: null,
        client_order_code: co.code,
        client_order_reference: null,
        estadoOt: "open",
        etapaOt: "nueva",
        priority: "normal",
        programacionAreas: [...PROGRAMACION_AREAS] as string[],
        programacionMotivo: "",
      }
      if (product) {
        Object.assign(p, prefillFromProduct(product))
      }

      const merged = mergePrefill(p, {})
      if (readString(merged.cliente)) merged.cliente = readString(merged.cliente)
      if (Object.prototype.hasOwnProperty.call(p, "clienteRif")) merged.clienteRif = p.clienteRif
      if (readString(merged.producto)) merged.producto = readString(merged.producto)
      merged.estadoOt = statusOtLabel(p.estadoOt)
      merged.etapaOt = stageOtLabel(p.etapaOt)
      {
        const rawTipo = readString(merged.tipoImpresionEstructura) || readString(merged.tipoImpresion)
        if (rawTipo) merged.tipoImpresionEstructura = normalizeTipoImpresionEstructura(rawTipo)
      }

      if (draftMaquinaQuery) {
        merged.maquina = draftMaquinaQuery
        merged.tipoImpresionEstructura = normalizeTipoImpresionEstructura(
          readString(merged.tipoImpresionEstructura) || readString(merged.tipoImpresion),
        )
      }

      if (!Array.isArray(merged.sustratosVirgenImp)) {
        const mid = readString(merged.sustratoVirgenImp1)
        const kg = readNumberString(merged.kgUtilizarImp1)
        if (mid || kg) merged.sustratosVirgenImp = [{ material_id: mid, kg }]
      }

      setPrefill(p)
      setWoClientId(Number.isFinite(Number(co.client_id)) ? Number(co.client_id) : null)
      setWoProductId(productId)
      setForm(merged)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la orden de producción (Pedido del cliente) para el borrador.")
      setPrefill({})
      setForm({})
      setWoClientId(null)
      setWoProductId(null)
    } finally {
      setLoading(false)
    }
  }, [draftCoId, draftMaquinaQuery, isDraftRoute])

  useEffect(() => {
    if (isDraftRoute) void loadDraft()
    else void load()
    void loadMaterials()
  }, [isDraftRoute, load, loadDraft, loadMaterials])

  useEffect(() => {
    if (isDraftRoute) return
    if (!Number.isFinite(id) || id < 1) return
    if (isFullAccess) return
    if (role === "impresion" || role === "printing") {
      nav(`/ordenes-trabajo/${id}/produccion?tab=printing`, { replace: true })
    }
  }, [id, isDraftRoute, isFullAccess, nav, role])

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
      if (!isDraftRoute && (!Number.isFinite(id) || id < 1)) return
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

      if (isDraftRoute) {
        toast.message("Producto actualizado en el borrador. Se guardará al pulsar Guardar orden.")
        return
      }

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
    [id, isDraftRoute],
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
        ; (field as HTMLInputElement).focus({ preventScroll: true })
      }
    }, prefersReducedMotion ? 0 : 140)
  }, [])

  async function guardar() {
    if (isDraftRoute) {
      if (!draftCoId) {
        toast.error(
          "Falta la orden de producción (Pedido del cliente, OC) en la URL. Vuelva a la lista e inténtelo otra vez.",
        )
        return
      }
    } else if (!Number.isFinite(id) || id < 1) {
      return
    }
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
    const planchasRef = readString(form.planchasReferencia).trim()
    if (planchasRef && !/^\d+$/.test(planchasRef)) {
      addError("planchasReferencia", "Ref. planchas debe contener solo números.")
    }
    const metrosEstimados = readNumberString(form.metrosEstimados).trim()
    // Regla: permitir "-" como valor explícito (sin estimar / no aplica).
    // También permitir negativo tipo "-343355" si se requiere registrar como tal.
    if (metrosEstimados !== "-" && !metrosEstimados) {
      addError("metrosEstimados", "Metros Est. es obligatorio.")
    } else if (metrosEstimados !== "-" && !/^-?\d+$/.test(metrosEstimados)) {
      addError("metrosEstimados", "Metros Est. debe ser numérico (puede ser negativo).")
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
      const desarrollo = readString(form.desarrollo).trim()
      if (!desarrollo) {
        addError("desarrollo", "Desarrollo (mm) es obligatorio.")
      } else if (!isMetricLike(desarrollo)) {
        addError("desarrollo", "Formato válido: 330±2, 330 o 329-331.")
      }
      const anchoMontaje = readString(form.anchoMontaje).trim()
      if (!anchoMontaje) {
        addError("anchoMontaje", "Ancho montaje (mm) es obligatorio.")
      } else if (!isMetricLike(anchoMontaje)) {
        addError("anchoMontaje", "Formato válido: 330±2, 330 o 329-331.")
      }
      if (!isPositiveIntLike(form.numColores)) {
        addError("numColores", "Debe ser entero mayor a 0.")
      }
    }

    if (canViewImpresion) {
      const pinon = readString(form.pinonImp).trim()
      if (!pinon) {
        addError("pinonImp", "Piñón (dientes) es obligatorio.")
      } else if (!isPositiveIntLike(pinon)) {
        addError("pinonImp", "Piñón debe ser entero mayor a 0.")
      }

      const lineaCorte = normalizeYesNo(form.lineaCorte)
      if (!lineaCorte) {
        addError("lineaCorte", "Línea de corte es obligatoria.")
      }

      const figEmbImpDisplay = readString(form.figEmbImpDisplay).trim()
      if (!figEmbImpDisplay) {
        addError("figEmbImpDisplay", "Figura emb. (1-8) es obligatoria.")
      } else if (!/^[1-8]$/.test(figEmbImpDisplay)) {
        addError("figEmbImpDisplay", "Figura emb. debe ser un número del 1 al 8.")
      }

      const sImpRows = getSustratosImp(form)
      const anySustratoFilled = sImpRows.some(
        (r) => readString(r.material_id).trim() || readNumberString(r.kg).trim(),
      )
      if (!anySustratoFilled) {
        addError("sustratosImp", "Debe seleccionar al menos un sustrato y su Kg a utilizar.")
      } else {
        for (let i = 0; i < sImpRows.length; i += 1) {
          const mid = readString(sImpRows[i]?.material_id).trim()
          const kg = readNumberString(sImpRows[i]?.kg).trim()
          if (!mid && !kg) continue
          if (!mid) {
            addError("sustratosImp", `Seleccione el material del sustrato ${i + 1}.`)
            break
          }
          if (!kg) {
            addError("sustratosImp", `Indique los Kg a utilizar del sustrato ${i + 1}.`)
            break
          }
          if (!isDecimalLike(kg) || Number(kg.replace(",", ".")) <= 0) {
            addError("sustratosImp", `Kg a utilizar del sustrato ${i + 1} debe ser numérico y mayor a 0.`)
            break
          }
        }
      }

      const impRequiredDecimals: Array<[key: string, label: string, value: unknown]> = [
        ["kgIngresadoImp", "Kg ingresado", form.kgIngresadoImp],
        ["kgSalidaImp", "Kg salida", form.kgSalidaImp],
        ["mermaImp", "Merma", form.mermaImp],
        ["metrosImp", "Metros", form.metrosImp],
      ]
      for (const [key, label, value] of impRequiredDecimals) {
        const s = readNumberString(value).trim()
        if (!s) addError(key, `Impresión: ${label} es obligatorio.`)
      }
    }

    if (canViewLaminacion) {
      const figuraLam = readString(form.figuraEmbobinadoLam).trim()
      if (!figuraLam) {
        addError("figuraEmbobinadoLam", "Figura embobinado es obligatoria.")
      } else if (!/^[1-8]$/.test(figuraLam)) {
        addError("figuraEmbobinadoLam", "Figura embobinado debe ser un número del 1 al 8.")
      }

      const gramaje = readString(form.gramajeAdhesivo).trim()
      if (!gramaje) {
        addError("gramajeAdhesivo", "Gramaje adhesivo es obligatorio.")
      } else if (!isDecimalLike(gramaje)) {
        addError("gramajeAdhesivo", "Solo números decimales (ej: 1.5 o 2,0).")
      }
      const relacion = readString(form.relacionMezcla).trim()
      if (!relacion) {
        addError("relacionMezcla", "Relación mezcla es obligatoria.")
      } else if (!isRatioLike(relacion)) {
        addError("relacionMezcla", "Use formato 100/80.")
      }

      const sLamRows = getSustratosLam(form)
      const anySustratoFilled = sLamRows.some(
        (r) => readString(r.material_id).trim() || readNumberString(r.kg).trim(),
      )
      if (!anySustratoFilled) {
        addError("sustratosLam", "Debe seleccionar al menos un sustrato y su Kg a utilizar.")
      } else {
        for (let i = 0; i < sLamRows.length; i += 1) {
          const mid = readString(sLamRows[i]?.material_id).trim()
          const kg = readNumberString(sLamRows[i]?.kg).trim()
          if (!mid && !kg) continue
          if (!mid) {
            addError("sustratosLam", `Seleccione el material del sustrato ${i + 1}.`)
            break
          }
          if (!kg) {
            addError("sustratosLam", `Indique los Kg a utilizar del sustrato ${i + 1}.`)
            break
          }
          if (!isDecimalLike(kg) || Number(kg.replace(",", ".")) <= 0) {
            addError("sustratosLam", `Kg a utilizar del sustrato ${i + 1} debe ser numérico y mayor a 0.`)
            break
          }
        }
      }

      const lamRequiredDecimals: Array<[key: string, label: string, value: unknown]> = [
        ["kgEntradaLam", "Kg entrada", form.kgEntradaLam],
        ["kgSalidaLam", "Kg salida", form.kgSalidaLam],
        ["metrajeLam", "Metraje", form.metrajeLam],
        ["mermaLam", "Merma", form.mermaLam],
      ]
      for (const [key, label, value] of lamRequiredDecimals) {
        const s = readNumberString(value).trim()
        if (!s) addError(key, `Laminación: ${label} es obligatorio.`)
      }

      const lam2Keys: Array<[key: string, label: string, value: unknown]> = [
        ["kgEntradaLam2", "Kg entrada 2", form.kgEntradaLam2],
        ["kgSalidaLam2", "Kg salida 2", form.kgSalidaLam2],
        ["metrajeLam2", "Metraje 2", form.metrajeLam2],
        ["mermaLam2", "Merma 2", form.mermaLam2],
      ]
      const lam2Any = lam2Keys.some(([, , v]) => readNumberString(v).trim())
      if (lam2Any) {
        for (const [key, label, value] of lam2Keys) {
          const s = readNumberString(value).trim()
          if (!s) addError(key, `Laminación: ${label} es obligatorio si usa trilam.`)
        }
      }
    }

    if (canViewCorte) {
      const requiredMetricChecks: Array<[key: string, label: string, value: unknown]> = [
        ["anchoCorteFinal", "Ancho corte (mm)", form.anchoCorteFinal],
        ["pesoBobina", "Peso bobina (Kg)", form.pesoBobina],
        ["metrosBobina", "Metros/Bobina (m)", form.metrosBobina],
        ["distFotoceldaBorde", "Dist. fotocelda al borde (mm)", form.distFotoceldaBorde],
        ["distFiguraLadoContrario", "Dist. figura lado contrario (mm)", form.distFiguraLadoContrario],
        ["distFiguraLadoFotocelda", "Dist. figura lado fotocelda (mm)", form.distFiguraLadoFotocelda],
        ["diamBobina", "Diám. bobina (mm)", form.diamBobina],
        ["anchoCore", "Ancho core (mm)", form.anchoCore],
        ["diamCorePlg", "Diám. core (Plg)", form.diamCorePlg],
      ]
      for (const [key, label, value] of requiredMetricChecks) {
        const s = readString(value).trim()
        if (!s) {
          addError(key, `Corte: ${label} es obligatorio.`)
          continue
        }
        if (!isMetricLikeOrNA(s)) {
          addError(key, `Corte: ${label} debe tener formato válido (ej: 400±5, 19-20, 460 o N/A).`)
        }
      }

      const orient = readString(form.orientacionEmbalaje).trim()
      if (!orient) {
        addError("orientacionEmbalaje", "Corte: Figura embobinado es obligatoria.")
      }

      const ubic = readString(form.ubicFotoceldaCorte).trim()
      if (!ubic) {
        addError("ubicFotoceldaCorte", "Corte: Ubic. fotocelda es obligatoria.")
      }

      const wholeNumberRequired: Array<[key: string, label: string, value: unknown]> = [
        ["maxEmpates", "Max. empates", form.maxEmpates],
        ["cantCores", "Cant. cores", form.cantCores],
      ]
      for (const [key, label, value] of wholeNumberRequired) {
        const s = readString(value).trim()
        if (!s) {
          addError(key, `Corte: ${label} es obligatorio.`)
          continue
        }
        if (!isPositiveIntLike(s)) {
          addError(key, `Corte: ${label} debe ser entero mayor a 0.`)
        }
      }

      const decimalRequired: Array<[key: string, label: string, value: unknown]> = [
        ["kgIngresadosCorte", "Kg ingresados", form.kgIngresadosCorte],
        ["kgSalidaCorte", "Kg salida", form.kgSalidaCorte],
        ["kgMermaCorte", "Kg merma", form.kgMermaCorte],
        ["metrajeCorte", "Metraje", form.metrajeCorte],
      ]
      for (const [key, label, value] of decimalRequired) {
        const s = readNumberString(value).trim()
        if (!s) {
          addError(key, `Corte: ${label} es obligatorio.`)
          continue
        }
        if (!isDecimalLike(s)) {
          addError(key, `Corte: ${label} debe ser numérico.`)
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

    const programacionAreas = readProgramacionAreas(form)
    const programacionMotivo = readString(form.programacionMotivo).trim()

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
      let workOrderId = id
      if (isDraftRoute) {
        const importMaterial = draftImportMaterialRef.current
        const created = await apiFetch<{ id: number }>("work-orders", {
          method: "POST",
          body: JSON.stringify({
            client_order_id: draftCoId,
            ...(woProductId ? { product_id: woProductId } : {}),
            import_client_order_lines: importMaterial,
            auto_create_material_request: importMaterial,
            originating_area: "printing",
            board_stage: "nueva",
          }),
        })
        workOrderId = created.id
      }

      const rowsImp = getSustratosImp(form)
      const formOut: Record<string, unknown> = {
        ...form,
        sustratosVirgenImp: rowsImp,
        sustratoVirgenImp1: rowsImp[0]?.material_id ?? "",
        kgUtilizarImp1: rowsImp[0]?.kg ?? "",
        // Esta parte del código asegura que los campos "cliente", "clienteRif" y "producto" que se guardarán en el servidor
        // siempre tengan el valor más actualizado y consistente. 
        // Toma el valor que viene como "prefill.*" (es decir, el proporcionado desde el backend, usualmente válido y correcto),
        // y si no existe, toma el valor actual que el usuario ha editado en el formulario ("form.*").
        cliente: readString(prefill.cliente) || readString(form.cliente),
        clienteRif: readString(prefill.clienteRif) || readString(form.clienteRif),
        producto: readString(prefill.producto) || readString(form.producto),

        // Luego, realiza una petición HTTP (PUT) al backend para guardar el formulario actualizado.
        // La información enviada será el objeto "formOut", que contiene todos los datos del formulario incluyendo los campos anteriores.
        // apiFetch hace la llamada HTTP al endpoint de la orden de trabajo con su id, enviando el formulario serializado como JSON.
      }
      const priorityOut =
        readString(form.priority).toLowerCase() === "urgente"
          ? "urgente"
          : readString(form.priority).toLowerCase() === "alta"
            ? "alta"
            : "normal"

      const saveRes = await apiFetch<SaveOrdenTrabajoResponse>(`work-orders/${workOrderId}/orden-trabajo`, {
        method: "PUT",
        body: JSON.stringify({
          form: formOut,
          priority: priorityOut,
          assigned_areas: programacionAreas,
          assignment_reason: programacionMotivo,
        }),
      })
      await apiFetch(`work-orders/${workOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: "impresion" }),
      })
      const summary = saveRes.notification_summary?.broadcast
      const sentTo = summary?.sent_to ?? []
      const skipped = summary?.skipped ?? []
      const assignSummary = saveRes.notification_summary?.assignment
      const assignSent = assignSummary?.sent_to ?? []
      const sentLabel = sentTo.length
        ? sentTo.map((a) => toTitleArea(a)).join(", ")
        : "ninguna"
      const assignLabel =
        assignSent.length > 0 ? assignSent.map((a) => toTitleArea(a)).join(", ") : null
      let toastMsg = `Orden guardada. Notificación broadcast a ${sentTo.length} área(s): ${sentLabel}.`
      if (assignLabel) {
        toastMsg += ` Asignación dirigida a ${assignSent.length} área(s): ${assignLabel}.`
      }
      toast.success(toastMsg)
      console.groupCollapsed("[OT] Resumen de notificaciones")
      console.info("work_order_id:", saveRes.work_order_id)
      console.info("updated_at:", saveRes.updated_at)
      console.info("broadcast_event:", summary?.event ?? "N/A")
      console.info("sent_to:", sentTo)
      console.info("skipped:", skipped)
      console.info("assignment_sent_to:", assignSent)
      console.table(summary?.areas ?? [])
      console.groupEnd()
      window.dispatchEvent(
        new CustomEvent("alerts:refresh", {
          detail: {
            source: "work-order-planilla-save",
            work_order_id: saveRes.work_order_id,
          },
        }),
      )
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
    const p = prefill as Record<string, unknown>
    const base: Record<string, unknown> = { ...prefill }
    base.programacionAreas = [...PROGRAMACION_AREAS]
    base.priority = readString(p.priority) || "normal"
    base.programacionMotivo = ""
    setForm(base)
    setFieldErrors({})
    toast.message("Formulario limpiado.")
  }

  const rellenarDatosAlAzar = useCallback(() => {
    const { next, filled } = computeRandomFill(formRef.current, prefillRef.current)
    setForm(next)
    setFieldErrors({})
    setRellenoAzarCount(filled)
    setRellenoAzarDialogOpen(true)
  }, [])

  if (isDraftRoute && !draftCoId) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          No se indicó una orden de producción (Pedido del cliente, OC) para esta nueva orden.
        </p>
        <Link to="/ordenes-trabajo" className="underline">
          Volver a la lista
        </Link>
      </div>
    )
  }

  if (!isDraftRoute && (!Number.isFinite(id) || id < 1)) {
    return (
      <div className="p-6">
        <p className="text-destructive">ID inválido.</p>
        <Link to="/ordenes-trabajo" className="underline">
          Volver
        </Link>
      </div>
    )
  }

  const headerConfirmCopy =
    pendingHeaderAction !== null
      ? getHeaderConfirmCopy(pendingHeaderAction, isDraftRoute)
      : null

  const jumpToArea = useCallback(
    (fieldKey: string) => {
      if (loading) return
      focusFieldSoft(fieldKey)
    },
    [focusFieldSoft, loading],
  )

  return (
    <div className="ax-ot p-2 sm:p-4 md:p-6">
      {/* Header (Ver órdenes / Rellenar al azar / Limpiar / Guardar) */}
      <div className="no-print mb-4 ax-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Orden de trabajo</h2>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {isDraftRoute ? (
              <>
                Esta pantalla prepara una <span className="font-medium text-foreground">nueva</span> orden a partir de la orden de
                producción (Pedido del cliente); aún no hay
                fila en base de datos. Al pulsar <span className="font-medium text-foreground">Guardar orden</span> se crea la OT, se revisan los
                obligatorios y la verá en la lista de órdenes de trabajo.
              </>
            ) : (
              <>
                Esta pantalla es la planilla digital de <span className="font-medium text-foreground">esta</span> orden. Edita los campos que
                correspondan y, cuando quieras guardar los cambios en el servidor, pulsa{" "}
                <span className="font-medium text-foreground">Guardar orden</span>.
              </>
            )}
          </p>
        </div>
        <TooltipProvider delayDuration={150}>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Ver órdenes"
                  onClick={() => setPendingHeaderAction("view")}
                >
                  <ClipboardList className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Ver órdenes</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Rellenar datos con datos al azar"
                  onClick={() => setPendingHeaderAction("random")}
                  disabled={loading || isRestrictedAreaView}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Rellenar al azar</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Limpiar formulario"
                  onClick={() => setPendingHeaderAction("clear")}
                  disabled={loading || isRestrictedAreaView}
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Limpiar formulario</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => setPendingHeaderAction("save")}
                  disabled={saving || loading}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Guardando…" : "Guardar orden"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Guardar orden</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {isDraftRoute ? (
        <TooltipProvider delayDuration={150}>
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 print:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Ir a Montaje"
                  onClick={() => jumpToArea("frecuencia")}
                  disabled={loading}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-200",
                    "bg-primary text-primary-foreground hover:scale-110",
                    "disabled:opacity-50 disabled:hover:scale-100",
                  )}
                >
                  <Wrench className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Montaje</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Ir a Impresión"
                  onClick={() => jumpToArea("pinonImp")}
                  disabled={loading}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-200",
                    "bg-primary text-primary-foreground hover:scale-110",
                    "disabled:opacity-50 disabled:hover:scale-100",
                  )}
                >
                  <Droplets className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Impresión</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Ir a Tintas"
                  onClick={() => jumpToArea("tintaColor1")}
                  disabled={loading}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-200",
                    "bg-primary text-primary-foreground hover:scale-110",
                    "disabled:opacity-50 disabled:hover:scale-100",
                  )}
                >
                  <NotebookPen className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Tintas</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Ir a Laminación"
                  onClick={() => jumpToArea("gramajeAdhesivo")}
                  disabled={loading}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-200",
                    "bg-primary text-primary-foreground hover:scale-110",
                    "disabled:opacity-50 disabled:hover:scale-100",
                  )}
                >
                  <Layers className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Laminación</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Ir a Corte / Embalaje"
                  onClick={() => jumpToArea("anchoCorteFinal")}
                  disabled={loading}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-200",
                    "bg-primary text-primary-foreground hover:scale-110",
                    "disabled:opacity-50 disabled:hover:scale-100",
                  )}
                >
                  <Scissors className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Corte</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      ) : null}

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
                {/* Cabecera vinculada a la orden de producción (Pedido del cliente) */}
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
                          onChange={() => { }}
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
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={readString(form.planchasReferencia)}
                          onChange={(ev) =>
                            setKey(setForm, "planchasReferencia", sanitizePositiveIntInput(ev.target.value))
                          }
                          placeholder="Ej: 067"
                          disabled={!canEditShared}
                        />
                        {renderError("planchasReferencia")}
                      </div>
                    </div>

                    <div className="ot-grid ot-cols-2">
                      <div className="ot-field md:col-span-2">
                        <label className="ot-label required">Metros Est.</label>
                        <input
                          data-field="metrosEstimados"
                          className="ot-input"
                          type="text"
                          inputMode="text"
                          pattern="-?[0-9]*"
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
                      {renderError("desarrollo")}
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
                      {renderError("anchoMontaje")}
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
                      <input className="ot-input" value={readString(form.obsMontaje)} onChange={(e) => setKey(setForm, "obsMontaje", e.target.value)} />
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
                          <input
                            data-field="pinonImp"
                            className="ot-input"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={readString(form.pinonImp)}
                            onChange={(e) => setKey(setForm, "pinonImp", sanitizePositiveIntInput(e.target.value))}
                            placeholder="Ej: 840"
                          />
                          {renderError("pinonImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label">Linea de corte</label>
                          <select
                            data-field="lineaCorte"
                            className="ot-select"
                            value={normalizeYesNo(form.lineaCorte)}
                            onChange={(e) => setKey(setForm, "lineaCorte", e.target.value)}
                          >
                            <option value="">Seleccionar...</option>
                            <option value="si">Si</option>
                            <option value="no">No</option>
                          </select>
                          {renderError("lineaCorte")}
                        </div>
                        <div className="ot-field sm:col-span-2 lg:col-span-1" data-field="figEmbImpDisplay">
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
                          {renderError("figEmbImpDisplay")}
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
                        data-field="sustratosImp"
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
                        data-field="sustratosImp"
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
                          <input data-field="kgIngresadoImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgIngresadoImp)} onChange={(e) => setKey(setForm, "kgIngresadoImp", e.target.value)} />
                          {renderError("kgIngresadoImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label">Kg salida</label>
                          <input data-field="kgSalidaImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgSalidaImp)} onChange={(e) => setKey(setForm, "kgSalidaImp", e.target.value)} />
                          {renderError("kgSalidaImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label">Merma</label>
                          <input data-field="mermaImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.mermaImp)} onChange={(e) => setKey(setForm, "mermaImp", e.target.value)} />
                          {renderError("mermaImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label">Metros</label>
                          <input data-field="metrosImp" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.metrosImp)} onChange={(e) => setKey(setForm, "metrosImp", e.target.value)} />
                          {renderError("metrosImp")}
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
                    <div className="ot-field sm:col-span-2 lg:col-span-1" data-field="figuraEmbobinadoLam">
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
                      {renderError("figuraEmbobinadoLam")}
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
                      <input className="ot-input" value={readString(form.obsLaminacion)} onChange={(e) => setKey(setForm, "obsLaminacion", e.target.value)} />
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
                          data-field="sustratosLam"
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
                          data-field="sustratosLam"
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
                      <input data-field="kgEntradaLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgEntradaLam)} onChange={(e) => setKey(setForm, "kgEntradaLam", e.target.value)} />
                      {renderError("kgEntradaLam")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Kg salida</label>
                      <input data-field="kgSalidaLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgSalidaLam)} onChange={(e) => setKey(setForm, "kgSalidaLam", e.target.value)} />
                      {renderError("kgSalidaLam")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Metraje</label>
                      <input data-field="metrajeLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.metrajeLam)} onChange={(e) => setKey(setForm, "metrajeLam", e.target.value)} />
                      {renderError("metrajeLam")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Merma</label>
                      <input data-field="mermaLam" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.mermaLam)} onChange={(e) => setKey(setForm, "mermaLam", e.target.value)} />
                      {renderError("mermaLam")}
                    </div>
                  </div>

                  <div className="ot-grid ot-cols-4">
                    <div className="ot-field">
                      <label className="ot-label">Kg entrada 2 (trilam.)</label>
                      <input data-field="kgEntradaLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgEntradaLam2)} onChange={(e) => setKey(setForm, "kgEntradaLam2", e.target.value)} />
                      {renderError("kgEntradaLam2")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Kg salida 2 (trilam.)</label>
                      <input data-field="kgSalidaLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.kgSalidaLam2)} onChange={(e) => setKey(setForm, "kgSalidaLam2", e.target.value)} />
                      {renderError("kgSalidaLam2")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Metraje 2</label>
                      <input data-field="metrajeLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.metrajeLam2)} onChange={(e) => setKey(setForm, "metrajeLam2", e.target.value)} />
                      {renderError("metrajeLam2")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Merma 2</label>
                      <input data-field="mermaLam2" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readNumberString(form.mermaLam2)} onChange={(e) => setKey(setForm, "mermaLam2", e.target.value)} />
                      {renderError("mermaLam2")}
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
                      <input data-field="anchoCorteFinal" className="ot-input" value={readString(form.anchoCorteFinal)} onChange={(e) => setKey(setForm, "anchoCorteFinal", e.target.value)} placeholder="320±0" />
                      {renderError("anchoCorteFinal")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Peso bobina (Kg)</label>
                      <input data-field="pesoBobina" className="ot-input" value={readString(form.pesoBobina)} onChange={(e) => setKey(setForm, "pesoBobina", e.target.value)} placeholder="19-20" />
                      {renderError("pesoBobina")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Metros/Bobina (m)</label>
                      <input data-field="metrosBobina" className="ot-input" value={readString(form.metrosBobina)} onChange={(e) => setKey(setForm, "metrosBobina", e.target.value)} placeholder="1020 ± 20" />
                      {renderError("metrosBobina")}
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
                      {renderError("orientacionEmbalaje")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Ubic. fotocelda</label>
                      <input className="ot-input" value={readString(form.ubicFotoceldaCorte)} onChange={(e) => setKey(setForm, "ubicFotoceldaCorte", e.target.value)} />
                      {renderError("ubicFotoceldaCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Dist. fotocelda al borde (mm)</label>
                      <input data-field="distFotoceldaBorde" className="ot-input" value={readString(form.distFotoceldaBorde)} onChange={(e) => setKey(setForm, "distFotoceldaBorde", e.target.value)} placeholder="1±1" />
                      {renderError("distFotoceldaBorde")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Dist. figura lado contrario (mm)</label>
                      <input data-field="distFiguraLadoContrario" className="ot-input" value={readString(form.distFiguraLadoContrario)} onChange={(e) => setKey(setForm, "distFiguraLadoContrario", e.target.value)} placeholder="20±1" />
                      {renderError("distFiguraLadoContrario")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Dist. figura lado fotocelda (mm)</label>
                      <input data-field="distFiguraLadoFotocelda" className="ot-input" value={readString(form.distFiguraLadoFotocelda)} onChange={(e) => setKey(setForm, "distFiguraLadoFotocelda", e.target.value)} placeholder="30±1" />
                      {renderError("distFiguraLadoFotocelda")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Max. empates</label>
                      <input data-field="maxEmpates" className="ot-input" value={readString(form.maxEmpates)} onChange={(e) => setKey(setForm, "maxEmpates", e.target.value)} placeholder="1" />
                      {renderError("maxEmpates")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Diam. bobina (mm)</label>
                      <input data-field="diamBobina" className="ot-input" value={readString(form.diamBobina)} onChange={(e) => setKey(setForm, "diamBobina", e.target.value)} placeholder="400 ± 5" />
                      {renderError("diamBobina")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Ancho core (mm)</label>
                      <input data-field="anchoCore" className="ot-input" value={readString(form.anchoCore)} onChange={(e) => setKey(setForm, "anchoCore", e.target.value)} />
                      {renderError("anchoCore")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Diam. core (Plg)</label>
                      <input data-field="diamCorePlg" className="ot-input" value={readString(form.diamCorePlg)} onChange={(e) => setKey(setForm, "diamCorePlg", e.target.value)} />
                      {renderError("diamCorePlg")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Cant. cores</label>
                      <input data-field="cantCores" className="ot-input" value={readString(form.cantCores)} onChange={(e) => setKey(setForm, "cantCores", e.target.value)} />
                      {renderError("cantCores")}
                    </div>
                  </div>

                  <div className="ot-grid ot-metrics-before-nested ot-cols-4">
                    <div className="ot-field">
                      <label className="ot-label">Kg ingresados</label>
                      <input data-field="kgIngresadosCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.kgIngresadosCorte)} onChange={(e) => setKey(setForm, "kgIngresadosCorte", e.target.value)} placeholder="kg ingresados" />
                      {renderError("kgIngresadosCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Kg salida</label>
                      <input data-field="kgSalidaCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.kgSalidaCorte)} onChange={(e) => setKey(setForm, "kgSalidaCorte", e.target.value)} />
                      {renderError("kgSalidaCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Kg merma</label>
                      <input data-field="kgMermaCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.kgMermaCorte)} onChange={(e) => setKey(setForm, "kgMermaCorte", e.target.value)} placeholder="Ej: 10.00" />
                      {renderError("kgMermaCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label">Metraje</label>
                      <input data-field="metrajeCorte" type="number" inputMode="decimal" step="0.01" min="0" className="ot-input" value={readString(form.metrajeCorte)} onChange={(e) => setKey(setForm, "metrajeCorte", e.target.value)} />
                      {renderError("metrajeCorte")}
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
                          <label className="ot-label">Prioridad</label>
                          <select
                            className="ot-select"
                            value={readString(form.priority) || "normal"}
                            onChange={(e) => setKey(setForm, "priority", e.target.value)}
                          >
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                        <div className="ot-field sm:col-span-2">
                          <label className="ot-label">Asignar a área(s)</label>
                          <AreasMultiCheckbox
                            value={[...PROGRAMACION_AREAS]}
                          />
                        </div>
                        <div className="ot-field sm:col-span-2">
                          <label className="ot-label">Motivo de asignación</label>
                          <Textarea
                            data-field="programacionMotivo"
                            className="min-h-[4.5rem]"
                            value={readString(form.programacionMotivo)}
                            onChange={(e) => setKey(setForm, "programacionMotivo", e.target.value)}
                            placeholder="Explique el motivo (por qué pendiente, instrucciones, etc.)"
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Estado OT: <strong>{readString(form.estadoOt) || "—"}</strong> · Etapa tablero:{" "}
                        <strong>{readString(form.etapaOt) || "—"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeScope !== "corte" ? (
              <div className="no-print mt-4 flex justify-center">
                <Button
                  type="button"
                  onClick={() => setPendingHeaderAction("save")}
                  disabled={saving || loading}
                >
                  {saving ? "Guardando…" : "Guardar orden"}
                </Button>
              </div>
            ) : null}
          </form>
          {activeScope === "corte" ? (
            <div className="no-print mt-6 space-y-3">
              <WorkOrderCorteOpsSection
                form={form}
                setForm={setForm}
                pedidoTotalKg={Number(readNumberString(form.pedidoKg) || readNumberString(prefill.pedidoKg) || "0")}
              />
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  onClick={() => setPendingHeaderAction("save")}
                  disabled={saving || loading}
                >
                  {saving ? "Guardando…" : "Guardar orden"}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <AlertDialog
        open={pendingHeaderAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingHeaderAction(null)
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          {headerConfirmCopy ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{headerConfirmCopy.title}</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription>{headerConfirmCopy.description}</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "w-full border-primary/25 hover:bg-primary/90 sm:w-auto",
                  )}
                  onClick={() => {
                    const a = pendingHeaderAction
                    if (!a) return
                    setPendingHeaderAction(null)
                    if (a === "view") nav("/ordenes-trabajo?tab=lista")
                    else if (a === "random") rellenarDatosAlAzar()
                    else if (a === "clear") limpiar()
                    else if (a === "save") void guardar()
                  }}
                >
                  {headerConfirmCopy.cta}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rellenoAzarDialogOpen} onOpenChange={setRellenoAzarDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Relleno al azar</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            {rellenoAzarCount > 0
              ? `Se rellenaron ${rellenoAzarCount} campo(s) vacío(s) con valores al azar en montaje, impresión, laminación, corte, tintas y programación. La cabecera (orden de cliente) y los datos del producto no se tocan: complete esos campos según su criterio.`
              : "No había campos vacíos que rellenar en las áreas técnicas (montaje en adelante), o todo ya estaba completo. Cabecera y datos del producto nunca se rellenan al azar."}
          </AlertDialogDescription>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel
              type="button"
              className={cn(buttonVariants({ variant: "default" }), "border-primary/25 hover:bg-primary/90")}
            >
              Aceptar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

