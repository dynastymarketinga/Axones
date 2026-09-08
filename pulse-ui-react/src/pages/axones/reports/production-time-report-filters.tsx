"use client"

import type { ReactNode } from "react"
import { CalendarDays, Factory } from "lucide-react"

import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import type { ReportWorkOrderOption } from "@/components/axones/reports/ReportWorkOrderPicker"
import { ReportWorkOrderPicker } from "@/components/axones/reports/ReportWorkOrderPicker"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { catalogFilterDateInputClass } from "@/components/axones/catalog-list-classes"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { WorkOrderTimeCandidate } from "./report-shared"
import type { ReportFiltersTheme } from "./report-identities"

type ProductionTimeReportFiltersProps = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  includeLive: boolean
  onIncludeLiveChange: (checked: boolean) => void
  aggregateAll: boolean
  onAggregateAllChange: (checked: boolean) => void
  woId: string
  onWoIdChange: (id: string) => void
  candidates: WorkOrderTimeCandidate[]
  loading?: boolean
  actionsSlot: ReactNode
  theme: ReportFiltersTheme
  // 🔥 NUEVOS PROPS PARA EL FILTRO DE MÁQUINA
  machineFilter?: string
  onMachineFilterChange?: (v: string) => void
}

function FilterColumn({
  title,
  accentClass,
  dotClass,
  children,
  className,
  showDivider = false,
}: {
  title: string
  accentClass: string
  dotClass: string
  children: ReactNode
  className?: string
  showDivider?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden space-y-2.5 sm:space-y-3",
        showDivider && "lg:border-border lg:border-l lg:pl-4",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
          accentClass,
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />
        {title}
      </p>
      {children}
    </div>
  )
}

