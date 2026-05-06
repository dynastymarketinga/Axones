"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, VendorRecord } from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import { isAxonesFullAccess, normalizeRole } from "@/lib/axones-roles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronsUpDown,
  Hash,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  UserRound,
} from "lucide-react"

const RIF_LETTERS = ["J", "V", "E", "G", "P", "C"] as const

const fieldLabelClass = "leading-snug"

const fieldIconClass =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"

const inputWithIconClass = "h-9 pl-10 leading-none md:text-sm"

/** Máx. dígitos (ITU-T E.164); el campo admite separadores dentro de `LIM.phone` caracteres. */
const PHONE_MAX_DIGITS = 15

/** Límites alineados con la API (clients). */
const LIM = {
  name: 255,
  state: 255,
  city: 255,
  address: 2000,
  email: 255,
  phone: 22,
} as const

function clampStr(s: string, max: number): string {
  return s.slice(0, max)
}

/** Teléfono: solo dígitos y separadores habituales; sin letras. */
function sanitizePhoneInput(raw: string): string {
  return raw.replace(/[^\d+().\-\s]/g, "").slice(0, LIM.phone)
}

function onlyDigits(s: string, maxLen: number): string {
  return s.replace(/\D/g, "").slice(0, maxLen)
}

/** Acepta pegados tipo 2818787-4, 12.345.678-9 o V-2818787-4 y deja solo dígitos (máx. 9) y letra si venía en el texto. */
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

/** Interpreta RIF guardado (con guiones o compacto) para letra + campo numérico. */
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

