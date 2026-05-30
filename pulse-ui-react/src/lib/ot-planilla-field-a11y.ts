/** id/name estables para inputs de la planilla OT (autofill + label htmlFor). */
export function otPlanillaFieldId(field: string): string {
  return `ot-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

export function otPlanillaLabelId(field: string): string {
  return `ot-label-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

export function otPlanillaInputA11y(field: string): {
  id: string
  name: string
  "data-field": string
} {
  return { id: otPlanillaFieldId(field), name: field, "data-field": field }
}

export function otPlanillaComboboxA11y(field: string): {
  id: string
  "data-field": string
  "aria-labelledby": string
} {
  return {
    id: otPlanillaFieldId(field),
    "data-field": field,
    "aria-labelledby": otPlanillaLabelId(field),
  }
}

/** ids únicos por fila de sustrato (material + kg comparten data-field en validación). */
export function otPlanillaSustratoFieldId(
  scope: "Imp" | "Lam",
  idx: number,
  part: "material" | "kg",
): string {
  return `ot-sustratos${scope}-${idx}-${part}`
}
