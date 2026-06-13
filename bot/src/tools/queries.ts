import { z } from "zod";

import { AxonesApiError } from "../types.js";
import { buildSpaHref } from "../util/spa-routes.js";
import { fail, fromError, ok } from "../util/result.js";
import { defineTool } from "./registry.js";

const WORK_ORDER_CODE_RE = /^OT-\d{4}-\d{1,6}$/i;

interface PaginatedResponse<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
  current_page?: number;
  last_page?: number;
  total?: number;
}

interface WorkOrderLite {
  id: number;
  code: string;
  status?: string;
  scheduling_status?: string;
  board_stage?: string;
  priority?: string;
  client?: { id: number; name: string } | null;
  product?: { id: number; name?: string; cpe?: string } | null;
}

interface AlertLite {
  id: number;
  alert_type: string;
  severity?: string;
  message?: string;
  work_order_id?: number | null;
  acknowledged_at?: string | null;
  created_at?: string;
  work_order?: { id: number; code: string } | null;
  material?: { id: number; sku?: string; name?: string } | null;
}

interface MaterialLite {
  id: number;
  sku: string;
  name: string;
  inventory_area?: string;
  quantity_on_hand?: number;
  min_stock?: number;
  unit?: string;
}

interface MaterialRequestLite {
  id: number;
  status?: string;
  area?: string;
  work_order_id?: number | null;
  created_at?: string;
}

function summaryLine(parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== "").join(" · ");
}

