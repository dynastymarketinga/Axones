/** Etiquetas en pantalla para estados almacenados en inglés en la API. */
export const CLIENT_ORDER_STATUS_ES: Record<string, string> = {
  open: "Abierta",
  fulfilled: "Cumplida",
  cancelled: "Anulada",
}

export function clientOrderStatusLabel(status: string): string {
  return CLIENT_ORDER_STATUS_ES[status] ?? status
}

/** Texto breve para ayudas (filtros, tooltips). */
export const CLIENT_ORDER_STATUS_HELP: Record<string, string> = {
  open:
    "La solicitud está activa: puede generar o vincular órdenes de producción (OT) mientras no esté anulada o cerrada comercialmente.",
  fulfilled:
    "El pedido se dio por cerrado o entregado en lo comercial; ya no se esperan más OT u operaciones vinculadas a esta solicitud.",
  cancelled:
    "Solicitud cancelada; no debe usarse para producción. Las OT ya vinculadas se revisan en su módulo.",
}

/**
 * Clases para Badges (estado visible en listado y detalle).
 * Orden: Abierta, Cumplida, Anulada.
 */
export function clientOrderStatusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100"
    case "fulfilled":
      return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-100"
    case "cancelled":
      return "bg-red-100 text-red-900 border-red-200 dark:bg-red-950/50 dark:text-red-100"
    default:
      return "bg-muted text-muted-foreground"
  }
}
