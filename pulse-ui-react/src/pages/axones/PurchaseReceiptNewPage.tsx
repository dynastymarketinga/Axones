"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { formatMaterialDimensionDisplay } from "@/lib/purchase-receipt-material-label"
import {
  formatMaterialCatalogLabel,
  formatMaterialIdentity,
  formatOcLineReference,
  formatPurchaseOrderBanner,
  parseOcLineMeta,
  purchaseOrderHasPendingReceiptQuantity,
} from "@/lib/purchase-receipt-material-label"
import type { LaravelPaginated, MaterialRow, PurchaseOrderRow, SupplierRecord } from "@/types/api"
import {
  DOCUMENT_FORM_FIELD_ERRORS_AUTO_CLEAR_MS,
  DOCUMENT_LINES_PAGE_SIZE,
  documentToastError,
  toDateInputValue,
} from "@/pages/axones/purchase-document-form-ui"
import {
  itemTypeKeyToReceiptUiLabel,
  PURCHASE_ITEM_TYPE_KEYS,
  receiptUiLabelToItemTypeKey,
  shouldShowDimsForItemType,
} from "@/pages/axones/purchase-item-type-meta"
import { PurchaseReceiptNewPageView } from "@/pages/axones/PurchaseReceiptNewPageView"
import "./purchase-order-list.css"

export type PurchaseOrderLineDetail = {
  id: number
  description?: string | null
  quantity_ordered: string | number
  quantity_received?: string | number
  unit?: string | null
  material_id?: number | null
  material?: {
    id?: number
    name?: string
    sku?: string
    supplier?: { name?: string | null } | null
  } | null
}

export type PurchaseOrderDetailPayload = {
  id: number
  supplier_id: number
  code: string
  status: string
  supplier?: { id?: number; name?: string | null } | null
  lines?: PurchaseOrderLineDetail[]
}

export type FreeLine = {
  purchase_order_line_id: string
  item_type: string
  /** Etiqueta visible (código · descripción · proveedor) del material del catálogo. */
  material_label: string
  material_id: string
  micras: string
  ancho_mm: string
  quantity: string
  unit: string
}

