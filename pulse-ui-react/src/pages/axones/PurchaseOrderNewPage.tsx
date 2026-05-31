"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Droplet,
  FileText,
  FlaskConical,
  Hash,
  Info,
  Layers,
  MapPin,
  Package,
  PencilLine,
  Plus,
  Ruler,
  Scale,
  ShoppingCart,
  UserPlus,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import {
  isDuplicatePurchaseOrderCodeMessage,
  translateApiValidationMessage,
} from "@/lib/api-validation-es"
import type { LaravelPaginated, PurchaseOrderRow, SupplierRecord } from "@/types/api"
import "./purchase-order-list.css"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PoLineDraft = {
  description: string
  item_type: "sustrato" | "tinta" | "quimico" | "otros"
  micras: string
  ancho_mm: string
  quantity_ordered: string
  unit: string
}

const ADD_LINE_TOOLTIP =
  "Agregar otra línea al pedido. Las filas vacías se omiten al guardar si hay al menos una línea válida con cantidad ≥ 0,001."

const PO_LINES_PAGE_SIZE = 8
const PO_VALIDATION_TOAST_MS = 3000
const PO_FIELD_ERRORS_AUTO_CLEAR_MS = 3000

function parseDecimalInput(raw: string): number {
  const t = raw.trim().replace(/\s+/g, "").replace(",", ".")
  if (!t) return Number.NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Fecha local en formato `YYYY-MM-DD` para `<input type="date">`. */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseDateInputValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined
  }
  return parsed
}

function formatDateInputDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return "Seleccione fecha…"
  return `${match[3]}/${match[2]}/${match[1]}`
}

/** Unidades alineadas con recepción de inventario (`StorePurchaseReceiptRequest`). */
const PO_LINE_UNITS = ["kg", "unidad", "m", "rollo", "otros"] as const
type PoLineUnit = (typeof PO_LINE_UNITS)[number]

function isPoLineUnit(u: string): u is PoLineUnit {
  return (PO_LINE_UNITS as readonly string[]).includes(u)
}

function isPoLineSubmitReady(line: PoLineDraft): boolean {
  const qty = parseDecimalInput(line.quantity_ordered)
  const unit = line.unit.trim() || "kg"
  return Number.isFinite(qty) && qty >= 0.001 && isPoLineUnit(unit)
}

/**
 * Solo dígitos y un separador decimal (`.` o `,` → se guarda `.` en estado).
 * Máximo `maxFracDigits` decimales tras el separador.
 */
function sanitizePositiveDecimalInput(raw: string, maxFracDigits: number): string {
  let out = ""
  let hasSep = false
  let fracCount = 0
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (hasSep) {
        if (fracCount >= maxFracDigits) continue
        fracCount++
      }
      out += ch
      continue
    }
    if ((ch === "." || ch === ",") && !hasSep) {
      hasSep = true
      out += "."
    }
  }
  return out
}

const emptyLine = (): PoLineDraft => ({
  description: "",
  item_type: "sustrato",
  micras: "",
  ancho_mm: "",
  quantity_ordered: "",
  unit: "kg" satisfies PoLineUnit,
})

const PO_ITEM_TYPE_META: Record<
  PoLineDraft["item_type"],
  {
    label: string
    icon: typeof Layers
    iconClass: string
    badgeClass: string
    rowClass: string
    selectTriggerClass: string
    rowNumberClass: string
  }
> = {
  sustrato: {
    label: "Sustrato",
    icon: Layers,
    iconClass: "text-emerald-600",
    badgeClass: "border-emerald-500/40 bg-emerald-50/90 text-emerald-950",
    rowClass:
      "border-l-4 border-l-emerald-600 !bg-emerald-100/85 hover:!bg-emerald-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-emerald-500/40 bg-emerald-50/95 text-emerald-950 shadow-sm",
    rowNumberClass: "border-emerald-500/40 bg-emerald-200/70 text-emerald-900",
  },
  tinta: {
    label: "Tinta",
    icon: Droplet,
    iconClass: "text-violet-600",
    badgeClass: "border-violet-500/40 bg-violet-50/90 text-violet-950",
    rowClass:
      "border-l-4 border-l-violet-600 !bg-violet-100/85 hover:!bg-violet-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-violet-500/40 bg-violet-50/95 text-violet-950 shadow-sm",
    rowNumberClass: "border-violet-500/40 bg-violet-200/70 text-violet-900",
  },
  quimico: {
    label: "Químico",
    icon: FlaskConical,
    iconClass: "text-sky-600",
    badgeClass: "border-sky-500/40 bg-sky-50/90 text-sky-950",
    rowClass:
      "border-l-4 border-l-sky-600 !bg-sky-100/85 hover:!bg-sky-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-sky-500/40 bg-sky-50/95 text-sky-950 shadow-sm",
    rowNumberClass: "border-sky-500/40 bg-sky-200/70 text-sky-900",
  },
  otros: {
    label: "Otros",
    icon: Package,
    iconClass: "text-amber-600",
    badgeClass: "border-amber-500/40 bg-amber-50/90 text-amber-950",
    rowClass:
      "border-l-4 border-l-amber-600 !bg-amber-100/85 hover:!bg-amber-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-amber-500/40 bg-amber-50/95 text-amber-950 shadow-sm",
    rowNumberClass: "border-amber-500/40 bg-amber-200/70 text-amber-900",
  },
}

const PO_ITEM_TYPE_OPTIONS = Object.keys(PO_ITEM_TYPE_META) as PoLineDraft["item_type"][]

const PO_ROW_FIELD_CLASS = "border-white/60 bg-background/90 shadow-sm"

function poInvalidHighlightClass(hasError: boolean) {
  return hasError
    ? "border-destructive/80 bg-destructive/[0.06] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35),0_0_0_3px_rgba(239,68,68,0.12)]"
    : ""
}

function poToastError(message: string) {
  toast.error(message, { duration: PO_VALIDATION_TOAST_MS })
}

function poFieldIconClass(hasError: boolean, disabled?: boolean) {
  return cn(
    "pointer-events-none absolute left-3 h-4 w-4 transition-colors",
    hasError
      ? "text-red-500"
      : disabled
        ? "text-muted-foreground/50"
        : "text-muted-foreground group-focus-within/field:text-primary",
  )
}

function PoItemTypeLabel({ type }: { type: PoLineDraft["item_type"] }) {
  const meta = PO_ITEM_TYPE_META[type]
  const Icon = meta.icon
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className={cn("size-4 shrink-0", meta.iconClass)} aria-hidden />
      <span className="truncate">{meta.label}</span>
    </span>
  )
}

