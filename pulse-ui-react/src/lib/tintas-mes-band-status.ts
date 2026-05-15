import {
  mesBandFromAreaTimeSummary,
  mesBandejaCardClass,
  mesBandejaRowAccentClass,
  mesBandejaStatePillClass,
  mesBandejaWorkflowTitle,
  type AreaTimeSummary,
  type MesBandejaMes,
  type MesBandejaWorkflow,
} from "@/lib/mes-timer-band-shared"

export { formatHmsFromSeconds } from "@/lib/mes-timer-band-shared"
export type { AreaTimeSummary, MesBandejaMes, MesBandejaWorkflow }

export function tintasMesBandFromWorkOrderRow(
  row: {
    board_stage?: string | null
    area_time_summary?: AreaTimeSummary | null
  },
  nowMs: number,
): MesBandejaMes | null {
  if (!row.area_time_summary) return null
  return mesBandFromAreaTimeSummary(row.area_time_summary, nowMs, "Tintas")
}

export const tintasBandejaRowAccentClass = mesBandejaRowAccentClass
export const tintasBandejaCardClass = mesBandejaCardClass
export const tintasBandejaStatePillClass = mesBandejaStatePillClass
export const tintasBandejaWorkflowTitle = mesBandejaWorkflowTitle
