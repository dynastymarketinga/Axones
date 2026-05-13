"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Building2, Calendar, Check, ChevronsUpDown, ClipboardList, FileText, Scale } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow, PurchaseOrderRow, SupplierRecord } from "@/types/api"
import { LoadingButtonLabel } from "@/components/axones/LoadingStates"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { getMaterialAreaTheme } from "@/lib/material-area-theme"
import { cn } from "@/lib/utils"

type PurchaseOrderLineDetail = {
  id: number
  description?: string | null
  quantity_ordered: string | number
  quantity_received?: string | number
  unit?: string | null
  material_id?: number | null
  material?: { id?: number; name?: string; sku?: string } | null
}

type PurchaseOrderDetailPayload = {
  id: number
  supplier_id: number
  code: string
  status: string
  lines?: PurchaseOrderLineDetail[]
}

type FreeLine = {
  purchase_order_line_id: string
  item_type: string
  material_id: string
  micras: string
  ancho_mm: string
  quantity: string
  unit: string
}

type DuplicateReceiptMatch = {
  id: number
  supplier_name?: string | null
  invoice_number?: string | null
  purchase_order_reference?: string | null
  received_at?: string | null
}

type DuplicateCheckResponse = {
  has_duplicates: boolean
  total_matches: number
  matches: DuplicateReceiptMatch[]
}

const RECEIPT_ITEM_TYPES = [
  "Sustrato",
  "Misceláneo",
  "Tinta",
  "Químico",
] as const

const HIDE_DIMENSIONS_FOR_TYPES = new Set(["Tinta", "Químico", "Misceláneo"])

const UNIT_OPTIONS = [
  { value: "kg", label: "Kg" },
  { value: "unidad", label: "Unidad" },
  { value: "m", label: "m" },
  { value: "rollo", label: "Rollo" },
] as const
const MAX_RECEIPT_LINES = 25

function mapItemTypeToInventoryArea(itemType: string): "material" | "tintas" | "quimicos" | "miscelaneos" {
  if (itemType === "Tinta") return "tintas"
  if (itemType === "Químico") return "quimicos"
  if (itemType === "Misceláneo") return "miscelaneos"
  return "material"
}

/** Etiquetas alineadas con las pastillas de Materiales (insumos). */
function receiptInventoryAreaLabel(area: "material" | "tintas" | "quimicos" | "miscelaneos"): string {
  if (area === "material") return "Sustrato"
  if (area === "tintas") return "Tintas"
  if (area === "quimicos") return "Químicos"
  return "Misceláneos"
}

const RECEIPT_AREA_ORDER: Array<"material" | "tintas" | "quimicos" | "miscelaneos"> = [
  "material",
  "tintas",
  "quimicos",
  "miscelaneos",
]

function receiptAreaBadgeClassName(area: "material" | "tintas" | "quimicos" | "miscelaneos"): string {
  return cn("border shadow-sm", getMaterialAreaTheme(area).rowClass)
}

function mapUiItemTypeToApi(itemType: string) {
  if (itemType === "Sustrato") return "sustrato"
  if (itemType === "Misceláneo") return "miscelaneo"
  if (itemType === "Tinta") return "tinta"
  if (itemType === "Químico") return "quimico"
  return "sustrato"
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function allowedUnitsByItemType(itemType: string) {
  if (itemType === "Tinta" || itemType === "Químico" || itemType === "Misceláneo") {
    return UNIT_OPTIONS.filter((option) => option.value === "kg" || option.value === "unidad")
  }
  return UNIT_OPTIONS
}

function normalizeLineByBusinessRules(line: FreeLine): FreeLine {
  const allowed = allowedUnitsByItemType(line.item_type).map((u) => u.value)
  const safeUnit = allowed.includes(line.unit as (typeof allowed)[number]) ? line.unit : "kg"
  const requiresDimensions = !HIDE_DIMENSIONS_FOR_TYPES.has(line.item_type)
  return {
    ...line,
    unit: safeUnit,
    micras: requiresDimensions ? line.micras : "",
    ancho_mm: requiresDimensions ? line.ancho_mm : "",
  }
}

/** Mensaje concreto por fila; evita el toast genérico cuando el fallo es solo el SKU del catálogo. */
function receiptLineValidationMessage(row: FreeLine): string | null {
  const hasPol = row.purchase_order_line_id.trim().length > 0
  const hasType = row.item_type.trim().length > 0
  const materialId = Number(row.material_id)
  const quantity = Number(row.quantity)
  const requiresDimensions = !HIDE_DIMENSIONS_FOR_TYPES.has(row.item_type)
  const micras = Number(row.micras)
  const ancho = Number(row.ancho_mm)
  if (!hasPol) {
    return "Falta asociar la fila a una línea de la orden de compra (recargue la OC o agregue de nuevo el ítem)."
  }
  if (!hasType) {
    return "Seleccione el tipo de ítem (Sustrato, Tinta, etc.) en cada fila."
  }
  if (!Number.isFinite(materialId) || materialId <= 0) {
    return "Debe abrir «Material» y elegir un SKU del catálogo. Lo que muestra la OC es solo referencia hasta que seleccione el material."
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Indique cantidad recibida mayor que 0 (entrada física)."
  }
  if (
    requiresDimensions &&
    (!Number.isFinite(micras) || micras <= 0 || !Number.isFinite(ancho) || ancho <= 0)
  ) {
    return "En Sustrato indique Micras y Ancho mayores que 0."
  }
  return null
}

function sanitizeDecimalInput(raw: string) {
  const normalized = raw.replace(",", ".")
  const onlyNumeric = normalized.replace(/[^0-9.]/g, "")
  const firstDot = onlyNumeric.indexOf(".")
  if (firstDot === -1) return onlyNumeric
  const integerPart = onlyNumeric.slice(0, firstDot + 1)
  const decimalPart = onlyNumeric.slice(firstDot + 1).replace(/\./g, "").slice(0, 2)
  return `${integerPart}${decimalPart}`
}

function mapReceiptItemTypeToMaterialFormTab(
  itemType: string,
): "sustratos" | "tintas" | "quimicos" | "miscelaneo" {
  if (itemType === "Tinta") return "tintas"
  if (itemType === "Químico") return "quimicos"
  if (itemType === "Misceláneo") return "miscelaneo"
  return "sustratos"
}

function emptyLine(): FreeLine {
  return {
    purchase_order_line_id: "",
    item_type: "",
    material_id: "",
    micras: "",
    ancho_mm: "",
    quantity: "",
    unit: "kg",
  }
}

function inferUiItemTypeFromInventoryArea(area: string): string {
  const a = normalizeKey(area)
  if (a === "tintas") return "Tinta"
  if (a === "quimicos") return "Químico"
  if (a === "miscelaneos") return "Misceláneo"
  return "Sustrato"
}

function parseOcLineMeta(description: string | null | undefined): {
  itemType: string
  micras: string
  ancho_mm: string
  baseText: string
} {
  const raw = (description ?? "").trim()
  if (!raw) return { itemType: "", micras: "", ancho_mm: "", baseText: "" }
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean)
  const baseText = parts[0] ?? raw
  let itemType = ""
  let micras = ""
  let ancho_mm = ""
  for (const p of parts) {
    const [kRaw, ...rest] = p.split(":")
    const k = normalizeKey(kRaw ?? "")
    const v = rest.join(":").trim()
    if (!v) continue
    if (k === "tipo") {
      const tv = normalizeKey(v)
      if (tv === "tinta") itemType = "Tinta"
      else if (tv === "quimico" || tv === "químico") itemType = "Químico"
      else if (tv === "otros") itemType = "Misceláneo"
      else itemType = "Sustrato"
    } else if (k.startsWith("micra")) {
      micras = v
    } else if (k.startsWith("ancho")) {
      ancho_mm = v.replace(/[^\d.,]/g, "").replace(",", ".")
    }
  }
  return { itemType, micras, ancho_mm, baseText }
}

