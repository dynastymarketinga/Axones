"use client"

import { useId } from "react"
import { Box, Layers, Plus, Trash2 } from "lucide-react"

import { MesSectionShell, mesSectionTitle } from "@/components/axones/mes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  emptyMontajeMaterialRow,
  MONTAJE_MATERIAL_TIPOS,
  MONTAJE_MATERIAL_UNIDADES,
  type MontajeMaterialRow,
} from "./montaje-cliche-material"

type Props = {
  numCliche: string
  numCilindro: string
  materiales: MontajeMaterialRow[]
  readOnly: boolean
  onNumClicheChange: (v: string) => void
  onNumCilindroChange: (v: string) => void
  onMaterialesChange: (rows: MontajeMaterialRow[]) => void
}

export default function WorkOrderMontajeClicheMaterialSection({
  numCliche,
  numCilindro,
  materiales,
  readOnly,
  onNumClicheChange,
  onNumCilindroChange,
  onMaterialesChange,
}: Props) {
  const baseId = useId().replace(/:/g, "")

  function updateRow(index: number, patch: Partial<MontajeMaterialRow>) {
    onMaterialesChange(materiales.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeRow(index: number) {
    onMaterialesChange(materiales.filter((_, i) => i !== index))
  }

  function addRow() {
    onMaterialesChange([...materiales, emptyMontajeMaterialRow()])
  }

  return (
    <MesSectionShell
      title={mesSectionTitle(Layers, "Cliché, cilindro y material")}
      subtle
    >
      <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
        Datos del montaje de cliché y cilindro. El material usado se guarda con la OT al pulsar{" "}
        <span className="font-medium text-foreground">Guardar</span> en el pie de página.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${baseId}-cliche`} className="text-xs font-medium">
            N° Cliché
          </Label>
          <Input
            id={`${baseId}-cliche`}
            name="montNumCliche"
            className="ot-input-unified h-9"
            value={numCliche}
            onChange={(e) => onNumClicheChange(e.target.value)}
            disabled={readOnly}
            placeholder="Ej. CL-2024-001"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${baseId}-cilindro`} className="text-xs font-medium">
            N° Cilindro
          </Label>
          <Input
            id={`${baseId}-cilindro`}
            name="montNumCilindro"
            className="ot-input-unified h-9"
            value={numCilindro}
            onChange={(e) => onNumCilindroChange(e.target.value)}
            disabled={readOnly}
            placeholder="Ej. CIL-08"
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Box className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Material usado en montaje
          </div>
          {!readOnly ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Agregar material
            </Button>
          ) : null}
        </div>

        {materiales.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-xs">
            {readOnly
              ? "Sin materiales registrados."
              : "Pulse «Agregar material» para registrar cintas, pegamentos u otros insumos."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[8.5rem] text-xs">Tipo</TableHead>
                  <TableHead className="min-w-[10rem] text-xs">Material / descripción</TableHead>
                  <TableHead className="w-[6.5rem] text-xs">Cantidad</TableHead>
                  <TableHead className="w-[6.5rem] text-xs">Unidad</TableHead>
                  {!readOnly ? <TableHead className="w-10" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiales.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="py-2">
                      <Select
                        value={row.tipo}
                        onValueChange={(v) =>
                          updateRow(idx, { tipo: v as MontajeMaterialRow["tipo"] })
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTAJE_MATERIAL_TIPOS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        className="h-8 text-xs"
                        value={row.descripcion}
                        onChange={(e) => updateRow(idx, { descripcion: e.target.value })}
                        disabled={readOnly}
                        placeholder="Ej. Cinta 3M, pegamento…"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        className="h-8 text-xs"
                        inputMode="decimal"
                        value={row.cantidad}
                        onChange={(e) => updateRow(idx, { cantidad: e.target.value })}
                        disabled={readOnly}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Select
                        value={row.unidad}
                        onValueChange={(v) => updateRow(idx, { unidad: v })}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTAJE_MATERIAL_UNIDADES.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {!readOnly ? (
                      <TableCell className="py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Quitar fila"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </MesSectionShell>
  )
}
