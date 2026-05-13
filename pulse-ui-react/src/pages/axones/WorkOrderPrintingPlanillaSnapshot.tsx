"use client"

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronsUpDown,
  Cog,
  Minus,
  PackagePlus,
  Plus,
  Ruler,
  TrendingDown,
  Warehouse,
  Weight,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Droplets } from "./ot-planilla-icons"
import { OtPlanillaInputIcon } from "./OtPlanillaInputIcon"
import { WindingFigurePicker } from "./WindingFigurePicker"
import WorkOrderPrintingInkTable from "./WorkOrderPrintingInkTable"
import "./work-order-planilla.css"

type SustratoRow = { material_id: string; kg: string; material_free_text?: string }

const MIN_SUSTRATO_ROWS = 1
const MAX_SUSTRATO_ROWS = 4

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function readNumberString(v: unknown): string {
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v
  return ""
}

function normalizeYesNo(v: unknown): "" | "si" | "no" {
  const s = readString(v).trim().toLowerCase()
  if (s === "si" || s === "sí") return "si"
  if (s === "no") return "no"
  return ""
}

function lineaCorteComboLabel(v: unknown): string {
  const n = normalizeYesNo(v)
  if (n === "si") return "Si"
  if (n === "no") return "No"
  return "Elegir…"
}

function ensureMinSustratoRows(rows: SustratoRow[], minRows = MIN_SUSTRATO_ROWS): SustratoRow[] {
  const next = [...rows]
  while (next.length < minRows) next.push({ material_id: "", kg: "", material_free_text: "" })
  return next
}

function getSustratosImp(form: Record<string, unknown>): SustratoRow[] {
  const raw = form.sustratosVirgenImp
  if (Array.isArray(raw)) {
    const out: SustratoRow[] = raw.map((r) => {
      const o = r as Record<string, unknown>
      return {
        material_id: readString(o.material_id),
        kg: readNumberString(o.kg),
        material_free_text: readString(o.material_free_text),
      }
    })
    return ensureMinSustratoRows(out.slice(0, MAX_SUSTRATO_ROWS))
  }
  const mid = readString(form.sustratoVirgenImp1)
  const kg = readNumberString(form.kgUtilizarImp1)
  if (mid || kg) return ensureMinSustratoRows([{ material_id: mid, kg, material_free_text: "" }])
  return ensureMinSustratoRows([])
}

function sustratoFieldValue(r: SustratoRow): string {
  const free = readString(r.material_free_text).trim()
  const id = readString(r.material_id).trim()
  return free || id
}

