import * as React from "react"

import { cn } from "@/lib/utils"

const LOGO_PRIMARY = `${import.meta.env.BASE_URL}brand/logo-axones-1.png`
const LOGO_FALLBACK = `${import.meta.env.BASE_URL}brand/logo-axones-var-01.png`

export function AxonesBrandMark({
  className,
  imgClassName,
}: {
  className?: string
  imgClassName?: string
}) {
  const [src, setSrc] = React.useState(LOGO_PRIMARY)

  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center bg-transparent",
        className,
      )}
    >
      <img
        src={src}
        alt="Logo Axones"
        className={cn(
          "h-full w-full max-h-12 object-contain object-center",
          imgClassName,
        )}
        loading="eager"
        onError={() => setSrc(LOGO_FALLBACK)}
      />
    </div>
  )
}
