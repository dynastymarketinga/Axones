"use client"

import { Link } from "react-router-dom"
import {
  ClipboardList,
  Package,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react"

import { getStoredUser } from "@/lib/auth-storage"
import { isAxonesUrlAllowed } from "@/lib/axones-roles"
import { cn } from "@/lib/utils"

type Card = {
  title: string
  description: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

const CARDS: Card[] = [
  {
    title: "Vendedores",
    description: "Asignación comercial por cliente.",
    url: "vendedores",
    icon: Users,
  },
  {
    title: "Clientes",
    description: "Catálogo de clientes del sistema.",
    url: "clientes",
    icon: ClipboardList,
  },
  {
    title: "Productos",
    description: "Productos por cliente (CPE/MPS/estructura).",
    url: "productos",
    icon: Package,
  },
  {
    title: "Proveedores",
    description: "Proveedores usados en compras y recepciones.",
    url: "proveedores",
    icon: Truck,
  },
  {
    title: "Órdenes de compra",
    description: "Material solicitado a proveedores.",
    url: "ordenes-compra",
    icon: ShoppingCart,
  },
]

export default function MastersHubPage() {
  const session = getStoredUser()

  const visibleCards = CARDS.filter((c) =>
    isAxonesUrlAllowed(c.url, session?.role, session?.id),
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datos maestros</h1>
          <p className="text-muted-foreground text-sm">
            Accesos rápidos a módulos de catálogo.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((c) => (
          <Link
            key={c.url}
            to={`/${c.url}`}
            className={cn(
              "group rounded-2xl border bg-card p-5 shadow-sm transition-colors",
              "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border bg-background/70 p-2 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight">{c.title}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{c.description}</p>
              </div>
            </div>
            <div className="mt-4 text-sm font-medium text-primary">
              Abrir <span className="opacity-70 group-hover:opacity-100">→</span>
            </div>
          </Link>
        ))}

        {!visibleCards.length ? (
          <div className="text-muted-foreground text-sm">
            No hay módulos disponibles para tu rol.
          </div>
        ) : null}
      </div>
    </div>
  )
}

