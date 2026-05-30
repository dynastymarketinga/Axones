"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { CortePaletaRolloCell } from "@/components/axones/CortePaletaRolloCell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  cortePaletaRolloKgInputClass,
  cortePaletaRolloKgLabelClass,
  cortePaletaRollosGridClass,
  type CortePaletaTheme,
} from "@/pages/axones/corte-paleta-rollos-ui"
import {
  clampCortePaletaRolloPage,
  cortePaletaRolloTotalPages,
  useCortePaletaRolloPageSize,
} from "@/pages/axones/use-corte-paleta-rollo-page-size"
import { COR_ROLLOS_PER_PALETA } from "@/pages/axones/corte-turnos"

type Props = {
  paletaIdx: number
  rollosKg: string[]
  theme: CortePaletaTheme
  inputsDisabled?: boolean
  onRolloChange: (rolloIdx: number, value: string) => void
  idFor: (suffix: string) => string
}

export function CortePaletaRollosPaginatedGrid({
  paletaIdx,
  rollosKg,
  theme,
  inputsDisabled = false,
  onRolloChange,
  idFor,
}: Props) {
  const rollPageSize = useCortePaletaRolloPageSize()
  const [rollPage, setRollPage] = useState(1)
  const rollTotalPages = cortePaletaRolloTotalPages(rollPageSize)

  useEffect(() => {
    setRollPage((p) => clampCortePaletaRolloPage(p, rollPageSize))
  }, [rollPageSize])

  const visibleRolloIndices = useMemo(() => {
    const start = (rollPage - 1) * rollPageSize
    const count = Math.min(rollPageSize, Math.max(0, COR_ROLLOS_PER_PALETA - start))
    return Array.from({ length: count }, (_, i) => start + i)
  }, [rollPage, rollPageSize])

  const rangeStart = (rollPage - 1) * rollPageSize + 1
  const rangeEnd = Math.min(rollPage * rollPageSize, COR_ROLLOS_PER_PALETA)
  const showPager = rollTotalPages > 1

  return (
    <div className="space-y-2">
      <div
        className={cortePaletaRollosGridClass()}
        role="group"
        aria-label={`Rollos ${rangeStart} a ${rangeEnd} de ${COR_ROLLOS_PER_PALETA}`}
      >
        {visibleRolloIndices.map((rolloIdx) => (
          <CortePaletaRolloCell key={`p-${paletaIdx}-r-${rolloIdx}`} rolloNumber={rolloIdx + 1} theme={theme}>
            <div>
              <Label htmlFor={idFor(`paleta-${paletaIdx}-rollo-${rolloIdx}`)} className={cortePaletaRolloKgLabelClass()}>
                Kg neto
              </Label>
              <Input
                id={idFor(`paleta-${paletaIdx}-rollo-${rolloIdx}`)}
                name={`corPaleta${paletaIdx + 1}RolloKg_${rolloIdx + 1}`}
                className={cortePaletaRolloKgInputClass()}
                inputMode="decimal"
                value={rollosKg[rolloIdx] ?? ""}
                disabled={inputsDisabled}
                onChange={(e) => onRolloChange(rolloIdx, e.target.value)}
                placeholder="0"
              />
            </div>
          </CortePaletaRolloCell>
        ))}
      </div>

      {showPager ? (
        <nav
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs shadow-sm",
            theme.header,
          )}
          aria-label={`Paginación rollos paleta ${paletaIdx + 1}`}
        >
          <span className={cn("tabular-nums", theme.title)}>
            Rollos {rangeStart}–{rangeEnd} de {COR_ROLLOS_PER_PALETA}
            <span className="text-muted-foreground font-normal">
              {" "}
              · pág. {rollPage}/{rollTotalPages}
            </span>
          </span>
          <div className="inline-flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={rollPage <= 1}
              onClick={() => setRollPage((p) => Math.max(1, p - 1))}
              aria-label="Rollos anteriores"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={rollPage >= rollTotalPages}
              onClick={() => setRollPage((p) => Math.min(rollTotalPages, p + 1))}
              aria-label="Rollos siguientes"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </nav>
      ) : (
        <p className={cn("text-center text-[11px] tabular-nums", theme.title)}>
          Rollos 1–{COR_ROLLOS_PER_PALETA}
        </p>
      )}
    </div>
  )
}
