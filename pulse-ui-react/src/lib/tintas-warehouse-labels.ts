/** Marcadores alineados con backend TintasWarehouseRequestService. */
export const TINTAS_CONSUMPTION_NOTES_MARKER = "[Origen: consumo tintas OT]"
export const TINTAS_MIXTURE_NOTES_MARKER = "[Origen: mezcla tintas OT]"

export function tintasMaterialRequestOriginLabel(
  notes?: string | null,
  originatingArea?: string | null,
): string | null {
  const n = (notes ?? "").trim()
  if (n.startsWith(TINTAS_CONSUMPTION_NOTES_MARKER)) {
    return "Consumo tintas (OT)"
  }
  if (n.startsWith(TINTAS_MIXTURE_NOTES_MARKER)) {
    return "Mezcla tintas"
  }
  if ((originatingArea ?? "").toLowerCase().trim() === "tintas") {
    return "Tintas"
  }
  return null
}
