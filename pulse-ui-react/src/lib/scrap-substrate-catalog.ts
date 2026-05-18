import { apiFetch } from "@/lib/api"

export type ScrapSubstrateGroupConfig = {
  id: string
  label: string
  structure_patterns: string[]
}

export const DEFAULT_SCRAP_SUBSTRATE_GROUPS: ScrapSubstrateGroupConfig[] = [
  {
    id: "bopp",
    label: "BOPP",
    structure_patterns: ["bopp"],
  },
  {
    id: "polietileno",
    label: "Polietileno",
    structure_patterns: [
      "polietileno",
      "politereño",
      "pebd",
      "ldpe",
      "hdpe",
      "lldpe",
      "polyethylene",
    ],
  },
  {
    id: "transparente",
    label: "Transparente",
    structure_patterns: ["transparente", "cpp", "cast pp", "opp transparente"],
  },
]

export type ScrapSubstrateConfigPayload = {
  groups: ScrapSubstrateGroupConfig[]
  rules?: {
    explicit_field?: string
    ambiguous_structure_requires_explicit?: boolean
  }
}

let cachedConfig: ScrapSubstrateConfigPayload | null = null

export async function fetchScrapSubstrateConfig(): Promise<ScrapSubstrateConfigPayload> {
  if (cachedConfig) {
    return cachedConfig
  }
  try {
    const data = await apiFetch<ScrapSubstrateConfigPayload>("reports/scrap-substrate-config")
    cachedConfig = {
      groups:
        Array.isArray(data.groups) && data.groups.length > 0
          ? data.groups
          : DEFAULT_SCRAP_SUBSTRATE_GROUPS,
      rules: data.rules,
    }
  } catch {
    cachedConfig = { groups: DEFAULT_SCRAP_SUBSTRATE_GROUPS }
  }
  return cachedConfig
}

export function buildHistoryKgTabQuery(
  groupId: string,
): { substrate_group: string; layout: string } {
  return { substrate_group: groupId, layout: "history_kg" }
}
