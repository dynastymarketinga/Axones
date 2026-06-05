"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Droplets, Factory, FlaskConical, Layers2, Users } from "lucide-react"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError, apiFetch } from "@/lib/api"
import { formatQuantityDisplay } from "@/lib/numeric-display"
import { cn } from "@/lib/utils"

import { ConsumablesSummaryReportFilters } from "./consumables-summary-report-filters"
import { getReportIdentity } from "./ReportIdentityBanner"
import { ReportPageShell, useReportRange } from "./report-shared"
import { useReportEntityFilters } from "./use-report-entity-filters"

type ConsumablesSummaryPayload = {
  totals: {
    tintas: {
      total_original_kg: string
      total_solventadas_kg: string
      alcohol_kg: string
      metoxil_kg: string
      npa_kg: string
    }
    laminacion: {
      adhesivo_sobra_kg: string
      catalizador_sobra_kg: string
      acetato_sobra_lt: string
      adhesivo_consumido_kg: string
      catalizador_consumido_kg: string
      acetato_consumido_lt: string
      total_consumible_kg: string
      material_virgen_entrada_kg: string
    }
    impresion: {
      material_consumido_kg: string
    }
  }
  work_orders: Array<{
    work_order_id: number
    work_order_code: string
    client_name: string | null
    tintas_original_kg: string
    tintas_solventadas_kg: string
    tintas_alcohol_kg: string
    tintas_metoxil_kg: string
    tintas_npa_kg: string
    lam_adhesivo_sobra_kg: string
    lam_catalizador_sobra_kg: string
    lam_acetato_sobra_lt: string
    lam_adhesivo_consumido_kg: string
    lam_catalizador_consumido_kg: string
    lam_acetato_consumido_lt: string
    impresion_entrada_kg: string
    laminacion_virgen_entrada_kg: string
  }>
  work_order_count: number
}

function fmtQty(value: string | number | null | undefined): string {
  return formatQuantityDisplay(value) || "0"
}