function shouldShowDims(itemType: PoLineDraft["item_type"]) {
  return itemType === "sustrato"
}

function buildLineDescription(line: PoLineDraft): string {
  const base = line.description.trim()
  const micras = line.micras.trim()
  const ancho = line.ancho_mm.trim()
  const parts: string[] = []
  if (base) parts.push(base)
  parts.push(`Tipo: ${line.item_type}`)
  if (shouldShowDims(line.item_type)) {
    if (micras) parts.push(`Micras: ${micras}`)
    if (ancho) parts.push(`Ancho(mm): ${ancho}`)
  }
  return parts.join(" | ").trim()
}

const OC_CODE_SEQ_KEY = "axones_oc_code_seq_v1"

/** Misma longitud máxima que `StorePurchaseOrderRequest` (`max:64`). */
const PO_CODE_MAX_LEN = 64

const PURCHASE_ORDER_NEW_DRAFT_KEY = "axones:purchase-order-new-draft"

type PurchaseOrderNewDraftV1 = {
  v: 1
  supplierId: string
  code: string
  codeTouched: boolean
  orderedAt: string
  notes: string
  lines: PoLineDraft[]
}

/** Alinea micras/ancho si el tipo oculta dimensiones (mismo criterio que al editar en UI). */
function normalizeLineByBusinessRules(line: PoLineDraft): PoLineDraft {
  if (shouldShowDims(line.item_type)) return line
  return { ...line, micras: "", ancho_mm: "" }
}

function normalizePoLineDraftFromStorage(raw: unknown): PoLineDraft {
  if (!raw || typeof raw !== "object") return emptyLine()
  const r = raw as Partial<PoLineDraft>
  const it = r.item_type
  const item_type: PoLineDraft["item_type"] =
    it === "sustrato" || it === "tinta" || it === "quimico" || it === "otros" ? it : "sustrato"
  const u = typeof r.unit === "string" ? r.unit.trim() : ""
  const unit: PoLineUnit = isPoLineUnit(u) ? u : "kg"
  return normalizeLineByBusinessRules({
    description: typeof r.description === "string" ? r.description : "",
    item_type,
    micras: typeof r.micras === "string" ? r.micras : "",
    ancho_mm: typeof r.ancho_mm === "string" ? r.ancho_mm : "",
    quantity_ordered: typeof r.quantity_ordered === "string" ? r.quantity_ordered : "",
    unit,
  })
}

type PoFieldErrors = {
  supplier?: string
  code?: string
  linesGeneral?: string
}

type PoLineFieldErrors = {
  quantity?: string
  unit?: string
}

function buildAutoPoCode(): string {
  const year = new Date().getFullYear()
  const seqRaw = window.localStorage.getItem(OC_CODE_SEQ_KEY)
  const seqMap = seqRaw ? (JSON.parse(seqRaw) as Record<string, number>) : {}
  const next = (seqMap[String(year)] ?? 0) + 1
  seqMap[String(year)] = next
  window.localStorage.setItem(OC_CODE_SEQ_KEY, JSON.stringify(seqMap))
  return `OC-${year}-${String(next).padStart(3, "0")}`
}

function lineHasAnyValue(line: PoLineDraft): boolean {
  return Boolean(
    line.description.trim() ||
      line.micras.trim() ||
      line.ancho_mm.trim() ||
      line.quantity_ordered.trim() ||
      line.unit.trim() !== "kg",
  )
}

function formatPoLinesCount(n: number): string {
  return n === 1 ? "1 línea" : `${n} líneas`
}

