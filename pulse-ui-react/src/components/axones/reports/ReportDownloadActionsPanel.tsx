"use client"

import type { ReactNode } from "react"
import { Download } from "lucide-react"

import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ReportDownloadAction = {
  id: string
  label: string
  description: string
  disabled?: boolean
  onClick: () => void
}

type ReportDownloadActionsPanelProps = {
  intro?: ReactNode
  actions: ReportDownloadAction[]
  title?: string
  className?: string
}

export function ReportDownloadActionsPanel({
  intro,
  actions,
  title = "Descargas",
  className,
}: ReportDownloadActionsPanelProps) {
  return (
    <ReportFilterSection
      title={title}
      accentClass="text-emerald-800 dark:text-emerald-200"
      dotClass="bg-emerald-500"
      borderClass="border-emerald-500/30 from-emerald-500/[0.07]"
      className={className}
    >
      {intro ? <p className="text-muted-foreground mb-4 text-sm leading-relaxed">{intro}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <div key={action.id} className="flex min-w-0 flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={action.disabled}
              className={cn(
                "h-10 w-full justify-start gap-2 border-primary/25 shadow-sm",
                "hover:border-primary/40 hover:bg-primary/5",
              )}
              onClick={action.onClick}
            >
              <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{action.label}</span>
            </Button>
            <p className="text-muted-foreground text-xs leading-snug">{action.description}</p>
          </div>
        ))}
      </div>
    </ReportFilterSection>
  )
}
