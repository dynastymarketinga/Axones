"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Barcode,
  Calendar,
  CalendarClock,
  CalendarDays,
  Circle,
  CircleDot,
  ClipboardList as LucideClipboardList,
  Columns,
  Cog,
  Crop,
  Disc,
  Factory,
  FileText,
  Flag,
  FlaskConical,
  GripHorizontal,
  Hash,
  IdCard,
  Layers as LucideLayers,
  LayoutGrid,
  Link2,
  Loader2,
  Minus,
  MapPin,
  MessageSquare,
  Package as LucidePackage,
  PackagePlus,
  Paintbrush,
  Palette,
  Percent,
  Plus,
  Printer,
  Repeat,
  Ruler,
  Scale,
  StickyNote,
  Tag,
  Tags,
  Trash2,
  TrendingDown,
  User,
  Warehouse,
  Weight,
  Check,
  ChevronsUpDown,
  X,
} from "lucide-react"
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
import { latestRowInGroup } from "@/lib/axones-work-order-grouping"
import { withCorteAutoFields } from "@/lib/corte-planilla-metrics"
import { syncMontajeAutoFields, withMontajeAutoFields } from "@/lib/montaje-planilla-metrics"
import { sumSalidaKgFromForm } from "@/pages/axones/corte-turnos"
import {
  canSaveProductionAreaForm,
  hasActiveProductionTurno,
  MES_PRODUCTION_SAVE_CONFIG,
  MES_SAVE_BLOCKED_MESSAGE,
} from "@/lib/mes-timer-guards"
import { getStoredUser } from "@/lib/auth-storage"
import { cn } from "@/lib/utils"
import type {
  ClientOrderDetailRecord,
  LaravelPaginated,
  MaterialRow,
  ProductRecord,
  WorkOrderListRow,
} from "@/types/api"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import { OtPlanillaInputIcon } from "./OtPlanillaInputIcon"
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

type SustratoRow = { material_id: string; kg: string; material_free_text?: string }

const MIN_SUSTRATO_ROWS = 1
const MAX_SUSTRATO_ROWS = 4

/** Toast al fallar validación al guardar (Sonner usa ~4s por defecto en errores). */
const OT_VALIDATION_ERROR_TOAST_MS = 2600
/** Oculta sombreado y mensajes de error de envío; puede pulsar Guardar de nuevo para revisarlos. */
const OT_FIELD_ERRORS_AUTO_CLEAR_MS = 8000

