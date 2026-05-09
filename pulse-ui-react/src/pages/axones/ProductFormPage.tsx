"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Building2, Boxes, CircleHelp, Hash, Layers, Package2, Printer } from "lucide-react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { AXONES_INVENTORY_FILTER_INPUT_CLASS } from "@/components/axones/inventory-page-layout"
import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
import { InlineSpinner } from "@/components/axones/LoadingStates"
import { WorkOrderStageBadge } from "@/components/axones/WorkOrderStageBadge"
import { toastFieldValidationErrors } from "@/lib/form-validation-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"

const FILTER_INPUT_CLASS = AXONES_INVENTORY_FILTER_INPUT_CLASS

const fieldIconClass =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"

const fieldIconClassSelect =
  "pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transition-colors"

const PRODUCT_PRINT_TYPES = ["Trimilaminado", "Bilaminado", "Superficie"] as const

/** Límite alineado con validación API (`structure` en productos). */
const PRODUCT_STRUCTURE_MAX_LEN = 300

/** Radix Select no admite value vacío; se usa como opción “sin tipo”. */
const PRINT_TYPE_EMPTY = "__print_type_empty__"

const PRODUCT_VALIDATION_TOAST_ORDER = [
  { key: "client_id", label: "Cliente" },
  { key: "name", label: "Nombre" },
] as const

function isStandardPrintType(value: string): value is (typeof PRODUCT_PRINT_TYPES)[number] {
  return (PRODUCT_PRINT_TYPES as readonly string[]).includes(value)
}

/** Unifica mayúsculas/minúsculas del API (p. ej. legacy en MAYÚSCULAS) al formato estándar en pantalla. */
function canonicalizeLoadedPrintType(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  const lower = t.toLowerCase()
  for (const opt of PRODUCT_PRINT_TYPES) {
    if (opt.toLowerCase() === lower) return opt
  }
  return t
}

