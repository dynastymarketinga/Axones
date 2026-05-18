import { describe, expect, it } from "vitest"

import {
  countFilledTintaColors,
  countFilledTintaColorsInRange,
  joinStructureLayers,
  parseProductStructureLayers,
  structureLayersToOtFormFields,
  tipoImpresionFromProductPrintType,
} from "./product-structure-layers"

describe("parseProductStructureLayers", () => {
  it("splits on plus with spaces", () => {
    expect(
      parseProductStructureLayers(
        "BOPP transparente 40 µm + CAST 20 µm + PEBD coextrusión 55 µm",
      ),
    ).toEqual({
      capa1: "BOPP transparente 40 µm",
      capa2: "CAST 20 µm",
      capa3: "PEBD coextrusión 55 µm",
    })
  })

  it("splits on slash and newlines", () => {
    expect(parseProductStructureLayers("A / B\nC")).toEqual({
      capa1: "A",
      capa2: "B",
      capa3: "C",
    })
  })

  it("returns empty layers for blank input", () => {
    expect(parseProductStructureLayers(null)).toEqual({ capa1: "", capa2: "", capa3: "" })
  })
})

describe("structureLayersToOtFormFields", () => {
  const structure = "Capa A + Capa B + Capa C"

  it("maps reverso to three fields", () => {
    expect(structureLayersToOtFormFields(structure, "reverso")).toEqual({
      estructuraCapa1Rev: "Capa A",
      estructuraCapa2Rev: "Capa B",
      estructuraCapa3Rev: "Capa C",
    })
  })

  it("maps superficie to single field", () => {
    expect(structureLayersToOtFormFields(structure, "superficie")).toEqual({
      estructuraCapa1: joinStructureLayers(parseProductStructureLayers(structure)),
    })
  })
})

describe("tipoImpresionFromProductPrintType", () => {
  it("detects reverso and superficie", () => {
    expect(tipoImpresionFromProductPrintType("Flexo Reverso")).toBe("reverso")
    expect(tipoImpresionFromProductPrintType("Superficie")).toBe("superficie")
  })
})

describe("tinta color counts", () => {
  it("counts non-empty tintaColor fields", () => {
    expect(
      countFilledTintaColors({
        tintaColor1: "A",
        tintaColor2: "",
        tintaColor3: "C",
      }),
    ).toBe(2)
  })

  it("counts range for numColores validation", () => {
    const form = {
      tintaColor1: "A",
      tintaColor2: "B",
      tintaColor3: "",
      tintaColor4: "",
    }
    expect(countFilledTintaColorsInRange(form, 1, 3)).toBe(2)
  })
})