export function WorkOrderPrintingPlanillaSnapshot({ form }: { form: Record<string, unknown> }) {
  const sustratosImp = getSustratosImp(form)

  return (
    <div className="ax-ot">
      <div className="ot-section">
      <div className="section-header section-hdr-impresion">
        <span className="inline-flex items-center gap-2">
          <Droplets className="h-4 w-4" />
          AREA DE IMPRESION
        </span>
      </div>
      <div className="section-body">
        <div className="ot-grid ot-cols-3">
          <div className="ot-field">
            <label className="ot-label required">Piñon (dientes)</label>
            <OtPlanillaInputIcon icon={Cog}>
              <input
                data-field="pinonImp"
                className="ot-input"
                readOnly
                tabIndex={-1}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="840"
                aria-invalid={false}
                value={readString(form.pinonImp)}
              />
            </OtPlanillaInputIcon>
          </div>
          <div className="ot-field">
            <label className="ot-label required">Linea de corte</label>
            <Button
              type="button"
              variant="outline"
              disabled
              data-field="lineaCorte"
              aria-expanded={false}
              aria-invalid={false}
              className="ot-input-unified h-9 w-full min-w-0 max-w-full justify-between gap-2 px-2 font-normal print:hidden"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-left text-sm">
                  {lineaCorteComboLabel(form.lineaCorte)}
                </span>
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
            </Button>
            <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
              <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{lineaCorteComboLabel(form.lineaCorte)}</span>
            </div>
          </div>
          <div className="ot-field sm:col-span-2 lg:col-span-1" data-field="figEmbImpDisplay">
            <div className="flex flex-wrap items-center gap-2">
              <label className="ot-label required">Figura emb. (1-8)</label>
              <Badge
                variant="outline"
                className="text-[10px] font-normal"
                title="Botones 1–8 = atajo para el valor de la figura."
              >
                Figura
              </Badge>
            </div>
            <WindingFigurePicker
              value={readString(form.figEmbImpDisplay)}
              onChange={() => {}}
              disabled
            />
          </div>
        </div>

        <div className="ot-sustratos-virgen-block ot-sustratos-virgen-block--impresion">
          <div className="ot-sustratos-virgen-head">
            <span className="ot-label required">Sustratos virgen (inventario)</span>
            <Badge
              variant="outline"
              className="ot-sustratos-virgen-badge--impresion shrink-0 border text-[10px] font-normal shadow-none"
            >
              Inventario
            </Badge>
          </div>
          <p className="text-muted-foreground mb-2 text-xs leading-relaxed no-print">
            <span className="font-medium text-foreground">Sustrato:</span> puede escribir la referencia, abrir el
            catálogo de inventario o crear un material nuevo en otra pestaña (botón{" "}
            <PackagePlus className="inline-block h-3 w-3 align-text-bottom opacity-80" aria-hidden />).
          </p>
          <div className="ot-sustratos-virgen-rows">
            {sustratosImp.map((r, idx) => (
              <div key={idx} className="ot-grid ot-cols-2-asym">
                <div className="ot-field">
                  <label className="ot-label required">{`Sustrato ${idx + 1}`}</label>
                  <div className="flex min-w-0 gap-1 no-print">
                    <OtPlanillaInputIcon icon={Warehouse} className="min-w-0 flex-1">
                      <Input
                        data-field="sustratosImp"
                        className="ot-input-unified h-9 min-w-0 text-sm"
                        readOnly
                        tabIndex={-1}
                        value={sustratoFieldValue(r)}
                        placeholder="Referencia libre o elegir del inventario…"
                        aria-invalid={false}
                      />
                    </OtPlanillaInputIcon>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title="Catálogo de materiales (área material)"
                      disabled
                      aria-expanded={false}
                    >
                      <ChevronsUpDown className="h-4 w-4 opacity-70" aria-hidden />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild title="Crear material en inventario">
                      <Link to="/materiales/nuevo" target="_blank" rel="noopener noreferrer">
                        <PackagePlus className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                  <div className="ot-input-unified hidden h-9 items-center gap-2 px-2 text-sm print:flex">
                    <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{sustratoFieldValue(r) || "—"}</span>
                  </div>
                </div>
                <div className="ot-field">
                  <label className="ot-label required">Kg a utilizar</label>
                  <OtPlanillaInputIcon icon={Weight}>
                    <input
                      data-field="sustratosImp"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      className="ot-input"
                      readOnly
                      tabIndex={-1}
                      placeholder="420.50"
                      aria-invalid={false}
                      value={readNumberString(r.kg)}
                    />
                  </OtPlanillaInputIcon>
                </div>
              </div>
            ))}
          </div>
          <div className="ot-sustratos-virgen-toolbar no-print">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Agregar sustrato"
              aria-label="Agregar sustrato"
              disabled
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="ot-grid ot-metrics-before-nested ot-sustratos-virgen-metrics-gap ot-cols-4">
          <div className="ot-field">
            <label className="ot-label required">Kg ingresado</label>
            <OtPlanillaInputIcon icon={ArrowDownToLine}>
              <input
                data-field="kgIngresadoImp"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="1850.50"
                aria-invalid={false}
                value={readNumberString(form.kgIngresadoImp)}
              />
            </OtPlanillaInputIcon>
          </div>
          <div className="ot-field">
            <label className="ot-label required">Kg salida</label>
            <OtPlanillaInputIcon icon={ArrowUpFromLine}>
              <input
                data-field="kgSalidaImp"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="1825.00"
                aria-invalid={false}
                value={readNumberString(form.kgSalidaImp)}
              />
            </OtPlanillaInputIcon>
          </div>
          <div className="ot-field">
            <label className="ot-label required">Merma</label>
            <OtPlanillaInputIcon icon={TrendingDown}>
              <input
                data-field="mermaImp"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="14.25"
                aria-invalid={false}
                value={readNumberString(form.mermaImp)}
              />
            </OtPlanillaInputIcon>
          </div>
          <div className="ot-field">
            <label className="ot-label required">Metros</label>
            <OtPlanillaInputIcon icon={Ruler}>
              <input
                data-field="metrosImp"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="8200"
                aria-invalid={false}
                value={readNumberString(form.metrosImp)}
              />
            </OtPlanillaInputIcon>
          </div>
        </div>

        <WorkOrderPrintingInkTable form={form} readOnly />
      </div>
      </div>
    </div>
  )
}
