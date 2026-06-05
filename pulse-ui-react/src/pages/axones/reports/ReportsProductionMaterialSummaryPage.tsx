"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Layers, Package, Scissors, Users } from "lucide-react"
import { toast } from "sonner"

import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
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

function formatMaterialLines(
  lines: MaterialSalidaLine[] | undefined,
  unit: "bobina" | "rollo",
): string[] {
  if (!lines?.length) return []
  return lines.map((line) => {
    const count = line.bobinas > 0 ? ` · ${line.bobinas} ${unit}${line.bobinas === 1 ? "" : "s"}` : ""
    return `${line.label}: ${line.kg} Kg${count}`
  })
}

function buildKpiSubtext({
  countLabel,
  emptyLabel,
  lines,
  lineUnit,
}: {
  countLabel?: string
  emptyLabel: string
  lines?: MaterialSalidaLine[]
  lineUnit: "bobina" | "rollo"
}): string {
  const materialLines = formatMaterialLines(lines, lineUnit)
  if (materialLines.length > 0) {
    return [countLabel, ...materialLines].filter(Boolean).join("\n")
  }
  return countLabel ?? emptyLabel
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Package
}) {
  const subLines = sub?.split("\n").filter(Boolean) ?? []

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight">{value} Kg</p>
          {subLines.length > 0 ? (
            <div className="text-muted-foreground mt-1 space-y-0.5 text-xs leading-snug">
              {subLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <KpiCard
          label="Total material impreso"
          value={totals?.material_impreso_kg ?? "0.000"}
          sub={buildKpiSubtext({
            countLabel:
              totals && totals.impreso_bobinas > 0
                ? `${totals.impreso_bobinas} bobina(s) de salida en impresión`
                : undefined,
            emptyLabel: "Suma de pesos de bobina impresa (referencia en etiqueta o sustrato planilla)",
            lines: totals?.material_impreso_lines,
            lineUnit: "bobina",
          })}
          icon={Package}
        />
        <KpiCard
          label="Total material laminado"
          value={totals?.material_laminado_kg ?? "0.000"}
          sub={buildKpiSubtext({
            countLabel:
              totals && totals.laminado_bobinas > 0
                ? `${totals.laminado_bobinas} bobina(s) de salida en laminación`
                : undefined,
            emptyLabel: "Suma de pesos de bobina laminada (referencia en etiqueta o sustrato planilla)",
            lines: totals?.material_laminado_lines,
            lineUnit: "bobina",
          })}
          icon={Layers}
        />
        <KpiCard
          label="Total material cortado"
          value={totals?.material_cortado_kg ?? "0.000"}
          sub={buildKpiSubtext({
            emptyLabel: "Suma de pesos de salida en corte (rollos por paleta / turnos)",
            lines: totals?.material_cortado_lines,
            lineUnit: "rollo",
          })}
          icon={Scissors}
        />
      </div>

      {totals ? (
        <div className="bg-card rounded-2xl border px-4 py-3 shadow-sm">
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">Total general (impreso + laminado + corte):</strong>{" "}
            <span className="font-mono tabular-nums">{totals.total_general_kg} Kg</span>
            {payload?.work_order_count != null ? (
              <>
                {" "}
                · {payload.work_order_count} OT{payload.work_order_count === 1 ? "" : "s"} con producción
                registrada
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <TableHead>OT</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Impreso (Kg)</TableHead>
              <TableHead className="text-right">Laminado (Kg)</TableHead>
              <TableHead className="text-right">Cortado (Kg)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Sin producción registrada en este período con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.work_order_id} className={catalogTableBodyRowClass}>
                  <TableCell className={catalogTableBodyCellClass}>{r.work_order_code}</TableCell>
                  <TableCell className={catalogTableBodyCellClass}>{r.client_name ?? "—"}</TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                    {r.material_impreso_kg}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                    {r.material_laminado_kg}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                    {r.material_cortado_kg}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {totals && rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {totals.material_impreso_kg}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {totals.material_laminado_kg}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {totals.material_cortado_kg}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" disabled={listLoading} onClick={() => void loadSummary()}>
          Actualizar
        </Button>
      </div>
    </ReportPageShell>
  )
}
