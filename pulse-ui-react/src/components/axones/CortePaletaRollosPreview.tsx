"use client"

import { CortePaletaRolloCell } from "@/components/axones/CortePaletaRolloCell"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  cortePaletaRolloKgInputClass,
  cortePaletaRolloKgLabelClass,
  cortePaletaRollosGridClass,
} from "@/pages/axones/corte-paleta-rollos-ui"
import { COR_ROLLOS_PER_PALETA } from "@/pages/axones/corte-turnos"

type Props = {
  rollosKg?: string[] | null
  /** Vista compacta para fila expandida en Despacho */
  compact?: boolean
  /** Inputs de solo lectura (como en Corte / nota de entrega). */
  useInputs?: boolean
  className?: string
}

function readDisplayKg(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 0 ? String(v) : "0"
  }
  if (typeof v === "string") {
    const s = v.trim()
    if (s === "") return "0"
    const n = Number(s.replace(",", "."))
    return Number.isFinite(n) && n > 0 ? s : "0"
  }
  return "0"
}

/** Grilla de rollos de paleta (solo lectura), alineada con la UI de Corte. */
export function CortePaletaRollosPreview({
  rollosKg,
  compact = false,
  useInputs = false,
  className,
}: Props) {
  const slots = Array.from({ length: COR_ROLLOS_PER_PALETA }, (_, i) =>
    readDisplayKg(rollosKg?.[i]),
  )

  return (
    <div
      className={cn(cortePaletaRollosGridClass(compact), className)}
      role="group"
      aria-label={`Rollos 1 a ${COR_ROLLOS_PER_PALETA} (solo lectura)`}
    >
      {slots.map((valor, rolloIdx) => (
        <CortePaletaRolloCell key={`rollo-preview-${rolloIdx}`} rolloNumber={rolloIdx + 1} compact={compact}>
          {useInputs ? (
            <div>
              <Label className={cortePaletaRolloKgLabelClass(compact)}>Kg neto</Label>
              <Input
                className={cortePaletaRolloKgInputClass(compact)}
                inputMode="decimal"
                readOnly
                disabled
                placeholder="0"
                value={valor === "0" || valor === "" ? "" : valor}
              />
            </div>
          ) : (
            <div>
              <span className={cortePaletaRolloKgLabelClass(compact)}>Kg neto</span>
              <div
                className={cn(
                  cortePaletaRolloKgInputClass(compact),
                  "flex items-center",
                  readDisplayKg(valor) !== "0"
                    ? "bg-muted/50 font-medium text-foreground"
                    : "text-muted-foreground",
                )}
                aria-readonly
              >
                {valor === "0" ? "" : valor}
              </div>
            </div>
          )}
        </CortePaletaRolloCell>
      ))}
    </div>
  )
}
