import { z } from "zod";

import { buildSpaHref } from "../util/spa-routes.js";
import { fail, fromError, ok } from "../util/result.js";
import { defineTool } from "./registry.js";

const ISO_DATE = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use formato AAAA-MM-DD.");

interface ProductionTimePayload {
  totals?: Record<string, unknown>;
  rows?: unknown[];
  meta?: { from?: string; to?: string };
}

interface ScrapPayload {
  totals?: Record<string, unknown>;
  rows?: unknown[];
  meta?: { from?: string; to?: string };
}

export const analyzeScrapTool = defineTool({
  name: "axones_analyze_scrap",
  title: "Analizar desperdicio (scrap) por filtros",
  description: "Devuelve los datos de desperdicio agregados por OT/área en un rango de fechas. El LLM debe interpretar los datos para responder al usuario (no inventes cifras, usa solo lo que viene en 'data').",
  inputShape: {
    from: ISO_DATE.describe("Fecha inicial inclusiva."),
    to: ISO_DATE.describe("Fecha final inclusiva."),
    client_id: z.number().int().positive().optional(),
    product_id: z.number().int().positive().optional(),
    substrate_group: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Grupo de sustrato (BOPP, PE, etc.). 'all' por defecto."),
    layout: z
      .enum(["detail", "by_work_order", "by_area", "history_kg"])
      .optional()
      .describe("Forma de agrupación. 'by_area' es la más útil para comparar mermas entre áreas."),
  },
  handler: async (input, { api }) => {
    try {
      const data = await api.get<ScrapPayload>("/reports/scrap-by-filters", {
        query: {
          from: input.from,
          to: input.to,
          client_id: input.client_id,
          product_id: input.product_id,
          substrate_group: input.substrate_group,
          layout: input.layout ?? "by_area",
        },
      });
      const rows = Array.isArray(data.rows) ? data.rows.length : 0;
      const summary = `Scrap ${input.from} → ${input.to} · filas ${rows}`;
      return ok({ summary, data });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const analyzeProductionTimeTool = defineTool({
  name: "axones_analyze_production_time",
  title: "Analizar tiempos de producción por área",
  description: "Devuelve los tiempos de producción agregados por área (impresión, laminación, corte, montaje, tintas) en un rango. El LLM debe interpretar los datos (no inventes cifras).",
  inputShape: {
    from: ISO_DATE,
    to: ISO_DATE,
    live: z
      .boolean()
      .optional()
      .describe("Si es true, incluye segmentos activos (sin cierre). Por defecto false."),
  },
  handler: async (input, { api }) => {
    try {
      const data = await api.get<ProductionTimePayload>(
        "/reports/production-time-by-area",
        {
          query: { from: input.from, to: input.to, live: input.live ? "true" : undefined },
        },
      );
      const rows = Array.isArray(data.rows) ? data.rows.length : 0;
      const summary = `Tiempos por área ${input.from} → ${input.to} · filas ${rows}`;
      return ok({ summary, data });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const workOrderProductionSummaryTool = defineTool({
  name: "axones_work_order_production_summary",
  title: "Resumen de producción de una OT",
  description: "Resumen consolidado de producción para una OT: tiempos por área, materiales consumidos, scrap. Útil para responder '¿cómo va la OT X?'. Requiere rol con acceso a planilla.",
  inputShape: {
    work_order_id: z.number().int().positive(),
  },
  handler: async ({ work_order_id }, { api, config }) => {
    try {
      const data = await api.get<Record<string, unknown>>(
        `/work-orders/${work_order_id}/production-summary`,
      );
      const summary = `Resumen de producción de OT #${work_order_id}.`;
      return ok({
        summary,
        data,
        dots: [
          {
            type: "work_order",
            id: work_order_id,
            label: `OT #${work_order_id}`,
            href: buildSpaHref(config, "work_order", work_order_id),
          },
        ],
      });
    } catch (err) {
      return fromError(err);
    }
  },
});

function pickComparable(summary: Record<string, unknown>): Record<string, number> {
  const keys = [
    "corte_production_month_kg",
    "scrap_month_kg",
    "rejected_returns_bobinas_month",
    "materials_total",
    "inventory_returns_pending",
    "material_requests_pending",
    "work_orders_pending_programming",
    "work_orders_in_programming",
    "work_orders_pending_production",
    "operational_alerts_unread",
    "tinta_mixtures_total",
    "movements_today",
  ];
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = summary[k];
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

export const compareDashboardPeriodsTool = defineTool({
  name: "axones_compare_dashboard_periods",
  title: "Comparar dashboard entre dos momentos",
  description: "El dashboard refleja el momento actual; este tool lo llama una sola vez y deja preparada la estructura para que el LLM compare valores que el usuario haya capturado antes. Si se le pasan valores 'baseline', calcula deltas absolutos y porcentuales.",
  inputShape: {
    baseline: z
      .record(z.number())
      .optional()
      .describe("Mapa opcional de métrica → valor previo (el que el usuario recuerda o que vino en otra llamada). Si se omite, solo devuelve el snapshot actual."),
    baseline_label: z.string().trim().min(1).optional(),
    current_label: z.string().trim().min(1).optional(),
  },
  handler: async ({ baseline, baseline_label, current_label }, { api }) => {
    try {
      const current = await api.get<Record<string, unknown>>("/dashboard/summary");
      const currentNums = pickComparable(current);
      if (!baseline) {
        return ok({
          summary: `Snapshot actual del dashboard. Llama de nuevo con 'baseline' para comparar.`,
          data: { current: currentNums, current_label: current_label ?? "ahora" },
        });
      }
      const deltas: Record<string, { baseline: number; current: number; delta: number; pct: number | null }> = {};
      for (const key of Object.keys(currentNums)) {
        const b = baseline[key];
        const c = currentNums[key];
        if (typeof b !== "number" || typeof c !== "number") continue;
        const delta = c - b;
        const pct = b === 0 ? null : (delta / b) * 100;
        deltas[key] = { baseline: b, current: c, delta, pct };
      }
      const changed = Object.entries(deltas)
        .filter(([, v]) => v.delta !== 0)
        .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v.baseline}→${v.current} (Δ${v.delta})`);
      const summary = changed.length
        ? `Cambios principales: ${changed.join(" · ")}`
        : "Sin variaciones en las métricas comparables.";
      return ok({
        summary,
        data: {
          baseline_label: baseline_label ?? "antes",
          current_label: current_label ?? "ahora",
          deltas,
          current_full: current,
        },
      });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const analysisTools = [
  analyzeScrapTool,
  analyzeProductionTimeTool,
  workOrderProductionSummaryTool,
  compareDashboardPeriodsTool,
];

// Silenciamos el aviso del compilador si no se usa fail en este módulo todavía.
void fail;
