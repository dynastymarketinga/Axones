/** Nombre visible del módulo OC (pedido comercial) — menú y cabeceras. */
export const CLIENT_ORDER_MODULE_TITLE = "Pedido cliente (OC)"

/** Fragmento para errores/toasts («No se pudieron cargar las …»). */
export const CLIENT_ORDER_MODULE_LIST_FOCUS = "órdenes OC cliente"

/** Pantalla crear OC (título de página). */
export const CLIENT_ORDER_MODULE_NEW_TITLE = "Nueva orden — pedido cliente"

/** Botón «Nueva» en listados (evita repetir el título largo de pantalla). */
export const CLIENT_ORDER_NEW_BUTTON_LABEL = "Nueva orden"

/** Validación campo Notas (formulario nueva OC). */
export const CLIENT_ORDER_NOTES_PLACEHOLDER =
  "Referencia interna, fecha de entrega deseada, contacto, etc."
export const CLIENT_ORDER_NOTES_REQUIRED_HELPER = "Las notas son obligatorias."
export const CLIENT_ORDER_NOTES_REQUIRED_TOAST = `Notas: ${CLIENT_ORDER_NOTES_REQUIRED_HELPER}`

/** Fecha comercial del pedido (`client_orders.ordered_at`). */
export const CLIENT_ORDER_ORDERED_AT_LABEL = "Fecha del pedido"
export const CLIENT_ORDER_ORDERED_AT_HELPER =
  "Fecha de negocio del pedido (puede diferir del día en que se registra en el sistema). Por defecto es hoy."

/** Línea opcional: material de inventario (`client_order_lines.material_id`). */
export const CLIENT_ORDER_LINE_MATERIAL_LABEL = "Material (opcional)"
export const CLIENT_ORDER_LINE_MATERIAL_PLACEHOLDER = "Seleccione material…"
export const CLIENT_ORDER_LINE_MATERIAL_SEARCH_PLACEHOLDER = "Buscar por SKU o nombre…"
export const CLIENT_ORDER_LINE_MATERIAL_EMPTY = "Sin material"

/** Descripción por línea (`client_order_lines.description`). */
export const CLIENT_ORDER_LINE_DESCRIPTION_LABEL = "Descripción línea (opcional)"
export const CLIENT_ORDER_LINE_DESCRIPTION_PLACEHOLDER =
  "Observación de esta línea (no modifica la ficha del producto)."

export const CLIENT_ORDER_CONFIRM_ORDERED_AT_LABEL = "Fecha del pedido"

/** Validación líneas (formulario nueva OC). */
export const CLIENT_ORDER_LINE_PRODUCT_REQUIRED_HELPER = "Seleccione un producto."
export const CLIENT_ORDER_LINE_NO_PRODUCT_TOAST =
  "Líneas: Agregue al menos una línea con producto seleccionado."

export const CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER = "Indique una cantidad mayor a cero."
export const CLIENT_ORDER_LINE_QUANTITY_TOAST =
  "Líneas: Cada línea con producto debe tener una cantidad a solicitar mayor a cero."
/** Toast al salir del campo cantidad (evitar duplicar el mensaje largo del submit). */
export const CLIENT_ORDER_LINE_QUANTITY_BLUR_TOAST =
  `Cantidad: ${CLIENT_ORDER_LINE_QUANTITY_REQUIRED_HELPER}`

export const CLIENT_ORDER_LINE_INVALID_PRODUCT_HELPER =
  "El producto no corresponde al cliente seleccionado."
export const CLIENT_ORDER_LINE_INVALID_PRODUCT_TOAST =
  "Líneas: Hay productos que no pertenecen al cliente seleccionado. Revise las líneas."

/** Pantalla editar OC. */
export const CLIENT_ORDER_MODULE_EDIT_TITLE = "Editar pedido cliente (OC)"

/** Ayuda bajo el estado en pantalla editar (orden abierta). */
export const CLIENT_ORDER_EDIT_HEADER_HINT =
  "Ajuste las notas y las líneas (productos del cliente elegido). Si cambia de cliente con «Reemplazar cliente», elija productos válidos para ese cliente en cada línea. Solo en orden abierta; no puede haber OT activas vinculadas."

