"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, VendorRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toastFieldValidationErrors } from "@/lib/form-validation-toast"
import { cn } from "@/lib/utils"
import { ArrowLeft, Phone, UserRound } from "lucide-react"

const fieldLabelClass = "leading-snug"

const fieldIconClass =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"

const inputWithIconClass = "h-9 pl-10 leading-none md:text-sm"

const PHONE_MAX_DIGITS = 15

const VENDOR_VALIDATION_TOAST_ORDER = [
  { key: "name", label: "Nombre" },
  { key: "phonePrimary", label: "Teléfono principal" },
  { key: "phoneSecondary", label: "Teléfono secundario" },
] as const

/** Límites alineados con ClientFormPage (teléfono); API vendors permite 64, UI igual que clientes. */
const LIM = {
  name: 255,
  phone: 22,
} as const

function clampStr(s: string, max: number): string {
  return s.slice(0, max)
}

function sanitizePhoneInput(raw: string): string {
  return raw.replace(/[^\d+().\-\s]/g, "").slice(0, LIM.phone)
}

export default function VendorFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get("id")
  const vendorId = idParam ? Number(idParam) : null
  const isEdit = Number.isFinite(vendorId) && vendorId! > 0

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [phonePrimary, setPhonePrimary] = useState("")
  const [phoneSecondary, setPhoneSecondary] = useState("")
  const [errors, setErrors] = useState<{
    name?: string
    phonePrimary?: string
    phoneSecondary?: string
  }>({})
  const [confirmNoPhoneOpen, setConfirmNoPhoneOpen] = useState(false)
  const [confirmNoPhoneBusy, setConfirmNoPhoneBusy] = useState(false)
  const pendingSubmitRef = useRef<null | (() => Promise<void>)>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const phonePrimaryRef = useRef<HTMLInputElement>(null)
  const phoneSecondaryRef = useRef<HTMLInputElement>(null)

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/vendedores"
  }, [location.state])

  const load = useCallback(async () => {
    if (!isEdit || !vendorId) return
    setLoading(true)
    try {
      const v = await apiFetch<VendorRecord>(`vendors/${vendorId}`)
      setName(clampStr(v.name ?? "", LIM.name))
      setPhonePrimary(sanitizePhoneInput(v.phone_primary ?? ""))
      setPhoneSecondary(sanitizePhoneInput(v.phone_secondary ?? ""))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el vendedor.")
    } finally {
      setLoading(false)
    }
  }, [isEdit, vendorId])

  useEffect(() => {
    void load()
  }, [load])

  const validate = useCallback(
    (draft?: { name?: string; phonePrimary?: string; phoneSecondary?: string }) => {
      const n = (draft?.name ?? name).trim()
      const p1 = (draft?.phonePrimary ?? phonePrimary).trim()
      const p2 = (draft?.phoneSecondary ?? phoneSecondary).trim()

      const next: typeof errors = {}
      if (!n) next.name = "El nombre es obligatorio."
      else if (n.length > LIM.name) next.name = `Máximo ${LIM.name} caracteres.`

      function phoneErr(p: string): string | undefined {
        if (!p) return undefined
        if (p.length > LIM.phone) return `Máximo ${LIM.phone} caracteres.`
        if (/[a-zA-Z]/.test(p)) return "No use letras en el teléfono."
        const compact = p.replace(/[^\d]/g, "")
        if (compact.length < 7) return "Teléfono inválido: se requieren al menos 7 dígitos."
        if (compact.length > PHONE_MAX_DIGITS)
          return `Teléfono inválido: máximo ${PHONE_MAX_DIGITS} dígitos.`
        if (!/^[+\d()\-\s.]+$/.test(p)) return "Teléfono inválido: use dígitos y separadores habituales."
        return undefined
      }

      const e1 = phoneErr(p1)
      const e2 = phoneErr(p2)
      if (e1) next.phonePrimary = e1
      if (e2) next.phoneSecondary = e2

      setErrors(next)
      return next
    },
    [name, phonePrimary, phoneSecondary],
  )

  const checkDuplicateVendorName = useCallback(
    async (value: string) => {
      const v = value.trim()
      if (!v) return
      try {
        const res = await apiFetch<LaravelPaginated<VendorRecord>>("vendors", {
          query: { q: v, per_page: 20, page: 1 },
        })
        const list = res.data ?? []
        const matches = list.filter((row) => {
          if (vendorId && row.id === vendorId) return false
          return String(row.name ?? "").trim().toLowerCase() === v.toLowerCase()
        })
        if (matches.length) {
          setErrors((prev) => ({
            ...prev,
            name: "Este vendedor ya existe (nombre).",
          }))
          toast.error("Este vendedor ya existe (nombre).")
        }
      } catch {
        // chequeo preventivo
      }
    },
    [vendorId],
  )

  function focusFirstError(next: typeof errors) {
    requestAnimationFrame(() => {
      if (next.name) nameRef.current?.focus()
      else if (next.phonePrimary) phonePrimaryRef.current?.focus()
      else if (next.phoneSecondary) phoneSecondaryRef.current?.focus()
    })
  }

  async function doSubmit() {
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        phone_primary: phonePrimary.trim() || null,
        phone_secondary: phoneSecondary.trim() || null,
      }
      if (isEdit && vendorId) {
        await apiFetch<VendorRecord>(`vendors/${vendorId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        toast.success("Vendedor actualizado.")
      } else {
        await apiFetch<VendorRecord>("vendors", {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Vendedor creado.")
      }
      navigate(returnTo)
    } catch (e) {
      if (e instanceof ApiError) {
        const errs = e.body?.errors
        if (e.status === 422 && errs && Object.keys(errs).length) {
          const msg = Object.values(errs)
            .flat()
            .map((s) => String(s).trim())
            .filter(Boolean)
            .filter((x, i, a) => a.indexOf(x) === i)
            .join("\n")

          const nameMsg = (() => {
            const raw = errs?.name
            if (!raw) return ""
            return (Array.isArray(raw) ? raw : [raw])
              .map((s) => String(s).trim())
              .filter(Boolean)
              .join("\n")
          })()

          if (nameMsg) {
            setErrors((prev) => ({ ...prev, name: nameMsg }))
            requestAnimationFrame(() => nameRef.current?.focus())
          }
          toast.error(msg || e.message)
        } else {
          toast.error(e.message)
        }
      } else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const v = validate()
    if (Object.keys(v).length) {
      focusFirstError(v)
      toastFieldValidationErrors(v, VENDOR_VALIDATION_TOAST_ORDER)
      return
    }

    if (!isEdit && !phonePrimary.trim()) {
      pendingSubmitRef.current = doSubmit
      setConfirmNoPhoneOpen(true)
      return
    }

    await doSubmit()
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Editar vendedor" : "Nuevo vendedor"}
          </h1>
          <p className="text-muted-foreground text-sm">Complete o actualice los datos del vendedor.</p>
        </div>
        <Button type="button" variant="outline" size="icon" asChild>
          <Link to={returnTo} title="Volver al listado" aria-label="Volver al listado">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : (
        <form
          noValidate
          onSubmit={(ev) => void submit(ev)}
          className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="v-name" className={fieldLabelClass}>
                Nombre *
              </Label>
              <div className="group/field relative">
                <UserRound
                  className={cn(
                    fieldIconClass,
                    errors.name
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={nameRef}
                  id="v-name"
                  value={name}
                  maxLength={LIM.name}
                  onChange={(ev) => {
                    const next = clampStr(ev.target.value, LIM.name)
                    setName(next)
                    if (errors.name) validate({ name: next })
                  }}
                  onBlur={() => {
                    validate({ name })
                    void checkDuplicateVendorName(name)
                  }}
                  aria-invalid={Boolean(errors.name)}
                  className={cn(inputWithIconClass, errors.name ? "border-destructive focus-visible:ring-destructive" : "")}
                  autoComplete="name"
                  placeholder="Ej. María Pérez"
                />
              </div>
              {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="v-phone-primary" className={fieldLabelClass}>
                Teléfono principal (opcional)
              </Label>
              <div className="group/field relative">
                <Phone
                  className={cn(
                    fieldIconClass,
                    errors.phonePrimary
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={phonePrimaryRef}
                  id="v-phone-primary"
                  value={phonePrimary}
                  maxLength={LIM.phone}
                  onChange={(ev) => {
                    const next = sanitizePhoneInput(ev.target.value)
                    setPhonePrimary(next)
                    if (errors.phonePrimary) validate({ phonePrimary: next })
                  }}
                  onBlur={() => validate({ phonePrimary })}
                  placeholder="+58 412 0000000"
                  aria-invalid={Boolean(errors.phonePrimary)}
                  autoComplete="tel"
                  className={cn(
                    inputWithIconClass,
                    errors.phonePrimary ? "border-destructive focus-visible:ring-destructive" : "",
                  )}
                />
              </div>
              {errors.phonePrimary ? <p className="text-destructive text-xs">{errors.phonePrimary}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="v-phone-secondary" className={fieldLabelClass}>
                Teléfono secundario (opcional)
              </Label>
              <div className="group/field relative">
                <Phone
                  className={cn(
                    fieldIconClass,
                    errors.phoneSecondary
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={phoneSecondaryRef}
                  id="v-phone-secondary"
                  value={phoneSecondary}
                  maxLength={LIM.phone}
                  onChange={(ev) => {
                    const next = sanitizePhoneInput(ev.target.value)
                    setPhoneSecondary(next)
                    if (errors.phoneSecondary) validate({ phoneSecondary: next })
                  }}
                  onBlur={() => validate({ phoneSecondary })}
                  placeholder="+58 414 0000000"
                  aria-invalid={Boolean(errors.phoneSecondary)}
                  autoComplete="tel"
                  className={cn(
                    inputWithIconClass,
                    errors.phoneSecondary ? "border-destructive focus-visible:ring-destructive" : "",
                  )}
                />
              </div>
              {errors.phoneSecondary ? <p className="text-destructive text-xs">{errors.phoneSecondary}</p> : null}
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button type="submit" disabled={saving} className="min-w-[12rem]">
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear vendedor"}
            </Button>
          </div>
        </form>
      )}

      <Dialog open={confirmNoPhoneOpen} onOpenChange={(next) => setConfirmNoPhoneOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recomendación</DialogTitle>
            <DialogDescription>
              Estás creando el vendedor sin <b>teléfono principal</b>. ¿Deseas continuar de todas formas?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={confirmNoPhoneBusy}
              onClick={() => {
                setConfirmNoPhoneOpen(false)
                pendingSubmitRef.current = null
              }}
            >
              Volver
            </Button>
            <Button
              type="button"
              disabled={confirmNoPhoneBusy}
              onClick={() => {
                if (!pendingSubmitRef.current) {
                  setConfirmNoPhoneOpen(false)
                  return
                }
                setConfirmNoPhoneBusy(true)
                void (async () => {
                  try {
                    await pendingSubmitRef.current?.()
                    setConfirmNoPhoneOpen(false)
                    pendingSubmitRef.current = null
                  } finally {
                    setConfirmNoPhoneBusy(false)
                  }
                })()
              }}
            >
              {confirmNoPhoneBusy ? "Creando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
