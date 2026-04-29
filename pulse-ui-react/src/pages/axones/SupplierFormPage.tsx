"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { SupplierRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
  const [rif, setRif] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")

  const [errors, setErrors] = useState<{
    name?: string
    rif?: string
    phone?: string
    email?: string
  }>({})

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/proveedores"
  }, [location.state])

  const normalizeRif = useCallback((value: string): string => {
    const raw = value.trim().toUpperCase().replace(/\s+/g, "")
    if (!raw) return ""
    const compact = raw.replace(/-/g, "")
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
    (draft?: { name?: string; rif?: string; phone?: string; email?: string }) => {
      const n = (draft?.name ?? name).trim()
      const r = (draft?.rif ?? rif).trim()
      const p = (draft?.phone ?? phone).trim()
      const e = (draft?.email ?? email).trim()

      const next: typeof errors = {}
      if (!n) next.name = "El nombre es obligatorio."

      if (r) {
        const rr = normalizeRif(r)
        if (!/^[JVEGPC]-\d{7,8}-\d$/.test(rr)) next.rif = "RIF inválido. Ej: J-12345678-9"
      }

      if (p) {
        const compact = p.replace(/[^\d]/g, "")
        if (compact.length < 7) next.phone = "Teléfono inválido."
        else if (!/^[+\d()\-\s.]+$/.test(p)) next.phone = "Teléfono inválido."
      }

      if (e) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) next.email = "Correo inválido."
      }

      setErrors(next)
      return next
    },
    [email, name, normalizeRif, phone, rif],
  )

  const load = useCallback(async () => {
    if (!isEdit || !supplierId) return
    setLoading(true)
    try {
      const s = await apiFetch<SupplierRecord>(`suppliers/${supplierId}`)
      setName(s.name ?? "")
      setRif(s.rif ?? "")
      setEmail(s.email ?? "")
      setPhone(s.phone ?? "")
      setAddress(s.address ?? "")
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
      const body = {
        name: name.trim(),
        rif: normalizedRif.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      }
      if (isEdit && supplierId) {
        await apiFetch<SupplierRecord>(`suppliers/${supplierId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
        toast.success("Proveedor actualizado.")
        navigate(returnTo)
      } else {
        await apiFetch<SupplierRecord>("suppliers", {
          method: "POST",
          body: JSON.stringify(body),
        })
        toast.success("Proveedor creado.")
        navigate(returnTo)
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
            {isEdit ? "Editar proveedor" : "Nuevo proveedor"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete o actualice los datos del proveedor.
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
              <Label htmlFor="s-name">Nombre *</Label>
              <Input
                id="s-name"
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
              <Label htmlFor="s-rif">RIF</Label>
              <Input
                id="s-rif"
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
              <Label htmlFor="s-phone">Teléfono</Label>
              <Input
                id="s-phone"
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="s-email">Correo</Label>
            <Input
              id="s-email"
              type="email"
              value={email}
              onChange={(ev) => {
                setEmail(ev.target.value)
                if (errors.email) validate({ email: ev.target.value })
              }}
              onBlur={() => validate()}
              placeholder="compras@proveedor.com"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? (
              <p className="text-destructive text-xs">{errors.email}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="s-address">Dirección (opcional)</Label>
            <Textarea
              id="s-address"
              rows={3}
              value={address}
              onChange={(ev) => setAddress(ev.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </form>
      )}
    </div>
  )
}
