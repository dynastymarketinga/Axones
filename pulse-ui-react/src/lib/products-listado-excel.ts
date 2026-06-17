import type ExcelJS from "exceljs"

import type { ClientRecord, ProductRecord } from "@/types/api"

export type ListadoImportClient = {
  nombre_cliente: string
  rif: string
  sheet_name: string
  row_number: number
}

export type ListadoImportProduct = {
  producto: string
  nombre_cliente: string
  rif_cliente: string
  cpe: string | null
  mps: string | null
  cod_barra: string | null
  sheet_name: string
  row_number: number
}

export type ListadoParseIssue = {
  sheet_name: string
  row_number: number
  message: string
}

export type ListadoParseResult = {
  format: "original" | "organizado"
  clients: ListadoImportClient[]
  products: ListadoImportProduct[]
  issues: ListadoParseIssue[]
}

const ORIGINAL_HEADER_ROW = 6
const ORIGINAL_DATA_START = 7

const NA_VALUES = new Set(["N/A", "NA", "N.A.", "—", "-"])

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
}

function cellText(value: ExcelJS.CellValue | null | undefined): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "boolean") return value.trim()
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value)
    const s = String(value)
    return s.includes("e") || s.includes("E") ? value.toFixed(0) : s
  }
  if (typeof value === "object") {
    if ("result" in value && value.result != null) return cellText(value.result as ExcelJS.CellValue)
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text ?? "").join("").trim()
    }
    if ("text" in value && value.text) return String(value.text).trim()
  }
  return String(value).trim()
}

function normalizeFieldText(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (NA_VALUES.has(t.toUpperCase())) return null
  return t
}

/** Alineado con `RifNormalizer` (PHP) y `normalize_rif()` del script Python. */
export function normalizeRif(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  let s = trimmed.toUpperCase().replace(/\s+/g, "")
  s = s.replace(/^RIF/i, "")
  s = s.replace(/[.\-_]/g, "")

  const m = s.match(/^([JVEGPC])(\d{7,9})$/)
  if (!m) return trimmed

  const letter = m[1]
  const digits = m[2]
  const main = digits.slice(0, -1)
  const dv = digits.slice(-1)

  if (letter === "J") return `J-${main}-${dv}`
  return `${letter}${main}${dv}`
}

/** Extrae nombre y RIF de celda tipo "EMPRESA, C.A. (RIF J-12345678-9)". */
export function parseClienteCell(raw: string): { nombre: string; rif: string } {
  const text = raw.trim()
  if (!text) return { nombre: "", rif: "" }

  const m = text.match(/\(([^)]+)\)\s*$/)
  if (!m) return { nombre: text, rif: "" }

  const inner = m[1].trim()
  const nombre = text.slice(0, m.index).trim().replace(/,\s*$/, "").trim()
  const rifPart = inner.replace(/^RIF\s*/i, "").trim()
  const rif = rifPart ? normalizeRif(rifPart) : ""

  return { nombre, rif }
}

export function formatClienteExportLabel(name: string, rif: string | null | undefined): string {
  const n = name.trim()
  const r = (rif ?? "").trim()
  if (!n) return ""
  if (!r) return n
  return `${n} (RIF ${r})`
}

function sheetHasHeaders(ws: ExcelJS.Worksheet, headers: string[], rowNumber = 1): boolean {
  const row = ws.getRow(rowNumber)
  return headers.every((h, i) => normalizeHeader(cellText(row.getCell(i + 1).value)) === normalizeHeader(h))
}

function detectFormat(wb: ExcelJS.Workbook): "original" | "organizado" {
  for (const ws of wb.worksheets) {
    const name = normalizeHeader(ws.name)
    if (name === "PRODUCTOS" && sheetHasHeaders(ws, ["producto", "rif_cliente", "nombre_cliente", "cpe", "mps", "cod_barra"])) {
      return "organizado"
    }
    if (name === "CLIENTES" && sheetHasHeaders(ws, ["nombre_cliente", "rif", "cantidad_productos"])) {
      return "organizado"
    }
  }
  return "original"
}

function findWorksheet(wb: ExcelJS.Workbook, ...names: string[]): ExcelJS.Worksheet | null {
  const wanted = new Set(names.map((n) => normalizeHeader(n)))
  for (const ws of wb.worksheets) {
    if (wanted.has(normalizeHeader(ws.name))) return ws
  }
  return null
}