export default function ClientFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get("id")
  const clientId = idParam ? Number(idParam) : null
  const isEdit = Number.isFinite(clientId) && clientId! > 0

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [rifLetter, setRifLetter] = useState("")
  /** Dígitos del RIF en un solo campo: 8 + verificador (9), o legado 7 + verificador (8). */
  const [rifDigits, setRifDigits] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")
  const [vendors, setVendors] = useState<VendorRecord[]>([])
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [vendorOpen, setVendorOpen] = useState(false)
  const [address, setAddress] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const session = getStoredUser()
  const isInventory = (() => {
    const r = normalizeRole(session?.role)
    return r === "inventory" || r === "inventario"
  })()
  const isFullAccess = isAxonesFullAccess(session?.role, session?.id)

  const [errors, setErrors] = useState<{
    name?: string
    rif?: string
    phone?: string
    email?: string
    state?: string
    city?: string
    address?: string
  }>({})

  const nameRef = useRef<HTMLInputElement>(null)
  const rifLetterTriggerRef = useRef<HTMLButtonElement>(null)
  const rifDigitsRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const stateRef = useRef<HTMLInputElement>(null)
  const cityRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/clientes"
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
      state?: string
      city?: string
      address?: string
    }) => {
      const nRaw = draft?.name ?? name
      const n = nRaw.trim()
      const L = (draft?.rifLetter ?? rifLetter).trim().toUpperCase()
      const bodyRaw = draft?.rifDigits ?? rifDigits
      const d = onlyDigits(bodyRaw, 9)
      const p = (draft?.phone ?? phone).trim()
      const e = (draft?.email ?? email).trim()
      const st = (draft?.state ?? state).trim()
      const ci = (draft?.city ?? city).trim()
      const addr = (draft?.address ?? address).trim()

      const next: typeof errors = {}
      if (!n) next.name = "El nombre es obligatorio."
      else if (n.length > LIM.name) next.name = `Máximo ${LIM.name} caracteres.`

      if (st.length > LIM.state) next.state = `Máximo ${LIM.state} caracteres.`
      if (ci.length > LIM.city) next.city = `Máximo ${LIM.city} caracteres.`
      if (addr.length > LIM.address) next.address = `Máximo ${LIM.address} caracteres.`

      if (!L || !RIF_LETTERS.includes(L as (typeof RIF_LETTERS)[number])) {
        next.rif = "Elija la letra (J, V, E, G, P o C)."
      } else if (d.length === 0) {
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
        if (p.length > LIM.phone) next.phone = `Máximo ${LIM.phone} caracteres.`
        else if (/[a-zA-Z]/.test(p)) next.phone = "No use letras en el teléfono."
        else {
          const compact = p.replace(/[^\d]/g, "")
          if (compact.length < 7) next.phone = "Teléfono inválido: se requieren al menos 7 dígitos."
          else if (compact.length > PHONE_MAX_DIGITS)
            next.phone = `Teléfono inválido: máximo ${PHONE_MAX_DIGITS} dígitos.`
          else if (!/^[+\d()\-\s.]+$/.test(p)) next.phone = "Teléfono inválido: use dígitos y separadores habituales."
        }
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
    [address, city, email, name, normalizeRif, phone, rifDigits, rifLetter, state],
  )

  const load = useCallback(async () => {
    if (!isEdit || !clientId) return
    setLoading(true)
    try {
      const c = await apiFetch<ClientRecord>(`clients/${clientId}`)
      setName(clampStr(c.name ?? "", LIM.name))
      const parts = parseRifFromStored(c.rif)
      setRifLetter(parts.letter)
      setRifDigits(parts.main + parts.dv)
      setState(clampStr(c.state ?? "", LIM.state))
      setCity(clampStr(c.city ?? "", LIM.city))
      setVendorId(typeof c.vendor_id === "number" && c.vendor_id > 0 ? c.vendor_id : null)
      setAddress(clampStr(c.address ?? "", LIM.address))
      setEmail(clampStr(c.email ?? "", LIM.email))
      setPhone(sanitizePhoneInput(c.phone ?? ""))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el cliente.")
    } finally {
      setLoading(false)
    }
  }, [clientId, isEdit])

  const checkDuplicateClient = useCallback(
    async (field: "name" | "rif", value: string) => {
      const v = value.trim()
      if (!v) return
      try {
        const res = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { q: v, per_page: 20, page: 1 },
        })
        const list = res.data ?? []
        const matches = list.filter((c) => {
          if (clientId && c.id === clientId) return false
          if (field === "rif") return String(c.rif ?? "").trim().toUpperCase() === v.toUpperCase()
          return String(c.name ?? "").trim().toLowerCase() === v.toLowerCase()
        })
        if (matches.length) {
          setErrors((prev) => ({
            ...prev,
            [field]: field === "rif" ? "Este RIF ya existe." : "Este cliente ya existe (nombre).",
          }))
          toast.error(field === "rif" ? "Este RIF ya existe." : "Este cliente ya existe (nombre).")
        }
      } catch {
        // no bloquear por chequeo preventivo
      }
    },
    [clientId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isFullAccess) {
      setVendors([])
      setVendorId(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<VendorRecord>>("vendors", {
          query: { per_page: 300, page: 1, active: 1 },
        })
        if (!cancelled) setVendors(res.data ?? [])
      } catch {
        if (!cancelled) setVendors([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isFullAccess])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const v = validate()
    if (Object.keys(v).length) {
      toast.error("Revisa los campos marcados.")
      requestAnimationFrame(() => {
        if (v.name) {
          nameRef.current?.focus()
          return
        }
        if (v.rif) {
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
        if (v.state) {
          stateRef.current?.focus()
          return
        }
        if (v.city) {
          cityRef.current?.focus()
          return
        }
        if (v.address) addressRef.current?.focus()
      })
      return
    }
    setSaving(true)
    try {
      const normalizedRif = composeRifForSubmit().trim()
      const body: Record<string, unknown> = {
        name: name.trim(),
        rif: normalizedRif,
        address: address.trim() || null,
      }
      // En inventario ocultamos campos no relevantes y no los enviamos para no sobrescribir
      // datos existentes al editar (solo se ocultan, no se eliminan).
      if (!isInventory) {
        body.state = state.trim() || null
        body.city = city.trim() || null
        body.email = email.trim() || null
        body.phone = phone.trim() || null
      }
      if (isFullAccess) {
        body.vendor_id = vendorId ?? null
      }
      if (isEdit && clientId) {
        await apiFetch<ClientRecord>(`clients/${clientId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        toast.success("Cliente actualizado.")
        navigate(returnTo)
      } else {
        const created = await apiFetch<ClientRecord>("clients", {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Cliente creado.")
        if (created?.id) navigate(returnTo)
        else navigate(returnTo)
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
            {isEdit ? "Editar cliente" : "Nuevo cliente"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete o actualice los datos de contacto y facturación del cliente.
          </p>
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
              <Label htmlFor="c-name" className={fieldLabelClass}>
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
                  id="c-name"
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
                    void checkDuplicateClient("name", name)
                  }}
                  aria-invalid={Boolean(errors.name)}
                  autoComplete="organization"
                  placeholder="Ej. Distribuidora Los Andes C.A."
                />
              </div>
              {errors.name ? (
                <p className="text-destructive text-xs">{errors.name}</p>
              ) : null}
            </div>

            <div className="grid min-w-0 gap-2 gap-x-4 md:col-span-2 md:grid-cols-2 md:gap-y-2">
              <Label htmlFor="c-rif-digits" className={cn(fieldLabelClass, "md:col-start-1 md:row-start-1")}>
                RIF *
              </Label>
              <div
                className={cn(
                  "flex min-h-9 min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring md:col-start-1 md:row-start-2",
                  errors.rif && "border-destructive focus-within:ring-destructive",
                )}
              >
                <Select
                  value={rifLetter || "__clear"}
                  onValueChange={(v) => {
                    const L = v === "__clear" ? "" : v
                    setRifLetter(L)
                    if (errors.rif)
                      validate({
                        rifLetter: L,
                        rifDigits,
                      })
                  }}
                >
                    <SelectTrigger
                      ref={rifLetterTriggerRef}
                      aria-label="Letra del RIF"
                      className={cn(
                        "h-9 w-[3.25rem] shrink-0 self-stretch rounded-none border-0 border-r border-input bg-muted/50 px-2 shadow-none ring-offset-0 focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5",
                      )}
                      aria-invalid={Boolean(errors.rif)}
                    >
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear">—</SelectItem>
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
                      id="c-rif-digits"
                      className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent py-0 pl-9 pr-3 font-mono text-sm leading-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="2818787-4 o 123456789"
                    value={rifDigits}
                    onChange={(ev) => {
                      const { letter: nextL, digits: nextD } = looseRifNumberInput(ev.target.value, rifLetter)
                      if (nextL !== rifLetter) setRifLetter(nextL)
                      setRifDigits(nextD)
                      if (errors.rif)
                        validate({
                          rifLetter: nextL,
                          rifDigits: nextD,
                        })
                    }}
                    onBlur={() => {
                      const { letter: nextL, digits: nextD } = looseRifNumberInput(rifDigits, rifLetter)
                      if (nextL !== rifLetter) setRifLetter(nextL)
                      if (nextD !== rifDigits) setRifDigits(nextD)
                      validate({
                        rifLetter: nextL,
                        rifDigits: nextD,
                      })
                      const composed = normalizeRif(`${nextL}${nextD}`)
                      void checkDuplicateClient("rif", composed)
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
                  <Label htmlFor="c-phone" className={cn(fieldLabelClass, "md:col-start-2 md:row-start-1")}>
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
                      id="c-phone"
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

            {!isInventory ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="c-state" className={fieldLabelClass}>
                    Estado
                  </Label>
                  <div className="group/field relative">
                    <MapPinned
                      className={cn(fieldIconClass, "text-muted-foreground group-focus-within/field:text-primary")}
                      aria-hidden
                    />
                    <Input
                      ref={stateRef}
                      id="c-state"
                      className={inputWithIconClass}
                      maxLength={LIM.state}
                      value={state}
                      onChange={(ev) => {
                        const next = clampStr(ev.target.value, LIM.state)
                        setState(next)
                        if (errors.state) validate({ state: next })
                      }}
                      onBlur={() => validate({ state })}
                      autoComplete="address-level1"
                      aria-invalid={Boolean(errors.state)}
                      placeholder="Ej. Aragua"
                    />
                  </div>
                  {errors.state ? <p className="text-destructive text-xs">{errors.state}</p> : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="c-city" className={fieldLabelClass}>
                    Ciudad
                  </Label>
                  <div className="group/field relative">
                    <Building2
                      className={cn(fieldIconClass, "text-muted-foreground group-focus-within/field:text-primary")}
                      aria-hidden
                    />
                    <Input
                      ref={cityRef}
                      id="c-city"
                      className={inputWithIconClass}
                      maxLength={LIM.city}
                      value={city}
                      onChange={(ev) => {
                        const next = clampStr(ev.target.value, LIM.city)
                        setCity(next)
                        if (errors.city) validate({ city: next })
                      }}
                      onBlur={() => validate({ city })}
                      autoComplete="address-level2"
                      aria-invalid={Boolean(errors.city)}
                      placeholder="Ej. Turmero"
                    />
                  </div>
                  {errors.city ? <p className="text-destructive text-xs">{errors.city}</p> : null}
                </div>

                {isFullAccess ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label className={fieldLabelClass}>Vendedor</Label>
                    <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={vendorOpen}
                          className={cn("h-10 w-full justify-between font-normal", "border-primary/25 bg-background/90")}
                        >
                          <span className={cn("truncate text-left", !vendorId && "text-muted-foreground")}>
                            {vendorId
                              ? vendors.find((v) => v.id === vendorId)?.name ?? "Seleccione vendedor…"
                              : "Seleccione vendedor…"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
                        <Command shouldFilter>
                          <CommandInput placeholder="Buscar vendedor..." />
                          <CommandList className="max-h-60">
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  setVendorId(null)
                                  setVendorOpen(false)
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", vendorId == null ? "opacity-100" : "opacity-0")} aria-hidden />
                                <span>Sin vendedor</span>
                              </CommandItem>
                              {vendors.map((v) => (
                                <CommandItem
                                  key={v.id}
                                  value={`${v.name} ${v.phone_primary ?? v.phone_secondary ?? ""}`}
                                  onSelect={() => {
                                    setVendorId(v.id)
                                    setVendorOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      vendorId === v.id ? "opacity-100" : "opacity-0",
                                    )}
                                    aria-hidden
                                  />
                                  <span>{v.name}</span>
                                  {v.phone_primary || v.phone_secondary ? (
                                    <span className="text-muted-foreground ml-2 text-xs">
                                      {v.phone_primary ?? v.phone_secondary}
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
                ) : null}
              </>
            ) : null}
          </div>

          {!isInventory ? (
            <div className="grid gap-2">
              <Label htmlFor="c-email" className={fieldLabelClass}>
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
                  id="c-email"
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
                  placeholder="compras@cliente.com"
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                />
              </div>
              {errors.email ? (
                <p className="text-destructive text-xs">{errors.email}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="c-address" className={fieldLabelClass}>
              Dirección
            </Label>
            <div className="group/field relative">
              <MapPin
                className={cn(
                  "pointer-events-none absolute left-3 top-3 h-4 w-4 transition-colors",
                  "text-muted-foreground group-focus-within/field:text-primary",
                )}
                aria-hidden
              />
              <Textarea
                ref={addressRef}
                id="c-address"
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
            {errors.address ? (
              <p className="text-destructive text-xs">{errors.address}</p>
            ) : null}
          </div>

          <div className="flex justify-center pt-2">
            <Button type="submit" disabled={saving} className="min-w-[12rem]">
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
