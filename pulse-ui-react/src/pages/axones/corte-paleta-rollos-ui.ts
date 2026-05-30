import { cn } from "@/lib/utils"

/** Contenedor de tarjetas de paleta por cuadro (2 / 3 / 4 columnas). */
export const CORTE_PALETAS_CONTAINER_GRID =
  "grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4"

export type CortePaletaTheme = {
  card: string
  header: string
  title: string
  rolloCell: string
  summaryInput: string
}

const CORTE_PALETA_THEMES: CortePaletaTheme[] = [
  {
    card: "border-sky-300/80 bg-gradient-to-br from-sky-100/95 via-sky-50/80 to-white shadow-lg shadow-sky-300/35 dark:border-sky-700/60 dark:from-sky-950/55 dark:via-sky-950/25 dark:to-background dark:shadow-sky-950/50",
    header: "border-sky-200/90 bg-sky-200/45 dark:border-sky-800/70 dark:bg-sky-900/40",
    title: "text-sky-950 dark:text-sky-50",
    rolloCell: "border-sky-200/80 bg-white/90 shadow-sm dark:border-sky-800/50 dark:bg-sky-950/35",
    summaryInput: "border-sky-200/70 bg-white/95 dark:border-sky-800/50 dark:bg-sky-950/40",
  },
  {
    card: "border-violet-300/80 bg-gradient-to-br from-violet-100/95 via-violet-50/80 to-white shadow-lg shadow-violet-300/35 dark:border-violet-700/60 dark:from-violet-950/55 dark:via-violet-950/25 dark:to-background dark:shadow-violet-950/50",
    header: "border-violet-200/90 bg-violet-200/45 dark:border-violet-800/70 dark:bg-violet-900/40",
    title: "text-violet-950 dark:text-violet-50",
    rolloCell: "border-violet-200/80 bg-white/90 shadow-sm dark:border-violet-800/50 dark:bg-violet-950/35",
    summaryInput: "border-violet-200/70 bg-white/95 dark:border-violet-800/50 dark:bg-violet-950/40",
  },
  {
    card: "border-amber-300/80 bg-gradient-to-br from-amber-100/95 via-amber-50/80 to-white shadow-lg shadow-amber-300/35 dark:border-amber-700/60 dark:from-amber-950/55 dark:via-amber-950/25 dark:to-background dark:shadow-amber-950/50",
    header: "border-amber-200/90 bg-amber-200/45 dark:border-amber-800/70 dark:bg-amber-900/40",
    title: "text-amber-950 dark:text-amber-50",
    rolloCell: "border-amber-200/80 bg-white/90 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/35",
    summaryInput: "border-amber-200/70 bg-white/95 dark:border-amber-800/50 dark:bg-amber-950/40",
  },
  {
    card: "border-rose-300/80 bg-gradient-to-br from-rose-100/95 via-rose-50/80 to-white shadow-lg shadow-rose-300/35 dark:border-rose-700/60 dark:from-rose-950/55 dark:via-rose-950/25 dark:to-background dark:shadow-rose-950/50",
    header: "border-rose-200/90 bg-rose-200/45 dark:border-rose-800/70 dark:bg-rose-900/40",
    title: "text-rose-950 dark:text-rose-50",
    rolloCell: "border-rose-200/80 bg-white/90 shadow-sm dark:border-rose-800/50 dark:bg-rose-950/35",
    summaryInput: "border-rose-200/70 bg-white/95 dark:border-rose-800/50 dark:bg-rose-950/40",
  },
  {
    card: "border-teal-300/80 bg-gradient-to-br from-teal-100/95 via-teal-50/80 to-white shadow-lg shadow-teal-300/35 dark:border-teal-700/60 dark:from-teal-950/55 dark:via-teal-950/25 dark:to-background dark:shadow-teal-950/50",
    header: "border-teal-200/90 bg-teal-200/45 dark:border-teal-800/70 dark:bg-teal-900/40",
    title: "text-teal-950 dark:text-teal-50",
    rolloCell: "border-teal-200/80 bg-white/90 shadow-sm dark:border-teal-800/50 dark:bg-teal-950/35",
    summaryInput: "border-teal-200/70 bg-white/95 dark:border-teal-800/50 dark:bg-teal-950/40",
  },
  {
    card: "border-indigo-300/80 bg-gradient-to-br from-indigo-100/95 via-indigo-50/80 to-white shadow-lg shadow-indigo-300/35 dark:border-indigo-700/60 dark:from-indigo-950/55 dark:via-indigo-950/25 dark:to-background dark:shadow-indigo-950/50",
    header: "border-indigo-200/90 bg-indigo-200/45 dark:border-indigo-800/70 dark:bg-indigo-900/40",
    title: "text-indigo-950 dark:text-indigo-50",
    rolloCell: "border-indigo-200/80 bg-white/90 shadow-sm dark:border-indigo-800/50 dark:bg-indigo-950/35",
    summaryInput: "border-indigo-200/70 bg-white/95 dark:border-indigo-800/50 dark:bg-indigo-950/40",
  },
  {
    card: "border-lime-300/80 bg-gradient-to-br from-lime-100/95 via-lime-50/80 to-white shadow-lg shadow-lime-300/35 dark:border-lime-700/60 dark:from-lime-950/55 dark:via-lime-950/25 dark:to-background dark:shadow-lime-950/50",
    header: "border-lime-200/90 bg-lime-200/45 dark:border-lime-800/70 dark:bg-lime-900/40",
    title: "text-lime-950 dark:text-lime-50",
    rolloCell: "border-lime-200/80 bg-white/90 shadow-sm dark:border-lime-800/50 dark:bg-lime-950/35",
    summaryInput: "border-lime-200/70 bg-white/95 dark:border-lime-800/50 dark:bg-lime-950/40",
  },
  {
    card: "border-fuchsia-300/80 bg-gradient-to-br from-fuchsia-100/95 via-fuchsia-50/80 to-white shadow-lg shadow-fuchsia-300/35 dark:border-fuchsia-700/60 dark:from-fuchsia-950/55 dark:via-fuchsia-950/25 dark:to-background dark:shadow-fuchsia-950/50",
    header: "border-fuchsia-200/90 bg-fuchsia-200/45 dark:border-fuchsia-800/70 dark:bg-fuchsia-900/40",
    title: "text-fuchsia-950 dark:text-fuchsia-50",
    rolloCell: "border-fuchsia-200/80 bg-white/90 shadow-sm dark:border-fuchsia-800/50 dark:bg-fuchsia-950/35",
    summaryInput: "border-fuchsia-200/70 bg-white/95 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/40",
  },
]

