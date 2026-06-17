import { describe, expect, it } from "vitest"

import { AXONES_MENU_TREE } from "@/lib/axones-menu"
import { filterAxonesMenuTree, isAxonesAccountAdmin, isAxonesUrlAllowed } from "@/lib/axones-roles"

function topLevelTitles(role: string): string[] {
  return filterAxonesMenuTree(AXONES_MENU_TREE, role).map((n) => n.title)
}

function leafUrls(role: string): string[] {
  const urls: string[] = []
  function walk(nodes: ReturnType<typeof filterAxonesMenuTree>) {
    for (const n of nodes) {
      if ("items" in n && Array.isArray(n.items)) walk(n.items)
      else urls.push(n.url)
    }
  }
  walk(filterAxonesMenuTree(AXONES_MENU_TREE, role))
  return urls
}

/** Menú lateral demo `inventario@axones.local` (rol inventory). */
const INVENTORY_DEMO_TOP = [
  "Datos maestros",
  "Inventario",
  "Solicitudes de insumos",
  "Despacho",
]

const PRODUCTION_URLS = [
  "programacion",
  "montaje",
  "impresion",
  "laminacion",
  "corte",
  "tintas",
  "ordenes-cliente",
  "ordenes-trabajo",
  "ordenes-trabajo-produccion",
]

const VIGILANCIA_URLS = ["vigilancia", "vigilancia/nuevo"]

describe("axones-roles — inventario@axones.local (rol inventory)", () => {
  it("menú principal acotado a almacén", () => {
    expect(topLevelTitles("inventory")).toEqual(INVENTORY_DEMO_TOP)
    expect(topLevelTitles("inventario")).toEqual(INVENTORY_DEMO_TOP)
  })

  it("sin Producción, Vigilancia, Calidad ni Reportes", () => {
    const titles = topLevelTitles("inventory")
    expect(titles).not.toContain("Producción")
    expect(titles).not.toContain("Vigilancia")
    expect(titles).not.toContain("Calidad")
    expect(titles).not.toContain("Reportes")
    expect(titles).not.toContain("Inicio y monitoreo")
  })

  it("datos maestros sin vendedores ni órdenes de compra", () => {
    const urls = leafUrls("inventory")
    expect(urls).toContain("clientes")
    expect(urls).toContain("materiales")
    expect(urls).toContain("devoluciones")
    expect(urls).not.toContain("vendedores")
    expect(urls).not.toContain("ordenes-compra")
  })

  it.each(PRODUCTION_URLS)("ruta producción bloqueada: %s", (url) => {
    expect(isAxonesUrlAllowed(url, "inventory")).toBe(false)
  })

  it.each(VIGILANCIA_URLS)("ruta vigilancia bloqueada: %s", (url) => {
    expect(isAxonesUrlAllowed(url, "inventory")).toBe(false)
  })
})

describe("axones-roles — Leonardo (inventory_chief / jefe almacén)", () => {
  it("ve inventario + inicio y reportes, sin producción ni vigilancia", () => {
    const titles = topLevelTitles("inventory_chief")
    expect(titles).toContain("Inicio y monitoreo")
    expect(titles).toContain("Datos maestros")
    expect(titles).toContain("Inventario")
    expect(titles).toContain("Reportes")
    expect(titles).not.toContain("Producción")
    expect(titles).not.toContain("Vigilancia")
    expect(titles).not.toContain("Calidad")
  })

  it("datos maestros incluye órdenes de compra", () => {
    expect(leafUrls("inventory_chief")).toContain("ordenes-compra")
  })

  it.each(PRODUCTION_URLS)("ruta producción bloqueada: %s", (url) => {
    expect(isAxonesUrlAllowed(url, "inventory_chief")).toBe(false)
  })
})

describe("axones-roles — otros roles no ven menú de almacén completo", () => {
  it("tintas solo ve bandeja tintas bajo Producción", () => {
    const tree = filterAxonesMenuTree(AXONES_MENU_TREE, "tintas")
    expect(tree.map((n) => n.title)).toEqual(["Producción"])
    const prod = tree[0]
    expect(prod && "items" in prod ? prod.items.map((n) => n.title) : []).toEqual([
      "Tintas y Mezcla de tinta",
    ])
  })

  it("boss ve producción", () => {
    expect(topLevelTitles("boss")).toContain("Producción")
  })
})

describe("axones-roles — gestión de cuentas (solo Víctor y Valeria)", () => {
  const victor = {
    id: 1,
    name: "Víctor Carrillo",
    email: "victorcarrillox2@gmail.com",
    username: "Desarrollador",
    role: "boss",
  }
  const valeria = {
    id: 2,
    name: "Valeria Rodrigues",
    email: "admin@axones.com",
    username: "admin",
    role: "admin",
  }
  const plant = {
    id: 3,
    name: "Operador",
    email: "op@axones.com",
    username: "operador",
    role: "corte",
  }
  const jefeOps = {
    id: 4,
    name: "Alexis",
    email: "ajaure@axones.com",
    username: "ajaure",
    role: "jefe_operaciones",
  }

  it("identifica administradores de cuenta", () => {
    expect(isAxonesAccountAdmin(victor)).toBe(true)
    expect(isAxonesAccountAdmin(valeria)).toBe(true)
    expect(isAxonesAccountAdmin(plant)).toBe(false)
    expect(isAxonesAccountAdmin(jefeOps)).toBe(false)
  })

  it("rutas de cuenta bloqueadas para planta y jefe operaciones", () => {
    for (const user of [plant, jefeOps]) {
      expect(isAxonesUrlAllowed("account/users", user.role, user.id, user)).toBe(false)
      expect(isAxonesUrlAllowed("account/activity", user.role, user.id, user)).toBe(false)
    }
    expect(isAxonesUrlAllowed("account/users", victor.role, victor.id, victor)).toBe(true)
    expect(isAxonesUrlAllowed("account/profile", plant.role, plant.id, plant)).toBe(true)
  })
})
