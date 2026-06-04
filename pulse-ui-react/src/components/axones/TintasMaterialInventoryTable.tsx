"use client"

import { Hash, Layers, Package, StickyNote, Truck, Type } from "lucide-react"

import { CatalogTableHead } from "@/components/axones/CatalogTableHead"
import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { MaterialRow } from "@/types/api"

type TintasMaterialInventoryTableProps = {
  materials: MaterialRow[]
  notesColumnLabel?: string
  emptyMessage?: string
}

export function TintasMaterialInventoryTable({
  materials,
  notesColumnLabel = "Lote / notas",
  emptyMessage = "Sin ítems en inventario.",
}: TintasMaterialInventoryTableProps) {
  return (
    <div className="bg-card w-full min-w-0 overflow-x-auto rounded-2xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className={catalogTableHeaderRowClass}>
            <CatalogTableHead icon={Hash} className="font-mono text-xs">
              SKU
            </CatalogTableHead>
            <CatalogTableHead icon={Type}>Nombre</CatalogTableHead>
            <CatalogTableHead icon={Layers}>Tipo</CatalogTableHead>
            <CatalogTableHead icon={Package} className="text-right">
              Stock
            </CatalogTableHead>
            <CatalogTableHead icon={Truck}>Proveedor</CatalogTableHead>
            <CatalogTableHead icon={StickyNote}>{notesColumnLabel}</CatalogTableHead>
            <CatalogTableHead icon={Package}>Unidad</CatalogTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!materials.length ? (
            <TableRow className={catalogTableBodyRowClass}>
              <TableCell
                colSpan={7}
                className={cn("text-muted-foreground py-10 text-center", catalogTableBodyCellClass)}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            materials.map((m) => (
              <TableRow key={m.id} className={catalogTableBodyRowClass}>
                <TableCell className={cn("font-mono text-xs", catalogTableBodyCellClass)}>
                  {m.sku}
                </TableCell>
                <TableCell className={cn("font-medium", catalogTableBodyCellClass)}>{m.name}</TableCell>
                <TableCell className={catalogTableBodyCellClass}>
                  {m.tinta_subareas?.[0]?.subarea ?? "—"}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                  {m.quantity_on_hand}
                </TableCell>
                <TableCell className={catalogTableBodyCellClass}>{m.supplier?.name ?? "—"}</TableCell>
                <TableCell className={cn("max-w-[220px] truncate", catalogTableBodyCellClass)}>
                  {m.notes || "—"}
                </TableCell>
                <TableCell className={catalogTableBodyCellClass}>{m.unit}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
