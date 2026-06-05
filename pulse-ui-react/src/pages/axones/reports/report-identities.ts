import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardList,
  FlaskConical,
  PackageOpen,
  Warehouse,
} from "lucide-react"

export type ReportIdentityKey =
  | "inventario"
  | "produccion-tiempos"
  | "resumen-produccion"
  | "consumibles"
  | "resumen-ot"
  | "desperdicio"
  | "material-ot"

export type ReportFiltersTheme = {
  panelClass: string
  headerClass: string
  iconClass: string
  badgeClass: string
  chipBorderClass: string
  bannerBorderClass: string
}

export type ReportIdentity = {
  key: ReportIdentityKey
  badge: string
  icon: LucideIcon
  headline: string
  shows: string[]
  notShows: string[]
  theme: ReportFiltersTheme
}

export const REPORT_IDENTITIES: Record<ReportIdentityKey, ReportIdentity> = {
  inventario: {
    key: "inventario",
    badge: "Almacén",
    icon: Warehouse,
    headline: "Movimientos de inventario y bobinas rechazadas en el período.",
    shows: [
      "Entradas, salidas y ajustes por día",
      "Consumo agregado por cliente y producto (movimientos)",
      "Bobinas rechazadas con motivo y peso",
    ],
    notShows: ["Kg de salida de planilla", "Tiempos de cronómetro", "Tintas original/solventada"],
    theme: {
      panelClass:
        "overflow-hidden rounded-2xl border border-sky-500/30 shadow-md bg-gradient-to-br from-sky-500/[0.08] via-card to-card ring-1 ring-sky-500/15 dark:from-sky-500/[0.14] dark:via-card/95 dark:to-card/90",
      headerClass: "border-b border-sky-500/20 bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent",
      iconClass: "bg-sky-600 text-white ring-sky-500/25",
      badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
      chipBorderClass: "border-sky-500/35 bg-sky-500/10",
      bannerBorderClass: "border-l-sky-600 bg-sky-500/[0.04]",
    },
  },
  "produccion-tiempos": {
    key: "produccion-tiempos",
    badge: "Cronómetros",
    icon: Activity,
    headline: "Tiempos efectivos, muertos y de montaje por área y por OT.",
    shows: [
      "Montaje, Impresión, Laminación y Corte (cronómetro)",
      "Modo pantalla en tiempo real (turnos abiertos)",
      "Export PDF/Excel del resumen de planta",
    ],
    notShows: ["Kilogramos de material", "Desperdicio por sustrato", "Despachos de inventario"],
    theme: {
      panelClass:
        "overflow-hidden rounded-2xl border border-teal-500/30 shadow-md bg-gradient-to-br from-teal-500/[0.08] via-card to-card ring-1 ring-teal-500/15 dark:from-teal-500/[0.14] dark:via-card/95 dark:to-card/90",
      headerClass: "border-b border-teal-500/20 bg-gradient-to-r from-teal-500/15 via-teal-500/5 to-transparent",
      iconClass: "bg-teal-600 text-white ring-teal-500/25",
      badgeClass: "border-teal-500/30 bg-teal-500/10 text-teal-800 dark:text-teal-200",
      chipBorderClass: "border-teal-500/35 bg-teal-500/10",
      bannerBorderClass: "border-l-teal-600 bg-teal-500/[0.04]",
    },
  },
  "resumen-produccion": {
    key: "resumen-produccion",
    badge: "Salida Kg",
    icon: BarChart3,
    headline:
      "Material producido (Salida Kg en planilla): bobinas impresas, laminadas y rollos cortados — con referencia o sustrato.",
    shows: [
      "Kg impreso, laminado y cortado por OT",
      "Desglose por referencia de bobina, sustrato de planilla o producto (corte)",
      "Totales de planta filtrados por período y cliente",
      "Descarga CSV con resumen, materiales y detalle por OT",
    ],
    notShows: ["Tintas ni químicos", "Tiempos de producción", "Movimientos de almacén"],
    theme: {
      panelClass:
        "overflow-hidden rounded-2xl border border-emerald-500/30 shadow-md bg-gradient-to-br from-emerald-500/[0.08] via-card to-card ring-1 ring-emerald-500/15 dark:from-emerald-500/[0.14] dark:via-card/95 dark:to-card/90",
      headerClass:
        "border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconClass: "bg-emerald-600 text-white ring-emerald-500/25",
      badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
      chipBorderClass: "border-emerald-500/35 bg-emerald-500/10",
      bannerBorderClass: "border-l-emerald-600 bg-emerald-500/[0.04]",
    },
  },
  consumibles: {
    key: "consumibles",
    badge: "Insumos",
    icon: FlaskConical,
    headline: "Tintas, químicos de laminación y entradas de material virgen agregados.",
    shows: [
      "Original, solventada, alcohol, metoxil y NPA (todas las OTs)",
      "Sobra y consumo de adhesivo, catalizador y acetato",
      "Entrada en impresión y virgen en laminación",
    ],
    notShows: ["Kg de salida producida", "Tiempos", "Ficha detallada de una sola OT"],
    theme: {
      panelClass:
        "overflow-hidden rounded-2xl border border-violet-500/30 shadow-md bg-gradient-to-br from-violet-500/[0.08] via-card to-card ring-1 ring-violet-500/15 dark:from-violet-500/[0.14] dark:via-card/95 dark:to-card/90",
      headerClass:
        "border-b border-violet-500/20 bg-gradient-to-r from-violet-500/15 via-violet-500/5 to-transparent",
      iconClass: "bg-violet-600 text-white ring-violet-500/25",
      badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200",
      chipBorderClass: "border-violet-500/35 bg-violet-500/10",
      bannerBorderClass: "border-l-violet-600 bg-violet-500/[0.04]",
    },
  },
  "resumen-ot": {
    key: "resumen-ot",
    badge: "Ficha OT",
    icon: ClipboardList,
    headline: "Resumen completo de una orden: material, desperdicio, tintas y tiempos.",
    shows: [
      "Material virgen, listo y merma de la OT",
      "Tintas, químicos y montaje",
      "Tiempos de impresión, laminación y corte",
    ],
    notShows: ["Todas las OTs del mes juntas", "Movimientos de inventario por SKU", "Análisis por sustrato BOPP/PE"],
    theme: {
      panelClass:
        "overflow-hidden rounded-2xl border border-amber-500/35 shadow-md bg-gradient-to-br from-amber-500/[0.09] via-card to-card ring-1 ring-amber-500/15 dark:from-amber-500/[0.14] dark:via-card/95 dark:to-card/90",
      headerClass:
        "border-b border-amber-500/25 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent",
      iconClass: "bg-amber-600 text-white ring-amber-500/25",
      badgeClass: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      chipBorderClass: "border-amber-500/40 bg-amber-500/10",
      bannerBorderClass: "border-l-amber-600 bg-amber-500/[0.05]",
    },
  },
  desperdicio: {
    key: "desperdicio",
    badge: "Merma",
    icon: PackageOpen,
    headline: "Desperdicio en kilogramos por tipo de film, área y orden de trabajo.",
    shows: [
      "Pestañas BOPP, Polietileno y Transparente",
      "Vistas por OT, por áreas e historial Kg",
      "Resumen mensual descargable",
    ],
    notShows: ["Material producido (salida)", "Consumo de tintas", "Tiempos de planta"],
    theme: {
      panelClass:
        "overflow-hidden rounded-2xl border border-rose-500/30 shadow-md bg-gradient-to-br from-rose-500/[0.08] via-card to-card ring-1 ring-rose-500/15 dark:from-rose-500/[0.14] dark:via-card/95 dark:to-card/90",
      headerClass: "border-b border-rose-500/20 bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent",
      iconClass: "bg-rose-600 text-white ring-rose-500/25",
      badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200",
      chipBorderClass: "border-rose-500/35 bg-rose-500/10",
      bannerBorderClass: "border-l-rose-600 bg-rose-500/[0.04]",
    },
  },
  "material-ot": {
    key: "material-ot",
    badge: "Trazabilidad",
    icon: Boxes,
    headline: "Despachos, usos de bobina y devoluciones de inventario vinculados a una OT.",
    shows: [
      "Materiales despachados por solicitud",
      "Usos de bobina en impresión, laminación y corte",
      "Devoluciones registradas en almacén",
    ],
    notShows: ["Totales de planilla (entrada/salida Kg)", "Tiempos ni tintas del módulo Tintas", "Merma por sustrato"],
    theme: {
      panelClass:
        "overflow-hidden rounded-2xl border border-orange-500/35 shadow-md bg-gradient-to-br from-orange-500/[0.09] via-card to-card ring-1 ring-orange-500/15 dark:from-orange-500/[0.14] dark:via-card/95 dark:to-card/90",
      headerClass:
        "border-b border-orange-500/25 bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent",
      iconClass: "bg-orange-600 text-white ring-orange-500/25",
      badgeClass: "border-orange-500/35 bg-orange-500/10 text-orange-900 dark:text-orange-100",
      chipBorderClass: "border-orange-500/40 bg-orange-500/10",
      bannerBorderClass: "border-l-orange-600 bg-orange-500/[0.05]",
    },
  },
}
