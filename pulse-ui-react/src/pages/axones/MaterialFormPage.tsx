"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { Barcode, Boxes, Building2, Check, ChevronDown, ChevronsUpDown, Layers, Package2, Ruler, ScanLine, StickyNote, Warehouse } from "lucide-react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { formatMaterialDimensionDisplay } from "@/lib/purchase-receipt-material-label"
import type { ClientRecord, LaravelPaginated, MaterialRow, ProductRecord, SupplierRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMaterialFormTabTheme } from "@/lib/material-area-theme"
import { cn } from "@/lib/utils"
import { getStoredUser } from "@/lib/auth-storage"
import { ReasonModal } from "@/components/axones/ReasonModal"

type DuplicateCheckResponse = {
  has_duplicates: boolean
  total_matches: number
  matches: Array<{
    id: number
    sku: string
    name: string
    inventory_area: string
  }>
}

type NewProductDraft = {
  name: string
  clientId: string
}

type InventoryTab = "sustratos" | "tintas" | "quimicos" | "miscelaneo"
const MISC_UNITS = ["kg", "unidad", "m", "rollo", "otros"] as const

/** Alineado con `MaterialNoSupplierPolicy` en backend: pueden usar «Sin proveedor» sin texto en no_supplier_reason. */
const ROLES_THAT_OMIT_NO_SUPPLIER_REASON = [
  "boss",
  "admin",
  "jefe_supremo",
  "superadmin",
  "inventory_chief",
  "jefe_inventario",
] as const
const FILTER_INPUT_CLASS = "border-primary/25 bg-background/90 focus-visible:ring-primary/40"

function normalizeDecimalInput(raw: string): string {
  const normalized = raw.replace(",", ".").replace(/[^0-9.]/g, "")
  const firstDot = normalized.indexOf(".")
  if (firstDot === -1) return normalized
  const integerPart = normalized.slice(0, firstDot + 1)
  const decimalPart = normalized.slice(firstDot + 1).replace(/\./g, "").slice(0, 2)
  return `${integerPart}${decimalPart}`
}

function formatToTwoDecimals(raw: string | number | null | undefined): string {
  const n = Number(String(raw ?? "0").replace(",", "."))
  if (!Number.isFinite(n)) return "0.00"
  return n.toFixed(2)
}

