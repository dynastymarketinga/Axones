"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { VendorRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [active, setActive] = useState<string>("yes")
  const [errorName, setErrorName] = useState<string | null>(null)

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
      setName(v.name ?? "")
      setActive(v.active ? "yes" : "no")
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

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const n = name.trim()
    if (!n) {
      setErrorName("El nombre es obligatorio.")
      toast.error("Revisa los campos marcados.")
      return
    }
    setErrorName(null)

    setSaving(true)
    try {
      const body = {
        name: n,
        active: active === "yes",
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
            {isEdit ? "Editar vendedor" : "Nuevo vendedor"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete o actualice los datos del vendedor.
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
              <Label htmlFor="v-name">Nombre *</Label>
              <Input
                id="v-name"
                value={name}
                onChange={(ev) => {
                  setName(ev.target.value)
                  if (errorName) setErrorName(null)
                }}
                aria-invalid={Boolean(errorName)}
                placeholder="Ej: Vendedor 1"
                required
              />
              {errorName ? (
                <p className="text-destructive text-xs">{errorName}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Activo</Label>
              <Select value={active} onValueChange={setActive}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear vendedor"}
          </Button>
        </form>
      )}
    </div>
  )
}

