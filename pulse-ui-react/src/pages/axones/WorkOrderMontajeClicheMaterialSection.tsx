"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { Box, ChevronLeft, ChevronRight, Layers, Plus, Trash2 } from "lucide-react"

import { MesSectionShell, mesSectionTitle } from "@/components/axones/mes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  emptyMontajeFila,
  emptyMontajeMaterialFila,
  type MontajeFilaMontaje,
  type MontajeMaterialFila,
} from "./montaje-cliche-material"

const LIST_PAGE_SIZE = 5

type Props = {
  embedded?: boolean
  numCliche: string
  numCilindro: string
  filasExtra: MontajeFilaMontaje[]
  materialesMontaje: MontajeMaterialFila[]
  readOnly: boolean
  onNumClicheChange: (v: string) => void
  onNumCilindroChange: (v: string) => void
  onFilasExtraChange: (rows: MontajeFilaMontaje[]) => void
  onMaterialesMontajeChange: (rows: MontajeMaterialFila[]) => void
}

function usePaginatedRows<T>(rows: T[]) {
  const [page, setPage] = useState(0)
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const start = safePage * LIST_PAGE_SIZE
  const end = Math.min(start + LIST_PAGE_SIZE, total)
  const rowsOnPage = rows.slice(start, end)

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(total / LIST_PAGE_SIZE) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [total, page])

  function goToLastPage() {
    setPage(Math.max(0, Math.ceil(total / LIST_PAGE_SIZE) - 1))
  }

  function clampPageAfterRemove(nextLength: number) {
    const maxPage = Math.max(0, Math.ceil(nextLength / LIST_PAGE_SIZE) - 1)
    if (page > maxPage) setPage(maxPage)
  }

  return {
    page,
    setPage,
    total,
    totalPages,
    safePage,
    start,
    end,
    rowsOnPage,
    goToLastPage,
    clampPageAfterRemove,
  }
}

function PaginatedTableFooter({
  start,
  end,
  total,
  totalPages,
  safePage,
  onPageChange,
}: {
  start: number
  end: number
  total: number
  totalPages: number
  safePage: number
  onPageChange: (page: number) => void
}) {
  if (totalPages > 1) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2">
        <p className="text-muted-foreground text-xs">
          Filas {start + 1}–{end} de {total}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage <= 0}
            aria-label="Página anterior"
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i}
              type="button"
              variant={i === safePage ? "default" : "outline"}
              size="sm"
              className={cn("h-8 min-w-8 px-2 text-xs", i === safePage && "pointer-events-none")}
              onClick={() => onPageChange(i)}
            >
              {i + 1}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= totalPages - 1}
            aria-label="Página siguiente"
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <p className="text-muted-foreground text-xs">
      {total} fila{total === 1 ? "" : "s"} en total
    </p>
  )
}

function PaginatedListSection({
  title,
  readOnly,
  emptyReadOnlyText,
  emptyEditableText,
  total,
  totalPages,
  safePage,
  start,
  end,
  onPageChange,
  onAdd,
  tableHeader,
  children,
}: {
  title: ReactNode
  readOnly: boolean
  emptyReadOnlyText: string
  emptyEditableText: string
  total: number
  totalPages: number
  safePage: number
  start: number
  end: number
  onPageChange: (page: number) => void
  onAdd: () => void
  tableHeader: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Agregar fila
          </Button>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-3 text-center text-xs">
          {readOnly ? emptyReadOnlyText : emptyEditableText}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">{tableHeader}</TableRow>
              </TableHeader>
              <TableBody>{children}</TableBody>
            </Table>
          </div>
          <PaginatedTableFooter
            start={start}
            end={end}
            total={total}
            totalPages={totalPages}
            safePage={safePage}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}

function ClicheCilindroPair({
  baseId,
  prefix,
  numCliche,
  numCilindro,
  readOnly,
  onClicheChange,
  onCilindroChange,
}: {
  baseId: string
  prefix: string
  numCliche: string
  numCilindro: string
  readOnly: boolean
  onClicheChange: (v: string) => void
  onCilindroChange: (v: string) => void
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-${prefix}-cliche`} className="text-xs font-medium">
          N° Cliché
        </Label>
        <Input
          id={`${baseId}-${prefix}-cliche`}
          name={`${prefix}-cliche`}
          className="ot-input-unified h-9"
          value={numCliche}
          onChange={(e) => onClicheChange(e.target.value)}
          disabled={readOnly}
          placeholder="Ej. CL-2024-001"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-${prefix}-cilindro`} className="text-xs font-medium">
          N° Cilindro
        </Label>
        <Input
          id={`${baseId}-${prefix}-cilindro`}
          name={`${prefix}-cilindro`}
          className="ot-input-unified h-9"
          value={numCilindro}
          onChange={(e) => onCilindroChange(e.target.value)}
          disabled={readOnly}
          placeholder="Ej. CIL-08"
        />
      </div>
    </div>
  )
}

