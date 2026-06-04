"use client"

import {
  BandejaIconColumnHeadLabel,
  insumosBandejaTableHeadClassName,
  mesBandejaRowTopCellClass,
} from "@/components/axones/InsumosBandejaTable"
import { TableCell, TableHead } from "@/components/ui/table"
import {
  bandejaPendientesAreaColumnDefs,
  readBandejaPendientesAreaValues,
  type BandejaPendientesAreaKey,
} from "@/lib/area-bandeja-pendientes-columns"
import type { WorkOrderListRow } from "@/types/api"
import { cn } from "@/lib/utils"

export function MesBandejaAreaPendientesTableHeadCells({ area }: { area: BandejaPendientesAreaKey }) {
  const cols = bandejaPendientesAreaColumnDefs(area)
  return (
    <>
      {cols.map((col) => (
        <TableHead
          key={col.id}
          className={cn(insumosBandejaTableHeadClassName, "px-1.5 text-center sm:px-2")}
        >
          <BandejaIconColumnHeadLabel
            icon={col.icon}
            line1={col.line1}
            line2={col.line2}
            title={col.title}
          />
        </TableHead>
      ))}
    </>
  )
}

function BandejaAreaValueCell({ value, title }: { value: string; title?: string }) {
  return (
    <TableCell className={cn(mesBandejaRowTopCellClass, "max-w-[8.5rem] px-1.5 text-center sm:px-2")}>
      <p
        className="text-xs font-medium leading-snug text-foreground line-clamp-2 sm:text-sm"
        title={title ?? (value !== "—" ? value : undefined)}
      >
        {value}
      </p>
    </TableCell>
  )
}

export function MesBandejaAreaPendientesTableRowCells({
  row,
  area,
}: {
  row: WorkOrderListRow
  area: BandejaPendientesAreaKey
}) {
  const defs = bandejaPendientesAreaColumnDefs(area)
  const values = readBandejaPendientesAreaValues(row, area)
  return (
    <>
      {defs.map((col, i) => (
        <BandejaAreaValueCell key={col.id} value={values[i] ?? "—"} title={col.title} />
      ))}
    </>
  )
}
