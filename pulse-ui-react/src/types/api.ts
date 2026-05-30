/** Respuesta paginada típica de Laravel */
export type LaravelPaginated<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export type ClientRecord = {
  id: number
  name: string
  rif: string | null
  state: string | null
  city: string | null
  vendor_id?: number | null
  address: string | null
  email: string | null
  phone: string | null
  created_at?: string
  updated_at?: string
}

export type ProductRecord = {
  id: number
  client_id: number | null
  name: string
  barcode?: string | null
  cpe: string | null
  mps: string | null
  print_type: string | null
  structure: string | null
  client?: Pick<ClientRecord, "id" | "name"> | null
  created_at?: string
  updated_at?: string
}

export type SupplierRecord = {
  id: number
  name: string
  rif: string | null
  email: string | null
  phone: string | null
  address: string | null
  created_at?: string
  updated_at?: string
}

export type VendorRecord = {
  id: number
  name: string
  phone_primary?: string | null
  phone_secondary?: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

export type PurchaseOrderRow = {
  id: number
  supplier_id: number
  code: string
  status: string
  ordered_at: string | null
  created_at?: string | null
  notes: string | null
  tax_applies?: boolean
  is_active?: boolean
  supplier?: Pick<SupplierRecord, "id" | "name">
  lines_count?: number
  /** Cuando no es null, la OC fue cerrada manualmente por jefatura. */
  manually_closed_at?: string | null
  manually_closed_by?: number | null
  manual_close_reason?: string | null
  manuallyClosedBy?: { id: number; name: string } | null
}

/** PATCH /client-orders/:id: notes, status, lines, client_id (client_id con reglas: orden abierta, líneas y OT en API). */
export type ClientOrderRow = {
  id: number
  client_id: number
  code: string
  status: string
  notes: string | null
  /** En listado suele resumirse; en detalle el API devuelve el registro completo. */
  client?: ClientRecord | null
  lines_count?: number
  /** OT vinculadas no canceladas (listado OC). */
  active_work_orders_count?: number
  /** Primera línea con producto maestro (API Laravel) */
  first_line_with_product?: {
    id: number
    product_id: number
    product?: Pick<ProductRecord, "id" | "name" | "cpe" | "mps"> | null
  } | null
}

export type MaterialRow = {
  id: number
  sku: string
  /** Código interno autogenerado (uso técnico, no visible en UI). */
  internal_code?: string | null
  /** ID del usuario que creó el material (auditoría, no visible en UI). */
  created_by_user_id?: number | null
  name: string
  barcode?: string | null
  inventory_area: string
  micras?: string | null
  ancho?: string | null
  unit: string
  quantity_on_hand: string
  min_stock: string
  tinta_subareas?: Array<{ id: number; subarea: string }>
  substrate_products?: Array<Pick<ProductRecord, "id" | "name">>
  notes?: string | null
  supplier_id?: number | null
  no_supplier_reason?: string | null
  supplier?: Pick<SupplierRecord, "id" | "name"> | null
  created_at?: string
  updated_at?: string
}

/** Detalle completo de OT (GET /work-orders/:id) */
export type WorkOrderLineDetail = {
  id: number
  work_order_id?: number
  material_id: number
  quantity: string
  notes?: string | null
  material?: MaterialRow
}

export type WorkOrderProductionItemRow = {
  id: number
  position: number
  quantity: string
  quantity_unit: string
  product_description: string
  technical_specs?: string | null
}

export type ClientOrderLineDetail = {
  id: number
  product_id?: number | null
  material_id?: number | null
  quantity: string
  unit?: string
  description?: string | null
  notes?: string | null
  product?: Pick<ProductRecord, "id" | "name"> | null
  material?: Pick<MaterialRow, "id" | "sku" | "name"> | null
}

/** GET /client-orders/:id (detalle con líneas y OT vinculadas) */
export type ClientOrderWorkOrderRef = {
  id: number
  code: string
  status?: string
}

export type ClientOrderDetailRecord = ClientOrderRow & {
  lines: ClientOrderLineDetail[]
  workOrders?: ClientOrderWorkOrderRef[]
  ordered_at?: string | null
}

export type WorkOrderDetailRecord = {
  id: number
  code: string
  document_number?: string | null
  document_date?: string | null
  client_order_reference?: string | null
  winding_figure?: number | null
  notes?: string | null
  client_id?: number | null
  product_id?: number | null
  client_order_id?: number | null
  board_stage?: string
  status?: string
  client?: ClientRecord | null
  product?: ProductRecord | null
  client_order?: {
    id: number
    code: string
    ordered_at?: string | null
    notes?: string | null
    lines?: ClientOrderLineDetail[]
  } | null
  lines: WorkOrderLineDetail[]
  production_items?: WorkOrderProductionItemRow[]
  material_requests?: Array<{
    id: number
    status: string
    lines?: Array<{ id: number; quantity_requested: string; quantity_dispatched?: string }>
  }>
  technical_document?: {
    form?: Record<string, unknown> | null
  } | null
}

export type InventoryMovementRow = {
  id: number
  movement_type: string
  quantity: string
  occurred_at: string
  reference_type: string | null
  reference_id: number | null
  is_invalid_reference?: boolean
  reason?: string | null
  reason_scope?: string | null
  is_manual_adjustment?: boolean
  metadata?: Record<string, unknown> | null
  material?: {
    sku: string
    name: string
    inventory_area: string
    unit: string
  }
  user?: { id: number; name: string; email: string }
}

export type MaterialRequestLinePreview = {
  id: number
  description?: string | null
  material?: { sku: string; name: string; unit: string } | null
}

export type MaterialRequestRow = {
  id: number
  work_order_id?: number | null
  status: string
  created_at: string
  work_order?: { code: string; client?: Pick<ClientRecord, "name"> }
  lines_count?: number
  /** Primeras líneas (listado) para mostrar materiales solicitados */
  lines?: MaterialRequestLinePreview[]
}

export type DashboardSummary = {
  generated_at: string
  month_label?: string
  corte_production_month_kg?: string
  scrap_month_kg?: string
  scrap_month_by_area_kg?: {
    printing: string
    laminacion: string
    corte: string
  }
  /** Últimas OT finalizadas: desperdicio por área (kg) cuando el área está finalizada. */
  recent_finalized_ot_scrap?: Array<{
    work_order_id: number
    code: string
    label: string
    closure: "closed" | "closed_complete"
    areas_finalized: {
      montaje: boolean
      impresion: boolean
      laminacion: boolean
      corte: boolean
    }
    impresion_kg: string
    laminacion_kg: string
    corte_kg: string
    total_kg: string
  }>
  materials_total: number
  materials_by_area: Record<string, number>
  /** Bobinas rechazadas registradas en el mes (devolución a bobinas rechazadas). */
  rejected_returns_bobinas_month?: number
  inventory_returns_pending: number
  material_requests_pending: number
  /** Conteo por estado: pending | partial | dispatched | cancelled */
  material_requests_by_status: Record<string, number>
  work_orders_pending_programming: number
  work_orders_in_programming: number
  work_orders_pending_production: number
  operational_alerts_unread: number
  tinta_mixtures_total: number
  movements_today: number
  materials_low_stock: MaterialRow[]
}

export type WorkOrderListRow = {
  id: number
  code: string
  document_date?: string | null
  created_at?: string | null
  status: string
  board_stage?: string
  scheduling_status?: string
  priority?: string | null
  areaRequests?: Array<{
    id: number
    area: string
    status: string
    work_order_id: number
    created_at?: string
  }>
  technical_document?: { form: Record<string, unknown> } | null
  /** Resumen de segmentos de tiempo (bandeja corte/tintas). */
  area_time_summary?: {
    effective_seconds: number
    dead_seconds: number
    open_segment_type: string | null
    open_started_at: string | null
  } | null
  client?: Pick<ClientRecord, "id" | "name">
  product?: Pick<ProductRecord, "id" | "name">
  client_order?: { id: number; code?: string }
  creator?: Pick<UserRecord, "id" | "name" | "role"> | null
}

export type UserRecord = {
  id: number
  name: string
  role?: string | null
}

/** OC abiertas sin OT activa — columna Pendientes del tablero de programación. */
export type ProgramacionPendingClientOrder = ClientOrderRow & {
  lines?: ClientOrderLineDetail[]
}

export type ProgramacionBoardResponse = {
  columns: Record<string, WorkOrderListRow[]>
  pending_client_orders?: ProgramacionPendingClientOrder[]
}
