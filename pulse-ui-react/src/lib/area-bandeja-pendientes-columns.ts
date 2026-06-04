import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ArrowDownToLine,
  Disc3,
  Droplets,
  FlaskConical,
  Gauge,
  Layers,
  Layers2,
  LayoutGrid,
  MoveHorizontal,
  Package,
  Palette,
  Printer,
  Ruler,
  Scale,
  ScrollText,
} from "lucide-react"

import type { WorkOrderListRow } from "@/types/api"

export type BandejaPendientesAreaKey = "montaje" | "printing" | "laminacion" | "corte" | "tintas"

export type BandejaPendientesColumnDef = {
  id: string
  line1: string
  line2?: string
  title: string
  icon: LucideIcon
}

function readString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function displayOrDash(value: string): string {
  return value.trim() || "—"
}

function technicalForm(row: WorkOrderListRow): Record<string, unknown> | null {
  const f = row.technical_document?.form
  if (!f || typeof f !== "object" || Array.isArray(f)) return null
  return f as Record<string, unknown>
}

type SustratoRow = {
  material_id?: string
  kg?: string
  material_free_text?: string
}

function firstSustratoRow(form: Record<string, unknown> | null, key: string): SustratoRow | null {
  if (!form) return null
  const raw = form[key]
  if (Array.isArray(raw) && raw.length > 0) {
    const o = raw[0]
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const r = o as Record<string, unknown>
      return {
        material_id: readString(r.material_id),
        kg: readString(r.kg),
        material_free_text: readString(r.material_free_text),
      }
    }
  }
  return null
}

function sustratoLabel(row: SustratoRow | null): string {
  if (!row) return "—"
  const text = row.material_free_text?.trim()
  if (text) return text
  const id = row.material_id?.trim()
  if (id) return id
  return "—"
}

function tipoImpresionMontajeLabel(value: unknown): string {
  const v = readString(value).toLowerCase()
  if (v === "superficie" || v === "superf") return "Superficie"
  if (v === "reverso" || v === "rev") return "Reverso"
  const raw = readString(value)
  return raw || "—"
}

function readTintaColorsSummary(form: Record<string, unknown> | null): string {
  if (!form) return "—"
  const n = Number.parseInt(readString(form.numColores), 10)
  const limit = Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 8
  const colors: string[] = []
  for (let i = 1; i <= limit; i += 1) {
    const c = readString(form[`tintaColor${i}`])
    if (c) colors.push(c)
  }
  if (colors.length === 0) return "—"
  const unique = [...new Set(colors)]
  if (unique.length <= 2) return unique.join(" · ")
  return `${unique[0]} · +${unique.length - 1} más`
}

const MONTAJE_COLUMNS: BandejaPendientesColumnDef[] = [
  { id: "frecuencia", icon: Activity, line1: "Frecuencia", line2: "(mm)", title: "Frecuencia (mm)" },
  { id: "numBandas", icon: LayoutGrid, line1: "N°", line2: "bandas", title: "N° bandas" },
  { id: "anchoMontaje", icon: MoveHorizontal, line1: "Ancho", line2: "montaje", title: "Ancho montaje (mm)" },
  { id: "numColores", icon: Palette, line1: "N°", line2: "colores", title: "N° colores" },
  { id: "tipoImpresionMontaje", icon: Printer, line1: "Tipo", line2: "imp.", title: "Tipo impresión montaje" },
]

const PRINTING_COLUMNS: BandejaPendientesColumnDef[] = [
  { id: "sustratoImp", icon: ScrollText, line1: "Sustrato 1", title: "Sustrato virgen 1" },
  { id: "kgSustratoImp", icon: Scale, line1: "Kg utilizar", title: "Kg a utilizar (impresión)" },
]

const LAMINACION_COLUMNS: BandejaPendientesColumnDef[] = [
  { id: "kgLaminaImpresa", icon: Layers, line1: "Lám.", line2: "impresa", title: "Lámina impresa (Kg)" },
  { id: "kgLaminaVirgen", icon: Layers2, line1: "Lám.", line2: "virgen", title: "Lámina virgen (Kg)" },
  { id: "kgAdhesivo", icon: Droplets, line1: "Adhesivo", line2: "(Kg)", title: "Adhesivo laminación (Kg)" },
  { id: "kgCatalizador", icon: FlaskConical, line1: "Catal.", line2: "(Kg)", title: "Catalizador laminación (Kg)" },
  { id: "sustratoLam", icon: Package, line1: "Sustrato", line2: "1", title: "Sustrato virgen laminación" },
  { id: "kgSustratoLam", icon: Scale, line1: "Kg", line2: "utilizar", title: "Kg a utilizar (laminación)" },
]