export type DuplicateReceiptMatch = {
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

const RECEIPT_ITEM_TYPE_LABELS = PURCHASE_ITEM_TYPE_KEYS.map(itemTypeKeyToReceiptUiLabel)

const ADD_RECEIPT_LINE_TOOLTIP =
  "Agregar otra línea a la recepción. Las filas vacías se omiten al guardar si hay al menos una línea válida."

const UNIT_OPTIONS = [
  { value: "kg", label: "Kg" },
  { value: "unidad", label: "Unidad" },
  { value: "m", label: "m" },
  { value: "rollo", label: "Rollo" },
] as const
const MAX_RECEIPT_LINES = 25

function mapItemTypeToInventoryArea(itemType: string): "material" | "tintas" | "quimicos" | "miscelaneos" {
  const key = receiptUiLabelToItemTypeKey(itemType)
  if (key === "tinta") return "tintas"
  if (key === "quimico") return "quimicos"
  if (key === "otros") return "miscelaneos"
  return "material"
}

function receiptLineRequiresDimensions(itemType: string): boolean {
  return shouldShowDimsForItemType(receiptUiLabelToItemTypeKey(itemType))
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
  const key = receiptUiLabelToItemTypeKey(itemType)
  if (key === "tinta" || key === "quimico" || key === "otros") {
    return UNIT_OPTIONS.filter((option) => option.value === "kg" || option.value === "unidad")
  }
  return UNIT_OPTIONS
}

function suggestSkuFromLabel(label: string): string {
  const compact = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return compact || `MAT-${Date.now().toString(36).toUpperCase()}`
}

function normalizeLineByBusinessRules(line: FreeLine): FreeLine {
  const allowed = allowedUnitsByItemType(line.item_type).map((u) => u.value)
  const safeUnit = allowed.includes(line.unit as (typeof allowed)[number]) ? line.unit : "kg"
  const requiresDimensions = receiptLineRequiresDimensions(line.item_type)
  return {
    ...line,
    material_label: typeof line.material_label === "string" ? line.material_label : "",
    unit: safeUnit,
    micras: requiresDimensions ? formatMaterialDimensionDisplay(line.micras) : "",
    ancho_mm: requiresDimensions ? formatMaterialDimensionDisplay(line.ancho_mm) : "",
  }
}

function hydrateFreeLineMaterialLabel(line: FreeLine, materialsList: MaterialRow[]): FreeLine {
  const normalized = normalizeLineByBusinessRules(line)
  const matId = normalized.material_id.trim()
  if (matId) {
    const mat = materialsList.find((m) => String(m.id) === matId)
    if (mat) {
      return {
        ...normalized,
        material_label: materialLabelFromRow(mat, normalized.item_type),
        micras: formatMaterialDimensionDisplay(mat.micras) || formatMaterialDimensionDisplay(normalized.micras),
        ancho_mm: formatMaterialDimensionDisplay(mat.ancho) || formatMaterialDimensionDisplay(normalized.ancho_mm),
        unit: mat.unit?.trim() || normalized.unit,
      }
    }
  }
  return normalized
}

export type ReceiptFieldErrors = {
  supplier?: string
  invoice?: string
  receivedAt?: string
  purchaseOrder?: string
  linesGeneral?: string
}

export type ReceiptLineFieldErrors = {
  material?: string
  quantity?: string
  micras?: string
  ancho?: string
  unit?: string
  purchaseOrderLine?: string
}

function materialLabelFromRow(material: MaterialRow, itemType?: string): string {
  return formatMaterialCatalogLabel({
    sku: material.sku,
    name: material.name,
    supplierName: material.supplier?.name ?? null,
    micras: material.micras,
    ancho: material.ancho,
    itemTypeKey: receiptUiLabelToItemTypeKey(itemType ?? "Sustrato"),
  })
}

function materialsForReceiptItemType(materialsList: MaterialRow[], itemType: string): MaterialRow[] {
  const area = mapItemTypeToInventoryArea(itemType)
  return materialsList.filter((m) => normalizeKey(m.inventory_area) === normalizeKey(area))
}

function receiptLineValidationMessage(
  row: FreeLine,
  requirePurchaseOrderLine: boolean,
): string | null {
  const hasPol = row.purchase_order_line_id.trim().length > 0
  const hasType = row.item_type.trim().length > 0
  const materialId = Number(row.material_id)
  const quantity = Number(row.quantity)
  const requiresDimensions = receiptLineRequiresDimensions(row.item_type)
  const micras = Number(row.micras)
  const ancho = Number(row.ancho_mm)
  if (requirePurchaseOrderLine && !hasPol) {
    return "Falta asociar la fila a una línea de la orden de compra (recargue la OC o agregue de nuevo el ítem)."
  }
  if (!hasType) {
    return "Seleccione el tipo de ítem (Sustrato, Tinta, etc.) en cada fila."
  }
  if (!Number.isFinite(materialId) || materialId < 1) {
    return "Seleccione un material del inventario. Si no existe, créelo en Materiales."
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

function mapReceiptItemTypeToMaterialFormTab(
  itemType: string,
): "sustratos" | "tintas" | "quimicos" | "miscelaneo" {
  if (itemType === "Tinta") return "tintas"
  if (itemType === "Químico") return "quimicos"
  if (itemType === "Misceláneo") return "miscelaneo"
  return "sustratos"
}

function defaultReceiptItemType(raw: string): string {
  const t = raw.trim()
  if (RECEIPT_ITEM_TYPE_LABELS.includes(t)) return t
  return itemTypeKeyToReceiptUiLabel("sustrato")
}

function emptyLine(): FreeLine {
  return {
    purchase_order_line_id: "",
    item_type: "Sustrato",
    material_label: "",
    material_id: "",
    micras: "",
    ancho_mm: "",
    quantity: "",
    unit: "kg",
  }
}

function buildFreeLineFromPurchaseOrderLine(
  pol: PurchaseOrderLineDetail,
  materialsList: MaterialRow[],
  poSupplierName?: string | null,
): FreeLine {
  const parsed = parseOcLineMeta(pol.description)
  const matId =
    pol.material_id != null && pol.material_id !== undefined ? String(pol.material_id) : ""
  const matFromList = matId ? materialsList.find((m) => String(m.id) === matId) : undefined
  const matFromPol = pol.material
  const inferredItemType = matFromList
    ? inferUiItemTypeFromInventoryArea(matFromList.inventory_area)
    : parsed.itemType || ""
  const unitRaw = (pol.unit || matFromList?.unit || "kg").trim()

  let material_id = ""
  let material_label = ""
  if (matFromList) {
    material_id = String(matFromList.id)
    material_label = materialLabelFromRow(matFromList, inferredItemType)
  } else if (matFromPol?.sku || matFromPol?.name) {
    material_label = formatMaterialIdentity({
      sku: matFromPol.sku,
      name: matFromPol.name,
      supplierName: matFromPol.supplier?.name ?? poSupplierName,
    })
  } else if (parsed.baseText) {
    material_label = formatMaterialIdentity({
      sku: parsed.baseText,
      name: null,
      supplierName: poSupplierName,
    })
  }

  return normalizeLineByBusinessRules({
    purchase_order_line_id: String(pol.id),
    item_type: inferredItemType,
    material_label,
    material_id,
    micras: formatMaterialDimensionDisplay(matFromList?.micras) || formatMaterialDimensionDisplay(parsed.micras),
    ancho_mm: formatMaterialDimensionDisplay(matFromList?.ancho) || formatMaterialDimensionDisplay(parsed.ancho_mm),
    quantity: "",
    unit: unitRaw || "kg",
  })
}

function inferUiItemTypeFromInventoryArea(area: string): string {
  const a = normalizeKey(area)
  if (a === "tintas") return "Tinta"
  if (a === "quimicos") return "Químico"
  if (a === "miscelaneos") return "Misceláneo"
  return "Sustrato"
}

function polRemainingQty(line: PurchaseOrderLineDetail): number {
  const o = Number(line.quantity_ordered ?? 0)
  const r = Number(line.quantity_received ?? 0)
  if (!Number.isFinite(o) || !Number.isFinite(r)) return 0
  return Math.max(0, o - r)
}

function getPoLinesAvailableForRow(
  lines: FreeLine[],
  poDetail: PurchaseOrderDetailPayload | null,
  excludeRowIndex?: number,
): PurchaseOrderLineDetail[] {
  const used = new Set<string>()
  lines.forEach((row, index) => {
    if (excludeRowIndex != null && index === excludeRowIndex) return
    const id = row.purchase_order_line_id.trim()
    if (id) used.add(id)
  })
  return (poDetail?.lines ?? []).filter(
    (pol) => polRemainingQty(pol) > 0 && !used.has(String(pol.id)),
  )
}

/** Etiqueta de estado en recepciones: no mostrar «Parcial»; las OC elegibles se presentan como «Abierta». */
function purchaseOrderStatusHint(status: string): string {
  if (status === "open" || status === "partial") return "Abierta"
  if (status === "completed") return "Completada"
  if (status === "cancelled") return "Completada"
  return status
}

function isPurchaseOrderReceiptEligible(po: PurchaseOrderRow): boolean {
  return (
    (po.status === "open" || po.status === "partial") &&
    po.is_active !== false &&
    !po.manually_closed_at
  )
}

function sortPurchaseOrdersForReceipt(
  rows: PurchaseOrderRow[],
  preferredSupplierId: number | null,
): PurchaseOrderRow[] {
  return [...rows].sort((a, b) => {
    if (preferredSupplierId != null && preferredSupplierId > 0) {
      const aMatch = a.supplier_id === preferredSupplierId ? 0 : 1
      const bMatch = b.supplier_id === preferredSupplierId ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
    }
    return (b.code || "").localeCompare(a.code || "", "es")
  })
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
  const [linesPage, setLinesPage] = useState(1)
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false)
  const [receivedAtOpen, setReceivedAtOpen] = useState(false)
  const [supplierComboOpen, setSupplierComboOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ReceiptFieldErrors>({})
  const [lineErrors, setLineErrors] = useState<Record<number, ReceiptLineFieldErrors>>({})
  const fieldErrorsClearTimerRef = useRef<number | null>(null)
  const prevSupplierRef = useRef<number | null>(null)
  /** Evita limpiar la OC cuando el cambio de proveedor viene de elegir una OC de otro proveedor. */
  const skipSupplierResetForPoRef = useRef(false)
  /** Si coincide con `purchaseOrderId`, no reemplazar `freeLines` con la hidratación de la API (p. ej. tras restaurar borrador). */
  const skipRemoteFreeLinesForPurchaseOrderRef = useRef<number | null>(null)
  const pendingRestoredFreeLinesRef = useRef<FreeLine[] | null>(null)
  /** Catálogo actual sin re-disparar la hidratación de líneas OC al refrescar materiales. */
  const materialsRef = useRef(materials)
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<PurchaseOrderRow[]>([])
  const [poListLoading, setPoListLoading] = useState(false)
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | null>(null)
  const [purchaseOrderDetail, setPurchaseOrderDetail] = useState<PurchaseOrderDetailPayload | null>(null)
  const [poDetailLoading, setPoDetailLoading] = useState(false)
  const [poComboOpen, setPoComboOpen] = useState(false)
  const [materialPickerOpenRow, setMaterialPickerOpenRow] = useState<number | null>(null)
  const [estimatedNextReceiptId, setEstimatedNextReceiptId] = useState<number | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [addOcLineDialogOpen, setAddOcLineDialogOpen] = useState(false)
  const [addOcLinePolId, setAddOcLinePolId] = useState("")
  const [associateOcLineDialogOpen, setAssociateOcLineDialogOpen] = useState(false)
  const [associateOcLineRowIndex, setAssociateOcLineRowIndex] = useState<number | null>(null)
  const [associateOcLinePolId, setAssociateOcLinePolId] = useState("")
  const [noMoreOcLinesDialogOpen, setNoMoreOcLinesDialogOpen] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateReceiptMatch[]>([])
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    materialsRef.current = materials
  }, [materials])

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
      if (skipSupplierResetForPoRef.current) {
        skipSupplierResetForPoRef.current = false
      } else {
        setPurchaseOrderId(null)
        setPurchaseOrderDetail(null)
        setFreeLines([emptyLine()])
      }
    }
    prevSupplierRef.current = supplierId
  }, [supplierId])

  const loadPurchaseOrderOptions = useCallback(async () => {
    setPoListLoading(true)
    try {
      const res = await apiFetch<LaravelPaginated<PurchaseOrderRow>>("purchase-orders", {
        query: { per_page: 100, page: 1 },
      })
      const eligible = sortPurchaseOrdersForReceipt(
        res.data.filter(
          (po) => isPurchaseOrderReceiptEligible(po) && purchaseOrderHasPendingReceiptQuantity(po),
        ),
        supplierId,
      )
      setPurchaseOrderOptions(eligible)
    } catch {
      setPurchaseOrderOptions([])
    } finally {
      setPoListLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    void loadPurchaseOrderOptions()
  }, [loadPurchaseOrderOptions])

  useEffect(() => {
    if (poComboOpen) void loadPurchaseOrderOptions()
  }, [poComboOpen, loadPurchaseOrderOptions])

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
        const poSupplierName = d.supplier?.name ?? null
        const nextLines: FreeLine[] = limited.map((pol) =>
          buildFreeLineFromPurchaseOrderLine(pol, materialsRef.current, poSupplierName),
        )
        if (skipRemoteFreeLinesForPurchaseOrderRef.current === purchaseOrderId) {
          if (pendingRestoredFreeLinesRef.current) {
            setFreeLines(pendingRestoredFreeLinesRef.current)
            pendingRestoredFreeLinesRef.current = null
          }
        } else if (eligible.length === 0) {
          toast.warning(
            "Esta orden de compra no tiene cantidad pendiente por recibir. Elija otra OC o use entrada directa (sin OC).",
          )
          setPurchaseOrderId(null)
          setPurchaseOrderDetail(null)
          setFreeLines([emptyLine()])
        } else {
          setFreeLines(nextLines)
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
    // materials se lee vía materialsRef: refrescar catálogo no debe reemplazar filas ya editadas.
  }, [purchaseOrderId, supplierId])

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
    setFieldErrors({})
    setLineErrors({})

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
        pendingRestoredFreeLinesRef.current = parsed.freeLines.map((row) =>
          hydrateFreeLineMaterialLabel(row, materials),
        )
      } else if (Array.isArray(parsed.freeLines)) {
        setFreeLines(
          parsed.freeLines.length
            ? parsed.freeLines.map((row) => hydrateFreeLineMaterialLabel(row, materials))
            : [emptyLine()],
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

  useEffect(() => {
    const ocRaw = searchParams.get("oc")
    const ocId = ocRaw ? Number(ocRaw) : NaN
    if (!Number.isFinite(ocId) || ocId < 1) return

    let cancelled = false
    void (async () => {
      try {
        const po = await apiFetch<PurchaseOrderDetailPayload>(`purchase-orders/${ocId}`)
        if (cancelled) return
        if (po.supplier_id > 0) setSupplierId(po.supplier_id)
        setPurchaseOrderId(ocId)
      } catch {
        if (!cancelled) toast.error("No se pudo abrir la orden de compra indicada.")
      } finally {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.delete("oc")
              return next
            },
            { replace: true },
          )
        }
      }
    })()

    return () => {
      cancelled = true
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

  const linesPageCount = useMemo(
    () => Math.max(1, Math.ceil(freeLines.length / DOCUMENT_LINES_PAGE_SIZE)),
    [freeLines.length],
  )
  const safeLinesPage = Math.min(linesPage, linesPageCount)

  const paginatedLineEntries = useMemo(() => {
    const start = (safeLinesPage - 1) * DOCUMENT_LINES_PAGE_SIZE
    return freeLines.slice(start, start + DOCUMENT_LINES_PAGE_SIZE).map((line, offset) => ({
      line,
      index: start + offset,
    }))
  }, [freeLines, safeLinesPage])

  const showDimensionColumns = useMemo(
    () => freeLines.some((line) => receiptLineRequiresDimensions(line.item_type)),
    [freeLines],
  )

  const receivedAtDateValue = useMemo(() => {
    const d = receivedAt.trim().slice(0, 10)
    return d || toDateInputValue(new Date())
  }, [receivedAt])

  useEffect(() => {
    setLinesPage((p) => (p > linesPageCount ? linesPageCount : p))
  }, [linesPageCount])

  useEffect(() => {
    if (materials.length === 0) return
    setFreeLines((prev) =>
      prev.map((row) => {
        if (row.material_id.trim()) {
          return hydrateFreeLineMaterialLabel(row, materials)
        }
        const polId = row.purchase_order_line_id.trim()
        if (!polId || !purchaseOrderDetail?.lines?.length) return row
        const pol = purchaseOrderDetail.lines.find((ln) => String(ln.id) === polId)
        if (!pol?.material_id) return row
        const mat = materials.find((m) => m.id === pol.material_id)
        if (!mat) return row
        return hydrateFreeLineMaterialLabel({ ...row, material_id: String(mat.id) }, materials)
      }),
    )
  }, [materials, purchaseOrderDetail])

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
    }, DOCUMENT_FORM_FIELD_ERRORS_AUTO_CLEAR_MS) as unknown as number
  }

  function applyReceiptValidationErrors(
    nextField: ReceiptFieldErrors,
    nextLine: Record<number, ReceiptLineFieldErrors>,
  ) {
    cancelFieldErrorsAutoClear()
    setFieldErrors(nextField)
    setLineErrors(nextLine)
    scheduleFieldErrorsAutoClear()
    toastReceiptValidationErrors(nextField, nextLine)
    focusFirstReceiptValidationError(nextField, nextLine)

    const hasPo = purchaseOrderId != null && purchaseOrderId > 0
    const firstOrphan = Object.keys(nextLine)
      .map(Number)
      .filter((n) => Number.isFinite(n) && nextLine[n]?.purchaseOrderLine)
      .sort((a, b) => a - b)[0]
    if (hasPo && firstOrphan != null) {
      const available = getPoLinesAvailableForRow(freeLines, purchaseOrderDetail, firstOrphan)
      if (available.length > 0) {
        setAssociateOcLineRowIndex(firstOrphan)
        setAssociateOcLinePolId(String(available[0].id))
        setAssociateOcLineDialogOpen(true)
      }
    }
  }

  function toastReceiptValidationErrors(
    field: ReceiptFieldErrors,
    lineErrs: Record<number, ReceiptLineFieldErrors>,
  ) {
    const messages: string[] = []
    if (field.supplier) messages.push(`Proveedor: ${field.supplier}`)
    if (field.invoice) messages.push(`Factura: ${field.invoice}`)
    if (field.receivedAt) messages.push(field.receivedAt)
    if (field.purchaseOrder) messages.push(field.purchaseOrder)
    if (field.linesGeneral) messages.push(field.linesGeneral)
    const rowIndexes = Object.keys(lineErrs)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    for (const i of rowIndexes) {
      const row = lineErrs[i]
      const n = i + 1
      if (row.purchaseOrderLine) messages.push(`Línea ${n}: ${row.purchaseOrderLine}`)
      if (row.material) messages.push(`Línea ${n}: ${row.material}`)
      if (row.quantity) messages.push(`Línea ${n}: ${row.quantity}`)
      if (row.micras) messages.push(`Línea ${n}: ${row.micras}`)
      if (row.ancho) messages.push(`Línea ${n}: ${row.ancho}`)
      if (row.unit) messages.push(`Línea ${n}: ${row.unit}`)
    }
    if (messages.length === 0) return
    documentToastError(messages.slice(0, 3).join(" · "))
  }

  function focusLineRow(rowIndex: number, field: "material" | "quantity" = "quantity") {
    const page = Math.floor(rowIndex / DOCUMENT_LINES_PAGE_SIZE) + 1
    setLinesPage(page)
    window.requestAnimationFrame(() => {
      document.getElementById(`receipt-row-${rowIndex}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      const targetId =
        field === "material" ? `receipt-line-${rowIndex}-material` : `receipt-line-${rowIndex}-qty`
      document.getElementById(targetId)?.focus()
    })
  }

  function focusFirstReceiptValidationError(
    field: ReceiptFieldErrors,
    lineErrs: Record<number, ReceiptLineFieldErrors>,
  ) {
    if (field.supplier) {
      document.getElementById("rc-supplier-trigger")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (field.invoice) {
      document.getElementById("rc-invoice")?.scrollIntoView({ behavior: "smooth", block: "center" })
      document.getElementById("rc-invoice")?.focus()
      return
    }
    if (field.receivedAt) {
      document.getElementById("rc-date")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (field.purchaseOrder) {
      document.getElementById("purchase-order-field")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (field.linesGeneral) {
      setLinesPage(1)
      document.getElementById("receipt-row-0")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    const firstRow = Object.keys(lineErrs)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0]
    if (firstRow != null) {
      const rowErr = lineErrs[firstRow]
      const focusField =
        rowErr?.material || rowErr?.purchaseOrderLine ? "material" : "quantity"
      focusLineRow(firstRow, focusField)
    }
  }

  function receiptLineHasAnyValue(row: FreeLine): boolean {
    return Boolean(
      row.purchase_order_line_id.trim() ||
        row.item_type.trim() ||
        row.material_id.trim() ||
        row.quantity.trim() ||
        row.micras.trim() ||
        row.ancho_mm.trim() ||
        row.unit.trim() !== "kg",
    )
  }

  function computeReceiptValidation(hasPurchaseOrder: boolean): {
    ok: boolean
    fieldErrors: ReceiptFieldErrors
    lineErrors: Record<number, ReceiptLineFieldErrors>
  } {
    const nextField: ReceiptFieldErrors = {}
    const nextLine: Record<number, ReceiptLineFieldErrors> = {}

    if (!Number.isFinite(supplierId) || (supplierId ?? 0) < 1) {
      nextField.supplier = "Seleccione un proveedor."
    }
    if (!invoiceNumber.trim()) {
      nextField.invoice = "El N° de factura es obligatorio."
    }
    if (!receivedAt.trim()) {
      nextField.receivedAt = "La fecha recibido es obligatoria."
    }
    if (
      hasPurchaseOrder &&
      (!Number.isFinite(purchaseOrderId) ||
        (purchaseOrderId ?? 0) < 1 ||
        !purchaseOrderDetail?.code)
    ) {
      nextField.purchaseOrder = "No se pudo cargar la orden de compra seleccionada."
    }

    const editedRowIndexes = freeLines
      .map((row, idx) => (receiptLineHasAnyValue(row) ? idx : -1))
      .filter((idx) => idx >= 0)

    if (editedRowIndexes.length === 0) {
      nextField.linesGeneral = "Agregue al menos un ítem con material y cantidad."
    }

    for (const i of editedRowIndexes) {
      const row = freeLines[i]
      const msg = receiptLineValidationMessage(row, hasPurchaseOrder)
      if (!msg) continue
      const errs: ReceiptLineFieldErrors = {}
      if (msg.includes("línea de la orden")) errs.purchaseOrderLine = msg
      else if (msg.includes("tipo")) errs.material = msg
      else if (msg.includes("material") || msg.includes("inventario") || msg.includes("Materiales"))
        errs.material = msg
      else if (msg.includes("cantidad")) errs.quantity = msg
      else if (msg.includes("Micras") || msg.includes("Ancho")) {
        if (msg.includes("Micras")) errs.micras = msg
        else errs.ancho = msg
      } else errs.quantity = msg
      nextLine[i] = errs
    }

    const ok =
      !nextField.supplier &&
      !nextField.invoice &&
      !nextField.receivedAt &&
      !nextField.purchaseOrder &&
      !nextField.linesGeneral &&
      Object.keys(nextLine).length === 0

    return { ok, fieldErrors: nextField, lineErrors: nextLine }
  }

  function buildReceiptPayload(
    hasPurchaseOrder: boolean,
    sourceLines: FreeLine[] = freeLines,
  ): Record<string, unknown> {
    const poDetail = purchaseOrderDetail
    const rowsWithContent = sourceLines.filter(receiptLineHasAnyValue)
    const lines = rowsWithContent.map((row) => {
      const materialId = Number(row.material_id)
      const base = {
        material_id: materialId,
        quantity: Number(row.quantity),
        item_type: mapUiItemTypeToApi(row.item_type),
        unit: row.unit || "kg",
        micras: row.micras.trim() ? Number(row.micras) : null,
        ancho_mm: row.ancho_mm.trim() ? Number(row.ancho_mm) : null,
      }
      if (hasPurchaseOrder) {
        return {
          ...base,
          purchase_order_line_id: Number(row.purchase_order_line_id),
        }
      }
      return base
    })

    if (hasPurchaseOrder) {
      return {
        purchase_order_id: purchaseOrderId,
        without_purchase_order: false,
        exception_reason: null,
        supplier_id: supplierId,
        supplier_name: selectedSupplier?.name?.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        purchase_order_reference: poDetail?.code?.trim() ?? null,
        notes: notes.trim() || null,
        received_at: receivedAt || null,
        lines,
      }
    }
    return {
      without_purchase_order: true,
      supplier_id: supplierId,
      supplier_name: selectedSupplier?.name?.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      notes: notes.trim() || null,
      received_at: receivedAt || null,
      lines,
    }
  }

  const payloadLinesPreviewCount = useMemo(
    () =>
      freeLines.filter(
        (row) =>
          receiptLineValidationMessage(row, purchaseOrderId != null && purchaseOrderId > 0) === null &&
          receiptLineHasAnyValue(row),
      ).length,
    [freeLines, purchaseOrderId],
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

  function goToCreateMaterialFromReceipt(preferredRowIndex?: number) {
    const resolvedIdx =
      preferredRowIndex != null && preferredRowIndex >= 0 && preferredRowIndex < freeLines.length
        ? preferredRowIndex
        : 0
    const row = freeLines[resolvedIdx]
    const itemType = defaultReceiptItemType(row?.item_type ?? "")
    if (!row?.item_type?.trim()) {
      updateFreeLine(resolvedIdx, { item_type: itemType })
    }
    goToMaterialMaster(resolvedIdx, itemType)
  }

  function goToMaterialMaster(
    rowIndex: number,
    itemType: string,
    preset?: { sku?: string; name?: string },
  ) {
    const resolvedType = defaultReceiptItemType(itemType)
    const row = freeLines[rowIndex]

    if (!saveReceiptDraftToSession()) return

    const presetSku = preset?.sku?.trim() ?? ""
    const presetName = preset?.name?.trim() ?? ""
    const labelText = row?.material_label?.trim() ?? ""
    const selected = materials.find((m) => String(m.id) === row?.material_id)
    const suggestedName =
      (presetName || presetSku || labelText || selected?.name) ??
      (resolvedType ? `${resolvedType} ` : "")
    const suggestedSku = (presetSku || selected?.sku || suggestSkuFromLabel(labelText)).toUpperCase()

    navigate("/materiales/nuevo", {
      state: {
        from: buildReceiptReturnPath(),
        materialPrefillFromReceipt: {
          tab: mapReceiptItemTypeToMaterialFormTab(resolvedType),
          sku: suggestedSku,
          name: suggestedName,
          micras: row?.micras?.trim() ?? "",
          ancho: row?.ancho_mm?.trim() ?? "",
          supplierId: supplierId != null && supplierId > 0 ? supplierId : null,
        },
      },
    })
  }

  function appendFreeLine(line: FreeLine) {
    setFreeLines((prev) => {
      if (prev.length >= MAX_RECEIPT_LINES) {
        documentToastError(`Solo puede agregar hasta ${MAX_RECEIPT_LINES} ítems por recepción.`)
        return prev
      }
      const next = [...prev, line]
      setLinesPage(Math.ceil(next.length / DOCUMENT_LINES_PAGE_SIZE))
      return next
    })
    setLineErrors({})
  }

  function requestAddFreeLine() {
    if (freeLines.length >= MAX_RECEIPT_LINES) {
      documentToastError(`Solo puede agregar hasta ${MAX_RECEIPT_LINES} ítems por recepción.`)
      return
    }
    const hasPo = purchaseOrderId != null && purchaseOrderId > 0
    if (!hasPo) {
      appendFreeLine(emptyLine())
      return
    }
    const available = getPoLinesAvailableForRow(freeLines, purchaseOrderDetail)
    if (available.length === 0) {
      setNoMoreOcLinesDialogOpen(true)
      return
    }
    setAddOcLinePolId(String(available[0].id))
    setAddOcLineDialogOpen(true)
  }

  function confirmAddOcLine() {
    const pol = purchaseOrderDetail?.lines?.find((ln) => String(ln.id) === addOcLinePolId)
    if (!pol) {
      toast.error("No se encontró la línea de la orden de compra.")
      return
    }
    const poSupplierName = purchaseOrderDetail?.supplier?.name ?? null
    appendFreeLine(buildFreeLineFromPurchaseOrderLine(pol, materials, poSupplierName))
    setAddOcLineDialogOpen(false)
  }

  function switchToDirectEntryAndAddLine() {
    setPurchaseOrderId(null)
    setPurchaseOrderDetail(null)
    skipRemoteFreeLinesForPurchaseOrderRef.current = null
    pendingRestoredFreeLinesRef.current = null
    setPoComboOpen(false)
    setFieldErrors((prev) => {
      if (!prev.purchaseOrder) return prev
      const next = { ...prev }
      delete next.purchaseOrder
      return next
    })
    setFreeLines((prev) => {
      const stripped = prev.map((row) => ({ ...row, purchase_order_line_id: "" }))
      if (stripped.length >= MAX_RECEIPT_LINES) {
        setLinesPage(Math.ceil(stripped.length / DOCUMENT_LINES_PAGE_SIZE))
        return stripped
      }
      const next = [...stripped, emptyLine()]
      setLinesPage(Math.ceil(next.length / DOCUMENT_LINES_PAGE_SIZE))
      return next
    })
    setLineErrors({})
    setNoMoreOcLinesDialogOpen(false)
    toast.info("Entrada directa: puede añadir más ítems; esta recepción ya no actualizará la OC.")
  }

  function confirmAssociateOcLine() {
    if (associateOcLineRowIndex == null) return
    const pol = purchaseOrderDetail?.lines?.find((ln) => String(ln.id) === associateOcLinePolId)
    if (!pol) {
      toast.error("No se encontró la línea de la orden de compra.")
      return
    }
    const poSupplierName = purchaseOrderDetail?.supplier?.name ?? null
    const built = buildFreeLineFromPurchaseOrderLine(pol, materials, poSupplierName)
    const existing = freeLines[associateOcLineRowIndex]
    updateFreeLine(associateOcLineRowIndex, {
      purchase_order_line_id: built.purchase_order_line_id,
      item_type: existing?.item_type?.trim() ? existing.item_type : built.item_type,
      material_id: existing?.material_id?.trim() ? existing.material_id : built.material_id,
      material_label: existing?.material_label?.trim() ? existing.material_label : built.material_label,
      micras: existing?.micras?.trim() ? existing.micras : built.micras,
      ancho_mm: existing?.ancho_mm?.trim() ? existing.ancho_mm : built.ancho_mm,
      quantity: existing?.quantity?.trim() ? existing.quantity : built.quantity,
      unit: existing?.unit?.trim() ? existing.unit : built.unit,
    })
    setAssociateOcLineDialogOpen(false)
    setAssociateOcLineRowIndex(null)
  }

  function updateFreeLine(i: number, patch: Partial<FreeLine>) {
    setLineErrors((prev) => {
      if (!prev[i]) return prev
      const next = { ...prev }
      delete next[i]
      return next
    })
    setFreeLines((p) =>
      p.map((row, j) => {
        if (j !== i) return row
        return normalizeLineByBusinessRules({ ...row, ...patch })
      }),
    )
  }

  function removeFreeLine(i: number) {
    setFreeLines((prev) => {
      const next = prev.length <= 1 ? [emptyLine()] : prev.filter((_, index) => index !== i)
      setLinesPage((p) => Math.min(p, Math.max(1, Math.ceil(next.length / DOCUMENT_LINES_PAGE_SIZE))))
      return next
    })
    setLineErrors((prev) => {
      const next: Record<number, ReceiptLineFieldErrors> = {}
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k)
        if (!Number.isFinite(idx)) continue
        if (idx === i) continue
        next[idx > i ? idx - 1 : idx] = v
      }
      return next
    })
  }

  const selectPurchaseOrder = useCallback(
    (po: PurchaseOrderRow) => {
      if (po.supplier_id > 0 && po.supplier_id !== supplierId) {
        skipSupplierResetForPoRef.current = true
        setSupplierId(po.supplier_id)
      }
      setPurchaseOrderId(po.id)
      setPoComboOpen(false)
    },
    [supplierId],
  )

  function clearPurchaseOrder() {
    setPurchaseOrderId(null)
    setPurchaseOrderDetail(null)
    setFieldErrors((prev) => {
      if (!prev.purchaseOrder) return prev
      const next = { ...prev }
      delete next.purchaseOrder
      return next
    })
    skipRemoteFreeLinesForPurchaseOrderRef.current = null
    pendingRestoredFreeLinesRef.current = null
    setFreeLines([emptyLine()])
    setLinesPage(1)
    setPoComboOpen(false)
  }

  async function refreshMaterialsList() {
    try {
      const matRes = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { per_page: 300, page: 1 },
      })
      setMaterials(matRes.data ?? [])
    } catch {
      /* mantener listado previo */
    }
  }

  function openMaterialPicker(rowIndex: number) {
    setMaterialPickerOpenRow(rowIndex)
    void refreshMaterialsList()
  }

  function selectMaterialFromCatalog(rowIndex: number, material: MaterialRow) {
    const row = freeLines[rowIndex]
    const unitRaw = (material.unit || "kg").trim()
    const allowed = allowedUnitsByItemType(row?.item_type ?? "Sustrato").map((u) => u.value)
    const safeUnit = allowed.includes(unitRaw as (typeof allowed)[number]) ? unitRaw : "kg"
    updateFreeLine(rowIndex, {
      material_id: String(material.id),
      material_label: materialLabelFromRow(material, row?.item_type ?? "Sustrato"),
      micras: formatMaterialDimensionDisplay(material.micras),
      ancho_mm: formatMaterialDimensionDisplay(material.ancho),
      unit: safeUnit,
    })
    setMaterialPickerOpenRow(null)
  }

  function formatOcLineLabel(pol: PurchaseOrderLineDetail): string {
    return formatOcLineReference(
      pol,
      purchaseOrderDetail?.supplier?.name ?? selectedSupplier?.name ?? null,
    )
  }

  function linkedPurchaseOrderBanner(): string | null {
    if (purchaseOrderId == null || purchaseOrderId < 1) return null
    return formatPurchaseOrderBanner({
      code: purchaseOrderDetail?.code ?? selectedPurchaseOrderRow?.code,
      supplierName:
        purchaseOrderDetail?.supplier?.name ??
        selectedPurchaseOrderRow?.supplier?.name ??
        selectedSupplier?.name,
      statusLabel: purchaseOrderStatusHint(
        purchaseOrderDetail?.status ?? selectedPurchaseOrderRow?.status ?? "",
      ),
    })
  }

  function resolveReceiptLinesForSave(): FreeLine[] {
    const resolved: FreeLine[] = []

    for (const row of freeLines) {
      if (!receiptLineHasAnyValue(row)) continue
      const materialId = Number(row.material_id)
      if (!Number.isFinite(materialId) || materialId < 1) {
        throw new Error("Seleccione un material del inventario. Si no existe, créelo en Materiales.")
      }
      const mat = materials.find((m) => m.id === materialId)
      if (!mat) {
        throw new Error("El material seleccionado ya no está en inventario. Recargue y elija de nuevo.")
      }
      resolved.push({
        ...row,
        material_id: String(materialId),
        material_label: materialLabelFromRow(mat, row.item_type),
      })
    }

    return resolved
  }

  async function persistReceipt(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      await apiFetch("purchase-receipts", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast.success("Recepción registrada y sumada al inventario.")
      window.dispatchEvent(new Event("alerts:refresh"))
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

  async function executeCreateReceipt(skipDuplicateCheck = false) {
    const hasPurchaseOrder = purchaseOrderId != null && purchaseOrderId > 0

    setSaving(true)
    let resolvedLines: FreeLine[]
    try {
      resolvedLines = resolveReceiptLinesForSave()
    } catch (e) {
      setSaving(false)
      toast.error(e instanceof Error ? e.message : "Revise los materiales del inventario e intente de nuevo.")
      return
    }

    const payload = buildReceiptPayload(hasPurchaseOrder, resolvedLines)

    if (!skipDuplicateCheck) {
      try {
        const duplicateCheck = await apiFetch<DuplicateCheckResponse>("purchase-receipts/check-duplicates", {
          query: {
            supplier_id: String(supplierId ?? ""),
            invoice_number: invoiceNumber.trim() || undefined,
            ...(hasPurchaseOrder && purchaseOrderDetail?.code
              ? { purchase_order_reference: purchaseOrderDetail.code.trim() }
              : {}),
          },
        })
        if (duplicateCheck.has_duplicates) {
          setDuplicateMatches(duplicateCheck.matches)
          setPendingPayload(payload)
          setDuplicateDialogOpen(true)
          setSaving(false)
          return
        }
      } catch {
        // Si falla el chequeo preventivo, no bloqueamos operación de ingreso.
      }
    }

    await persistReceipt(payload)
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault()

    const hasPurchaseOrder = purchaseOrderId != null && purchaseOrderId > 0
    const validation = computeReceiptValidation(hasPurchaseOrder)
    if (!validation.ok) {
      applyReceiptValidationErrors(validation.fieldErrors, validation.lineErrors)
      return
    }

    cancelFieldErrorsAutoClear()
    setFieldErrors({})
    setLineErrors({})
    setConfirmCreateOpen(true)
  }

  async function confirmAndCreateReceipt() {
    await executeCreateReceipt(false)
  }

  const reachedItemLimit = freeLines.length >= MAX_RECEIPT_LINES
  const hasPurchaseOrder = purchaseOrderId != null && purchaseOrderId > 0

  const poLinesAvailableForAdd = useMemo(
    () => getPoLinesAvailableForRow(freeLines, purchaseOrderDetail),
    [freeLines, purchaseOrderDetail],
  )

  const poLinesAvailableForAssociate = useMemo(
    () =>
      associateOcLineRowIndex != null
        ? getPoLinesAvailableForRow(freeLines, purchaseOrderDetail, associateOcLineRowIndex)
        : [],
    [associateOcLineRowIndex, freeLines, purchaseOrderDetail],
  )

  const poReceiptLineSummary = useMemo(() => {
    const pendingLines = (purchaseOrderDetail?.lines ?? []).filter((pol) => polRemainingQty(pol) > 0)
    const linkedCount = freeLines.filter((row) => row.purchase_order_line_id.trim().length > 0).length
    return { pendingCount: pendingLines.length, linkedCount }
  }, [freeLines, purchaseOrderDetail])

  function navigateToNewPurchaseOrder() {
    if (!saveReceiptDraftToSession()) return
    navigate("/ordenes-compra/nueva", {
      state: {
        from: "/recepciones-nueva",
        ...(supplierId ? { presetSupplierId: supplierId } : {}),
      },
    })
  }

  return (
    <PurchaseReceiptNewPageView
      saving={saving}
      supplierComboOpen={supplierComboOpen}
      setSupplierComboOpen={setSupplierComboOpen}
      supplierOptions={supplierOptions}
      supplierId={supplierId}
      setSupplierId={setSupplierId}
      selectedSupplier={selectedSupplier}
      persistReceiptDraftAndGoToNewSupplier={persistReceiptDraftAndGoToNewSupplier}
      invoiceNumber={invoiceNumber}
      setInvoiceNumber={setInvoiceNumber}
      notes={notes}
      setNotes={setNotes}
      receivedAtOpen={receivedAtOpen}
      setReceivedAtOpen={setReceivedAtOpen}
      receivedAtDateValue={receivedAtDateValue}
      setReceivedAt={setReceivedAt}
      todayDate={todayDate}
      poComboOpen={poComboOpen}
      setPoComboOpen={setPoComboOpen}
      poListLoading={poListLoading}
      purchaseOrderId={purchaseOrderId}
      purchaseOrderDetail={purchaseOrderDetail}
      selectedPurchaseOrderRow={selectedPurchaseOrderRow}
      purchaseOrderOptions={purchaseOrderOptions}
      clearPurchaseOrder={clearPurchaseOrder}
      selectPurchaseOrder={selectPurchaseOrder}
      poDetailLoading={poDetailLoading}
      navigateToNewPurchaseOrder={navigateToNewPurchaseOrder}
      hasPurchaseOrder={hasPurchaseOrder}
      fieldErrors={fieldErrors}
      lineErrors={lineErrors}
      freeLines={freeLines}
      paginatedLineEntries={paginatedLineEntries}
      showDimensionColumns={showDimensionColumns}
      updateFreeLine={updateFreeLine}
      allowedUnitsByItemType={allowedUnitsByItemType}
      removeFreeLine={removeFreeLine}
      requestAddFreeLine={requestAddFreeLine}
      reachedItemLimit={reachedItemLimit}
      addOcLineDialogOpen={addOcLineDialogOpen}
      setAddOcLineDialogOpen={setAddOcLineDialogOpen}
      addOcLinePolId={addOcLinePolId}
      setAddOcLinePolId={setAddOcLinePolId}
      poLinesAvailableForAdd={poLinesAvailableForAdd}
      confirmAddOcLine={confirmAddOcLine}
      associateOcLineDialogOpen={associateOcLineDialogOpen}
      setAssociateOcLineDialogOpen={setAssociateOcLineDialogOpen}
      associateOcLineRowIndex={associateOcLineRowIndex}
      associateOcLinePolId={associateOcLinePolId}
      setAssociateOcLinePolId={setAssociateOcLinePolId}
      poLinesAvailableForAssociate={poLinesAvailableForAssociate}
      confirmAssociateOcLine={confirmAssociateOcLine}
      noMoreOcLinesDialogOpen={noMoreOcLinesDialogOpen}
      setNoMoreOcLinesDialogOpen={setNoMoreOcLinesDialogOpen}
      poReceiptLineSummary={poReceiptLineSummary}
      switchToDirectEntryAndAddLine={switchToDirectEntryAndAddLine}
      maxReceiptLines={MAX_RECEIPT_LINES}
      goToCreateMaterialFromReceipt={goToCreateMaterialFromReceipt}
      goToMaterialMaster={goToMaterialMaster}
      linesPageCount={linesPageCount}
      safeLinesPage={safeLinesPage}
      setLinesPage={setLinesPage}
      submit={submit}
      estimatedNextReceiptId={estimatedNextReceiptId}
      formatReceiptCode={formatReceiptCode}
      formatOcLineLabel={formatOcLineLabel}
      linkedPurchaseOrderBanner={linkedPurchaseOrderBanner()}
      purchaseOrderStatusHint={purchaseOrderStatusHint}
      materials={materials}
      materialsForReceiptItemType={materialsForReceiptItemType}
      materialPickerOpenRow={materialPickerOpenRow}
      setMaterialPickerOpenRow={setMaterialPickerOpenRow}
      openMaterialPicker={openMaterialPicker}
      selectMaterialFromCatalog={selectMaterialFromCatalog}
      materialLabelFromRow={materialLabelFromRow}
      confirmCreateOpen={confirmCreateOpen}
      setConfirmCreateOpen={setConfirmCreateOpen}
      confirmAndCreateReceipt={confirmAndCreateReceipt}
      payloadLinesPreviewCount={payloadLinesPreviewCount}
      duplicateDialogOpen={duplicateDialogOpen}
      setDuplicateDialogOpen={setDuplicateDialogOpen}
      duplicateMatches={duplicateMatches}
      pendingPayload={pendingPayload}
      persistReceipt={persistReceipt}
    />
  )
}