export default function WorkOrderMontajeClicheMaterialSection({
  embedded = false,
  numCliche,
  numCilindro,
  filasExtra,
  materialesMontaje,
  readOnly,
  onNumClicheChange,
  onNumCilindroChange,
  onFilasExtraChange,
  onMaterialesMontajeChange,
}: Props) {
  const baseId = useId().replace(/:/g, "")
  const filasPag = usePaginatedRows(filasExtra)
  const materialesPag = usePaginatedRows(materialesMontaje)

  function updateFila(index: number, patch: Partial<MontajeFilaMontaje>) {
    onFilasExtraChange(filasExtra.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeFila(index: number) {
    const next = filasExtra.filter((_, i) => i !== index)
    onFilasExtraChange(next)
    filasPag.clampPageAfterRemove(next.length)
  }

  function addFila() {
    const next = [...filasExtra, emptyMontajeFila()]
    onFilasExtraChange(next)
    filasPag.goToLastPage()
  }

  function updateMaterial(index: number, patch: Partial<MontajeMaterialFila>) {
    onMaterialesMontajeChange(
      materialesMontaje.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    )
  }

  function removeMaterial(index: number) {
    const next = materialesMontaje.filter((_, i) => i !== index)
    onMaterialesMontajeChange(next)
    materialesPag.clampPageAfterRemove(next.length)
  }

  function addMaterial() {
    const next = [...materialesMontaje, emptyMontajeMaterialFila()]
    onMaterialesMontajeChange(next)
    materialesPag.goToLastPage()
  }

  const body = (
    <>
      {!embedded ? (
        <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
          Datos del montaje de cliché y cilindro. El registro de sticky back, código, color y cantidad de canguro usada se
          envía al sistema al pulsar <span className="font-medium text-foreground">Guardar</span> al pie de página
          (cierre de turno o finalización del área). Al abrir un{" "}
          <span className="font-medium text-foreground">turno nuevo</span>, estos campos se limpian; lo guardado queda en
          el historial del turno cerrado.
        </p>
      ) : null}

      <ClicheCilindroPair
        baseId={baseId}
        prefix="principal"
        numCliche={numCliche}
        numCilindro={numCilindro}
        readOnly={readOnly}
        onClicheChange={onNumClicheChange}
        onCilindroChange={onNumCilindroChange}
      />

      <div className="mt-4">
        <PaginatedListSection
          title="Filas adicionales"
          readOnly={readOnly}
          emptyReadOnlyText="Sin filas adicionales."
          emptyEditableText="Pulse «Agregar fila» para otro par cliché + cilindro."
          total={filasPag.total}
          totalPages={filasPag.totalPages}
          safePage={filasPag.safePage}
          start={filasPag.start}
          end={filasPag.end}
          onPageChange={filasPag.setPage}
          onAdd={addFila}
          tableHeader={
            <>
              <TableHead className="w-10 text-center text-xs">N°</TableHead>
              <TableHead className="min-w-[8rem] text-xs">N° Cliché</TableHead>
              <TableHead className="min-w-[8rem] text-xs">N° Cilindro</TableHead>
              {!readOnly ? <TableHead className="w-10" /> : null}
            </>
          }
        >
          {filasPag.rowsOnPage.map((fila, pageIdx) => {
            const globalIdx = filasPag.start + pageIdx
            const rowNum = globalIdx + 1
            return (
              <TableRow key={globalIdx}>
                <TableCell className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {rowNum}
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    id={`${baseId}-extra-${globalIdx}-cliche`}
                    name={`extra-${globalIdx}-cliche`}
                    className="ot-input-unified h-8 text-xs"
                    value={fila.numCliche}
                    onChange={(e) => updateFila(globalIdx, { numCliche: e.target.value })}
                    disabled={readOnly}
                    placeholder="Ej. CL-2024-002"
                    aria-label={`Fila ${rowNum} cliché`}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    id={`${baseId}-extra-${globalIdx}-cilindro`}
                    name={`extra-${globalIdx}-cilindro`}
                    className="ot-input-unified h-8 text-xs"
                    value={fila.numCilindro}
                    onChange={(e) => updateFila(globalIdx, { numCilindro: e.target.value })}
                    disabled={readOnly}
                    placeholder="Ej. CIL-09"
                    aria-label={`Fila ${rowNum} cilindro`}
                  />
                </TableCell>
                {!readOnly ? (
                  <TableCell className="py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Quitar fila ${rowNum}`}
                      onClick={() => removeFila(globalIdx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </PaginatedListSection>
      </div>

      <div className="mt-5">
        <PaginatedListSection
          title={
            <span className="inline-flex items-center gap-2">
              <Box className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Material usado en montaje
            </span>
          }
          readOnly={readOnly}
          emptyReadOnlyText="Sin material registrado."
          emptyEditableText="Pulse «Agregar fila» para sticky back, código, color y cantidad de canguro usada."
          total={materialesPag.total}
          totalPages={materialesPag.totalPages}
          safePage={materialesPag.safePage}
          start={materialesPag.start}
          end={materialesPag.end}
          onPageChange={materialesPag.setPage}
          onAdd={addMaterial}
          tableHeader={
            <>
              <TableHead className="w-10 text-center text-xs">N°</TableHead>
              <TableHead className="min-w-[7rem] text-xs">Sticky back</TableHead>
              <TableHead className="min-w-[7rem] text-xs">Código</TableHead>
              <TableHead className="min-w-[7rem] text-xs">Color</TableHead>
              <TableHead className="min-w-[5.5rem] text-xs">Cantidad (canguro)</TableHead>
              {!readOnly ? <TableHead className="w-10" /> : null}
            </>
          }
        >
          {materialesPag.rowsOnPage.map((fila, pageIdx) => {
            const globalIdx = materialesPag.start + pageIdx
            const rowNum = globalIdx + 1
            return (
              <TableRow key={globalIdx}>
                <TableCell className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {rowNum}
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    id={`${baseId}-mat-${globalIdx}-sticky`}
                    name={`mat-${globalIdx}-sticky`}
                    className="ot-input-unified h-8 text-xs"
                    value={fila.stickyBack}
                    onChange={(e) => updateMaterial(globalIdx, { stickyBack: e.target.value })}
                    disabled={readOnly}
                    placeholder="Ej. reverso, adhesive…"
                    aria-label={`Fila ${rowNum} sticky back`}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    id={`${baseId}-mat-${globalIdx}-codigo`}
                    name={`mat-${globalIdx}-codigo`}
                    className="ot-input-unified h-8 text-xs"
                    value={fila.codigo}
                    onChange={(e) => updateMaterial(globalIdx, { codigo: e.target.value })}
                    disabled={readOnly}
                    placeholder="Ingrese código manualmente"
                    aria-label={`Fila ${rowNum} código`}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    id={`${baseId}-mat-${globalIdx}-color`}
                    name={`mat-${globalIdx}-color`}
                    className="ot-input-unified h-8 text-xs"
                    value={fila.color}
                    onChange={(e) => updateMaterial(globalIdx, { color: e.target.value })}
                    disabled={readOnly}
                    placeholder="Ej. Cyan, Magenta, Negro…"
                    aria-label={`Fila ${rowNum} color`}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    id={`${baseId}-mat-${globalIdx}-cantidad`}
                    name={`mat-${globalIdx}-cantidad`}
                    className="ot-input-unified h-8 text-xs tabular-nums"
                    inputMode="decimal"
                    value={fila.cantidad}
                    onChange={(e) => updateMaterial(globalIdx, { cantidad: e.target.value })}
                    disabled={readOnly}
                    placeholder="Ej. 2"
                    aria-label={`Fila ${rowNum} cantidad de canguro usada`}
                  />
                </TableCell>
                {!readOnly ? (
                  <TableCell className="py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Quitar fila ${rowNum}`}
                      onClick={() => removeMaterial(globalIdx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </PaginatedListSection>
      </div>
    </>
  )

  if (embedded) return body

  return (
    <MesSectionShell title={mesSectionTitle(Layers, "Cliché, cilindro y material")} subtle>
      {body}
    </MesSectionShell>
  )
}
