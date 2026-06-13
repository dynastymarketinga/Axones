import type ExcelJS from "exceljs"

import {
  formatDurationHms,
  PRODUCTION_AREA_LABELS,
  sumAggRowsTotals,
  sumCandidateTotals,
  type ProductionTimeAggRow,
  type ProductionTimeAreaSummaryRow,
  type ProductionTimeRawRow,
  type WorkOrderTimeCandidate,
} from "./report-shared"

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8E4F8" },
}

const SEGMENT_TYPE_LABELS: Record<string, string> = {
  production: "Producción (efectivo)",
  downtime: "Tiempo muerto",
  mount: "Montaje (operación)",
  demount: "Desmontaje",
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

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, size: 11 }
  row.fill = HEADER_FILL
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
}

function writeTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  ws.getCell("A1").value = title
  ws.getCell("A1").font = { bold: true, size: 14 }
  ws.getCell("A2").value = subtitle
  ws.getCell("A2").font = { size: 10, color: { argb: "FF666666" } }
}

function addTableBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  headers: string[],
  dataRows: (string | number)[][],
  tableName: string,
): number {
  const colCount = headers.length
  const lastRow = startRow + dataRows.length
  const colLetter = (n: number) => {
    let s = ""
    let num = n
    while (num > 0) {
      const rem = (num - 1) % 26
      s = String.fromCharCode(65 + rem) + s
      num = Math.floor((num - 1) / 26)
    }
    return s
  }

  const headerRow = ws.getRow(startRow)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })
  styleHeaderRow(headerRow)

  dataRows.forEach((cells, idx) => {
    const row = ws.getRow(startRow + 1 + idx)
    cells.forEach((val, i) => {
      row.getCell(i + 1).value = val
    })
  })

  if (dataRows.length > 0) {
    ws.addTable({
      name: tableName.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 30),
      ref: `A${startRow}:${colLetter(colCount)}${lastRow}`,
      headerRow: true,
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows: dataRows,
      style: {
        theme: "TableStyleMedium2",
        showRowStripes: true,
      },
    })
  }

  headers.forEach((_, i) => {
    const col = ws.getColumn(i + 1)
    col.width = Math.max(col.width ?? 10, 14)
  })

  return lastRow + 2
}

export type WorkOrderTimeReportPayload = {
  from: string
  to: string
  work_order_id?: number | null
  work_order?: {
    code?: string
    client_name?: string | null
    product_name?: string | null
  } | null
  summary: Array<{
    area: string
    production_seconds: number
    downtime_seconds: number
    mount_seconds: number
    demount_seconds: number
    total_seconds: number
    effective_percent: string
  }>
  totals: {
    production_seconds: number
    downtime_seconds: number
    mount_seconds: number
    demount_seconds: number
    total_seconds: number
  }
  downtimes: Array<{
    area: string
    work_order_code?: string | null
    machine_code?: string
    started_at?: string
    ended_at?: string
    duration_seconds: number
    reason?: string
    user_name?: string | null
  }>
}

