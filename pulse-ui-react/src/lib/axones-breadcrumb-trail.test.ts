import { describe, expect, it } from "vitest"

import { buildAxonesBreadcrumbTrail, buildAxonesDocumentTitle } from "@/lib/axones-breadcrumb-trail"

describe("buildAxonesBreadcrumbTrail", () => {
  it("resuelve vendedores bajo datos maestros", () => {
    expect(buildAxonesBreadcrumbTrail("/vendedores")).toEqual([
      { label: "Axones", href: "/resumen" },
      { label: "Datos maestros", href: "/datos-maestros" },
      { label: "Vendedores" },
    ])
  })

  it("añade Nuevo en formulario sin id", () => {
    expect(buildAxonesBreadcrumbTrail("/vendedores/form")).toEqual([
      { label: "Axones", href: "/resumen" },
      { label: "Datos maestros", href: "/datos-maestros" },
      { label: "Vendedores", href: "/vendedores" },
      { label: "Nuevo" },
    ])
  })

  it("añade Editar en formulario con id", () => {
    expect(buildAxonesBreadcrumbTrail("/vendedores/form", "?id=3")).toEqual([
      { label: "Axones", href: "/resumen" },
      { label: "Datos maestros", href: "/datos-maestros" },
      { label: "Vendedores", href: "/vendedores" },
      { label: "Editar" },
    ])
  })

  it("resuelve resumen bajo inicio y monitoreo", () => {
    expect(buildAxonesBreadcrumbTrail("/resumen")).toEqual([
      { label: "Axones", href: "/resumen" },
      { label: "Inicio y monitoreo" },
      { label: "Resumen" },
    ])
  })

  it("resuelve perfil bajo cuenta", () => {
    expect(buildAxonesBreadcrumbTrail("/account/profile")).toEqual([
      { label: "Axones", href: "/resumen" },
      { label: "Cuenta" },
      { label: "Perfil" },
    ])
  })
})

describe("buildAxonesDocumentTitle", () => {
  it("une migas con guiones", () => {
    expect(buildAxonesDocumentTitle("/account/profile")).toBe("Axones - Cuenta - Perfil")
    expect(buildAxonesDocumentTitle("/vendedores")).toBe("Axones - Datos maestros - Vendedores")
    expect(buildAxonesDocumentTitle("/vigilancia")).toBe("Axones - Vigilancia - Historial")
  })

  it("resuelve login", () => {
    expect(buildAxonesDocumentTitle("/auth/basic/login")).toBe("Axones - Iniciar sesión")
  })
})
