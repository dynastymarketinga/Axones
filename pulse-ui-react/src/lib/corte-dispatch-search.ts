/** Fila de GET corte-dispatch/available (campos usados en búsqueda). */
export type CorteDispatchSearchRow = {
  corte_bobina_usage_id?: number
  work_order_id?: number
  work_order_code?: string
  client_name?: string
  product_id?: number
  product_name?: string
  product_cpe?: string
  material_sku?: string
  quantity_finished_kg?: string | number
  quantity_dispatched_kg?: string | number
  quantity_remaining_kg?: string | number
  pallet_code?: string
  pallet_label?: string
  paleta_id?: string
  rollos_kg?: string[]
  rollos_count?: number
  is_provisional?: boolean
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function readString(v: unknown): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

function kgSearchTokens(value: string | number | undefined): string[] {
  const raw = readString(value).trim()
  if (!raw) return []
  const n = Number(raw.replace(",", "."))
  const tokens = [raw]
  if (Number.isFinite(n)) {
    tokens.push(String(n))
    tokens.push(
      n.toLocaleString("es-DO", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    )
  }
  return tokens
}

/** Texto indexable de una fila (todas las columnas visibles de la tabla). */
export function corteDispatchRowSearchHaystack(row: CorteDispatchSearchRow): string {
  const woCode = readString(row.work_order_code)
  const woId = row.work_order_id
  const parts: string[] = [
    woCode,
    woId != null ? String(woId) : "",
    woId != null ? `OT-${woId}` : "",
    readString(row.client_name),
    readString(row.product_name),
    readString(row.product_cpe),
    readString(row.material_sku),
    row.product_id != null ? String(row.product_id) : "",
    readString(row.pallet_label),
    readString(row.pallet_code),
    readString(row.paleta_id),
    row.rollos_count != null ? String(row.rollos_count) : "",
    row.is_provisional ? "provisional cierre en corte" : "cerrada definitiva",
    ...kgSearchTokens(row.quantity_finished_kg),
    ...kgSearchTokens(row.quantity_dispatched_kg),
    ...kgSearchTokens(row.quantity_remaining_kg),
  ]

  if (Array.isArray(row.rollos_kg)) {
    for (const cell of row.rollos_kg) {
      const s = readString(cell).trim()
      if (s && Number(s) > 0) parts.push(s)
    }
  }

  return normalizeSearchText(parts.filter(Boolean).join(" "))
}

export function corteDispatchRowMatchesSearch(
  row: CorteDispatchSearchRow,
  query: string,
): boolean {
  const q = normalizeSearchText(query)
  if (!q) return true
  return corteDispatchRowSearchHaystack(row).includes(q)
}