function parseDecimalForApi(raw: string): number {
  const s = String(raw ?? "").trim().replace(",", ".")
  if (s === "") return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function inferTabFromArea(area?: string | null): InventoryTab {
  if (area === "tintas" || area === "cementerio_tintas") return "tintas"
  if (area === "quimicos") return "quimicos"
  if (area === "miscelaneos") return "miscelaneo"
  return "sustratos"
}

export default function MaterialFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const materialId = Number(id)
  const isEdit = Number.isFinite(materialId) && materialId > 0

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [tab, setTab] = useState<InventoryTab>("sustratos")
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [barcode, setBarcode] = useState("")
  const [micras, setMicras] = useState("")
  const [ancho, setAncho] = useState("")
  const [notes, setNotes] = useState("")
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [productComboOpen, setProductComboOpen] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [newProductDraft, setNewProductDraft] = useState<NewProductDraft>({ name: "", clientId: "" })
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [tintaSubarea, setTintaSubarea] = useState<"laminacion" | "superficie" | "prueba_laminacion" | "laminacion_nueva">("laminacion")
  /** En pestaña Tintas: `tintas` vs `cementerio_tintas` (misma UI, distinto área en API). */
  const [tintaAreaChoice, setTintaAreaChoice] = useState<"tintas" | "cementerio_tintas">("tintas")
  const [consumibleUnit, setConsumibleUnit] = useState<(typeof MISC_UNITS)[number]>("unidad")
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [preferredSupplierOpen, setPreferredSupplierOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateCheckResponse["matches"]>([])
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)
  const [reasonModalOpen, setReasonModalOpen] = useState(false)
  const [pendingReasonPayload, setPendingReasonPayload] = useState<Record<string, unknown> | null>(null)
  const [changeReason, setChangeReason] = useState("")
  const [skuError, setSkuError] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [tintaSubareaError, setTintaSubareaError] = useState(false)
  const [supplierIdError, setSupplierIdError] = useState(false)
  const [noSupplier, setNoSupplier] = useState(false)
  const [noSupplierReason, setNoSupplierReason] = useState("")
  const [noSupplierReasonError, setNoSupplierReasonError] = useState(false)
  const [confirmDimensionsOpen, setConfirmDimensionsOpen] = useState(false)
  const [pendingDimensionsPayload, setPendingDimensionsPayload] = useState<Record<string, unknown> | null>(null)

  const receiptPrefillAppliedRef = useRef(false)

  const noSupplierReasonFieldId = useMemo(() => {
    if (tab === "tintas") return "material-no-supplier-reason-tintas"
    if (tab === "quimicos") return "material-no-supplier-reason-quimicos"
    if (tab === "miscelaneo") return "material-no-supplier-reason-misc"
    return "material-no-supplier-reason-sustratos"
  }, [tab])

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string; materialPrefillFromReceipt?: unknown } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/materiales"
  }, [location.state])

  useEffect(() => {
    if (isEdit || receiptPrefillAppliedRef.current) return
    const st = location.state as {
      materialPrefillFromReceipt?: {
        tab?: InventoryTab
        sku?: string
        name?: string
        micras?: string
        ancho?: string
        supplierId?: number | null
      }
    } | null
    const p = st?.materialPrefillFromReceipt
    if (!p) return
    receiptPrefillAppliedRef.current = true
    if (p.tab) setTab(p.tab)
    if (typeof p.sku === "string" && p.sku.trim()) setSku(p.sku.trim().toUpperCase())
    if (typeof p.name === "string") setName(p.name.trim())
    if (typeof p.micras === "string" && p.micras.trim()) setMicras(formatMaterialDimensionDisplay(p.micras))
    if (typeof p.ancho === "string" && p.ancho.trim()) setAncho(formatMaterialDimensionDisplay(p.ancho))
    if (typeof p.supplierId === "number" && p.supplierId > 0) {
      setSupplierId(p.supplierId)
      setNoSupplier(false)
      setNoSupplierReason("")
      setNoSupplierReasonError(false)
      setSupplierIdError(false)
    }
  }, [isEdit, location.state])

  const load = useCallback(async () => {
    if (!isEdit || !materialId) return
    setLoading(true)
    try {
      const row = await apiFetch<MaterialRow>(`materials/${materialId}`)
      setSku(row.sku ?? "")
      setName(row.name ?? "")
      setBarcode(row.barcode ?? "")
      setTab(inferTabFromArea(row.inventory_area))
      setTintaAreaChoice(row.inventory_area === "cementerio_tintas" ? "cementerio_tintas" : "tintas")
      setTintaSubarea((row.tinta_subareas?.[0]?.subarea as "laminacion" | "superficie" | "prueba_laminacion" | "laminacion_nueva") || "laminacion")
      setMicras(formatMaterialDimensionDisplay(row.micras))
      setAncho(formatMaterialDimensionDisplay(row.ancho))
      setNotes(row.notes ?? "")
      setConsumibleUnit(MISC_UNITS.includes((row.unit ?? "") as (typeof MISC_UNITS)[number]) ? (row.unit as (typeof MISC_UNITS)[number]) : "unidad")
      setSelectedProductIds((row.substrate_products ?? []).map((p) => p.id))
      const sid = row.supplier_id ?? row.supplier?.id ?? null
      const supplierNumericOk = typeof sid === "number" && sid > 0
      setSupplierId(supplierNumericOk ? sid : null)
      const reasonFromApi = (row.no_supplier_reason ?? "").trim()
      if (supplierNumericOk) {
        setNoSupplier(false)
        setNoSupplierReason("")
      } else if (reasonFromApi.length > 0) {
        setNoSupplier(true)
        setNoSupplierReason(reasonFromApi)
      } else {
        setNoSupplier(false)
        setNoSupplierReason("")
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el material.")
    } finally {
      setLoading(false)
    }
  }, [isEdit, materialId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPreferredSupplierOpen(false)
  }, [tab])

  useEffect(() => {
    if (supplierId != null && supplierId > 0) {
      setSupplierIdError(false)
      setNoSupplier(false)
      setNoSupplierReason("")
      setNoSupplierReasonError(false)
    }
  }, [supplierId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<ProductRecord>>("products", {
          query: { per_page: 300, page: 1 },
        })
        if (!cancelled) setProducts(res.data)
      } catch {
        if (!cancelled) setProducts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 100, page: 1 },
        })
        if (!cancelled) setClients(res.data)
      } catch {
        if (!cancelled) setClients([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
          query: { per_page: 300, page: 1 },
        })
        if (!cancelled) setSuppliers(res.data)
      } catch {
        if (!cancelled) setSuppliers([])
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

  const selectedPreferredSupplier = useMemo(
    () => (supplierId != null ? supplierOptions.find((s) => s.id === supplierId) ?? null : null),
    [supplierId, supplierOptions],
  )

  const selectedProductsLabel = useMemo(() => {
    if (!selectedProductIds.length) return "Seleccione productos..."
    const names = products
      .filter((p) => selectedProductIds.includes(p.id))
      .map((p) => p.name)
      .filter(Boolean)
    if (!names.length) return "Seleccione productos..."
    if (names.length === 1) return names[0]
    return `${names[0]} +${names.length - 1}`
  }, [products, selectedProductIds])

  const canOmitNoSupplierReason = useMemo(() => {
    const r = (getStoredUser()?.role ?? "").toLowerCase().trim()
    return (ROLES_THAT_OMIT_NO_SUPPLIER_REASON as readonly string[]).includes(r)
  }, [])

  const supplierNoVendorBlock = (
    <div className="grid gap-3 border-t border-border/60 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          id={`material-no-supplier-${tab}`}
          checked={noSupplier}
          disabled={saving}
          onCheckedChange={(v) => {
            const checked = v === true
            setNoSupplier(checked)
            if (checked) {
              setSupplierId(null)
              setSupplierIdError(false)
              setPreferredSupplierOpen(false)
            } else {
              setNoSupplierReasonError(false)
            }
          }}
        />
        <Label
          htmlFor={`material-no-supplier-${tab}`}
          className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Sin proveedor
        </Label>
      </div>
      {noSupplier ? (
        canOmitNoSupplierReason ? (
          <p className="text-muted-foreground text-xs">
            Sin proveedor. Su rol no exige registrar motivo aquí; puede usar «Notas» si quiere dejar constancia.
          </p>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={noSupplierReasonFieldId}>Motivo *</Label>
            <Textarea
              id={noSupplierReasonFieldId}
              rows={3}
              placeholder="Ej: proveedor en evaluación; ingreso urgente sin factura a mano; consolidación desde otro almacén."
              value={noSupplierReason}
              onChange={(ev) => {
                setNoSupplierReason(ev.target.value)
                if (noSupplierReasonError) setNoSupplierReasonError(false)
              }}
              className={cn(
                FILTER_INPUT_CLASS,
                noSupplierReasonError ? "border-red-500 focus-visible:ring-red-500" : "",
              )}
              aria-required
            />
            {noSupplierReasonError ? (
              <p className="text-destructive text-sm">Debe explicar por qué no hay proveedor (mínimo 5 caracteres).</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Obligatorio para inventario cuando marca sin proveedor (auditoría).
              </p>
            )}
          </div>
        )
      ) : null}
    </div>
  )

  function buildPayloadByTab() {
    const commonNotes = notes.trim() || null

    if (tab === "sustratos") {
      return {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        barcode: barcode.trim() || null,
        inventory_area: "material",
        unit: "kg",
        micras: Number(micras || "0"),
        ancho: Number(ancho || "0"),
        ...(!isEdit ? { quantity_on_hand: 0 } : {}),
        product_ids: selectedProductIds,
        notes: commonNotes,
        supplier_id: noSupplier ? null : supplierId ?? null,
        no_supplier_reason: noSupplier ? noSupplierReason.trim() || null : null,
      }
    }
    if (tab === "tintas") {
      return {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        barcode: null,
        inventory_area: tintaAreaChoice,
        unit: "kg",
        ...(!isEdit ? { quantity_on_hand: 0 } : {}),
        tinta_subarea: tintaSubarea,
        notes: notes.trim() || null,
        supplier_id: noSupplier ? null : supplierId ?? null,
        no_supplier_reason: noSupplier ? noSupplierReason.trim() || null : null,
      }
    }
    if (tab === "quimicos") {
      return {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        barcode: null,
        inventory_area: "quimicos",
        unit: "kg",
        ...(!isEdit ? { quantity_on_hand: 0 } : {}),
        notes: notes.trim() || null,
        supplier_id: noSupplier ? null : supplierId ?? null,
        no_supplier_reason: noSupplier ? noSupplierReason.trim() || null : null,
      }
    }
    return {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      barcode: null,
      inventory_area: "miscelaneos",
      unit: MISC_UNITS.includes(consumibleUnit as (typeof MISC_UNITS)[number]) ? consumibleUnit : "unidad",
      micras: null,
      ancho: null,
      ...(!isEdit ? { quantity_on_hand: 0 } : {}),
      notes: notes.trim() || null,
      supplier_id: noSupplier ? null : supplierId ?? null,
      no_supplier_reason: noSupplier ? noSupplierReason.trim() || null : null,
    }
  }

  async function persist(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      if (isEdit && materialId) {
        await apiFetch<MaterialRow>(`materials/${materialId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        toast.success("Material actualizado.")
      } else {
        await apiFetch<MaterialRow>("materials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        toast.success("Material creado.")
      }
      navigate(returnTo)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar el material.")
    } finally {
      setSaving(false)
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()

    const skuOk = sku.trim().length > 0
    const nameOk = name.trim().length > 0
    const tintaSubareaOk = tab !== "tintas" || Boolean(tintaSubarea)
    const supplierOk = noSupplier
      ? canOmitNoSupplierReason || noSupplierReason.trim().length >= 5
      : supplierId != null && supplierId > 0

    setSkuError(!skuOk)
    setNameError(!nameOk)
    setTintaSubareaError(!tintaSubareaOk)
    setSupplierIdError(!supplierOk && !noSupplier)
    setNoSupplierReasonError(noSupplier && !canOmitNoSupplierReason && !supplierOk)

    const activeSkuId =
      tab === "sustratos"
        ? "material-sku"
        : tab === "tintas"
          ? "material-sku-tintas"
          : tab === "quimicos"
            ? "material-sku-quimicos"
            : "material-sku-miscelaneo"

    if (!skuOk || !nameOk) {
      document.getElementById(activeSkuId)?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("Código y nombre son obligatorios.")
      return
    }
    if (!tintaSubareaOk) {
      document.getElementById("material-tinta-subarea")?.scrollIntoView({ behavior: "smooth", block: "center" })
      toast.error("La subárea es obligatoria para tintas.")
      return
    }
    if (!supplierOk) {
      if (noSupplier) {
        document.getElementById(noSupplierReasonFieldId)?.scrollIntoView({ behavior: "smooth", block: "center" })
        toast.error("Debe explicar por qué no hay proveedor.")
      } else {
        const supplierAnchor =
          tab === "quimicos"
            ? "material-preferred-supplier-quimicos"
            : tab === "tintas"
              ? "material-preferred-supplier-tintas"
              : tab === "miscelaneo"
                ? "material-preferred-supplier-misc"
                : "material-preferred-supplier-sustratos"
        document.getElementById(supplierAnchor)?.scrollIntoView({ behavior: "smooth", block: "center" })
        toast.error("Seleccione un proveedor.")
      }
      return
    }

    const payload = buildPayloadByTab()

    if (tab === "sustratos") {
      const micrasMissing = micras.trim().length === 0 || Number(micras) <= 0
      const anchoMissing = ancho.trim().length === 0 || Number(ancho) <= 0
      if (micrasMissing || anchoMissing) {
        setPendingDimensionsPayload(payload)
        setConfirmDimensionsOpen(true)
        return
      }
    }

    await continueAfterValidation(payload)
  }

  async function continueAfterValidation(payload: Record<string, unknown>) {
    try {
      const d = await apiFetch<DuplicateCheckResponse>("materials/check-duplicates", {
        query: {
          sku: String(payload.sku ?? ""),
          name: String(payload.name ?? ""),
          inventory_area: String(payload.inventory_area ?? ""),
          except_id: isEdit && materialId ? String(materialId) : undefined,
        },
      })
      if (d.has_duplicates) {
        setDuplicateMatches(d.matches)
        setPendingPayload(payload)
        setDuplicateDialogOpen(true)
        return
      }
    } catch {
      // warning is preventive; don't block create/update
    }

    if (isEdit) {
      setPendingReasonPayload(payload)
      setReasonModalOpen(true)
      return
    }

    await persist(payload)
  }

  function toggleProduct(productId: number) {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    )
  }

  async function createProductQuickly() {
    const name = newProductDraft.name.trim()
    const clientId = Number(newProductDraft.clientId)
    if (!name) {
      toast.error("Indique el nombre del producto.")
      return
    }
    if (!Number.isFinite(clientId) || clientId < 1) {
      toast.error("Seleccione el cliente para crear el producto.")
      return
    }
    setCreatingProduct(true)
    try {
      const created = await apiFetch<ProductRecord>("products", {
        method: "POST",
        body: JSON.stringify({
          name,
          client_id: clientId,
          cpe: null,
          barcode: null,
          mps: null,
          print_type: "Sustrato",
          structure: null,
        }),
      })
      setProducts((prev) => [...prev, created].sort((a, b) => (a.name || "").localeCompare(b.name || "")))
      setSelectedProductIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]))
      setProductModalOpen(false)
      setNewProductDraft({ name: "", clientId: "" })
      toast.success("Producto creado y vinculado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo crear el producto.")
    } finally {
      setCreatingProduct(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Editar material" : "Nuevo material"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Cree insumos de inventario para recepción y producción.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setHelpOpen(true)}>
            Ayuda
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={returnTo}>Volver al listado</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : (
        <form noValidate onSubmit={(ev) => void submit(ev)} className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <Tabs value={tab} onValueChange={(v) => setTab(v as InventoryTab)}>
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="sustratos" className={getMaterialFormTabTheme("sustratos").tabTriggerClass}>
                Sustratos
              </TabsTrigger>
              <TabsTrigger value="tintas" className={getMaterialFormTabTheme("tintas").tabTriggerClass}>
                Tintas
              </TabsTrigger>
              <TabsTrigger value="quimicos" className={getMaterialFormTabTheme("quimicos").tabTriggerClass}>
                Químicos
              </TabsTrigger>
              <TabsTrigger value="miscelaneo" className={getMaterialFormTabTheme("miscelaneo").tabTriggerClass}>
                Misceláneo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sustratos" className="mt-4 rounded-xl border-l-4 border-l-emerald-500 bg-emerald-50/30 p-4">
              <h1 className="mb-2 text-center text-2xl font-extrabold tracking-wide text-emerald-900">SUSTRATOS</h1>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Los kilogramos en stock se registran en <strong>Inventario → Recepción</strong> (ingreso de material), no en este formulario.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2"><Label htmlFor="material-sku">Código *</Label><div className="group/field relative"><Barcode className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", skuError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-sku" value={sku} onChange={(ev) => {
                  setSku(ev.target.value.toUpperCase())
                  if (skuError) setSkuError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, skuError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: SUB-BOPP-1042" /></div></div>
                <div className="grid gap-2"><Label htmlFor="material-name">Material *</Label><div className="group/field relative"><Package2 className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", nameError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-name" value={name} onChange={(ev) => {
                  setName(ev.target.value)
                  if (nameError) setNameError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, nameError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: BOPP transparente 20 µm" /></div></div>
                <div className="grid gap-2"><Label htmlFor="material-micras">Micras *</Label><div className="group/field relative"><ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors text-muted-foreground group-focus-within/field:text-primary" aria-hidden /><Input id="material-micras" type="number" min="0" step="0.001" value={micras} onChange={(ev) => setMicras(ev.target.value)} className={cn("pl-10", FILTER_INPUT_CLASS)} placeholder="Ej: 20" /></div></div>
                <div className="grid gap-2"><Label htmlFor="material-ancho">Ancho *</Label><div className="group/field relative"><Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors text-muted-foreground group-focus-within/field:text-primary" aria-hidden /><Input id="material-ancho" type="number" min="0" step="0.001" value={ancho} onChange={(ev) => setAncho(ev.target.value)} className={cn("pl-10", FILTER_INPUT_CLASS)} placeholder="Ej: 1040 (mm)" /></div></div>
                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="material-preferred-supplier-sustratos">
                    {noSupplier ? "Proveedor" : "Proveedor *"}
                  </Label>
                  <Popover open={preferredSupplierOpen} onOpenChange={setPreferredSupplierOpen}>
                    <PopoverTrigger asChild>
                      <div className="group/field relative w-full">
                        <Building2
                          className={cn(
                            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 group-focus-within/field:text-primary",
                            supplierIdError ? "text-red-500" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <Button
                          id="material-preferred-supplier-sustratos"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={preferredSupplierOpen}
                          disabled={noSupplier || saving}
                          className={cn(
                            "h-10 w-full justify-between pl-10 pr-3 font-normal",
                            supplierIdError ? "border-red-500 focus-visible:ring-red-500" : "",
                          )}
                        >
                          <span className={cn("truncate text-left", !selectedPreferredSupplier && "text-muted-foreground")}>
                            {selectedPreferredSupplier?.name || "Buscar proveedor…"}
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
                                value={`sustratos-${supplier.id}-${supplier.name} ${supplier.rif ?? ""}`}
                                onSelect={() => {
                                  setSupplierId(supplier.id)
                                  setPreferredSupplierOpen(false)
                                  setSupplierIdError(false)
                                  setNoSupplier(false)
                                  setNoSupplierReason("")
                                  setNoSupplierReasonError(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplierId === supplier.id ? "opacity-100" : "opacity-0",
                                  )}
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
                  {supplierNoVendorBlock}
                </div>
                <div className="grid gap-2 md:col-span-3">
                  <Label>Especificaciones vinculadas (opcional)</Label>
                  <div className="flex items-center gap-2">
                    <Popover open={productComboOpen} onOpenChange={setProductComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={productComboOpen}
                          className={cn("h-10 flex-1 justify-between font-normal", FILTER_INPUT_CLASS)}
                        >
                          <span className={cn("truncate text-left", !selectedProductIds.length && "text-muted-foreground")}>
                            {selectedProductsLabel}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                        <Command shouldFilter>
                          <CommandInput placeholder="Buscar producto..." />
                          <CommandList className="max-h-60">
                            <CommandEmpty>Sin productos disponibles.</CommandEmpty>
                            <CommandGroup>
                              {products.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => toggleProduct(p.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProductIds.includes(p.id) ? "opacity-100" : "opacity-0",
                                    )}
                                    aria-hidden
                                  />
                                  {p.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {products.length ? (
                      <Button type="button" variant="outline" onClick={() => setProductModalOpen(true)}>
                        + Nuevo producto
                      </Button>
                    ) : null}
                  </div>
                  {!products.length ? (
                    <div className="rounded-md border border-dashed border-primary/30 bg-background/80 p-3">
                      <p className="text-muted-foreground text-sm">Aun no hay productos creados para vincular.</p>
                      <Button className="mt-2" type="button" size="sm" variant="secondary" onClick={() => setProductModalOpen(true)}>
                        Crear producto ahora
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tintas" className="mt-4 rounded-xl border-l-4 border-l-blue-500 bg-blue-50/30 p-4">
              <h1 className="mb-2 text-center text-2xl font-extrabold tracking-wide text-blue-900">TINTAS</h1>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Los kilogramos en stock se registran en <strong>Inventario → Recepción</strong> (ingreso de material), no en este formulario.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2"><Label htmlFor="material-sku-tintas">Código *</Label><div className="group/field relative"><Barcode className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", skuError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-sku-tintas" value={sku} onChange={(ev) => {
                  setSku(ev.target.value.toUpperCase())
                  if (skuError) setSkuError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, skuError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: TNT-CMYK-BASE-01" /></div></div>
                <div className="grid gap-2"><Label htmlFor="material-name-tintas">Color / Material *</Label><div className="group/field relative"><Package2 className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", nameError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-name-tintas" value={name} onChange={(ev) => {
                  setName(ev.target.value)
                  if (nameError) setNameError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, nameError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: Magenta proceso" /></div></div>
                <div className="grid gap-2"><Label>Subárea *</Label>
                  <div className="group/field relative">
                    <Layers className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", tintaSubareaError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden />
                    <select id="material-tinta-subarea" className={cn("border-input h-10 w-full appearance-none rounded-md border px-3 pl-10 pr-10 text-sm", FILTER_INPUT_CLASS, tintaSubareaError ? "border-red-500 focus-visible:ring-red-500" : "")} value={tintaSubarea} onChange={(ev) => {
                    setTintaSubarea(ev.target.value as typeof tintaSubarea)
                    if (tintaSubareaError) setTintaSubareaError(false)
                  }}>
                    <option value="laminacion">Laminación</option>
                    <option value="superficie">Superficie</option>
                    <option value="prueba_laminacion">Prueba laminación</option>
                    <option value="laminacion_nueva">Laminación nueva</option>
                  </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  </div>
                </div>
                <div className="grid gap-2"><Label htmlFor="material-tinta-area-choice">Área de inventario *</Label>
                  <div className="group/field relative w-full">
                    <Warehouse className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary" aria-hidden />
                    <select
                      id="material-tinta-area-choice"
                      className={cn("border-input h-10 w-full appearance-none rounded-md border px-3 pl-10 pr-10 text-sm", FILTER_INPUT_CLASS)}
                      value={tintaAreaChoice}
                      onChange={(ev) => setTintaAreaChoice(ev.target.value as "tintas" | "cementerio_tintas")}
                    >
                      <option value="tintas">Tintas</option>
                      <option value="cementerio_tintas">Cementerio de tintas</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  </div>
                </div>
                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="material-preferred-supplier-tintas">{noSupplier ? "Proveedor" : "Proveedor *"}</Label>
                  <Popover open={preferredSupplierOpen} onOpenChange={setPreferredSupplierOpen}>
                    <PopoverTrigger asChild>
                      <div className="group/field relative w-full">
                        <Building2
                          className={cn(
                            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 group-focus-within/field:text-primary",
                            supplierIdError ? "text-red-500" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <Button
                          id="material-preferred-supplier-tintas"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={preferredSupplierOpen}
                          disabled={noSupplier || saving}
                          className={cn(
                            "h-10 w-full justify-between pl-10 pr-3 font-normal",
                            supplierIdError ? "border-red-500 focus-visible:ring-red-500" : "",
                          )}
                        >
                          <span className={cn("truncate text-left", !selectedPreferredSupplier && "text-muted-foreground")}>
                            {selectedPreferredSupplier?.name || "Buscar proveedor…"}
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
                                  setPreferredSupplierOpen(false)
                                  setSupplierIdError(false)
                                  setNoSupplier(false)
                                  setNoSupplierReason("")
                                  setNoSupplierReasonError(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplierId === supplier.id ? "opacity-100" : "opacity-0",
                                  )}
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
                  {supplierNoVendorBlock}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="quimicos" className="mt-4 rounded-xl border-l-4 border-l-amber-500 bg-amber-50/30 p-4">
              <h1 className="mb-2 text-center text-2xl font-extrabold tracking-wide text-amber-900">QUIMICOS</h1>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Los kilogramos en stock se registran en <strong>Inventario → Recepción</strong> (ingreso de material), no en este formulario.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2"><Label htmlFor="material-sku-quimicos">Cod *</Label><div className="group/field relative"><Barcode className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", skuError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-sku-quimicos" value={sku} onChange={(ev) => {
                  setSku(ev.target.value.toUpperCase())
                  if (skuError) setSkuError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, skuError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: SOL-ETIL-01" /></div></div>
                <div className="grid gap-2"><Label htmlFor="material-name-quimicos">Material *</Label><div className="group/field relative"><Package2 className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", nameError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-name-quimicos" value={name} onChange={(ev) => {
                  setName(ev.target.value)
                  if (nameError) setNameError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, nameError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: Solvente etílico industrial" /></div></div>
                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="material-preferred-supplier-quimicos">{noSupplier ? "Proveedor" : "Proveedor *"}</Label>
                  <Popover open={preferredSupplierOpen} onOpenChange={setPreferredSupplierOpen}>
                    <PopoverTrigger asChild>
                      <div className="group/field relative w-full">
                        <Building2
                          className={cn(
                            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 group-focus-within/field:text-primary",
                            supplierIdError ? "text-red-500" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <Button
                          id="material-preferred-supplier-quimicos"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={preferredSupplierOpen}
                          disabled={noSupplier || saving}
                          className={cn(
                            "h-10 w-full justify-between pl-10 pr-3 font-normal",
                            supplierIdError ? "border-red-500 focus-visible:ring-red-500" : "",
                          )}
                        >
                          <span className={cn("truncate text-left", !selectedPreferredSupplier && "text-muted-foreground")}>
                            {selectedPreferredSupplier?.name || "Buscar proveedor…"}
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
                                value={`quimicos-${supplier.id}-${supplier.name} ${supplier.rif ?? ""}`}
                                onSelect={() => {
                                  setSupplierId(supplier.id)
                                  setPreferredSupplierOpen(false)
                                  setSupplierIdError(false)
                                  setNoSupplier(false)
                                  setNoSupplierReason("")
                                  setNoSupplierReasonError(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplierId === supplier.id ? "opacity-100" : "opacity-0",
                                  )}
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
                  {supplierNoVendorBlock}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="miscelaneo" className="mt-4 rounded-xl border-l-4 border-l-violet-500 bg-violet-50/30 p-4">
              <h1 className="mb-2 text-center text-2xl font-extrabold tracking-wide text-violet-900">MISCELÁNEO</h1>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Las cantidades en stock se registran en <strong>Inventario → Recepción</strong> (ingreso de material), no en este formulario.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2"><Label htmlFor="material-sku-miscelaneo">Código *</Label><div className="group/field relative"><Barcode className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", skuError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-sku-miscelaneo" value={sku} onChange={(ev) => {
                  setSku(ev.target.value.toUpperCase())
                  if (skuError) setSkuError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, skuError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: MISC-CINTA-48" /></div></div>
                <div className="grid gap-2"><Label htmlFor="material-name-miscelaneo">Material *</Label><div className="group/field relative"><Package2 className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", nameError ? "text-red-500" : "text-muted-foreground group-focus-within/field:text-primary")} aria-hidden /><Input id="material-name-miscelaneo" value={name} onChange={(ev) => {
                  setName(ev.target.value)
                  if (nameError) setNameError(false)
                }} className={cn("pl-10", FILTER_INPUT_CLASS, nameError ? "border-red-500 focus-visible:ring-red-500" : "")} placeholder="Ej: Cinta doble faz 48 mm" /></div></div>
                <div className="grid gap-2"><Label>Unidad</Label>
                  <div className="group/field relative">
                  <Boxes className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary" aria-hidden />
                    <select className={cn("border-input h-10 w-full appearance-none rounded-md border px-3 pl-10 pr-10 text-sm", FILTER_INPUT_CLASS)} value={consumibleUnit} onChange={(ev) => setConsumibleUnit(ev.target.value as (typeof MISC_UNITS)[number])}>
                    <option value="kg">kg</option>
                    <option value="unidad">unidad</option>
                    <option value="m">m</option>
                    <option value="rollo">rollo</option>
                    <option value="otros">otros</option>
                  </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  </div>
                </div>
                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="material-preferred-supplier-misc">{noSupplier ? "Proveedor" : "Proveedor *"}</Label>
                  <Popover open={preferredSupplierOpen} onOpenChange={setPreferredSupplierOpen}>
                    <PopoverTrigger asChild>
                      <div className="group/field relative w-full">
                        <Building2
                          className={cn(
                            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 group-focus-within/field:text-primary",
                            supplierIdError ? "text-red-500" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <Button
                          id="material-preferred-supplier-misc"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={preferredSupplierOpen}
                          disabled={noSupplier || saving}
                          className={cn(
                            "h-10 w-full justify-between pl-10 pr-3 font-normal",
                            supplierIdError ? "border-red-500 focus-visible:ring-red-500" : "",
                          )}
                        >
                          <span className={cn("truncate text-left", !selectedPreferredSupplier && "text-muted-foreground")}>
                            {selectedPreferredSupplier?.name || "Buscar proveedor…"}
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
                                value={`misc-${supplier.id}-${supplier.name} ${supplier.rif ?? ""}`}
                                onSelect={() => {
                                  setSupplierId(supplier.id)
                                  setPreferredSupplierOpen(false)
                                  setSupplierIdError(false)
                                  setNoSupplier(false)
                                  setNoSupplierReason("")
                                  setNoSupplierReasonError(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplierId === supplier.id ? "opacity-100" : "opacity-0",
                                  )}
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
                  {supplierNoVendorBlock}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 rounded-xl border border-primary/15 bg-background/60 p-4">
            <div className="grid gap-2">
              <Label htmlFor="m-notes">Notas</Label>
              <div className="group/field relative">
                <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within/field:text-primary" aria-hidden />
                <Textarea
                  className={cn("pl-10", FILTER_INPUT_CLASS)}
                  id="m-notes"
                  rows={3}
                  value={notes}
                  onChange={(ev) => setNotes(ev.target.value)}
                  placeholder="Ej: lote del proveedor, observaciones de calidad o de ubicación en almacén."
                />
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear material"}
              </Button>
            </div>
          </div>
        </form>
      )}

      <Dialog
        open={confirmDimensionsOpen}
        onOpenChange={(open) => {
          setConfirmDimensionsOpen(open)
          if (!open) setPendingDimensionsPayload(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar guardado sin Micras / Ancho</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea guardar este sustrato sin haber rellenado <strong>Micras</strong> y <strong>Ancho</strong>? Podrá completarlos más tarde.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmDimensionsOpen(false)
                setPendingDimensionsPayload(null)
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                const payload = pendingDimensionsPayload
                setConfirmDimensionsOpen(false)
                setPendingDimensionsPayload(null)
                if (payload) void continueAfterValidation(payload)
              }}
              disabled={saving}
            >
              Sí, guardar igual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Posible duplicado detectado</DialogTitle>
            <DialogDescription>
              Se encontraron materiales similares por Código o por Nombre + Área.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-56 overflow-auto rounded-md border p-2 text-sm">
            {duplicateMatches.map((m) => (
              <div key={m.id} className="border-b px-2 py-1 last:border-b-0">
                {m.sku} — {m.name} ({m.inventory_area})
              </div>
            ))}
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
                if (!payload) return
                if (isEdit) {
                  setPendingReasonPayload(payload)
                  setReasonModalOpen(true)
                  return
                }
                void persist(payload)
              }}
            >
              Continuar y guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonModal
        open={reasonModalOpen}
        loading={saving}
        initialValue={changeReason}
        onCancel={() => {
          setReasonModalOpen(false)
          setPendingReasonPayload(null)
        }}
        onConfirm={(reason) => {
          setChangeReason(reason)
          const payload = pendingReasonPayload
          if (!payload) return
          setReasonModalOpen(false)
          void persist({ ...payload, change_reason: reason })
        }}
      />

      <Dialog
        open={productModalOpen}
        onOpenChange={(open) => {
          setProductModalOpen(open)
          if (!open && !creatingProduct) setNewProductDraft({ name: "", clientId: "" })
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear producto rápido</DialogTitle>
            <DialogDescription>
              Cree un producto básico sin salir de este formulario. El cliente es obligatorio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select
                value={newProductDraft.clientId}
                onValueChange={(value) => setNewProductDraft((prev) => ({ ...prev, clientId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-product-name">Nombre *</Label>
              <Input
                id="new-product-name"
                value={newProductDraft.name}
                onChange={(ev) => setNewProductDraft((prev) => ({ ...prev, name: ev.target.value }))}
                placeholder="Ej: BOLSA CPE"
              />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de impresión (auto)</Label>
              <Input value="Sustrato" readOnly />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductModalOpen(false)}
              disabled={creatingProduct}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void createProductQuickly()} disabled={creatingProduct}>
              {creatingProduct ? "Creando producto..." : "Crear y usar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guía rápida: Nuevo material</DialogTitle>
            <DialogDescription>
              Esta pantalla crea insumos, no productos terminados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Qué hace:</strong> registra materiales de inventario como sustrato, tinta, químico o misceláneo.</p>
            <p>
              <strong>Stock en kg (sustratos, tintas y químicos):</strong> al crear, el material queda con <strong>0 kg</strong> hasta que registre las entradas reales en{" "}
              <strong>Inventario → Recepción</strong> (ingreso de material).
            </p>
            <p><strong>Cuándo usarla:</strong> cuando un insumo nuevo debe existir en el maestro antes de recibir o consumir.</p>
            <p><strong>Relación con producción:</strong> los materiales creados aquí luego se consumen en OT y movimientos.</p>
            <p><strong>Orden recomendado:</strong> 1) Producto terminado, 2) Materiales insumo, 3) Ingreso de material cuando llegue físicamente.</p>
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

