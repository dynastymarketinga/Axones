import type { AxonesConfig } from "../config.js";
import type { AxonesEntityType } from "../types.js";

/**
 * Construye el href de la SPA para una entidad. Si AXONES_SPA_BASE_URL está
 * definido, devuelve URL absoluta; si no, devuelve ruta relativa lista para
 * navegar dentro de Axones (ej. "/ordenes-trabajo/421").
 */
export function buildSpaHref(
  config: AxonesConfig,
  type: AxonesEntityType | string,
  id: string | number,
): string {
  const path = relativePathFor(type, id);
  if (!config.spaBaseUrl) return path;
  return `${config.spaBaseUrl}${path}`;
}

function relativePathFor(type: AxonesEntityType | string, id: string | number): string {
  switch (type) {
    case "work_order":
      return `/ordenes-trabajo/${encodeURIComponent(String(id))}`;
    case "material":
      return `/materiales/${encodeURIComponent(String(id))}`;
    case "alert":
      return `/alertas?focus=${encodeURIComponent(String(id))}`;
    case "material_request":
      return `/solicitudes-material/${encodeURIComponent(String(id))}`;
    case "area_request":
      return `/solicitudes-area?focus=${encodeURIComponent(String(id))}`;
    case "client_order":
      return `/ordenes-cliente/${encodeURIComponent(String(id))}`;
    case "delivery_note":
      return `/notas-entrega/${encodeURIComponent(String(id))}`;
    case "bobina":
      return `/bobinas/${encodeURIComponent(String(id))}`;
    default:
      return `/${encodeURIComponent(String(type))}/${encodeURIComponent(String(id))}`;
  }
}
