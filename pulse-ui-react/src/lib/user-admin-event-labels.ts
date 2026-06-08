import { formatAxonesRoleLabel } from "@/lib/axones-role-labels"

export type UserAdminEventType =
  | "created"
  | "updated"
  | "activated"
  | "deactivated"
  | "password_changed_admin"
  | "password_changed_self"
  | "password_reset_resolved"

const EVENT_LABELS: Record<UserAdminEventType, string> = {
  created: "Cuenta creada",
  updated: "Datos actualizados",
  activated: "Cuenta activada",
  deactivated: "Cuenta desactivada",
  password_changed_admin: "Contraseña restablecida (admin)",
  password_changed_self: "Contraseña cambiada (usuario)",
  password_reset_resolved: "Solicitud de contraseña cerrada",
}

export function formatUserAdminEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType as UserAdminEventType] ?? eventType
}

type FieldChange = { from: unknown; to: unknown }

function formatFieldChange(field: string, change: FieldChange): string | null {
  if (field === "role") {
    return `Rol: ${formatAxonesRoleLabel(String(change.from))} → ${formatAxonesRoleLabel(String(change.to))}`
  }
  if (field === "active") {
    return change.to ? "Acceso activado" : "Acceso desactivado"
  }
  const labels: Record<string, string> = {
    name: "Nombre",
    email: "Correo",
    username: "Usuario",
  }
  const label = labels[field] ?? field
  return `${label}: ${String(change.from ?? "—")} → ${String(change.to ?? "—")}`
}

export function formatUserAdminEventDetail(
  eventType: string,
  metadata: Record<string, unknown> | null | undefined,
): string {
  const changes = metadata?.changes as Record<string, FieldChange> | undefined
  if (changes && typeof changes === "object") {
    const parts = Object.entries(changes)
      .map(([field, change]) => formatFieldChange(field, change))
      .filter((part): part is string => part !== null)
    if (parts.length > 0) return parts.join("; ")
  }

  if (eventType === "created" && metadata?.role) {
    return `Rol: ${formatAxonesRoleLabel(String(metadata.role))}`
  }

  if (eventType === "password_changed_self") return "El usuario cambió su contraseña"
  if (eventType === "password_changed_admin") return "Contraseña asignada por administrador"
  if (eventType === "password_reset_resolved") return "Solicitud de restablecimiento atendida"

  return "—"
}

export function formatUserAdminActorName(
  actor: { name: string; username?: string | null } | null | undefined,
): string {
  if (!actor) return "Sistema"
  return actor.username ? `${actor.name} (${actor.username})` : actor.name
}

export function formatUserAdminTargetName(
  target: { name: string; username?: string | null } | null | undefined,
): string {
  if (!target) return "—"
  return target.username ? `${target.name} (${target.username})` : target.name
}
