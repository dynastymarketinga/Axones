"use client"

import { useId, useMemo } from "react"
import { withMontajeAutoFields } from "@/lib/montaje-planilla-metrics"
import {
  Activity,
  ArrowLeftRight,
  ChevronsUpDown,
  Columns,
  GripHorizontal,
  MessageSquare,
  Palette,
  Printer,
  Repeat,
  Ruler,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OtPlanillaInputIcon } from "./OtPlanillaInputIcon"
import { WindingFigurePicker } from "./WindingFigurePicker"
import "./work-order-planilla.css"

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function tipoImpresionLabel(displayForm: Record<string, unknown>): string {
  const raw =
    readString(displayForm.tipoImpresionMontaje).trim() ||
    readString(displayForm.tipoImpresionEstructura).trim() ||
    readString(displayForm.tipoImpresion).trim()
  if (!raw) return "—"
  const t = raw.toLowerCase()
  if (t === "superficie" || t.includes("superf")) return "Superficie"
  if (t === "reverso" || t.includes("rever")) return "Reverso"
  return raw
}

export function WorkOrderMontajePlanillaSnapshot({ form }: { form: Record<string, unknown> }) {
  const baseId = useId().replace(/:/g, "")
  const sid = (suffix: string) => `${baseId}-${suffix}`
  const displayForm = useMemo(() => withMontajeAutoFields(form), [form])

  return (
    <div className="ax-ot">
      <div className="ot-section">
        <div className="section-header section-hdr-montaje">
          <span className="inline-flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            AREA DE MONTAJE
          </span>
        </div>
        <div className="section-body">
          <div className="ot-grid ot-cols-4">
            <div className="ot-field">
              <label htmlFor={sid("frecuencia")} className="ot-label required">
                Frecuencia (mm)
              </label>
              <OtPlanillaInputIcon icon={Activity}>
                <input
                  id={sid("frecuencia")}
                  data-field="frecuencia"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(form.frecuencia)}
                />
              </OtPlanillaInputIcon>
            </div>
            <div className="ot-field">
              <label htmlFor={sid("num-bandas")} className="ot-label required">
                N° Bandas
              </label>
              <OtPlanillaInputIcon icon={GripHorizontal}>
                <input
                  id={sid("num-bandas")}
                  data-field="numBandas"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(form.numBandas)}
                />
              </OtPlanillaInputIcon>
            </div>
            <div className="ot-field">
              <label className="ot-label required">Tipo impresión en montaje</label>
              <Button
                type="button"
                variant="outline"
                disabled
                className="ot-input-unified h-9 w-full min-w-0 max-w-full cursor-not-allowed justify-between gap-2 bg-muted/40 px-2 font-normal opacity-100"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Printer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left text-sm">{tipoImpresionLabel(displayForm)}</span>
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
              </Button>
            </div>
            <div className="ot-field">
              <label htmlFor={sid("ancho-corte")} className="ot-label required">
                Ancho Corte (mm)
              </label>
              <OtPlanillaInputIcon icon={ArrowLeftRight}>
                <input
                  id={sid("ancho-corte")}
                  data-field="anchoCorteMontaje"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(form.anchoCorteMontaje)}
                />
              </OtPlanillaInputIcon>
            </div>
            <div className="ot-field">
              <label htmlFor={sid("num-rep")} className="ot-label required">
                N° Repeticion o Frecuencia
              </label>
              <OtPlanillaInputIcon icon={Repeat}>
                <input
                  id={sid("num-rep")}
                  data-field="numRepeticion"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(form.numRepeticion)}
                />
              </OtPlanillaInputIcon>
            </div>
            <div className="ot-field">
              <label htmlFor={sid("desarrollo")} className="ot-label required">
                Desarrollo (mm) (auto)
              </label>
              <OtPlanillaInputIcon icon={Ruler}>
                <input
                  id={sid("desarrollo")}
                  data-field="desarrollo"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(displayForm.desarrollo)}
                />
              </OtPlanillaInputIcon>
            </div>
            <div className="ot-field">
              <label htmlFor={sid("ancho-mont")} className="ot-label required">
                Ancho Montaje (mm) (auto)
              </label>
              <OtPlanillaInputIcon icon={Columns}>
                <input
                  id={sid("ancho-mont")}
                  data-field="anchoMontaje"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(displayForm.anchoMontaje)}
                />
              </OtPlanillaInputIcon>
            </div>
            <div className="ot-field ot-field-figure sm:col-span-2">
              <div className="ot-label-row">
                <label className="ot-label required">Figura embobinado (1-8 o libre)</label>
                <Badge variant="outline" className="text-[10px] font-normal">
                  Figura
                </Badge>
              </div>
              <WindingFigurePicker
                value={readString(form.figuraEmbobinadoMontaje)}
                onChange={() => {}}
                disabled
              />
            </div>
            <div className="ot-field ot-field-align-figure">
              <label htmlFor={sid("num-colores")} className="ot-label required">
                N° Colores
              </label>
              <OtPlanillaInputIcon icon={Palette}>
                <input
                  id={sid("num-colores")}
                  data-field="numColores"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(form.numColores)}
                />
              </OtPlanillaInputIcon>
            </div>
          </div>
          <div className="ot-grid ot-cols-1">
            <div className="ot-field">
              <label htmlFor={sid("obs")} className="ot-label">
                Observaciones montaje
              </label>
              <OtPlanillaInputIcon icon={MessageSquare}>
                <input
                  id={sid("obs")}
                  data-field="obsMontaje"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  value={readString(form.obsMontaje)}
                />
              </OtPlanillaInputIcon>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
