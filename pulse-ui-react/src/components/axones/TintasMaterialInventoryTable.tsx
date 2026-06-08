"use client"

import { Hash, Layers, Package, StickyNote, Truck, Type } from "lucide-react"

import { CatalogTableHead } from "@/components/axones/CatalogTableHead"
import { TintaColorSwatch } from "@/components/axones/TintaColorSwatch"
import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatQuantityDisplayEs } from "@/lib/numeric-display"
import type { MaterialRow } from "@/types/api"

type TintasMaterialInventoryTableProps = {
  materials: MaterialRow[]
  notesColumnLabel?: string
  emptyMessage?: string
  /** Si se define, cada fila es seleccionable (p. ej. agregar tinta usada). */
  onRowClick?: (material: MaterialRow) => void
  selectedMaterialId?: string | number | null
}

export function TintasMaterialInventoryTable({
  materials,
  notesColumnLabel = "Lote / notas",
  emptyMessage = "Sin ítems en inventario.",
  onRowClick,
  selectedMaterialId,
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
              <TableRow
                key={m.id}
                className={cn(
                  catalogTableBodyRowClass,
                  onRowClick && "cursor-pointer hover:bg-violet-50/80",
                  selectedMaterialId != null &&
                    String(selectedMaterialId) === String(m.id) &&
                    "bg-violet-50 ring-1 ring-violet-200 ring-inset",
                )}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(m) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          onRowClick(m)
                        }
                      }
                    : undefined
                }
              >
                <TableCell className={cn("font-mono text-xs", catalogTableBodyCellClass)}>
                  {m.sku}
                </TableCell>
                <TableCell className={cn("font-medium", catalogTableBodyCellClass)}>
                  <span className="inline-flex items-center gap-2">
                    <TintaColorSwatch name={m.name} size="sm" />
                    {m.name}
                  </span>
                </TableCell>
                <TableCell className={catalogTableBodyCellClass}>
                  {m.tinta_subareas?.[0]?.subarea ?? "—"}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                  {formatQuantityDisplayEs(m.quantity_on_hand)}
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
