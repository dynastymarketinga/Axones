/**
 * Colores por área de inventario alineados con MaterialFormPage (border-l-* / fondos).
 * Usado en listado Materiales (pestañas + filas) y triggers del formulario nuevo/editar.
 */

export type MaterialsListAreaTab =
  | "all"
  | "material"
  | "tintas"
  | "quimicos"
  | "miscelaneos"

/** Tabs del formulario material (no coincide 1:1 con inventory_area API). */
export type MaterialFormTab = "sustratos" | "tintas" | "quimicos" | "miscelaneo"

export type MaterialAreaTheme = {
  /** Classes for TabsTrigger on materials list (override default active style). */
  tabTriggerClass: string
  /** Background / hover for table row or cells. */
  rowClass: string
}

const DEFAULT_THEME: MaterialAreaTheme = {
  tabTriggerClass:
    "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border",
  rowClass: "bg-muted/20 hover:bg-muted/35",
}

const THEMES: Record<string, MaterialAreaTheme> = {
  material: {
    tabTriggerClass:
      "data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-950 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/60",
    rowClass: "bg-emerald-50/80 hover:bg-emerald-100/60",
  },
  tintas: {
    tabTriggerClass:
      "data-[state=active]:bg-blue-100 data-[state=active]:text-blue-950 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-blue-500/60",
    rowClass: "bg-blue-50/80 hover:bg-blue-100/60",
  },
  cementerio_tintas: {
    tabTriggerClass:
      "data-[state=active]:bg-sky-100 data-[state=active]:text-sky-950 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-sky-700/50",
    rowClass: "bg-sky-50/80 hover:bg-sky-100/55",
  },
  quimicos: {
    tabTriggerClass:
      "data-[state=active]:bg-amber-100 data-[state=active]:text-amber-950 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-amber-500/60",
    rowClass: "bg-amber-50/80 hover:bg-amber-100/60",
  },
  miscelaneos: {
    tabTriggerClass:
      "data-[state=active]:bg-violet-100 data-[state=active]:text-violet-950 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-violet-500/60",
    rowClass: "bg-violet-50/80 hover:bg-violet-100/60",
  },
  bobinas_rechazadas: {
    tabTriggerClass:
      "data-[state=active]:bg-orange-100 data-[state=active]:text-orange-950 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-orange-500/55",
    rowClass: "bg-orange-50/75 hover:bg-orange-100/55",
  },
}

export function getMaterialAreaTheme(inventoryArea: string): MaterialAreaTheme {
  return THEMES[inventoryArea] ?? DEFAULT_THEME
}

/** Pestaña del listado Materiales → tema visual (incluye «Todos»). */
export function getMaterialsListTabTheme(tab: MaterialsListAreaTab): MaterialAreaTheme {
  if (tab === "all") return DEFAULT_THEME
  return getMaterialAreaTheme(tab)
}

const FORM_TAB_THEME: Record<MaterialFormTab, MaterialAreaTheme> = {
  sustratos: getMaterialAreaTheme("material"),
  tintas: getMaterialAreaTheme("tintas"),
  quimicos: getMaterialAreaTheme("quimicos"),
  miscelaneo: getMaterialAreaTheme("miscelaneos"),
}

export function getMaterialFormTabTheme(tab: MaterialFormTab): MaterialAreaTheme {
  return FORM_TAB_THEME[tab]
}
