import { apiFetch } from "@/lib/api"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"

/** Áreas de bandeja alineadas con `mi_area` del API de work-orders. */
export type MiAreaApi = "impresion" | "laminacion" | "corte" | "tintas" | "montaje"

/** Máximo de IDs de OT recordados como “vistas” en En curso (localStorage). */
export const ACTIVAS_SEEN_MAX_IDS = 2000

/** Páginas máximas al recolectar IDs para contador / marcar vistas (20 filas por página). */
export const BANDEJA_COLLECT_MAX_PAGES = 10

const STORAGE_PREFIX = "axones.bandeja-activas-vistos::"

export function activasSeenStorageKey(
  userId: number | undefined,
  miArea: MiAreaApi,
): string {
  const uid = userId ?? 0
  return `${STORAGE_PREFIX}${uid}::${miArea}`
}

export function loadSeenActivasIds(
  userId: number | undefined,
  miArea: MiAreaApi,
): Set<number> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(activasSeenStorageKey(userId, miArea))
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(
      arr.filter((x): x is number => typeof x === "number" && Number.isFinite(x)),
    )
  } catch {
    return new Set()
  }
}

export function mergeIdsIntoSeenActivas(
  userId: number | undefined,
  miArea: MiAreaApi,
  newIds: readonly number[],
): void {
  if (typeof window === "undefined") return
  const s = loadSeenActivasIds(userId, miArea)
  for (const id of newIds) s.add(id)
  let arr = Array.from(s)
  if (arr.length > ACTIVAS_SEEN_MAX_IDS) {
    arr = arr.slice(-ACTIVAS_SEEN_MAX_IDS)
  }
  window.localStorage.setItem(
    activasSeenStorageKey(userId, miArea),
    JSON.stringify(arr),
  )
}

export function countUnseenActivasInIds(
  ids: readonly number[],
  seen: ReadonlySet<number>,
): number {
  return ids.filter((id) => !seen.has(id)).length
}

export type BandejaListFilters = Record<string, string | number | undefined>

/** Filtro de bandeja: `active` = solicitud pendiente y OT en cola o ya en la etapa del área (recomendado en UI). */
export type AreaProcessTagApi = "not_started" | "in_progress" | "active"

/**
 * Total de OT en cola o en curso según `area_process_tag` (paginación Laravel, `per_page=1`).
 */
export async function fetchBandejaTotal(
  miArea: MiAreaApi,
  areaProcessTag: AreaProcessTagApi,
  base: BandejaListFilters,
): Promise<number> {
  const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
    query: {
      ...base,
      page: 1,
      per_page: 1,
      mi_area: miArea,
      area_process_tag: areaProcessTag,
    },
  })
  return typeof data.total === "number" ? data.total : 0
}

/**
 * Recolecta IDs de OT para la bandeja (mismos filtros que el listado). Respeta `BANDEJA_COLLECT_MAX_PAGES`.
 */
export async function collectBandejaWorkOrderIds(
  miArea: MiAreaApi,
  areaProcessTag: AreaProcessTagApi,
  base: BandejaListFilters,
  maxPages: number = BANDEJA_COLLECT_MAX_PAGES,
): Promise<number[]> {
  const ids: number[] = []
  let page = 1
  let lastPage = 1
  do {
    const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
      query: {
        ...base,
        page,
        per_page: 20,
        mi_area: miArea,
        area_process_tag: areaProcessTag,
      },
    })
    lastPage = Math.max(1, data.last_page ?? 1)
    for (const row of data.data ?? []) {
      ids.push(row.id)
    }
    page += 1
  } while (page <= lastPage && page <= maxPages)
  return ids
}
