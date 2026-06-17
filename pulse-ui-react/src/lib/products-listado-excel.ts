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
  tipo_impresion: string | null
  estructura: string | null
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

export const PRODUCT_PRINT_TYPES = ["Superficie", "Bilaminado", "Trilaminado"] as const

export const CLIENT_HEADERS_ES = [
  "Nombre del cliente",
  "RIF",
  "Cantidad de productos",
] as const

export const PRODUCT_HEADERS_ES = [
  "Nombre del producto",
  "RIF del cliente",
  "Nombre del cliente",
  "C.P.E.",
  "M.P.P.S.",
  "Código de barra",
  "Tipo de impresión",
  "Estructura",
] as const

const ORIGINAL_HEADER_ROW = 6
const ORIGINAL_DATA_START = 7

const NA_VALUES = new Set(["N/A", "NA", "N.A.", "—", "-"])

const GREEN_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2EFDA" },
}

const YELLOW_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFC000" },
}

const CLIENT_COL_WIDTHS = [36, 16, 18] as const
const PRODUCT_COL_WIDTHS = [42, 16, 36, 14, 14, 18, 18, 40] as const
const ORIGINAL_COL_WIDTHS = [42, 48, 14, 14, 18] as const

/** Encabezado normalizado → clave de campo en hoja CLIENTES. */
const CLIENT_HEADER_ALIASES: Record<string, "nombre_cliente" | "rif" | "cantidad_productos"> = {
  NOMBRE_CLIENTE: "nombre_cliente",
  "NOMBRE DEL CLIENTE": "nombre_cliente",
  RIF: "rif",
  CANTIDAD_PRODUCTOS: "cantidad_productos",
  "CANTIDAD DE PRODUCTOS": "cantidad_productos",
}

/** Encabezado normalizado → clave de campo en hoja PRODUCTOS. */
const PRODUCT_HEADER_ALIASES: Record<
  string,
  | "producto"
  | "rif_cliente"
  | "nombre_cliente"
  | "cpe"
  | "mps"
  | "cod_barra"
  | "tipo_impresion"
  | "estructura"
> = {
  PRODUCTO: "producto",
  "NOMBRE DEL PRODUCTO": "producto",
  NOMBRE_PRODUCTO: "producto",
  RIF_CLIENTE: "rif_cliente",
  "RIF DEL CLIENTE": "rif_cliente",
  NOMBRE_CLIENTE: "nombre_cliente",
  "NOMBRE DEL CLIENTE": "nombre_cliente",
  CPE: "cpe",
  "C.P.E.": "cpe",
  "C.P.E": "cpe",
  MPS: "mps",
  "M.P.P.S.": "mps",
  "M.P.P.S": "mps",
  MPPS: "mps",
  COD_BARRA: "cod_barra",
  "CODIGO DE BARRA": "cod_barra",
  "CODIGO DE BARRAS": "cod_barra",
  TIPO_IMPRESION: "tipo_impresion",
  "TIPO DE IMPRESION": "tipo_impresion",
  PRINT_TYPE: "tipo_impresion",
  ESTRUCTURA: "estructura",
  STRUCTURE: "estructura",
}

const LEGACY_PRODUCT_HEADERS = [
  "producto",
  "rif_cliente",
  "nombre_cliente",
  "cpe",
  "mps",
  "cod_barra",
] as const

const LEGACY_CLIENT_HEADERS = ["nombre_cliente", "rif", "cantidad_productos"] as const

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
}

function cellText(value: ExcelJS.CellValue | null | undefined): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "boolean") return String(value)
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

export function canonicalizePrintType(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim()
  if (!t) return null
  const lower = t.toLowerCase()
  for (const allowed of PRODUCT_PRINT_TYPES) {
    if (allowed.toLowerCase() === lower) return allowed
  }
  return null
}

type ColumnMap<T extends string> = Partial<Record<T, number>>

