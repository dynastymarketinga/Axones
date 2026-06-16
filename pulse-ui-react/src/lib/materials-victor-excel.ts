import type ExcelJS from "exceljs"

export type VictorInventoryArea = "material" | "tintas" | "quimicos" | "miscelaneos"

export type VictorImportRow = {
  sheet_name: string
  row_number: number
  inventory_area: VictorInventoryArea
  sku: string
  name: string
  unit: string
  micras: number | null
  ancho: number | null
  tinta_subarea: string | null
  quantity: number
}

export type VictorParseIssue = {
  sheet_name: string
  row_number: number
  message: string
}

export type VictorParseResult = {
  rows: VictorImportRow[]
  issues: VictorParseIssue[]
  summary: Record<VictorInventoryArea, number>
}

const SUBSTRATE_HEADERS = ["MATERIAL", "MICRAS", "ANCHO", "KG"] as const

const TINTA_SUBAREA_ALIASES: Record<string, string> = {
  LAMINACION: "laminacion",
  "LAMINACION NUEVA": "laminacion_nueva",
  SUPERFICIE: "superficie",
  "PRUEBA LAMINACION": "prueba_laminacion",
}

const VICTOR_SHEET_ORDER = [
  "Hoja3",
  "Hoja2",
  "Hoja4",
  "Hoja5",
  "Hoja6",
  "Hoja7",
  "Hoja8",
  "Hoja9",
  "TINTAS",
  "QUÍMICOS",
  "QUIMICOS",
  "COSUMIBLES (2)",
  "CONSUMIBLES (2)",
] as const

export function slugSkuPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
}

export function skuForSustrato(material: string, micras: number, ancho: number): string {
  const base = slugSkuPart(material.trim()) || "SUB"
  return `SUB-${base}-${Math.round(micras)}-${Math.round(ancho)}`.slice(0, 64)
}

export function skuForTinta(codigo: string): string {
  const code = codigo.trim().toUpperCase().replace(/\s+/g, "-")
  return `TNT-${code}`.slice(0, 64)
}

export function skuForQuimico(cod: string): string {
  return `QIM-${slugSkuPart(cod)}`.slice(0, 64)
}

export function skuForMiscelaneo(name: string, unit: string): string {
  const n = slugSkuPart(name).slice(0, 40)
  const u = slugSkuPart(unit).slice(0, 8)
  return `MSC-${n}-${u}`.slice(0, 64)
}

export function mapMiscUnit(raw: string): string {
  const u = raw.trim().toLowerCase()
  if (u === "kilos" || u === "kg" || u === "kilo") return "kg"
  if (u === "mts" || u === "m" || u === "metro" || u === "metros") return "m"
  if (u === "rollo" || u === "rollos") return "rollo"
  if (u === "paquete" || u === "unidad" || u === "unidades") return "unidad"
  return "otros"
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
}

function cellText(value: ExcelJS.CellValue | null | undefined): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim()
  }
  if (typeof value === "object") {
    if ("result" in value && value.result != null) return String(value.result).trim()
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text ?? "").join("").trim()
    }
    if ("text" in value && value.text) return String(value.text).trim()
  }
  return String(value).trim()
}