/** Subtítulo bloque cliente en editar OC. */
export const CLIENT_ORDER_EDIT_CLIENT_SECTION_HELPER =
  "El cliente actual puede cambiarse con «Reemplazar cliente»; los cambios se aplican al pulsar «Guardar cambios». Si cambia de cliente, revise las líneas y sustituya cada producto por uno del nuevo cliente."

/** Bloque líneas en editar OC. */
export const CLIENT_ORDER_EDIT_LINES_SECTION_TITLE = "Líneas de la solicitud"
export const CLIENT_ORDER_EDIT_LINES_HELPER =
  "Cada línea debe tener al menos un producto del cliente, un material de inventario o una descripción, y una cantidad válida. Puede combinar producto con material (p. ej. sustrato previsto)."

/** Obsoleto: antes se bloqueaba la edición de líneas mixtas; la pantalla ahora admite todas las líneas. */
export const CLIENT_ORDER_EDIT_NON_PRODUCT_LINES_WARNING =
  "Esta orden incluye líneas que no son solo producto. Revise material y descripción por línea antes de guardar."

/** Solo orden abierta: mensaje al intentar guardar cuando la orden no está editable. */
export const CLIENT_ORDER_EDIT_ONLY_OPEN_TOAST =
  "Solo puede editar esta orden cuando está «Abierta»."

export const CLIENT_ORDER_REPLACE_CLIENT_BUTTON = "Reemplazar cliente"

export const CLIENT_ORDER_CREATE_CLIENT_LINK = "Crear cliente"

export const CLIENT_ORDER_REPLACE_DIALOG_TITLE = "Reemplazar cliente del pedido"

export const CLIENT_ORDER_REPLACE_DIALOG_DESCRIPTION =
  "Seleccione el cliente que quedará asignado a esta orden. Luego sustituya los productos en «Líneas de la solicitud» por referencias válidas para ese cliente. Pulse «Guardar cambios» para persistir notas, cliente y líneas."

export const CLIENT_ORDER_REPLACE_DIALOG_CONFIRM = "Usar este cliente"

export const CLIENT_ORDER_REPLACE_SEARCH_PLACEHOLDER = "Buscar cliente por nombre o RIF…"

export const CLIENT_ORDER_REPLACE_EMPTY = "No hay clientes que coincidan."

/** Diálogo anular (listado, detalle, edición). */
export const CLIENT_ORDER_CANCEL_DIALOG_TITLE = "¿Anular este pedido cliente (OC)?"

/** Toasts y estados de carga en detalle/edición. */
export const CLIENT_ORDER_TOAST_LOAD_FAILED = "No se pudo cargar el pedido cliente (OC)."
export const CLIENT_ORDER_TOAST_UPDATED = "Pedido cliente (OC) actualizado."
export const CLIENT_ORDER_TOAST_SAVE_FAILED = "No se pudo guardar el pedido cliente (OC)."
export const CLIENT_ORDER_LOADING_LABEL = "Cargando pedido cliente (OC)…"
export const CLIENT_ORDER_DETAIL_NO_OT_LINK =
  "Aún no hay OT vinculada a este pedido cliente (OC)."

/** Etiquetas en pantalla para estados almacenados en inglés en la API. */
export const CLIENT_ORDER_STATUS_ES: Record<string, string> = {
  open: "Abierta",
  fulfilled: "Cumplida",
  cancelled: "Anulada",
}

export function clientOrderStatusLabel(status: string): string {
  return CLIENT_ORDER_STATUS_ES[status] ?? status
}

/** Badge cuando la OC está abierta y aún no tiene OT de producción. */
export const CLIENT_ORDER_AWAITING_OT_BADGE = "Pendiente de OT"

export function clientOrderAwaitingProductionOt(row: {
  status: string
  active_work_orders_count?: number
}): boolean {
  if (row.status !== "open") return false
  return (row.active_work_orders_count ?? 0) === 0
}

export function clientOrderAwaitingOtBadgeClass(): string {
  return "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-100"
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
