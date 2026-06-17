/**
 * Parsea LISTADO DE PRODUCTOS + INVENTARIO VICTOR y emite JSON por stdout.
 * Uso: npx tsx scripts/import-seed-excel-cli.ts <listado.xlsx> <victor.xlsx>
 */
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import ExcelJS from "exceljs"

import { parseListadoProductosExcel } from "../src/lib/products-listado-excel"
import { parseVictorExcel } from "../src/lib/materials-victor-excel"

async function loadWorkbook(path: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(readFileSync(path))
  return wb
}

function workbookToFile(wb: ExcelJS.Workbook, name: string): File {
  return {
    name,
    async arrayBuffer() {
      const buffer = await wb.xlsx.writeBuffer()
      return buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    },
  } as File
}

async function main(): Promise<void> {
  const listadoPath = process.argv[2]
  const victorPath = process.argv[3]
  if (!listadoPath || !victorPath) {
    console.error("Uso: npx tsx scripts/import-seed-excel-cli.ts <listado.xlsx> <victor.xlsx>")
    process.exit(1)
  }

  const listadoWb = await loadWorkbook(listadoPath)
  const victorWb = await loadWorkbook(victorPath)

  const listado = await parseListadoProductosExcel(workbookToFile(listadoWb, basename(listadoPath)))
  const victor = await parseVictorExcel(workbookToFile(victorWb, basename(victorPath)))

  const payload = {
    listado: {
      source_filename: basename(listadoPath),
      format: listado.format,
      clients: listado.clients,
      products: listado.products,
      issues: listado.issues,
    },
    victor: {
      source_filename: basename(victorPath),
      rows: victor.rows,
      issues: victor.issues,
      summary: victor.summary,
    },
  }

  process.stdout.write(JSON.stringify(payload))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
