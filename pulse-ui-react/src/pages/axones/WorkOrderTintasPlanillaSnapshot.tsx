"use client"

import { useId, type ReactNode } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronsUpDown,
  Cog,
  MapPin,
  Minus,
  PackagePlus,
  Palette,
  Plus,
  Ruler,
  Scale,
  TrendingDown,
  Warehouse,
  Weight,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router-dom"

import { formatDecimalDisplay, formatDecimalTwoDisplay, lamMaterialMetrosDisplay } from "@/lib/decimal-two-input"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
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

function TintasPlanillaAccordionPanel({
  id,
  title,
  icon: Icon,
  headerClass,
  defaultOpen = false,
  children,
}: {
  id: string
  title: string
  icon: LucideIcon
  headerClass: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="tintas-planilla-accordion__item overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <CollapsibleTrigger
        id={id}
        className={cn(
          "section-header group flex w-full min-h-[3.25rem] items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          headerClass,
        )}
      >
        <span className="inline-flex min-w-0 flex-1 items-center gap-2.5 text-base font-semibold text-white">
          <Icon className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
          <span className="min-w-0 leading-snug">{title}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-black/10 px-2 py-1 text-xs font-medium text-white/90 no-print">
          <span className="hidden sm:inline">Ver / ocultar</span>
          <ChevronDown
            className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 bg-background px-4 py-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Datos técnicos de impresión y tintas definidos en la planilla OT (solo lectura). */
export function WorkOrderTintasPlanillaSnapshot({ form }: { form: Record<string, unknown> }) {
  const sustratosImp = getSustratosImp(form)
  const baseId = useId().replace(/:/g, "")
  const sid = (suffix: string) => `${baseId}-${suffix}`

  return (
    <div className="ax-ot tintas-planilla-accordion space-y-3">
      <p className="rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2.5 text-sm leading-relaxed text-muted-foreground no-print">
        <span className="font-medium text-foreground">Datos de la planilla.</span> Toque cada bloque para desplegarlo u
        ocultarlo. Así puede revisar la información paso a paso, sin saturarse.
      </p>

      <TintasPlanillaAccordionPanel
        id={sid("acc-parametros")}
        title="Parámetros de impresión"
        icon={Cog}
        headerClass="section-hdr-impresion"
        defaultOpen
      >
        <div className="ot-imp-params">
          <div className="ot-grid ot-cols-2 ot-imp-metrics-grid lg:ot-cols-4">
            <div className="ot-field">
              <label htmlFor={sid("pinon")} className="ot-label required">
                Piñon (dientes)
              </label>
              <OtPlanillaInputIcon icon={Cog}>
                <input
                  id={sid("pinon")}
                  name="pinonImp"
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
              <label htmlFor={sid("linea-corte")} className="ot-label required">
                Linea de corte
              </label>
              <Button
                type="button"
                id={sid("linea-corte")}
                name="lineaCorte"
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
            <div className="ot-field">
              <label htmlFor={sid("ubic-fotocelda")} className="ot-label">
                Ubic. fotocelda
              </label>
              <OtPlanillaInputIcon icon={MapPin}>
                <input
                  id={sid("ubic-fotocelda")}
                  name="ubicFotoceldaImp"
                  data-field="ubicFotoceldaImp"
                  type="text"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  placeholder="N/A"
                  value={lamMaterialMetrosDisplay(form.ubicFotoceldaImp, "ubicFotoceldaImp", null)}
                />
              </OtPlanillaInputIcon>
            </div>
            <div className="ot-field">
              <label htmlFor={sid("gramaje-tinta")} className="ot-label">
                Gramaje de tinta (g/m²)
              </label>
              <OtPlanillaInputIcon icon={Scale}>
                <input
                  id={sid("gramaje-tinta")}
                  name="gramajeTintaGm2"
                  data-field="gramajeTintaGm2"
                  type="text"
                  className="ot-input"
                  readOnly
                  tabIndex={-1}
                  inputMode="decimal"
                  placeholder="12,50"
                  value={formatDecimalTwoDisplay(readNumberString(form.gramajeTintaGm2))}
                />
              </OtPlanillaInputIcon>
            </div>
          </div>

          <div className="ot-field ot-imp-figura-field" data-field="figEmbImpDisplay">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={sid("fig-emb")} className="ot-label required">
                Figura emb. (1-8)
              </label>
              <Badge
                variant="outline"
                className="text-[10px] font-normal"
                title="Botones 1–8 = atajo para el valor de la figura."
              >
                Figura
              </Badge>
            </div>
            <WindingFigurePicker
              figureInputId={sid("fig-emb")}
              value={readString(form.figEmbImpDisplay)}
              onChange={() => {}}
              disabled
            />
          </div>
        </div>
      </TintasPlanillaAccordionPanel>

      <TintasPlanillaAccordionPanel
        id={sid("acc-sustratos")}
        title="Sustratos virgen (inventario)"
        icon={Warehouse}
        headerClass="section-hdr-impresion"
      >
        <div className="ot-sustratos-virgen-block ot-sustratos-virgen-block--impresion border-0 p-0 shadow-none">
          <p className="text-muted-foreground mb-3 text-sm leading-relaxed no-print">
            <span className="font-medium text-foreground">Sustrato:</span> puede escribir la referencia o elegir del
            inventario al hacer clic en el campo.
          </p>
          <div className="ot-sustratos-virgen-rows">
            {sustratosImp.map((r, idx) => (
              <div key={idx} className="ot-grid ot-cols-2-asym">
                <div className="ot-field">
                  <label htmlFor={sid(`sustrato-mat-${idx}`)} className="ot-label required">{`Sustrato ${idx + 1}`}</label>
                  <div className="flex min-w-0 gap-1 no-print">
                    <OtPlanillaInputIcon icon={Warehouse} className="min-w-0 flex-1">
                      <Input
                        id={sid(`sustrato-mat-${idx}`)}
                        name={`sustratoVirgenImp${idx + 1}`}
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
                  <label htmlFor={sid(`sustrato-kg-${idx}`)} className="ot-label required">
                    Kg a utilizar
                  </label>
                  <OtPlanillaInputIcon icon={Weight}>
                    <input
                      id={sid(`sustrato-kg-${idx}`)}
                      name={`kgUtilizarImp${idx + 1}`}
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
      </TintasPlanillaAccordionPanel>

      <TintasPlanillaAccordionPanel
        id={sid("acc-metricas")}
        title="Kg, merma y metros"
        icon={Scale}
        headerClass="section-hdr-impresion"
      >
        <div className="ot-grid ot-cols-2 lg:ot-cols-4">
          <div className="ot-field">
            <label htmlFor={sid("kg-ingresado")} className="ot-label required">
              Kg ingresado
            </label>
            <OtPlanillaInputIcon icon={ArrowDownToLine}>
              <input
                id={sid("kg-ingresado")}
                name="kgIngresadoImp"
                data-field="kgIngresadoImp"
                type="text"
                inputMode="decimal"
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="1850,50"
                aria-invalid={false}
                value={formatDecimalTwoDisplay(readNumberString(form.kgIngresadoImp))}
              />
            </OtPlanillaInputIcon>
          </div>
          <div className="ot-field">
            <label htmlFor={sid("kg-salida")} className="ot-label required">
              Kg salida
            </label>
            <OtPlanillaInputIcon icon={ArrowUpFromLine}>
              <input
                id={sid("kg-salida")}
                name="kgSalidaImp"
                data-field="kgSalidaImp"
                type="text"
                inputMode="decimal"
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="1825,00"
                aria-invalid={false}
                value={formatDecimalTwoDisplay(readNumberString(form.kgSalidaImp))}
              />
            </OtPlanillaInputIcon>
          </div>
          <div className="ot-field">
            <label htmlFor={sid("merma")} className="ot-label required">
              Merma
            </label>
            <OtPlanillaInputIcon icon={TrendingDown}>
              <input
                id={sid("merma")}
                name="mermaImp"
                data-field="mermaImp"
                type="text"
                inputMode="decimal"
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="14,25"
                aria-invalid={false}
                value={formatDecimalTwoDisplay(readNumberString(form.mermaImp))}
              />
            </OtPlanillaInputIcon>
          </div>
          <div className="ot-field">
            <label htmlFor={sid("metros")} className="ot-label required">
              Metros
            </label>
            <OtPlanillaInputIcon icon={Ruler}>
              <input
                id={sid("metros")}
                name="metrosImp"
                data-field="metrosImp"
                type="text"
                inputMode="decimal"
                className="ot-input"
                readOnly
                tabIndex={-1}
                placeholder="8200,00"
                aria-invalid={false}
                value={formatDecimalDisplay(readNumberString(form.metrosImp))}
              />
            </OtPlanillaInputIcon>
          </div>
        </div>
      </TintasPlanillaAccordionPanel>

      <TintasPlanillaAccordionPanel
        id={sid("acc-tintas")}
        title="Descripción de tintas"
        icon={Palette}
        headerClass="section-hdr-tintas"
      >
        <WorkOrderPrintingInkTable form={form} readOnly embedded />
      </TintasPlanillaAccordionPanel>
    </div>
  )
}
