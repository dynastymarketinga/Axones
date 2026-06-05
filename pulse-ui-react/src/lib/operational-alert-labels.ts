/**
 * Etiquetas en español para tipos de alerta (el API guarda códigos técnicos en inglés).
 */
export const OPERATIONAL_ALERT_TYPE_LABEL_ES: Record<string, string> = {
  ot_material_shortage: "Falta de material en la OT",
  scrap_threshold_exceeded: "Desperdicio alto (≥ 5%)",
  material_low_stock: "Stock por debajo del mínimo",
  low_stock: "Stock por debajo del mínimo",
  material_request_pending_warehouse: "Insumos pendientes de despacho",
  inventory_return_pending: "Devolución pendiente de revisión",
  purchase_order_pending_receipt: "Orden de compra pendiente de recepción",
  mount_time_exceeded: "Tiempo de montaje excedido",
  downtime_exceeded: "Parada prolongada en producción",
  password_reset_requested: "Solicitud de cambio de contraseña",
}

/** Texto legible para personas; nunca muestra códigos con guiones bajos. */
export function operationalAlertTypeLabel(alertType?: string | null): string {
  const key = (alertType ?? "").toLowerCase().trim()
  if (!key) return "—"
  return OPERATIONAL_ALERT_TYPE_LABEL_ES[key] ?? "Otro aviso"
}
