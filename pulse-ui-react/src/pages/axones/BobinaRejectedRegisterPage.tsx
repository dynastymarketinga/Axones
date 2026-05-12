"use client"

import { useCallback, useEffect, useState } from "react"
import { Barcode, Link2, Package2, Scale } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import {
  AXONES_INVENTORY_FILTER_INPUT_CLASS,
  AXONES_INVENTORY_PAGE_CLASS,
  AxonesPageHeader,
} from "@/components/axones/inventory-page-layout"
import { PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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

function MissingReturnIdView() {
  const navigate = useNavigate()
  const [manualId, setManualId] = useState("")

  function continueWithId() {
    const n = Number(manualId.replace(/\D/g, ""))
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Indique un ID de devolución numérico (ej. 5).")
      return
    }
    navigate(`/bobinas/registrar-rechazada?devolucion_id=${n}`, { replace: true })
  }

  return (
    <div className={AXONES_INVENTORY_PAGE_CLASS}>
      <AxonesPageHeader
        title="Registrar bobina rechazada"
        description="Vincule una devolución aceptada hacia bobinas rechazadas. Si entró sin parámetro, elija el flujo abajo o pegue el ID."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" asChild>
              <Link to="/bobinas">Listado de bobinas</Link>
            </Button>
            <Button type="button" asChild>
              <Link to="/devoluciones">Ir a devoluciones</Link>
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border-l-4 border-l-emerald-500 bg-emerald-50/30 p-5 shadow-sm">
          <h2 className="mb-3 text-center text-lg font-extrabold tracking-wide text-emerald-900">
            Cómo llegar aquí
          </h2>
          <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              Abra{" "}
              <Link className="font-medium text-primary underline" to="/devoluciones">
                Inventario → Devoluciones
              </Link>
              .
            </li>
            <li>
              Busque una devolución con destino <strong className="text-foreground">Bobinas rechazadas</strong>{" "}
              y use el botón <strong className="text-foreground">Bobina rechazada</strong> en la fila (abre esta
              pantalla con el id correcto).
            </li>
            <li>
              También puede usar un enlace manual:{" "}
              <code className="rounded bg-background/90 px-2 py-0.5 text-xs">
                /bobinas/registrar-rechazada?devolucion_id=
                <span className="text-emerald-800">12</span>
              </code>
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-muted-foreground mb-4 text-sm">
            Si ya conoce el número de la devolución, puede pegarlo aquí:
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="rej-manual-return-id">ID de devolución</Label>
              <div className="group/field relative">
                <Link2
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary"
                  aria-hidden
                />
                <Input
                  id="rej-manual-return-id"
                  inputMode="numeric"
                  placeholder="Ej: 12"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") continueWithId()
                  }}
                  className={cn("pl-10", AXONES_INVENTORY_FILTER_INPUT_CLASS)}
                />
              </div>
            </div>
            <Button type="button" className="shrink-0" onClick={() => void continueWithId()}>
              Continuar con este ID
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
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
    return <MissingReturnIdView />
  }

  const wrongArea = detail && detail.destination_area !== "bobinas_rechazadas"

  return (
    <div className={AXONES_INVENTORY_PAGE_CLASS}>
      <AxonesPageHeader
        title="Registrar bobina rechazada"
        description="Devolución aceptada hacia bobinas rechazadas y OT de impresión. El peso debe coincidir con la cantidad de la devolución."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/devoluciones">Volver a devoluciones</Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <PageLoadingBlock />
      ) : !detail ? (
        <div className="mx-auto max-w-xl rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No se encontró la devolución #{returnId}. Revise el id o vaya al listado.
          </p>
          <Button type="button" className="mt-4" variant="secondary" asChild>
            <Link to="/devoluciones">Ir a devoluciones</Link>
          </Button>
        </div>
      ) : wrongArea ? (
        <div className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <p className="text-destructive">
            Esta devolución no es hacia <strong>bobinas rechazadas</strong> (área actual:{" "}
            {detail.destination_area}). Elija otra devolución con destino correcto desde el listado.
          </p>
          <Button type="button" className="mt-4" variant="outline" asChild>
            <Link to="/devoluciones">Ir a devoluciones</Link>
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(ev) => void registerBobina(ev)}
          className="mx-auto max-w-5xl space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="rounded-xl border-l-4 border-l-emerald-500 bg-emerald-50/30 p-4">
            <h2 className="mb-4 text-center text-2xl font-extrabold tracking-wide text-emerald-900">
              BOBINAS RECHAZADAS
            </h2>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex gap-2 rounded-md bg-background/80 px-3 py-2">
                <span className="text-muted-foreground shrink-0">Devolución</span>
                <span className="font-mono font-medium">#{detail.id}</span>
              </div>
              <div className="flex gap-2 rounded-md bg-background/80 px-3 py-2">
                <span className="text-muted-foreground shrink-0">Estado</span>
                <span className="font-medium">{detail.status}</span>
              </div>
              <div className="flex gap-2 rounded-md bg-background/80 px-3 py-2 md:col-span-2">
                <span className="text-muted-foreground shrink-0">OT</span>
                <span>{detail.work_order?.code ?? detail.work_order_id ?? "—"}</span>
              </div>
              <div className="flex gap-2 rounded-md bg-background/80 px-3 py-2 md:col-span-2">
                <Package2 className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {detail.material ? `${detail.material.sku} · ${detail.material.name}` : `#${detail.material_id}`}
                </span>
              </div>
              <div className="flex gap-2 rounded-md bg-background/80 px-3 py-2 md:col-span-2">
                <Scale className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="text-muted-foreground">Cantidad (kg): </span>
                  {detail.quantity}
                </span>
              </div>
            </div>

            {detail.status === "pending" ? (
              <div className="mt-6 space-y-3 border-t border-emerald-900/10 pt-4">
                <p className="text-muted-foreground text-sm">
                  Acepte primero la devolución para aplicar el ingreso al inventario; después podrá fijar el
                  código de la bobina.
                </p>
                <Button type="button" onClick={() => void acceptReturn()} disabled={accepting}>
                  {accepting ? "Procesando…" : "Aceptar ingreso de la devolución"}
                </Button>
              </div>
            ) : detail.status === "accepted" ? (
              <div className="mt-6 space-y-4 border-t border-emerald-900/10 pt-4">
                <div className="grid gap-2 md:max-w-md">
                  <Label htmlFor="rej-code">Código único de bobina *</Label>
                  <div className="group/field relative">
                    <Barcode
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within/field:text-primary"
                      aria-hidden
                    />
                    <Input
                      id="rej-code"
                      value={code}
                      onChange={(ev) => setCode(ev.target.value)}
                      maxLength={64}
                      placeholder="REJ-…"
                      disabled={saving}
                      className={cn("pl-10", AXONES_INVENTORY_FILTER_INPUT_CLASS)}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Registrar bobina rechazada"}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground mt-6 border-t border-emerald-900/10 pt-4 text-sm">
                Este estado no permite registrar la bobina desde aquí.
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