export default function ProductFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get("id")
  const productId = idParam ? Number(idParam) : null
  const isEdit = Number.isFinite(productId) && productId! > 0

  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [clientId, setClientId] = useState<string>("")
  const [name, setName] = useState("")
  const [cpe, setCpe] = useState("")
  const [mps, setMps] = useState("")
  const [printType, setPrintType] = useState("")
  const [structure, setStructure] = useState("")
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)

  const [errors, setErrors] = useState<{ client_id?: string; name?: string }>({})

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/productos"
  }, [location.state])

  const trimmedPrintType = printType.trim()
  const printTypeSelectValue = trimmedPrintType === "" ? PRINT_TYPE_EMPTY : trimmedPrintType

  const showLegacyPrintTypeOption =
    trimmedPrintType !== "" && !isStandardPrintType(trimmedPrintType)

  const validate = useCallback(
    (draft?: { name?: string; clientId?: string }) => {
      const n = (draft?.name ?? name).trim()
      const cid = Number(draft?.clientId ?? clientId)
      const next: typeof errors = {}
      if (!Number.isFinite(cid) || cid < 1) {
        next.client_id = "El cliente es obligatorio."
      }
      if (!n) next.name = "El nombre es obligatorio."
      setErrors(next)
      return next
    },
    [clientId, name],
  )

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 100, page: 1 },
        })
        if (!c) setClients(res.data)
      } catch {
        if (!c) setClients([])
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const load = useCallback(async () => {
    if (!isEdit || !productId) return
    setLoading(true)
    try {
      const p = await apiFetch<ProductRecord>(`products/${productId}`)
      setName(p.name ?? "")
      setCpe(p.cpe ?? "")
      setMps(p.mps ?? "")
      setPrintType(canonicalizeLoadedPrintType(p.print_type ?? ""))
      setStructure((p.structure ?? "").slice(0, PRODUCT_STRUCTURE_MAX_LEN))
      setClientId(p.client_id ? String(p.client_id) : "")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la especificación.")
    } finally {
      setLoading(false)
    }
  }, [isEdit, productId])

  useEffect(() => {
    void load()
  }, [load])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const v = validate()
    if (Object.keys(v).length) {
      toastFieldValidationErrors(v, PRODUCT_VALIDATION_TOAST_ORDER)
      return
    }
    setSaving(true)
    try {
      const cid = Number(clientId)
      if (!Number.isFinite(cid) || cid < 1) {
        toast.error("Seleccione un cliente para la especificación.")
        setErrors((prev) => ({ ...prev, client_id: "El cliente es obligatorio." }))
        return
      }
      const body = {
        name: name.trim(),
        client_id: cid,
        cpe: cpe.trim() || null,
        mps: mps.trim() || null,
        print_type: printType.trim() || null,
        structure: structure.trim() || null,
      }
      if (isEdit && productId) {
        await apiFetch<ProductRecord>(`products/${productId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        toast.success("Especificación actualizada.")
        navigate(returnTo)
      } else {
        await apiFetch<ProductRecord>("products", {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Especificación creada.")
        navigate(returnTo)
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const errs = e.body?.errors
        if (e.status === 422 && errs && Object.keys(errs).length) {
          const msg = Object.values(errs)
            .flat()
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join("\n")
          toast.error(msg || e.message)
        } else {
          toast.error(e.message)
        }
      }
      else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="sr-only">{isEdit ? "Editar especificación" : "Nueva especificación"}</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <WorkOrderStageBadge current="especificacion" className="pt-1" />
        <div className="flex shrink-0 justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setHelpOpen(true)}
            aria-label="Ayuda"
          >
            <CircleHelp className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" asChild>
            <Link to={returnTo} aria-label="Volver al listado">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : (
        <form
          noValidate
          onSubmit={(ev) => void submit(ev)}
          className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="p-client">Cliente *</Label>
              <div className="group/field relative">
                <Building2
                  className={cn(
                    fieldIconClassSelect,
                    errors.client_id
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Select
                  value={clientId}
                  onValueChange={(value) => {
                    setClientId(value)
                    if (errors.client_id) {
                      setErrors((prev) => ({ ...prev, client_id: undefined }))
                    }
                  }}
                >
                  <SelectTrigger
                    id="p-client"
                    aria-invalid={Boolean(errors.client_id)}
                    className={cn(
                      "h-10 pl-10",
                      FILTER_INPUT_CLASS,
                      errors.client_id && "border-destructive focus-visible:ring-destructive",
                    )}
                  >
                    <SelectValue placeholder="Seleccione cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errors.client_id ? (
                <p className="text-destructive text-xs">{errors.client_id}</p>
              ) : null}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="p-name">Nombre *</Label>
              <div className="group/field relative">
                <Package2
                  className={cn(
                    fieldIconClass,
                    errors.name
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  id="p-name"
                  className={cn(
                    "pl-10",
                    FILTER_INPUT_CLASS,
                    errors.name && "border-destructive focus-visible:ring-destructive",
                  )}
                  value={name}
                  onChange={(ev) => {
                    setName(ev.target.value)
                    if (errors.name) validate({ name: ev.target.value })
                  }}
                  aria-invalid={Boolean(errors.name)}
                  aria-required={true}
                />
              </div>
              {errors.name ? (
                <p className="text-destructive text-xs">{errors.name}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-cpe">CPE</Label>
              <div className="group/field relative">
                <Hash
                  className={cn(
                    fieldIconClass,
                    "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  id="p-cpe"
                  className={cn("pl-10", FILTER_INPUT_CLASS)}
                  value={cpe}
                  onChange={(ev) => setCpe(ev.target.value)}
                  placeholder="Ej. 0421496219"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-mps">MPS</Label>
              <div className="group/field relative">
                <Boxes
                  className={cn(
                    fieldIconClass,
                    "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  id="p-mps"
                  className={cn("pl-10", FILTER_INPUT_CLASS)}
                  value={mps}
                  onChange={(ev) => setMps(ev.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-print-trigger">Tipo de impresión</Label>
              <div className="group/field relative">
                <Printer
                  className={cn(
                    fieldIconClassSelect,
                    "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Select
                  value={printTypeSelectValue}
                  onValueChange={(value) => {
                    setPrintType(value === PRINT_TYPE_EMPTY ? "" : value)
                  }}
                >
                  <SelectTrigger
                    id="p-print-trigger"
                    className={cn("h-10 pl-10", FILTER_INPUT_CLASS)}
                  >
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PRINT_TYPE_EMPTY}>Seleccione tipo</SelectItem>
                    {PRODUCT_PRINT_TYPES.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                    {showLegacyPrintTypeOption ? (
                      <SelectItem value={trimmedPrintType}>
                        {`${trimmedPrintType} (valor guardado)`}
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="p-structure">Estructura del material</Label>
              <div className="group/field relative">
                <Layers
                  className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within/field:text-primary"
                  aria-hidden
                />
                <Textarea
                  id="p-structure"
                  className={cn("pl-10", FILTER_INPUT_CLASS)}
                  rows={4}
                  maxLength={PRODUCT_STRUCTURE_MAX_LEN}
                  value={structure}
                  onChange={(ev) => setStructure(ev.target.value)}
                  placeholder="Ej. PEBD 630×26 + PEBD 630×26 (bilaminado)"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  {isEdit || logoLoadFailed ? (
                    <InlineSpinner />
                  ) : (
                    <img
                      src={`${import.meta.env.BASE_URL}brand/logo-axones-1.png`}
                      alt="Axones"
                      className="h-4 w-4 rounded-full object-cover"
                      style={{ animation: "spin 1s linear infinite" }}
                      onError={() => setLogoLoadFailed(true)}
                    />
                  )}
                  {isEdit ? "Guardando..." : "Creando especificación..."}
                </span>
              ) : isEdit ? (
                "Guardar cambios"
              ) : (
                "Crear especificación"
              )}
            </Button>
          </div>
        </form>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guía rápida: Nueva especificación</DialogTitle>
            <DialogDescription>
              Esta pantalla registra la referencia por cliente (CPE/MPS, etc.), no insumos ni stock de terminado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Qué hace:</strong> define la ficha técnico-comercial que se elige al armar pedidos y OT.</p>
            <p><strong>Cuándo usarla:</strong> cuando aparece una nueva presentación comercial o técnica para un cliente.</p>
            <p><strong>Qué pasa después:</strong> esa especificación se usa en pedidos de cliente y en órdenes de trabajo.</p>
            <p><strong>Producto terminado:</strong> se declara en el área de Corte (kg) y se entrega vía Despacho / nota.</p>
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
