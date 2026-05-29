"use client"

import { ArrowRight, ExternalLink, ScrollText } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { CLIENT_ORDER_MODULE_TITLE } from "@/pages/axones/client-order-i18n"
import type { ProgramacionPendingClientOrder } from "@/types/api"

type ProgramacionPendingClientOrderCardProps = {
  order: ProgramacionPendingClientOrder
}

function lineSummary(order: ProgramacionPendingClientOrder): string {
  const lines = order.lines ?? []
  if (lines.length === 0) {
    const p = order.first_line_with_product?.product?.name
    return p?.trim() ? p : "—"
  }
  const names = lines
    .map((l) => l.product?.name?.trim())
    .filter((n): n is string => Boolean(n))
  if (names.length === 0) return `${lines.length} línea${lines.length === 1 ? "" : "s"}`
  if (names.length === 1) return names[0]
  return `${names[0]} (+${names.length - 1} más)`
}

export function ProgramacionPendingClientOrderCard({
  order,
}: ProgramacionPendingClientOrderCardProps) {
  const createOtHref = `/ordenes-trabajo/nueva?client_order_id=${order.id}`

  return (
    <article className="rounded-xl border border-amber-200/80 bg-card p-4 shadow-sm transition-shadow hover:shadow-md border-l-[5px] border-l-amber-500">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-950">
          Pedido cliente
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <Link
          to={`/ordenes-cliente/${order.id}`}
          className="font-mono text-lg font-bold leading-tight text-primary hover:underline"
        >
          {order.code}
        </Link>
      </div>

      <dl className="space-y-2 text-base">
        <div>
          <dt className="text-muted-foreground text-sm font-medium">Cliente</dt>
          <dd className="font-semibold leading-snug">{order.client?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm font-medium">Producto / líneas</dt>
          <dd className="text-foreground/90 leading-snug">{lineSummary(order)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm font-medium">Estado</dt>
          <dd className="font-medium">Pendiente de OT</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" size="lg" className="h-11 w-full text-base font-semibold" asChild>
          <Link to={createOtHref}>
            Crear OT
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Link>
        </Button>
        <Button variant="outline" size="lg" className="h-11 w-full text-base" asChild>
          <Link to={`/ordenes-cliente/${order.id}`}>
            Ver {CLIENT_ORDER_MODULE_TITLE}
            <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs leading-relaxed">
        <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        Aprobado en comercial; falta generar la orden de trabajo de producción.
      </p>
    </article>
  )
}
