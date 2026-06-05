"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Layers, Package, Scissors, Users } from "lucide-react"
import { toast } from "sonner"

import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

import { ProductionMaterialSummaryReportFilters } from "./production-material-summary-report-filters"
import { getReportIdentity } from "./ReportIdentityBanner"
import { ReportPageShell, useReportRange } from "./report-shared"
import { useReportEntityFilters } from "./use-report-entity-filters"

type MaterialSalidaLine = {
  label: string
  kg: string
  bobinas: number
}

type ProductionMaterialSummaryPayload = {
  totals: {
    material_impreso_kg: string
    material_laminado_kg: string
    material_cortado_kg: string
    total_general_kg: string
    impreso_bobinas: number
    laminado_bobinas: number
    material_impreso_lines?: MaterialSalidaLine[]
    material_laminado_lines?: MaterialSalidaLine[]
    material_cortado_lines?: MaterialSalidaLine[]
  }
  work_orders: Array<{
    work_order_id: number
    work_order_code: string
    client_name: string | null
    material_impreso_kg: string
    material_laminado_kg: string
    material_cortado_kg: string
    impreso_bobinas: number
    laminado_bobinas: number
    material_impreso_lines?: MaterialSalidaLine[]
    material_laminado_lines?: MaterialSalidaLine[]
    material_cortado_lines?: MaterialSalidaLine[]
  }>
  work_order_count: number
}

const SIN_REFERENCIA_LABELS = new Set([
  "Bobina impresa (sin referencia)",
  "Bobina laminada (sin referencia)",
  "Material cortado (rollos / paletas)",
])

type AreaTheme = {
  panel: string
  header: string
  icon: string
  tile: string
  tileWarn: string
  accent: string
}

const AREA_THEMES: Record<"impreso" | "laminado" | "cortado", AreaTheme> = {
  impreso: {
    panel: "border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card ring-1 ring-emerald-500/15",
    header: "border-emerald-500/25 bg-emerald-500/[0.08]",
    icon: "bg-emerald-600 text-white",
    tile: "border-emerald-500/30 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.1]",
    tileWarn: "border-amber-400/50 bg-amber-500/[0.08]",
    accent: "text-emerald-700 dark:text-emerald-300",
  },
  laminado: {
    panel: "border-sky-500/35 bg-gradient-to-br from-sky-500/[0.07] via-card to-card ring-1 ring-sky-500/15",
    header: "border-sky-500/25 bg-sky-500/[0.08]",
    icon: "bg-sky-600 text-white",
    tile: "border-sky-500/30 bg-sky-500/[0.06] hover:bg-sky-500/[0.1]",
    tileWarn: "border-amber-400/50 bg-amber-500/[0.08]",
    accent: "text-sky-700 dark:text-sky-300",
  },
  cortado: {
    panel: "border-violet-500/35 bg-gradient-to-br from-violet-500/[0.07] via-card to-card ring-1 ring-violet-500/15",
    header: "border-violet-500/25 bg-violet-500/[0.08]",
    icon: "bg-violet-600 text-white",
    tile: "border-violet-500/30 bg-violet-500/[0.06] hover:bg-violet-500/[0.1]",
    tileWarn: "border-amber-400/50 bg-amber-500/[0.08]",
    accent: "text-violet-700 dark:text-violet-300",
  },
}

function isSinReferencia(label: string): boolean {
  return SIN_REFERENCIA_LABELS.has(label)
}

