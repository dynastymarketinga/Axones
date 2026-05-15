import {
  bootstrapCorteFormState,
  syncCorteFormMetrics,
} from "@/pages/axones/corte-turnos"

/** Aplica entrada (grid), salida (paletas) y normaliza turnos al cargar o guardar. */
export function withCorteAutoFields(form: Record<string, unknown>): Record<string, unknown> {
  return bootstrapCorteFormState({ ...form, ...syncCorteFormMetrics(form) })
}

export function syncCorteAutoFields(form: Record<string, unknown>): Record<string, unknown> {
  return syncCorteFormMetrics(form)
}
