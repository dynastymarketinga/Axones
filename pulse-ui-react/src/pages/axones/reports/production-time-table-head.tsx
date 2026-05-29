"use client"

import { TableHead } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export const PRODUCTION_TIME_NUM_HEAD_CLASS =
  "min-w-[4.25rem] text-right text-xs font-medium tabular-nums text-muted-foreground"

export function ProductionTimeTableHead({
  label,
  tooltip,
  className,
}: {
  label: string
  tooltip: string
  className: string
}) {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground decoration-muted-foreground/80">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[16rem] text-xs leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TableHead>
  )
}