export function getCortePaletaTheme(paletaIdx: number): CortePaletaTheme {
  return CORTE_PALETA_THEMES[((paletaIdx % CORTE_PALETA_THEMES.length) + CORTE_PALETA_THEMES.length) % CORTE_PALETA_THEMES.length]!
}

export function cortePaletaCardClass(paletaIdx: number, closed?: boolean): string {
  const theme = getCortePaletaTheme(paletaIdx)
  return cn(
    "overflow-hidden rounded-xl border transition-shadow hover:shadow-xl",
    theme.card,
    closed && "ring-2 ring-emerald-500/45 ring-offset-1 ring-offset-background",
  )
}

export function cortePaletaRollosGridClass(compact?: boolean): string {
  return cn(
    "grid gap-2",
    compact
      ? "max-h-[18rem] grid-cols-4 overflow-y-auto sm:grid-cols-6"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  )
}

export function cortePaletaRolloCellClass(compact?: boolean, theme?: CortePaletaTheme): string {
  return cn(
    "space-y-1.5 rounded-md border p-2",
    compact ? "p-1.5" : "",
    theme?.rolloCell ?? "border-border/60 bg-muted/15",
  )
}

export function cortePaletaRolloNumberClass(compact?: boolean, theme?: CortePaletaTheme): string {
  return cn(
    "font-semibold tabular-nums",
    compact ? "text-[10px]" : "text-xs",
    theme?.title ?? "text-muted-foreground",
  )
}

export function cortePaletaRolloKgLabelClass(compact?: boolean): string {
  return cn("ot-label font-medium leading-none", compact ? "text-[10px]" : "text-[11px]")
}

export function cortePaletaRolloKgInputClass(compact?: boolean): string {
  return cn(
    "ot-input-unified w-full tabular-nums",
    compact ? "h-7 px-2 text-xs" : "h-9 px-2.5 text-sm",
  )
}
