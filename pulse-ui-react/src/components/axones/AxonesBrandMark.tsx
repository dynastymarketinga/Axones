import * as React from "react"

import { cn } from "@/lib/utils"

const LOGO_SRC = `${import.meta.env.BASE_URL}brand/logo-axones-var-01.png`

export function AxonesBrandMark({
  className,
  imgClassName,
}: {
  className?: string
  imgClassName?: string
}) {
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center bg-transparent",
        className,
      )}
    >
      <img
        src={LOGO_SRC}
        alt="Logo Axones"
        className={cn(
          "h-full w-full max-h-12 object-contain object-center",
          imgClassName,
        )}
        loading="eager"
      />
    </div>
  )
}
