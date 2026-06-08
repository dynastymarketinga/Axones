"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogMasterFormBackButton } from "@/components/axones/CatalogMasterFormBackButton"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormPanelClass,
  catalogMasterFormPlainInputClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"
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
import { toastFieldValidationErrors } from "@/lib/form-validation-toast"
import {
  clampStr,
  MASTER_FORM_PHONE_MAX_CHARS,
  masterFormPhoneError,
  sanitizePhoneInput,
} from "@/lib/masters-form-phone"
import { cn } from "@/lib/utils"
import { Phone, UserRound, Users } from "lucide-react"

const VENDOR_VALIDATION_TOAST_ORDER = [
  { key: "name", label: "Nombre" },
  { key: "phonePrimary", label: "Teléfono principal" },
  { key: "phoneSecondary", label: "Teléfono secundario" },
] as const

/** Límites alineados con ClientFormPage (teléfono); API vendors permite 64, UI igual que clientes. */
const LIM = {
  name: 255,
  phone: MASTER_FORM_PHONE_MAX_CHARS,
} as const

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

  const pageTitle = isEdit ? "Editar vendedor" : "Nuevo vendedor"
  const pageSubtitle = isEdit
    ? "Actualice el nombre y teléfonos de contacto del vendedor."
    : "Registre el nombre y teléfonos de contacto del vendedor."

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

      const e1 = masterFormPhoneError(p1)
      const e2 = masterFormPhoneError(p2)
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

  const backButton = <CatalogMasterFormBackButton to={returnTo} />

  return (
    <CatalogPageShell
      title={pageTitle}
      subtitle={pageSubtitle}
      icon={Users}
      headerVariant="elevated"
      action={backButton}
    >
      {loading ? (
        <PageLoadingBlock />
      ) : (
        <form
          noValidate
          onSubmit={(ev) => void submit(ev)}
          className={catalogMasterFormPanelClass}
        >
          <div className={catalogMasterFormSectionClass}>
            <h2 className="text-base font-semibold tracking-tight">Datos del vendedor</h2>
            <p className="text-muted-foreground text-sm">
              El nombre es obligatorio. Los teléfonos ayudan al seguimiento comercial.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <CatalogLabeledField
              label="Nombre *"
              htmlFor="v-name"
              icon={UserRound}
              className="md:col-span-2"
            >
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
                autoComplete="name"
                placeholder="Ej. María Pérez"
                className={cn(
                  catalogMasterFormPlainInputClass,
                  errors.name && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
            </CatalogLabeledField>

            <CatalogLabeledField
              label="Teléfono principal (opcional)"
              htmlFor="v-phone-primary"
              icon={Phone}
            >
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
                  catalogMasterFormPlainInputClass,
                  errors.phonePrimary && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {errors.phonePrimary ? (
                <p className="text-destructive text-xs">{errors.phonePrimary}</p>
              ) : null}
            </CatalogLabeledField>

            <CatalogLabeledField
              label="Teléfono secundario (opcional)"
              htmlFor="v-phone-secondary"
              icon={Phone}
            >
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
                  catalogMasterFormPlainInputClass,
                  errors.phoneSecondary && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {errors.phoneSecondary ? (
                <p className="text-destructive text-xs">{errors.phoneSecondary}</p>
              ) : null}
            </CatalogLabeledField>
          </div>

          <div className={catalogMasterFormActionsClass}>
            <Button type="button" variant="outline" className="border-primary/25" asChild>
              <Link to={returnTo}>Cancelar</Link>
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[10rem] shadow-sm">
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
    </CatalogPageShell>
  )
}