function MetricCard({
  label,
  value,
  unit = "Kg",
  icon: Icon,
}: {
  label: string
  value: string
  unit?: string
  icon: typeof FlaskConical
}) {
  return (
    <div className="rounded-xl border bg-background/80 p-3.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide leading-snug">
            {label}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight">
            {value} {unit}
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionBlock({
  title,
  accentClass,
  dotClass,
  children,
}: {
  title: string
  accentClass: string
  dotClass: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className={cn("flex items-center gap-2 text-sm font-semibold tracking-tight", accentClass)}>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function ReportsConsumablesSummaryPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()
  const entity = useReportEntityFilters()
  const [payload, setPayload] = useState<ConsumablesSummaryPayload | null>(null)
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
      const data = await apiFetch<ConsumablesSummaryPayload>("reports/consumables-summary", { query })
      setPayload(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el reporte de consumibles.")
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
      identityKey="consumibles"
      title="Reporte de consumible"
      description="Insumos agregados del período: tintas, químicos de laminación y entradas de material virgen (todas las OTs)."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      showRange={false}
    >
      <ConsumablesSummaryReportFilters
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
          void downloadCsv("reports/consumables-summary", "reporte-consumibles.csv", query)
        }
        theme={getReportIdentity("consumibles").theme}
      />

      <SectionBlock title="Tintas" accentClass="text-violet-800 dark:text-violet-200" dotClass="bg-violet-500">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Total original"
            value={fmtQty(totals?.tintas.total_original_kg)}
            icon={FlaskConical}
          />
          <MetricCard
            label="Total solventadas"
            value={fmtQty(totals?.tintas.total_solventadas_kg)}
            icon={FlaskConical}
          />
          <MetricCard label="Alcohol" value={fmtQty(totals?.tintas.alcohol_kg)} icon={Droplets} />
          <MetricCard label="Metoxil" value={fmtQty(totals?.tintas.metoxil_kg)} icon={Droplets} />
          <MetricCard label="NPA" value={fmtQty(totals?.tintas.npa_kg)} icon={Droplets} />
        </div>
      </SectionBlock>

      <SectionBlock title="Laminación — sobra" accentClass="text-violet-800 dark:text-violet-200" dotClass="bg-violet-400">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Adhesivo sobro"
            value={fmtQty(totals?.laminacion.adhesivo_sobra_kg)}
            icon={Layers2}
          />
          <MetricCard
            label="Catalizador sobro"
            value={fmtQty(totals?.laminacion.catalizador_sobra_kg)}
            icon={Layers2}
          />
          <MetricCard
            label="Acetato sobro"
            value={fmtQty(totals?.laminacion.acetato_sobra_lt)}
            unit="Lt"
            icon={Layers2}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Entrada de material" accentClass="text-sky-800 dark:text-sky-200" dotClass="bg-sky-500">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Material consumido en impresión"
            value={fmtQty(totals?.impresion.material_consumido_kg)}
            icon={Factory}
          />
          <MetricCard
            label="Total entrada laminación (virgen)"
            value={fmtQty(totals?.laminacion.material_virgen_entrada_kg)}
            icon={Layers2}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Laminación — consumible" accentClass="text-emerald-800 dark:text-emerald-200" dotClass="bg-emerald-500">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Adhesivo consumido"
            value={fmtQty(totals?.laminacion.adhesivo_consumido_kg)}
            icon={Layers2}
          />
          <MetricCard
            label="Catalizador consumido"
            value={fmtQty(totals?.laminacion.catalizador_consumido_kg)}
            icon={Layers2}
          />
          <MetricCard
            label="Acetato consumido"
            value={fmtQty(totals?.laminacion.acetato_consumido_lt)}
            unit="Lt"
            icon={Layers2}
          />
          <MetricCard
            label="Total consumible (adhesivo + catalizador)"
            value={fmtQty(totals?.laminacion.total_consumible_kg)}
            icon={Layers2}
          />
        </div>
      </SectionBlock>

      {payload?.work_order_count != null ? (
        <div className="bg-card rounded-2xl border px-4 py-3 shadow-sm">
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">
              {payload.work_order_count} OT{payload.work_order_count === 1 ? "" : "s"}
            </strong>{" "}
            con consumibles registrados en el período.
          </p>
        </div>
      ) : null}

      <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <TableHead className="sticky left-0 z-10 bg-card">OT</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Orig. tinta</TableHead>
              <TableHead className="text-right">Solvent.</TableHead>
              <TableHead className="text-right">Alcohol</TableHead>
              <TableHead className="text-right">Metoxil</TableHead>
              <TableHead className="text-right">NPA</TableHead>
              <TableHead className="text-right">Adh. sobra</TableHead>
              <TableHead className="text-right">Cat. sobra</TableHead>
              <TableHead className="text-right">Ace. sobra</TableHead>
              <TableHead className="text-right">Imp. entrada</TableHead>
              <TableHead className="text-right">Lam. virgen</TableHead>
              <TableHead className="text-right">Adh. cons.</TableHead>
              <TableHead className="text-right">Cat. cons.</TableHead>
              <TableHead className="text-right">Ace. cons.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              <TableRow>
                <TableCell colSpan={15} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={15} className="text-muted-foreground">
                  Sin consumibles registrados en este período con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.work_order_id} className={catalogTableBodyRowClass}>
                  <TableCell className={cn("sticky left-0 z-10 bg-card", catalogTableBodyCellClass)}>
                    {r.work_order_code}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>{r.client_name ?? "—"}</TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.tintas_original_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.tintas_solventadas_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.tintas_alcohol_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.tintas_metoxil_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.tintas_npa_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.lam_adhesivo_sobra_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.lam_catalizador_sobra_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.lam_acetato_sobra_lt)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.impresion_entrada_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.laminacion_virgen_entrada_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.lam_adhesivo_consumido_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.lam_catalizador_consumido_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {fmtQty(r.lam_acetato_consumido_lt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
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