export function ProductionTimeReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  includeLive,
  onIncludeLiveChange,
  aggregateAll,
  onAggregateAllChange,
  woId,
  onWoIdChange,
  candidates,
  loading,
  actionsSlot,
  theme,
  machineFilter,
  onMachineFilterChange,
}: ProductionTimeReportFiltersProps) {
  const woPickerOptions: ReportWorkOrderOption[] = candidates.map((r) => ({
    work_order_id: r.work_order_id,
    work_order_code: r.work_order_code,
    client_name: r.client_name,
    product_name: r.product_name,
  }))

  // 🔥 LÓGICA DE LOS BOTONES DE FECHA (DIARIO Y SEMANAL)
  function setHoy() {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - offset)).toISOString().slice(0, 10);
    onFromChange(localISOTime);
    onToChange(localISOTime);
  }

  function setEstaSemana() {
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1);
    const last = first + 6;

    const monday = new Date(curr.setDate(first));
    const offsetMon = monday.getTimezoneOffset() * 60000;
    const mondayStr = (new Date(monday.getTime() - offsetMon)).toISOString().slice(0, 10);

    const sunday = new Date(curr.setDate(last));
    const offsetSun = sunday.getTimezoneOffset() * 60000;
    const sundayStr = (new Date(sunday.getTime() - offsetSun)).toISOString().slice(0, 10);

    onFromChange(mondayStr);
    onToChange(sundayStr);
  }

  return (
    <ReportFiltersPanel
      subtitle="Período, vista en pantalla, orden de trabajo y exportación de tiempos"
      loading={loading}
      activeFilterCount={(aggregateAll ? 1 : 0) + (woId.trim() ? 1 : 0) + (includeLive ? 1 : 0) + (machineFilter?.trim() ? 1 : 0)}
      theme={theme}
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        <FilterColumn
          title="Período y Máquina"
          accentClass="text-sky-800 dark:text-sky-200"
          dotClass="bg-sky-500"
        >
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-3">
            <CatalogLabeledField label="Desde" icon={CalendarDays} className="min-w-0">
              <Input
                type="date"
                value={from}
                onChange={(ev) => onFromChange(ev.target.value)}
                className={cn(catalogFilterDateInputClass, "border-sky-500/30 focus-visible:ring-sky-500/25")}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Hasta" icon={CalendarDays} className="min-w-0">
              <Input
                type="date"
                value={to}
                onChange={(ev) => onToChange(ev.target.value)}
                className={cn(catalogFilterDateInputClass, "border-sky-500/30 focus-visible:ring-sky-500/25")}
              />
            </CatalogLabeledField>
          </div>
          
          {/* 🔥 BOTONES ATAJO DIARIO Y SEMANAL */}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-sky-500/30" onClick={setHoy}>
              Hoy (Diario)
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-sky-500/30" onClick={setEstaSemana}>
              Esta Semana
            </Button>
          </div>

          {/* 🔥 SELECTOR DE MÁQUINA */}
          <div className="pt-2">
            <CatalogLabeledField label="Máquina" icon={Factory} className="min-w-0">
              <select
                value={machineFilter || ""}
                onChange={(e) => onMachineFilterChange?.(e.target.value)}
                className={cn("flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors outline-none", "border-sky-500/30 focus-visible:ring-sky-500/25")}
              >
                <option value="">Todas las máquinas</option>
                <option value="Cortadora China">Cortadora China</option>
                <option value="Cortadora Permaco">Cortadora Permaco</option>
                <option value="Laminadora Nexus">Laminadora Nexus</option>
                <option value="Laminadora 2">Laminadora 2</option>
              </select>
            </CatalogLabeledField>
          </div>
        </FilterColumn>

        <FilterColumn
          title="Vista en pantalla"
          accentClass="text-sky-800 dark:text-sky-200"
          dotClass="bg-sky-500"
          showDivider
        >
          <div className="flex items-start gap-2">
            <Checkbox
              id="include-live"
              className="mt-0.5"
              checked={includeLive}
              onCheckedChange={(v) => onIncludeLiveChange(v === true)}
            />
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="include-live" className="cursor-pointer text-sm font-normal leading-snug">
                Incluir turnos en curso (tiempo real)
              </Label>
              {includeLive ? (
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  <strong className="text-foreground">Modo pantalla: tiempo real.</strong> Suma turnos abiertos y
                  cronómetro Montaje. Se actualiza cada 30 s. Recomendado para ver la planta <em>hoy</em>.
                </p>
              ) : (
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  <strong className="text-foreground">Modo pantalla: solo cerrados.</strong> Mismo criterio que PDF y
                  Excel. Recomendado para cuadrar cifras antes de exportar o cerrar el mes.
                </p>
              )}
              <p className="text-muted-foreground text-[10px] leading-relaxed">
                PDF y Excel <strong>siempre</strong> usan segmentos cerrados, independientemente de este toggle.
              </p>
            </div>
          </div>
        </FilterColumn>

        <FilterColumn
          title="Orden de trabajo"
          accentClass="text-amber-800 dark:text-amber-200"
          dotClass="bg-amber-500"
          showDivider
          className="sm:col-span-2"
        >
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="aggregate-all"
                checked={aggregateAll}
                onCheckedChange={(v) => onAggregateAllChange(v === true)}
              />
              <Label htmlFor="aggregate-all" className="cursor-pointer text-sm font-normal leading-snug">
                Agregado de todas las OT del rango
              </Label>
            </div>
            <ReportWorkOrderPicker
              value={woId}
              onValueChange={onWoIdChange}
              options={woPickerOptions}
              mode="static"
              disabled={aggregateAll}
              placeholder="Seleccione en la tabla o busque por código…"
              highlighted={!aggregateAll && !!woId.trim()}
            />
          </div>
        </FilterColumn>

        <FilterColumn
          title="Acciones"
          accentClass="text-emerald-800 dark:text-emerald-200"
          dotClass="bg-emerald-500"
          showDivider
          className="sm:col-span-2"
        >
          {actionsSlot}
        </FilterColumn>
      </div>
    </ReportFiltersPanel>
  )
}