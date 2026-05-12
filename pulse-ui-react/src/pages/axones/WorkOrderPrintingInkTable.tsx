import { Gauge, Loader2, MessageSquare, Palette as LucidePaletteField, Timer } from "lucide-react"
import { useState } from "react"

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
  tintaMateriales: MaterialRow[]
  tintaMaterialesLoading: boolean
  onSetField: (key: string, value: unknown) => void
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function formatTintaCatalogLabel(m: MaterialRow): string {
  return `${m.name} · ${m.sku}`
}

export default function WorkOrderPrintingInkTable({
  form,
  tintaMateriales,
  tintaMaterialesLoading,
  onSetField,
}: Props) {
  const [tintaColorPickerRow, setTintaColorPickerRow] = useState<number | null>(null)

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
          <span className="font-medium text-foreground">Color:</span> puede escribir a mano o abrir el catálogo. Si el
          <span className="font-medium"> producto de la OT</span> tiene tintas asignadas en el maestro, el listado se
          restringe a esas; si no hay asignación, se muestran todas las del inventario (área tintas).
          {tintaMaterialesLoading ? " Cargando catálogo…" : ` ${tintaMateriales.length} opciones.`}
        </p>
        <div className="ot-tintas-wrap">
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
                const kColor = `tintaColor${n}`
                return (
                  <tr key={n}>
                    <td>{n}</td>
                    <td className="min-w-[11rem] align-top">
                      <div className="flex min-w-0 max-w-full gap-1 no-print">
                        <OtPlanillaInputIcon icon={LucidePaletteField} compact className="min-w-0 flex-1">
                          <Input
                            data-field={kColor}
                            data-skip-blur="1"
                            className="h-8 min-w-0 w-full flex-1 text-xs"
                            value={readString(form[kColor])}
                            onChange={(e) => onSetField(kColor, e.target.value)}
                            placeholder="Negro proceso 9010"
                          />
                        </OtPlanillaInputIcon>
                        <Popover
                          open={tintaColorPickerRow === n}
                          onOpenChange={(o) => setTintaColorPickerRow(o ? n : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
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
                          <PopoverContent
                            className="p-0 w-[min(100vw-1rem,22rem)]"
                            align="end"
                            side="bottom"
                          >
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
                      </div>
                      <div
                        className="hidden break-words text-xs print:block print:min-h-[1.5rem] print:px-0.5 print:py-0.5"
                        aria-hidden
                      >
                        {readString(form[kColor])}
                      </div>
                    </td>
                    <td>
                      <OtPlanillaInputIcon icon={Gauge} compact>
                        <input
                          className="ot-input-unified h-8 text-sm"
                          value={readString(form[`tintaAnilox${n}`])}
                          onChange={(e) => onSetField(`tintaAnilox${n}`, e.target.value)}
                          placeholder="380 L/cm"
                        />
                      </OtPlanillaInputIcon>
                    </td>
                    <td>
                      <OtPlanillaInputIcon icon={Timer} compact>
                        <input
                          className="ot-input-unified h-8 text-sm"
                          value={readString(form[`tintaVisc${n}`])}
                          onChange={(e) =>
                            onSetField(`tintaVisc${n}`, e.target.value.replace(/\D/g, ""))
                          }
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="18"
                        />
                      </OtPlanillaInputIcon>
                    </td>
                    <td>
                      <OtPlanillaInputIcon icon={MessageSquare} compact>
                        <input
                          className="ot-input-unified h-8 text-sm"
                          value={readString(form[`tintaObs${n}`])}
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