function cellNumber(value: ExcelJS.CellValue | null | undefined): number | null {
  const raw = cellText(value).replace(/\s/g, "").replace(",", ".")
  if (raw === "") return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function isSubstrateHeaderRow(ws: ExcelJS.Worksheet, rowNumber: number): boolean {
  const headers = SUBSTRATE_HEADERS.map((h) => normalizeHeader(cellText(ws.getRow(rowNumber).getCell(1 + SUBSTRATE_HEADERS.indexOf(h)).value)))
  return headers.every((h, i) => h === SUBSTRATE_HEADERS[i])
}

function detectTintaSubarea(text: string): string | null {
  const key = normalizeHeader(text)
  return TINTA_SUBAREA_ALIASES[key] ?? null
}

function pushRow(
  rows: VictorImportRow[],
  issues: VictorParseIssue[],
  row: Omit<VictorImportRow, "quantity"> & { quantity: number | null },
): void {
  if (!row.name.trim()) return
  if (row.quantity == null || !Number.isFinite(row.quantity)) {
    issues.push({
      sheet_name: row.sheet_name,
      row_number: row.row_number,
      message: `Cantidad inválida en fila ${row.row_number}`,
    })
    return
  }
  rows.push({ ...row, quantity: Math.max(0, row.quantity) })
}

function parseSubstrateSheet(ws: ExcelJS.Worksheet, sheetName: string, rows: VictorImportRow[], issues: VictorParseIssue[]): void {
  if (!isSubstrateHeaderRow(ws, 1)) return
  const max = ws.rowCount || 1
  for (let r = 2; r <= max; r++) {
    const material = cellText(ws.getRow(r).getCell(1).value)
    const micras = cellNumber(ws.getRow(r).getCell(2).value)
    const ancho = cellNumber(ws.getRow(r).getCell(3).value)
    const qty = cellNumber(ws.getRow(r).getCell(4).value)
    if (!material) continue
    if (micras == null || ancho == null) {
      issues.push({ sheet_name: sheetName, row_number: r, message: "Micras o ancho faltante" })
      continue
    }
    pushRow(rows, issues, {
      sheet_name: sheetName,
      row_number: r,
      inventory_area: "material",
      sku: skuForSustrato(material, micras, ancho),
      name: material.trim(),
      unit: "kg",
      micras,
      ancho,
      tinta_subarea: null,
      quantity: qty ?? 0,
    })
  }
}

function parseTintasSheet(ws: ExcelJS.Worksheet, sheetName: string, rows: VictorImportRow[], issues: VictorParseIssue[]): void {
  let leftSubarea = "laminacion"
  let rightSubarea = "superficie"

  const parseBlock = (
    r: number,
    colorCol: number,
    codigoCol: number,
    kgCol: number,
    subarea: string,
  ) => {
    const color = cellText(ws.getRow(r).getCell(colorCol).value)
    const codigo = cellText(ws.getRow(r).getCell(codigoCol).value)
    const qty = cellNumber(ws.getRow(r).getCell(kgCol).value)
    if (!color || !codigo) return
    const headerish = normalizeHeader(color)
    if (headerish === "COLOR" || headerish === "CODIGO" || headerish === "CÓDIGO") return
    const section = detectTintaSubarea(color)
    if (section && normalizeHeader(codigo) === normalizeHeader(color)) return
    pushRow(rows, issues, {
      sheet_name: sheetName,
      row_number: r,
      inventory_area: "tintas",
      sku: skuForTinta(codigo),
      name: color.trim(),
      unit: "kg",
      micras: null,
      ancho: null,
      tinta_subarea: subarea,
      quantity: qty ?? 0,
    })
  }

  const max = ws.rowCount || 1
  for (let r = 1; r <= max; r++) {
    const c1 = cellText(ws.getRow(r).getCell(1).value)
    const c5 = cellText(ws.getRow(r).getCell(5).value)
    const leftSection = detectTintaSubarea(c1)
    const rightSection = detectTintaSubarea(c5)
    if (leftSection && normalizeHeader(c1) === normalizeHeader(cellText(ws.getRow(r).getCell(2).value))) {
      leftSubarea = leftSection
      continue
    }
    if (rightSection && normalizeHeader(c5) === normalizeHeader(cellText(ws.getRow(r).getCell(6).value))) {
      rightSubarea = rightSection
      continue
    }
    if (normalizeHeader(c1) === "LAMINACION" && normalizeHeader(cellText(ws.getRow(r).getCell(2).value)) === "LAMINACION") {
      leftSubarea = "laminacion"
    }
    if (normalizeHeader(c5) === "SUPERFICIE" && normalizeHeader(cellText(ws.getRow(r).getCell(6).value)) === "SUPERFICIE") {
      rightSubarea = "superficie"
    }
    parseBlock(r, 1, 2, 3, leftSubarea)
    parseBlock(r, 5, 6, 7, rightSubarea)
  }
}

function parseQuimicosSheet(ws: ExcelJS.Worksheet, sheetName: string, rows: VictorImportRow[], issues: VictorParseIssue[]): void {
  const max = ws.rowCount || 1
  for (let r = 1; r <= max; r++) {
    const cod = cellText(ws.getRow(r).getCell(2).value)
    const material = cellText(ws.getRow(r).getCell(3).value)
    const qty = cellNumber(ws.getRow(r).getCell(4).value)
    if (!cod || !material) continue
    if (normalizeHeader(cod) === "COD") continue
    pushRow(rows, issues, {
      sheet_name: sheetName,
      row_number: r,
      inventory_area: "quimicos",
      sku: skuForQuimico(cod),
      name: material.trim(),
      unit: "kg",
      micras: null,
      ancho: null,
      tinta_subarea: null,
      quantity: qty ?? 0,
    })
  }
}

function parseConsumiblesSheet(ws: ExcelJS.Worksheet, sheetName: string, rows: VictorImportRow[], issues: VictorParseIssue[]): void {
  const parseBlock = (r: number, unitCol: number, materialCol: number, qtyCol: number) => {
    const unitRaw = cellText(ws.getRow(r).getCell(unitCol).value)
    const material = cellText(ws.getRow(r).getCell(materialCol).value)
    const qty = cellNumber(ws.getRow(r).getCell(qtyCol).value)
    if (!material) return
    const unitKey = normalizeHeader(unitRaw)
    if (unitKey === "UNIDAD" || unitKey === "MATERIAL" || unitKey === "CANTIDAD") return
    if (unitKey === material.toUpperCase()) return
    const unit = mapMiscUnit(unitRaw)
    pushRow(rows, issues, {
      sheet_name: sheetName,
      row_number: r,
      inventory_area: "miscelaneos",
      sku: skuForMiscelaneo(material, unitRaw || unit),
      name: material.trim(),
      unit,
      micras: null,
      ancho: null,
      tinta_subarea: null,
      quantity: qty ?? 0,
    })
  }

  const max = ws.rowCount || 1
  for (let r = 1; r <= max; r++) {
    parseBlock(r, 1, 2, 3)
    parseBlock(r, 5, 6, 7)
  }
}

export function dedupeVictorRows(rows: VictorImportRow[]): { rows: VictorImportRow[]; duplicates: number } {
  const map = new Map<string, VictorImportRow>()
  let duplicates = 0
  for (const row of rows) {
    if (map.has(row.sku)) duplicates += 1
    map.set(row.sku, row)
  }
  return { rows: [...map.values()], duplicates }
}

export async function parseVictorExcel(file: File): Promise<VictorParseResult> {
  const ExcelJS = (await import("exceljs")).default
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const rows: VictorImportRow[] = []
  const issues: VictorParseIssue[] = []

  for (const ws of wb.worksheets) {
    const name = ws.name
    const normalizedName = normalizeHeader(name)

    if (normalizedName.includes("TINTA") && normalizedName !== "TINTAS") continue
    if (normalizedName === "TINTAS") {
      parseTintasSheet(ws, name, rows, issues)
    } else if (normalizedName.includes("QUIMIC")) {
      parseQuimicosSheet(ws, name, rows, issues)
    } else if (normalizedName.includes("COSUMIB") || normalizedName.includes("CONSUMIB")) {
      parseConsumiblesSheet(ws, name, rows, issues)
    } else if (isSubstrateHeaderRow(ws, 1)) {
      parseSubstrateSheet(ws, name, rows, issues)
    }
  }

  const deduped = dedupeVictorRows(rows)
  const summary: Record<VictorInventoryArea, number> = {
    material: 0,
    tintas: 0,
    quimicos: 0,
    miscelaneos: 0,
  }
  for (const row of deduped.rows) summary[row.inventory_area] += 1

  if (deduped.duplicates > 0) {
    issues.push({
      sheet_name: "—",
      row_number: 0,
      message: `${deduped.duplicates} fila(s) duplicada(s) por SKU; se conservó la última.`,
    })
  }

  return { rows: deduped.rows, issues, summary }
}

export type VictorExportMaterial = {
  sku: string
  name: string
  inventory_area: string
  unit: string
  micras?: string | number | null
  ancho?: string | number | null
  quantity_on_hand: string | number
  tinta_subareas?: Array<{ subarea: string }>
  victor_sheet?: string | null
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

function sheetForSustrato(name: string): string {
  const n = name.trim().toUpperCase()
  const map: Record<string, string> = {
    "BOPP NORMAL": "Hoja3",
    "BOPP MATE": "Hoja2",
    METAL: "Hoja4",
    "BOPP PASTA": "Hoja5",
    PERLADO: "Hoja6",
    CAST: "Hoja7",
    PEBD: "Hoja8",
    "PEBD PIGMENT": "Hoja9",
  }
  return map[n] ?? `Sustrato ${slugSkuPart(n).slice(0, 20)}`
}

function groupMaterialsForExport(materials: VictorExportMaterial[]) {
  const groups = new Map<string, VictorExportMaterial[]>()

  for (const m of materials) {
    let sheet: string
    if (m.victor_sheet?.trim()) {
      sheet = m.victor_sheet.trim()
    } else if (m.inventory_area === "material") {
      sheet = sheetForSustrato(m.name)
    } else if (m.inventory_area === "tintas") {
      sheet = "TINTAS"
    } else if (m.inventory_area === "quimicos") {
      sheet = "QUÍMICOS"
    } else if (m.inventory_area === "miscelaneos") {
      sheet = "COSUMIBLES (2)"
    } else {
      continue
    }
    const list = groups.get(sheet) ?? []
    list.push(m)
    groups.set(sheet, list)
  }

  return groups
}

export async function exportVictorExcel(materials: VictorExportMaterial[], filename?: string): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const groups = groupMaterialsForExport(materials)

  const orderedSheets = [
    ...VICTOR_SHEET_ORDER.filter((s) => groups.has(s)),
    ...[...groups.keys()].filter((s) => !VICTOR_SHEET_ORDER.includes(s as (typeof VICTOR_SHEET_ORDER)[number])),
  ]

  for (const sheetName of orderedSheets) {
    const items = groups.get(sheetName) ?? []
    if (!items.length) continue
    const area = items[0]?.inventory_area

    if (area === "material") {
      const ws = wb.addWorksheet(sheetName)
      ws.getRow(1).values = ["MATERIAL", "MICRAS", "ANCHO", "KG"]
      ws.getRow(1).font = { bold: true }
      const sorted = [...items].sort((a, b) => {
        const nc = a.name.localeCompare(b.name, "es")
        if (nc !== 0) return nc
        return Number(a.micras ?? 0) - Number(b.micras ?? 0) || Number(a.ancho ?? 0) - Number(b.ancho ?? 0)
      })
      sorted.forEach((m, idx) => {
        ws.getRow(idx + 2).values = [
          m.name,
          Number(m.micras ?? 0),
          Number(m.ancho ?? 0),
          Number(String(m.quantity_on_hand).replace(",", ".")) || 0,
        ]
      })
      ws.columns = [{ width: 22 }, { width: 10 }, { width: 10 }, { width: 14 }]
    } else if (area === "tintas") {
      const ws = wb.addWorksheet("TINTAS")
      ws.getCell("A7").value = "LAMINACION"
      ws.getCell("E7").value = "SUPERFICIE"
      ws.getRow(8).values = [undefined, "COLOR", "CÓDIGO", "KG", undefined, "COLOR", "CÓDIGO", "KG"]
      const laminacion = items.filter((m) => (m.tinta_subareas?.[0]?.subarea ?? "laminacion") === "laminacion")
      const superficie = items.filter((m) => (m.tinta_subareas?.[0]?.subarea ?? "") === "superficie")
      const otros = items.filter((m) => {
        const s = m.tinta_subareas?.[0]?.subarea ?? ""
        return s !== "laminacion" && s !== "superficie"
      })
      let row = 9
      const maxRows = Math.max(laminacion.length, superficie.length, otros.length)
      for (let i = 0; i < maxRows; i++) {
        const l = laminacion[i]
        const s = superficie[i]
        if (l) {
          ws.getRow(row).getCell(1).value = l.name
          ws.getRow(row).getCell(2).value = l.sku.replace(/^TNT-/, "")
          ws.getRow(row).getCell(3).value = Number(l.quantity_on_hand) || 0
        }
        if (s) {
          ws.getRow(row).getCell(5).value = s.name
          ws.getRow(row).getCell(6).value = s.sku.replace(/^TNT-/, "")
          ws.getRow(row).getCell(7).value = Number(s.quantity_on_hand) || 0
        }
        row += 1
      }
      for (const m of otros) {
        ws.getRow(row).getCell(1).value = m.name
        ws.getRow(row).getCell(2).value = m.sku.replace(/^TNT-/, "")
        ws.getRow(row).getCell(3).value = Number(m.quantity_on_hand) || 0
        row += 1
      }
    } else if (area === "quimicos") {
      const ws = wb.addWorksheet("QUÍMICOS")
      ws.getRow(9).values = [undefined, "COD", "MATERIAL", "KG"]
      items.forEach((m, idx) => {
        ws.getRow(10 + idx).values = [
          undefined,
          m.sku.replace(/^QIM-/, ""),
          m.name,
          Number(m.quantity_on_hand) || 0,
        ]
      })
    } else if (area === "miscelaneos") {
      const ws = wb.addWorksheet("COSUMIBLES (2)")
      ws.getRow(8).values = ["UNIDAD", "MATERIAL", "CANTIDAD", undefined, "UNIDAD", "MATERIAL", "CANTIDAD"]
      const half = Math.ceil(items.length / 2)
      for (let i = 0; i < half; i++) {
        const left = items[i]
        const right = items[i + half]
        const r = 9 + i
        if (left) {
          ws.getRow(r).getCell(1).value = left.unit
          ws.getRow(r).getCell(2).value = left.name
          ws.getRow(r).getCell(3).value = Number(left.quantity_on_hand) || 0
        }
        if (right) {
          ws.getRow(r).getCell(5).value = right.unit
          ws.getRow(r).getCell(6).value = right.name
          ws.getRow(r).getCell(7).value = Number(right.quantity_on_hand) || 0
        }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  triggerDownload(buffer, filename ?? `inventario-victor-${stamp}.xlsx`)
}

const TEMPLATE_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2EFDA" },
}

function styleTemplateHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = TEMPLATE_HEADER_FILL
}

/** Plantilla vacía con las 4 pestañas y encabezados que espera el importador Victor. */
export async function exportVictorTemplateExcel(): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Axones"
  wb.created = new Date()

  const instr = wb.addWorksheet("INSTRUCCIONES")
  instr.getColumn(1).width = 88
  instr.getCell("A1").value = "Plantilla de inventario — Axones (formato Victor)"
  instr.getCell("A1").font = { bold: true, size: 14 }
  const lines = [
    "",
    "Use las pestañas de este libro para cargar inventario en Axones → Materiales → Importar Excel.",
    "",
    "1. SUSTRATO (Hoja3): fila 1 = MATERIAL | MICRAS | ANCHO | KG. Puede duplicar la hoja para cada familia de film (BOPP NORMAL, METAL, etc.).",
    "2. TINTAS: pestaña TINTAS con bloques COLOR | CÓDIGO | KG (laminación a la izquierda, superficie a la derecha).",
    "3. QUÍMICOS: pestaña QUÍMICOS con COD | MATERIAL | KG (encabezados en fila 9).",
    "4. MISC./CONSUMIBLES: pestaña COSUMIBLES (2) con UNIDAD | MATERIAL | CANTIDAD (encabezados en fila 8).",
    "",
    "No cambie los nombres de pestaña ni los textos de encabezado sin coordinar con sistemas.",
    "Guía completa: docs/FORMATO-INVENTARIO-VICTOR.md (repositorio) o /formato-inventario-victor.md en la app.",
  ]
  lines.forEach((line, i) => {
    instr.getCell(`A${i + 2}`).value = line
  })

  const sustrato = wb.addWorksheet("Hoja3")
  const subHeader = sustrato.getRow(1)
  subHeader.values = ["MATERIAL", "MICRAS", "ANCHO", "KG"]
  styleTemplateHeaderRow(subHeader)
  sustrato.getRow(2).values = ["BOPP NORMAL", 20, 600, 0]
  sustrato.getRow(3).values = ["", "", "", ""]
  sustrato.columns = [{ width: 22 }, { width: 10 }, { width: 10 }, { width: 14 }]

  const tintas = wb.addWorksheet("TINTAS")
  tintas.getCell("A7").value = "LAMINACION"
  tintas.getCell("E7").value = "SUPERFICIE"
  tintas.getRow(7).font = { bold: true }
  const tintaHeader = tintas.getRow(8)
  tintaHeader.values = [undefined, "COLOR", "CÓDIGO", "KG", undefined, "COLOR", "CÓDIGO", "KG"]
  styleTemplateHeaderRow(tintaHeader)
  tintas.getRow(9).values = ["BLANCO", "BL-0000", 0, undefined, "NEGRO", "BN-0000", 0]
  tintas.columns = [{ width: 28 }, { width: 16 }, { width: 10 }, { width: 4 }, { width: 28 }, { width: 16 }, { width: 10 }]

  const quimicos = wb.addWorksheet("QUÍMICOS")
  quimicos.getRow(9).values = [undefined, "COD", "MATERIAL", "KG"]
  styleTemplateHeaderRow(quimicos.getRow(9))
  quimicos.getRow(10).values = [undefined, "QIM-001", "Ejemplo químico", 0]
  quimicos.columns = [{ width: 4 }, { width: 14 }, { width: 36 }, { width: 12 }]

  const consumibles = wb.addWorksheet("COSUMIBLES (2)")
  const consHeader = consumibles.getRow(8)
  consHeader.values = ["UNIDAD", "MATERIAL", "CANTIDAD", undefined, "UNIDAD", "MATERIAL", "CANTIDAD"]
  styleTemplateHeaderRow(consHeader)
  consumibles.getRow(9).values = ["unidad", "Ejemplo consumible", 0, undefined, "kilos", "", 0]
  consumibles.columns = [{ width: 12 }, { width: 32 }, { width: 12 }, { width: 4 }, { width: 12 }, { width: 32 }, { width: 12 }]

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(buffer, "plantilla-inventario-victor.xlsx")
}