export async function exportPlantTimesExcel(opts: {
  from: string
  to: string
  candidates: WorkOrderTimeCandidate[]
  areaRows: ProductionTimeAreaSummaryRow[]
  aggRows: ProductionTimeAggRow[]
  rawRows: ProductionTimeRawRow[]
}) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Axones"
  wb.created = new Date()

  const period = `Período: ${opts.from} — ${opts.to}`
  const plantTotals = opts.candidates.length > 0 ? sumCandidateTotals(opts.candidates) : null
  const areaTotals = opts.areaRows.some((r) => r.segment_count > 0)
    ? sumAggRowsTotals(opts.areaRows.filter((r) => r.segment_count > 0))
    : null

  // Hoja 1: Resumen planta
  const ws1 = wb.addWorksheet("Resumen planta", { views: [{ state: "frozen", ySplit: 3 }] })
  writeTitle(ws1, "Producción y tiempos — Resumen de planta", period)
  if (plantTotals) {
    addTableBlock(
      ws1,
      4,
      ["Concepto", "Tiempo", "Notas"],
      [
        ["Efectivo (planta)", formatDurationHms(plantTotals.prod), "Segmentos tipo producción"],
        ["Muerto (planta)", formatDurationHms(plantTotals.down), "Paradas con motivo"],
        ["Montaje (operación)", formatDurationHms(plantTotals.mount), "Tipo mount, no área Montaje"],
        ["Desmontaje", formatDurationHms(plantTotals.demount), "Tipo demount"],
        ["Total", formatDurationHms(plantTotals.total), ""],
        ["% eficiencia planta", `${plantTotals.eff}%`, ""],
      ],
      "TblResumenPlanta",
    )
  }

  // Hoja 2: Por área
  const ws2 = wb.addWorksheet("Por área", { views: [{ state: "frozen", ySplit: 3 }] })
  writeTitle(ws2, "Tiempos por área de producción", period)
  const areaData = opts.areaRows.map((r, idx) => {
    const total = r.prod_sec + r.down_sec + r.mount_sec + r.demount_sec
    const eff = total > 0 ? `${((r.prod_sec / total) * 100).toFixed(2)}%` : "—"
    return [
      idx + 1,
      PRODUCTION_AREA_LABELS[r.area] ?? r.area,
      formatDurationHms(r.prod_sec),
      formatDurationHms(r.down_sec),
      formatDurationHms(r.mount_sec),
      formatDurationHms(r.demount_sec),
      r.segment_count,
      eff,
    ]
  })
  if (areaTotals) {
    areaData.push([
      "",
      "Total planta",
      formatDurationHms(areaTotals.prod),
      formatDurationHms(areaTotals.down),
      formatDurationHms(areaTotals.mount),
      formatDurationHms(areaTotals.demount),
      areaTotals.segments,
      "",
    ])
  }
  addTableBlock(
    ws2,
    4,
    ["N.º", "Área", "Efectivo", "Muerto", "Montaje op.", "Desmontaje", "Segmentos", "% ef."],
    areaData,
    "TblPorArea",
  )

  // Hoja 3: Por máquina
  const ws3 = wb.addWorksheet("Por máquina", { views: [{ state: "frozen", ySplit: 3 }] })
  writeTitle(ws3, "Agregado por área y máquina", period)
  const machineData = opts.aggRows.map((r, idx) => [
    idx + 1,
    PRODUCTION_AREA_LABELS[r.area] ?? r.area,
    r.machine_code.trim() !== "" ? r.machine_code : "—",
    formatDurationHms(r.prod_sec),
    formatDurationHms(r.down_sec),
    formatDurationHms(r.mount_sec),
    formatDurationHms(r.demount_sec),
    r.segment_count,
  ])
  if (opts.aggRows.length > 0) {
    const t = sumAggRowsTotals(opts.aggRows)
    machineData.push([
      "",
      "Total",
      "",
      formatDurationHms(t.prod),
      formatDurationHms(t.down),
      formatDurationHms(t.mount),
      formatDurationHms(t.demount),
      t.segments,
    ])
  }
  addTableBlock(
    ws3,
    4,
    ["N.º", "Área", "Máquina", "Efectivo", "Muerto", "Montaje op.", "Desmontaje", "Segmentos"],
    machineData,
    "TblPorMaquina",
  )

  // Hoja 4: Detalle segmentos (crudo)
  const ws4 = wb.addWorksheet("Detalle segmentos", { views: [{ state: "frozen", ySplit: 3 }] })
  writeTitle(ws4, "Detalle de segmentos cerrados", period)
  addTableBlock(
    ws4,
    4,
    ["Área", "Tipo segmento", "Máquina", "Segundos", "Tiempo", "Cant. segmentos"],
    opts.rawRows.map((r) => [
      PRODUCTION_AREA_LABELS[r.area] ?? r.area,
      SEGMENT_TYPE_LABELS[r.segment_type] ?? r.segment_type,
      r.machine_code || "—",
      r.total_seconds,
      formatDurationHms(r.total_seconds),
      r.segment_count,
    ]),
    "TblDetalle",
  )

  // Hoja 5: Órdenes del rango
  const ws5 = wb.addWorksheet("Órdenes", { views: [{ state: "frozen", ySplit: 3 }] })
  writeTitle(ws5, "Órdenes con tiempo en el rango", period)
  addTableBlock(
    ws5,
    4,
    [
      "OT",
      "Cliente",
      "Producto",
      "Efectivo",
      "Muerto",
      "Montaje op.",
      "Desmontaje",
      "Total",
      "% ef.",
      "Áreas",
    ],
    opts.candidates.map((r) => [
      r.work_order_code,
      r.client_name ?? "—",
      r.product_name ?? "—",
      formatDurationHms(r.production_seconds),
      formatDurationHms(r.downtime_seconds),
      formatDurationHms(r.mount_seconds),
      formatDurationHms(r.demount_seconds),
      formatDurationHms(r.total_seconds),
      `${r.effective_percent}%`,
      r.areas.map((a) => PRODUCTION_AREA_LABELS[a] ?? a).join(", "),
    ]),
    "TblOrdenes",
  )

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(buffer, `produccion-tiempos-planta-${opts.from}-${opts.to}.xlsx`)
}

