"use client"

import { ArrowLeft } from "lucide-react"
import { Link, type To } from "react-router-dom"

import { Button } from "@/components/ui/button"

type CatalogMasterFormBackButtonProps = {
  to: To
  title?: string
}

export function CatalogMasterFormBackButton({
  to,
  title = "Volver al listado",
}: CatalogMasterFormBackButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="border-primary/25 shadow-sm"
      asChild
    >
      <Link to={to} title={title} aria-label={title}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </Link>
    </Button>
  )
}