function ensureMinSustratoRows(rows: SustratoRow[], minRows = MIN_SUSTRATO_ROWS): SustratoRow[] {
  const next = [...rows]
  while (next.length < minRows) next.push({ material_id: "", kg: "", material_free_text: "" })
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

/** Metros est.: el guion solo era “vacío” en UI; vacío real para que funcione `placeholder`. */
function metrosEstimadosDisplay(v: unknown): string {
  const m = readNumberString(v).trim()
  return m === "-" ? "" : m
}

function mergePrefill(prefill: Record<string, unknown>, form?: Record<string, unknown> | null) {
  const merged = { ...prefill, ...(form ?? {}) }
  if (readNumberString(merged.metrosEstimados).trim() === "-") {
    merged.metrosEstimados = ""
  }
  return merged
}

/** Misma lógica que el backend (`WorkOrderOrdenTrabajoService::buildPrefill`) para `codigoBarra`. */
function trimBarcodeForPrefill(barcode: string | null | undefined): string | null {
  if (barcode == null) return null
  const t = String(barcode).trim()
  return t !== "" ? t : null
}

/** Alineado con `WorkOrderOrdenTrabajoService::buildPrefill()` (tipo de impresión según `print_type`). */
function prefillFromProduct(p: ProductRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {
    producto: p.name,
    cpe: p.cpe ?? null,
    mpps: p.mps ?? null,
    codigoBarra: trimBarcodeForPrefill(p.barcode),
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
  if (trimmed === "") return ""
  if (trimmed === "-") return "-"
  const hasMinus = trimmed.startsWith("-")
  const digits = v.replace(/\D/g, "")
  if (!digits) return ""
  return hasMinus ? `-${digits}` : digits
}

function normalizeYesNo(v: unknown): "" | "si" | "no" {
  const s = readString(v).trim().toLowerCase()
  if (s === "si" || s === "sí") return "si"
  if (s === "no") return "no"
  return ""
}

function lineaCorteComboLabel(v: unknown): string {
  const n = normalizeYesNo(v)
  if (n === "si") return "Si"
  if (n === "no") return "No"
  return "Elegir…"
}

function priorityComboLabel(v: unknown): string {
  const p = readString(v).toLowerCase().trim()
  if (p === "urgente") return "Urgente"
  if (p === "alta") return "Alta"
  return "Normal"
}

function normalizedPriorityValue(v: unknown): "normal" | "alta" | "urgente" {
  const p = readString(v).toLowerCase().trim()
  if (p === "urgente") return "urgente"
  if (p === "alta") return "alta"
  return "normal"
}

function materialInventoryComboLabel(materials: MaterialRow[], materialId: unknown): string {
  const id = readString(materialId).trim()
  if (!id) return "Elegir material del inventario…"
  const m = materials.find((row) => String(row.id) === id)
  return m ? `${m.sku} · ${m.name}` : id
}

/** Texto mostrado en el campo: texto libre, o etiqueta de inventario si hay `material_id`. */
function sustratoVirgenDisplayValue(materials: MaterialRow[], row: SustratoRow): string {
  const free = readString(row.material_free_text).trim()
  if (free) return free
  const id = readString(row.material_id).trim()
  if (!id) return ""
  return materialInventoryComboLabel(materials, id)
}

/** Hay referencia de material si hay ID de inventario válido o descripción manual. */
function sustratoRowHasMaterialChoice(row: SustratoRow): boolean {
  const free = readString(row.material_free_text).trim()
  if (free) return true
  const mid = readString(row.material_id).trim()
  if (!mid) return false
  return /^\d+$/.test(mid) && Number(mid) > 0
}

function sustratoMaterialIdDigits(row: SustratoRow): string {
  const raw = row.material_id
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return String(Math.trunc(raw))
  const s = readString(raw).trim()
  return /^\d+$/.test(s) ? s : ""
}

/** Stock / kg: solo filas de catálogo (id numérico y sin texto libre). */
function sustratoRowUsesCatalogMaterial(row: SustratoRow): boolean {
  if (readString(row.material_free_text).trim()) return false
  return sustratoMaterialIdDigits(row) !== ""
}

function parseDecimalKgString(s: unknown): number | null {
  const t = readNumberString(s).trim().replace(",", ".")
  if (!t || !isDecimalLike(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function materialRowById(materials: MaterialRow[], materialId: string): MaterialRow | null {
  if (!materialId) return null
  return materials.find((m) => String(m.id) === materialId) ?? null
}

function formatKgForOtHint(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

/** Compara cantidades como decimales con hasta 3 fracciones (alineado con backend `bccomp(..., 3)`). */
function decimalKgExceedsStock(requestedStr: string, stockStr: string): boolean {
  const req = parseDecimalKgString(requestedStr)
  const stock = parseDecimalKgString(stockStr)
  if (req === null || stock === null) return false
  return Math.round(req * 1000) > Math.round(stock * 1000)
}

function sustratoCatalogStockLabel(materials: MaterialRow[], row: SustratoRow): string | null {
  if (!sustratoRowUsesCatalogMaterial(row)) return null
  const m = materialRowById(materials, sustratoMaterialIdDigits(row))
  if (!m) return null
  const q = parseDecimalKgString(m.quantity_on_hand)
  if (q === null) return null
  return formatKgForOtHint(q)
}

function SustratoKgStockFooter({ row, materials }: { row: SustratoRow; materials: MaterialRow[] }) {
  if (!sustratoRowUsesCatalogMaterial(row)) return null
  const id = sustratoMaterialIdDigits(row)
  const m = materialRowById(materials, id)
  if (!m) {
    return (
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
        Material no encontrado en el listado cargado. Recargue la página o vuelva a elegir del catálogo.
      </p>
    )
  }
  const availLabel = sustratoCatalogStockLabel(materials, row)
  const kgStr = readNumberString(row.kg).trim()
  const exceeds = kgStr ? decimalKgExceedsStock(kgStr, m.quantity_on_hand) : false
  return (
    <div className="mt-1 space-y-0.5">
      {availLabel != null ? (
        <p className="text-xs text-muted-foreground">Disponible: {availLabel} kg</p>
      ) : null}
      {exceeds ? (
        <p className="text-xs font-medium text-destructive">
          Supera el stock disponible
          {availLabel != null ? ` (${availLabel} kg)` : "."}
        </p>
      ) : null}
    </div>
  )
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

const PROGRAMACION_AREAS = ["montaje", "impresion", "laminacion", "corte", "tintas"] as const
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
    montaje: "Montaje",
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
      return {
        material_id: readString(o.material_id),
        kg: readNumberString(o.kg),
        material_free_text: readString(o.material_free_text),
      }
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
        return {
          material_id: readString(o.material_id),
          kg: readNumberString(o.kg),
          material_free_text: readString(o.material_free_text),
        }
      })
    return ensureMinSustratoRows(out)
  }
  const mid = readString(form.sustratoVirgenImp1)
  const kg = readNumberString(form.kgUtilizarImp1)
  if (mid || kg) return ensureMinSustratoRows([{ material_id: mid, kg, material_free_text: "" }])
  return ensureMinSustratoRows([])
}

function setSustratosImp(
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  rows: SustratoRow[],
) {
  setForm((prev) => ({ ...prev, sustratosVirgenImp: rows.slice(0, MAX_SUSTRATO_ROWS) }))
}

const OT_BLUR_REQUIRED_MSG = "Este campo es obligatorio."
/** Cuánto tiempo se muestra el aviso por blur antes de ocultarlo solo (los errores de “Guardar orden” no caducan). */
const OT_BLUR_TIP_MS = 4000

type OtBlurCtx = {
  form: Record<string, unknown>
  prefill: Record<string, unknown>
  tipoImpresion: ReturnType<typeof normalizeTipoImpresion>
  canEditShared: boolean
  canViewMontaje: boolean
  canViewImpresion: boolean
  canViewLaminacion: boolean
  canViewCorte: boolean
}

function sustratosImpBlockEmpty(form: Record<string, unknown>): boolean {
  const rows = getSustratosImp(form)
  return !rows.some((r) => sustratoRowHasMaterialChoice(r) || readNumberString(r.kg).trim())
}

function sustratosLamBlockEmpty(form: Record<string, unknown>): boolean {
  const rows = getSustratosLam(form)
  return !rows.some((r) => sustratoRowHasMaterialChoice(r) || readNumberString(r.kg).trim())
}

function lam2BlockAny(form: Record<string, unknown>): boolean {
  return Boolean(
    readNumberString(form.kgEntradaLam2).trim() ||
      readNumberString(form.kgSalidaLam2).trim() ||
      readNumberString(form.metrajeLam2).trim() ||
      readNumberString(form.mermaLam2).trim(),
  )
}

/** Vacío según criterio “obligatorio al guardar” (solo texto vacío / sin selección; no valida formatos). */
function isOtBlurRequiredEmpty(key: string, ctx: OtBlurCtx): boolean {
  const { form, prefill, tipoImpresion, canEditShared, canViewMontaje, canViewImpresion, canViewLaminacion, canViewCorte } =
    ctx

  const shared = new Set([
    "pedidoKg",
    "maquina",
    "metrosEstimados",
    "tipoImpresionEstructura",
    "cpe",
    "mpps",
    "codigoBarra",
  ])
  if (shared.has(key)) {
    if (!canEditShared) return false
    switch (key) {
      case "pedidoKg":
        return !(readNumberString(form.pedidoKg).trim() || readNumberString(prefill.pedidoKg).trim())
      case "maquina":
        return !readString(form.maquina).trim()
      case "metrosEstimados": {
        const m = readNumberString(form.metrosEstimados).trim()
        return !m || m === "-"
      }
      case "tipoImpresionEstructura":
        return !tipoImpresion
      case "cpe":
      case "mpps":
      case "codigoBarra":
        return !readString(form[key]).trim()
      default:
        return false
    }
  }

  const montaje = new Set([
    "frecuencia",
    "numBandas",
    "anchoCorteMontaje",
    "numRepeticion",
    "desarrollo",
    "anchoMontaje",
    "numColores",
  ])
  if (montaje.has(key)) {
    if (!canEditShared || !canViewMontaje) return false
    return !readString(form[key]).trim()
  }

  const imp = new Set([
    "pinonImp",
    "lineaCorte",
    "figEmbImpDisplay",
    "sustratosImp",
    "kgIngresadoImp",
    "kgSalidaImp",
    "mermaImp",
    "metrosImp",
  ])
  if (imp.has(key)) {
    if (!canViewImpresion) return false
    if (key === "lineaCorte") return !normalizeYesNo(form.lineaCorte)
    if (key === "sustratosImp") return sustratosImpBlockEmpty(form)
    if (key === "figEmbImpDisplay" || key === "pinonImp") return !readString(form[key]).trim()
    return !readNumberString(form[key]).trim()
  }

  const lamCore = new Set([
    "figuraEmbobinadoLam",
    "gramajeAdhesivo",
    "relacionMezcla",
    "sustratosLam",
    "kgEntradaLam",
    "kgSalidaLam",
    "metrajeLam",
    "mermaLam",
  ])
  const lam2 = new Set(["kgEntradaLam2", "kgSalidaLam2", "metrajeLam2", "mermaLam2"])
  if (lamCore.has(key) || lam2.has(key)) {
    if (!canViewLaminacion) return false
    if (key === "sustratosLam") return sustratosLamBlockEmpty(form)
    if (key === "figuraEmbobinadoLam") return !readString(form.figuraEmbobinadoLam).trim()
    if (key === "gramajeAdhesivo" || key === "relacionMezcla") return !readString(form[key]).trim()
    if (lam2.has(key)) {
      if (!lam2BlockAny(form)) return false
      return !readNumberString(form[key]).trim()
    }
    return !readNumberString(form[key]).trim()
  }

  const corteMetric = new Set([
    "anchoCorteFinal",
    "pesoBobina",
    "metrosBobina",
    "distFotoceldaBorde",
    "distFiguraLadoContrario",
    "distFiguraLadoFotocelda",
    "diamBobina",
    "anchoCore",
    "diamCorePlg",
  ])
  if (corteMetric.has(key)) {
    if (!canViewCorte) return false
    return !readString(form[key]).trim()
  }
  if (key === "orientacionEmbalaje") {
    if (!canViewCorte) return false
    return !readString(form.orientacionEmbalaje).trim()
  }
  if (key === "ubicFotoceldaCorte") {
    if (!canViewCorte) return false
    return !readString(form.ubicFotoceldaCorte).trim()
  }
  const corteInt = new Set(["maxEmpates", "cantCores"])
  if (corteInt.has(key)) {
    if (!canViewCorte) return false
    return !readString(form[key]).trim()
  }
  const corteDec = new Set(["kgIngresadosCorte", "kgSalidaCorte", "kgMermaCorte", "metrajeCorte"])
  if (corteDec.has(key)) {
    if (!canViewCorte) return false
    return !readNumberString(form[key]).trim()
  }

  return false
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomMachineValue(): Exclude<MachineValue, ""> {
  const flat = MACHINE_OPTIONS.flatMap((g) => g.options.map((o) => o.value))
  return flat[randomInt(0, flat.length - 1)]!
}

/**
 * Cabecera / maestro que no debe pisarse con valores demo (identidad del pedido, cliente, producto).
 * Máquina, ref. planchas, metros est. y sustratos sí se rellenan al azar si vienen vacíos.
 */
const USER_ONLY_RANDOM_SKIP = new Set<string>([
  "fechaOrden",
  "numeroOrden",
  "document_number",
  "pedidoKg",
  "cliente",
  "clienteRif",
  "producto",
  "tipoImpresion",
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
        (row) =>
          !readString(row.material_id).trim() &&
          !readString(row.material_free_text ?? "").trim() &&
          !readNumberString(row.kg).trim(),
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
  const patchSustratoRow = (
    row: SustratoRow | undefined,
    kgMin: number,
    kgMax: number,
    demoPrefix: string,
  ) => {
    const material_id = readString(row?.material_id)
    const material_free_text = readString(row?.material_free_text)
    const kg = String(randomInt(kgMin, kgMax))
    const cur: SustratoRow = {
      material_id,
      kg: readNumberString(row?.kg),
      material_free_text,
    }
    if (sustratoRowHasMaterialChoice(cur)) {
      return { material_id, kg, material_free_text }
    }
    return {
      material_id,
      kg,
      material_free_text:
        material_free_text.trim() || `${demoPrefix}-${randomInt(1000, 9999)}`,
    }
  }
  const sustratosVirgenImp = [patchSustratoRow(sImp[0], 15, 120, "DEMO-IMP")]
  const sustratosVirgenLam = [patchSustratoRow(sLam[0], 200, 520, "DEMO-LAM")]

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
    maquina: randomMachineValue(),
    planchasReferencia: String(randomInt(1, 999)).padStart(3, "0"),
    metrosEstimados: String(randomInt(5000, 28000)),
    tipoImpresionEstructura: randomInt(0, 1) === 0 ? "superficie" : "reverso",
    frecuencia: `${randomInt(200, 360)}±${randomInt(1, 5)}`,
    numBandas: String(randomInt(1, 6)),
    anchoCorteMontaje: `${randomInt(300, 450)}±${randomInt(1, 4)}`,
    numRepeticion: String(randomInt(1, 8)),
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

  Object.assign(next, syncMontajeAutoFields(next))

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

function pendingHeaderConfirmIcon(action: PendingHeaderAction, iconClass = "h-6 w-6 shrink-0") {
  switch (action) {
    case "view":
      return <LucideClipboardList className={iconClass} aria-hidden />
    case "random":
      return <Shuffle className={iconClass} aria-hidden />
    case "clear":
      return <Eraser className={iconClass} aria-hidden />
    case "save":
      return <Save className={iconClass} aria-hidden />
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
  const [duplicateOtMatches, setDuplicateOtMatches] = useState<WorkOrderListRow[] | null>(null)
  const [rellenoAzarDialogOpen, setRellenoAzarDialogOpen] = useState(false)
  const [rellenoAzarCount, setRellenoAzarCount] = useState(0)
  const [pendingHeaderAction, setPendingHeaderAction] = useState<PendingHeaderAction | null>(null)
  const [prefill, setPrefill] = useState<Record<string, unknown>>({})
  const [form, setForm] = useState<Record<string, unknown>>({})
  const canSaveCorteProduction = useMemo(
    () => canSaveProductionAreaForm(form, MES_PRODUCTION_SAVE_CONFIG.corte),
    [form],
  )
  const canPersistCorteShiftOpen = useMemo(
    () => hasActiveProductionTurno(form, MES_PRODUCTION_SAVE_CONFIG.corte),
    [form],
  )
  const canSaveCorteForm = canSaveCorteProduction || canPersistCorteShiftOpen
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [blurFieldMessages, setBlurFieldMessages] = useState<Record<string, string>>({})
  const fieldErrorsClearTimerRef = useRef<number | null>(null)

  const cancelFieldErrorsAutoClear = useCallback(() => {
    if (fieldErrorsClearTimerRef.current) {
      clearTimeout(fieldErrorsClearTimerRef.current)
      fieldErrorsClearTimerRef.current = null
    }
  }, [])

  const [woClientId, setWoClientId] = useState<number | null>(null)
  const [woProductId, setWoProductId] = useState<number | null>(null)
  const [clientProducts, setClientProducts] = useState<ProductRecord[]>([])
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [maquinaPickerOpen, setMaquinaPickerOpen] = useState(false)
  const [tipoImpresionPickerOpen, setTipoImpresionPickerOpen] = useState(false)
  const [lineaCortePickerOpen, setLineaCortePickerOpen] = useState(false)
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [sustratoImpPickerIdx, setSustratoImpPickerIdx] = useState<number | null>(null)
  const [sustratoLamPickerIdx, setSustratoLamPickerIdx] = useState<number | null>(null)
  const [updatingProduct, setUpdatingProduct] = useState(false)

  const [tintaMateriales, setTintaMateriales] = useState<MaterialRow[]>([])
  const [tintaMaterialesLoading, setTintaMaterialesLoading] = useState(false)

  const prefillRef = useRef(prefill)
  const formRef = useRef(form)
  const woProductIdRef = useRef(woProductId)
  prefillRef.current = prefill
  formRef.current = form
  woProductIdRef.current = woProductId

  const planillaFormRef = useRef<HTMLFormElement>(null)
  const blurDismissTimersRef = useRef(new Map<string, number>())
  const blurCtxRef = useRef<OtBlurCtx>({
    form: {},
    prefill: {},
    tipoImpresion: "",
    canEditShared: false,
    canViewMontaje: false,
    canViewImpresion: false,
    canViewLaminacion: false,
    canViewCorte: false,
  })

  const clearAllBlurDismissTimers = () => {
    for (const t of blurDismissTimersRef.current.values()) clearTimeout(t)
    blurDismissTimersRef.current.clear()
  }

  const scheduleBlurTipDismiss = (key: string) => {
    const existing = blurDismissTimersRef.current.get(key)
    if (existing) clearTimeout(existing)
    const tid = window.setTimeout(() => {
      blurDismissTimersRef.current.delete(key)
      setBlurFieldMessages((prev) => {
        if (!(key in prev)) return prev
        const n = { ...prev }
        delete n[key]
        return n
      })
    }, OT_BLUR_TIP_MS) as unknown as number
    blurDismissTimersRef.current.set(key, tid)
  }

  const cancelBlurTipDismiss = (key: string) => {
    const t = blurDismissTimersRef.current.get(key)
    if (t) {
      clearTimeout(t)
      blurDismissTimersRef.current.delete(key)
    }
  }

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
        if (mid || kg) merged.sustratosVirgenImp = [{ material_id: mid, kg, material_free_text: "" }]
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
      setForm(withCorteAutoFields(withMontajeAutoFields(merged)))
      clearAllBlurDismissTimers()
      setBlurFieldMessages({})
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la orden de trabajo.")
      setPrefill({})
      setForm({})
      setWoClientId(null)
      setWoProductId(null)
      clearAllBlurDismissTimers()
      setBlurFieldMessages({})
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
        if (mid || kg) merged.sustratosVirgenImp = [{ material_id: mid, kg, material_free_text: "" }]
      }

      setPrefill(p)
      setWoClientId(Number.isFinite(Number(co.client_id)) ? Number(co.client_id) : null)
      setWoProductId(productId)
      setForm(withCorteAutoFields(withMontajeAutoFields(merged)))
      clearAllBlurDismissTimers()
      setBlurFieldMessages({})
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el pedido cliente (OC) para el borrador.")
      setPrefill({})
      setForm({})
      setWoClientId(null)
      setWoProductId(null)
      clearAllBlurDismissTimers()
      setBlurFieldMessages({})
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
    if (role === "montaje") {
      nav(`/ordenes-trabajo/${id}/produccion?tab=montaje`, { replace: true })
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
    () =>
      normalizeTipoImpresion(
        readString(form.tipoImpresionEstructura) || readString(form.tipoImpresion),
      ),
    [form.tipoImpresionEstructura, form.tipoImpresion],
  )

  const tipoImpresionComboLabel = useMemo(() => {
    if (tipoImpresion === "superficie") return "Superficie"
    if (tipoImpresion === "reverso") return "Reverso"
    return "Elegir…"
  }, [tipoImpresion])

  /** Montaje copia el tipo de la especificación (datos del producto); el select de montaje queda deshabilitado. */
  useEffect(() => {
    const montajeLabel =
      tipoImpresion === "superficie" ? "Superficie" : tipoImpresion === "reverso" ? "Reverso" : ""
    setForm((f) => {
      if (readString(f.tipoImpresionMontaje) === montajeLabel) return f
      return { ...f, tipoImpresionMontaje: montajeLabel }
    })
  }, [tipoImpresion])

  /** Desarrollo y ancho montaje: frecuencia×rep y ancho corte×bandas. */
  useEffect(() => {
    if (!canEditShared || !canViewMontaje) return
    const patch = syncMontajeAutoFields(formRef.current)
    if (!patch.desarrollo && !patch.anchoMontaje) return
    setForm((f) => {
      let changed = false
      const next = { ...f }
      if (patch.desarrollo && readString(f.desarrollo) !== patch.desarrollo) {
        next.desarrollo = patch.desarrollo
        changed = true
      }
      if (patch.anchoMontaje && readString(f.anchoMontaje) !== patch.anchoMontaje) {
        next.anchoMontaje = patch.anchoMontaje
        changed = true
      }
      return changed ? next : f
    })
  }, [
    canEditShared,
    canViewMontaje,
    form.frecuencia,
    form.numRepeticion,
    form.anchoCorteMontaje,
    form.numBandas,
  ])

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
        n.cpe = readString(p.cpe)
        n.mpps = readString(p.mps)
        n.codigoBarra = trimBarcodeForPrefill(p.barcode) ?? ""
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

  const maquinaComboLabel = useMemo(() => {
    const v = readString(form.maquina).trim()
    if (!v) return "Elegir…"
    for (const g of MACHINE_OPTIONS) {
      const hit = g.options.find((o) => o.value === v)
      if (hit) return hit.label
    }
    return v
  }, [form.maquina])

  const sustratosLam = useMemo(() => getSustratosLam(form), [form])
  const sustratosImp = useMemo(() => getSustratosImp(form), [form])

  blurCtxRef.current = {
    form,
    prefill,
    tipoImpresion,
    canEditShared,
    canViewMontaje,
    canViewImpresion,
    canViewLaminacion,
    canViewCorte,
  }

  const errorFor = (key: string) => {
    const submit = fieldErrors[key]
    if (submit) return submit
    return blurFieldMessages[key]
  }
  const renderError = (key: string) => {
    const message = errorFor(key)
    if (!message) return null
    return (
      <p className="mt-1 text-xs text-destructive" title={message}>
        {message}
      </p>
    )
  }
  /** `aria-invalid` + estilos en `work-order-planilla.css` (mismo criterio que Notas en pedido cliente). */
  const otInvalid = (key: string) => Boolean(errorFor(key))
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

  const jumpToArea = useCallback(
    (fieldKey: string) => {
      if (loading) return
      focusFieldSoft(fieldKey)
    },
    [focusFieldSoft, loading],
  )

  useEffect(
    () => () => {
      cancelFieldErrorsAutoClear()
    },
    [cancelFieldErrorsAutoClear],
  )

  useEffect(() => {
    setBlurFieldMessages((prev) => {
      const ctx = blurCtxRef.current
      let changed = false
      const next = { ...prev }
      for (const k of Object.keys(prev)) {
        if (!isOtBlurRequiredEmpty(k, ctx)) {
          const t = blurDismissTimersRef.current.get(k)
          if (t) {
            clearTimeout(t)
            blurDismissTimersRef.current.delete(k)
          }
          delete next[k]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [
    form,
    prefill,
    tipoImpresion,
    canEditShared,
    canViewMontaje,
    canViewImpresion,
    canViewLaminacion,
    canViewCorte,
  ])

  useEffect(() => {
    if (loading) return
    const el = planillaFormRef.current
    if (!el) return

    const onFocusOut = (e: FocusEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      if (!el.contains(target)) return

      const related = e.relatedTarget
      if (target.closest('[data-skip-blur="1"],[data-skip-blur="true"]')) return

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (target.disabled || target.readOnly) return
      } else if (target instanceof HTMLSelectElement) {
        if (target.disabled) return
      } else if (target instanceof HTMLButtonElement && target.disabled) {
        return
      }

      const host = target.closest("[data-field]")
      if (!host) return
      if (host.getAttribute("data-skip-blur") === "1" || host.getAttribute("data-skip-blur") === "true") return

      if (related instanceof Node && host.contains(related)) return

      const key = host.getAttribute("data-field")
      if (!key) return

      const ctx = blurCtxRef.current
      const empty = isOtBlurRequiredEmpty(key, ctx)
      if (empty) {
        setBlurFieldMessages((prev) => ({ ...prev, [key]: OT_BLUR_REQUIRED_MSG }))
        scheduleBlurTipDismiss(key)
      } else {
        cancelBlurTipDismiss(key)
        setBlurFieldMessages((prev) => {
          const n = { ...prev }
          delete n[key]
          return n
        })
      }
    }

    el.addEventListener("focusout", onFocusOut, true)
    return () => el.removeEventListener("focusout", onFocusOut, true)
  }, [loading])

  useEffect(() => {
    return () => {
      clearAllBlurDismissTimers()
    }
  }, [])

  async function guardar(opts?: { forceNewOt?: boolean }) {
    if (isDraftRoute) {
      if (!draftCoId) {
        toast.error("Falta el pedido cliente (OC) en la URL. Vuelva a la lista e inténtelo otra vez.")
        return
      }
    } else if (!Number.isFinite(id) || id < 1) {
      return
    }
    if (saving) return
    if (activeScope === "corte" && !canSaveCorteForm) {
      toast.error(MES_SAVE_BLOCKED_MESSAGE)
      return
    }
    const formToSave = withCorteAutoFields(withMontajeAutoFields(form))
    const montajePatch = syncMontajeAutoFields(form)
    if (
      (montajePatch.desarrollo && readString(form.desarrollo) !== montajePatch.desarrollo) ||
      (montajePatch.anchoMontaje && readString(form.anchoMontaje) !== montajePatch.anchoMontaje)
    ) {
      setForm(formToSave)
    }
    const errors: Record<string, string> = {}
    const addError = (key: string, message: string) => {
      if (!errors[key]) errors[key] = message
    }

    const pedidoKg = readNumberString(formToSave.pedidoKg) || readNumberString(prefill.pedidoKg)
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
    if (!metrosEstimados || metrosEstimados === "-") {
      addError("metrosEstimados", "Metros Est. es obligatorio.")
    } else if (!/^-?\d+$/.test(metrosEstimados)) {
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
      if (!isMetricLike(readString(formToSave.frecuencia))) {
        addError("frecuencia", "Formato válido: 250, 250±2 o 250-252.")
      }
      if (!isPositiveIntLike(formToSave.numBandas)) {
        addError("numBandas", "Debe ser entero mayor a 0.")
      }
      if (!isMetricLike(readString(formToSave.anchoCorteMontaje))) {
        addError("anchoCorteMontaje", "Formato válido: 330±2, 330 o 329-331.")
      }
      if (!isPositiveIntLike(formToSave.numRepeticion)) {
        addError("numRepeticion", "Debe ser entero mayor a 0.")
      }
      const desarrollo = readString(formToSave.desarrollo).trim()
      if (!desarrollo) {
        addError("desarrollo", "Desarrollo (mm) es obligatorio (complete frecuencia y N° repetición).")
      } else if (!isMetricLike(desarrollo)) {
        addError("desarrollo", "Formato válido: 330±2, 330 o 329-331.")
      }
      const anchoMontaje = readString(formToSave.anchoMontaje).trim()
      if (!anchoMontaje) {
        addError("anchoMontaje", "Ancho montaje (mm) es obligatorio (complete ancho corte y N° bandas).")
      } else if (!isMetricLike(anchoMontaje)) {
        addError("anchoMontaje", "Formato válido: 330±2, 330 o 329-331.")
      }
      if (!isPositiveIntLike(formToSave.numColores)) {
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
        (r) => sustratoRowHasMaterialChoice(r) || readNumberString(r.kg).trim(),
      )
      if (!anySustratoFilled) {
        addError("sustratosImp", "Debe seleccionar al menos un sustrato y su Kg a utilizar.")
      } else {
        for (let i = 0; i < sImpRows.length; i += 1) {
          const row = sImpRows[i]
          if (!row) continue
          const kg = readNumberString(row.kg).trim()
          if (!sustratoRowHasMaterialChoice(row) && !kg) continue
          if (!sustratoRowHasMaterialChoice(row)) {
            addError(
              "sustratosImp",
              `Indique el material del sustrato ${i + 1} (texto libre o inventario).`,
            )
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
          if (sustratoRowUsesCatalogMaterial(row)) {
            const mid = sustratoMaterialIdDigits(row)
            const mat = materialRowById(materials, mid)
            if (!mat) {
              addError(
                "sustratosImp",
                `Impresión: sustrato ${i + 1}: material no está en el listado cargado. Recargue o vuelva a elegir del catálogo.`,
              )
              break
            }
            if (decimalKgExceedsStock(kg, mat.quantity_on_hand)) {
              const stockNum = parseDecimalKgString(mat.quantity_on_hand)
              const disp = stockNum !== null ? formatKgForOtHint(stockNum) : readString(mat.quantity_on_hand)
              addError(
                "sustratosImp",
                `Impresión: Kg a utilizar del sustrato ${i + 1} supera el stock disponible (${disp} kg).`,
              )
              break
            }
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
        (r) => sustratoRowHasMaterialChoice(r) || readNumberString(r.kg).trim(),
      )
      if (!anySustratoFilled) {
        addError("sustratosLam", "Debe seleccionar al menos un sustrato y su Kg a utilizar.")
      } else {
        for (let i = 0; i < sLamRows.length; i += 1) {
          const row = sLamRows[i]
          if (!row) continue
          const kg = readNumberString(row.kg).trim()
          if (!sustratoRowHasMaterialChoice(row) && !kg) continue
          if (!sustratoRowHasMaterialChoice(row)) {
            addError(
              "sustratosLam",
              `Indique el material del sustrato ${i + 1} (texto libre o inventario).`,
            )
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
          if (sustratoRowUsesCatalogMaterial(row)) {
            const mid = sustratoMaterialIdDigits(row)
            const mat = materialRowById(materials, mid)
            if (!mat) {
              addError(
                "sustratosLam",
                `Laminación: sustrato ${i + 1}: material no está en el listado cargado. Recargue o vuelva a elegir del catálogo.`,
              )
              break
            }
            if (decimalKgExceedsStock(kg, mat.quantity_on_hand)) {
              const stockNum = parseDecimalKgString(mat.quantity_on_hand)
              const disp = stockNum !== null ? formatKgForOtHint(stockNum) : readString(mat.quantity_on_hand)
              addError(
                "sustratosLam",
                `Laminación: Kg a utilizar del sustrato ${i + 1} supera el stock disponible (${disp} kg).`,
              )
              break
            }
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
      cancelFieldErrorsAutoClear()
      setFieldErrors(errors)
      fieldErrorsClearTimerRef.current = window.setTimeout(() => {
        fieldErrorsClearTimerRef.current = null
        setFieldErrors({})
      }, OT_FIELD_ERRORS_AUTO_CLEAR_MS) as unknown as number
      const first = Object.entries(errors)[0]
      toast.error(first?.[1] ?? "Revise los campos del formulario.", {
        duration: OT_VALIDATION_ERROR_TOAST_MS,
      })
      if (first?.[0]) focusFieldSoft(first[0])
      return
    }

    cancelFieldErrorsAutoClear()
    setFieldErrors({})
    clearAllBlurDismissTimers()
    setBlurFieldMessages({})
    setSaving(true)
    try {
      let workOrderId = id
      if (isDraftRoute && !opts?.forceNewOt && draftCoId && woProductId) {
        let list: LaravelPaginated<WorkOrderListRow>
        try {
          list = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
            query: { client_order_id: draftCoId, per_page: 100, page: 1 },
          })
        } catch (e) {
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudo comprobar si ya existen OT para este pedido y producto.")
          return
        }
        const matches = (list.data ?? []).filter(
          (w) =>
            (w.status ?? "").toLowerCase().trim() !== "cancelled" &&
            w.product?.id === woProductId,
        )
        if (matches.length > 0) {
          setDuplicateOtMatches(matches)
          return
        }
      }

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

      const rowsImp = getSustratosImp(formToSave)
      const formOut: Record<string, unknown> = {
        ...formToSave,
        sustratosVirgenImp: rowsImp,
        sustratoVirgenImp1: rowsImp[0]?.material_id ?? "",
        kgUtilizarImp1: rowsImp[0]?.kg ?? "",
        cliente: readString(prefill.cliente) || readString(formToSave.cliente),
        clienteRif: readString(prefill.clienteRif) || readString(formToSave.clienteRif),
        producto: readString(prefill.producto) || readString(formToSave.producto),

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
    cancelFieldErrorsAutoClear()
    setFieldErrors({})
    clearAllBlurDismissTimers()
    setBlurFieldMessages({})
    toast.message("Formulario limpiado.")
  }

  const rellenarDatosAlAzar = useCallback(() => {
    const { next, filled } = computeRandomFill(formRef.current, prefillRef.current)
    setForm(next)
    cancelFieldErrorsAutoClear()
    setFieldErrors({})
    clearAllBlurDismissTimers()
    setBlurFieldMessages({})
    setRellenoAzarCount(filled)
    setRellenoAzarDialogOpen(true)
  }, [cancelFieldErrorsAutoClear])

  if (isDraftRoute && !draftCoId) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          No se indicó un pedido cliente (OC) para esta nueva orden.
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

  const numeroOrdenVisible =
    readString(form.numeroOrden) ||
    readString(prefill.numeroOrden) ||
    readString(form.document_number) ||
    ""

  const clienteVisible = readString(form.cliente) || readString(prefill.cliente) || ""

  return (
    <div className="ax-ot p-2 sm:p-4 md:p-6">
      {/* Mismo carril horizontal que el <form>: en borrador el padding derecho reserva los FAB flotantes */}
      <div
        className={cn(
          "min-w-0",
          isDraftRoute && "pr-14 sm:pr-20 print:pr-0",
        )}
      >
      {/* Header (Ver órdenes / Rellenar al azar / Limpiar / Guardar) */}
      <div className="no-print mb-4 ax-card flex w-full min-w-0 flex-col gap-5 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Orden de trabajo</h2>
          </div>
          <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold leading-snug text-foreground">
            {isDraftRoute ? (
              <>
                <span className="text-primary">Borrador:</span> la OT aún no existe en base de datos.{" "}
                <span className="text-primary">Guardar orden</span> la crea, valida obligatorios y la deja en la lista.
              </>
            ) : (
              <>
                <span className="text-primary">Edición:</span> planilla de esta OT en servidor. Pulse{" "}
                <span className="text-primary">Guardar orden</span> para aplicar cambios.
              </>
            )}
          </div>
          {numeroOrdenVisible.trim() !== "" || clienteVisible.trim() !== "" ? (
            <div className="mt-3 text-center">
              {numeroOrdenVisible.trim() !== "" ? (
                <h3 className="text-xl font-normal leading-tight sm:text-2xl md:text-3xl">
                  <strong className="font-semibold tracking-tight text-primary">{numeroOrdenVisible}</strong>
                </h3>
              ) : null}
              {clienteVisible.trim() !== "" ? (
                <p className="mt-1.5 text-sm font-medium text-muted-foreground sm:text-base">
                  {clienteVisible}
                </p>
              ) : null}
            </div>
          ) : null}
          <WorkOrderStageBadge current="orden" className="mt-4" />
        </div>
        <TooltipProvider delayDuration={150}>
          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Ver órdenes"
                  className="border-sky-300 bg-sky-50 text-sky-800 shadow-sm hover:bg-sky-100 hover:text-sky-900"
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
                  className="border-amber-300 bg-amber-50 text-amber-900 shadow-sm hover:bg-amber-100 hover:text-amber-950"
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
                  className="border-rose-300 bg-rose-50 text-rose-800 shadow-sm hover:bg-rose-100 hover:text-rose-950"
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
                    "bg-slate-700 text-white hover:scale-110 hover:brightness-110",
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
                    "bg-sky-600 text-white hover:scale-110 hover:brightness-110",
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
                    "bg-fuchsia-600 text-white hover:scale-110 hover:brightness-110",
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
                    "ot-fab-laminacion flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform duration-200",
                    "text-white hover:scale-110 hover:brightness-110",
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
                    "bg-emerald-600 text-white hover:scale-110 hover:brightness-110",
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
            ref={planillaFormRef}
            onSubmit={(e) => {
              e.preventDefault()
              void guardar()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
                e.preventDefault()
              }
            }}
            className={cn(
              "min-w-0 w-full",
              /* Espacio inferior para FAB en borrador (el padding derecho va en el contenedor padre) */
              isDraftRoute ? "pb-[19rem] print:pb-16" : "pb-16",
            )}
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
                {/* Cabecera vinculada al pedido cliente (OC) */}
                <div>
                  <div className="section-header section-hdr-cabecera">
                    <span className="inline-flex items-center gap-2">
                      <ReceiptText className="h-4 w-4" />
                      CABECERA (ORDEN DE CLIENTE)
                    </span>
                  </div>
                  <div className="section-body">
                    <p className="mb-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-semibold leading-snug text-foreground">
                      <span className="text-primary">Catálogo</span> — cliente y producto del sistema.{" "}
                      <span className="text-primary">Inventario</span> — elija material en bodega.{" "}
                      <span className="text-primary">Figura</span> — botones 1–8 fijan el valor del campo.
                    </p>
                    <div className="ot-grid ot-cols-3">
                      <div className="ot-field">
                        <label className="ot-label required">Fecha</label>
                        <OtPlanillaInputIcon icon={Calendar}>
                          <input
                            type="date"
                            className="ot-input"
                            value={readString(form.fechaOrden) || readString(prefill.fechaOrden)}
                            onChange={(ev) => setKey(setForm, "fechaOrden", ev.target.value)}
                            disabled={!canEditShared}
                          />
                        </OtPlanillaInputIcon>
                      </div>
                      <div className="ot-field">
                        <label className="ot-label required">N° Orden</label>
                        <OtPlanillaInputIcon icon={Hash}>
                          <input
                            className="ot-input"
                            readOnly
                            value={readString(form.numeroOrden) || readString(prefill.numeroOrden) || readString(form.document_number) || ""}
                            onChange={() => { }}
                          />
                        </OtPlanillaInputIcon>
                      </div>
                      <div className="ot-field">
                        <label className="ot-label required">Cantidad solicitada (Kg)</label>
                        <OtPlanillaInputIcon icon={Scale}>
                          <input
                            type="number"
                            data-field="pedidoKg"
                            className="ot-input"
                            step="0.01"
                            min="0"
                            value={readNumberString(form.pedidoKg) || readNumberString(prefill.pedidoKg)}
                            onChange={(ev) => setKey(setForm, "pedidoKg", ev.target.value)}
                            disabled={!canEditShared}
                            aria-invalid={otInvalid("pedidoKg")}
                          />
                        </OtPlanillaInputIcon>
                        {renderError("pedidoKg")}
                      </div>
                    </div>

                    <div className="ot-grid ot-cols-2">
                      <div className="ot-field">
                        <label className="ot-label required">Maquina</label>
                        <Popover open={maquinaPickerOpen} onOpenChange={setMaquinaPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              data-field="maquina"
                              disabled={!canEditShared}
                              aria-expanded={maquinaPickerOpen}
                              aria-invalid={otInvalid("maquina")}
                              className="ot-input-unified h-9 w-full min-w-0 max-w-full justify-between gap-2 px-2 font-normal print:hidden"
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                <Factory className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 flex-1 truncate text-left text-sm">{maquinaComboLabel}</span>
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0 no-print w-[min(100vw-2rem,22rem)] min-w-[var(--radix-popover-trigger-width)]"
                            align="start"
                            side="bottom"
                          >
                            <Command shouldFilter>
                              <CommandInput placeholder="Buscar máquina…" />
                              <CommandList>
                                <CommandEmpty>Ninguna coincide.</CommandEmpty>
                                <CommandGroup heading="Selección">
                                  <CommandItem
                                    value="elegir maquina ninguna"
                                    onSelect={() => {
                                      setKey(setForm, "maquina", "")
                                      setMaquinaPickerOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn("mr-2 h-4 w-4", !maquina ? "opacity-100" : "opacity-0")}
                                      aria-hidden
                                    />
                                    Elegir…
                                  </CommandItem>
                                </CommandGroup>
                                {MACHINE_OPTIONS.map((g) => (
                                  <CommandGroup key={g.group} heading={g.group}>
                                    {g.options.map((o) => (
                                      <CommandItem
                                        key={o.value}
                                        value={`${g.group} ${o.label} ${o.value}`}
                                        onSelect={() => {
                                          setKey(setForm, "maquina", o.value)
                                          setMaquinaPickerOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            maquina === o.value ? "opacity-100" : "opacity-0",
                                          )}
                                          aria-hidden
                                        />
                                        {o.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                ))}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
                          <Factory className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{maquinaComboLabel}</span>
                        </div>
                        {renderError("maquina")}
                      </div>
                      <div className="ot-field">
                        <label className="ot-label">Ref. planchas (opcional)</label>
                        <OtPlanillaInputIcon icon={LayoutGrid}>
                          <input
                            className="ot-input"
                            data-skip-blur="1"
                            data-field="planchasReferencia"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={readString(form.planchasReferencia)}
                            onChange={(ev) =>
                              setKey(setForm, "planchasReferencia", sanitizePositiveIntInput(ev.target.value))
                            }
                            placeholder="067"
                            disabled={!canEditShared}
                            aria-invalid={otInvalid("planchasReferencia")}
                          />
                        </OtPlanillaInputIcon>
                        {renderError("planchasReferencia")}
                      </div>
                    </div>

                    <div className="ot-grid ot-cols-2">
                      <div className="ot-field md:col-span-2">
                        <label className="ot-label required">Metros Est.</label>
                        <OtPlanillaInputIcon icon={Ruler}>
                          <input
                            data-field="metrosEstimados"
                            className="ot-input"
                            type="text"
                            inputMode="text"
                            pattern="-?[0-9]*"
                            aria-invalid={otInvalid("metrosEstimados")}
                            value={metrosEstimadosDisplay(form.metrosEstimados)}
                            placeholder="12850"
                            onChange={(ev) => {
                              setKey(setForm, "metrosEstimados", sanitizeMetrosEstimadosInput(ev.target.value))
                            }}
                            disabled={!canEditShared}
                          />
                        </OtPlanillaInputIcon>
                        {renderError("metrosEstimados")}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Datos del producto */}
                <div>
                  <div className="section-header section-hdr-producto">
                    <span className="inline-flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      DATOS DEL PRODUCTO
                    </span>
                  </div>
                  <div className="section-body">
                    <div className="ot-datos-producto-master">
                      <div className="ot-field ot-dpm-span-4">
                        <Label className="ot-label !font-black required">Cliente</Label>
                        <OtPlanillaInputIcon icon={User}>
                          <Input
                            readOnly
                            className="ot-input-unified h-9 bg-muted/50 text-sm"
                            value={readString(form.cliente) || readString(prefill.cliente)}
                          />
                        </OtPlanillaInputIcon>
                      </div>
                      <div className="ot-field ot-dpm-span-2">
                        <Label className="ot-label !font-black required">RIF</Label>
                        <OtPlanillaInputIcon icon={IdCard}>
                          <Input
                            readOnly
                            className="ot-input-unified h-9 bg-muted/50 text-sm"
                            value={readString(form.clienteRif) || readString(prefill.clienteRif)}
                          />
                        </OtPlanillaInputIcon>
                      </div>

                      <div className="ot-field ot-dpm-span-4">
                        <Label className="ot-label !font-black required">Producto</Label>
                        {!woClientId ? (
                          <OtPlanillaInputIcon icon={LucidePackage}>
                            <Input
                              readOnly
                              className="ot-input-unified h-9 bg-muted/50 text-sm"
                              value={readString(form.producto) || readString(prefill.producto)}
                            />
                          </OtPlanillaInputIcon>
                        ) : (
                          <>
                            <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  disabled={!canEditShared || updatingProduct || clientProducts.length === 0}
                                  className="ot-input-unified h-9 w-full min-w-0 max-w-full justify-between gap-2 px-2 font-normal print:hidden"
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <LucidePackage className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                    <span className="min-w-0 flex-1 truncate text-left text-sm">
                                    {updatingProduct ? (
                                      <span className="text-muted-foreground">Actualizando…</span>
                                    ) : clientProducts.length === 0 ? (
                                      <span className="text-muted-foreground">No hay especificaciones para este cliente</span>
                                    ) : (
                                      productComboLabel
                                    )}
                                    </span>
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
                                        ? "Cargue especificaciones del cliente o intente otra búsqueda."
                                        : "Ninguna especificación coincide."}
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
                      <div className="ot-field ot-dpm-span-2">
                        <label className="ot-label required">Tipo impresión (especificación)</label>
                        <Popover open={tipoImpresionPickerOpen} onOpenChange={setTipoImpresionPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              data-field="tipoImpresionEstructura"
                              disabled={!canEditShared}
                              aria-expanded={tipoImpresionPickerOpen}
                              aria-invalid={otInvalid("tipoImpresionEstructura")}
                              className="ot-input-unified h-9 w-full min-w-0 max-w-full justify-between gap-2 px-2 font-normal print:hidden"
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                <Paintbrush className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 flex-1 truncate text-left text-sm">
                                  {tipoImpresionComboLabel}
                                </span>
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0 no-print w-[min(100vw-2rem,20rem)] min-w-[var(--radix-popover-trigger-width)]"
                            align="start"
                            side="bottom"
                          >
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  <CommandItem
                                    value="elegir tipo impresion vacio"
                                    onSelect={() => {
                                      setKey(setForm, "tipoImpresionEstructura", "")
                                      setTipoImpresionPickerOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        tipoImpresion === "" ? "opacity-100" : "opacity-0",
                                      )}
                                      aria-hidden
                                    />
                                    Elegir…
                                  </CommandItem>
                                  <CommandItem
                                    value="superficie tipo impresion"
                                    onSelect={() => {
                                      setKey(setForm, "tipoImpresionEstructura", "superficie")
                                      setTipoImpresionPickerOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        tipoImpresion === "superficie" ? "opacity-100" : "opacity-0",
                                      )}
                                      aria-hidden
                                    />
                                    Superficie
                                  </CommandItem>
                                  <CommandItem
                                    value="reverso tipo impresion"
                                    onSelect={() => {
                                      setKey(setForm, "tipoImpresionEstructura", "reverso")
                                      setTipoImpresionPickerOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        tipoImpresion === "reverso" ? "opacity-100" : "opacity-0",
                                      )}
                                      aria-hidden
                                    />
                                    Reverso
                                  </CommandItem>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
                          <Paintbrush className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{tipoImpresionComboLabel}</span>
                        </div>
                        {renderError("tipoImpresionEstructura")}
                      </div>

                      {tipoImpresion === "superficie" ? (
                        <div className="ot-field ot-dpm-span-6">
                          <label className="ot-label required">Estructura (1 capa)</label>
                          <OtPlanillaInputIcon icon={LucideLayers}>
                            <input
                              className="ot-input"
                              value={readString(form.estructuraCapa1) || readString(prefill.estructuraMaterial)}
                              onChange={(ev) => setKey(setForm, "estructuraCapa1", ev.target.value)}
                              placeholder="BOPP transparente 40 µm"
                              disabled={!canEditShared}
                            />
                          </OtPlanillaInputIcon>
                        </div>
                      ) : null}

                      {tipoImpresion === "reverso" ? (
                        <>
                          <div className="ot-field ot-dpm-span-2">
                            <label className="ot-label required">Capa 1</label>
                            <OtPlanillaInputIcon icon={LucideLayers}>
                              <input
                                className="ot-input"
                                value={readString(form.estructuraCapa1Rev)}
                                onChange={(ev) => setKey(setForm, "estructuraCapa1Rev", ev.target.value)}
                                placeholder="BOPP transparente 40 µm"
                                disabled={!canEditShared}
                              />
                            </OtPlanillaInputIcon>
                          </div>
                          <div className="ot-field ot-dpm-span-2">
                            <label className="ot-label required">Capa 2</label>
                            <OtPlanillaInputIcon icon={LucideLayers}>
                              <input
                                className="ot-input"
                                value={readString(form.estructuraCapa2Rev)}
                                onChange={(ev) => setKey(setForm, "estructuraCapa2Rev", ev.target.value)}
                                placeholder="CAST 20 µm"
                                disabled={!canEditShared}
                              />
                            </OtPlanillaInputIcon>
                          </div>
                          <div className="ot-field ot-dpm-span-2">
                            <label className="ot-label required">Capa 3</label>
                            <OtPlanillaInputIcon icon={LucideLayers}>
                              <input
                                className="ot-input"
                                value={readString(form.estructuraCapa3Rev)}
                                onChange={(ev) => setKey(setForm, "estructuraCapa3Rev", ev.target.value)}
                                placeholder="PEBD coextrusión 55 µm"
                                disabled={!canEditShared}
                              />
                            </OtPlanillaInputIcon>
                          </div>
                        </>
                      ) : null}

                      <div className="ot-field ot-dpm-span-2">
                        <Label className="ot-label !font-black required">C.P.E.</Label>
                        <OtPlanillaInputIcon icon={Tag}>
                          <Input
                            data-field="cpe"
                            className="ot-input-unified h-9 text-sm"
                            value={readString(form.cpe)}
                            onChange={(ev) => setKey(setForm, "cpe", ev.target.value)}
                            disabled={!canEditShared}
                            placeholder="CPE-LAM-OT-01"
                            aria-invalid={otInvalid("cpe")}
                          />
                        </OtPlanillaInputIcon>
                        {renderError("cpe")}
                      </div>
                      <div className="ot-field ot-dpm-span-2">
                        <Label className="ot-label !font-black required">M.P.P.S.</Label>
                        <OtPlanillaInputIcon icon={Tags}>
                          <Input
                            data-field="mpps"
                            className="ot-input-unified h-9 text-sm"
                            value={readString(form.mpps)}
                            onChange={(ev) => setKey(setForm, "mpps", ev.target.value)}
                            disabled={!canEditShared}
                            placeholder="MPS-PR-2026-A"
                            aria-invalid={otInvalid("mpps")}
                          />
                        </OtPlanillaInputIcon>
                        {renderError("mpps")}
                      </div>
                      <div className="ot-field ot-dpm-span-2">
                        <Label className="ot-label !font-black required">Cod. Barra</Label>
                        <OtPlanillaInputIcon icon={Barcode}>
                          <Input
                            data-field="codigoBarra"
                            className="ot-input-unified h-9 text-sm"
                            value={readString(form.codigoBarra)}
                            onChange={(ev) => setKey(setForm, "codigoBarra", ev.target.value)}
                            disabled={!canEditShared}
                            placeholder="7750123456789"
                            aria-invalid={otInvalid("codigoBarra")}
                          />
                        </OtPlanillaInputIcon>
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
                <div className="section-header section-hdr-montaje">
                  <span className="inline-flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    AREA DE MONTAJE
                  </span>
                </div>
                <div className="section-body">
                  <div className="ot-grid ot-cols-4">
                    <div className="ot-field">
                      <label className="ot-label required">Frecuencia (mm)</label>
                      <OtPlanillaInputIcon icon={Activity}>
                        <input
                          data-field="frecuencia"
                          className="ot-input"
                          value={readString(form.frecuencia)}
                          onChange={(e) => setKey(setForm, "frecuencia", sanitizeMetricInput(e.target.value))}
                          placeholder="250±2"
                          inputMode="decimal"
                          aria-invalid={otInvalid("frecuencia")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("frecuencia")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">N° Bandas</label>
                      <OtPlanillaInputIcon icon={GripHorizontal}>
                        <input
                          type="number"
                          data-field="numBandas"
                          min="1"
                          step="1"
                          className="ot-input"
                          value={readString(form.numBandas)}
                          onChange={(e) => setKey(setForm, "numBandas", sanitizePositiveIntInput(e.target.value))}
                          inputMode="numeric"
                          placeholder="4"
                          aria-invalid={otInvalid("numBandas")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("numBandas")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Tipo impresión en montaje</label>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        data-field="tipoImpresionMontaje"
                        disabled
                        title="Mismo valor que «Tipo impresión (especificación)» en Datos del producto; solo se edita allí."
                        className="ot-input-unified h-9 w-full min-w-0 max-w-full cursor-not-allowed justify-between gap-2 bg-muted/40 px-2 font-normal opacity-100 print:hidden"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <Printer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-left text-sm">{tipoImpresionComboLabel}</span>
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                      </Button>
                      <div className="ot-input-unified hidden h-9 items-center gap-2 bg-muted/40 px-2 text-sm print:flex">
                        <Printer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{tipoImpresionComboLabel}</span>
                      </div>
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Ancho Corte (mm)</label>
                      <OtPlanillaInputIcon icon={ArrowLeftRight}>
                        <input
                          data-field="anchoCorteMontaje"
                          className="ot-input"
                          value={readString(form.anchoCorteMontaje)}
                          onChange={(e) => setKey(setForm, "anchoCorteMontaje", sanitizeMetricInput(e.target.value))}
                          placeholder="330±2"
                          inputMode="decimal"
                          aria-invalid={otInvalid("anchoCorteMontaje")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("anchoCorteMontaje")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">N° Repeticion o Frecuencia</label>
                      <OtPlanillaInputIcon icon={Repeat}>
                        <input
                          type="number"
                          data-field="numRepeticion"
                          min="1"
                          step="1"
                          className="ot-input"
                          value={readString(form.numRepeticion)}
                          onChange={(e) => setKey(setForm, "numRepeticion", sanitizePositiveIntInput(e.target.value))}
                          inputMode="numeric"
                          placeholder="6"
                          aria-invalid={otInvalid("numRepeticion")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("numRepeticion")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Desarrollo (mm) (auto)</label>
                      <OtPlanillaInputIcon icon={Ruler}>
                        <input
                          data-field="desarrollo"
                          className="ot-input cursor-not-allowed bg-muted/40"
                          readOnly
                          tabIndex={-1}
                          title="Calculado: frecuencia × N° repetición"
                          value={readString(form.desarrollo)}
                          placeholder="812±2"
                          aria-invalid={otInvalid("desarrollo")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("desarrollo")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Ancho Montaje (mm) (auto)</label>
                      <OtPlanillaInputIcon icon={Columns}>
                        <input
                          data-field="anchoMontaje"
                          className="ot-input cursor-not-allowed bg-muted/40"
                          readOnly
                          tabIndex={-1}
                          title="Calculado: ancho corte × N° bandas"
                          value={readString(form.anchoMontaje)}
                          placeholder="1040±2"
                          aria-invalid={otInvalid("anchoMontaje")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("anchoMontaje")}
                    </div>
                    <div className="ot-field ot-field-figure sm:col-span-2">
                      <div className="ot-label-row">
                        <label className="ot-label required">Figura embobinado (1-8 o libre)</label>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                          title="Botones 1–8 = atajo para el valor de la figura."
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
                      <label className="ot-label required">N° Colores</label>
                      <OtPlanillaInputIcon icon={Palette}>
                        <input
                          type="number"
                          data-field="numColores"
                          min="1"
                          step="1"
                          className="ot-input"
                          value={readString(form.numColores)}
                          onChange={(e) => setKey(setForm, "numColores", sanitizePositiveIntInput(e.target.value))}
                          inputMode="numeric"
                          placeholder="6"
                          aria-invalid={otInvalid("numColores")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("numColores")}
                    </div>
                  </div>
                  <div className="ot-grid ot-cols-1">
                    <div className="ot-field">
                      <label className="ot-label required">Observaciones montaje</label>
                      <OtPlanillaInputIcon icon={MessageSquare}>
                        <input
                          className="ot-input"
                          value={readString(form.obsMontaje)}
                          onChange={(e) => setKey(setForm, "obsMontaje", e.target.value)}
                          placeholder="Revisar registro y centrado antes de arranque"
                        />
                      </OtPlanillaInputIcon>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Impresión */}
            {(canViewImpresion || canViewTintas) ? (
              <div className="ot-section">
                <div className="section-header section-hdr-impresion">
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
                          <label className="ot-label required">Piñon (dientes)</label>
                          <OtPlanillaInputIcon icon={Cog}>
                            <input
                              data-field="pinonImp"
                              className="ot-input"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={readString(form.pinonImp)}
                              onChange={(e) => setKey(setForm, "pinonImp", sanitizePositiveIntInput(e.target.value))}
                              placeholder="840"
                              aria-invalid={otInvalid("pinonImp")}
                            />
                          </OtPlanillaInputIcon>
                          {renderError("pinonImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label required">Linea de corte</label>
                          <Popover open={lineaCortePickerOpen} onOpenChange={setLineaCortePickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                data-field="lineaCorte"
                                aria-expanded={lineaCortePickerOpen}
                                aria-invalid={otInvalid("lineaCorte")}
                                className="ot-input-unified h-9 w-full min-w-0 max-w-full justify-between gap-2 px-2 font-normal print:hidden"
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                  <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  <span className="min-w-0 flex-1 truncate text-left text-sm">
                                    {lineaCorteComboLabel(form.lineaCorte)}
                                  </span>
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="p-0 no-print w-[min(100vw-2rem,18rem)] min-w-[var(--radix-popover-trigger-width)]"
                              align="start"
                              side="bottom"
                            >
                              <Command>
                                <CommandList>
                                  <CommandGroup>
                                    <CommandItem
                                      value="elegir linea corte vacio"
                                      onSelect={() => {
                                        setKey(setForm, "lineaCorte", "")
                                        setLineaCortePickerOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          normalizeYesNo(form.lineaCorte) === "" ? "opacity-100" : "opacity-0",
                                        )}
                                        aria-hidden
                                      />
                                      Elegir…
                                    </CommandItem>
                                    <CommandItem
                                      value="si linea corte"
                                      onSelect={() => {
                                        setKey(setForm, "lineaCorte", "si")
                                        setLineaCortePickerOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          normalizeYesNo(form.lineaCorte) === "si" ? "opacity-100" : "opacity-0",
                                        )}
                                        aria-hidden
                                      />
                                      Si
                                    </CommandItem>
                                    <CommandItem
                                      value="no linea corte"
                                      onSelect={() => {
                                        setKey(setForm, "lineaCorte", "no")
                                        setLineaCortePickerOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          normalizeYesNo(form.lineaCorte) === "no" ? "opacity-100" : "opacity-0",
                                        )}
                                        aria-hidden
                                      />
                                      No
                                    </CommandItem>
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
                            <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{lineaCorteComboLabel(form.lineaCorte)}</span>
                          </div>
                          {renderError("lineaCorte")}
                        </div>
                        <div className="ot-field sm:col-span-2 lg:col-span-1" data-field="figEmbImpDisplay">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="ot-label required">Figura emb. (1-8)</label>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal"
                              title="Botones 1–8 = atajo para el valor de la figura."
                            >
                              Figura
                            </Badge>
                          </div>
                          <WindingFigurePicker
                            value={readString(form.figEmbImpDisplay)}
                            onChange={(v) => setKey(setForm, "figEmbImpDisplay", v)}
                            invalid={otInvalid("figEmbImpDisplay")}
                          />
                          {renderError("figEmbImpDisplay")}
                        </div>
                      </div>

                      <div className="ot-sustratos-virgen-block ot-sustratos-virgen-block--impresion">
                        <div className="ot-sustratos-virgen-head">
                          <span className="ot-label required">Sustratos virgen (inventario)</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "ot-sustratos-virgen-badge--impresion shrink-0 border text-[10px] font-normal shadow-none",
                            )}
                          >
                            Inventario
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mb-2 text-xs leading-relaxed no-print">
                          <span className="font-medium text-foreground">Sustrato:</span> puede escribir la referencia,
                          abrir el catálogo de inventario o crear un material nuevo en otra pestaña (botón{" "}
                          <PackagePlus className="inline-block h-3 w-3 align-text-bottom opacity-80" aria-hidden />).
                        </p>
                        <div className="ot-sustratos-virgen-rows">
                          {sustratosImp.map((r, idx) => (
                            <div key={idx} className="ot-grid ot-cols-2-asym">
                              <div className="ot-field">
                                <label className="ot-label required">{`Sustrato ${idx + 1}`}</label>
                                <div className="flex min-w-0 gap-1 no-print">
                                  <OtPlanillaInputIcon icon={Warehouse} className="min-w-0 flex-1">
                                    <Input
                                      data-field="sustratosImp"
                                      className="ot-input-unified h-9 min-w-0 text-sm"
                                      value={sustratoVirgenDisplayValue(materials, r)}
                                      onChange={(e) => {
                                        const next = [...sustratosImp]
                                        next[idx] = {
                                          ...next[idx],
                                          material_id: "",
                                          material_free_text: e.target.value,
                                        }
                                        setSustratosImp(setForm, next)
                                      }}
                                      placeholder="Referencia libre o elegir del inventario…"
                                      aria-invalid={otInvalid("sustratosImp")}
                                    />
                                  </OtPlanillaInputIcon>
                                  <Popover
                                    open={sustratoImpPickerIdx === idx}
                                    onOpenChange={(open) => setSustratoImpPickerIdx(open ? idx : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 shrink-0"
                                        title="Catálogo de materiales (área material)"
                                        aria-expanded={sustratoImpPickerIdx === idx}
                                      >
                                        <ChevronsUpDown className="h-4 w-4 opacity-70" aria-hidden />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="p-0 no-print w-[min(100vw-2rem,28rem)] min-w-[var(--radix-popover-trigger-width)]"
                                      align="start"
                                      side="bottom"
                                    >
                                      <Command shouldFilter>
                                        <CommandInput placeholder="Buscar por SKU o nombre…" />
                                        <CommandList>
                                          <CommandEmpty>
                                            {materials.length === 0
                                              ? "No hay filas en inventario. Escriba la referencia a mano o cree un material."
                                              : "Ninguno coincide."}
                                          </CommandEmpty>
                                          <CommandGroup>
                                            <CommandItem
                                              value="ninguno sustrato impresion"
                                              onSelect={() => {
                                                const next = [...sustratosImp]
                                                next[idx] = { ...next[idx], material_id: "", material_free_text: "" }
                                                setSustratosImp(setForm, next)
                                                setSustratoImpPickerIdx(null)
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  !sustratoRowHasMaterialChoice(r) ? "opacity-100" : "opacity-0",
                                                )}
                                                aria-hidden
                                              />
                                              Sin selección (solo texto libre abajo)
                                            </CommandItem>
                                            {materials.map((m) => {
                                              const label = `${m.sku} · ${m.name}`
                                              const stockQty = parseDecimalKgString(m.quantity_on_hand)
                                              const stockLabel =
                                                stockQty !== null ? `${formatKgForOtHint(stockQty)} kg` : null
                                              const search = [m.sku, m.name, String(m.id)].filter(Boolean).join(" ")
                                              const pickedInv =
                                                readString(r.material_id).trim() === String(m.id) &&
                                                !readString(r.material_free_text).trim()
                                              return (
                                                <CommandItem
                                                  key={m.id}
                                                  value={search}
                                                  onSelect={() => {
                                                    const next = [...sustratosImp]
                                                    next[idx] = {
                                                      ...next[idx],
                                                      material_id: String(m.id),
                                                      material_free_text: "",
                                                    }
                                                    setSustratosImp(setForm, next)
                                                    setSustratoImpPickerIdx(null)
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      pickedInv ? "opacity-100" : "opacity-0",
                                                    )}
                                                    aria-hidden
                                                  />
                                                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                                    <span className="truncate">{label}</span>
                                                    {stockLabel != null ? (
                                                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                                        {stockLabel}
                                                      </span>
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
                                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild title="Crear material en inventario">
                                    <Link to="/materiales/nuevo" target="_blank" rel="noopener noreferrer">
                                      <PackagePlus className="h-4 w-4" aria-hidden />
                                    </Link>
                                  </Button>
                                </div>
                                <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
                                  <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  <span className="min-w-0 flex-1 truncate">
                                    {sustratoVirgenDisplayValue(materials, r) || "—"}
                                  </span>
                                </div>
                              </div>
                              <div className="ot-field">
                                <label className="ot-label required">Kg a utilizar</label>
                                <OtPlanillaInputIcon icon={Weight}>
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
                                    placeholder="420.50"
                                    aria-invalid={otInvalid("sustratosImp")}
                                  />
                                </OtPlanillaInputIcon>
                                <SustratoKgStockFooter row={r} materials={materials} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="ot-sustratos-virgen-toolbar no-print">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            title="Agregar sustrato"
                            aria-label="Agregar sustrato"
                            disabled={sustratosImp.length >= MAX_SUSTRATO_ROWS}
                            onClick={() =>
                              setSustratosImp(
                                setForm,
                                sustratosImp.length >= MAX_SUSTRATO_ROWS
                                  ? sustratosImp
                                  : [...sustratosImp, { material_id: "", kg: "", material_free_text: "" }],
                              )
                            }
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                        {renderError("sustratosImp")}
                      </div>

                      <div className="ot-grid ot-metrics-before-nested ot-sustratos-virgen-metrics-gap ot-cols-4">
                        <div className="ot-field">
                          <label className="ot-label required">Kg ingresado</label>
                          <OtPlanillaInputIcon icon={ArrowDownToLine}>
                            <input
                              data-field="kgIngresadoImp"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              className="ot-input"
                              value={readNumberString(form.kgIngresadoImp)}
                              onChange={(e) => setKey(setForm, "kgIngresadoImp", e.target.value)}
                              placeholder="1850.50"
                              aria-invalid={otInvalid("kgIngresadoImp")}
                            />
                          </OtPlanillaInputIcon>
                          {renderError("kgIngresadoImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label required">Kg salida</label>
                          <OtPlanillaInputIcon icon={ArrowUpFromLine}>
                            <input
                              data-field="kgSalidaImp"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              className="ot-input"
                              value={readNumberString(form.kgSalidaImp)}
                              onChange={(e) => setKey(setForm, "kgSalidaImp", e.target.value)}
                              placeholder="1825.00"
                              aria-invalid={otInvalid("kgSalidaImp")}
                            />
                          </OtPlanillaInputIcon>
                          {renderError("kgSalidaImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label required">Merma</label>
                          <OtPlanillaInputIcon icon={TrendingDown}>
                            <input
                              data-field="mermaImp"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              className="ot-input"
                              value={readNumberString(form.mermaImp)}
                              onChange={(e) => setKey(setForm, "mermaImp", e.target.value)}
                              placeholder="14.25"
                              aria-invalid={otInvalid("mermaImp")}
                            />
                          </OtPlanillaInputIcon>
                          {renderError("mermaImp")}
                        </div>
                        <div className="ot-field">
                          <label className="ot-label required">Metros</label>
                          <OtPlanillaInputIcon icon={Ruler}>
                            <input
                              data-field="metrosImp"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              className="ot-input"
                              value={readNumberString(form.metrosImp)}
                              onChange={(e) => setKey(setForm, "metrosImp", e.target.value)}
                              placeholder="8200"
                              aria-invalid={otInvalid("metrosImp")}
                            />
                          </OtPlanillaInputIcon>
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
                <div className="section-header section-hdr-laminacion">
                  <span className="inline-flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    AREA DE LAMINACION
                  </span>
                </div>
                <div className="section-body">
                  <div className="ot-grid ot-cols-4">
                    <div className="ot-field sm:col-span-2 lg:col-span-1" data-field="figuraEmbobinadoLam">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="ot-label required">Figura embobinado</label>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                          title="Botones 1–8 = atajo para el valor de la figura."
                        >
                          Figura
                        </Badge>
                      </div>
                      <WindingFigurePicker
                        value={readString(form.figuraEmbobinadoLam)}
                        onChange={(v) => setKey(setForm, "figuraEmbobinadoLam", v)}
                        invalid={otInvalid("figuraEmbobinadoLam")}
                      />
                      {renderError("figuraEmbobinadoLam")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Gramaje adhesivo (g/m2)</label>
                      <OtPlanillaInputIcon icon={FlaskConical}>
                        <input
                          data-field="gramajeAdhesivo"
                          className="ot-input"
                          value={readString(form.gramajeAdhesivo)}
                          onChange={(e) => setKey(setForm, "gramajeAdhesivo", e.target.value.replace(/[^0-9.,]/g, ""))}
                          placeholder="1,75"
                          inputMode="decimal"
                          aria-invalid={otInvalid("gramajeAdhesivo")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("gramajeAdhesivo")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Relacion mezcla</label>
                      <OtPlanillaInputIcon icon={Percent}>
                        <input
                          data-field="relacionMezcla"
                          className="ot-input"
                          value={readString(form.relacionMezcla)}
                          onChange={(e) =>
                            setKey(setForm, "relacionMezcla", e.target.value.replace(/[^0-9.,/]/g, "").replace(/\/{2,}/g, "/"))
                          }
                          placeholder="100/80"
                          inputMode="decimal"
                          aria-invalid={otInvalid("relacionMezcla")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("relacionMezcla")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Observaciones</label>
                      <OtPlanillaInputIcon icon={StickyNote}>
                        <input
                          className="ot-input"
                          value={readString(form.obsLaminacion)}
                          onChange={(e) => setKey(setForm, "obsLaminacion", e.target.value)}
                          placeholder="Temperatura tambor según ficha del adhesivo"
                        />
                      </OtPlanillaInputIcon>
                    </div>
                  </div>

                  <div className="ot-sustratos-virgen-block ot-sustratos-virgen-block--laminacion">
                    <div className="ot-sustratos-virgen-head">
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                        <Package className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="ot-label required">Sustratos virgen a utilizar (laminación)</span>
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ot-sustratos-virgen-badge--laminacion shrink-0 border text-[10px] font-normal shadow-none",
                        )}
                      >
                        Laminación
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-2 text-xs leading-relaxed no-print">
                      <span className="font-medium text-foreground">Sustrato:</span> puede escribir la referencia,
                      abrir el catálogo de inventario o crear un material nuevo en otra pestaña (botón{" "}
                      <PackagePlus className="inline-block h-3 w-3 align-text-bottom opacity-80" aria-hidden />).
                    </p>
                    <div className="ot-sustratos-virgen-rows">
                      {sustratosLam.map((r, idx) => (
                        <div key={idx} className="ot-grid ot-cols-2-asym">
                          <div className="ot-field">
                            <label className="ot-label required">{`Sustrato ${idx + 1}`}</label>
                            <div className="flex min-w-0 gap-1 no-print">
                              <OtPlanillaInputIcon icon={Warehouse} className="min-w-0 flex-1">
                                <Input
                                  data-field="sustratosLam"
                                  className="ot-input-unified h-9 min-w-0 text-sm"
                                  value={sustratoVirgenDisplayValue(materials, r)}
                                  onChange={(e) => {
                                    const next = [...sustratosLam]
                                    next[idx] = {
                                      ...next[idx],
                                      material_id: "",
                                      material_free_text: e.target.value,
                                    }
                                    setSustratosLam(setForm, next)
                                  }}
                                  placeholder="Referencia libre o elegir del inventario…"
                                  aria-invalid={otInvalid("sustratosLam")}
                                />
                              </OtPlanillaInputIcon>
                              <Popover
                                open={sustratoLamPickerIdx === idx}
                                onOpenChange={(open) => setSustratoLamPickerIdx(open ? idx : null)}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    title="Catálogo de materiales (área material)"
                                    aria-expanded={sustratoLamPickerIdx === idx}
                                  >
                                    <ChevronsUpDown className="h-4 w-4 opacity-70" aria-hidden />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="p-0 no-print w-[min(100vw-2rem,28rem)] min-w-[var(--radix-popover-trigger-width)]"
                                  align="start"
                                  side="bottom"
                                >
                                  <Command shouldFilter>
                                    <CommandInput placeholder="Buscar por SKU o nombre…" />
                                    <CommandList>
                                      <CommandEmpty>
                                        {materials.length === 0
                                          ? "No hay filas en inventario. Escriba la referencia a mano o cree un material."
                                          : "Ninguno coincide."}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        <CommandItem
                                          value="ninguno sustrato laminacion"
                                          onSelect={() => {
                                            const next = [...sustratosLam]
                                            next[idx] = { ...next[idx], material_id: "", material_free_text: "" }
                                            setSustratosLam(setForm, next)
                                            setSustratoLamPickerIdx(null)
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              !sustratoRowHasMaterialChoice(r) ? "opacity-100" : "opacity-0",
                                            )}
                                            aria-hidden
                                          />
                                          Sin selección (solo texto libre abajo)
                                        </CommandItem>
                                        {materials.map((m) => {
                                          const label = `${m.sku} · ${m.name}`
                                          const stockQty = parseDecimalKgString(m.quantity_on_hand)
                                          const stockLabel =
                                            stockQty !== null ? `${formatKgForOtHint(stockQty)} kg` : null
                                          const search = [m.sku, m.name, String(m.id)].filter(Boolean).join(" ")
                                          const pickedInv =
                                            readString(r.material_id).trim() === String(m.id) &&
                                            !readString(r.material_free_text).trim()
                                          return (
                                            <CommandItem
                                              key={m.id}
                                              value={search}
                                              onSelect={() => {
                                                const next = [...sustratosLam]
                                                next[idx] = {
                                                  ...next[idx],
                                                  material_id: String(m.id),
                                                  material_free_text: "",
                                                }
                                                setSustratosLam(setForm, next)
                                                setSustratoLamPickerIdx(null)
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  pickedInv ? "opacity-100" : "opacity-0",
                                                )}
                                                aria-hidden
                                              />
                                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                                <span className="truncate">{label}</span>
                                                {stockLabel != null ? (
                                                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                                    {stockLabel}
                                                  </span>
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
                              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild title="Crear material en inventario">
                                <Link to="/materiales/nuevo" target="_blank" rel="noopener noreferrer">
                                  <PackagePlus className="h-4 w-4" aria-hidden />
                                </Link>
                              </Button>
                            </div>
                            <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
                              <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="min-w-0 flex-1 truncate">
                                {sustratoVirgenDisplayValue(materials, r) || "—"}
                              </span>
                            </div>
                          </div>
                          <div className="ot-field">
                            <label className="ot-label required">Kg a utilizar</label>
                            <OtPlanillaInputIcon icon={Weight}>
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
                                placeholder="420.50"
                                aria-invalid={otInvalid("sustratosLam")}
                              />
                            </OtPlanillaInputIcon>
                            <SustratoKgStockFooter row={r} materials={materials} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="ot-sustratos-virgen-toolbar no-print">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        title="Agregar otro sustrato"
                        aria-label="Agregar otro sustrato"
                        disabled={sustratosLam.length >= MAX_SUSTRATO_ROWS}
                        onClick={() =>
                          setSustratosLam(
                            setForm,
                            sustratosLam.length >= MAX_SUSTRATO_ROWS
                              ? sustratosLam
                              : [...sustratosLam, { material_id: "", kg: "", material_free_text: "" }],
                          )
                        }
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    {renderError("sustratosLam")}
                  </div>

                  <div className="ot-grid ot-metrics-before-nested ot-sustratos-virgen-metrics-gap ot-cols-4">
                    <div className="ot-field">
                      <label className="ot-label required">Kg entrada</label>
                      <OtPlanillaInputIcon icon={ArrowDownToLine}>
                        <input
                          data-field="kgEntradaLam"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.kgEntradaLam)}
                          onChange={(e) => setKey(setForm, "kgEntradaLam", e.target.value)}
                          placeholder="210.00"
                          aria-invalid={otInvalid("kgEntradaLam")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("kgEntradaLam")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Kg salida</label>
                      <OtPlanillaInputIcon icon={ArrowUpFromLine}>
                        <input
                          data-field="kgSalidaLam"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.kgSalidaLam)}
                          onChange={(e) => setKey(setForm, "kgSalidaLam", e.target.value)}
                          placeholder="205.50"
                          aria-invalid={otInvalid("kgSalidaLam")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("kgSalidaLam")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Metraje</label>
                      <OtPlanillaInputIcon icon={Ruler}>
                        <input
                          data-field="metrajeLam"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.metrajeLam)}
                          onChange={(e) => setKey(setForm, "metrajeLam", e.target.value)}
                          placeholder="3100"
                          aria-invalid={otInvalid("metrajeLam")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("metrajeLam")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Merma</label>
                      <OtPlanillaInputIcon icon={TrendingDown}>
                        <input
                          data-field="mermaLam"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.mermaLam)}
                          onChange={(e) => setKey(setForm, "mermaLam", e.target.value)}
                          placeholder="8.50"
                          aria-invalid={otInvalid("mermaLam")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("mermaLam")}
                    </div>
                  </div>

                  <div className="ot-grid ot-cols-4">
                    <div className="ot-field">
                      <label className="ot-label required">Kg entrada 2 (trilam.)</label>
                      <OtPlanillaInputIcon icon={LucideLayers}>
                        <input
                          data-field="kgEntradaLam2"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.kgEntradaLam2)}
                          onChange={(e) => setKey(setForm, "kgEntradaLam2", e.target.value)}
                          placeholder="180.00"
                          aria-invalid={otInvalid("kgEntradaLam2")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("kgEntradaLam2")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Kg salida 2 (trilam.)</label>
                      <OtPlanillaInputIcon icon={LucideLayers}>
                        <input
                          data-field="kgSalidaLam2"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.kgSalidaLam2)}
                          onChange={(e) => setKey(setForm, "kgSalidaLam2", e.target.value)}
                          placeholder="175.00"
                          aria-invalid={otInvalid("kgSalidaLam2")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("kgSalidaLam2")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Metraje 2</label>
                      <OtPlanillaInputIcon icon={Ruler}>
                        <input
                          data-field="metrajeLam2"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.metrajeLam2)}
                          onChange={(e) => setKey(setForm, "metrajeLam2", e.target.value)}
                          placeholder="2800"
                          aria-invalid={otInvalid("metrajeLam2")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("metrajeLam2")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Merma 2</label>
                      <OtPlanillaInputIcon icon={TrendingDown}>
                        <input
                          data-field="mermaLam2"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.mermaLam2)}
                          onChange={(e) => setKey(setForm, "mermaLam2", e.target.value)}
                          placeholder="6.20"
                          aria-invalid={otInvalid("mermaLam2")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("mermaLam2")}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Corte / Embalaje */}
            {canViewCorte ? (
              <div className="ot-section">
                <div className="section-header section-hdr-corte">
                  <span className="inline-flex items-center gap-2">
                    <Scissors className="h-4 w-4" />
                    AREA DE CORTE / EMBALAJE
                  </span>
                </div>
                <div className="section-body">
                  <div className="ot-grid ot-cols-4">
                    <div className="ot-field">
                      <label className="ot-label required">Ancho corte (mm)</label>
                      <OtPlanillaInputIcon icon={Crop}>
                        <input
                          data-field="anchoCorteFinal"
                          className="ot-input"
                          value={readString(form.anchoCorteFinal)}
                          placeholder="320±0"
                          onChange={(e) => setKey(setForm, "anchoCorteFinal", sanitizeMetricInput(e.target.value))}
                          aria-invalid={otInvalid("anchoCorteFinal")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("anchoCorteFinal")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Peso bobina (Kg)</label>
                      <OtPlanillaInputIcon icon={Weight}>
                        <input
                          data-field="pesoBobina"
                          className="ot-input"
                          value={readString(form.pesoBobina)}
                          placeholder="19-20"
                          onChange={(e) => setKey(setForm, "pesoBobina", sanitizeMetricInput(e.target.value))}
                          aria-invalid={otInvalid("pesoBobina")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("pesoBobina")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Metros/Bobina (m)</label>
                      <OtPlanillaInputIcon icon={CircleDot}>
                        <input
                          data-field="metrosBobina"
                          className="ot-input"
                          value={readString(form.metrosBobina)}
                          placeholder="1020 ± 20"
                          onChange={(e) => setKey(setForm, "metrosBobina", sanitizeMetricInput(e.target.value))}
                          aria-invalid={otInvalid("metrosBobina")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("metrosBobina")}
                    </div>
                    <div className="ot-field sm:col-span-2" data-field="orientacionEmbalaje">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="ot-label required">Figura embobinado (1-8 o libre)</label>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                          title="Botones 1–8 = atajo para el valor de la figura."
                        >
                          Figura
                        </Badge>
                      </div>
                      <WindingFigurePicker
                        value={readString(form.orientacionEmbalaje)}
                        onChange={(v) => setKey(setForm, "orientacionEmbalaje", v)}
                        invalid={otInvalid("orientacionEmbalaje")}
                      />
                      {renderError("orientacionEmbalaje")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Ubic. fotocelda</label>
                      <OtPlanillaInputIcon icon={MapPin}>
                        <input
                          data-field="ubicFotoceldaCorte"
                          className="ot-input"
                          value={readString(form.ubicFotoceldaCorte)}
                          onChange={(e) => setKey(setForm, "ubicFotoceldaCorte", e.target.value)}
                          placeholder="Borde líder"
                          aria-invalid={otInvalid("ubicFotoceldaCorte")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("ubicFotoceldaCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Dist. fotocelda al borde (mm)</label>
                      <OtPlanillaInputIcon icon={Ruler}>
                        <input
                          data-field="distFotoceldaBorde"
                          className="ot-input"
                          value={readString(form.distFotoceldaBorde)}
                          placeholder="1±1"
                          onChange={(e) => setKey(setForm, "distFotoceldaBorde", sanitizeMetricInput(e.target.value))}
                          aria-invalid={otInvalid("distFotoceldaBorde")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("distFotoceldaBorde")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Dist. figura lado contrario (mm)</label>
                      <OtPlanillaInputIcon icon={Ruler}>
                        <input
                          data-field="distFiguraLadoContrario"
                          className="ot-input"
                          value={readString(form.distFiguraLadoContrario)}
                          placeholder="20±1"
                          onChange={(e) => setKey(setForm, "distFiguraLadoContrario", sanitizeMetricInput(e.target.value))}
                          aria-invalid={otInvalid("distFiguraLadoContrario")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("distFiguraLadoContrario")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Dist. figura lado fotocelda (mm)</label>
                      <OtPlanillaInputIcon icon={Ruler}>
                        <input
                          data-field="distFiguraLadoFotocelda"
                          className="ot-input"
                          value={readString(form.distFiguraLadoFotocelda)}
                          placeholder="30±1"
                          onChange={(e) => setKey(setForm, "distFiguraLadoFotocelda", sanitizeMetricInput(e.target.value))}
                          aria-invalid={otInvalid("distFiguraLadoFotocelda")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("distFiguraLadoFotocelda")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Max. empates</label>
                      <OtPlanillaInputIcon icon={Link2}>
                        <input
                          data-field="maxEmpates"
                          className="ot-input"
                          value={readString(form.maxEmpates)}
                          placeholder="1"
                          inputMode="numeric"
                          onChange={(e) => setKey(setForm, "maxEmpates", sanitizePositiveIntInput(e.target.value))}
                          aria-invalid={otInvalid("maxEmpates")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("maxEmpates")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Diam. bobina (mm)</label>
                      <OtPlanillaInputIcon icon={Circle}>
                        <input
                          data-field="diamBobina"
                          className="ot-input"
                          value={readString(form.diamBobina)}
                          placeholder="400 ± 5"
                          onChange={(e) => setKey(setForm, "diamBobina", sanitizeMetricInput(e.target.value))}
                          aria-invalid={otInvalid("diamBobina")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("diamBobina")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Ancho core (mm)</label>
                      <OtPlanillaInputIcon icon={Columns}>
                        <input
                          data-field="anchoCore"
                          className="ot-input"
                          value={readString(form.anchoCore)}
                          onChange={(e) => setKey(setForm, "anchoCore", sanitizeMetricInput(e.target.value))}
                          placeholder="152±1"
                          aria-invalid={otInvalid("anchoCore")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("anchoCore")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Diam. core (Plg)</label>
                      <OtPlanillaInputIcon icon={Disc}>
                        <input
                          data-field="diamCorePlg"
                          className="ot-input"
                          value={readString(form.diamCorePlg)}
                          onChange={(e) => setKey(setForm, "diamCorePlg", sanitizeMetricInput(e.target.value))}
                          placeholder="6"
                          aria-invalid={otInvalid("diamCorePlg")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("diamCorePlg")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Cant. cores</label>
                      <OtPlanillaInputIcon icon={Hash}>
                        <input
                          data-field="cantCores"
                          className="ot-input"
                          value={readString(form.cantCores)}
                          inputMode="numeric"
                          onChange={(e) => setKey(setForm, "cantCores", sanitizePositiveIntInput(e.target.value))}
                          placeholder="1"
                          aria-invalid={otInvalid("cantCores")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("cantCores")}
                    </div>
                  </div>

                  <div className="ot-grid ot-metrics-before-nested ot-cols-4">
                    <div className="ot-field">
                      <label className="ot-label required">Kg ingresados</label>
                      <OtPlanillaInputIcon icon={PackagePlus}>
                        <input
                          data-field="kgIngresadosCorte"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.kgIngresadosCorte)}
                          placeholder="1200.50"
                          onChange={(e) => setKey(setForm, "kgIngresadosCorte", e.target.value)}
                          aria-invalid={otInvalid("kgIngresadosCorte")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("kgIngresadosCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Kg salida</label>
                      <OtPlanillaInputIcon icon={ArrowUpFromLine}>
                        <input
                          data-field="kgSalidaCorte"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={
                            activeScope === "corte"
                              ? sumSalidaKgFromForm(form).toFixed(2)
                              : readNumberString(form.kgSalidaCorte)
                          }
                          readOnly={activeScope === "corte"}
                          onChange={(e) => {
                            if (activeScope === "corte") return
                            setKey(setForm, "kgSalidaCorte", e.target.value)
                          }}
                          placeholder="1185.00"
                          aria-invalid={otInvalid("kgSalidaCorte")}
                          title={
                            activeScope === "corte"
                              ? "Calculado automáticamente desde los rollos de las paletas (sección Corte)"
                              : undefined
                          }
                        />
                      </OtPlanillaInputIcon>
                      {activeScope === "corte" ? (
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          Suma de rollos en paletas (solo lectura).
                        </p>
                      ) : null}
                      {renderError("kgSalidaCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Kg merma</label>
                      <OtPlanillaInputIcon icon={Trash2}>
                        <input
                          data-field="kgMermaCorte"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.kgMermaCorte)}
                          placeholder="10.25"
                          onChange={(e) => setKey(setForm, "kgMermaCorte", e.target.value)}
                          aria-invalid={otInvalid("kgMermaCorte")}
                        />
                      </OtPlanillaInputIcon>
                      {renderError("kgMermaCorte")}
                    </div>
                    <div className="ot-field">
                      <label className="ot-label required">Metraje</label>
                      <OtPlanillaInputIcon icon={Ruler}>
                        <input
                          data-field="metrajeCorte"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="ot-input"
                          value={readNumberString(form.metrajeCorte)}
                          onChange={(e) => setKey(setForm, "metrajeCorte", e.target.value)}
                          placeholder="9100"
                          aria-invalid={otInvalid("metrajeCorte")}
                        />
                      </OtPlanillaInputIcon>
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
                    <div className="section-header section-hdr-obs">
                      <span className="inline-flex items-center gap-2">
                        <NotebookPen className="h-4 w-4" />
                        OBSERVACIONES GENERALES
                      </span>
                    </div>
                    <div className="section-body">
                      <div className="ot-field">
                        <label className="ot-label required">Observaciones generales</label>
                        <OtPlanillaInputIcon icon={FileText} align="top">
                          <Textarea
                            className="min-h-[5rem] resize-y"
                            value={readString(form.observacionesGenerales)}
                            onChange={(e) => setKey(setForm, "observacionesGenerales", e.target.value)}
                            placeholder="Revisar secuencia de color y embalaje final acordado con el cliente"
                          />
                        </OtPlanillaInputIcon>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="section-header section-hdr-prog">PROGRAMACION</div>
                    <div className="section-body">
                      <div className="ot-grid ot-cols-2">
                        <div className="ot-field">
                          <label className="ot-label required">F. Inicio</label>
                          <OtPlanillaInputIcon icon={CalendarClock}>
                            <input
                              type="date"
                              className="ot-input"
                              value={readString(form.fechaInicio)}
                              onChange={(e) => setKey(setForm, "fechaInicio", e.target.value)}
                            />
                          </OtPlanillaInputIcon>
                        </div>
                        <div className="ot-field">
                          <label className="ot-label required">F. Entrega</label>
                          <OtPlanillaInputIcon icon={CalendarDays}>
                            <input
                              type="date"
                              className="ot-input"
                              value={readString(form.fechaEntrega)}
                              onChange={(e) => setKey(setForm, "fechaEntrega", e.target.value)}
                            />
                          </OtPlanillaInputIcon>
                        </div>
                        <div className="ot-field">
                          <label className="ot-label required">Prioridad</label>
                          <Popover open={priorityPickerOpen} onOpenChange={setPriorityPickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                data-field="priority"
                                aria-expanded={priorityPickerOpen}
                                className="ot-input-unified h-9 w-full min-w-0 max-w-full justify-between gap-2 px-2 font-normal print:hidden"
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                  <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  <span className="min-w-0 flex-1 truncate text-left text-sm">
                                    {priorityComboLabel(form.priority)}
                                  </span>
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="p-0 no-print w-[min(100vw-2rem,16rem)] min-w-[var(--radix-popover-trigger-width)]"
                              align="start"
                              side="bottom"
                            >
                              <Command>
                                <CommandList>
                                  <CommandGroup>
                                    {(
                                      [
                                        ["normal", "Normal"],
                                        ["alta", "Alta"],
                                        ["urgente", "Urgente"],
                                      ] as const
                                    ).map(([val, label]) => (
                                      <CommandItem
                                        key={val}
                                        value={`prioridad ${val} ${label}`}
                                        onSelect={() => {
                                          setKey(setForm, "priority", val)
                                          setPriorityPickerOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            normalizedPriorityValue(form.priority) === val
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                          aria-hidden
                                        />
                                        {label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
                            <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{priorityComboLabel(form.priority)}</span>
                          </div>
                        </div>
                        <div className="ot-field sm:col-span-2">
                          <label className="ot-label required">Asignar a área(s)</label>
                          <div className="relative min-w-0 rounded-md border border-[rgba(0,0,0,0.18)] bg-[rgba(255,255,255,0.92)] p-2 pl-8">
                            <LayoutGrid
                              className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground"
                              aria-hidden
                              strokeWidth={2.25}
                            />
                            <AreasMultiCheckbox value={[...PROGRAMACION_AREAS]} />
                          </div>
                        </div>
                        <div className="ot-field sm:col-span-2">
                          <label className="ot-label required">Motivo de asignación</label>
                          <OtPlanillaInputIcon icon={LucideClipboardList} align="top">
                            <Textarea
                              data-field="programacionMotivo"
                              className="min-h-[4.5rem]"
                              value={readString(form.programacionMotivo)}
                              onChange={(e) => setKey(setForm, "programacionMotivo", e.target.value)}
                              placeholder="Cliente confirma ventanas de corte; coordinar con programación"
                            />
                          </OtPlanillaInputIcon>
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
            <div className="no-print ax-mes mt-6 space-y-4">
              <WorkOrderCorteOpsSection
                form={form}
                setForm={setForm}
                pedidoTotalKg={Number(readNumberString(form.pedidoKg) || readNumberString(prefill.pedidoKg) || "0")}
                canOperateProduction={canSaveCorteProduction}
              />
              {!canSaveCorteForm ? (
                <p className="max-w-md text-center text-xs text-muted-foreground">
                  {MES_SAVE_BLOCKED_MESSAGE}
                </p>
              ) : null}
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  onClick={() => setPendingHeaderAction("save")}
                  disabled={saving || loading || !canSaveCorteForm}
                >
                  {saving ? "Guardando…" : "Guardar orden"}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
      </div>

      <Dialog
        open={pendingHeaderAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingHeaderAction(null)
        }}
      >
        <DialogContent
          overlayClassName="z-[100] bg-black/50 backdrop-blur-sm"
          className={cn(
            "max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-2xl sm:max-w-md",
            "z-[101] w-full translate-x-[-50%] translate-y-[-50%]",
            "[&>button.absolute]:hidden",
          )}
        >
          {headerConfirmCopy && pendingHeaderAction ? (
            <>
              <DialogHeader className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-6 py-6 text-center sm:text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
                  {pendingHeaderConfirmIcon(pendingHeaderAction)}
                </div>
                <DialogTitle className="text-balance text-xl font-bold leading-tight tracking-tight text-black dark:text-foreground sm:text-2xl">
                  {headerConfirmCopy.title}
                </DialogTitle>
              </DialogHeader>
              <DialogDescription className="px-6 py-4 text-center text-sm leading-relaxed text-muted-foreground">
                {headerConfirmCopy.description}
              </DialogDescription>
              <DialogFooter className="flex flex-row flex-wrap items-center justify-center gap-3 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-[9.5rem] gap-2 border-primary/25"
                  onClick={() => setPendingHeaderAction(null)}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="min-w-[9.5rem] gap-2 border-primary/25 hover:bg-primary/90"
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
                  {pendingHeaderConfirmIcon(pendingHeaderAction, "h-4 w-4 shrink-0")}
                  {headerConfirmCopy.cta}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={duplicateOtMatches !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateOtMatches(null)
        }}
      >
        <DialogContent
          overlayClassName="z-[100] bg-black/50 backdrop-blur-sm"
          className={cn(
            "max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-2xl sm:max-w-md",
            "z-[101] w-full translate-x-[-50%] translate-y-[-50%]",
            "[&>button.absolute]:hidden",
          )}
        >
          {duplicateOtMatches && duplicateOtMatches.length > 0 ? (
            <>
              <DialogHeader className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-6 py-6 text-center sm:text-center">
                <DialogTitle className="text-balance text-xl font-bold leading-tight tracking-tight text-black dark:text-foreground sm:text-2xl">
                  OT ya registradas para este pedido y producto
                </DialogTitle>
              </DialogHeader>
              <DialogDescription className="space-y-3 px-6 py-4 text-center text-sm leading-relaxed text-muted-foreground">
                <p>
                  Ya existe al menos una orden de trabajo activa vinculada al mismo pedido cliente y
                  producto. Puede abrir la más reciente para seguir trabajando en ella (acumulativo en
                  gestión), o crear una OT nueva independiente.
                </p>
                <p className="text-xs">
                  Si abre una existente, este borrador no se guardará como OT nueva: deberá ajustar la
                  planilla en la OT elegida.
                </p>
                <p className="font-mono text-xs text-foreground">
                  {duplicateOtMatches
                    .slice(0, 10)
                    .map((w) => w.code)
                    .join(", ")}
                  {duplicateOtMatches.length > 10 ? " …" : ""}
                </p>
              </DialogDescription>
              <DialogFooter className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-col">
                <Button
                  type="button"
                  variant="default"
                  className="w-full gap-2 border-primary/25 hover:bg-primary/90"
                  onClick={() => {
                    const pick = latestRowInGroup(duplicateOtMatches)
                    setDuplicateOtMatches(null)
                    toast.message(
                      "Se abre la OT más reciente. El borrador actual no se creó como OT nueva.",
                    )
                    nav(`/ordenes-trabajo/${pick.id}`, { replace: true })
                  }}
                >
                  Abrir OT existente (más reciente)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setDuplicateOtMatches(null)
                    void guardar({ forceNewOt: true })
                  }}
                >
                  Crear nueva OT independiente
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setDuplicateOtMatches(null)}
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={rellenoAzarDialogOpen} onOpenChange={setRellenoAzarDialogOpen}>
        <DialogContent
          overlayClassName="z-[100] bg-black/50 backdrop-blur-sm"
          className={cn(
            "max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-2xl sm:max-w-md",
            "z-[101] w-full translate-x-[-50%] translate-y-[-50%]",
            "[&>button.absolute]:hidden",
          )}
        >
          <DialogHeader className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-6 py-6 text-center sm:text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Shuffle className="h-6 w-6 shrink-0" aria-hidden />
            </div>
            <DialogTitle className="text-balance text-xl font-bold leading-tight tracking-tight text-black dark:text-foreground sm:text-2xl">
              Relleno al azar
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="px-6 py-4 text-center text-sm leading-relaxed text-muted-foreground">
            {rellenoAzarCount > 0
              ? `Se rellenaron ${rellenoAzarCount} campo(s) vacío(s) con valores al azar en tipo de impresión (especificación), montaje, impresión, laminación, corte, tintas y programación. La cabecera (orden de cliente) y los datos del producto no se tocan: complete esos campos según su criterio.`
              : "No había campos vacíos que rellenar en las áreas técnicas (montaje en adelante), o todo ya estaba completo. Cabecera y datos del producto nunca se rellenan al azar."}
          </DialogDescription>
          <DialogFooter className="flex flex-row flex-wrap items-center justify-center gap-3 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="default"
              className="min-w-[9.5rem] gap-2 border-primary/25 hover:bg-primary/90"
              onClick={() => setRellenoAzarDialogOpen(false)}
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

