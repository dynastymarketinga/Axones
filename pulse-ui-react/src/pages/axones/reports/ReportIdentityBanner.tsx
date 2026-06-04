"use client"

import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"

import type { ReportIdentity, ReportIdentityKey } from "./report-identities"
import { REPORT_IDENTITIES } from "./report-identities"

export function ReportIdentityBannerContent({ identity }: { identity: ReportIdentity }) {
  const Icon = identity.icon

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 shadow-sm",
        identity.theme.bannerBorderClass,
        "border-l-[5px]",
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
        <span
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-2 sm:h-12 sm:w-12",
            identity.theme.iconClass,
          )}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-foreground text-sm font-medium leading-snug sm:text-base">{identity.headline}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Qué sí muestra
              </p>
              <ul className="mt-2 space-y-1.5">
                {identity.shows.map((line) => (
                  <li key={line} className="text-muted-foreground flex gap-2 text-xs leading-relaxed">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-200">
                Qué no es este reporte
              </p>
              <ul className="mt-2 space-y-1.5">
                {identity.notShows.map((line) => (
                  <li key={line} className="text-muted-foreground flex gap-2 text-xs leading-relaxed">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type ReportIdentityBannerProps = {
  identityKey: ReportIdentityKey
  className?: string
}

export function ReportIdentityBanner({ identityKey, className }: ReportIdentityBannerProps) {
  const identity = REPORT_IDENTITIES[identityKey]
  return (
    <div className={className}>
      <ReportIdentityBannerContent identity={identity} />
    </div>
  )
}

export function getReportIdentity(key: ReportIdentityKey) {
  return REPORT_IDENTITIES[key]
}