function buildColumnMap<T extends string>(
  ws: ExcelJS.Worksheet,
  aliases: Record<string, T>,
  rowNumber = 1,
): ColumnMap<T> {
  const row = ws.getRow(rowNumber)
  const map: ColumnMap<T> = {}
  const colCount = Math.max(row.cellCount, ws.columnCount, 12)
  for (let c = 1; c <= colCount; c++) {
    const header = normalizeHeader(cellText(row.getCell(c).value))
    if (!header) continue
    const key = aliases[header]
    if (key && map[key] == null) map[key] = c
  }
  return map
}

function sheetHasProductHeaders(ws: ExcelJS.Worksheet, rowNumber = 1): boolean {
  const map = buildColumnMap(ws, PRODUCT_HEADER_ALIASES, rowNumber)
  return map.producto != null && (map.rif_cliente != null || map.nombre_cliente != null)
}

function sheetHasClientHeaders(ws: ExcelJS.Worksheet, rowNumber = 1): boolean {
  const map = buildColumnMap(ws, CLIENT_HEADER_ALIASES, rowNumber)
  return map.nombre_cliente != null && map.rif != null
}

function sheetHasLegacyHeaders(ws: ExcelJS.Worksheet, headers: readonly string[], rowNumber = 1): boolean {
  const row = ws.getRow(rowNumber)
  return headers.every((h, i) => normalizeHeader(cellText(row.getCell(i + 1).value)) === normalizeHeader(h))
}

