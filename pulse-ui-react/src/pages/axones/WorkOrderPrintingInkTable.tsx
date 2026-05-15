import { Gauge, Loader2, MessageSquare, Palette as LucidePaletteField, Timer } from "lucide-react"
import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { MaterialRow } from "@/types/api"
import { Droplets, Palette } from "./ot-planilla-icons"
import { OtPlanillaInputIcon } from "./OtPlanillaInputIcon"

type Props = {
  form: Record<string, unknown>
  /** En planilla editable; vacío en solo lectura (p. ej. vista producción). */
  tintaMateriales?: MaterialRow[]
  tintaMaterialesLoading?: boolean
  /** Solo lectura: sin catálogo ni edición (datos ya guardados en la OT). */
  readOnly?: boolean
  onSetField?: (key: string, value: unknown) => void
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function formatTintaCatalogLabel(m: MaterialRow): string {
  return `${m.name} · ${m.sku}`
}

type InkRowProps = {
  n: number
  form: Record<string, unknown>
  readOnly: boolean
  tintaMateriales: MaterialRow[]
  tintaMaterialesLoading: boolean
  tintaColorPickerRow: number | null
  setTintaColorPickerRow: (v: number | null) => void
  onSetField: (key: string, value: unknown) => void
  tintaFieldId: (n: number, suffix: string) => string
}

/** Celda color + catálogo (compartida entre tabla y vista móvil). */
function InkColorField({
  n,
  form,
  readOnly,
  tintaMateriales,
  tintaMaterialesLoading,
  tintaColorPickerRow,
  setTintaColorPickerRow,
  onSetField,
  tintaFieldId,
}: InkRowProps) {
  const kColor = `tintaColor${n}`
  const colorInputId = tintaFieldId(n, "color")
  return (
    <>
      <div className="flex min-w-0 max-w-full gap-1 no-print">
        <OtPlanillaInputIcon icon={LucidePaletteField} compact className="min-w-0 flex-1">
          <Input
            id={colorInputId}
            name={kColor}
            data-field={kColor}
            data-skip-blur="1"
            className="h-8 min-w-0 w-full flex-1 text-xs"
            value={readString(form[kColor])}
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            onChange={(e) => onSetField(kColor, e.target.value)}
            placeholder="Negro proceso 9010"
          />
        </OtPlanillaInputIcon>
        {readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Catálogo de tintas"
            disabled
            tabIndex={-1}
          >
            <Droplets className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : (
          <Popover
            open={tintaColorPickerRow === n}
            onOpenChange={(o) => setTintaColorPickerRow(o ? n : null)}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                id={tintaFieldId(n, "color-catalog")}
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Catálogo de tintas"
                disabled={tintaMaterialesLoading}
              >
                {tintaMaterialesLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Droplets className="h-3.5 w-3.5" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[min(100vw-1rem,22rem)]" align="end" side="bottom">
              <Command shouldFilter>
                <CommandInput placeholder="Buscar por nombre o SKU…" />
                <CommandList className="max-h-60">
                  <CommandEmpty>
                    {tintaMateriales.length === 0
                      ? "No hay filas. Verifique el producto de la OT o que existan tintas en inventario."
                      : "Ninguna coincide con la búsqueda."}
                  </CommandEmpty>
                  <CommandGroup>
                    {tintaMateriales.map((m) => {
                      const v = [
                        m.name,
                        m.sku,
                        ...(m.tinta_subareas ?? []).map((s) => s.subarea),
                      ]
                        .filter(Boolean)
                        .join(" ")
                      const label = formatTintaCatalogLabel(m)
                      return (
                        <CommandItem
                          key={m.id}
                          value={v}
                          onSelect={() => {
                            onSetField(kColor, label)
                            setTintaColorPickerRow(null)
                          }}
                        >
                          <span className="line-clamp-2 text-left text-xs">{label}</span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div
        className="hidden break-words text-xs print:block print:min-h-[1.5rem] print:px-0.5 print:py-0.5"
        aria-hidden
      >
        {readString(form[kColor])}
      </div>
    </>
  )
}

function InkTintaStackCard(p: InkRowProps) {
  const { n, form, readOnly, onSetField, tintaFieldId } = p
  return (
    <div className="rounded-lg border border-border/70 bg-background/90 p-3 shadow-sm">
      <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        Posición {n}
      </div>
      <div className="space-y-3">
        <div>
          <label
            htmlFor={tintaFieldId(n, "color")}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            Color
          </label>
          <InkColorField {...p} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={tintaFieldId(n, "anilox")}
              className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
            >
              Anilox
            </label>
            <OtPlanillaInputIcon icon={Gauge} compact>
              <input
                id={tintaFieldId(n, "anilox")}
                name={`tintaAnilox${n}`}
                className="ot-input-unified h-8 w-full text-sm"
                value={readString(form[`tintaAnilox${n}`])}
                readOnly={readOnly}
                tabIndex={readOnly ? -1 : undefined}
                onChange={(e) => onSetField(`tintaAnilox${n}`, e.target.value)}
                placeholder="380 L/cm"
              />
            </OtPlanillaInputIcon>
          </div>
          <div>
            <label
              htmlFor={tintaFieldId(n, "visc")}
              className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
            >
              Visc (seg)
            </label>
            <OtPlanillaInputIcon icon={Timer} compact>
              <input
                id={tintaFieldId(n, "visc")}
                name={`tintaVisc${n}`}
                className="ot-input-unified h-8 w-full text-sm"
                value={readString(form[`tintaVisc${n}`])}
                readOnly={readOnly}
                tabIndex={readOnly ? -1 : undefined}
                onChange={(e) => onSetField(`tintaVisc${n}`, e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="18"
              />
            </OtPlanillaInputIcon>
          </div>
        </div>
        <div>
          <label
            htmlFor={tintaFieldId(n, "obs")}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            Observaciones
          </label>
          <OtPlanillaInputIcon icon={MessageSquare} compact>
            <input
              id={tintaFieldId(n, "obs")}
              name={`tintaObs${n}`}
              className="ot-input-unified h-8 w-full text-sm"
              value={readString(form[`tintaObs${n}`])}
              readOnly={readOnly}
              tabIndex={readOnly ? -1 : undefined}
              onChange={(e) => onSetField(`tintaObs${n}`, e.target.value)}
              placeholder="Sin arrastre"
            />
          </OtPlanillaInputIcon>
        </div>
      </div>
    </div>
  )
}

export default function WorkOrderPrintingInkTable({
  form,
  tintaMateriales = [],
  tintaMaterialesLoading = false,
  readOnly = false,
  onSetField = () => {},
}: Props) {
  const [tintaColorPickerRow, setTintaColorPickerRow] = useState<number | null>(null)
  const tintaIdBase = useId().replace(/:/g, "")
  const tintaStackFieldId = (n: number, suffix: string) => `${tintaIdBase}-stack-${n}-${suffix}`
  const tintaTableFieldId = (n: number, suffix: string) => `${tintaIdBase}-table-${n}-${suffix}`

  const rowStackProps = {
    form,
    readOnly,
    tintaMateriales,
    tintaMaterialesLoading,
    tintaColorPickerRow,
    setTintaColorPickerRow,
    onSetField,
    tintaFieldId: tintaStackFieldId,
  }

  const rowTableProps = {
    form,
    readOnly,
    tintaMateriales,
    tintaMaterialesLoading,
    tintaColorPickerRow,
    setTintaColorPickerRow,
    onSetField,
    tintaFieldId: tintaTableFieldId,
  }

  return (
    <div className="ot-section ot-section--tintas">
      <div className="section-header section-hdr-tintas">
        <span className="inline-flex items-center gap-2">
          <Palette className="h-4 w-4" />
          DESCRIPCION DE TINTAS
        </span>
      </div>
      <div className="section-body">
        <p className="text-muted-foreground mb-2 text-xs leading-relaxed no-print">
          {readOnly ? (
            <>
              Valores guardados en la planilla de la OT. El conteo del catálogo de tintas solo aplica al editar la
              orden (no en esta vista de producción).
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Color:</span> puede escribir a mano o abrir el catálogo.
              Si el<span className="font-medium"> producto de la OT</span> tiene tintas asignadas en el maestro, el
              listado se restringe a esas; si no hay asignación, se muestran todas las del inventario (área tintas).
              {!tintaMaterialesLoading ? ` ${tintaMateriales.length} opciones.` : " Cargando catálogo…"}
            </>
          )}
        </p>

        <div className="no-print space-y-2 md:hidden">
          {Array.from({ length: 8 }).map((_, idx) => {
            const n = idx + 1
            return <InkTintaStackCard key={n} n={n} {...rowStackProps} />
          })}
        </div>

        <div className="ot-tintas-wrap hidden md:block print:block">
          <table className="table-tintas">
            <thead>
              <tr>
                <th>POSICION</th>
                <th className="required">COLOR</th>
                <th className="required">ANILOX</th>
                <th className="required">VISC (seg)</th>
                <th className="required">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => {
                const n = idx + 1
                return (
                  <tr key={n}>
                    <td>{n}</td>
                    <td className="min-w-[11rem] align-top">
                      <InkColorField n={n} {...rowTableProps} />
                    </td>
                    <td>
                      <OtPlanillaInputIcon icon={Gauge} compact>
                        <input
                          id={tintaTableFieldId(n, "anilox")}
                          name={`tintaAnilox${n}`}
                          className="ot-input-unified h-8 text-sm"
                          value={readString(form[`tintaAnilox${n}`])}
                          readOnly={readOnly}
                          tabIndex={readOnly ? -1 : undefined}
                          onChange={(e) => onSetField(`tintaAnilox${n}`, e.target.value)}
                          placeholder="380 L/cm"
                        />
                      </OtPlanillaInputIcon>
                    </td>
                    <td>
                      <OtPlanillaInputIcon icon={Timer} compact>
                        <input
                          id={tintaTableFieldId(n, "visc")}
                          name={`tintaVisc${n}`}
                          className="ot-input-unified h-8 text-sm"
                          value={readString(form[`tintaVisc${n}`])}
                          readOnly={readOnly}
                          tabIndex={readOnly ? -1 : undefined}
                          onChange={(e) => onSetField(`tintaVisc${n}`, e.target.value.replace(/\D/g, ""))}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="18"
                        />
                      </OtPlanillaInputIcon>
                    </td>
                    <td>
                      <OtPlanillaInputIcon icon={MessageSquare} compact>
                        <input
                          id={tintaTableFieldId(n, "obs")}
                          name={`tintaObs${n}`}
                          className="ot-input-unified h-8 text-sm"
                          value={readString(form[`tintaObs${n}`])}
                          readOnly={readOnly}
                          tabIndex={readOnly ? -1 : undefined}
                          onChange={(e) => onSetField(`tintaObs${n}`, e.target.value)}
                          placeholder="Sin arrastre"
                        />
                      </OtPlanillaInputIcon>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
