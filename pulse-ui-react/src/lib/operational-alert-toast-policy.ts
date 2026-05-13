/** Área de campana según rol (alineado con backend OperationalAlert). */
export function userTargetAreaFromRole(role?: string | null): string | null {
  const r = (role ?? "").toLowerCase().trim()
  if (r === "printing" || r === "impresion") return "impresion"
  if (r === "laminacion") return "laminacion"
  if (r === "corte") return "corte"
  if (r === "tintas") return "tintas"
  if (r === "montaje") return "montaje"
  if (
    r === "inventory" ||
    r === "inventario" ||
    r === "inventory_chief" ||
    r === "jefe_inventario" ||
    r === "jefe_almacen"
  ) {
    return "inventario"
  }
  return null
}

function isFullAlertRole(role?: string | null): boolean {
  const r = (role ?? "").toLowerCase().trim()
  return ["boss", "admin", "jefe_supremo", "superadmin", "jefe_operaciones"].includes(r)
}

/**
 * Si debe mostrarse toast en vivo para esta alerta según rol del usuario.
 */
export function shouldPlayOperationalToast(
  role: string | undefined,
  metadata?: Record<string, unknown> | null,
): boolean {
  if (isFullAlertRole(role)) return true
  const ta =
    typeof metadata?.target_area === "string"
      ? metadata.target_area
      : null
  const mine = userTargetAreaFromRole(role)
  if (mine && ta && ta === mine) return true
  if (!ta) return true
  return false
}
