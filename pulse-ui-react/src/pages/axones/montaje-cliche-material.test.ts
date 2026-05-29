import { describe, expect, it } from "vitest"

import {
  montajeFilasExtraForSave,
  montajeMaterialesForSave,
  readMontajeFilasExtraState,
  readMontajeMaterialesState,
  resolveMontCodigo,
  resolveMontColor,
  resolveMontStickyBack,
} from "./montaje-cliche-material"

describe("montaje-cliche-material", () => {
  it("readMontajeFilasExtraState conserva filas vacías y migra listas legacy", () => {
    expect(readMontajeFilasExtraState([{ numCliche: "CL-2", numCilindro: "" }])).toEqual([
      { numCliche: "CL-2", numCilindro: "" },
    ])
    expect(
      readMontajeFilasExtraState(undefined, ["CL-2", "CL-3"], ["CIL-9"]),
    ).toEqual([
      { numCliche: "CL-2", numCilindro: "CIL-9" },
      { numCliche: "CL-3", numCilindro: "" },
    ])
  })

  it("montajeFilasExtraForSave omite filas totalmente vacías", () => {
    expect(
      montajeFilasExtraForSave([
        { numCliche: "CL-2", numCilindro: "" },
        { numCliche: "", numCilindro: "" },
      ]),
    ).toEqual([{ numCliche: "CL-2", numCilindro: "" }])
  })

  it("resolveMontCodigo y resolveMontColor leen campo o legacy", () => {
    expect(resolveMontCodigo("ABC", [])).toBe("ABC")
    expect(
      resolveMontCodigo("", [{ tipo: "codigo", descripcion: "77501" }]),
    ).toBe("77501")
    expect(resolveMontColor("Cyan", [{ tipo: "color", descripcion: "Magenta" }])).toBe(
      "Cyan",
    )
  })

  it("resolveMontStickyBack lee campo dedicado o fila legacy", () => {
    expect(resolveMontStickyBack("Laminado", [])).toBe("Laminado")
    expect(
      resolveMontStickyBack("", [{ tipo: "sticky_back", descripcion: "Reverso" }]),
    ).toBe("Reverso")
  })

  it("readMontajeMaterialesState conserva filas vacías y migra campos sueltos o legacy", () => {
    expect(
      readMontajeMaterialesState([{ stickyBack: "Rev", codigo: "", color: "Cyan" }]),
    ).toEqual([{ stickyBack: "Rev", codigo: "", color: "Cyan" }])
    expect(readMontajeMaterialesState(undefined, "Lam", "77501", "Negro")).toEqual([
      { stickyBack: "Lam", codigo: "77501", color: "Negro" },
    ])
    expect(
      readMontajeMaterialesState(undefined, "", "", "", [
        { tipo: "sticky_back", descripcion: "A" },
        { tipo: "codigo", descripcion: "B" },
        { tipo: "color", descripcion: "C" },
      ]),
    ).toEqual([{ stickyBack: "A", codigo: "B", color: "C" }])
  })

  it("montajeMaterialesForSave omite filas totalmente vacías", () => {
    expect(
      montajeMaterialesForSave([
        { stickyBack: "Rev", codigo: "", color: "" },
        { stickyBack: "", codigo: "", color: "" },
      ]),
    ).toEqual([{ stickyBack: "Rev", codigo: "", color: "" }])
  })
})