export const pingTool = defineTool({
  name: "axones_ping",
  title: "Salud de la API Axones",
  description: "Comprueba que la API Axones responde. Útil para validar configuración del token y URL base antes de cualquier consulta.",
  inputShape: {},
  handler: async (_input, { api }) => {
    try {
      const data = await api.get<{ ok: boolean; service: string }>("/ping");
      return ok({ summary: `API respondió: ${data.service ?? "axones-api"}`, data });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const dashboardSummaryTool = defineTool({
  name: "axones_dashboard_summary",
  title: "Resumen del dashboard",
  description: "Obtiene los KPIs del panel principal de Axones: producción del mes, mermas, alertas no leídas, OT por etapa, stock bajo y movimientos del día.",
  inputShape: {},
  handler: async (_input, { api, config }) => {
    try {
      const data = await api.get<Record<string, unknown>>("/dashboard/summary");
      const summary = summaryLine([
        `OT pendientes de producción: ${data.work_orders_pending_production ?? 0}`,
        `Alertas sin leer: ${data.operational_alerts_unread ?? 0}`,
        `Solicitudes de material pendientes: ${data.material_requests_pending ?? 0}`,
      ]);
      const lowStock = Array.isArray(data.materials_low_stock)
        ? (data.materials_low_stock as MaterialLite[]).slice(0, 5)
        : [];
      const dots = lowStock.map((m) => ({
        type: "material" as const,
        id: m.id,
        label: `${m.sku} ${m.name}`.trim(),
        href: buildSpaHref(config, "material", m.id),
      }));
      return ok({
        summary,
        data,
        dots,
        follow_up_chips: [
          { label: "Ver alertas pendientes", tool: "axones_get_pending_alerts" },
          { label: "Ver stock bajo", tool: "axones_list_low_stock_materials" },
          { label: "Solicitudes de material pendientes", tool: "axones_list_material_requests_pending" },
        ],
      });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const getWorkOrderTool = defineTool({
  name: "axones_get_work_order",
  title: "Detalle de una orden de trabajo",
  description: "Devuelve el detalle de una OT por id numérico o por código (formato 'OT-2026-00001'). Incluye estado, etapa de tablero, cliente y producto.",
  inputShape: {
    identifier: z
      .union([z.number().int().positive(), z.string().trim().min(1)])
      .describe("Id numérico o código 'OT-AAAA-NNNNN' de la orden de trabajo."),
  },
  handler: async ({ identifier }, { api, config }) => {
    try {
      let id: number | null = null;
      if (typeof identifier === "number") {
        id = identifier;
      } else if (/^\d+$/.test(identifier.trim())) {
        id = Number(identifier.trim());
      } else if (WORK_ORDER_CODE_RE.test(identifier.trim())) {
        const code = identifier.trim().toUpperCase();
        const list = await api.get<PaginatedResponse<WorkOrderLite>>("/work-orders", {
          query: { q: code, per_page: 5 },
        });
        const exact = list.data.find((w) => w.code?.toUpperCase() === code);
        const chosen = exact ?? list.data[0];
        if (!chosen) {
          return fail(`No encontré ninguna OT con código ${code}.`);
        }
        id = chosen.id;
      } else {
        return fail(`Identificador inválido. Use id numérico o código 'OT-AAAA-NNNNN'.`);
      }

      const data = await api.get<WorkOrderLite & Record<string, unknown>>(
        `/work-orders/${id}`,
      );
      const summary = summaryLine([
        data.code ?? `OT #${id}`,
        data.status ? `estado ${data.status}` : null,
        data.board_stage ? `etapa ${data.board_stage}` : null,
        data.client?.name ? `cliente ${data.client.name}` : null,
      ]);
      return ok({
        summary,
        data,
        dots: [
          {
            type: "work_order",
            id: data.id,
            label: data.code ?? `OT #${data.id}`,
            href: buildSpaHref(config, "work_order", data.id),
          },
        ],
        follow_up_chips: [
          { label: "Resumen de producción", tool: "axones_work_order_production_summary", params: { work_order_id: data.id } },
          { label: "Alertas de esta OT", tool: "axones_get_pending_alerts", params: { work_order_id: data.id } },
        ],
      });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const listWorkOrdersTool = defineTool({
  name: "axones_list_work_orders",
  title: "Listar órdenes de trabajo",
  description: "Lista órdenes de trabajo con filtros básicos. Útil para 'cuántas OT están en impresión', 'OT abiertas del cliente X', etc.",
  inputShape: {
    status: z
      .enum(["open", "in_progress", "completed", "cancelled"])
      .optional()
      .describe("Estado global de la OT."),
    board_stage: z
      .enum(["impresion", "laminacion", "corte", "montaje", "completada"])
      .optional()
      .describe("Etapa del tablero de producción."),
    scheduling_status: z
      .enum(["pending_programming", "in_programming", "scheduled"])
      .optional()
      .describe("Estado de programación."),
    search: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Texto libre (código de OT, referencia de pedido, nombre de producto o cliente)."),
    per_page: z.number().int().min(1).max(100).optional().describe("Resultados por página (máx 100)."),
    page: z.number().int().min(1).optional().describe("Página solicitada."),
  },
  handler: async (input, { api, config }) => {
    try {
      const data = await api.get<PaginatedResponse<WorkOrderLite>>("/work-orders", {
        query: {
          status: input.status,
          board_stage: input.board_stage,
          scheduling_status: input.scheduling_status,
          q: input.search,
          per_page: input.per_page ?? 20,
          page: input.page,
        },
      });
      const total = data.meta?.total ?? data.total ?? data.data.length;
      const summary = `Se encontraron ${total} OT (mostrando ${data.data.length}).`;
      const dots = data.data.slice(0, 10).map((w) => ({
        type: "work_order" as const,
        id: w.id,
        label: w.code ?? `OT #${w.id}`,
        href: buildSpaHref(config, "work_order", w.id),
      }));
      return ok({ summary, data, dots });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const getPendingAlertsTool = defineTool({
  name: "axones_get_pending_alerts",
  title: "Alertas operativas pendientes",
  description: "Lista alertas operativas. Por defecto solo no leídas. Permite filtrar por OT, severidad o tipo de alerta.",
  inputShape: {
    work_order_id: z.number().int().positive().optional(),
    severity: z.string().trim().min(1).optional(),
    alert_type: z.string().trim().min(1).optional(),
    include_acknowledged: z
      .boolean()
      .optional()
      .describe("Si es true, incluye alertas ya reconocidas. Por defecto solo no leídas."),
    per_page: z.number().int().min(1).max(100).optional(),
  },
  handler: async (input, { api, config }) => {
    try {
      const data = await api.get<PaginatedResponse<AlertLite>>("/alerts", {
        query: {
          unread: input.include_acknowledged ? undefined : "true",
          work_order_id: input.work_order_id,
          severity: input.severity,
          alert_type: input.alert_type,
          per_page: input.per_page ?? 30,
        },
      });
      const total = data.meta?.total ?? data.total ?? data.data.length;
      const summary = `Se encontraron ${total} alertas (mostrando ${data.data.length}).`;
      const dots = data.data.slice(0, 10).map((a) => ({
        type: "alert" as const,
        id: a.id,
        label: a.message ?? `Alerta #${a.id} (${a.alert_type})`,
        href: buildSpaHref(config, "alert", a.id),
      }));
      return ok({ summary, data, dots });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const listLowStockMaterialsTool = defineTool({
  name: "axones_list_low_stock_materials",
  title: "Materiales con stock bajo",
  description: "Lista materiales cuyo stock está por debajo del mínimo. Se toma del dashboard (más rápido) o se filtra por área.",
  inputShape: {
    area: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Filtrar por inventory_area exacta (ej. 'sustratos', 'tintas')."),
  },
  handler: async ({ area }, { api, config }) => {
    try {
      const data = await api.get<{ materials_low_stock?: MaterialLite[] }>(
        "/dashboard/summary",
      );
      let items = Array.isArray(data.materials_low_stock) ? data.materials_low_stock : [];
      if (area) {
        const target = area.toLowerCase();
        items = items.filter((m) => (m.inventory_area ?? "").toLowerCase() === target);
      }
      const summary = `Materiales bajo mínimo: ${items.length}${area ? ` en ${area}` : ""}.`;
      const dots = items.slice(0, 10).map((m) => ({
        type: "material" as const,
        id: m.id,
        label: `${m.sku} ${m.name}`.trim(),
        href: buildSpaHref(config, "material", m.id),
      }));
      return ok({ summary, data: { count: items.length, items }, dots });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const getMaterialRequestTool = defineTool({
  name: "axones_get_material_request",
  title: "Detalle de solicitud de material",
  description: "Devuelve el detalle de una solicitud de material por id.",
  inputShape: {
    id: z.number().int().positive(),
  },
  handler: async ({ id }, { api, config }) => {
    try {
      const data = await api.get<MaterialRequestLite & Record<string, unknown>>(
        `/material-requests/${id}`,
      );
      const summary = summaryLine([
        `Solicitud #${data.id}`,
        data.status ? `estado ${data.status}` : null,
        data.area ? `área ${data.area}` : null,
      ]);
      return ok({
        summary,
        data,
        dots: [
          {
            type: "material_request",
            id: data.id,
            label: `Solicitud #${data.id}`,
            href: buildSpaHref(config, "material_request", data.id),
          },
        ],
      });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const listMaterialRequestsPendingTool = defineTool({
  name: "axones_list_material_requests_pending",
  title: "Solicitudes de material pendientes",
  description: "Lista solicitudes de material en estado pending o partial. Útil para responder '¿cuántas solicitudes están por despachar?'.",
  inputShape: {
    area: z.string().trim().min(1).optional().describe("Filtrar por área solicitante."),
    per_page: z.number().int().min(1).max(100).optional(),
  },
  handler: async (input, { api, config }) => {
    try {
      const collected: MaterialRequestLite[] = [];
      for (const status of ["pending", "partial"]) {
        const res = await api.get<PaginatedResponse<MaterialRequestLite>>(
          "/material-requests",
          {
            query: {
              status,
              area: input.area,
              per_page: input.per_page ?? 50,
            },
          },
        );
        if (Array.isArray(res.data)) collected.push(...res.data);
      }
      const summary = `Solicitudes pendientes (pending+partial): ${collected.length}.`;
      const dots = collected.slice(0, 10).map((r) => ({
        type: "material_request" as const,
        id: r.id,
        label: `Solicitud #${r.id} (${r.status ?? "?"})`,
        href: buildSpaHref(config, "material_request", r.id),
      }));
      return ok({
        summary,
        data: { count: collected.length, items: collected },
        dots,
      });
    } catch (err) {
      return fromError(err);
    }
  },
});

export const areaRequestsCountsTool = defineTool({
  name: "axones_area_requests_counts",
  title: "Contadores de solicitudes entre áreas",
  description: "Devuelve el agregado de solicitudes entre áreas: cuántas hay por área y estado. Endpoint Laravel: GET /api/area-requests/counts.",
  inputShape: {},
  handler: async (_input, { api }) => {
    try {
      const data = await api.get<Record<string, unknown>>("/area-requests/counts");
      let pendingTotal = 0;
      for (const v of Object.values(data)) {
        if (typeof v === "number") pendingTotal += v;
        else if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>;
          const p = obj["pending"];
          if (typeof p === "number") pendingTotal += p;
        }
      }
      return ok({
        summary: `Solicitudes entre áreas (pending totales): ${pendingTotal}.`,
        data,
      });
    } catch (err) {
      if (err instanceof AxonesApiError && err.status === 404) {
        return fail("Endpoint /area-requests/counts no disponible en esta instalación.");
      }
      return fromError(err);
    }
  },
});

export const queryTools = [
  pingTool,
  dashboardSummaryTool,
  getWorkOrderTool,
  listWorkOrdersTool,
  getPendingAlertsTool,
  listLowStockMaterialsTool,
  getMaterialRequestTool,
  listMaterialRequestsPendingTool,
  areaRequestsCountsTool,
];
