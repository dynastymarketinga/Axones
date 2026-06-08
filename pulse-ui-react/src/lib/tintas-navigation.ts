/** URL canónica MES para operar tintas en una OT (mismo patrón que corte/laminación). */
export function tintasWorkOrderProduccionUrl(workOrderId: number): string {
  return `/ordenes-trabajo/${workOrderId}/produccion?tab=tintas`
}