function MaterialBreakdownTile({
  line,
  unit,
  theme,
}: {
  line: MaterialSalidaLine
  unit: "bobina" | "rollo"
  theme: AreaTheme
}) {
  const warn = isSinReferencia(line.label)
  const countLabel =
    line.bobinas > 0
      ? `${line.bobinas} ${unit}${line.bobinas === 1 ? "" : "s"}`
      : null

  return (
    <div
      className={cn(
        "flex min-h-[5.5rem] flex-col justify-between rounded-xl border-2 p-3 shadow-sm transition-colors",
        warn ? theme.tileWarn : theme.tile,
      )}
    >
      <div className="space-y-1">
        <p className={cn("text-sm font-semibold leading-snug", warn ? "text-amber-900 dark:text-amber-100" : "text-foreground")}>
          {line.label}
        </p>
        {warn ? (
          <p className="text-amber-800/90 flex items-start gap-1.5 text-xs leading-relaxed dark:text-amber-200/90">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Defina el sustrato en la planilla OT (Sustratos virgen) o la referencia en cada bobina de salida.
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="font-mono text-xl font-bold tabular-nums tracking-tight">{line.kg}</p>
        <span className="text-muted-foreground text-sm font-medium">Kg</span>
      </div>
      {countLabel ? (
        <p className="text-muted-foreground mt-2 text-sm font-medium">{countLabel}</p>
      ) : null}
    </div>
  )
}

function MaterialAreaPanel({
  areaKey,
  title,
  totalKg,
  bobinasCount,
  bobinasLabel,
  lines,
  unit,
  emptyHint,
  icon: Icon,
}: {
  areaKey: "impreso" | "laminado" | "cortado"
  title: string
  totalKg: string
  bobinasCount?: number
  bobinasLabel?: string
  lines?: MaterialSalidaLine[]
  unit: "bobina" | "rollo"
  emptyHint: string
  icon: typeof Package
}) {
  const theme = AREA_THEMES[areaKey]
  const breakdown = lines?.filter((l) => parseFloat(l.kg) > 0) ?? []
  const hasBreakdown = breakdown.length > 0

  return (
    <section className={cn("flex h-full flex-col overflow-hidden rounded-2xl border shadow-md", theme.panel)}>
      <header className={cn("flex flex-col gap-3 border-b px-4 py-4", theme.header)}>
        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm", theme.icon)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[0.65rem] font-semibold uppercase tracking-widest">{title}</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight">{totalKg} Kg</p>
          {bobinasCount != null && bobinasCount > 0 && bobinasLabel ? (
            <p className={cn("mt-1 text-xs font-medium leading-snug", theme.accent)}>{bobinasLabel}</p>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 flex-col space-y-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-foreground text-[0.65rem] font-semibold uppercase tracking-wide leading-snug">
            Desglose por material / referencia
          </h3>
          {hasBreakdown ? (
            <span className="text-muted-foreground shrink-0 text-xs">
              {breakdown.length} material{breakdown.length === 1 ? "" : "es"}
            </span>
          ) : null}
        </div>

        {hasBreakdown ? (
          <div className="grid flex-1 grid-cols-1 gap-3">
            {breakdown.map((line) => (
              <MaterialBreakdownTile key={`${line.label}-${line.kg}`} line={line} unit={unit} theme={theme} />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 text-center">
            <p className="text-muted-foreground text-xs leading-relaxed">{emptyHint}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function OtMaterialBreakdown({ lines, unit }: { lines?: MaterialSalidaLine[]; unit: "bobina" | "rollo" }) {
  const breakdown = lines?.filter((l) => parseFloat(l.kg) > 0) ?? []
  if (!breakdown.length) return <span className="text-muted-foreground">—</span>

  return (
    <ul className="space-y-1.5 text-left">
      {breakdown.map((line) => (
        <li key={`${line.label}-${line.kg}`} className="text-sm leading-snug">
          <span className={cn("font-medium", isSinReferencia(line.label) ? "text-amber-800 dark:text-amber-200" : "text-foreground")}>
            {line.label}
          </span>
          <span className="text-muted-foreground">
            {": "}
            <span className="font-mono tabular-nums">{line.kg}</span> Kg
            {line.bobinas > 0 ? ` · ${line.bobinas} ${unit}${line.bobinas === 1 ? "" : "s"}` : ""}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function ReportsProductionMaterialSummaryPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()
  const entity = useReportEntityFilters()
  const [payload, setPayload] = useState<ProductionMaterialSummaryPayload | null>(null)
  const [listLoading, setListLoading] = useState(false)

  const query = useMemo(
    () => ({
      from,
      to,
      client_id: entity.clientIdQ,
    }),
    [from, to, entity.clientIdQ],
  )

  const loadSummary = useCallback(async () => {
    setListLoading(true)
    try {
      const data = await apiFetch<ProductionMaterialSummaryPayload>(
        "reports/production-material-summary",
        { query },
      )
      setPayload(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el resumen de producción.")
      setPayload(null)
    } finally {
      setListLoading(false)
    }
  }, [query])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const totals = payload?.totals
  const rows = payload?.work_orders ?? []
  const activeFilterCount = entity.clientFilter !== "all" ? 1 : 0

  return (
    <ReportPageShell
      identityKey="resumen-produccion"
      title="Resumen de producción"
      description="Kg de material producido (salida en planilla): bobinas impresas, laminadas y rollos cortados — con desglose por referencia o sustrato."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      showRange={false}
    >
      <ProductionMaterialSummaryReportFilters
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        loading={listLoading}
        activeFilterCount={activeFilterCount}
        chips={
          entity.clientFilter !== "all"
            ? [
                {
                  id: "client",
                  label: entity.selectedClientLabel,
                  icon: <Users className="h-3 w-3" aria-hidden />,
                  onRemove: () => entity.setClientFilter("all"),
                  removeLabel: "Quitar filtro de cliente",
                },
              ]
            : undefined
        }
        onClearAll={entity.clientFilter !== "all" ? () => entity.setClientFilter("all") : undefined}
        clientFilter={entity.clientFilter}
        onClientFilterChange={entity.setClientFilter}
        clients={entity.clients}
        clientComboOpen={entity.clientComboOpen}
        onClientComboOpenChange={entity.setClientComboOpen}
        selectedClientLabel={entity.selectedClientLabel}
        downloadDisabled={loading || listLoading}
        onDownload={() =>
          void downloadCsv("reports/production-material-summary", "resumen-produccion-material.csv", query)
        }
        theme={getReportIdentity("resumen-produccion").theme}
      />

      {listLoading && !totals ? (
        <div className="text-muted-foreground rounded-2xl border bg-card px-6 py-12 text-center text-sm">
          Cargando resumen de producción…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch lg:gap-5">
          <MaterialAreaPanel
            areaKey="impreso"
            title="Total material impreso"
            totalKg={totals?.material_impreso_kg ?? "0.000"}
            bobinasCount={totals?.impreso_bobinas}
            bobinasLabel={
              totals && totals.impreso_bobinas > 0
                ? `${totals.impreso_bobinas} bobina(s) de salida en impresión`
                : undefined
            }
            lines={totals?.material_impreso_lines}
            unit="bobina"
            emptyHint="Sin producción impresa en el período, o sin sustrato/referencia registrada en planilla OT."
            icon={Package}
          />

          <MaterialAreaPanel
            areaKey="laminado"
            title="Total material laminado"
            totalKg={totals?.material_laminado_kg ?? "0.000"}
            bobinasCount={totals?.laminado_bobinas}
            bobinasLabel={
              totals && totals.laminado_bobinas > 0
                ? `${totals.laminado_bobinas} bobina(s) de salida en laminación`
                : undefined
            }
            lines={totals?.material_laminado_lines}
            unit="bobina"
            emptyHint="Sin laminación registrada, o sin referencia en etiqueta / sustrato de planilla."
            icon={Layers}
          />

          <MaterialAreaPanel
            areaKey="cortado"
            title="Total material cortado"
            totalKg={totals?.material_cortado_kg ?? "0.000"}
            lines={totals?.material_cortado_lines}
            unit="rollo"
            emptyHint="Sin corte registrado en el período (rollos por paleta o turnos cerrados)."
            icon={Scissors}
          />
        </div>
      )}

      {totals ? (
        <div className="bg-card rounded-2xl border px-5 py-4 shadow-sm">
          <p className="text-base">
            <strong className="text-foreground">Total general (impreso + laminado + corte):</strong>{" "}
            <span className="font-mono text-lg font-semibold tabular-nums">{totals.total_general_kg} Kg</span>
            {payload?.work_order_count != null ? (
              <>
                {" "}
                · {payload.work_order_count} OT{payload.work_order_count === 1 ? "" : "s"} con producción registrada
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-foreground text-base font-semibold">Detalle por orden de trabajo</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Totales y desglose de material por OT (BOPP, poliéster, producto terminado, etc.).
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <TableHead>OT</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="min-w-[12rem]">Impreso — materiales</TableHead>
              <TableHead className="min-w-[12rem]">Laminado — materiales</TableHead>
              <TableHead className="min-w-[12rem]">Cortado — materiales</TableHead>
              <TableHead className="text-right">Total Kg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Sin producción registrada en este período con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const rowTotal =
                  parseFloat(r.material_impreso_kg) +
                  parseFloat(r.material_laminado_kg) +
                  parseFloat(r.material_cortado_kg)
                return (
                  <TableRow key={r.work_order_id} className={catalogTableBodyRowClass}>
                    <TableCell className={cn("align-top font-medium", catalogTableBodyCellClass)}>
                      {r.work_order_code}
                    </TableCell>
                    <TableCell className={cn("align-top", catalogTableBodyCellClass)}>{r.client_name ?? "—"}</TableCell>
                    <TableCell className={cn("align-top", catalogTableBodyCellClass)}>
                      <p className="mb-2 font-mono text-sm font-semibold tabular-nums">{r.material_impreso_kg} Kg</p>
                      <OtMaterialBreakdown lines={r.material_impreso_lines} unit="bobina" />
                    </TableCell>
                    <TableCell className={cn("align-top", catalogTableBodyCellClass)}>
                      <p className="mb-2 font-mono text-sm font-semibold tabular-nums">{r.material_laminado_kg} Kg</p>
                      <OtMaterialBreakdown lines={r.material_laminado_lines} unit="bobina" />
                    </TableCell>
                    <TableCell className={cn("align-top", catalogTableBodyCellClass)}>
                      <p className="mb-2 font-mono text-sm font-semibold tabular-nums">{r.material_cortado_kg} Kg</p>
                      <OtMaterialBreakdown lines={r.material_cortado_lines} unit="rollo" />
                    </TableCell>
                    <TableCell className={cn("align-top text-right font-mono font-semibold tabular-nums", catalogTableBodyCellClass)}>
                      {rowTotal.toFixed(3)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          {totals && rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total planta
                </TableCell>
                <TableCell className="font-mono font-semibold tabular-nums">{totals.material_impreso_kg} Kg</TableCell>
                <TableCell className="font-mono font-semibold tabular-nums">{totals.material_laminado_kg} Kg</TableCell>
                <TableCell className="font-mono font-semibold tabular-nums">{totals.material_cortado_kg} Kg</TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">{totals.total_general_kg}</TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </ReportPageShell>
  )
}