const CORTE_COLUMNS: BandejaPendientesColumnDef[] = [
  { id: "anchoCorte", icon: Ruler, line1: "Ancho", line2: "corte", title: "Ancho corte (mm)" },
  { id: "pesoBobina", icon: Disc3, line1: "Peso", line2: "bobina", title: "Peso bobina (Kg)" },
  { id: "metrosBobina", icon: MoveHorizontal, line1: "M/", line2: "bobina", title: "Metros por bobina (m)" },
  { id: "kgIngresados", icon: ArrowDownToLine, line1: "Kg", line2: "ingres.", title: "Kg ingresados" },
  { id: "metraje", icon: Ruler, line1: "Metraje", title: "Metraje" },
]

const TINTAS_COLUMNS: BandejaPendientesColumnDef[] = [
  { id: "numColores", icon: Palette, line1: "N°", line2: "colores", title: "N° colores" },
  { id: "coloresTintas", icon: Droplets, line1: "Colores", title: "Resumen de colores en planilla" },
  { id: "aniloxRef", icon: Gauge, line1: "Anilox", line2: "ref.", title: "Anilox posición 1" },
]

export function bandejaPendientesAreaColumnDefs(area: BandejaPendientesAreaKey): BandejaPendientesColumnDef[] {
  if (area === "montaje") return MONTAJE_COLUMNS
  if (area === "printing") return PRINTING_COLUMNS
  if (area === "laminacion") return LAMINACION_COLUMNS
  if (area === "corte") return CORTE_COLUMNS
  return TINTAS_COLUMNS
}

export function bandejaPendientesAreaColumnCount(area: BandejaPendientesAreaKey): number {
  return bandejaPendientesAreaColumnDefs(area).length
}

export function readBandejaPendientesAreaValues(
  row: WorkOrderListRow,
  area: BandejaPendientesAreaKey,
): string[] {
  const form = technicalForm(row)
  if (area === "montaje") {
    return [
      displayOrDash(readString(form?.frecuencia)),
      displayOrDash(readString(form?.numBandas)),
      displayOrDash(readString(form?.anchoMontaje)),
      displayOrDash(readString(form?.numColores)),
      tipoImpresionMontajeLabel(form?.tipoImpresionMontaje),
    ]
  }
  if (area === "printing") {
    const s = firstSustratoRow(form, "sustratosVirgenImp")
    return [sustratoLabel(s), displayOrDash(s?.kg ?? "")]
  }
  if (area === "laminacion") {
    const s = firstSustratoRow(form, "sustratosVirgenLam")
    return [
      displayOrDash(readString(form?.kgLaminaImpresaLaminacion)),
      displayOrDash(readString(form?.kgLaminaVirgenLaminacion)),
      displayOrDash(readString(form?.kgAdhesivoLaminacion)),
      displayOrDash(readString(form?.kgCatalizadorLaminacion)),
      sustratoLabel(s),
      displayOrDash(s?.kg ?? ""),
    ]
  }
  if (area === "corte") {
    return [
      displayOrDash(readString(form?.anchoCorteFinal)),
      displayOrDash(readString(form?.pesoBobina)),
      displayOrDash(readString(form?.metrosBobina)),
      displayOrDash(readString(form?.kgIngresadosCorte)),
      displayOrDash(readString(form?.metrajeCorte)),
    ]
  }
  const anilox1 = readString(form?.tintaAnilox1)
  return [
    displayOrDash(readString(form?.numColores)),
    readTintaColorsSummary(form),
    displayOrDash(anilox1),
  ]
}

export function mesBandejaPendientesTableMinWidth(area: BandejaPendientesAreaKey): string {
  const middle = 4 + bandejaPendientesAreaColumnCount(area)
  const rem = 44 + middle * 5.5
  return `min-w-[${Math.round(rem)}rem]`
}
