"use client"

import { Beaker, Palette } from "lucide-react"

import { cn } from "@/lib/utils"

export function TintasPaneHead({
  variant,
  title,
  description,
}: {
  variant: "consumo" | "mezcla"
  title: string
  description: string
}) {
  const Icon = variant === "consumo" ? Beaker : Palette
  return (
    <div className="tintas-pane__head">
      <span
        className={cn(
          "tintas-pane__head-icon",
          variant === "consumo" ? "tintas-pane__head-icon--consumo" : "tintas-pane__head-icon--mezcla",
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="tintas-pane__title">{title}</p>
        <p className="tintas-pane__desc">{description}</p>
      </div>
    </div>
  )
}
