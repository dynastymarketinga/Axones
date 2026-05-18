"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ReportFilterSectionProps = {
  title: string
  accentClass: string
  dotClass: string
  borderClass: string
  children: ReactNode
  className?: string
}

export function ReportFilterSection({
  title,
  accentClass,
  dotClass,
  borderClass,
  children,
  className,
}: ReportFilterSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border p-3.5 shadow-sm sm:p-4",
        borderClass,
        "bg-gradient-to-br from-background/90 to-background/60",
        className,
      )}
    >
      <p
        className={cn(
          "mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
          accentClass,
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
        {title}
      </p>
      {children}
    </section>
  )
}