function parseOriginalSheet(ws: ExcelJS.Worksheet, sheetName: string): Pick<ListadoParseResult, "clients" | "products" | "issues"> {
  const products: ListadoImportProduct[] = []
  const issues: ListadoParseIssue[] = []
  const clientKeys = new Map<string, ListadoImportClient>()

  const max = ws.rowCount || ORIGINAL_DATA_START
  for (let r = ORIGINAL_DATA_START; r <= max; r++) {
    const producto = cellText(ws.getRow(r).getCell(1).value)
    if (!producto) continue

    const clienteRaw = cellText(ws.getRow(r).getCell(2).value)
    const { nombre, rif } = parseClienteCell(clienteRaw)
    const cpe = normalizeFieldText(cellText(ws.getRow(r).getCell(3).value))
    const mps = normalizeFieldText(cellText(ws.getRow(r).getCell(4).value))
    const codBarra = normalizeFieldText(cellText(ws.getRow(r).getCell(5).value))

    if (!nombre && !rif) {
      issues.push({ sheet_name: sheetName, row_number: r, message: "Cliente vacío o no parseable" })
      continue
    }
    if (!rif) {
      issues.push({ sheet_name: sheetName, row_number: r, message: `Sin RIF en cliente: ${clienteRaw || "—"}` })
    }

    const clientKey = rif || nombre.toUpperCase()
    if (!clientKeys.has(clientKey)) {
      clientKeys.set(clientKey, {
        nombre_cliente: nombre,
        rif,
        sheet_name: sheetName,
        row_number: r,
      })
    }

    products.push({
      producto,
      nombre_cliente: nombre,
      rif_cliente: rif,
      cpe,
      mps,
      cod_barra: codBarra,
      sheet_name: sheetName,
      row_number: r,
    })
  }

  return { clients: [...clientKeys.values()], products, issues }
}

function parseOrganizadoWorkbook(wb: ExcelJS.Workbook): Pick<ListadoParseResult, "clients" | "products" | "issues"> {
  const issues: ListadoParseIssue[] = []
  const clients: ListadoImportClient[] = []
  const clientByRif = new Map<string, ListadoImportClient>()
  const clientByName = new Map<string, ListadoImportClient>()

  const wsClients = findWorksheet(wb, "CLIENTES")
  if (wsClients) {
    const max = wsClients.rowCount || 1
    for (let r = 2; r <= max; r++) {
      const nombre = cellText(wsClients.getRow(r).getCell(1).value)
      const rif = normalizeRif(cellText(wsClients.getRow(r).getCell(2).value))
      if (!nombre && !rif) continue
      const row: ListadoImportClient = {
        nombre_cliente: nombre,
        rif,
        sheet_name: wsClients.name,
        row_number: r,
      }
      clients.push(row)
      if (rif) clientByRif.set(rif, row)
      if (nombre) clientByName.set(nombre.toUpperCase(), row)
      if (!rif) {
        issues.push({ sheet_name: wsClients.name, row_number: r, message: `Cliente sin RIF: ${nombre}` })
      }
    }
  }

  const products: ListadoImportProduct[] = []
  const wsProducts = findWorksheet(wb, "PRODUCTOS")
  if (!wsProducts) {
    issues.push({ sheet_name: "—", row_number: 0, message: "No se encontró hoja PRODUCTOS" })
    return { clients, products, issues }
  }

  const max = wsProducts.rowCount || 1
  for (let r = 2; r <= max; r++) {
    const producto = cellText(wsProducts.getRow(r).getCell(1).value)
    if (!producto) continue

    const rif = normalizeRif(cellText(wsProducts.getRow(r).getCell(2).value))
    const nombre = cellText(wsProducts.getRow(r).getCell(3).value)
    const cpe = normalizeFieldText(cellText(wsProducts.getRow(r).getCell(4).value))
    const mps = normalizeFieldText(cellText(wsProducts.getRow(r).getCell(5).value))
    const codBarra = normalizeFieldText(cellText(wsProducts.getRow(r).getCell(6).value))

    if (!rif && !nombre) {
      issues.push({ sheet_name: wsProducts.name, row_number: r, message: "Falta rif_cliente y nombre_cliente" })
      continue
    }
    if (!rif) {
      issues.push({ sheet_name: wsProducts.name, row_number: r, message: `Producto sin RIF de cliente: ${producto}` })
    }

    if (rif && !clientByRif.has(rif) && nombre) {
      const inferred: ListadoImportClient = {
        nombre_cliente: nombre,
        rif,
        sheet_name: wsProducts.name,
        row_number: r,
      }
      clients.push(inferred)
      clientByRif.set(rif, inferred)
      clientByName.set(nombre.toUpperCase(), inferred)
    }

    products.push({
      producto,
      nombre_cliente: nombre,
      rif_cliente: rif,
      cpe,
      mps,
      cod_barra: codBarra,
      sheet_name: wsProducts.name,
      row_number: r,
    })
  }

  return { clients, products, issues }
}

