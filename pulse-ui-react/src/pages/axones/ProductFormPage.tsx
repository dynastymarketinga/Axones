"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
import { InlineSpinner } from "@/components/axones/LoadingStates"
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

const PRODUCT_PRINT_TYPES = ["Trimilaminado", "Bilaminado", "Superficie"] as const

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
      setStructure(p.structure ?? "")
      setClientId(p.client_id ? String(p.client_id) : "")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el producto.")
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
        toast.error("Seleccione un cliente para el producto.")
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
        toast.success("Producto actualizado.")
        navigate(returnTo)
      } else {
        await apiFetch<ProductRecord>("products", {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Producto creado.")
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Cree el producto terminado que luego se usa en pedidos y OT.
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
        <form
          onSubmit={(ev) => void submit(ev)}
          className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label>Cliente *</Label>
              <Select
                value={clientId}
                onValueChange={(value) => {
                  setClientId(value)
                  if (errors.client_id) {
                    setErrors((prev) => ({ ...prev, client_id: undefined }))
                  }
                }}
              >
                <SelectTrigger>
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
              {errors.client_id ? (
                <p className="text-destructive text-xs">{errors.client_id}</p>
              ) : null}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="p-name">Nombre *</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(ev) => {
                  setName(ev.target.value)
                  if (errors.name) validate({ name: ev.target.value })
                }}
                aria-invalid={Boolean(errors.name)}
                required
              />
              {errors.name ? (
                <p className="text-destructive text-xs">{errors.name}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-cpe">CPE</Label>
              <Input
                id="p-cpe"
                value={cpe}
                onChange={(ev) => setCpe(ev.target.value)}
                placeholder="Ej. 0421496219"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-mps">MPS</Label>
              <Input
                id="p-mps"
                value={mps}
                onChange={(ev) => setMps(ev.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-print-trigger">Tipo de impresión</Label>
              <Select
                value={printTypeSelectValue}
                onValueChange={(value) => {
                  setPrintType(value === PRINT_TYPE_EMPTY ? "" : value)
                }}
              >
                <SelectTrigger id="p-print-trigger">
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

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="p-structure">Estructura del material</Label>
              <Textarea
                id="p-structure"
                rows={4}
                value={structure}
                onChange={(ev) => setStructure(ev.target.value)}
                placeholder="Ej. PEBD 630×26 + PEBD 630×26 (bilaminado)"
              />
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                {isEdit || logoLoadFailed ? (
                  <InlineSpinner />
                ) : (
                  <img
                    src="/logo%20axones.jpg.jpeg"
                    alt="Axones"
                    className="h-4 w-4 rounded-full object-cover"
                    style={{ animation: "spin 1s linear infinite" }}
                    onError={() => setLogoLoadFailed(true)}
                  />
                )}
                {isEdit ? "Guardando..." : "Creando producto..."}
              </span>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear producto"
            )}
          </Button>
        </form>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guía rápida: Nuevo producto</DialogTitle>
            <DialogDescription>
              Esta pantalla crea productos terminados, no insumos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Qué hace:</strong> registra el producto final que se vende o se fabrica para cliente.</p>
            <p><strong>Cuándo usarla:</strong> cuando aparece una nueva presentación comercial o técnica.</p>
            <p><strong>Qué pasa después:</strong> ese producto se usa en pedidos de cliente y en órdenes de trabajo.</p>
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
