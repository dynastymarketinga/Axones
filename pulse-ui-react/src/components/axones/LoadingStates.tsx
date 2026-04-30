"use client"

import { Loader2 } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TableCell, TableRow } from "@/components/ui/table"

export function InlineSpinner({
  className,
}: {
  className?: string
}) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />
}

export function LoadingButtonLabel({
  loading,
  loadingText,
  idleText,
}: {
  loading: boolean
  loadingText: string
  idleText: string
}) {
  if (!loading) return <>{idleText}</>
  return (
    <span className="inline-flex items-center gap-2">
      <InlineSpinner />
      {loadingText}
    </span>
  )
}

export function LoadingTableRow({
  colSpan,
}: {
  colSpan: number
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <InlineSpinner />
          Cargando...
        </div>
      </TableCell>
    </TableRow>
  )
}

export function PageLoadingBlock() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  )
}

