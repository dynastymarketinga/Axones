"use client"

import { Barcode, Package, Users } from "lucide-react"

import { CortePaletaRollosAccumulatedSummary } from "@/components/axones/CortePaletaRollosAccumulatedSummary"
import {
  countRollosWithKg,
  normalizeRollosKg,
  sumRollosKg,
} from "@/lib/delivery-note-paleta-utils"
import { formatDispatchKg } from "@/lib/dispatch-selection"
import { COR_ROLLOS_PER_PALETA } from "@/pages/axones/corte-turnos"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type DeliveryNotePaletaCardProps = {
  paletaLabel: string
  workOrderCode?: string
  clientName?: string
  productName?: string
  productCpe?: string
  rollosKg?: string[] | null
  quantityKg?: string | number
  included: boolean
  onIncludeChange: (checked: boolean) => void
  className?: string
}

export function DeliveryNotePaletaCard({
  paletaLabel,
  workOrderCode,
  clientName,
  productName,
  productCpe,
  rollosKg,
  quantityKg,
  included,
  onIncludeChange,
  className,
}: DeliveryNotePaletaCardProps) {
  const slots = normalizeRollosKg(rollosKg)
  const rollosCount = countRollosWithKg(slots)
  const totalFromRollos = sumRollosKg(slots)
  const totalKg =
    totalFromRollos > 0
      ? totalFromRollos
      : Number(typeof quantityKg === "string" ? quantityKg.replace(",", ".") : quantityKg) || 0

  return (
    <article
      className={cn(
        "rounded-lg border border-emerald-500/35 bg-emerald-500/[0.04]",
        !included && "opacity-75",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5">
        <div className="min-w-0 space-y-0.5">
          <strong className="text-sm">{paletaLabel}</strong>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {workOrderCode ? (
              <span className="inline-flex items-center gap-1">
                <Barcode className="h-3 w-3 shrink-0" aria-hidden />
                {workOrderCode}
              </span>
            ) : null}
            {clientName ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3 shrink-0" aria-hidden />
                {clientName}
              </span>
            ) : null}
            {productName ? (
              <span className="inline-flex items-center gap-1">
                <Package className="h-3 w-3 shrink-0" aria-hidden />
                {productName}
                {productCpe ? ` · ${productCpe}` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={included}
              onChange={(ev) => onIncludeChange(ev.target.checked)}
              className="h-4 w-4"
            />
            Incluir
          </label>
          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-950 hover:bg-emerald-500/15">
            En despacho
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            {rollosCount}/{COR_ROLLOS_PER_PALETA}
          </Badge>
        </div>
      </div>

      <div className="space-y-2 p-2">
        <div className="grid grid-cols-2 gap-1">
          <div>
            <Label className="ot-label text-sm font-medium">Rollos</Label>
            <Input className="ot-input-unified h-8" readOnly value={String(rollosCount)} />
          </div>
          <div>
            <Label className="ot-label text-sm font-medium">Total Kg</Label>
            <Input
              className="ot-input-unified h-8 font-semibold"
              readOnly
              value={totalKg.toFixed(2)}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Disponible para nota:{" "}
          <span className="font-medium text-foreground">{formatDispatchKg(totalKg)}</span>
        </p>
        <CortePaletaRollosAccumulatedSummary
          workOrderCode={workOrderCode}
          paletaLabel={paletaLabel}
          rollosKg={slots}
          totalKgHint={quantityKg}
        />
      </div>
    </article>
  )
}

