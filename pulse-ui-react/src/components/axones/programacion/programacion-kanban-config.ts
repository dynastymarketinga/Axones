import type { LucideIcon } from "lucide-react"
import {
  CheckCircle2,
  Hourglass,
  Inbox,
  Layers,
  Printer,
  Scissors,
  Wrench,
} from "lucide-react"

export type BoardStageKey =
  | "nueva"
  | "pendiente"
  | "montaje"
  | "impresion"
  | "laminacion"
  | "corte"
  | "completada"

export type KanbanColumnConfig = {
  stage: BoardStageKey
  title: string
  icon: LucideIcon
  /** Acento suave (punto + borde), no cabecera arcoíris */
  accentClass: string
  tabActiveClass: string
  /** Etapas núcleo de producción (Montaje → Corte) */
  isProductionCore: boolean
  /** Texto breve para el panel de la etapa */
  hint: string
}

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    stage: "nueva",
    title: "Por revisar",
    icon: Inbox,
    accentClass: "border-slate-400 bg-slate-500",
    tabActiveClass: "ring-slate-400/50 bg-slate-50 border-slate-300",
    isProductionCore: false,
    hint: "Órdenes nuevas que aún no entraron a programación.",
  },
  {
    stage: "pendiente",
    title: "Pendientes",
    icon: Hourglass,
    accentClass: "border-amber-500 bg-amber-500",
    tabActiveClass: "ring-amber-400/50 bg-amber-50 border-amber-300",
    isProductionCore: false,
    hint: "Confirmadas y en espera de pasar a planta.",
  },
  {
    stage: "montaje",
    title: "Montaje",
    icon: Wrench,
    accentClass: "border-slate-600 bg-slate-600",
    tabActiveClass: "ring-slate-500/50 bg-slate-100 border-slate-400",
    isProductionCore: true,
    hint: "Preparación de cilindros y montaje en máquina.",
  },
  {
    stage: "impresion",
    title: "Impresión",
    icon: Printer,
    accentClass: "border-violet-600 bg-violet-600",
    tabActiveClass: "ring-violet-400/50 bg-violet-50 border-violet-300",
    isProductionCore: true,
    hint: "Órdenes en línea de impresión.",
  },
  {
    stage: "laminacion",
    title: "Laminación",
    icon: Layers,
    accentClass: "border-blue-600 bg-blue-600",
    tabActiveClass: "ring-blue-400/50 bg-blue-50 border-blue-300",
    isProductionCore: true,
    hint: "Proceso de laminado y acabado intermedio.",
  },
  {
    stage: "corte",
    title: "Corte",
    icon: Scissors,
    accentClass: "border-orange-500 bg-orange-500",
    tabActiveClass: "ring-orange-400/50 bg-orange-50 border-orange-300",
    isProductionCore: true,
    hint: "Corte final y revisión antes de cerrar.",
  },
  {
    stage: "completada",
    title: "Completado",
    icon: CheckCircle2,
    accentClass: "border-emerald-600 bg-emerald-600",
    tabActiveClass: "ring-emerald-400/50 bg-emerald-50 border-emerald-300",
    isProductionCore: false,
    hint: "Órdenes finalizadas en producción.",
  },
]

export const PRODUCTION_CORE_STAGES: BoardStageKey[] = [
  "montaje",
  "impresion",
  "laminacion",
  "corte",
]

export const STAGE_OPTIONS: { value: BoardStageKey; label: string }[] = [
  { value: "nueva", label: "Pendiente por OT" },
  { value: "pendiente", label: "Programación" },
  { value: "montaje", label: "Montaje" },
  { value: "impresion", label: "Impresión" },
  { value: "laminacion", label: "Laminación" },
  { value: "corte", label: "Corte" },
  { value: "completada", label: "Completada" },
]

export function stageTitle(stage: string): string {
  return KANBAN_COLUMNS.find((c) => c.stage === stage)?.title ?? stage
}

export function priorityCardClass(priority: string | null | undefined): string {
  const p = (priority ?? "").toLowerCase().trim()
  if (p === "urgente") {
    return "border-l-red-600 bg-red-50/40"
  }
  if (p === "alta") {
    return "border-l-orange-500 bg-orange-50/40"
  }
  return "border-l-primary/40"
}

export const IN_PROGRESS_STAGES: BoardStageKey[] = [...PRODUCTION_CORE_STAGES]