/** Texto del ítem de OC en la tabla (solo descripción / material; la cantidad va en su columna). */
function formatPolLabel(pol: PurchaseOrderLineDetail): string {
  const desc = pol.description?.trim()
  const meta = parseOcLineMeta(desc)
  const head =
    (pol.material?.sku && pol.material?.name)
      ? `${pol.material.sku} — ${pol.material.name}`
      : (meta.baseText || pol.material?.sku || "Ítem")
  return head
}

function polRemainingQty(line: PurchaseOrderLineDetail): number {
  const o = Number(line.quantity_ordered ?? 0)
  const r = Number(line.quantity_received ?? 0)
  if (!Number.isFinite(o) || !Number.isFinite(r)) return 0
  return Math.max(0, o - r)
}

function purchaseOrderStatusHint(status: string): string {
  if (status === "open") return "Abierta"
  if (status === "partial") return "Parcial"
  if (status === "completed") return "Completada"
  if (status === "cancelled") return "Completada"
  return status
}

function formatReceiptCode(id: number | null | undefined): string {
  const n = Number(id)
  if (!Number.isFinite(n) || n < 1) return "REC-———"
  return `REC-${String(Math.trunc(n)).padStart(6, "0")}`
}

const PURCHASE_RECEIPT_NEW_DRAFT_KEY = "axones:purchase-receipt-new-draft"

type PurchaseReceiptNewDraftV1 = {
  v: 1
  supplierId: number | null
  invoiceNumber: string
  notes: string
  receivedAt: string
  purchaseOrderId: number | null
  freeLines: FreeLine[]
}

