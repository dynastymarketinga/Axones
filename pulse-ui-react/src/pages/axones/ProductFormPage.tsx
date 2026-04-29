"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
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
  const [clientId, setClientId] = useState<string>("none")
  const [name, setName] = useState("")
  const [cpe, setCpe] = useState("")
  const [barcode, setBarcode] = useState("")
  const [mps, setMps] = useState("")
  const [printType, setPrintType] = useState("")
  const [structure, setStructure] = useState("")

  const [errors, setErrors] = useState<{ name?: string; barcode?: string }>({})

  const returnTo = useMemo(() => {
    const st = location.state as { from?: string } | null
    const from = st?.from?.trim()
    return from && from.startsWith("/") ? from : "/productos"
  }, [location.state])

  const validate = useCallback(
    (draft?: { name?: string; barcode?: string }) => {
      const n = (draft?.name ?? name).trim()
      const b = (draft?.barcode ?? barcode).trim()
      const next: typeof errors = {}
      if (!n) next.name = "El nombre es obligatorio."
      if (b && !/^[0-9A-Za-z\-_.]+$/.test(b)) {
        next.barcode = "Código de barra inválido."
      }
      setErrors(next)
      return next
    },
    [barcode, name],
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
      setBarcode(p.barcode ?? "")
      setMps(p.mps ?? "")
      setPrintType(p.print_type ?? "")
      setStructure(p.structure ?? "")
      setClientId(p.client_id ? String(p.client_id) : "none")
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
      toast.error("Revisa los campos marcados.")
      return
    }
    setSaving(true)
    try {
      const cid =
        clientId !== "none" && clientId !== "" ? Number(clientId) : null
      const body = {
        name: name.trim(),
        client_id: cid,
        cpe: cpe.trim() || null,
        barcode: barcode.trim() || null,
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
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Defina nombre, código y atributos del producto.
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
              <Label>Cliente (opcional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <p className="text-muted-foreground text-xs">
                Dato de registro / permiso que va en el envase plástico.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="p-barcode">Código de barra</Label>
              <Input
                id="p-barcode"
                value={barcode}
                onChange={(ev) => {
                  setBarcode(ev.target.value)
                  if (errors.barcode) validate({ barcode: ev.target.value })
                }}
                onBlur={() => validate()}
                aria-invalid={Boolean(errors.barcode)}
              />
              {errors.barcode ? (
                <p className="text-destructive text-xs">{errors.barcode}</p>
              ) : null}
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
              <Label htmlFor="p-print">Tipo de impresión</Label>
              <Input
                id="p-print"
                value={printType}
                onChange={(ev) => setPrintType(ev.target.value)}
              />
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
              <p className="text-muted-foreground text-xs">
                Composición de capas como en la OT; para trilaminado indique cada
                capa (se podrá ampliar en la orden con selección desde
                inventario).
              </p>
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </form>
      )}
    </div>
  )
}
