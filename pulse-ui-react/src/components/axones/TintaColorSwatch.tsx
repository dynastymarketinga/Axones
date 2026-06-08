"use client"

import { Palette } from "lucide-react"

import { inferTintaDisplayColor } from "@/lib/tinta-display-color"
import { cn } from "@/lib/utils"

import "@/pages/axones/tinta-color-swatch.css"

export type TintaColorSwatchProps = {
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZE_CLASS: Record<NonNullable<TintaColorSwatchProps["size"]>, string> = {
  sm: "tinta-color-swatch--sm",
  md: "tinta-color-swatch--md",
  lg: "tinta-color-swatch--lg",
}

export function TintaColorSwatch({ name, size = "md", className }: TintaColorSwatchProps) {
  const color = inferTintaDisplayColor(name)

  return (
    <span
      className={cn("tinta-color-swatch shrink-0", SIZE_CLASS[size], className)}
      style={{
        backgroundColor: color.backgroundColor,
        borderColor: color.borderColor ?? color.backgroundColor,
      }}
      aria-hidden
    >
      {color.kind === "generic" ? (
        <Palette className="tinta-color-swatch__icon" aria-hidden />
      ) : null}
    </span>
  )
}
