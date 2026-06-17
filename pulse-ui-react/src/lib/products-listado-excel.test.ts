import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  buildListadoExportRows,
  canonicalizePrintType,
  formatClienteExportLabel,
  normalizeRif,
  parseClienteCell,
  parseListadoProductosExcel,
  PRODUCT_HEADERS_ES,
} from "@/lib/products-listado-excel"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const listadoPath = path.join(repoRoot, "LISTADO DE PRODUCTOS.xlsx")

describe("products-listado-excel helpers", () => {
  it("normalizes J-type RIF", () => {
    expect(normalizeRif("J-30827011-3")).toBe("J-30827011-3")
    expect(normalizeRif("RIF J308270113")).toBe("J-30827011-3")
  })

  it("parses cliente cell with RIF", () => {
    const parsed = parseClienteCell("IMPROA SANTONI, C.A. (RIF J-30827011-3)")
    expect(parsed.nombre).toBe("IMPROA SANTONI, C.A.")
    expect(parsed.rif).toBe("J-30827011-3")
  })

  it("formats cliente export label", () => {
    expect(formatClienteExportLabel("IMPROA SANTONI, C.A.", "J-30827011-3")).toBe(
      "IMPROA SANTONI, C.A. (RIF J-30827011-3)",
    )
  })

  it("canonicalizes print type", () => {
    expect(canonicalizePrintType("superficie")).toBe("Superficie")
    expect(canonicalizePrintType("Bilaminado")).toBe("Bilaminado")
    expect(canonicalizePrintType("invalido")).toBeNull()
  })

  it("builds export rows from products and clients map", () => {
    const rows = buildListadoExportRows(
      [
        {
          id: 1,
          client_id: 10,
          name: "ARROZ PREMIUM SANTONI 900g",
          cpe: "0422515856",
          mps: "A-101.240",
          barcode: "7592498220457",
          print_type: "Superficie",
          structure: "BOPP / tinta",
        },
      ],
      new Map([
        [
          10,
          {
            id: 10,
            name: "IMPROA SANTONI, C.A.",
            rif: "J-30827011-3",
            state: null,
            city: null,
            address: null,
            email: null,
            phone: null,
          },
        ],
      ]),
    )
    expect(rows[0]?.producto).toBe("ARROZ PREMIUM SANTONI 900g")
    expect(rows[0]?.rif_cliente).toBe("J-30827011-3")
    expect(rows[0]?.cpe).toBe("0422515856")
    expect(rows[0]?.tipo_impresion).toBe("Superficie")
    expect(rows[0]?.estructura).toBe("BOPP / tinta")
  })

  it("parses organized workbook with Spanish headers", async () => {
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    const wsClients = wb.addWorksheet("CLIENTES")
    wsClients.getRow(1).values = ["Nombre del cliente", "RIF", "Cantidad de productos"]
    wsClients.getRow(2).values = ["IMPROA SANTONI, C.A.", "J-30827011-3", 1]

    const wsProducts = wb.addWorksheet("PRODUCTOS")
    wsProducts.getRow(1).values = [...PRODUCT_HEADERS_ES]
    wsProducts.getRow(2).values = [
      "ARROZ PREMIUM SANTONI 900g",
      "J-30827011-3",
      "IMPROA SANTONI, C.A.",
      "0422515856",
      "A-101.240",
      "7592498220457",
      "Superficie",
      "BOPP / tinta",
    ]

    const buffer = await wb.xlsx.writeBuffer()
    const file = new File([buffer], "organizado-es.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const result = await parseListadoProductosExcel(file)

    expect(result.format).toBe("organizado")
    expect(result.products).toHaveLength(1)
    expect(result.products[0]?.tipo_impresion).toBe("Superficie")
    expect(result.products[0]?.estructura).toBe("BOPP / tinta")
  })
})

describe("parseListadoProductosExcel", () => {
  it(
    "parses LISTADO DE PRODUCTOS.xlsx from repo root",
    async () => {
    let buffer: Buffer
    try {
      buffer = await readFile(listadoPath)
    } catch {
      // Archivo local de planta; omitir en CI si no está presente.
      return
    }

    const file = new File([buffer], "LISTADO DE PRODUCTOS.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const result = await parseListadoProductosExcel(file)

    expect(result.format).toBe("original")
    expect(result.products.length).toBeGreaterThan(50)

    const names = result.products.map((p) => p.producto)
    expect(names).toContain("ALIMENTO LACTEO PARMALAT MAX 400g")
    expect(names).toContain("ARROZ BLANCO DON JULIAN TIPO III 900g (AMARILLO)")
    expect(names).toContain("ARROZ BLANCO TRADICIONAL DON JULIAN 2,5 kg")
    expect(names).toContain("ARROZ PREMIUM SANTONI 900g")
    expect(names).toContain("ARVEJAS VERDES PARTIDAS ALVARIGUA 400 g")

    const santoni = result.products.find((p) => p.producto === "ARROZ PREMIUM SANTONI 900g")
    expect(santoni?.rif_cliente).toBe("J-30827011-3")
    expect(santoni?.cpe).toBe("0422515856")
    expect(santoni?.mps).toBe("A-101.240")
  },
    20_000,
  )
})