export async function parseListadoProductosExcel(file: File): Promise<ListadoParseResult> {
  const ExcelJS = (await import("exceljs")).default
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const format = detectFormat(wb)
  const parsed =
    format === "organizado"
      ? parseOrganizadoWorkbook(wb)
      : parseOriginalSheet(wb.worksheets[0] ?? wb.addWorksheet("Hoja1"), wb.worksheets[0]?.name ?? "Hoja1")

  return { format, ...parsed }
}

export type ListadoExportRow = {
  producto: string
  cliente_label: string
  nombre_cliente: string
  rif_cliente: string
  cpe: string | null
  mps: string | null
  cod_barra: string | null
}

export function buildListadoExportRows(
  products: ProductRecord[],
  clientsById: Map<number, ClientRecord>,
): ListadoExportRow[] {
  return products.map((p) => {
    const client = p.client_id != null ? clientsById.get(p.client_id) : null
    const nombre = client?.name ?? p.client?.name ?? ""
    const rif = client?.rif ?? ""
    return {
      producto: p.name,
      cliente_label: formatClienteExportLabel(nombre, rif),
      nombre_cliente: nombre,
      rif_cliente: rif,
      cpe: p.cpe,
      mps: p.mps,
      cod_barra: p.barcode ?? null,
    }
  })
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFC000" },
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = HEADER_FILL
}

function setTextColumn(ws: ExcelJS.Worksheet, col: number, fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    cell.numFmt = "@"
    if (cell.value != null && cell.value !== "") cell.value = String(cell.value)
  }
}

function buildClientsFromRows(rows: ListadoExportRow[]): Array<{ nombre: string; rif: string; count: number }> {
  const map = new Map<string, { nombre: string; rif: string; count: number }>()
  for (const row of rows) {
    const rif = row.rif_cliente.trim()
    const nombre = row.nombre_cliente.trim()
    if (!rif && !nombre) continue
    const key = rif || nombre.toUpperCase()
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
    } else {
      map.set(key, { nombre, rif, count: 1 })
    }
  }
  return [...map.values()]
}

export async function exportListadoProductosExcel(
  rows: ListadoExportRow[],
  filename?: string,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Axones"
  wb.created = new Date()

  const clients = buildClientsFromRows(rows)

  const wsClients = wb.addWorksheet("CLIENTES")
  const clientHeader = wsClients.getRow(1)
  clientHeader.values = ["nombre_cliente", "rif", "cantidad_productos"]
  styleHeaderRow(clientHeader)
  clients.forEach((c, i) => {
    wsClients.getRow(i + 2).values = [c.nombre, c.rif, c.count]
  })
  setTextColumn(wsClients, 2, 2, wsClients.rowCount)

  const wsProducts = wb.addWorksheet("PRODUCTOS")
  const productHeader = wsProducts.getRow(1)
  productHeader.values = ["producto", "rif_cliente", "nombre_cliente", "cpe", "mps", "cod_barra", "fila_origen"]
  styleHeaderRow(productHeader)
  rows.forEach((row, i) => {
    wsProducts.getRow(i + 2).values = [
      row.producto,
      row.rif_cliente,
      row.nombre_cliente,
      row.cpe ?? "",
      row.mps ?? "",
      row.cod_barra ?? "",
      String(i + 7),
    ]
  })
  setTextColumn(wsProducts, 2, 2, wsProducts.rowCount)
  setTextColumn(wsProducts, 4, 2, wsProducts.rowCount)
  setTextColumn(wsProducts, 6, 2, wsProducts.rowCount)

  const wsOriginal = wb.addWorksheet("ORIGINAL")
  const origHeader = wsOriginal.getRow(ORIGINAL_HEADER_ROW)
  origHeader.values = ["producto", "cliente", "cpe", "mps", "cod_barra"]
  styleHeaderRow(origHeader)
  rows.forEach((row, i) => {
    wsOriginal.getRow(ORIGINAL_DATA_START + i).values = [
      row.producto,
      row.cliente_label,
      row.cpe ?? "",
      row.mps ?? "",
      row.cod_barra ?? "",
    ]
  })
  setTextColumn(wsOriginal, 3, ORIGINAL_DATA_START, wsOriginal.rowCount)
  setTextColumn(wsOriginal, 5, ORIGINAL_DATA_START, wsOriginal.rowCount)

  const wsInstr = wb.addWorksheet("INSTRUCCIONES", 0)
  wsInstr.getColumn(1).width = 92
  const lines = [
    "LISTADO DE PRODUCTOS — Exportado desde Axones",
    "",
    "Hojas CLIENTES y PRODUCTOS: formato organizado para reimportar.",
    "Hoja ORIGINAL: mismo layout que el listado de planta (encabezados fila 6).",
    "",
    "Guía: /formato-listado-productos.md",
  ]
  lines.forEach((line, i) => {
    wsInstr.getCell(i + 1, 1).value = line
    if (i === 0) wsInstr.getCell(i + 1, 1).font = { bold: true, size: 12 }
  })

  const buffer = await wb.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  triggerDownload(buffer, filename ?? `listado-productos-${stamp}.xlsx`)
}