export async function exportWorkOrderTimeReportExcel(
  payload: WorkOrderTimeReportPayload,
  filenameBase: string,
) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Axones"
  wb.created = new Date()

  const from = payload.from.slice(0, 10)
  const to = payload.to.slice(0, 10)
  const period = `Período: ${from} — ${to}`
  const woLabel = payload.work_order?.code
    ? `OT: ${payload.work_order.code}`
    : "Todas las OT del rango"

  const ws1 = wb.addWorksheet("Resumen por área", { views: [{ state: "frozen", ySplit: 3 }] })
  writeTitle(ws1, "Reporte de tiempos — Resumen por área", `${period} · ${woLabel}`)
  const nextRow = addTableBlock(
    ws1,
    4,
    ["Área", "Efectivo", "Muerto", "Montaje op.", "Desmontaje", "Total", "% ef."],
    payload.summary.map((r) => [
      PRODUCTION_AREA_LABELS[r.area] ?? r.area,
      formatDurationHms(r.production_seconds),
      formatDurationHms(r.downtime_seconds),
      formatDurationHms(r.mount_seconds),
      formatDurationHms(r.demount_seconds),
      formatDurationHms(r.total_seconds),
      `${r.effective_percent}%`,
    ]),
    "TblResumenArea",
  )

  const t = payload.totals
  const totalSec = t.total_seconds
  const eff =
    totalSec > 0 ? `${((t.production_seconds / totalSec) * 100).toFixed(2)}%` : "0.00%"
  addTableBlock(
    ws1,
    nextRow,
    ["Concepto", "Tiempo"],
    [
      ["Efectivo total", formatDurationHms(t.production_seconds)],
      ["Muerto total", formatDurationHms(t.downtime_seconds)],
      ["Montaje total", formatDurationHms(t.mount_seconds)],
      ["Desmontaje total", formatDurationHms(t.demount_seconds)],
      ["Total", formatDurationHms(t.total_seconds)],
      ["% eficiencia", eff],
    ],
    "TblTotales",
  )

  const ws2 = wb.addWorksheet("Paradas", { views: [{ state: "frozen", ySplit: 3 }] })
  writeTitle(ws2, "Detalle de paradas (tiempo muerto)", `${period} · ${woLabel}`)
  addTableBlock(
    ws2,
    4,
    [
      "Área",
      "OT",
      "Máquina",
      "Inicio",
      "Fin",
      "Duración",
      "Motivo",
      "Usuario",
    ],
    payload.downtimes.map((d) => [
      PRODUCTION_AREA_LABELS[d.area] ?? d.area,
      d.work_order_code ?? "—",
      d.machine_code || "—",
      d.started_at ? String(d.started_at).replace("T", " ").slice(0, 19) : "—",
      d.ended_at ? String(d.ended_at).replace("T", " ").slice(0, 19) : "—",
      formatDurationHms(d.duration_seconds),
      d.reason?.trim() ? d.reason : "—",
      d.user_name ?? "—",
    ]),
    "TblParadas",
  )

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(buffer, `${filenameBase}.xlsx`)
}
