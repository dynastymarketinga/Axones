import { z } from "zod";

import { buildSpaHref } from "../util/spa-routes.js";
import { fail, fromError, ok } from "../util/result.js";
import type { AxonesChip, AxonesEntityType } from "../types.js";
import { defineTool } from "./registry.js";

const ENTITY_TYPES = [
  "work_order",
  "material",
  "alert",
  "material_request",
  "area_request",
  "client_order",
  "delivery_note",
  "bobina",
] as const;

const WORK_ORDER_CODE_RE = /^OT-\d{4}-\d{1,6}$/i;

export const resolveEntityTool = defineTool({
  name: "axones_resolve_entity",
  title: "Resolver entidad a 'dot' (link UI)",
  description: "Dado un tipo y un id/código, devuelve la estructura { type, id, label, href } que la UI usará como 'dot' (enlace contextual). No falla si el id es desconocido — devuelve un dot razonable y un best-effort de label.",
  inputShape: {
    type: z.enum(ENTITY_TYPES).describe("Tipo de entidad."),
    identifier: z
      .union([z.number().int().positive(), z.string().trim().min(1)])
      .describe("Id numérico o, para OT, también código 'OT-AAAA-NNNNN'."),
  },
  handler: async ({ type, identifier }, { api, config }) => {
    try {
      let id: number | string = identifier;
      let label: string | null = null;

      if (type === "work_order") {
        if (typeof identifier === "string" && WORK_ORDER_CODE_RE.test(identifier.trim())) {
          const code = identifier.trim().toUpperCase();
          const list = await api.get<{ data: Array<{ id: number; code: string }> }>(
            "/work-orders",
            { query: { q: code, per_page: 1 } },
          );
          const found = list.data[0];
          if (!found) return fail(`No encontré OT con código ${code}.`);
          id = found.id;
          label = found.code;
        } else if (/^\d+$/.test(String(identifier))) {
          id = Number(identifier);
          label = `OT #${id}`;
        }
      } else if (typeof identifier === "string" && /^\d+$/.test(identifier)) {
        id = Number(identifier);
      }

      if (!label) {
        label = `${humanType(type)} #${id}`;
      }
      const dot = {
        type: type as AxonesEntityType,
        id,
        label,
        href: buildSpaHref(config, type, id),
      };
      return ok({ summary: label, data: dot, dots: [dot] });
    } catch (err) {
      return fromError(err);
    }
  },
});

interface SuggestChipsInput {
  route?: string;
  entity_type?: (typeof ENTITY_TYPES)[number];
  entity_id?: number | string;
  area?: string;
}

export const suggestChipsTool = defineTool({
  name: "axones_suggest_chips",
  title: "Sugerir chips contextuales",
  description: "Dado el contexto actual de la SPA (ruta, entidad enfocada, área del usuario), devuelve una lista de 'chips' sugeridos para que el usuario los lance con un clic. Reglas estáticas por ahora.",
  inputShape: {
    route: z.string().trim().min(1).optional().describe("Ruta SPA actual, p.ej. '/ordenes-trabajo/421'."),
    entity_type: z.enum(ENTITY_TYPES).optional(),
    entity_id: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional(),
    area: z
      .enum(["impresion", "laminacion", "corte", "montaje", "tintas", "inventory", "general"])
      .optional()
      .describe("Área del rol del usuario para sesgar las sugerencias."),
  },
  handler: async (input, _deps) => {
    const chips = buildChips(input);
    return ok({
      summary: `Sugerencias generadas: ${chips.length}`,
      data: { chips },
      follow_up_chips: chips,
    });
  },
});

function buildChips(input: SuggestChipsInput): AxonesChip[] {
  const chips: AxonesChip[] = [];
  const { entity_type, entity_id, area, route } = input;

  if (entity_type === "work_order" && entity_id !== undefined) {
    const woId = typeof entity_id === "string" && /^\d+$/.test(entity_id) ? Number(entity_id) : entity_id;
    chips.push(
      { label: "Resumen de producción", tool: "axones_work_order_production_summary", params: { work_order_id: woId } },
      { label: "Alertas de esta OT", tool: "axones_get_pending_alerts", params: { work_order_id: woId } },
      { label: "Ver detalle", tool: "axones_get_work_order", params: { identifier: woId } },
    );
  }

  if (entity_type === "material" && entity_id !== undefined) {
    chips.push({ label: "Stock bajo en su área", tool: "axones_list_low_stock_materials" });
  }

  if (route?.startsWith("/alertas")) {
    chips.push(
      { label: "Solo no leídas", tool: "axones_get_pending_alerts" },
      { label: "Resumen del dashboard", tool: "axones_dashboard_summary" },
    );
  }

  if (route?.startsWith("/solicitudes-material")) {
    chips.push({ label: "Pendientes ahora", tool: "axones_list_material_requests_pending" });
  }

  if (area === "inventory") {
    chips.push(
      { label: "Materiales bajo mínimo", tool: "axones_list_low_stock_materials" },
      { label: "Solicitudes pendientes", tool: "axones_list_material_requests_pending" },
    );
  } else if (area && area !== "general") {
    chips.push({
      label: `Solicitudes en ${area}`,
      tool: "axones_list_material_requests_pending",
      params: { area },
    });
  }

  if (chips.length === 0) {
    chips.push(
      { label: "Resumen del dashboard", tool: "axones_dashboard_summary" },
      { label: "Alertas pendientes", tool: "axones_get_pending_alerts" },
      { label: "Solicitudes de material pendientes", tool: "axones_list_material_requests_pending" },
    );
  }

  return dedupeChips(chips).slice(0, 6);
}

function dedupeChips(chips: AxonesChip[]): AxonesChip[] {
  const seen = new Set<string>();
  const out: AxonesChip[] = [];
  for (const c of chips) {
    const key = `${c.tool}|${JSON.stringify(c.params ?? {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function humanType(type: string): string {
  switch (type) {
    case "work_order":
      return "OT";
    case "material":
      return "Material";
    case "alert":
      return "Alerta";
    case "material_request":
      return "Solicitud de material";
    case "area_request":
      return "Solicitud entre áreas";
    case "client_order":
      return "Orden de cliente";
    case "delivery_note":
      return "Nota de entrega";
    case "bobina":
      return "Bobina";
    default:
      return type;
  }
}

export const contextTools = [resolveEntityTool, suggestChipsTool];
