"use client"

import { useEffect, useMemo, useState } from "react"

import { apiFetch } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"

export function useReportEntityFilters() {
  const [clientFilter, setClientFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [clientComboOpen, setClientComboOpen] = useState(false)
  const [productComboOpen, setProductComboOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch<LaravelPaginated<ClientRecord>>("clients", {
          query: { per_page: 500, page: 1 },
        })
        if (!cancelled) setClients(res.data)
      } catch {
        if (!cancelled) setClients([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const query: Record<string, string | number> = { per_page: 500, page: 1 }
        if (clientFilter !== "all") query.client_id = Number(clientFilter)
        const res = await apiFetch<LaravelPaginated<ProductRecord>>("products", { query })
        if (!cancelled) setProducts(res.data)
      } catch {
        if (!cancelled) setProducts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientFilter])

  useEffect(() => {
    if (productFilter === "all") return
    const p = products.find((x) => String(x.id) === productFilter)
    if (clientFilter !== "all" && p?.client_id != null && p.client_id !== Number(clientFilter)) {
      setProductFilter("all")
    }
  }, [clientFilter, productFilter, products])

  const selectedClientLabel = useMemo(() => {
    if (clientFilter === "all") return "Todos los clientes"
    const c = clients.find((x) => String(x.id) === clientFilter)
    if (!c) return "Cliente"
    return c.rif ? `${c.name} · ${c.rif}` : c.name
  }, [clientFilter, clients])

  const selectedProductLabel = useMemo(() => {
    if (productFilter === "all") return "Todos los productos"
    const p = products.find((x) => String(x.id) === productFilter)
    if (!p) return "Producto"
    return p.cpe ? `${p.name} · ${p.cpe}` : p.name
  }, [productFilter, products])

  const clientIdQ = useMemo(() => {
    if (clientFilter === "all") return undefined
    const n = Number(clientFilter)
    return Number.isFinite(n) ? n : undefined
  }, [clientFilter])

  const productIdQ = useMemo(() => {
    if (productFilter === "all") return undefined
    const n = Number(productFilter)
    return Number.isFinite(n) ? n : undefined
  }, [productFilter])

  const activeEntityCount = [clientFilter !== "all", productFilter !== "all"].filter(Boolean).length

  function clearEntityFilters() {
    setClientFilter("all")
    setProductFilter("all")
  }

  return {
    clientFilter,
    setClientFilter,
    productFilter,
    setProductFilter,
    clients,
    products,
    clientComboOpen,
    setClientComboOpen,
    productComboOpen,
    setProductComboOpen,
    selectedClientLabel,
    selectedProductLabel,
    clientIdQ,
    productIdQ,
    activeEntityCount,
    clearEntityFilters,
  }
}
