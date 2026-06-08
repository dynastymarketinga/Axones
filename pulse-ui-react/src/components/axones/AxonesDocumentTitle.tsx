"use client"

import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import { buildAxonesDocumentTitle } from "@/lib/axones-breadcrumb-trail"

/** Actualiza `document.title` según la ruta Axones (menú + migas). */
export function AxonesDocumentTitle() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    document.title = buildAxonesDocumentTitle(pathname, search)
  }, [pathname, search])

  return null
}
