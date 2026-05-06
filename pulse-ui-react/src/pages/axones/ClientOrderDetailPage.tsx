"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Pencil, Ban, ArrowLeft } from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientOrderDetailRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  clientOrderStatusBadgeClass,
  clientOrderStatusLabel,
  CLIENT_ORDER_MODULE_TITLE,
} from "@/pages/axones/client-order-i18n"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function ClientOrderDetailPage() {
  const { coId } = useParams<{ coId: string }>()
  const orderId = coId && /^\d+$/.test(coId) ? Number(coId) : NaN

  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<ClientOrderDetailRecord | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId < 1) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await apiFetch<ClientOrderDetailRecord>(`client-orders/${orderId}`)
      setRow(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la orden de producción (Pedido del cliente).")
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  async function executeCancelOrder() {
    if (!row || row.status !== "open") return
    setCancelling(true)
    try {
      await apiFetch<ClientOrderDetailRecord>(`client-orders/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      })
      toast.success("Orden anulada.")
      setCancelDialogOpen(false)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo anular la orden.")
    } finally {
      setCancelling(false)
    }
  }

  if (!Number.isFinite(orderId) || orderId < 1) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <p className="text-destructive text-sm">Identificador no válido.</p>
        <Button variant="outline" asChild>
          <Link to="/ordenes-cliente">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <p className="text-muted-foreground text-sm">No se encontró la orden.</p>
        <Button variant="outline" asChild>
          <Link to="/ordenes-cliente">Volver al listado</Link>
        </Button>
      </div>
    )
  }

  const wos = row.workOrders ?? []

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{CLIENT_ORDER_MODULE_TITLE}</h1>
          <p className="mt-1 font-mono text-sm text-foreground">{row.code}</p>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Solicitud comercial. La producción vive en{" "}
            <Link
              to="/ordenes-trabajo"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              órdenes de trabajo
            </Link>{" "}
            vinculadas a esta referencia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/ordenes-cliente">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Listado
            </Link>
          </Button>
          <Button
            className="bg-sky-100 text-sky-900 hover:bg-sky-200 border border-sky-300 shadow-none"
            size="sm"
            asChild
          >
            <Link
              to={`/ordenes-trabajo?tab=lista&prefillCo=${row.id}`}
              title="Abre Órdenes de trabajo con esta OC para crear la planilla de producción"
            >
              Nueva OT (producción)
            </Link>
          </Button>
          {row.status === "open" ? (
            <>
              <Button
                className="bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 shadow-none"
                size="sm"
                asChild
              >
                <Link to={`/ordenes-cliente/${row.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
              <Button
                className="bg-red-100 text-red-900 hover:bg-red-200 border border-red-300 shadow-none"
                size="sm"
                disabled={cancelling}
                onClick={() => setCancelDialogOpen(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                {cancelling ? "Anulando…" : "Anular"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Estado</span>
        <Badge
          variant="outline"
          className={cn("font-medium border", clientOrderStatusBadgeClass(row.status))}
        >
          {clientOrderStatusLabel(row.status)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Cliente: <span className="text-foreground font-medium">{row.client?.name ?? `#${row.client_id}`}</span>
        </span>
      </div>

      {row.notes ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{row.notes}</CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-2 text-base font-semibold">Líneas de la solicitud</h2>
        <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto / material / texto</TableHead>
                <TableHead className="text-right w-32">Cantidad</TableHead>
                <TableHead className="w-24">Unidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!row.lines?.length ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Sin líneas.
                  </TableCell>
                </TableRow>
              ) : (
                row.lines.map((ln) => {
                  const label =
                    ln.product?.name ||
                    (ln.material ? `${ln.material.sku} — ${ln.material.name}` : null) ||
                    ln.description ||
                    "—"
                  return (
                    <TableRow key={ln.id}>
                      <TableCell className="text-sm">{label}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{ln.quantity}</TableCell>
                      <TableCell className="text-sm">{ln.unit ?? "—"}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Órdenes de trabajo vinculadas</h2>
        <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código OT</TableHead>
                <TableHead>Abrir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground text-sm">
                    Aún no hay OT vinculada a esta orden de producción (Pedido del cliente).
                  </TableCell>
                </TableRow>
              ) : (
                wos.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-sm">{w.code}</TableCell>
                    <TableCell>
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link to={`/ordenes-trabajo/${w.id}/produccion`}>Ver producción</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
                ¿Anular esta orden de producción (Pedido del cliente)?
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="px-6 py-4 text-sm leading-relaxed text-muted-foreground">
            La orden quedará en estado <span className="font-medium text-foreground">Anulada</span>. Puede volver a este
            detalle para revisar el historial cuando lo necesite.
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
