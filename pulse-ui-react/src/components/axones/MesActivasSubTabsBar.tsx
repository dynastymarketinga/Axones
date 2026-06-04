"use client"

import { CheckCircle2, Inbox, PlayCircle } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { mesActivasSubTabToggleClass } from "@/lib/mes-timer-band-shared"

export type MesActivasSubTabKey = "pendientes" | "produccion" | "finalizadas"

export type MesActivasSubTabCounts = {
  pendientes: number
  produccion: number
  finalizadas: number
}

type Props = {
  value: MesActivasSubTabKey
  counts: MesActivasSubTabCounts | null
  areaLabel: string
  onChange: (value: MesActivasSubTabKey) => void
}

export function MesActivasSubTabsBar({ value, counts, areaLabel, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (!v) return
        onChange(v as MesActivasSubTabKey)
      }}
      className="flex h-auto w-full flex-wrap justify-stretch gap-2 rounded-xl border border-primary/15 bg-gradient-to-r from-muted/40 via-background/80 to-muted/30 p-2 shadow-inner sm:justify-start"
      aria-label={`Vista de bandeja de ${areaLabel}`}
    >
      <ToggleGroupItem value="pendientes" className={mesActivasSubTabToggleClass("pendientes")}>
        <Inbox className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
        <span>Pendientes</span>
        <span className="rounded-full bg-black/8 px-1.5 font-mono text-[10px] font-bold tabular-nums dark:bg-white/12">
          {counts?.pendientes ?? 0}
        </span>
      </ToggleGroupItem>
      <ToggleGroupItem value="produccion" className={mesActivasSubTabToggleClass("produccion")}>
        <PlayCircle className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
        <span>En producción</span>
        <span className="rounded-full bg-black/8 px-1.5 font-mono text-[10px] font-bold tabular-nums dark:bg-white/12">
          {counts?.produccion ?? 0}
        </span>
      </ToggleGroupItem>
      <ToggleGroupItem value="finalizadas" className={mesActivasSubTabToggleClass("finalizadas")}>
        <CheckCircle2 className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
        <span>Finalizadas</span>
        <span className="rounded-full bg-black/8 px-1.5 font-mono text-[10px] font-bold tabular-nums dark:bg-white/12">
          {counts?.finalizadas ?? 0}
        </span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
