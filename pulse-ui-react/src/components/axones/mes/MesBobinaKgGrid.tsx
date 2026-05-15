import type { ReactNode } from "react"
import { ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { hasMeta, labelTooltipText } from "@/pages/axones/laminacion-turnos"
import type { BobinaLabelMeta } from "@/pages/axones/printing-turnos"

export type MesBobinaKgGridProps = {
  values: string[]
  meta: BobinaLabelMeta[]
  onChange: (idx: number, value: string) => void
  onOpenLabel: (idx: number) => void
  disabled?: boolean
  rowKeyPrefix: string
  labelButtonTitle?: (idx: number) => string
  footer?: ReactNode
}

export function MesBobinaKgGrid({
  values,
  meta,
  onChange,
  onOpenLabel,
  disabled = false,
  rowKeyPrefix,
  labelButtonTitle,
  footer,
}: MesBobinaKgGridProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-9">
        {values.map((val, idx) => (
          <div key={`${rowKeyPrefix}-${idx}`} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="ot-label">{idx + 1}</Label>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant={hasMeta(meta[idx]) ? "default" : "outline"}
                      className="h-5 w-5"
                      onClick={() => onOpenLabel(idx)}
                      disabled={disabled}
                      title={labelButtonTitle?.(idx) ?? `Etiqueta bobina #${idx + 1}`}
                    >
                      <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{labelTooltipText(meta[idx])}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              className="ot-input-unified h-9"
              inputMode="decimal"
              value={val}
              onChange={(e) => onChange(idx, e.target.value)}
              placeholder="0"
              disabled={disabled}
            />
          </div>
        ))}
      </div>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </>
  )
}