function detectFormat(wb: ExcelJS.Workbook): "original" | "organizado" {
  for (const ws of wb.worksheets) {
    const name = normalizeHeader(ws.name)
    if (name === "PRODUCTOS" && sheetHasProductHeaders(ws)) return "organizado"
    if (name === "CLIENTES" && (sheetHasClientHeaders(ws) || sheetHasLegacyHeaders(ws, LEGACY_CLIENT_HEADERS))) {
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

function getCellByMap(row: ExcelJS.Row, map: ColumnMap<string>, key: string): string {
  const col = map[key]
  if (col == null) return ""
  return cellText(row.getCell(col).value)
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
      tipo_impresion: null,
      estructura: null,
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

  const wsClients = findWorksheet(wb, "CLIENTES")
  if (wsClients) {
    const clientMap = buildColumnMap(wsClients, CLIENT_HEADER_ALIASES)
    if (clientMap.nombre_cliente == null && sheetHasLegacyHeaders(wsClients, LEGACY_CLIENT_HEADERS)) {
      clientMap.nombre_cliente = 1
      clientMap.rif = 2
    }
    const max = wsClients.rowCount || 1
    for (let r = 2; r <= max; r++) {
      const row = wsClients.getRow(r)
      const nombre = getCellByMap(row, clientMap, "nombre_cliente")
      const rif = normalizeRif(getCellByMap(row, clientMap, "rif"))
      if (!nombre && !rif) continue
      const entry: ListadoImportClient = {
        nombre_cliente: nombre,
        rif,
        sheet_name: wsClients.name,
        row_number: r,
      }
      clients.push(entry)
      if (rif) clientByRif.set(rif, entry)
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

  let productMap = buildColumnMap(wsProducts, PRODUCT_HEADER_ALIASES)
  if (productMap.producto == null && sheetHasLegacyHeaders(wsProducts, LEGACY_PRODUCT_HEADERS)) {
    productMap = {
      producto: 1,
      rif_cliente: 2,
      nombre_cliente: 3,
      cpe: 4,
      mps: 5,
      cod_barra: 6,
      tipo_impresion: 7,
      estructura: 8,
    }
  }

  const max = wsProducts.rowCount || 1
  for (let r = 2; r <= max; r++) {
    const row = wsProducts.getRow(r)
    const producto = getCellByMap(row, productMap, "producto")
    if (!producto) continue

    const rif = normalizeRif(getCellByMap(row, productMap, "rif_cliente"))
    const nombre = getCellByMap(row, productMap, "nombre_cliente")
    const cpe = normalizeFieldText(getCellByMap(row, productMap, "cpe"))
    const mps = normalizeFieldText(getCellByMap(row, productMap, "mps"))
    const codBarra = normalizeFieldText(getCellByMap(row, productMap, "cod_barra"))
    const tipoRaw = normalizeFieldText(getCellByMap(row, productMap, "tipo_impresion"))
    const estructura = normalizeFieldText(getCellByMap(row, productMap, "estructura"))

    let tipoImpresion: string | null = null
    if (tipoRaw) {
      const canonical = canonicalizePrintType(tipoRaw)
      if (canonical) {
        tipoImpresion = canonical
      } else {
        issues.push({
          sheet_name: wsProducts.name,
          row_number: r,
          message: `Tipo de impresión no reconocido («${tipoRaw}»). Use: Superficie, Bilaminado o Trilaminado.`,
        })
      }
    }

    if (!rif && !nombre) {
      issues.push({ sheet_name: wsProducts.name, row_number: r, message: "Falta RIF del cliente y nombre del cliente" })
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
    }

    products.push({
      producto,
      nombre_cliente: nombre,
      rif_cliente: rif,
      cpe,
      mps,
      cod_barra: codBarra,
      tipo_impresion: tipoImpresion,
      estructura,
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
  tipo_impresion: string | null
  estructura: string | null
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
      tipo_impresion: p.print_type ?? null,
      estructura: p.structure ?? null,
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

function styleGreenHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = GREEN_HEADER_FILL
}

function styleYellowHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = YELLOW_HEADER_FILL
}

function setTextColumn(ws: ExcelJS.Worksheet, col: number, fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    cell.numFmt = "@"
    if (cell.value != null && cell.value !== "") cell.value = String(cell.value)
  }
}

function applyColumnWidths(ws: ExcelJS.Worksheet, widths: readonly number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
}

function freezeBelowHeader(ws: ExcelJS.Worksheet, splitRow: number) {
  const topLeft = `A${splitRow + 1}`
  ws.views = [{ state: "frozen", ySplit: splitRow, topLeftCell: topLeft, activeCell: topLeft }]
}

function writeInstructionsSheet(ws: ExcelJS.Worksheet, exportMode: boolean) {
  ws.getColumn(1).width = 88
  const title = exportMode
    ? "LISTADO DE PRODUCTOS — Exportado desde Axones"
    : "LISTADO DE PRODUCTOS — Plantilla para Axones"
  const lines = exportMode
    ? [
        "",
        "Este archivo contiene sus especificaciones exportadas desde Axones.",
        "",
        "PASO 1 — Revise la hoja CLIENTES (resumen por RIF).",
        "PASO 2 — Edite la hoja PRODUCTOS si necesita cambios.",
        "PASO 3 — Importe de nuevo en Axones → Especificaciones de producto → Importar Excel.",
        "",
        "La hoja ORIGINAL conserva el formato del listado de planta (encabezados en fila 6).",
        "No es necesario editar ORIGINAL para el flujo habitual.",
        "",
        "Guía completa: /formato-listado-productos.md",
      ]
    : [
        "",
        "Use este archivo para cargar especificaciones en:",
        "Datos maestros → Especificaciones de producto → Importar Excel",
        "",
        "PASO 1 — Complete la hoja CLIENTES (nombre del cliente + RIF obligatorio).",
        "PASO 2 — Complete la hoja PRODUCTOS (una fila por especificación; el RIF debe coincidir).",
        "PASO 3 — En Axones, use Importar Excel, revise la vista previa y confirme.",
        "",
        "Tipo de impresión (opcional): Superficie, Bilaminado o Trilaminado.",
        "C.P.E. y código de barra: use formato Texto en Excel para conservar ceros.",
        "N/A en campos opcionales se interpreta como vacío.",
        "",
        "También se acepta el listado original de planta (una hoja, encabezados fila 6).",
        "",
        "Guía completa: /formato-listado-productos.md",
      ]
  ws.getCell(1, 1).value = title
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  lines.forEach((line, i) => {
    ws.getCell(i + 2, 1).value = line
  })
}

function writeClientsSheet(
  ws: ExcelJS.Worksheet,
  clients: Array<{ nombre: string; rif: string; count: number }>,
) {
  const header = ws.getRow(1)
  header.values = [...CLIENT_HEADERS_ES]
  styleGreenHeaderRow(header)
  applyColumnWidths(ws, CLIENT_COL_WIDTHS)
  clients.forEach((c, i) => {
    ws.getRow(i + 2).values = [c.nombre, c.rif, c.count]
  })
  const lastRow = Math.max(2, ws.rowCount)
  setTextColumn(ws, 2, 2, lastRow)
  freezeBelowHeader(ws, 1)
}

function writeProductsSheet(ws: ExcelJS.Worksheet, rows: ListadoExportRow[]) {
  const header = ws.getRow(1)
  header.values = [...PRODUCT_HEADERS_ES]
  styleGreenHeaderRow(header)
  applyColumnWidths(ws, PRODUCT_COL_WIDTHS)
  rows.forEach((row, i) => {
    ws.getRow(i + 2).values = [
      row.producto,
      row.rif_cliente,
      row.nombre_cliente,
      row.cpe ?? "",
      row.mps ?? "",
      row.cod_barra ?? "",
      row.tipo_impresion ?? "",
      row.estructura ?? "",
    ]
  })
  const lastRow = Math.max(2, ws.rowCount)
  setTextColumn(ws, 2, 2, lastRow)
  setTextColumn(ws, 4, 2, lastRow)
  setTextColumn(ws, 6, 2, lastRow)
  freezeBelowHeader(ws, 1)
}

function writeOriginalSheet(ws: ExcelJS.Worksheet, rows: ListadoExportRow[]) {
  applyColumnWidths(ws, ORIGINAL_COL_WIDTHS)
  const origHeader = ws.getRow(ORIGINAL_HEADER_ROW)
  origHeader.values = ["producto", "cliente", "cpe", "mps", "cod_barra"]
  styleYellowHeaderRow(origHeader)
  rows.forEach((row, i) => {
    ws.getRow(ORIGINAL_DATA_START + i).values = [
      row.producto,
      row.cliente_label,
      row.cpe ?? "",
      row.mps ?? "",
      row.cod_barra ?? "",
    ]
  })
  const lastRow = Math.max(ORIGINAL_DATA_START, ws.rowCount)
  setTextColumn(ws, 3, ORIGINAL_DATA_START, lastRow)
  setTextColumn(ws, 5, ORIGINAL_DATA_START, lastRow)
  freezeBelowHeader(ws, ORIGINAL_HEADER_ROW)
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

const TEMPLATE_EXAMPLE_PRODUCT: ListadoExportRow = {
  producto: "ARROZ PREMIUM SANTONI 900g",
  cliente_label: "IMPROA SANTONI, C.A. (RIF J-30827011-3)",
  nombre_cliente: "IMPROA SANTONI, C.A.",
  rif_cliente: "J-30827011-3",
  cpe: "0422515856",
  mps: "A-101.240",
  cod_barra: "7592498220457",
  tipo_impresion: "Superficie",
  estructura: "BOPP / tinta",
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

  const wsInstr = wb.addWorksheet("INSTRUCCIONES")
  writeInstructionsSheet(wsInstr, true)

  writeClientsSheet(wb.addWorksheet("CLIENTES"), clients)
  writeProductsSheet(wb.addWorksheet("PRODUCTOS"), rows)
  writeOriginalSheet(wb.addWorksheet("ORIGINAL"), rows)

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
  writeInstructionsSheet(wsInstr, false)

  writeClientsSheet(wb.addWorksheet("CLIENTES"), [
    { nombre: "EJEMPLO C.A.", rif: "J-12345678-9", count: 1 },
  ])
  writeProductsSheet(wb.addWorksheet("PRODUCTOS"), [TEMPLATE_EXAMPLE_PRODUCT])

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(buffer, "plantilla-listado-productos.xlsx")
}