export default function PurchaseReceiptNewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const todayDate = getTodayLocalDate()
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [receivedAt, setReceivedAt] = useState(`${todayDate}T00:00`)

  const [freeLines, setFreeLines] = useState<FreeLine[]>([emptyLine()])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [supplierComboOpen, setSupplierComboOpen] = useState(false)
  const prevSupplierRef = useRef<number | null>(null)
  /** Si coincide con `purchaseOrderId`, no reemplazar `freeLines` con la hidratación de la API (p. ej. tras restaurar borrador). */
  const skipRemoteFreeLinesForPurchaseOrderRef = useRef<number | null>(null)
  const pendingRestoredFreeLinesRef = useRef<FreeLine[] | null>(null)
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<PurchaseOrderRow[]>([])
  const [poListLoading, setPoListLoading] = useState(false)
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | null>(null)
  const [purchaseOrderDetail, setPurchaseOrderDetail] = useState<PurchaseOrderDetailPayload | null>(null)
  const [poDetailLoading, setPoDetailLoading] = useState(false)
  const [poComboOpen, setPoComboOpen] = useState(false)
  const [purchaseOrderError, setPurchaseOrderError] = useState(false)
  const [materialComboOpenRow, setMaterialComboOpenRow] = useState<number | null>(null)
  /** Texto del buscador SKU del combo de material (solo una fila abierta a la vez). */
  const [materialComboSearch, setMaterialComboSearch] = useState("")
  const [firstInvalidRowIndex, setFirstInvalidRowIndex] = useState<number | null>(null)
  const [supplierError, setSupplierError] = useState(false)
  const [invoiceNumberError, setInvoiceNumberError] = useState(false)
  const [receivedAtError, setReceivedAtError] = useState(false)
  const [estimatedNextReceiptId, setEstimatedNextReceiptId] = useState<number | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateReceiptMatch[]>([])
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const [m, s] = await Promise.all([
          apiFetch<LaravelPaginated<MaterialRow>>("materials", {
            query: { per_page: 300, page: 1 },
          }),
          apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
            query: { per_page: 300, page: 1 },
          }).catch(() => null),
        ])
        if (!c) {
          setMaterials(m.data)
          setSuppliers(s?.data ?? [])
        }
      } catch {
        if (!c) {
          setMaterials([])
          setSuppliers([])
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const latest = await apiFetch<LaravelPaginated<{ id: number }>>("purchase-receipts", {
          query: { page: 1, per_page: 1 },
        })
        const currentTopId = latest.data?.[0]?.id ?? 0
        if (!cancelled) setEstimatedNextReceiptId(currentTopId + 1)
      } catch {
        if (!cancelled) setEstimatedNextReceiptId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (prevSupplierRef.current !== null && prevSupplierRef.current !== supplierId) {
      setPurchaseOrderId(null)
      setPurchaseOrderDetail(null)
      setFreeLines([emptyLine()])
    }
    prevSupplierRef.current = supplierId
  }, [supplierId])

  useEffect(() => {
    if (!supplierId) {
      setPurchaseOrderOptions([])
      setPoListLoading(false)
      return
    }
    let cancelled = false
    setPoListLoading(true)
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<PurchaseOrderRow>>("purchase-orders", {
          query: { supplier_id: String(supplierId), per_page: 100, page: 1 },
        })
        const eligible = res.data.filter((po) => po.status === "open" || po.status === "partial")
        if (!cancelled) setPurchaseOrderOptions(eligible)
      } catch {
        if (!cancelled) setPurchaseOrderOptions([])
      } finally {
        if (!cancelled) setPoListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supplierId])

  useEffect(() => {
    if (!purchaseOrderId) {
      setPurchaseOrderDetail(null)
      setPoDetailLoading(false)
      skipRemoteFreeLinesForPurchaseOrderRef.current = null
      return
    }
    let cancelled = false
    setPoDetailLoading(true)
    void (async () => {
      try {
        const d = await apiFetch<PurchaseOrderDetailPayload>(`purchase-orders/${purchaseOrderId}`)
        if (cancelled) return
        if ((supplierId ?? 0) > 0 && d.supplier_id !== supplierId) {
          toast.error("La orden no pertenece al proveedor seleccionado.")
          setPurchaseOrderId(null)
          setPurchaseOrderDetail(null)
          return
        }
        setPurchaseOrderDetail(d)

        const eligible = (d.lines ?? []).filter((pol) => polRemainingQty(pol) > 0)
        if (eligible.length > MAX_RECEIPT_LINES) {
          toast.warning(`La OC tiene ${eligible.length} líneas pendientes. Se cargaron las primeras ${MAX_RECEIPT_LINES}.`)
        }
        const limited = eligible.slice(0, MAX_RECEIPT_LINES)
        const nextLines: FreeLine[] = limited.map((pol) => {
          const rem = polRemainingQty(pol)
          const parsed = parseOcLineMeta(pol.description)
          const matId =
            pol.material_id != null && pol.material_id !== undefined
              ? String(pol.material_id)
              : ""
          const mat = matId ? materials.find((m) => String(m.id) === matId) : undefined
          const inferredItemType = mat
            ? inferUiItemTypeFromInventoryArea(mat.inventory_area)
            : (parsed.itemType || "")
          const unitRaw = (pol.unit || mat?.unit || "kg").trim()
          return normalizeLineByBusinessRules({
            purchase_order_line_id: String(pol.id),
            item_type: inferredItemType,
            material_id: matId,
            micras: mat ? "" : parsed.micras,
            ancho_mm: mat ? "" : parsed.ancho_mm,
            quantity: String(rem),
            unit: unitRaw || "kg",
          })
        })
        if (skipRemoteFreeLinesForPurchaseOrderRef.current === purchaseOrderId) {
          if (pendingRestoredFreeLinesRef.current) {
            setFreeLines(pendingRestoredFreeLinesRef.current)
            pendingRestoredFreeLinesRef.current = null
          }
        } else {
          setFreeLines(nextLines.length ? nextLines : [emptyLine()])
        }
      } catch {
        if (!cancelled) {
          setPurchaseOrderDetail(null)
          toast.error("No se pudo cargar la orden de compra.")
        }
      } finally {
        if (!cancelled) setPoDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [purchaseOrderId, supplierId, materials])

  useEffect(() => {
    const proveedorRaw = searchParams.get("proveedor")
    const proveedorNum = proveedorRaw ? Number(proveedorRaw) : NaN
    const hasProveedor = Number.isFinite(proveedorNum) && proveedorNum > 0
    if (!hasProveedor) return

    let parsed: PurchaseReceiptNewDraftV1 | null = null
    try {
      const raw = sessionStorage.getItem(PURCHASE_RECEIPT_NEW_DRAFT_KEY)
      if (raw) {
        const data = JSON.parse(raw) as Partial<PurchaseReceiptNewDraftV1>
        if (data?.v === 1) parsed = data as PurchaseReceiptNewDraftV1
      }
    } catch {
      parsed = null
    }

    setSupplierId(proveedorNum)
    setSupplierError(false)

    if (parsed) {
      setInvoiceNumber(typeof parsed.invoiceNumber === "string" ? parsed.invoiceNumber : "")
      setNotes(typeof parsed.notes === "string" ? parsed.notes : "")
      setReceivedAt(
        typeof parsed.receivedAt === "string" && parsed.receivedAt
          ? parsed.receivedAt
          : `${getTodayLocalDate()}T00:00`,
      )

      const poId =
        typeof parsed.purchaseOrderId === "number" && parsed.purchaseOrderId > 0 ? parsed.purchaseOrderId : null
      setPurchaseOrderId(poId)

      if (poId != null && Array.isArray(parsed.freeLines) && parsed.freeLines.length > 0) {
        skipRemoteFreeLinesForPurchaseOrderRef.current = poId
        pendingRestoredFreeLinesRef.current = parsed.freeLines.map((row) => normalizeLineByBusinessRules(row))
      } else if (Array.isArray(parsed.freeLines)) {
        setFreeLines(
          parsed.freeLines.length ? parsed.freeLines.map((row) => normalizeLineByBusinessRules(row)) : [emptyLine()],
        )
      }
    }

    void (async () => {
      try {
        const one = await apiFetch<SupplierRecord>(`suppliers/${proveedorNum}`)
        setSuppliers((prev) => {
          if (prev.some((s) => s.id === one.id)) return prev
          return [...prev, one].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        })
      } catch {
        /* el combo puede mostrar vacío hasta recargar */
      }
    })()

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
        sessionStorage.removeItem(PURCHASE_RECEIPT_NEW_DRAFT_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, setSearchParams])

  const supplierOptions = useMemo(
    () => [...suppliers].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [suppliers],
  )

  const selectedSupplier = useMemo(
    () => supplierOptions.find((supplier) => supplier.id === supplierId) ?? null,
    [supplierId, supplierOptions],
  )
  const selectedPurchaseOrderRow = useMemo(
    () => purchaseOrderOptions.find((p) => p.id === purchaseOrderId) ?? null,
    [purchaseOrderId, purchaseOrderOptions],
  )

  function saveReceiptDraftToSession(): boolean {
    const draft: PurchaseReceiptNewDraftV1 = {
      v: 1,
      supplierId,
      invoiceNumber,
      notes,
      receivedAt,
      purchaseOrderId,
      freeLines,
    }
    try {
      sessionStorage.setItem(PURCHASE_RECEIPT_NEW_DRAFT_KEY, JSON.stringify(draft))
      return true
    } catch {
      toast.error("No se pudo guardar el borrador del formulario. Intente de nuevo.")
      return false
    }
  }

  /** Ruta de retorno; con `proveedor` en query se dispara la hidratación del borrador al volver. */
  function buildReceiptReturnPath(): string {
    const path = location.pathname
    if (supplierId != null && supplierId > 0) {
      const params = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : "")
      params.set("proveedor", String(supplierId))
      return `${path}?${params.toString()}`
    }
    return `${path}${location.search}`
  }

  function persistReceiptDraftAndGoToNewSupplier() {
    if (!saveReceiptDraftToSession()) return
    navigate("/proveedores/form", { state: { from: "/recepciones-nueva" } })
  }

  function goToMaterialMaster(
    rowIndex: number,
    itemType: string,
    preset?: { sku?: string; name?: string },
  ) {
    if (!itemType.trim()) {
      toast.error("Seleccione primero el tipo de ítem en esta fila.")
      return
    }
    const area = mapItemTypeToInventoryArea(itemType)
    const requiresDimensions = area === "material"
    const row = freeLines[rowIndex]
    if (requiresDimensions) {
      const rowMicras = row?.micras?.trim() ? Number(String(row.micras).replace(",", ".")) : NaN
      const rowAncho = row?.ancho_mm?.trim() ? Number(String(row.ancho_mm).replace(",", ".")) : NaN
      if (!Number.isFinite(rowMicras) || !Number.isFinite(rowAncho) || rowMicras <= 0 || rowAncho <= 0) {
        toast.error("Para sustratos complete Micras y Ancho en la fila antes de crear el material.")
        return
      }
    }

    if (!saveReceiptDraftToSession()) return

    const presetSku = preset?.sku?.trim() ?? ""
    const presetName = preset?.name?.trim() ?? ""
    const selected = materials.find((m) => String(m.id) === row?.material_id)
    const suggestedName = (presetName || presetSku || selected?.name) ?? (itemType ? `${itemType} ` : "")
    const suggestedSku = (presetSku || selected?.sku || "").toUpperCase()

    const dateRaw = receivedAt.trim().slice(0, 10)
    const receivedOn = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : todayDate

    navigate("/materiales/nuevo", {
      state: {
        from: buildReceiptReturnPath(),
        materialPrefillFromReceipt: {
          tab: mapReceiptItemTypeToMaterialFormTab(itemType),
          sku: suggestedSku,
          name: suggestedName,
          micras: row?.micras?.trim() ?? "",
          ancho: row?.ancho_mm?.trim() ?? "",
          receivedOn,
          supplierId: supplierId != null && supplierId > 0 ? supplierId : null,
        },
      },
    })
  }

  function addFreeLine() {
    setFreeLines((prev) => {
      if (prev.length >= MAX_RECEIPT_LINES) {
        toast.error(`Solo puede agregar hasta ${MAX_RECEIPT_LINES} items por recepción.`)
        return prev
      }
      const next = [...prev, emptyLine()]
      toast.success(`Item agregado (${next.length}/${MAX_RECEIPT_LINES}).`)
      if (next.length === MAX_RECEIPT_LINES) {
        toast.warning(`Llegó al límite de ${MAX_RECEIPT_LINES} items por recepción.`)
      }
      return next
    })
  }

  function updateFreeLine(i: number, patch: Partial<FreeLine>) {
    if (firstInvalidRowIndex !== null && i === firstInvalidRowIndex) {
      setFirstInvalidRowIndex(null)
    }
    setFreeLines((p) =>
      p.map((row, j) => {
        if (j !== i) return row
        return normalizeLineByBusinessRules({ ...row, ...patch })
      }),
    )
  }

  function removeFreeLine(i: number) {
    setFreeLines((prev) => {
      if (prev.length <= 1) {
        return [emptyLine()]
      }
      return prev.filter((_, index) => index !== i)
    })

    setFirstInvalidRowIndex((prev) => {
      if (prev === null) return null
      if (prev === i) return null
      return prev > i ? prev - 1 : prev
    })
  }

  function materialsForItemType(itemType: string) {
    if (!itemType) return materials
    const area = mapItemTypeToInventoryArea(itemType)
    return materials.filter((m) => normalizeKey(m.inventory_area) === normalizeKey(area))
  }

  async function persistReceipt(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      await apiFetch("purchase-receipts", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast.success("Recepción registrada y sumada al inventario.")
      try {
        sessionStorage.removeItem(PURCHASE_RECEIPT_NEW_DRAFT_KEY)
      } catch {
        /* ignore */
      }
      navigate("/recepciones-oc", { replace: true })
      return
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la recepción.")
    } finally {
      setSaving(false)
    }
  }

  async function submit(ev: React.FormEvent, skipDuplicateCheck = false) {
    ev.preventDefault()

    const supplierOk = Number.isFinite(supplierId) && (supplierId ?? 0) > 0
    const invoiceOk = invoiceNumber.trim().length > 0
    const receivedAtOk = receivedAt.trim().length > 0
    const purchaseOrderOk =
      Number.isFinite(purchaseOrderId) &&
      (purchaseOrderId ?? 0) > 0 &&
      Boolean(purchaseOrderDetail?.code)
    setSupplierError(!supplierOk)
    setInvoiceNumberError(!invoiceOk)
    setReceivedAtError(!receivedAtOk)
    setPurchaseOrderError(!purchaseOrderOk)

    if (!supplierOk) {
      document.getElementById("supplier-name")?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("El proveedor es obligatorio.")
      return
    }
    if (!invoiceOk) {
      document.getElementById("invoice-number")?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("El N° de factura es obligatorio.")
      return
    }
    if (!receivedAtOk) {
      document.getElementById("received-at")?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("La fecha recibido es obligatoria.")
      return
    }
    if (!purchaseOrderOk) {
      document.getElementById("purchase-order-field")?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("Seleccione la orden de compra del proveedor.")
      return
    }
    const poDetail = purchaseOrderDetail
    if (!poDetail?.code) return

    const rowsWithContent = freeLines
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const hasPol = row.purchase_order_line_id.trim() !== ""
        const hasType = row.item_type.trim() !== ""
        const hasMaterial = row.material_id.trim() !== ""
        const hasQuantity = row.quantity.trim() !== ""
        const hasMicras = row.micras.trim() !== ""
        const hasAncho = row.ancho_mm.trim() !== ""
        return hasPol || hasType || hasMaterial || hasQuantity || hasMicras || hasAncho
      })

    if (!rowsWithContent.length) {
      setFirstInvalidRowIndex(0)
      document.getElementById("receipt-row-0")?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("Agregue al menos 1 ítem.")
      return
    }

    const firstInvalid = rowsWithContent.findIndex(({ row }) => receiptLineValidationMessage(row) !== null)

    if (firstInvalid !== -1) {
      const invalidEntry = rowsWithContent[firstInvalid]
      const invalidRowIndex = invalidEntry?.index ?? 0
      setFirstInvalidRowIndex(invalidRowIndex)
      document
        .getElementById(`receipt-row-${invalidRowIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
      const msg = invalidEntry ? receiptLineValidationMessage(invalidEntry.row) : null
      toast.error(
        msg ??
          "Revise línea de OC, tipo, material del catálogo, cantidad y (en Sustrato) Micras y Ancho.",
      )
      return
    }

    setFirstInvalidRowIndex(null)
    const lines = rowsWithContent
      .map((row) => ({
        purchase_order_line_id: Number(row.row.purchase_order_line_id),
        material_id: Number(row.row.material_id),
        quantity: Number(row.row.quantity),
        item_type: mapUiItemTypeToApi(row.row.item_type),
        unit: row.row.unit || "kg",
        micras: row.row.micras.trim() ? Number(row.row.micras) : null,
        ancho_mm: row.row.ancho_mm.trim() ? Number(row.row.ancho_mm) : null,
      }))

    const payload = {
      purchase_order_id: purchaseOrderId,
      without_purchase_order: false,
      exception_reason: null,
      supplier_id: supplierId,
      supplier_name: selectedSupplier?.name?.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      purchase_order_reference: poDetail.code.trim(),
      notes: notes.trim() || null,
      received_at: receivedAt || null,
      lines,
    }

    if (!skipDuplicateCheck) {
      try {
        const duplicateCheck = await apiFetch<DuplicateCheckResponse>("purchase-receipts/check-duplicates", {
          query: {
            supplier_id: String(supplierId ?? ""),
            invoice_number: invoiceNumber.trim() || undefined,
            purchase_order_reference: poDetail.code.trim() || undefined,
          },
        })
        if (duplicateCheck.has_duplicates) {
          setDuplicateMatches(duplicateCheck.matches)
          setPendingPayload(payload)
          setDuplicateDialogOpen(true)
          return
        }
      } catch {
        // Si falla el chequeo preventivo, no bloqueamos operación de ingreso.
      }
    }

    await persistReceipt(payload)
  }

  const reachedItemLimit = freeLines.length >= MAX_RECEIPT_LINES

  const receiptAreaSummary = useMemo(() => {
    const areaSet = new Set<"material" | "tintas" | "quimicos" | "miscelaneos">()
    for (const line of freeLines) {
      const t = line.item_type.trim()
      if (t) areaSet.add(mapItemTypeToInventoryArea(t))
    }
    const labels = RECEIPT_AREA_ORDER.filter((a) => areaSet.has(a)).map(receiptInventoryAreaLabel)
    if (labels.length === 0) {
      return {
        mainText: "Seleccione tipo en ítems…",
        badgeClassName: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
      }
    }
    if (labels.length === 1) {
      const only = RECEIPT_AREA_ORDER.find((a) => areaSet.has(a))!
      return {
        mainText: labels[0],
        badgeClassName: receiptAreaBadgeClassName(only),
      }
    }
    return {
      mainText: `Varias áreas (${labels.join(", ")})`,
      badgeClassName: "border-amber-500/45 bg-amber-50/90 text-amber-950 shadow-sm",
    }
  }, [freeLines])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ingreso de material
          </h1>
          <p className="text-muted-foreground text-sm">
            Punto de partida del stock: registre aquí las cantidades físicas que entran al inventario (con OC y
            factura).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setHelpOpen(true)}>
            Ayuda
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Regresar
          </Button>
        </div>
      </div>

      <form
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-muted-foreground text-xs">Área de ingreso</p>
            <Badge
              variant="outline"
              className={cn(
                "mt-1 max-w-full whitespace-normal rounded-md px-2.5 py-1 text-left text-sm font-semibold leading-snug",
                receiptAreaSummary.badgeClassName,
              )}
            >
              {receiptAreaSummary.mainText}
            </Badge>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-muted-foreground text-xs">Correlativo de recepción</p>
            <h2 className="text-primary text-3xl font-bold tracking-tight">
              {formatReceiptCode(estimatedNextReceiptId)}
            </h2>
          </div>
        </div>

        <Alert className="border-primary/30 bg-primary/5">
          <Scale className="h-4 w-4 text-primary" aria-hidden />
          <AlertTitle className="text-foreground">Cantidades reales en inventario</AlertTitle>
          <AlertDescription>
            Esta pantalla es el registro oficial de <strong>entrada física</strong> contra orden de compra: lo que
            guarde aquí es lo que suma al stock del material (y queda trazado en movimientos de inventario). Use kg
            reales en báscula o lo documentado en la factura de este despacho; el maestro de materiales no sustituye
            esta recepción.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="supplier-name">Proveedor *</Label>
            <div className="flex items-center gap-2">
              <Popover open={supplierComboOpen} onOpenChange={setSupplierComboOpen}>
                <PopoverTrigger asChild>
                  <div className="group/field relative flex-1">
                    <Building2
                      className={cn(
                        "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                        supplierError
                          ? "text-red-500"
                          : saving
                            ? "text-muted-foreground/50"
                            : "text-muted-foreground group-focus-within/field:text-primary",
                      )}
                      aria-hidden
                    />
                    <Button
                      id="supplier-name"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierComboOpen}
                      disabled={saving}
                      className={cn(
                        "h-10 w-full justify-between pl-10 pr-3 font-normal",
                        supplierError ? "border-red-500 focus-visible:ring-red-500" : "",
                      )}
                    >
                      <span className={cn("truncate text-left", !selectedSupplier && "text-muted-foreground")}>
                        {selectedSupplier?.name || "Escriba o seleccione proveedor..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                  <Command shouldFilter>
                    <CommandInput placeholder="Buscar proveedor..." />
                    <CommandList className="max-h-60">
                      <CommandEmpty>No hay coincidencias.</CommandEmpty>
                      <CommandGroup>
                        {supplierOptions.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            value={`${supplier.name} ${supplier.rif ?? ""}`}
                            onSelect={() => {
                              setSupplierId(supplier.id)
                              if (supplierError) setSupplierError(false)
                              setSupplierComboOpen(false)
                            }}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", supplierId === supplier.id ? "opacity-100" : "opacity-0")}
                              aria-hidden
                            />
                            <span>{supplier.name}</span>
                            {supplier.rif ? (
                              <span className="text-muted-foreground ml-2 text-xs">{supplier.rif}</span>
                            ) : null}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                onClick={() => persistReceiptDraftAndGoToNewSupplier()}
                disabled={saving}
              >
                + Nuevo
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoice-number">N° Factura *</Label>
            <div className="group/field relative">
              <FileText
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                  invoiceNumberError
                    ? "text-red-500"
                    : saving
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                )}
                aria-hidden
              />
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(ev) => {
                  setInvoiceNumber(ev.target.value.toUpperCase().slice(0, 15))
                  if (invoiceNumberError) setInvoiceNumberError(false)
                }}
                maxLength={15}
                placeholder="Número de factura"
                disabled={saving}
                className={cn("pl-10", invoiceNumberError ? "border-red-500 focus-visible:ring-red-500" : "")}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="received-at">Fecha recibido *</Label>
            <div className="group/field relative">
              <Calendar
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                  receivedAtError
                    ? "text-red-500"
                    : saving
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                )}
                aria-hidden
              />
              <Input
                id="received-at"
                type="date"
                max={todayDate}
                value={receivedAt ? receivedAt.slice(0, 10) : ""}
                onChange={(ev) => {
                  setReceivedAt(ev.target.value ? `${ev.target.value}T00:00` : "")
                  if (receivedAtError) setReceivedAtError(false)
                }}
                className={cn("pl-10", receivedAtError ? "border-red-500 focus-visible:ring-red-500" : "")}
                disabled={saving}
              />
            </div>
          </div>
          <div id="purchase-order-field" className="grid gap-2">
            <Label>Orden de compra *</Label>
            <div className="flex items-center gap-2">
              <Popover open={poComboOpen} onOpenChange={setPoComboOpen}>
                <PopoverTrigger asChild>
                  <div className="group/field relative flex-1">
                    <ClipboardList
                      className={cn(
                        "pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transition-colors",
                        purchaseOrderError
                          ? "text-red-500"
                          : saving
                            ? "text-muted-foreground/50"
                            : "text-muted-foreground group-focus-within/field:text-primary",
                      )}
                      aria-hidden
                    />
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={poComboOpen}
                      disabled={saving || !supplierId || poListLoading}
                      className={cn(
                        "h-10 w-full justify-between pl-10 pr-3 font-normal",
                        purchaseOrderError ? "border-red-500 focus-visible:ring-red-500" : "",
                      )}
                    >
                      <span className={cn("truncate text-left", !purchaseOrderId && "text-muted-foreground")}>
                        {!supplierId
                          ? "Seleccione proveedor primero…"
                          : poListLoading
                            ? "Cargando órdenes…"
                            : purchaseOrderId
                              ? `${purchaseOrderDetail?.code ?? selectedPurchaseOrderRow?.code ?? "…"} · ${purchaseOrderStatusHint(
                                purchaseOrderDetail?.status ?? selectedPurchaseOrderRow?.status ?? "",
                              )}${poDetailLoading ? " (cargando…)" : ""}`
                              : "Seleccione orden de compra…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                  <Command shouldFilter>
                    <CommandInput placeholder="Buscar por código OC…" />
                    <CommandList className="max-h-60">
                      <CommandEmpty>
                        {supplierId && !poListLoading
                          ? "No hay órdenes abiertas o parciales para este proveedor."
                          : "Seleccione un proveedor."}
                      </CommandEmpty>
                      <CommandGroup>
                        {purchaseOrderOptions.map((po) => (
                          <CommandItem
                            key={po.id}
                            value={`${po.code} ${po.status}`}
                            onSelect={() => {
                              setPurchaseOrderId(po.id)
                              if (purchaseOrderError) setPurchaseOrderError(false)
                              setPoComboOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                purchaseOrderId === po.id ? "opacity-100" : "opacity-0",
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{po.code}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {purchaseOrderStatusHint(po.status)}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                title={
                  supplierId
                    ? "Crear orden de compra y volver a completar la recepción"
                    : "Crear orden de compra (elija proveedor arriba para prellenar la OC)"
                }
                onClick={() =>
                  navigate("/ordenes-compra/nueva", {
                    state: {
                      from: "/recepciones-nueva",
                      ...(supplierId ? { presetSupplierId: supplierId } : {}),
                    },
                  })
                }
              >
                + Nuevo
              </Button>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Cada ingreso va contra una orden de compra del mismo proveedor. En cada fila elija la línea de la OC. En{" "}
          <strong>Cantidad recibida</strong> registre la cantidad física que entra al inventario en esta entrega (por
          ejemplo los kg reales en báscula o lo que venga en la factura de ese despacho): puede ajustarla respecto al
          valor sugerido por la OC, siempre sin superar lo pendiente de esa línea. Los estados Parcial y Completa de la
          orden se calculan al guardar la recepción.
        </p>

        <div className="grid gap-2">
          <Label htmlFor="rc-notes">Observaciones</Label>
          <Textarea
            id="rc-notes"
            rows={2}
            maxLength={650}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value.slice(0, 650))}
            placeholder="Notas adicionales de la recepción..."
            disabled={saving}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Items recibidos</h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addFreeLine}
                disabled={saving || reachedItemLimit}
                title={reachedItemLimit ? `Límite alcanzado (${MAX_RECEIPT_LINES} items)` : undefined}
              >
                Agregar item
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">N°</TableHead>
                  <TableHead className="min-w-[200px]">Ítem solicitado (OC)</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead className="min-w-[200px]">Material *</TableHead>
                  <TableHead className="w-24">Micras</TableHead>
                  <TableHead className="w-24">Ancho</TableHead>
                  <TableHead className="min-w-[12rem] whitespace-nowrap">Cantidad recibida *</TableHead>
                  <TableHead className="w-52 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freeLines.map((line, i) => (
                  <TableRow
                    id={`receipt-row-${i}`}
                    key={i}
                    className={cn(firstInvalidRowIndex === i ? "bg-red-50/40" : "")}
                  >
                    <TableCell className="align-top">
                      <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                        {i + 1}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {line.purchase_order_line_id ? (
                        (() => {
                          const pol = purchaseOrderDetail?.lines?.find(
                            (ln) => String(ln.id) === String(line.purchase_order_line_id),
                          )
                          if (!pol) return null
                          return (
                            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                              {formatPolLabel(pol)}
                            </div>
                          )
                        })()
                      ) : (
                        <div
                          className="flex h-9 min-w-0 max-w-full items-center truncate rounded-md border bg-muted/40 px-3 text-sm font-medium text-muted-foreground"
                          title="Seleccione OC arriba para cargar ítems…"
                        >
                          Seleccione OC arriba para cargar ítems…
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Select
                        value={line.item_type}
                        disabled={saving}
                        onValueChange={(v) => {
                          const shouldHideDimensions = HIDE_DIMENSIONS_FOR_TYPES.has(v)
                          updateFreeLine(i, {
                            item_type: v,
                            ...(shouldHideDimensions ? { micras: "", ancho_mm: "" } : {}),
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {RECEIPT_ITEM_TYPES.map((itemType) => (
                            <SelectItem key={itemType} value={itemType}>
                              {itemType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Popover
                        open={materialComboOpenRow === i}
                        onOpenChange={(open) => {
                          if (open) setMaterialComboSearch("")
                          setMaterialComboOpenRow(open ? i : null)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={materialComboOpenRow === i}
                            disabled={saving}
                            className="h-9 w-full justify-between font-normal"
                          >
                            <span
                              className={cn(
                                "min-w-0 flex-1 text-left",
                                !line.material_id && "text-muted-foreground",
                                line.material_id && "truncate",
                              )}
                            >
                              {line.material_id ? (
                                materials.find((m) => String(m.id) === line.material_id)?.sku || "Seleccione SKU…"
                              ) : (
                                <span className="text-foreground">Seleccione material del catálogo…</span>
                              )}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                          <Command shouldFilter>
                            <CommandInput
                              placeholder="Buscar SKU..."
                              value={materialComboOpenRow === i ? materialComboSearch : ""}
                              onValueChange={setMaterialComboSearch}
                            />
                            <CommandList className="max-h-60">
                              <CommandEmpty>
                                {materialComboSearch.trim() ? (
                                  <div className="space-y-2 px-2">
                                    <p className="text-muted-foreground">No hay coincidencias con la búsqueda.</p>
                                    {line.item_type ? (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="h-auto w-full whitespace-normal py-2 text-xs"
                                        onClick={() => {
                                          const q = materialComboSearch.trim()
                                          goToMaterialMaster(i, line.item_type, { sku: q, name: q })
                                          setMaterialComboOpenRow(null)
                                          setMaterialComboSearch("")
                                        }}
                                      >
                                        Ir a nuevo material con «{materialComboSearch.trim()}»
                                      </Button>
                                    ) : (
                                      <p className="text-muted-foreground text-xs">
                                        Seleccione primero el tipo de ítem en esta fila.
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  "No hay SKU disponibles."
                                )}
                              </CommandEmpty>
                              <CommandGroup>
                                {materialsForItemType(line.item_type).map((m) => (
                                  <CommandItem
                                    key={m.id}
                                    value={m.sku}
                                    onSelect={() => {
                                      updateFreeLine(i, { material_id: String(m.id) })
                                      setMaterialComboOpenRow(null)
                                      setMaterialComboSearch("")
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        line.material_id === String(m.id) ? "opacity-100" : "opacity-0",
                                      )}
                                      aria-hidden
                                    />
                                    {m.sku}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        inputMode="numeric"
                        value={line.micras}
                        onChange={(ev) => updateFreeLine(i, { micras: ev.target.value })}
                        placeholder="µ"
                        disabled={saving || HIDE_DIMENSIONS_FOR_TYPES.has(line.item_type)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        inputMode="numeric"
                        value={line.ancho_mm}
                        onChange={(ev) => updateFreeLine(i, { ancho_mm: ev.target.value })}
                        placeholder="mm"
                        disabled={saving || HIDE_DIMENSIONS_FOR_TYPES.has(line.item_type)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex min-w-[11rem] items-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*[.,]?[0-9]*"
                          className="min-w-0 flex-1"
                          value={line.quantity}
                          onChange={(ev) => updateFreeLine(i, { quantity: sanitizeDecimalInput(ev.target.value) })}
                          placeholder="Cantidad"
                          title="Cantidad física de esta recepción; la unidad es la del selector a la derecha."
                          disabled={saving}
                        />
                        <Select
                          value={line.unit || "kg"}
                          disabled={saving}
                          onValueChange={(v) => updateFreeLine(i, { unit: v })}
                        >
                          <SelectTrigger className="h-9 w-[4.75rem] shrink-0 px-2">
                            <SelectValue placeholder="…" />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedUnitsByItemType(line.item_type).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-start justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={saving}
                          title="Abre el formulario Nuevo material; se guarda el borrador de esta recepción."
                          onClick={() => goToMaterialMaster(i, line.item_type)}
                        >
                          + Nuevo material
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => removeFreeLine(i)}
                          aria-label={`Eliminar fila ${i + 1}`}
                          title={`Eliminar fila ${i + 1}`}
                        >
                          ×
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <Button type="submit" disabled={saving}>
            <LoadingButtonLabel loading={saving} loadingText="Guardando..." idleText="Registrar" />
          </Button>
        </div>
      </form>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Posible duplicado detectado</DialogTitle>
            <DialogDescription>
              Se encontraron recepciones previas con el mismo proveedor + N° factura o N° OC referencia.
              Si es despacho parcial puede continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Recepción</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>N° Factura</TableHead>
                  <TableHead>N° OC (referencia)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicateMatches.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>{formatReceiptCode(match.id)}</TableCell>
                    <TableCell>{match.received_at ? String(match.received_at).slice(0, 19).replace("T", " ") : "—"}</TableCell>
                    <TableCell>{match.invoice_number || "—"}</TableCell>
                    <TableCell>{match.purchase_order_reference || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                if (payload) void persistReceipt(payload)
              }}
            >
              Continuar y guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guía rápida: Ingreso de material</DialogTitle>
            <DialogDescription>
              Esta pantalla registra recepciones físicas, no crea productos terminados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Qué hace:</strong> suma existencias al inventario desde una recepción ligada a una orden de compra (proveedor, factura, fecha e ítems).</p>
            <p>
              <strong>Cantidad recibida:</strong> aquí va la entrada real (p. ej. los kg que pesó o que constan en la
              factura de este despacho), no un dato “teórico” de la OC. Puede corregir el valor sugerido al cargar la
              línea; el sistema no permite pasar lo pendiente de esa línea en la orden.
            </p>
            <p><strong>Flujo por línea:</strong> elija la línea de la OC, tipo, material y cantidad; si no existe el material, use <strong>+ Nuevo material</strong> para abrir el formulario completo de maestro. Se guarda un borrador de esta recepción y al volver (con proveedor ya elegido) puede seguir y seleccionar el SKU nuevo en la lista.</p>
            <p><strong>Importante:</strong> el stock del material no se carga al crear el SKU; las cantidades reales entran solo por esta recepción (u otros flujos de inventario autorizados). Esta pantalla no reemplaza el maestro de productos.</p>
            <p><strong>Orden recomendado:</strong> 1) Producto terminado, 2) Materiales insumo (maestro, stock en cero), 3) Ingreso de material cuando llegue físicamente.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setHelpOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