export async function exportListadoProductosTemplateExcel(): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Axones"
  wb.created = new Date()

  const wsInstr = wb.addWorksheet("INSTRUCCIONES")
  wsInstr.getColumn(1).width = 92
  const lines = [
    "LISTADO DE PRODUCTOS — Plantilla para Axones",
    "",
    "Puede cargar este archivo en Datos maestros → Especificaciones de producto → Importar Excel.",
    "",
    "FORMATOS ACEPTADOS:",
    "  1. ORIGINAL (una hoja): encabezados en fila 6, datos desde fila 7.",
    "     Columnas: producto | cliente (Nombre + RIF) | cpe | mps | cod_barra",
    "  2. ORGANIZADO: pestañas CLIENTES + PRODUCTOS (como esta plantilla).",
    "",
    "ORDEN: primero clientes (por RIF), luego productos enlazados al mismo RIF.",
    "CPE y código de barra: usar formato Texto para conservar ceros a la izquierda.",
    "N/A en cpe, mps o cod_barra se interpreta como vacío.",
    "",
    "Tipo de impresión y estructura NO vienen del Excel; complételos después en Axones.",
    "",
    "Guía completa: /formato-listado-productos.md",
  ]
  lines.forEach((line, i) => {
    wsInstr.getCell(i + 1, 1).value = line
    if (i === 0) wsInstr.getCell(i + 1, 1).font = { bold: true, size: 12 }
  })

  const wsClients = wb.addWorksheet("CLIENTES")
  const ch = wsClients.getRow(1)
  ch.values = ["nombre_cliente", "rif", "cantidad_productos"]
  styleHeaderRow(ch)
  wsClients.getRow(2).values = ["EJEMPLO C.A.", "J-12345678-9", 1]
  setTextColumn(wsClients, 2, 2, 2)

  const wsProducts = wb.addWorksheet("PRODUCTOS")
  const ph = wsProducts.getRow(1)
  ph.values = ["producto", "rif_cliente", "nombre_cliente", "cpe", "mps", "cod_barra", "fila_origen"]
  styleHeaderRow(ph)
  wsProducts.getRow(2).values = [
    "ARROZ PREMIUM SANTONI 900g",
    "J-30827011-3",
    "IMPROA SANTONI, C.A.",
    "0422515856",
    "A-101.240",
    "7592498220457",
    "7",
  ]
  setTextColumn(wsProducts, 2, 2, 2)
  setTextColumn(wsProducts, 4, 2, 2)
  setTextColumn(wsProducts, 6, 2, 2)

  const wsOrig = wb.addWorksheet("ORIGINAL_EJEMPLO")
  const oh = wsOrig.getRow(ORIGINAL_HEADER_ROW)
  oh.values = ["producto", "cliente", "cpe", "mps", "cod_barra"]
  styleHeaderRow(oh)
  wsOrig.getRow(ORIGINAL_DATA_START).values = [
    "ARROZ PREMIUM SANTONI 900g",
    "IMPROA SANTONI, C.A. (RIF J-30827011-3)",
    "0422515856",
    "A-101.240",
    "7592498220457",
  ]
  setTextColumn(wsOrig, 3, ORIGINAL_DATA_START, ORIGINAL_DATA_START)
  setTextColumn(wsOrig, 5, ORIGINAL_DATA_START, ORIGINAL_DATA_START)

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(buffer, "plantilla-listado-productos.xlsx")
}