async function findPurchaseOrderIdByCode(poCode: string): Promise<number | null> {
  const trimmed = poCode.trim()
  if (!trimmed) return null
  try {
    const res = await apiFetch<LaravelPaginated<PurchaseOrderRow>>("purchase-orders", {
      query: { q: trimmed, per_page: 20, page: 1 },
    })
    const exact = (res.data ?? []).find(
      (row) => row.code.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    return exact?.id ?? null
  } catch {
    return null
  }
}

export default function PurchaseOrderNewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [orderedAtOpen, setOrderedAtOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [supplierListReady, setSupplierListReady] = useState(false)
  const [resolvingSupplier, setResolvingSupplier] = useState(false)
  const supplierResolveFailedForRef = useRef<string | null>(null)
  const fieldErrorsClearTimerRef = useRef<number | null>(null)

  const [supplierId, setSupplierId] = useState("")
  const [code, setCode] = useState("")
  const [codeTouched, setCodeTouched] = useState(false)
  const [orderedAt, setOrderedAt] = useState(() => toDateInputValue(new Date()))
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<PoLineDraft[]>([emptyLine()])
  const [linesPage, setLinesPage] = useState(1)
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false)
  const [codeEditConfirmOpen, setCodeEditConfirmOpen] = useState(false)
  const [codeEditUnlocked, setCodeEditUnlocked] = useState(false)
  const [duplicatePoDialog, setDuplicatePoDialog] = useState<{
    open: boolean
    id: number | null
    code: string
  }>({ open: false, id: null, code: "" })
  const [fieldErrors, setFieldErrors] = useState<PoFieldErrors>({})
  const [lineErrors, setLineErrors] = useState<Record<number, PoLineFieldErrors>>({})

  const selectedSupplier = useMemo(
    () => suppliers.find((x) => String(x.id) === supplierId) ?? null,
    [suppliers, supplierId],
  )

  const showDimensionColumns = useMemo(
    () => lines.some((line) => shouldShowDims(line.item_type)),
    [lines],
  )

  const linesPageCount = useMemo(
    () => Math.max(1, Math.ceil(lines.length / PO_LINES_PAGE_SIZE)),
    [lines.length],
  )

  const safeLinesPage = Math.min(linesPage, linesPageCount)

  const paginatedLineEntries = useMemo(() => {
    const start = (safeLinesPage - 1) * PO_LINES_PAGE_SIZE
    return lines.slice(start, start + PO_LINES_PAGE_SIZE).map((line, offset) => ({
      line,
      index: start + offset,
    }))
  }, [lines, safeLinesPage])

  useEffect(() => {
    setLinesPage((p) => (p > linesPageCount ? linesPageCount : p))
  }, [linesPageCount])

  const supplierTriggerDisplay = useMemo(() => {
    if (!supplierId.trim()) return { text: "Seleccione…", muted: true }
    if (selectedSupplier) {
      const name = selectedSupplier.name?.trim() || "Sin nombre"
      return {
        text: `${name}${selectedSupplier.rif ? ` · ${selectedSupplier.rif}` : ""}`,
        muted: false,
      }
    }
    if (!supplierListReady) return { text: "Cargando…", muted: true }
    if (resolvingSupplier) return { text: "Cargando proveedor…", muted: true }
    return {
      text: "Abra la lista y elija el proveedor de nuevo.",
      muted: true,
    }
  }, [
    supplierId,
    selectedSupplier,
    supplierListReady,
    resolvingSupplier,
  ])

  const navState = location.state as { from?: string; presetSupplierId?: number } | null
  const presetSupplierConsumedRef = useRef(false)

  const returnTo = useMemo(() => {
    const from = navState?.from?.trim()
    return from && from.startsWith("/") ? from : "/ordenes-compra"
  }, [navState?.from])

  function savePoDraftToSession(): boolean {
    const draft: PurchaseOrderNewDraftV1 = {
      v: 1,
      supplierId,
      code,
      codeTouched,
      orderedAt,
      notes,
      lines,
    }
    try {
      sessionStorage.setItem(PURCHASE_ORDER_NEW_DRAFT_KEY, JSON.stringify(draft))
      return true
    } catch {
      toast.error("No se pudo guardar el borrador del formulario. Intente de nuevo.")
      return false
    }
  }

  function persistPoDraftAndGoToNewSupplier() {
    if (!savePoDraftToSession()) return
    navigate("/proveedores/form", { state: { from: "/ordenes-compra/nueva" } })
  }

  useEffect(() => {
    if (!codeTouched && !code.trim()) {
      setCode(buildAutoPoCode())
    }
  }, [code, codeTouched])

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const supRes = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
          query: { per_page: 100, page: 1 },
        })
        if (!c) {
          setSuppliers(supRes.data)
          setSupplierListReady(true)
        }
      } catch {
        if (!c) {
          setSuppliers([])
          setSupplierListReady(true)
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    if (!supplierListReady) return
    if (presetSupplierConsumedRef.current) return
    const pid = navState?.presetSupplierId
    if (!Number.isFinite(pid) || (pid ?? 0) < 1) return
    presetSupplierConsumedRef.current = true
    setSupplierId(String(pid))
  }, [supplierListReady, navState?.presetSupplierId])

  useEffect(() => {
    const proveedorRaw = searchParams.get("proveedor")
    const proveedorNum = proveedorRaw ? Number(proveedorRaw) : NaN
    const hasProveedor = Number.isFinite(proveedorNum) && proveedorNum > 0
    if (!hasProveedor) return

    let parsed: PurchaseOrderNewDraftV1 | null = null
    try {
      const raw = sessionStorage.getItem(PURCHASE_ORDER_NEW_DRAFT_KEY)
      if (raw) {
        const data = JSON.parse(raw) as Partial<PurchaseOrderNewDraftV1>
        if (data?.v === 1) parsed = data as PurchaseOrderNewDraftV1
      }
    } catch {
      parsed = null
    }

    setSupplierId(String(proveedorNum))
    supplierResolveFailedForRef.current = null
    setFieldErrors({})
    setLineErrors({})

    if (parsed) {
      setCode(typeof parsed.code === "string" ? parsed.code : "")
      setCodeTouched(Boolean(parsed.codeTouched))
      setCodeEditUnlocked(Boolean(parsed.codeTouched))
      setOrderedAt(
        typeof parsed.orderedAt === "string" && parsed.orderedAt
          ? parsed.orderedAt
          : toDateInputValue(new Date()),
      )
      setNotes(typeof parsed.notes === "string" ? parsed.notes : "")
      if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        setLines(parsed.lines.map((row) => normalizePoLineDraftFromStorage(row)))
      } else {
        setLines([emptyLine()])
      }
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("proveedor")
        return next
      },
      { replace: true },
    )

    if (parsed) {
      try {
        sessionStorage.removeItem(PURCHASE_ORDER_NEW_DRAFT_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    supplierResolveFailedForRef.current = null
  }, [supplierId])

  useEffect(() => {
    if (!supplierListReady || !supplierId.trim()) return
    const sid = Number(supplierId)
    if (!Number.isFinite(sid) || sid < 1) return
    if (suppliers.some((s) => String(s.id) === supplierId)) return
    if (supplierResolveFailedForRef.current === supplierId) return

    let cancelled = false
    setResolvingSupplier(true)
    void (async () => {
      try {
        const rec = await apiFetch<SupplierRecord>(`suppliers/${sid}`)
        if (cancelled) return
        setSuppliers((prev) =>
          prev.some((p) => p.id === rec.id) ? prev : [...prev, rec],
        )
      } catch {
        if (!cancelled) {
          supplierResolveFailedForRef.current = supplierId
          toast.error("No se pudo cargar el proveedor guardado. Elija otro en la lista.")
        }
      } finally {
        if (!cancelled) setResolvingSupplier(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supplierListReady, supplierId, suppliers])

  useEffect(() => {
    return () => {
      if (fieldErrorsClearTimerRef.current != null) {
        window.clearTimeout(fieldErrorsClearTimerRef.current)
      }
    }
  }, [])

  function cancelFieldErrorsAutoClear() {
    if (fieldErrorsClearTimerRef.current != null) {
      window.clearTimeout(fieldErrorsClearTimerRef.current)
      fieldErrorsClearTimerRef.current = null
    }
  }

  function scheduleFieldErrorsAutoClear() {
    cancelFieldErrorsAutoClear()
    fieldErrorsClearTimerRef.current = window.setTimeout(() => {
      fieldErrorsClearTimerRef.current = null
      setFieldErrors({})
      setLineErrors({})
    }, PO_FIELD_ERRORS_AUTO_CLEAR_MS) as unknown as number
  }

  function applyPurchaseOrderValidationErrors(
    nextField: PoFieldErrors,
    nextLine: Record<number, PoLineFieldErrors>,
  ) {
    cancelFieldErrorsAutoClear()
    if (nextField.code) setCodeEditUnlocked(true)
    setFieldErrors(nextField)
    setLineErrors(nextLine)
    scheduleFieldErrorsAutoClear()
    toastPurchaseOrderValidationErrors(nextField, nextLine)
    focusFirstPurchaseOrderValidationError(nextField, nextLine)
  }

  function addLine() {
    setLines((prev) => {
      const next = [...prev, emptyLine()]
      setLinesPage(Math.ceil(next.length / PO_LINES_PAGE_SIZE))
      return next
    })
  }

  function updateLine(i: number, patch: Partial<PoLineDraft>) {
    setLineErrors((prev) => {
      if (!prev[i]) return prev
      const next = { ...prev }
      delete next[i]
      return next
    })
    setLines((prev) =>
      prev.map((row, j) => (j === i ? { ...row, ...patch } : row)),
    )
  }

  function removeLine(i: number) {
    setLines((prev) => {
      const next = prev.filter((_, j) => j !== i)
      setLinesPage((p) => Math.min(p, Math.max(1, Math.ceil(next.length / PO_LINES_PAGE_SIZE))))
      return next
    })
    setLineErrors((prev) => {
      const next: Record<number, PoLineFieldErrors> = {}
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k)
        if (!Number.isFinite(idx)) continue
        if (idx === i) continue
        next[idx > i ? idx - 1 : idx] = v
      }
      return next
    })
  }

  function computePurchaseOrderValidation(): {
    ok: boolean
    fieldErrors: PoFieldErrors
    lineErrors: Record<number, PoLineFieldErrors>
  } {
    const nextField: PoFieldErrors = {}
    const nextLine: Record<number, PoLineFieldErrors> = {}

    const sid = Number(supplierId)
    if (!Number.isFinite(sid) || sid < 1) {
      nextField.supplier = "Seleccione un proveedor."
    }

    const codeTrim = code.trim()
    if (!codeTrim) {
      nextField.code = "El código único es obligatorio."
    } else if (codeTrim.length > PO_CODE_MAX_LEN) {
      nextField.code = `Como máximo ${PO_CODE_MAX_LEN} caracteres (coincide con el servidor).`
    }

    const editedRowIndexes = lines
      .map((line, idx) => (lineHasAnyValue(line) ? idx : -1))
      .filter((idx) => idx >= 0)

    if (editedRowIndexes.length === 0) {
      nextField.linesGeneral =
        "Agregue al menos una línea con cantidad mayor a cero (y completada según corresponda)."
    }

    for (const i of editedRowIndexes) {
      const L = lines[i]
      const errs: PoLineFieldErrors = {}
      const qty = parseDecimalInput(L.quantity_ordered)
      if (!Number.isFinite(qty) || qty < 0.001) {
        errs.quantity = "Indique cantidad ≥ 0,001."
      }
      const unitTrim = L.unit.trim() || "kg"
      if (!isPoLineUnit(unitTrim)) {
        errs.unit = "Seleccione una unidad válida."
      }
      if (Object.keys(errs).length) nextLine[i] = errs
    }

    const payloadCandidate = lines.filter(isPoLineSubmitReady)

    if (!nextField.linesGeneral && payloadCandidate.length === 0) {
      nextField.linesGeneral =
        "Ninguna línea tiene cantidad válida. Revise cantidad (≥ 0,001) y unidad."
    }

    const ok =
      !nextField.supplier &&
      !nextField.code &&
      !nextField.linesGeneral &&
      Object.keys(nextLine).length === 0 &&
      payloadCandidate.length > 0

    return { ok, fieldErrors: nextField, lineErrors: nextLine }
  }

  function toastPurchaseOrderValidationErrors(
    field: PoFieldErrors,
    lineErrs: Record<number, PoLineFieldErrors>,
  ) {
    const messages: string[] = []
    if (field.supplier) messages.push(`Proveedor: ${field.supplier}`)
    if (field.code) messages.push(`Código: ${field.code}`)
    if (field.linesGeneral) messages.push(field.linesGeneral)
    const rowIndexes = Object.keys(lineErrs)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    for (const i of rowIndexes) {
      const row = lineErrs[i]
      const n = i + 1
      if (row.quantity) messages.push(`Línea ${n}: ${row.quantity}`)
      if (row.unit) messages.push(`Línea ${n}: ${row.unit}`)
    }
    if (messages.length === 0) return
    poToastError(messages.slice(0, 3).join(" · "))
  }

  function focusLineRow(rowIndex: number) {
    const page = Math.floor(rowIndex / PO_LINES_PAGE_SIZE) + 1
    setLinesPage(page)
    window.requestAnimationFrame(() => {
      document.getElementById(`po-line-row-${rowIndex}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      document.getElementById(`po-line-${rowIndex}-qty`)?.focus()
    })
  }

  function focusFirstPurchaseOrderValidationError(
    field: PoFieldErrors,
    lineErrs: Record<number, PoLineFieldErrors>,
  ) {
    if (field.supplier) {
      document.getElementById("po-supplier-trigger")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (field.code) {
      document.getElementById("po-code")?.scrollIntoView({ behavior: "smooth", block: "center" })
      document.getElementById("po-code")?.focus()
      return
    }
    if (field.linesGeneral) {
      setLinesPage(1)
      document.getElementById("po-line-row-0")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    const firstRow = Object.keys(lineErrs)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0]
    if (firstRow != null) {
      focusLineRow(firstRow)
    }
  }

  function mapPurchaseOrderApiValidationErrors(
    errs: Record<string, string[] | string>,
  ): PoFieldErrors {
    const next: PoFieldErrors = {}
    const first = (key: string) => {
      const v = errs[key]
      if (!v) return undefined
      return Array.isArray(v) ? v[0]?.trim() : String(v).trim()
    }
    const supplierMsg = first("supplier_id")
    if (supplierMsg) next.supplier = supplierMsg
    const codeMsg = first("code")
    if (codeMsg) {
      const translated = translateApiValidationMessage(codeMsg)
      next.code = isDuplicatePurchaseOrderCodeMessage(translated)
        ? "Ese código ya existe. Use otro (ej. OC-2026-244)."
        : translated
    }
    const linesMsg =
      first("lines") ||
      first("lines.0.quantity_ordered") ||
      first("lines.0.description")
    if (linesMsg) next.linesGeneral = translateApiValidationMessage(linesMsg)
    return next
  }

  async function executeCreatePurchaseOrder() {
    const sid = Number(supplierId)

    const payloadLines = lines
      .filter(isPoLineSubmitReady)
      .map((L) => ({
        description: buildLineDescription(L),
        quantity_ordered: parseDecimalInput(L.quantity_ordered),
        unit: L.unit.trim() || "kg",
      }))

    setSaving(true)
    try {
      await apiFetch("purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: sid,
          code: code.trim(),
          ordered_at: orderedAt || null,
          notes: notes.trim() || null,
          tax_applies: false,
          lines: payloadLines,
        }),
      })
      toast.success("Orden de compra creada.")
      try {
        sessionStorage.removeItem(PURCHASE_ORDER_NEW_DRAFT_KEY)
      } catch {
        /* ignore */
      }
      navigate(returnTo)
    } catch (e) {
      if (e instanceof ApiError) {
        const errs = e.body?.errors
        const codeMsgs = errs?.code
        const isDuplicateCode =
          e.status === 422 &&
          codeMsgs &&
          (Array.isArray(codeMsgs) ? codeMsgs : [String(codeMsgs)]).some((msg) =>
            isDuplicatePurchaseOrderCodeMessage(String(msg)),
          )

        if (isDuplicateCode) {
          const existingId = await findPurchaseOrderIdByCode(code.trim())
          setFieldErrors((prev) => ({
            ...prev,
            code: "Ese código ya está registrado. Elija otro o abra la orden existente.",
          }))
          setCodeEditUnlocked(true)
          scheduleFieldErrorsAutoClear()
          setDuplicatePoDialog({
            open: true,
            id: existingId,
            code: code.trim(),
          })
          focusFirstPurchaseOrderValidationError({ code: "duplicate" }, {})
          return
        }

        if (e.status === 422 && errs && typeof errs === "object" && Object.keys(errs).length) {
          const apiField = mapPurchaseOrderApiValidationErrors(
            errs as Record<string, string[] | string>,
          )
          setFieldErrors((prev) => ({ ...prev, ...apiField }))
          scheduleFieldErrorsAutoClear()
          focusFirstPurchaseOrderValidationError(apiField, {})
          const flat = Object.values(errs)
            .flat()
            .map((s) => translateApiValidationMessage(String(s).trim()))
            .filter(Boolean)
            .filter((x, i, a) => a.indexOf(x) === i)
          poToastError(flat.length ? flat.join("\n") : translateApiValidationMessage(e.message))
        } else {
          poToastError(translateApiValidationMessage(e.message))
        }
      } else poToastError("No se pudo crear la OC.")
    } finally {
      setSaving(false)
      setConfirmCreateOpen(false)
    }
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault()

    const validation = computePurchaseOrderValidation()
    if (!validation.ok) {
      applyPurchaseOrderValidationErrors(validation.fieldErrors, validation.lineErrors)
      return
    }

    cancelFieldErrorsAutoClear()
    setFieldErrors({})
    setLineErrors({})
    setConfirmCreateOpen(true)
  }

  const payloadLinesPreviewCount = useMemo(
    () => lines.filter(isPoLineSubmitReady).length,
    [lines],
  )

  return (
    <>
      <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <ShoppingCart className="size-7 shrink-0 text-primary" aria-hidden />
            Nueva orden de compra
          </h1>
          <Alert className="border-primary/40 bg-gradient-to-r from-primary/12 via-primary/8 to-primary/5 shadow-sm">
            <Info className="h-5 w-5 text-primary" aria-hidden />
            <AlertTitle className="text-base font-semibold text-foreground">
              ¿Qué registra esta pantalla?
            </AlertTitle>
            <AlertDescription className="space-y-2 text-sm leading-relaxed text-foreground/90">
              <p>
                <strong>Indique proveedor, artículos y condiciones de la compra.</strong> Aquí se
                documenta lo que se <strong>pide al proveedor</strong>, no lo que entra al inventario.
              </p>
              <p>
                La orden queda en estado <strong>Abierta</strong>. El inventario la marca{" "}
                <strong>Parcial</strong> o <strong>Completada</strong> al registrar recepciones
                físicas en <strong>Recepciones</strong>.
              </p>
            </AlertDescription>
          </Alert>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0 shadow-sm" asChild>
              <Link to={returnTo} aria-label="Volver al listado de órdenes de compra">
                <ArrowLeft aria-hidden />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[16rem] text-left">
            Vuelve al listado de órdenes de compra. Si tenía borrador en esta pantalla, se conserva
            al regresar desde proveedores.
          </TooltipContent>
        </Tooltip>
      </div>

      <form
        noValidate
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">Documento de compra</p>
            <Badge
              variant="outline"
              className="mt-1 rounded-md border-primary/35 bg-primary/5 px-2.5 py-1 text-sm font-semibold text-primary shadow-sm"
            >
              <ClipboardList className="mr-1.5 size-3.5" aria-hidden />
              Orden de compra · Abierta al crear
            </Badge>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-muted-foreground text-xs">Código del pedido</p>
            <h2 className="text-primary text-3xl font-bold tracking-tight">
              {code.trim() || "OC-…"}
            </h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="po-supplier-trigger">Proveedor *</Label>
            <div className="flex items-center gap-2">
              <div className="group/field relative min-w-0 flex-1">
                <Building2
                  className={cn(
                    poFieldIconClass(Boolean(fieldErrors.supplier), saving),
                    "top-1/2 -translate-y-1/2",
                  )}
                  aria-hidden
                />
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="po-supplier-trigger"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierOpen}
                      aria-invalid={Boolean(fieldErrors.supplier)}
                      title={fieldErrors.supplier ?? undefined}
                      disabled={saving}
                      className={cn(
                        "h-10 w-full justify-between pl-10 pr-3 font-normal",
                        "border-primary/25 bg-background/90",
                        poInvalidHighlightClass(Boolean(fieldErrors.supplier)),
                      )}
                    >
                      <span
                        className={cn(
                          "truncate text-left",
                          supplierTriggerDisplay.muted && "text-muted-foreground",
                        )}
                      >
                        {supplierTriggerDisplay.text}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
                  align="start"
                >
                  <Command shouldFilter>
                    <CommandInput placeholder="Buscar proveedor..." />
                    <CommandList className="max-h-60">
                      <CommandEmpty>
                        {suppliers.length === 0 ? (
                          <div className="space-y-3 px-2 py-4 text-center">
                            <p className="text-muted-foreground text-sm">
                              No hay proveedores registrados.
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={saving}
                              onClick={() => {
                                setSupplierOpen(false)
                                persistPoDraftAndGoToNewSupplier()
                              }}
                            >
                              Crear proveedor
                            </Button>
                          </div>
                        ) : (
                          "Sin resultados."
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {suppliers.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name} ${s.rif ?? ""}`}
                            onSelect={() => {
                              supplierResolveFailedForRef.current = null
                              setSupplierId(String(s.id))
                              setSupplierOpen(false)
                              setFieldErrors((prev) => {
                                if (!prev.supplier) return prev
                                cancelFieldErrorsAutoClear()
                                const next = { ...prev }
                                delete next.supplier
                                return next
                              })
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                String(s.id) === supplierId ? "opacity-100" : "opacity-0",
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{s.name}</span>
                            {s.rif ? (
                              <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                                {s.rif}
                              </span>
                            ) : null}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 shadow-sm"
                    onClick={() => persistPoDraftAndGoToNewSupplier()}
                    disabled={saving}
                    aria-label="Crear proveedor nuevo"
                  >
                    <UserPlus aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Crear proveedor nuevo</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="grid min-w-0 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor="po-code" className="inline-flex w-fit cursor-help items-center gap-1.5">
                  <Hash className="size-3.5 text-primary" aria-hidden />
                  Código único *
                </Label>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[18rem] text-left">
                Correlativo único e irrepetible (ej. OC-2026-001). No puede repetirse en otra orden.
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2">
              <div className="group/field relative min-w-0 flex-1">
                <Hash
                  className={cn(
                    poFieldIconClass(Boolean(fieldErrors.code), saving),
                    "top-1/2 -translate-y-1/2",
                  )}
                  aria-hidden
                />
                <Input
                  id="po-code"
                  value={code}
                  required
                  maxLength={PO_CODE_MAX_LEN}
                  disabled={saving}
                  readOnly={!codeEditUnlocked}
                  aria-invalid={Boolean(fieldErrors.code)}
                  title={fieldErrors.code ?? undefined}
                  onChange={(ev) => {
                    if (!codeEditUnlocked) return
                    setCodeTouched(true)
                    setCode(ev.target.value)
                    setFieldErrors((prev) => {
                      if (!prev.code) return prev
                      cancelFieldErrorsAutoClear()
                      const next = { ...prev }
                      delete next.code
                      return next
                    })
                  }}
                  placeholder="Ej: OC-2026-001"
                  className={cn(
                    "pl-10",
                    !codeEditUnlocked && "cursor-default bg-muted/40",
                    poInvalidHighlightClass(Boolean(fieldErrors.code)),
                  )}
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 shadow-sm"
                    disabled={saving || codeEditUnlocked}
                    aria-label={`Modificar código ${code.trim() || "de la orden"}`}
                    onClick={() => setCodeEditConfirmOpen(true)}
                  >
                    <PencilLine aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Modificar código del pedido</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          <div className="grid gap-2">
            <Label htmlFor="po-date" className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5 text-primary" aria-hidden />
              Fecha pedido
            </Label>
            <Popover open={orderedAtOpen} onOpenChange={setOrderedAtOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="po-date"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={orderedAtOpen}
                  disabled={saving}
                  className={cn(
                    "group/field h-9 w-full justify-between pl-3 pr-3 font-normal",
                    "border-primary/25 bg-background/90 shadow-sm",
                    !orderedAt && "text-muted-foreground",
                  )}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <CalendarIcon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        saving
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground group-focus-visible:text-primary",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{formatDateInputDisplay(orderedAt)}</span>
                  </span>
                  <ChevronDown className="ml-1 size-4 shrink-0 opacity-50" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <UiCalendar
                  mode="single"
                  selected={parseDateInputValue(orderedAt)}
                  defaultMonth={parseDateInputValue(orderedAt) ?? new Date()}
                  onSelect={(date) => {
                    if (!date) return
                    setOrderedAt(toDateInputValue(date))
                    setOrderedAtOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="po-notes" className="inline-flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" aria-hidden />
              Notas / observación
            </Label>
            <div className="group/field relative">
              <FileText
                className={cn(
                  poFieldIconClass(false, saving),
                  "top-1/2 -translate-y-1/2",
                )}
                aria-hidden
              />
              <Input
                id="po-notes"
                value={notes}
                disabled={saving}
                onChange={(ev) => setNotes(ev.target.value)}
                placeholder="Ej: Entrega 15 días · FOB Caracas · Ref. cotización #4521"
                className="h-9 pl-10"
              />
            </div>
          </div>
        </div>

        {supplierId && selectedSupplier ? (
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-muted/30 p-4 text-sm shadow-sm">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <MapPin className="size-4 text-primary" aria-hidden />
              Dirección del proveedor
            </p>
            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
              {selectedSupplier.address?.trim() || "Sin dirección registrada en el proveedor."}
            </p>
            {!selectedSupplier.address?.trim() ? (
              <Link
                to={`/proveedores/form?id=${supplierId}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="text-primary mt-2 inline-block text-xs underline underline-offset-4"
              >
                Registrar dirección del proveedor
              </Link>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "space-y-3 rounded-xl border border-primary/15 bg-gradient-to-b from-muted/20 to-background p-4 shadow-sm transition-shadow",
            fieldErrors.linesGeneral && poInvalidHighlightClass(true),
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="grid min-w-0 gap-1">
              <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <Package className="size-4 text-primary" aria-hidden />
                Artículos del pedido
                <Badge
                  variant="outline"
                  className="min-w-[1.75rem] justify-center border-primary/30 bg-primary/5 px-2 text-xs font-semibold tabular-nums text-primary"
                >
                  {lines.length}
                </Badge>
              </h2>
              <p className="text-muted-foreground text-xs">
                Describa material, tipo y cantidad por línea. Las filas vacías se omiten al guardar.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  disabled={saving}
                  className="h-8 w-8 shrink-0 shadow-md"
                  aria-label="Agregar línea al pedido"
                  onClick={addLine}
                >
                  <Plus aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[15rem] text-left">
                {ADD_LINE_TOOLTIP}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="overflow-x-auto rounded-xl border border-primary/10 bg-card shadow-inner">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-14">N°</TableHead>
                  <TableHead className="min-w-[260px]">
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="size-3.5 text-primary" aria-hidden />
                      Material solicitado
                    </span>
                  </TableHead>
                  <TableHead className="w-36">Tipo</TableHead>
                  {showDimensionColumns ? (
                    <>
                      <TableHead className="w-24">
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="size-3.5 text-primary" aria-hidden />
                          Micras
                        </span>
                      </TableHead>
                      <TableHead className="w-24">
                        <span className="inline-flex items-center gap-1.5">
                          <Ruler className="size-3.5 text-primary" aria-hidden />
                          Ancho
                        </span>
                      </TableHead>
                    </>
                  ) : null}
                  <TableHead className="w-32 align-middle whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Scale className="size-3.5 shrink-0 text-primary" aria-hidden />
                      Cantidad *
                    </span>
                  </TableHead>
                  <TableHead className="w-36">Unidad</TableHead>
                  <TableHead className="w-11 p-0" aria-hidden />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLineEntries.map(({ line, index: i }) => {
                  const rowHasError = Boolean(lineErrors[i] && Object.keys(lineErrors[i]).length > 0)
                  const typeMeta = PO_ITEM_TYPE_META[line.item_type]
                  return (
                      <TableRow
                        key={i}
                        id={`po-line-row-${i}`}
                        className={cn(
                          typeMeta.rowClass,
                          rowHasError && "ring-2 ring-inset ring-destructive/35",
                        )}
                      >
                        <TableCell className="align-middle">
                          <div
                            className={cn(
                              "flex h-9 items-center justify-center rounded-md border px-2 text-sm font-semibold",
                              typeMeta.rowNumberClass,
                            )}
                          >
                            {i + 1}
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="group/field relative">
                            <Package
                              className={cn(
                                poFieldIconClass(false, saving),
                                "top-1/2 -translate-y-1/2",
                              )}
                              aria-hidden
                            />
                            <Input
                              id={`po-line-${i}-requested`}
                              value={line.description}
                              onChange={(ev) => {
                                updateLine(i, { description: ev.target.value })
                              }}
                              placeholder="Ej: BOPP transparente · 20 µ · 520 mm"
                              aria-label={`Material solicitado, fila ${i + 1}`}
                              disabled={saving}
                              className={cn("pl-10", PO_ROW_FIELD_CLASS)}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Select
                            value={line.item_type}
                            disabled={saving}
                            onValueChange={(v) => {
                              const next = v as PoLineDraft["item_type"]
                              updateLine(i, {
                                item_type: next,
                                ...(shouldShowDims(next)
                                  ? {}
                                  : { micras: "", ancho_mm: "" }),
                              })
                            }}
                          >
                            <SelectTrigger
                              className={cn("h-9 font-medium", typeMeta.selectTriggerClass)}
                            >
                              <SelectValue placeholder="Tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {PO_ITEM_TYPE_OPTIONS.map((type) => (
                                <SelectItem
                                  key={type}
                                  value={type}
                                  className={cn(
                                    "my-0.5 rounded-md",
                                    PO_ITEM_TYPE_META[type].badgeClass,
                                  )}
                                >
                                  <PoItemTypeLabel type={type} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {showDimensionColumns ? (
                          shouldShowDims(line.item_type) ? (
                            <>
                              <TableCell className="align-middle">
                                <div className="group/field relative">
                                  <Layers
                                    className={cn(
                                      poFieldIconClass(false, saving),
                                      "top-1/2 -translate-y-1/2",
                                    )}
                                    aria-hidden
                                  />
                                  <Input
                                    inputMode="numeric"
                                    value={line.micras}
                                    onChange={(ev) =>
                                      updateLine(i, {
                                        micras: sanitizePositiveDecimalInput(
                                          ev.target.value,
                                          3,
                                        ),
                                      })
                                    }
                                    placeholder="20"
                                    disabled={saving}
                                    aria-label={`Micras, fila ${i + 1}`}
                                    className={cn("pl-9", PO_ROW_FIELD_CLASS)}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="group/field relative">
                                  <Ruler
                                    className={cn(
                                      poFieldIconClass(false, saving),
                                      "top-1/2 -translate-y-1/2",
                                    )}
                                    aria-hidden
                                  />
                                  <Input
                                    inputMode="numeric"
                                    value={line.ancho_mm}
                                    onChange={(ev) =>
                                      updateLine(i, {
                                        ancho_mm: sanitizePositiveDecimalInput(
                                          ev.target.value,
                                          3,
                                        ),
                                      })
                                    }
                                    placeholder="520"
                                    disabled={saving}
                                    aria-label={`Ancho mm, fila ${i + 1}`}
                                    className={cn("pl-9", PO_ROW_FIELD_CLASS)}
                                  />
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="align-middle" aria-hidden />
                              <TableCell className="align-middle" aria-hidden />
                            </>
                          )
                        ) : null}
                        <TableCell className="align-middle">
                          <div className="group/field relative">
                            <Scale
                              className={cn(
                                poFieldIconClass(Boolean(lineErrors[i]?.quantity), saving),
                                "top-1/2 -translate-y-1/2",
                              )}
                              aria-hidden
                            />
                            <Input
                              id={`po-line-${i}-qty`}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`Cantidad pedida, fila ${i + 1}`}
                              aria-invalid={Boolean(lineErrors[i]?.quantity)}
                              title={lineErrors[i]?.quantity ?? undefined}
                              value={line.quantity_ordered}
                              disabled={saving}
                              placeholder="Ej: 500"
                              onChange={(ev) =>
                                updateLine(i, {
                                  quantity_ordered: sanitizePositiveDecimalInput(
                                    ev.target.value,
                                    6,
                                  ),
                                })
                              }
                              className={cn(
                                "h-9 pl-9",
                                PO_ROW_FIELD_CLASS,
                                poInvalidHighlightClass(Boolean(lineErrors[i]?.quantity)),
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Select
                            value={
                              isPoLineUnit(line.unit.trim()) ? line.unit.trim() : "kg"
                            }
                            onValueChange={(v) =>
                              updateLine(i, { unit: v as PoLineUnit })
                            }
                          >
                            <SelectTrigger
                              id={`po-line-${i}-unit`}
                              className={cn(
                                "h-9",
                                PO_ROW_FIELD_CLASS,
                                poInvalidHighlightClass(Boolean(lineErrors[i]?.unit)),
                              )}
                              aria-label={`Unidad, fila ${i + 1}`}
                              aria-invalid={Boolean(lineErrors[i]?.unit)}
                              title={lineErrors[i]?.unit ?? undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="unidad">Unidad</SelectItem>
                                <SelectItem value="m">m</SelectItem>
                                <SelectItem value="rollo">Rollo</SelectItem>
                                <SelectItem value="otros">Otros</SelectItem>
                              </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex items-center justify-center">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              disabled={lines.length <= 1 || saving}
                              onClick={() => removeLine(i)}
                              aria-label={`Eliminar fila ${i + 1}`}
                            >
                              <X className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {lines.length > PO_LINES_PAGE_SIZE ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 bg-muted/20 px-3 py-2 text-sm">
                <p className="text-muted-foreground text-xs">
                  Líneas {(safeLinesPage - 1) * PO_LINES_PAGE_SIZE + 1}–
                  {Math.min(safeLinesPage * PO_LINES_PAGE_SIZE, lines.length)} de{" "}
                  {formatPoLinesCount(lines.length)}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shadow-sm"
                    disabled={safeLinesPage <= 1 || saving}
                    onClick={() => setLinesPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior de líneas"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                  </Button>
                  <span className="text-muted-foreground min-w-[5.5rem] text-center text-xs font-medium">
                    Pág. {safeLinesPage} / {linesPageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shadow-sm"
                    disabled={safeLinesPage >= linesPageCount || saving}
                    onClick={() => setLinesPage((p) => Math.min(linesPageCount, p + 1))}
                    aria-label="Página siguiente de líneas"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex w-full justify-center pt-1">
          <Button type="submit" disabled={saving} className="min-w-[12rem] shadow-md">
            <ShoppingCart aria-hidden />
            <LoadingButtonLabel
              loading={saving}
              loadingText="Guardando..."
              idleText="Crear orden"
            />
          </Button>
        </div>
      </form>

      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent className="po-detail-dialog flex w-[min(calc(100vw-1.5rem),28rem)] flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-none">
          <div className="po-detail-dialog-header shrink-0 px-6 pb-5 pt-6">
            <div className="flex items-start gap-4">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20"
                aria-hidden
              >
                <ShoppingCart className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <AlertDialogTitle className="text-xl">Confirmar orden de compra</AlertDialogTitle>
                <AlertDialogDescription className="px-0 py-0 text-sm text-muted-foreground">
                  Revise el resumen antes de registrar la solicitud al proveedor.
                </AlertDialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="po-detail-hero space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Código de orden
                </span>
                <span className="po-code-pill">{code.trim() || "—"}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="po-detail-stat">
                  <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Proveedor</p>
                    <p className="truncate text-sm font-medium">
                      {selectedSupplier?.name?.trim() || "—"}
                    </p>
                  </div>
                </div>
                <div className="po-detail-stat">
                  <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Líneas válidas</p>
                    <p className="text-sm font-medium">
                      {formatPoLinesCount(payloadLinesPreviewCount)}
                    </p>
                  </div>
                </div>
                <div className="po-detail-stat sm:col-span-2">
                  <CalendarIcon className="size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha pedido</p>
                    <p className="text-sm font-medium">{formatDateInputDisplay(orderedAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-2" role="list">
              <li className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-sm leading-snug text-foreground/90">
                <div className="flex gap-2.5">
                  <Hash className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span>
                    El código es <strong>único e irrepetible</strong>. Si ya existe otra orden con
                    el mismo código, el sistema no permitirá guardar.
                  </span>
                </div>
              </li>
              <li className="rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-2.5 text-sm leading-snug text-foreground/90">
                <div className="flex gap-2.5">
                  <Package className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Es una <strong>solicitud de compra</strong>; el inventario no cambia hasta
                    registrar la recepción física.
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <AlertDialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
            <AlertDialogCancel disabled={saving}>Revisar formulario</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-primary"
              onClick={(ev) => {
                ev.preventDefault()
                void executeCreatePurchaseOrder()
              }}
            >
              {saving ? (
                "Guardando…"
              ) : (
                <>
                  <Check className="size-4" aria-hidden />
                  Crear orden
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={codeEditConfirmOpen} onOpenChange={setCodeEditConfirmOpen}>
        <AlertDialogContent className="po-detail-dialog flex w-[min(calc(100vw-1.5rem),26rem)] flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-none">
          <div className="po-detail-dialog-header shrink-0 px-6 pb-5 pt-6">
            <div className="flex items-start gap-4">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20"
                aria-hidden
              >
                <PencilLine className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <AlertDialogTitle className="text-xl">Modificar código de la orden</AlertDialogTitle>
                <AlertDialogDescription className="px-0 py-0 text-sm text-muted-foreground">
                  El código sugerido se genera automáticamente; puede personalizarlo si lo necesita.
                </AlertDialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="po-detail-hero space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Código actual
                </span>
                <span className="po-code-pill">{code.trim() || "—"}</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-sm leading-snug text-foreground/90">
              <div className="flex gap-2.5">
                <Hash className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                <span>
                  Recuerde que el código debe ser <strong>único</strong>. No puede coincidir con otra
                  orden ya registrada.
                </span>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-primary"
              onClick={() => {
                setCodeEditUnlocked(true)
                setCodeTouched(true)
                window.requestAnimationFrame(() => {
                  const el = document.getElementById("po-code") as HTMLInputElement | null
                  el?.focus()
                  el?.select()
                })
              }}
            >
              <PencilLine className="size-4" aria-hidden />
              Sí, modificar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={duplicatePoDialog.open}
        onOpenChange={(open) => setDuplicatePoDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent className="po-detail-dialog flex w-[min(calc(100vw-1.5rem),28rem)] flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-none">
          <div className="po-detail-dialog-header shrink-0 px-6 pb-5 pt-6">
            <div className="flex items-start gap-4">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400"
                aria-hidden
              >
                <Hash className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <AlertDialogTitle className="text-xl">Código ya registrado</AlertDialogTitle>
                <AlertDialogDescription className="px-0 py-0 text-sm text-muted-foreground">
                  No se puede crear otra orden con el mismo identificador.
                </AlertDialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="po-detail-hero space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Código en conflicto
                </span>
                <span className="po-code-pill">{duplicatePoDialog.code || "—"}</span>
              </div>
            </div>

            <ul className="mt-4 space-y-2" role="list">
              <li className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-sm leading-snug text-foreground/90">
                <div className="flex gap-2.5">
                  <FileText className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span>
                    Ya existe una orden con el código <strong>{duplicatePoDialog.code}</strong> en el
                    sistema.
                  </span>
                </div>
              </li>
              <li className="rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-2.5 text-sm leading-snug text-foreground/90">
                <div className="flex gap-2.5">
                  <PencilLine className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Cambie el correlativo en el formulario o abra la orden existente para
                    consultarla.
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <AlertDialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
            <AlertDialogCancel>Cambiar código</AlertDialogCancel>
            {duplicatePoDialog.id != null ? (
              <AlertDialogAction
                className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-primary"
                onClick={() => {
                  navigate(`/ordenes-compra/${duplicatePoDialog.id}/vista-previa`)
                }}
              >
                <FileText className="size-4" aria-hidden />
                Abrir orden existente
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-primary"
                onClick={() => {
                  navigate(returnTo)
                }}
              >
                <ClipboardList className="size-4" aria-hidden />
                Ir al listado
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      </TooltipProvider>
    </>
  )
}
