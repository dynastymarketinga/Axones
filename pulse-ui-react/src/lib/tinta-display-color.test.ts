import { describe, expect, it } from "vitest"

import { inferTintaDisplayColor, listTintaDisplayColorKeywords } from "@/lib/tinta-display-color"

/** Nombres del Excel «INVENTARIO DE TINTAS» (Laminación / Superficie / Prueba). */
const PLANT_INVENTORY_INK_NAMES = [
  "BLANCO",
  "NEGRO",
  "NEGRO POLYESTER",
  "AMARILLO PROCESO",
  "ROJO 485 2X",
  'ROJO 485 "C"',
  "CYAN",
  "AZUL PROCESO",
  "MAGENTA",
  "MAGENTA TRAMA DIGITAL",
  "REFLEX",
  "EXTENDER",
  "NARANJA 021",
  'VERDE "C"',
  "VIOLETA PANTONE",
  "AZUL BUDARE LAMINACION",
  "NARANJA BUDARE LAMINACION",
  "NARANJA MARY",
  "CREMA MARY",
  "VERDE MARY LAMINACION",
  "DORADO ALVARIGUA",
  "CREMA ALVARIGUA",
  'VERDE "P" 340-C (FINA IDEAL)',
  "COMPUESTO DE CERA",
  "VERDE 355",
  "VERDE DAMASCO",
  "AZUL FONDO SUPERIOR",
  "AZUL ESPIGA SUPERIOR",
  "OCRE ESPIGA MARY",
  "VERDE BABO",
  "MORADO NONNA",
  "CREMA AMANECER (FAVICA)",
  "CREMA AMANECER (BARNIVENCA)",
  "MARRON AMANECER",
  "MARRON P-4725 LAMINACION",
  "AZUL REFLEX",
  "AZUL PROCESO FLEXO SUPERFICIE",
  "AMARILLO",
  "BARNIZ SOBRE IMPRE",
  "AZUL 293",
  "BEIGE (TINTA FLEX)",
  "VERDE DOÑA EMILIA",
  "CREMA DOÑA EMILIA",
  "BLANCO LAMINACION",
]

describe("inferTintaDisplayColor", () => {
  it("BLANCO → blanco con borde visible", () => {
    const c = inferTintaDisplayColor("BLANCO — Superficie")
    expect(c.kind).toBe("known")
    expect(c.backgroundColor).toBe("#FFFFFF")
    expect(c.borderColor).toBeTruthy()
  })

  it("NEGRO → negro (no confunde con EXTENSOR/BASE)", () => {
    expect(inferTintaDisplayColor("NEGRO base").backgroundColor).toBe("#1A1A1A")
  })

  it("AMARILLO PROCESO → amarillo (no magenta por PROCESO)", () => {
    expect(inferTintaDisplayColor("AMARILLO PROCESO").backgroundColor).toBe("#FACC15")
  })

  it("sinónimos expandidos", () => {
    expect(inferTintaDisplayColor("AZUL MARINO FLEX").backgroundColor).toBe("#2563EB")
    expect(inferTintaDisplayColor("BRONCE METALICO").backgroundColor).toBe("#B45309")
    expect(inferTintaDisplayColor("ROJO BERMELLON").backgroundColor).toBe("#DC2626")
    expect(inferTintaDisplayColor("TINTA SECANTE").backgroundColor).toBe("#E0E7FF")
  })

  it("nombre especial sin palabra clave → genérico", () => {
    expect(inferTintaDisplayColor("Pantone especial cliente X").kind).toBe("generic")
  })

  it("ignora acentos", () => {
    expect(inferTintaDisplayColor("Marrón café").backgroundColor).toBe("#92400E")
  })

  it("expone lista de palabras clave ampliada", () => {
    const keys = listTintaDisplayColorKeywords()
    expect(keys).toContain("MORADO")
    expect(keys).toContain("BRONCE")
    expect(keys.length).toBeGreaterThan(80)
  })
})

describe("inferTintaDisplayColor — inventario Excel planta", () => {
  it.each(PLANT_INVENTORY_INK_NAMES)('"%s" → color conocido', (name) => {
    expect(inferTintaDisplayColor(name).kind).toBe("known")
  })

  it("REFLEX solo → gris reflex", () => {
    expect(inferTintaDisplayColor("REFLEX").backgroundColor).toBe("#64748B")
  })

  it("AZUL REFLEX → azul", () => {
    expect(inferTintaDisplayColor("AZUL REFLEX").backgroundColor).toBe("#2563EB")
  })
})
