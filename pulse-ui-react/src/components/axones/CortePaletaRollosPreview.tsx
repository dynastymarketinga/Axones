import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { COR_ROLLOS_PER_PALETA } from "@/pages/axones/corte-turnos"

type Props = {
  rollosKg?: string[] | null
  /** Vista compacta para fila expandida en Despacho */
  compact?: boolean
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
export function CortePaletaRollosPreview({ rollosKg, compact = false, className }: Props) {
  const slots = Array.from({ length: COR_ROLLOS_PER_PALETA }, (_, i) =>
    readDisplayKg(rollosKg?.[i]),
  )

  return (
    <div
      className={cn(
        "grid max-h-[22rem] grid-cols-8 gap-1 overflow-y-auto",
        compact && "max-h-[14rem]",
        className,
      )}
      role="group"
      aria-label={`Rollos 1 a ${COR_ROLLOS_PER_PALETA} (solo lectura)`}
    >
      {slots.map((valor, rolloIdx) => (
        <div key={`rollo-preview-${rolloIdx}`} className="space-y-1">
          <Label className="ot-label text-[10px]">{rolloIdx + 1}</Label>
          <div
            className={cn(
              "ot-input-unified flex h-7 items-center justify-center px-2 text-xs tabular-nums",
              compact && "h-6 text-[10px]",
              readDisplayKg(valor) !== "0"
                ? "bg-muted/50 font-medium text-foreground"
                : "text-muted-foreground",
            )}
            aria-readonly
          >
            {valor}
          </div>
        </div>
      ))}
    </div>
  )
}
