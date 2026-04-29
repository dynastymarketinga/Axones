"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ReturnDetail = {
  id: number
  work_order_id: number | null
  status: string
  quantity: string
  destination_area: string
  material_id: number
  material?: { sku: string; name: string; inventory_area?: string }
  work_order?: { code: string }
}

export default function BobinaRejectedRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnIdRaw = searchParams.get("devolucion_id") ?? searchParams.get("inventory_return_id") ?? ""
  const returnId = returnIdRaw ? Number(returnIdRaw) : NaN

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ReturnDetail | null>(null)
  const [code, setCode] = useState("")
  const [accepting, setAccepting] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(returnId) || returnId < 1) {
      setDetail(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const d = await apiFetch<ReturnDetail>(`inventory-returns/${returnId}`)
      setDetail(d)
      const suffix = `${d.id}-${Date.now().toString(36).toUpperCase()}`
      setCode((prev) => (prev.trim() ? prev : `REJ-${suffix}`))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la devolución.")
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [returnId])

  useEffect(() => {
    void load()
  }, [load])

  async function acceptReturn() {
    if (!detail) return
    setAccepting(true)
    try {
      await apiFetch(`inventory-returns/${detail.id}/accept`, { method: "POST" })
      toast.success("Devolución aceptada; el ingreso en kg ya quedó en inventario.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo aceptar la devolución.")
    } finally {
      setAccepting(false)
    }
  }

  async function registerBobina(ev: React.FormEvent) {
    ev.preventDefault()
    if (!detail) return
    const trimmed = code.trim()
    if (!trimmed) {
      toast.error("Indique un código único para la bobina.")
      return
    }
    setSaving(true)
    try {
      await apiFetch("bobinas", {
        method: "POST",
        body: JSON.stringify({
          material_id: detail.material_id,
          code: trimmed,
          weight_kg: Number(detail.quantity),
          status: "rejected",
          inventory_return_id: detail.id,
        }),
      })
      toast.success("Bobina rechazada registrada y vinculada a la devolución.")
      navigate("/bobinas", { replace: true })
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la bobina.")
    } finally {
      setSaving(false)
    }
  }

  if (!Number.isFinite(returnId) || returnId < 1) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-muted-foreground text-sm">
          Use un enlace con <code className="rounded bg-muted px-1">?devolucion_id=</code> desde la
          pantalla de devoluciones.
        </p>
        <Button type="button" variant="outline" asChild>
          <Link to="/devoluciones">Ir a devoluciones</Link>
        </Button>
      </div>
    )
  }

  const wrongArea =
    detail && detail.destination_area !== "bobinas_rechazadas"

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Registrar bobina rechazada
          </h1>
          <p className="text-muted-foreground text-sm">
            Debe existir una devolución aceptada hacia el área bobinas rechazadas, vinculada a una OT
            de impresión. El peso de la bobina debe coincidir con la cantidad de la devolución.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/devoluciones">Volver a devoluciones</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : !detail ? (
        <p className="text-muted-foreground text-sm">No se encontró la devolución.</p>
      ) : wrongArea ? (
        <p className="text-destructive text-sm">
          Esta devolución no es hacia <strong>bobinas_rechazadas</strong> (área actual:{" "}
          {detail.destination_area}). Cree o use otra devolución.
        </p>
      ) : (
        <div className="max-w-xl space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Devolución #</span> {detail.id}
            </p>
            <p>
              <span className="text-muted-foreground">Estado:</span> {detail.status}
            </p>
            <p>
              <span className="text-muted-foreground">OT:</span>{" "}
              {detail.work_order?.code ?? detail.work_order_id ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Material:</span>{" "}
              {detail.material ? `${detail.material.sku} · ${detail.material.name}` : `#${detail.material_id}`}
            </p>
            <p>
              <span className="text-muted-foreground">Cantidad (kg):</span> {detail.quantity}
            </p>
          </div>

          {detail.status === "pending" ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Primero acepte la devolución para ingresar el material al inventario; luego podrá
                registrar la bobina única rechazada.
              </p>
              <Button type="button" onClick={() => void acceptReturn()} disabled={accepting}>
                {accepting ? "Procesando…" : "Aceptar devolución"}
              </Button>
            </div>
          ) : detail.status === "accepted" ? (
            <form className="space-y-4" onSubmit={(ev) => void registerBobina(ev)}>
              <div className="grid gap-2">
                <Label htmlFor="rej-code">Código único de bobina *</Label>
                <Input
                  id="rej-code"
                  value={code}
                  onChange={(ev) => setCode(ev.target.value)}
                  maxLength={64}
                  placeholder="Ej: REJ-123-ABC"
                  disabled={saving}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Registrar bobina rechazada"}
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">Estado no admite registro desde aquí.</p>
          )}
        </div>
      )}
    </div>
  )
}
