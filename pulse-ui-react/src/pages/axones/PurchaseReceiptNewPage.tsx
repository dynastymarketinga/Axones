"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, Calendar, Check, ChevronsUpDown, ClipboardList, FileText } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow, SupplierRecord } from "@/types/api"
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
import { cn } from "@/lib/utils"

type FreeLine = {
  item_type: string
  material_id: string
  micras: string
  ancho_mm: string
  quantity: string
  unit: string
}

type NewMaterialDraft = {
  rowIndex: number | null
  name: string
  sku: string
  unit: string
  inventory_area: "material" | "tintas" | "quimicos" | "miscelaneos"
}

type NewSupplierDraft = {
  name: string
  rif: string
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
  "Consumible",
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

function mapItemTypeToInventoryArea(itemType: string): NewMaterialDraft["inventory_area"] {
  if (itemType === "Tinta") return "tintas"
  if (itemType === "Químico") return "quimicos"
  if (itemType === "Misceláneo") return "miscelaneos"
  return "material"
}

function mapUiItemTypeToApi(itemType: string) {
  if (itemType === "Sustrato") return "sustrato"
  if (itemType === "Misceláneo") return "miscelaneo"
  if (itemType === "Consumible") return "consumible"
  if (itemType === "Tinta") return "tinta"
  if (itemType === "Químico") return "quimico"
  return "sustrato"
}

function buildQuickSku(rawName: string) {
  const normalized = rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const seed = Date.now().toString().slice(-6)
  return `${normalized || "MAT"}-${seed}`
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
  if (itemType === "Tinta" || itemType === "Químico") {
    return UNIT_OPTIONS.filter((option) => option.value === "kg" || option.value === "unidad")
  }
  if (itemType === "Misceláneo") {
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

function sanitizeDecimalInput(raw: string) {
  const normalized = raw.replace(",", ".")
  const onlyNumeric = normalized.replace(/[^0-9.]/g, "")
  const firstDot = onlyNumeric.indexOf(".")
  if (firstDot === -1) return onlyNumeric
  const integerPart = onlyNumeric.slice(0, firstDot + 1)
  const decimalPart = onlyNumeric.slice(firstDot + 1).replace(/\./g, "")
  return `${integerPart}${decimalPart}`
}

function emptyLine(): FreeLine {
  return {
    item_type: "",
    material_id: "",
    micras: "",
    ancho_mm: "",
    quantity: "",
    unit: "kg",
  }
}

function formatReceiptCode(id: number | null | undefined): string {
  const n = Number(id)
  if (!Number.isFinite(n) || n < 1) return "REC-———"
  return `REC-${String(Math.trunc(n)).padStart(6, "0")}`
}

export default function PurchaseReceiptNewPage() {
  const navigate = useNavigate()
  const todayDate = getTodayLocalDate()
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [purchaseOrderReference, setPurchaseOrderReference] = useState("")
  const [notes, setNotes] = useState("")
  const [receivedAt, setReceivedAt] = useState(`${todayDate}T00:00`)

  const [freeLines, setFreeLines] = useState<FreeLine[]>([emptyLine()])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [creatingMaterial, setCreatingMaterial] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [supplierComboOpen, setSupplierComboOpen] = useState(false)
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [materialComboOpenRow, setMaterialComboOpenRow] = useState<number | null>(null)
  const [firstInvalidRowIndex, setFirstInvalidRowIndex] = useState<number | null>(null)
  const [supplierError, setSupplierError] = useState(false)
  const [invoiceNumberError, setInvoiceNumberError] = useState(false)
  const [receivedAtError, setReceivedAtError] = useState(false)
  const [newMaterialDraft, setNewMaterialDraft] = useState<NewMaterialDraft>({
    rowIndex: null,
    name: "",
    sku: "",
    unit: "kg",
    inventory_area: "material",
  })
  const [newSupplierDraft, setNewSupplierDraft] = useState<NewSupplierDraft>({
    name: "",
    rif: "",
  })
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

  const supplierOptions = useMemo(
    () => [...suppliers].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [suppliers],
  )

  const selectedSupplier = useMemo(
    () => supplierOptions.find((supplier) => supplier.id === supplierId) ?? null,
    [supplierId, supplierOptions],
  )
  async function createSupplierQuickly() {
    const name = newSupplierDraft.name.trim()
    const rif = newSupplierDraft.rif.trim().toUpperCase()
    if (!name) {
      toast.error("Indique al menos el nombre del proveedor.")
      return
    }
    setCreatingSupplier(true)
    try {
      const created = await apiFetch<SupplierRecord>("suppliers", {
        method: "POST",
        body: JSON.stringify({
          name,
          rif: rif || null,
          email: null,
          phone: null,
          address: null,
        }),
      })
      setSuppliers((prev) => [...prev, created].sort((a, b) => (a.name || "").localeCompare(b.name || "")))
      setSupplierId(created.id)
      setSupplierError(false)
      setSupplierModalOpen(false)
      setNewSupplierDraft({ name: "", rif: "" })
      toast.success("Proveedor creado y seleccionado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear el proveedor.")
    } finally {
      setCreatingSupplier(false)
    }
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
    setNewMaterialDraft((prev) => {
      if (prev.rowIndex === null) return prev
      if (prev.rowIndex === i) return { ...prev, rowIndex: null }
      if (prev.rowIndex > i) return { ...prev, rowIndex: prev.rowIndex - 1 }
      return prev
    })
  }

  function openQuickMaterialCreator(rowIndex: number, itemType: string) {
    const row = freeLines[rowIndex]
    const selected = materials.find((m) => String(m.id) === row?.material_id)
    const suggestedName = selected?.name ?? (
      itemType
        ? `${itemType} `
        : ""
    )
    const suggestedSku = selected?.sku ?? ""

    setNewMaterialDraft({
      rowIndex,
      name: suggestedName,
      sku: suggestedSku,
      unit: row?.unit || selected?.unit || "kg",
      inventory_area: mapItemTypeToInventoryArea(itemType),
    })
  }

  function closeQuickMaterialCreator() {
    setNewMaterialDraft({
      rowIndex: null,
      name: "",
      sku: "",
      unit: "kg",
      inventory_area: "material",
    })
  }

  async function createMaterialQuickly() {
    const name = newMaterialDraft.name.trim()
    if (!name) {
      toast.error("Indique el nombre del material nuevo.")
      return
    }

    const draftSku = newMaterialDraft.sku.trim()
    const targetSku = draftSku || buildQuickSku(name)

    const duplicatedBySku = materials.find((material) =>
      draftSku
        ? normalizeKey(material.sku) === normalizeKey(draftSku)
        : false,
    )
    const duplicatedByNameArea = materials.find((material) =>
      normalizeKey(material.name) === normalizeKey(name) &&
      normalizeKey(material.inventory_area) === normalizeKey(newMaterialDraft.inventory_area),
    )
    const duplicated = duplicatedBySku ?? duplicatedByNameArea

    if (duplicated) {
      if (newMaterialDraft.rowIndex !== null) {
        updateFreeLine(newMaterialDraft.rowIndex, { material_id: String(duplicated.id) })
      }
      toast.info(
        `Ya existe "${duplicated.sku} — ${duplicated.name}". Se reutiliza para evitar duplicados.`,
      )
      closeQuickMaterialCreator()
      return
    }

    const payload = {
      name,
      sku: targetSku,
      inventory_area: newMaterialDraft.inventory_area,
      is_active: true,
      unit: (newMaterialDraft.unit || "kg").trim() || "kg",
      min_stock: 0,
      quantity_on_hand: 0,
    }

    setCreatingMaterial(true)
    try {
      try {
        const dup = await apiFetch<{ has_duplicates: boolean; total_matches: number }>("materials/check-duplicates", {
          query: {
            sku: targetSku,
            name,
            inventory_area: newMaterialDraft.inventory_area,
          },
        })
        if (dup.has_duplicates) {
          toast.warning("Posible duplicado detectado. Revise SKU/nombre antes de guardar.")
        }
      } catch {
        // no bloquear creación rápida si falla chequeo preventivo
      }

      const created = await apiFetch<MaterialRow>("materials", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setMaterials((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      if (newMaterialDraft.rowIndex !== null) {
        updateFreeLine(newMaterialDraft.rowIndex, { material_id: String(created.id) })
      }
      toast.success(`Material "${created.name}" creado y seleccionado.`)
      closeQuickMaterialCreator()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear el material.")
    } finally {
      setCreatingMaterial(false)
    }
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
    setSupplierError(!supplierOk)
    setInvoiceNumberError(!invoiceOk)
    setReceivedAtError(!receivedAtOk)

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

    const rowsWithContent = freeLines
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const hasType = row.item_type.trim() !== ""
        const hasMaterial = row.material_id.trim() !== ""
        const hasQuantity = row.quantity.trim() !== ""
        const hasMicras = row.micras.trim() !== ""
        const hasAncho = row.ancho_mm.trim() !== ""
        return hasType || hasMaterial || hasQuantity || hasMicras || hasAncho
      })

    if (!rowsWithContent.length) {
      setFirstInvalidRowIndex(0)
      document.getElementById("receipt-row-0")?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("Agregue al menos 1 ítem.")
      return
    }

    const firstInvalid = rowsWithContent.findIndex(({ row }) => {
      const hasType = row.item_type.trim().length > 0
      const materialId = Number(row.material_id)
      const quantity = Number(row.quantity)
      const requiresDimensions = !HIDE_DIMENSIONS_FOR_TYPES.has(row.item_type)
      const micras = Number(row.micras)
      const ancho = Number(row.ancho_mm)
      const dimensionsOk = !requiresDimensions || (
        Number.isFinite(micras) && micras > 0 &&
        Number.isFinite(ancho) && ancho > 0
      )
      const materialOk = Number.isFinite(materialId) && materialId > 0
      const quantityOk = Number.isFinite(quantity) && quantity > 0
      return !hasType || !materialOk || !quantityOk || !dimensionsOk
    })

    if (firstInvalid !== -1) {
      const invalidRowIndex = rowsWithContent[firstInvalid]?.index ?? 0
      setFirstInvalidRowIndex(invalidRowIndex)
      document
        .getElementById(`receipt-row-${invalidRowIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error(
        "Complete el Tipo, Material/Descripción y Cantidad. En Sustrato/Consumible también indique Micras y Ancho.",
      )
      return
    }

    setFirstInvalidRowIndex(null)
    const lines = rowsWithContent
      .map((row) => ({
        material_id: Number(row.row.material_id),
        quantity: Number(row.row.quantity),
        item_type: mapUiItemTypeToApi(row.row.item_type),
        unit: row.row.unit || "kg",
        micras: row.row.micras.trim() ? Number(row.row.micras) : null,
        ancho_mm: row.row.ancho_mm.trim() ? Number(row.row.ancho_mm) : null,
      }))

    const payload = {
      purchase_order_id: null,
      without_purchase_order: true,
      exception_reason: null,
      supplier_id: supplierId,
      supplier_name: selectedSupplier?.name?.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      purchase_order_reference: purchaseOrderReference.trim() || null,
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
            purchase_order_reference: purchaseOrderReference.trim() || undefined,
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ingreso de material
          </h1>
          <p className="text-muted-foreground text-sm">
            Registre ingresos al inventario. Si tiene un número de orden de compra (referencia), puede anotarlo en el campo indicado; no se vincula al módulo de órdenes de compra.
            Use Movimientos para ver el historial general.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Regresar
          </Button>
        </div>
      </div>

      <form
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex items-start justify-end border-b pb-3">
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Correlativo de recepción</p>
            <h2 className="text-primary text-3xl font-bold tracking-tight">
              {formatReceiptCode(estimatedNextReceiptId)}
            </h2>
          </div>
        </div>

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
                onClick={() => setSupplierModalOpen(true)}
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
          <div className="grid gap-2">
            <Label htmlFor="po-reference">N° OC (referencia, opcional)</Label>
            <div className="group/field relative">
              <ClipboardList
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                  saving
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground group-focus-within/field:text-primary",
                )}
                aria-hidden
              />
              <Input
                id="po-reference"
                value={purchaseOrderReference}
                onChange={(ev) => setPurchaseOrderReference(ev.target.value.slice(0, 120))}
                placeholder="Ej. número o código de OC (solo referencia)"
                disabled={saving}
                className="pl-10"
              />
            </div>
          </div>
        </div>

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
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead className="min-w-[260px]">Material / descripción *</TableHead>
                  <TableHead className="w-24">Micras</TableHead>
                  <TableHead className="w-24">Ancho</TableHead>
                  <TableHead className="w-28">Cantidad *</TableHead>
                  <TableHead className="w-28">Unidad</TableHead>
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
                      <Select
                        value={line.item_type}
                        disabled={saving}
                        onValueChange={(v) => {
                          const shouldHideDimensions = HIDE_DIMENSIONS_FOR_TYPES.has(v)
                          updateFreeLine(i, {
                            item_type: v,
                            ...(shouldHideDimensions ? { micras: "", ancho_mm: "" } : {}),
                          })
                          if (newMaterialDraft.rowIndex === i) {
                            setNewMaterialDraft((prev) => ({
                              ...prev,
                              inventory_area: mapItemTypeToInventoryArea(v),
                            }))
                          }
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
                        onOpenChange={(open) => setMaterialComboOpenRow(open ? i : null)}
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
                            <span className={cn("truncate text-left", !line.material_id && "text-muted-foreground")}>
                              {line.material_id
                                ? materials.find((m) => String(m.id) === line.material_id)?.sku || "Seleccione SKU..."
                                : "Escribir o seleccionar SKU..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                          <Command shouldFilter>
                            <CommandInput placeholder="Buscar SKU..." />
                            <CommandList className="max-h-60">
                              <CommandEmpty>No hay SKU disponibles.</CommandEmpty>
                              <CommandGroup>
                                {materialsForItemType(line.item_type).map((m) => (
                                  <CommandItem
                                    key={m.id}
                                    value={m.sku}
                                    onSelect={() => {
                                      updateFreeLine(i, { material_id: String(m.id) })
                                      setMaterialComboOpenRow(null)
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
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={line.quantity}
                        onChange={(ev) => updateFreeLine(i, { quantity: sanitizeDecimalInput(ev.target.value) })}
                        placeholder="0"
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select
                        value={line.unit || "kg"}
                        disabled={saving}
                        onValueChange={(v) => updateFreeLine(i, { unit: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unidad..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedUnitsByItemType(line.item_type).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-start justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={saving}
                          onClick={() => openQuickMaterialCreator(i, line.item_type)}
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

        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Registrar recepción"}
        </Button>
      </form>

      <Dialog open={newMaterialDraft.rowIndex !== null} onOpenChange={(open) => (!open ? closeQuickMaterialCreator() : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear material rápido</DialogTitle>
            <DialogDescription>
              Use esta ventana solo si el SKU que necesita no aparece en la búsqueda.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="grid gap-2 md:col-span-2">
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={newMaterialDraft.name}
                onChange={(ev) =>
                  setNewMaterialDraft((prev) => ({ ...prev, name: ev.target.value }))
                }
                placeholder="Ej: BOPP Transparente 20 micras"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">SKU (opcional)</Label>
              <Input
                value={newMaterialDraft.sku}
                onChange={(ev) =>
                  setNewMaterialDraft((prev) => ({ ...prev, sku: ev.target.value }))
                }
                placeholder="Se genera automático"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Unidad</Label>
              <Select
                value={newMaterialDraft.unit}
                onValueChange={(v) => setNewMaterialDraft((prev) => ({ ...prev, unit: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 md:max-w-sm">
            <Label className="text-xs">Area inventario</Label>
            <Select
              value={newMaterialDraft.inventory_area}
              onValueChange={(v) =>
                setNewMaterialDraft((prev) => ({
                  ...prev,
                  inventory_area: v as NewMaterialDraft["inventory_area"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="material">sustrato</SelectItem>
                <SelectItem value="tintas">tintas</SelectItem>
                <SelectItem value="quimicos">quimicos</SelectItem>
                <SelectItem value="miscelaneos">miscelaneos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeQuickMaterialCreator}
              disabled={creatingMaterial}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void createMaterialQuickly()} disabled={creatingMaterial}>
              {creatingMaterial ? "Creando material..." : "Crear y seleccionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={supplierModalOpen}
        onOpenChange={(open) => {
          setSupplierModalOpen(open)
          if (!open && !creatingSupplier) setNewSupplierDraft({ name: "", rif: "" })
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear proveedor rápido</DialogTitle>
            <DialogDescription>
              Agregue un proveedor sin salir de esta recepción. Nombre y RIF son suficientes para empezar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="new-supplier-name">Nombre *</Label>
              <Input
                id="new-supplier-name"
                value={newSupplierDraft.name}
                onChange={(ev) => setNewSupplierDraft((prev) => ({ ...prev, name: ev.target.value }))}
                placeholder="Ej: Convertidora Aurora C.A."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-supplier-rif">RIF</Label>
              <Input
                id="new-supplier-rif"
                value={newSupplierDraft.rif}
                onChange={(ev) => setNewSupplierDraft((prev) => ({ ...prev, rif: ev.target.value.toUpperCase() }))}
                placeholder="Ej: J-12345678-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSupplierModalOpen(false)}
              disabled={creatingSupplier}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void createSupplierQuickly()} disabled={creatingSupplier}>
              {creatingSupplier ? "Creando proveedor..." : "Crear y seleccionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
