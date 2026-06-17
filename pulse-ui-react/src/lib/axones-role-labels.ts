import { isAxonesFullAccess, normalizeRole } from "@/lib/axones-roles"

const ROLE_LABELS: Record<string, string> = {
  boss: "Jefe supremo",
  admin: "Administrador",
  superadmin: "Superadministrador",
  jefe_supremo: "Jefe supremo",
  jefe_operaciones: "Jefe de operaciones",
  inventory: "Inventario",
  inventario: "Inventario",
  inventory_chief: "Jefe de almacén",
  jefe_inventario: "Jefe de almacén",
  jefe_almacen: "Jefe de almacén",
  impresion: "Impresión",
  printing: "Impresión",
  laminacion: "Laminación",
  corte: "Corte",
  tintas: "Tintas",
  montaje: "Montaje",
  calidad: "Calidad",
  quality: "Calidad",
  planificador: "Planificador",
  supervisor: "Supervisor",
  vigilancia: "Vigilancia",
  gate: "Vigilancia",
  solicitante: "Solicitante",
  admin_area: "Administración",
  administracion: "Administración",
  general: "General",
}

/** Etiqueta legible en español para `users.role`. */
export function formatAxonesRoleLabel(role?: string | null): string {
  const key = normalizeRole(role)
  if (!key) return "Sin rol"
  return ROLE_LABELS[key] ?? role?.trim() ?? "Sin rol"
}

/** Frase corta bajo el badge de rol en Perfil. */
export function formatAxonesRoleHint(role?: string | null): string | null {
  if (isAxonesFullAccess(role)) return "Acceso completo al sistema"
  const key = normalizeRole(role)
  if (key === "inventory" || key === "inventario") {
    return "Gestión de inventario y maestros operativos"
  }
  if (key === "inventory_chief" || key === "jefe_inventario" || key === "jefe_almacen") {
    return "Inventario, compras y reportes de almacén"
  }
  if (key === "vigilancia" || key === "gate") return "Control de acceso en planta"
  if (key === "solicitante") return "Solicitudes de insumos entre áreas"
  if (["impresion", "printing", "laminacion", "corte", "tintas", "montaje"].includes(key)) {
    return "Operación en su área de producción"
  }
  if (key === "calidad" || key === "quality") return "Control de calidad y seguimiento"
  return null
}

/** Roles que un jefe puede asignar al crear/editar usuarios. */
export function getAssignableAxonesRoles(): { value: string; label: string }[] {
  return [
    { value: "boss", label: "Jefe supremo" },
    { value: "admin", label: "Administrador" },
    { value: "inventory_chief", label: "Jefe de almacén" },
    { value: "inventory", label: "Inventario" },
    { value: "impresion", label: "Impresión" },
    { value: "laminacion", label: "Laminación" },
    { value: "corte", label: "Corte" },
    { value: "tintas", label: "Tintas" },
    { value: "montaje", label: "Montaje" },
    { value: "calidad", label: "Calidad" },
    { value: "vigilancia", label: "Vigilancia" },
    { value: "solicitante", label: "Solicitante" },
  ]
}

/** Primera letra del primer nombre para avatar (p. ej. Valeria → V). */
export function getUserInitials(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/).filter(Boolean)[0]
  if (!first) return "?"
  return first[0]?.toUpperCase() ?? "?"
}
