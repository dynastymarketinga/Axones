import { Droplet, FlaskConical, Layers, Package, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type PurchaseItemTypeKey = "sustrato" | "tinta" | "quimico" | "otros"

export type PurchaseItemTypeMeta = {
  label: string
  icon: LucideIcon
  iconClass: string
  badgeClass: string
  rowClass: string
  selectTriggerClass: string
  rowNumberClass: string
}

export const PURCHASE_ITEM_TYPE_META: Record<PurchaseItemTypeKey, PurchaseItemTypeMeta> = {
  sustrato: {
    label: "Sustrato",
    icon: Layers,
    iconClass: "text-emerald-600",
    badgeClass: "border-emerald-500/40 bg-emerald-50/90 text-emerald-950",
    rowClass:
      "border-l-4 border-l-emerald-600 !bg-emerald-100/85 hover:!bg-emerald-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-emerald-500/40 bg-emerald-50/95 text-emerald-950 shadow-sm",
    rowNumberClass: "border-emerald-500/40 bg-emerald-200/70 text-emerald-900",
  },
  tinta: {
    label: "Tinta",
    icon: Droplet,
    iconClass: "text-violet-600",
    badgeClass: "border-violet-500/40 bg-violet-50/90 text-violet-950",
    rowClass:
      "border-l-4 border-l-violet-600 !bg-violet-100/85 hover:!bg-violet-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-violet-500/40 bg-violet-50/95 text-violet-950 shadow-sm",
    rowNumberClass: "border-violet-500/40 bg-violet-200/70 text-violet-900",
  },
  quimico: {
    label: "Químico",
    icon: FlaskConical,
    iconClass: "text-sky-600",
    badgeClass: "border-sky-500/40 bg-sky-50/90 text-sky-950",
    rowClass:
      "border-l-4 border-l-sky-600 !bg-sky-100/85 hover:!bg-sky-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-sky-500/40 bg-sky-50/95 text-sky-950 shadow-sm",
    rowNumberClass: "border-sky-500/40 bg-sky-200/70 text-sky-900",
  },
  otros: {
    label: "Misceláneo",
    icon: Package,
    iconClass: "text-amber-600",
    badgeClass: "border-amber-500/40 bg-amber-50/90 text-amber-950",
    rowClass:
      "border-l-4 border-l-amber-600 !bg-amber-100/85 hover:!bg-amber-100/95 [&>td]:bg-transparent",
    selectTriggerClass: "border-amber-500/40 bg-amber-50/95 text-amber-950 shadow-sm",
    rowNumberClass: "border-amber-500/40 bg-amber-200/70 text-amber-900",
  },
}

export const PURCHASE_ITEM_TYPE_KEYS = Object.keys(
  PURCHASE_ITEM_TYPE_META,
) as PurchaseItemTypeKey[]

/** Etiquetas UI de recepción (histórico) → clave canónica. */
export function receiptUiLabelToItemTypeKey(label: string): PurchaseItemTypeKey {
  const t = label.trim()
  if (t === "Tinta") return "tinta"
  if (t === "Químico") return "quimico"
  if (t === "Misceláneo" || t === "Otros") return "otros"
  return "sustrato"
}

export function itemTypeKeyToReceiptUiLabel(key: PurchaseItemTypeKey): string {
  return PURCHASE_ITEM_TYPE_META[key].label
}

export function shouldShowDimsForItemType(key: PurchaseItemTypeKey): boolean {
  return key === "sustrato"
}

export function PurchaseItemTypeLabel({ typeKey }: { typeKey: PurchaseItemTypeKey }) {
  const meta = PURCHASE_ITEM_TYPE_META[typeKey]
  const Icon = meta.icon
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className={cn("size-4 shrink-0", meta.iconClass)} aria-hidden />
      <span className="truncate">{meta.label}</span>
    </span>
  )
}
