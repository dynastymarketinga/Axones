/** Respuesta de GET work-orders/{id}/nota-entrega/prefill */

export type DeliveryNotePrefillLine = {
  pallet_position?: number
  pallet_code?: string | number
  bobbin_count?: number
  quantity_kg?: string | number
  corte_bobina_usage_id?: number
  work_order_id?: number
  product_id?: number | null
  description?: string | null
}

export type DeliveryNotePrefill = {
  work_order?: {
    id?: number
    code?: string
    document_number?: string | null
  }
  client?: {
    id?: number
    name?: string
    rif?: string | null
    address?: string | null
  } | null
  material_type_description?: string | null
  suggested_document_date?: string
  next_sequential_number?: number
  suggested_lines?: DeliveryNotePrefillLine[]
  totals_preview?: {
    total_bobbin_count?: number
    total_kg?: string | number
  }
  transport?: {
    driver_name?: string | null
    vehicle_notes?: string | null
  }
}

export function formatPrefillKg(value: string | number | undefined): string {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN
  if (!Number.isFinite(parsed)) return "0.000 kg"
  return `${parsed.toLocaleString("es-DO", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`
}
