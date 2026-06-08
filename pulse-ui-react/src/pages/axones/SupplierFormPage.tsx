"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, SupplierRecord } from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import { normalizeRole } from "@/lib/axones-roles"
import { CatalogMasterFormBackButton } from "@/components/axones/CatalogMasterFormBackButton"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormInputClass,
  catalogMasterFormPanelClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toastFieldValidationErrors } from "@/lib/form-validation-toast"
import {
  clampStr,
  MASTER_FORM_PHONE_MAX_CHARS,
  masterFormPhoneError,
  sanitizePhoneInput,
} from "@/lib/masters-form-phone"
import { cn } from "@/lib/utils"
import { Hash, Mail, MapPin, Phone, Truck, UserRound } from "lucide-react"

const RIF_LETTERS = ["J", "V", "E", "G", "P", "C"] as const

const DEFAULT_RIF_LETTER: (typeof RIF_LETTERS)[number] = "V"

function normalizeRifLetterForSelect(raw: string): (typeof RIF_LETTERS)[number] {
  const L = raw.trim().toUpperCase()
  return RIF_LETTERS.includes(L as (typeof RIF_LETTERS)[number]) ? (L as (typeof RIF_LETTERS)[number]) : DEFAULT_RIF_LETTER
}

const SUPPLIER_VALIDATION_TOAST_ORDER = [
  { key: "name", label: "Nombre" },
  { key: "rif", label: "RIF" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo" },
  { key: "address", label: "Dirección" },
] as const

const fieldLabelClass = "leading-snug"

const fieldIconClass =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"

const inputWithIconClass = catalogMasterFormInputClass

/** Límites alineados con ClientFormPage; teléfono en API suppliers hasta 64, UI igual que clientes. */
const LIM = {
  name: 255,
  address: 2000,
  email: 255,
  phone: MASTER_FORM_PHONE_MAX_CHARS,
} as const

function onlyDigits(s: string, maxLen: number): string {
  return s.replace(/\D/g, "").slice(0, maxLen)
}

function looseRifNumberInput(raw: string, currentLetter: string): { letter: string; digits: string } {
  const u = raw.trim().toUpperCase()
  const withLead = u.match(/^([JVEGPC])\s*[^\d]*([\s\S]*)$/)
  let letter = currentLetter.trim().toUpperCase()
  let tail = u
  if (withLead && RIF_LETTERS.includes(withLead[1] as (typeof RIF_LETTERS)[number])) {
    letter = withLead[1]
    tail = withLead[2] ?? ""
  }
  const digits = onlyDigits(tail, 9)
  return { letter, digits }
}

function parseRifFromStored(rif: string | null | undefined): {
  letter: string
  main: string
  dv: string
} {
  const s = (rif ?? "").trim().toUpperCase().replace(/\s+/g, "")
  if (!s) return { letter: "", main: "", dv: "" }
  const withHyphens = s.match(/^([JVEGPC])-(\d{7,8})-(\d)$/)
  if (withHyphens) {
    return { letter: withHyphens[1], main: withHyphens[2], dv: withHyphens[3] }
  }
  const compact = s.replace(/[.\-_]/g, "")
  const m = compact.match(/^([JVEGPC])(\d{8,9})$/)
  if (!m) return { letter: "", main: "", dv: "" }
  const digits = m[2]
  return {
    letter: m[1],
    main: digits.slice(0, -1),
    dv: digits.slice(-1),
  }
}

export default function SupplierFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get("id")
  const supplierId = idParam ? Number(idParam) : null
  const isEdit = Number.isFinite(supplierId) && supplierId! > 0

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [rifLetter, setRifLetter] = useState<(typeof RIF_LETTERS)[number]>(DEFAULT_RIF_LETTER)
  const [rifDigits, setRifDigits] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [noRif, setNoRif] = useState(false)

  const session = getStoredUser()
  const isInventory = (() => {
    const r = normalizeRole(session?.role)
    return r === "inventory" || r === "inventario"
  })()

  const [errors, setErrors] = useState<{
    name?: string
    rif?: string
    phone?: string
    email?: string
    address?: string
  }>({})

  const nameRef = useRef<HTMLInputElement>(null)
  const rifLetterTriggerRef = useRef<HTMLButtonElement>(null)
  const rifDigitsRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/proveedores"
  }, [location.state])

  const normalizeRif = useCallback((value: string): string => {
    const raw = value.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw) return ""
    const compact = raw.replace(/-/g, "")
    const m = compact.match(/^([JVEGPC])(\d{8,9})$/)
    if (!m) return raw
    const letter = m[1]
    const digits = m[2]
    if (digits.length < 8) return raw
    const main = digits.slice(0, digits.length - 1)
    const dv = digits.slice(-1)
    return `${letter}-${main}-${dv}`
  }, [])

  const composeRifForSubmit = useCallback((): string => {
    const d = onlyDigits(rifDigits, 9)
    const L = rifLetter.trim().toUpperCase()
    if (!L || d.length < 8) return ""
    return normalizeRif(`${L}${d}`)
  }, [normalizeRif, rifDigits, rifLetter])

  const validate = useCallback(
    (draft?: {
      name?: string
      rifLetter?: string
      rifDigits?: string
      phone?: string
      email?: string
      address?: string
      noRif?: boolean
    }) => {
      const nRaw = draft?.name ?? name
      const n = nRaw.trim()
      const useNoRif = draft?.noRif ?? noRif
      const L = (draft?.rifLetter ?? rifLetter).trim().toUpperCase()
      const bodyRaw = draft?.rifDigits ?? rifDigits
      const d = onlyDigits(bodyRaw, 9)
      const p = (draft?.phone ?? phone).trim()
      const e = (draft?.email ?? email).trim()
      const addr = (draft?.address ?? address).trim()

      const next: typeof errors = {}
      if (!n) next.name = "El nombre es obligatorio."
      else if (n.length < 2) next.name = "Mínimo 2 caracteres."
      else if (n.length > LIM.name) next.name = `Máximo ${LIM.name} caracteres.`

      if (addr.length > LIM.address) next.address = `Máximo ${LIM.address} caracteres.`

      if (useNoRif) {
        // Sin RIF: no validar dígitos
      } else if (!L && d.length === 0) {
        next.rif = "El RIF es obligatorio o marque «Sin RIF (proveedor informal)»."
      } else if (!L && d.length > 0) {
        next.rif = "Elija la letra (J, V, E, G, P o C)."
      } else if (L && !RIF_LETTERS.includes(L as (typeof RIF_LETTERS)[number])) {
        next.rif = "Elija la letra (J, V, E, G, P o C)."
      } else if (L && d.length === 0) {
        next.rif = "Ingrese el número (puede pegar 2818787-4 o 123456789)."
      } else if (d.length < 8) {
        next.rif = "Faltan dígitos (8+verificador o 7+verificador)."
      } else if (d.length === 8) {
        const composed = normalizeRif(`${L}${d}`)
        if (!/^[JVEGPC]-\d{7}-\d$/.test(composed)) {
          next.rif = "RIF inválido: 8 cifras no encajan; pruebe 9 cifras (estándar J-12345678-9)."
        }
      } else {
        const composed = normalizeRif(`${L}${d}`)
        if (!/^[JVEGPC]-\d{8}-\d$/.test(composed)) {
          next.rif = "RIF inválido: revise número y verificador."
        }
      }

      if (p) {
        const phoneError = masterFormPhoneError(p)
        if (phoneError) next.phone = phoneError
      }

      if (e) {
        if (e.length > LIM.email) next.email = `Máximo ${LIM.email} caracteres.`
        else if (!e.includes("@")) next.email = "El correo debe incluir @."
        else {
          const parts = e.split("@")
          if (parts.length !== 2) next.email = "Use una sola arroba (@)."
          else {
            const [local, domain] = parts
            if (!local?.trim() || !domain?.trim())
              next.email = "Correo inválido: texto antes y después de @."
          }
        }
      }

      setErrors(next)
      return next
    },
    [address, email, name, noRif, normalizeRif, phone, rifDigits, rifLetter],
  )

  const checkDuplicateSupplier = useCallback(
    async (field: "name" | "rif", value: string) => {
      const v = value.trim()
      if (!v || (field === "rif" && noRif)) return
      try {
        const res = await apiFetch<LaravelPaginated<SupplierRecord>>("suppliers", {
          query: { q: v, per_page: 20, page: 1 },
        })
        const list = res.data ?? []
        const matches = list.filter((s) => {
          if (supplierId && s.id === supplierId) return false
          if (field === "rif") return String(s.rif ?? "").trim().toUpperCase() === v.toUpperCase()
          return String(s.name ?? "").trim().toLowerCase() === v.toLowerCase()
        })
        if (matches.length) {
          setErrors((prev) => ({
            ...prev,
            [field]: field === "rif" ? "Este RIF ya existe." : "Este proveedor ya existe (nombre).",
          }))
          toast.error(field === "rif" ? "Este RIF ya existe." : "Este proveedor ya existe (nombre).")
        }
      } catch {
        // chequeo preventivo
      }
    },
    [noRif, supplierId],
  )

  const load = useCallback(async () => {
    if (!isEdit || !supplierId) return
    setLoading(true)
    try {
      const s = await apiFetch<SupplierRecord>(`suppliers/${supplierId}`)
      setName(clampStr(s.name ?? "", LIM.name))
      const hasRif = Boolean(s.rif && String(s.rif).trim())
      setNoRif(!hasRif)
      const parts = parseRifFromStored(s.rif)
      setRifLetter(hasRif ? normalizeRifLetterForSelect(parts.letter) : DEFAULT_RIF_LETTER)
      setRifDigits(hasRif ? parts.main + parts.dv : "")
      setEmail(clampStr(s.email ?? "", LIM.email))
      setPhone(sanitizePhoneInput(s.phone ?? ""))
      setAddress(clampStr(s.address ?? "", LIM.address))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el proveedor.")
    } finally {
      setLoading(false)
    }
  }, [isEdit, supplierId])

  useEffect(() => {
    void load()
  }, [load])

  function focusFirstError(v: typeof errors) {
    requestAnimationFrame(() => {
      if (v.name) {
        nameRef.current?.focus()
        return
      }
      if (v.rif && !noRif) {
        const letterOk =
          rifLetter.trim() !== "" &&
          RIF_LETTERS.includes(rifLetter.trim().toUpperCase() as (typeof RIF_LETTERS)[number])
        if (!letterOk) rifLetterTriggerRef.current?.focus()
        else rifDigitsRef.current?.focus()
        return
      }
      if (v.phone) {
        phoneRef.current?.focus()
        return
      }
      if (v.email) {
        emailRef.current?.focus()
        return
      }
      if (v.address) addressRef.current?.focus()
    })
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const v = validate()
    if (Object.keys(v).length) {
      toastFieldValidationErrors(v, SUPPLIER_VALIDATION_TOAST_ORDER)
      focusFirstError(v)
      return
    }
    setSaving(true)
    try {
      const normalizedRif = composeRifForSubmit().trim()
      const body: Record<string, unknown> = {
        name: name.trim(),
        no_rif: noRif,
        rif: noRif ? null : normalizedRif || null,
      }
      if (!isInventory) {
        body.email = email.trim() || null
        body.phone = phone.trim() || null
        body.address = address.trim() || null
      }
      if (isEdit && supplierId) {
        await apiFetch<SupplierRecord>(`suppliers/${supplierId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        toast.success("Proveedor actualizado.")
        navigate(returnTo)
      } else {
        const created = await apiFetch<SupplierRecord>("suppliers", {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Proveedor creado.")
        const newId = Number(created?.id)
        if (Number.isFinite(newId) && newId > 0) {
          const q = returnTo.indexOf("?")
          const pathOnly = q >= 0 ? returnTo.slice(0, q) : returnTo
          const sp = new URLSearchParams(q >= 0 ? returnTo.slice(q + 1) : "")
          sp.set("proveedor", String(newId))
          navigate(`${pathOnly}?${sp.toString()}`, { replace: true })
        } else {
          navigate(returnTo, { replace: true })
        }
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const errs = e.body?.errors
        if (e.status === 422 && errs && Object.keys(errs).length) {
          const msg = Object.values(errs)
            .flat()
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((x, i, a) => a.indexOf(x) === i)
            .join("\n")
          toast.error(msg || e.message)
        } else {
          toast.error(e.message)
        }
      } else toast.error("No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <CatalogPageShell
      title={isEdit ? "Editar proveedor" : "Nuevo proveedor"}
      subtitle={
        isEdit
          ? "Actualice los datos del proveedor usados en compras y órdenes de compra."
          : "Registre los datos del proveedor usados en compras y órdenes de compra."
      }
      icon={Truck}
      headerVariant="elevated"
      action={<CatalogMasterFormBackButton to={returnTo} />}
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
            <h2 className="text-base font-semibold tracking-tight">Datos del proveedor</h2>
            <p className="text-muted-foreground text-sm">
              Nombre y RIF identifican al proveedor. Marque «Sin RIF» si es informal.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="s-name" className={fieldLabelClass}>
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
                  id="s-name"
                  className={inputWithIconClass}
                  maxLength={LIM.name}
                  value={name}
                  onChange={(ev) => {
                    const next = clampStr(ev.target.value, LIM.name)
                    setName(next)
                    if (errors.name) validate({ name: next })
                  }}
                  onBlur={() => {
                    validate({ name })
                    void checkDuplicateSupplier("name", name)
                  }}
                  aria-invalid={Boolean(errors.name)}
                  autoComplete="organization"
                  placeholder="Ej. Distribuidora Los Andes C.A."
                />
              </div>
              {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
            </div>

            <div className="grid min-w-0 gap-2 gap-x-4 md:col-span-2 md:grid-cols-2 md:gap-y-2">
              <Label htmlFor="s-rif-digits" className={cn(fieldLabelClass, "md:col-start-1 md:row-start-1")}>
                RIF
              </Label>
              <div
                className={cn(
                  "flex min-h-9 min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring md:col-start-1 md:row-start-2",
                  errors.rif && "border-destructive focus-within:ring-destructive",
                )}
              >
                <Select
                  value={rifLetter}
                  disabled={noRif}
                  onValueChange={(val) => {
                    const L = normalizeRifLetterForSelect(val)
                    setRifLetter(L)
                    if (errors.rif) validate({ rifLetter: L, rifDigits })
                  }}
                >
                  <SelectTrigger
                    ref={rifLetterTriggerRef}
                    aria-label="Letra del RIF"
                    disabled={noRif}
                    className="h-9 w-[3.25rem] shrink-0 self-stretch rounded-none border-0 border-r border-input bg-muted/50 px-2 shadow-none ring-offset-0 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5"
                    aria-invalid={Boolean(errors.rif)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RIF_LETTERS.map((letter) => (
                      <SelectItem key={letter} value={letter}>
                        {letter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="group/rifdigits relative flex min-h-9 min-w-0 flex-1 items-center">
                  <Hash
                    className={cn(
                      fieldIconClass,
                      errors.rif
                        ? "text-destructive"
                        : "text-muted-foreground group-focus-within/rifdigits:text-primary",
                    )}
                    aria-hidden
                  />
                  <Input
                    ref={rifDigitsRef}
                    id="s-rif-digits"
                    disabled={noRif}
                    className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent py-0 pl-9 pr-3 font-mono text-sm leading-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="2818787-4 o 123456789"
                    value={rifDigits}
                    onChange={(ev) => {
                      const { letter: nextL, digits: nextD } = looseRifNumberInput(ev.target.value, rifLetter)
                      const letterNorm = normalizeRifLetterForSelect(nextL)
                      if (letterNorm !== rifLetter) setRifLetter(letterNorm)
                      setRifDigits(nextD)
                      if (errors.rif) validate({ rifLetter: letterNorm, rifDigits: nextD })
                    }}
                    onBlur={() => {
                      if (noRif) return
                      const { letter: nextL, digits: nextD } = looseRifNumberInput(rifDigits, rifLetter)
                      const letterNorm = normalizeRifLetterForSelect(nextL)
                      if (letterNorm !== rifLetter) setRifLetter(letterNorm)
                      if (nextD !== rifDigits) setRifDigits(nextD)
                      validate({ rifLetter: letterNorm, rifDigits: nextD })
                      const composed = normalizeRif(`${letterNorm}${nextD}`)
                      if (composed) void checkDuplicateSupplier("rif", composed)
                    }}
                    aria-invalid={Boolean(errors.rif)}
                  />
                </div>
              </div>
              <div className="min-h-[1.125rem] md:col-start-1 md:row-start-3">
                {errors.rif ? (
                  <p className="text-destructive text-xs leading-tight">{errors.rif}</p>
                ) : null}
              </div>

              {!isInventory ? (
                <>
                  <Label htmlFor="s-phone" className={cn(fieldLabelClass, "md:col-start-2 md:row-start-1")}>
                    Teléfono
                  </Label>
                  <div className="group/field relative min-w-0 md:col-start-2 md:row-start-2">
                    <Phone
                      className={cn(
                        fieldIconClass,
                        errors.phone
                          ? "text-destructive"
                          : "text-muted-foreground group-focus-within/field:text-primary",
                      )}
                      aria-hidden
                    />
                    <Input
                      ref={phoneRef}
                      id="s-phone"
                      className={inputWithIconClass}
                      maxLength={LIM.phone}
                      value={phone}
                      onChange={(ev) => {
                        const next = sanitizePhoneInput(ev.target.value)
                        setPhone(next)
                        if (errors.phone) validate({ phone: next })
                      }}
                      onBlur={() => validate({ phone })}
                      placeholder="+58 412 0000000"
                      aria-invalid={Boolean(errors.phone)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="min-h-[1.125rem] md:col-start-2 md:row-start-3">
                    {errors.phone ? (
                      <p className="text-destructive text-xs leading-tight">{errors.phone}</p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-start gap-2 md:col-span-2">
              <Checkbox
                id="s-no-rif"
                checked={noRif}
                onCheckedChange={(v) => {
                  const next = v === true
                  setNoRif(next)
                  if (next) {
                    setRifDigits("")
                    validate({ noRif: true, rifDigits: "" })
                  } else {
                    validate({ noRif: false })
                  }
                }}
              />
              <Label htmlFor="s-no-rif" className="cursor-pointer text-sm font-normal leading-snug">
                Sin RIF (proveedor informal)
              </Label>
            </div>
          </div>

          {!isInventory ? (
            <div className="grid gap-2">
              <Label htmlFor="s-email" className={fieldLabelClass}>
                Correo
              </Label>
              <div className="group/field relative">
                <Mail
                  className={cn(
                    fieldIconClass,
                    errors.email
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Input
                  ref={emailRef}
                  id="s-email"
                  type="text"
                  inputMode="email"
                  className={inputWithIconClass}
                  maxLength={LIM.email}
                  value={email}
                  onChange={(ev) => {
                    const next = clampStr(ev.target.value, LIM.email)
                    setEmail(next)
                    if (errors.email) validate({ email: next })
                  }}
                  onBlur={() => validate({ email })}
                  placeholder="compras@proveedor.com"
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                />
              </div>
              {errors.email ? <p className="text-destructive text-xs">{errors.email}</p> : null}
            </div>
          ) : null}

          {!isInventory ? (
            <div className="grid gap-2">
              <Label htmlFor="s-address" className={fieldLabelClass}>
                Dirección (opcional)
              </Label>
              <div className="group/field relative">
                <MapPin
                  className={cn(
                    "pointer-events-none absolute left-3 top-3 h-4 w-4 transition-colors",
                    errors.address
                      ? "text-destructive"
                      : "text-muted-foreground group-focus-within/field:text-primary",
                  )}
                  aria-hidden
                />
                <Textarea
                  ref={addressRef}
                  id="s-address"
                  rows={4}
                  className="h-[7.5rem] min-h-[7.5rem] max-h-[7.5rem] resize-none overflow-y-auto pl-10 pt-2 md:text-sm"
                  maxLength={LIM.address}
                  value={address}
                  onChange={(ev) => {
                    const next = clampStr(ev.target.value, LIM.address)
                    setAddress(next)
                    if (errors.address) validate({ address: next })
                  }}
                  onBlur={() => validate({ address })}
                  autoComplete="street-address"
                  aria-invalid={Boolean(errors.address)}
                  placeholder="Ej. Av. Principal, edificio X, local 2"
                />
              </div>
              {errors.address ? <p className="text-destructive text-xs">{errors.address}</p> : null}
            </div>
          ) : null}

          <div className={catalogMasterFormActionsClass}>
            <Button type="button" variant="outline" className="border-primary/25" asChild>
              <Link to={returnTo}>Cancelar</Link>
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[12rem] shadow-sm">
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </div>
        </form>
      )}
    </CatalogPageShell>
  )
}
