/** Valores de `App\Enums\InventoryArea` (backend) → etiqueta en UI. */
export function labelInventoryArea(area: string): string {
  const map: Record<string, string> = {
    material: "Material",
    tintas: "Tintas",
    cementerio_tintas: "Cementerio de tintas",
    quimicos: "Químicos",
    bobinas_rechazadas: "Bobinas rechazadas",
    miscelaneos: "Misceláneos",
  }
  return map[area] ?? area
}
