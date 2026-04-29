"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Ban, UserPlus } from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientOrderDetailRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  clientOrderStatusBadgeClass,
  clientOrderStatusLabel,
} from "@/pages/axones/client-order-i18n"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function ClientOrderEditPage() {
  const { coId } = useParams<{ coId: string }>()
  const nav = useNavigate()
  const orderId = coId && /^\d+$/.test(coId) ? Number(coId) : NaN

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<ClientOrderDetailRecord | null>(null)
  const [orderCode, setOrderCode] = useState<string>("")
  const [orderStatus, setOrderStatus] = useState<string>("")
  const [notes, setNotes] = useState("")

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const isOpen = orderStatus === "open"
  const canEdit = orderStatus === "" || isOpen

  const load = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId < 1) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const co = await apiFetch<ClientOrderDetailRecord>(`client-orders/${orderId}`)
      setOrder(co)
      setOrderCode(co.code)
      setOrderStatus(co.status)
      setNotes(co.notes ?? "")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el pedido del cliente.")
      setOrderCode("")
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  async function executeCancelOrder() {
    if (!order || order.status !== "open") return
    setCancelling(true)
    try {
      await apiFetch<ClientOrderDetailRecord>(`client-orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      })
      toast.success("Orden anulada.")
      setCancelDialogOpen(false)
      nav(`/ordenes-cliente/${order.id}`)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo anular la orden.")
    } finally {
      setCancelling(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) {
      toast.error("Solo se pueden modificar las notas en estado «Abierta».")
      return
    }

    setSaving(true)
    try {
      await apiFetch<ClientOrderDetailRecord>(`client-orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          notes: notes.trim() || null,
        }),
      })
      toast.success("Pedido del cliente actualizado.")
      nav(`/ordenes-cliente/${orderId}`)
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message)
      else toast.error("No se pudo guardar el pedido del cliente.")
    } finally {
      setSaving(false)
    }
  }

  const newClientLink = {
    pathname: "/clientes/form" as const,
    state: { from: `/ordenes-cliente/${orderId}/edit` as const },
  }

  const client = order?.client

  if (!Number.isFinite(orderId) || orderId < 1) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-destructive text-sm">Identificador de orden no válido.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/ordenes-cliente">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">Cargando pedido del cliente…</p>
      </div>
    )
  }

  if (!orderCode) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">No se encontró la orden.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/ordenes-cliente">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Editar pedido del cliente</h1>
          <p className="text-foreground/90 mt-1 font-mono text-sm">{orderCode}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Estado</span>
            <Badge
              variant="outline"
              className={cn("font-medium border", clientOrderStatusBadgeClass(orderStatus))}
            >
              {clientOrderStatusLabel(orderStatus)}
            </Badge>
            {canEdit ? (
              <span className="text-muted-foreground">· Ajuste las notas; el cliente de la solicitud no cambia.</span>
            ) : (
              <span>· Solo lectura.</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          {isOpen ? (
            <Button
              type="button"
              variant="outline"
              className="border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
              size="sm"
              disabled={cancelling}
              onClick={() => setCancelDialogOpen(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Anular
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/ordenes-cliente/${orderId}`}>Ver detalle</Link>
          </Button>
          <Button type="button" variant="default" size="sm" asChild>
            <Link to="/ordenes-cliente">Volver al listado</Link>
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          Esta orden no está <strong>Abierta</strong>, por lo que no se permite editar notas. Use el detalle o el listado.
        </p>
      ) : null}

      <form
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <CardTitle className="text-base">Cliente</CardTitle>
              <Button type="button" variant="secondary" size="sm" asChild className="shrink-0 self-start" disabled={!canEdit}>
                <Link to={newClientLink.pathname} state={newClientLink.state}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Nuevo cliente
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Asignado a esta solicitud. No se modifica al guardar.</p>
          </CardHeader>
          <CardContent className="pt-0">
            {client ? (
              <div className="text-sm">
                <p className="text-base font-medium text-foreground">
                  {client.name}
                  {client.rif ? <span className="font-normal text-muted-foreground"> · {client.rif}</span> : null}
                </p>
                {client.city || client.state || client.address ? (
                  <p className="text-muted-foreground mt-1.5">
                    {[client.address, [client.city, client.state].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Cliente #{order?.client_id}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="co-notes" className="text-foreground">
            Notas <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="co-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="min-h-[120px] resize-y bg-background"
            placeholder="Referencia interna, fecha de entrega deseada, contacto, etc."
            disabled={!canEdit}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/80 pt-4">
          <Button type="submit" size="lg" disabled={saving || !canEdit} className="min-w-40">
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-cliente">Cancelar</Link>
          </Button>
        </div>
      </form>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent
          overlayClassName="z-[100] !bg-black/50 backdrop-blur-sm duration-200 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          className="z-[100] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:max-w-md"
        >
          <DialogHeader className="space-y-0 border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-6 py-5 pr-14 text-center sm:text-left">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:text-left">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive"
                aria-hidden
              >
                <Ban className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center sm:text-left sm:leading-tight">
                ¿Anular este pedido del cliente?
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="px-6 py-4 text-sm leading-relaxed text-muted-foreground">
            El pedido quedará en estado <span className="font-medium text-foreground">Anulada</span>. Será redirigido
            al detalle de la orden.
          </DialogDescription>
          <DialogFooter className="flex flex-row items-center justify-center border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-center">
            <Button
              type="button"
              variant="destructive"
              className="min-w-[12rem]"
              onClick={() => void executeCancelOrder()}
              disabled={cancelling}
            >
              {cancelling ? "Anulando…" : "Confirmar anulación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
