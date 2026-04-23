"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, VendorRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [rif, setRif] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")
  const [address, setAddress] = useState("")
  const [vendorId, setVendorId] = useState<string>("none")
  const [vendorName, setVendorName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [vendors, setVendors] = useState<VendorRecord[]>([])

  const [errors, setErrors] = useState<{
    name?: string
    rif?: string
    phone?: string
    email?: string
  }>({})

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/axones/clientes"
  }, [location.state])

  const normalizeRif = useCallback((value: string): string => {
    const raw = value.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw) return ""
    const compact = raw.replace(/-/g, "")
    // A123456789 -> A-12345678-9 (7 u 8 dígitos + dígito verificador)
    const m = compact.match(/^([JVEGPC])(\d{7,9})$/)
    if (!m) return raw
    const letter = m[1]
    const digits = m[2]
    if (digits.length < 8) return raw
    const main = digits.slice(0, digits.length - 1)
    const dv = digits.slice(-1)
    return `${letter}-${main}-${dv}`
  }, [])

  const validate = useCallback(
    (draft?: {
      name?: string
      rif?: string
      phone?: string
      email?: string
    }) => {
      const n = (draft?.name ?? name).trim()
      const r = (draft?.rif ?? rif).trim()
      const p = (draft?.phone ?? phone).trim()
      const e = (draft?.email ?? email).trim()

      const next: typeof errors = {}
      if (!n) next.name = "El nombre es obligatorio."

      if (r) {
        const rr = normalizeRif(r)
        // Formatos aceptados: J-12345678-9 / V-12345678-9 / etc (7-9 dígitos totales)
        if (!/^[JVEGPC]-\d{7,8}-\d$/.test(rr)) {
          next.rif = "RIF inválido. Ej: J-12345678-9"
        }
      }

      if (p) {
        const compact = p.replace(/[^\d]/g, "")
        if (compact.length < 7) next.phone = "Teléfono inválido."
        else if (!/^[+\d()\-\s.]+$/.test(p)) next.phone = "Teléfono inválido."
      }

      if (e) {
        // validación simple (además del type=email)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) next.email = "Correo inválido."
      }

      setErrors(next)
      return next
    },
    [email, name, normalizeRif, phone, rif],
  )

  const load = useCallback(async () => {
    if (!isEdit || !clientId) return
    setLoading(true)
    try {
      const c = await apiFetch<ClientRecord>(`clients/${clientId}`)
      setName(c.name ?? "")
      setRif(c.rif ?? "")
      setState(c.state ?? "")
      setCity(c.city ?? "")
      setAddress(c.address ?? "")
      setVendorId(c.vendor_id ? String(c.vendor_id) : "none")
      setVendorName(c.vendor_name ?? "")
      setEmail(c.email ?? "")
      setPhone(c.phone ?? "")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el cliente.")
    } finally {
      setLoading(false)
    }
  }, [clientId, isEdit])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<VendorRecord>>("vendors", {
          query: { per_page: 200, page: 1, active: 1 },
        })
        if (!cancelled) setVendors(res.data)
      } catch {
        if (!cancelled) setVendors([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const v = validate()
    if (Object.keys(v).length) {
      toast.error("Revisa los campos marcados.")
      return
    }
    setSaving(true)
    try {
      const normalizedRif = normalizeRif(rif)
      const vid =
        vendorId !== "none" && vendorId !== "" ? Number(vendorId) : null
      const body = {
        name: name.trim(),
        rif: normalizedRif.trim() || null,
        state: state.trim() || null,
        city: city.trim() || null,
        vendor_id: vid,
        address: address.trim() || null,
        // Compatibilidad: seguir guardando vendor_name (por si algún reporte antiguo lo usa)
        vendor_name: vendorName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
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
        // volver al listado (con filtro/página), y opcionalmente refrescar visualmente el usuario
        if (created?.id) navigate(returnTo)
        else navigate(returnTo)
      }
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
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
            API <code className="text-xs">/clients</code>
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to={returnTo}>Volver al listado</Link>
        </Button>
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
              <Label htmlFor="c-name">Nombre *</Label>
              <Input
                id="c-name"
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
              <Label htmlFor="c-rif">RIF</Label>
              <Input
                id="c-rif"
                value={rif}
                onChange={(ev) => {
                  setRif(ev.target.value)
                  if (errors.rif) validate({ rif: ev.target.value })
                }}
                onBlur={() => {
                  const n = normalizeRif(rif)
                  if (n !== rif) setRif(n)
                  validate({ rif: n })
                }}
                placeholder="J-12345678-9"
                aria-invalid={Boolean(errors.rif)}
              />
              {errors.rif ? (
                <p className="text-destructive text-xs">{errors.rif}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="c-phone">Teléfono</Label>
              <Input
                id="c-phone"
                value={phone}
                onChange={(ev) => {
                  setPhone(ev.target.value)
                  if (errors.phone) validate({ phone: ev.target.value })
                }}
                onBlur={() => validate()}
                placeholder="+58 412 0000000"
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone ? (
                <p className="text-destructive text-xs">{errors.phone}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="c-state">Estado</Label>
              <Input
                id="c-state"
                value={state}
                onChange={(ev) => setState(ev.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="c-city">Ciudad</Label>
              <Input
                id="c-city"
                value={city}
                onChange={(ev) => setCity(ev.target.value)}
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="c-vendor">Vendedor</Label>
              <Select
                value={vendorId}
                onValueChange={(v) => {
                  setVendorId(v)
                  if (v === "none") {
                    setVendorName("")
                    return
                  }
                  const found = vendors.find((x) => String(x.id) === v)
                  if (found) setVendorName(found.name)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vendedor</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="c-email">Correo</Label>
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(ev) => {
                setEmail(ev.target.value)
                if (errors.email) validate({ email: ev.target.value })
              }}
              onBlur={() => validate()}
              placeholder="compras@cliente.com"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? (
              <p className="text-destructive text-xs">{errors.email}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="c-address">Dirección</Label>
            <Textarea
              id="c-address"
              rows={3}
              value={address}
              onChange={(ev) => setAddress(ev.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </form>
      )}
    </div>
  )
}
