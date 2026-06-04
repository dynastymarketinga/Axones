export const MON_CLICHE_KEY = "montNumCliche"
export const MON_CILINDRO_KEY = "montNumCilindro"
/** Filas extra: cada una con cliché + cilindro en la misma línea. */
export const MON_FILAS_EXTRA_KEY = "montFilasMontajeExtra"
/** @deprecated Migración desde listas separadas. */
export const MON_CLICHES_EXTRA_KEY = "montClichesAdicionales"
export const MON_CILINDROS_EXTRA_KEY = "montCilindrosAdicionales"
export const MON_CILINDROS_LEGACY_KEY = "montCilindros"
export const MON_STICKY_BACK_KEY = "montStickyBack"
export const MON_CODIGO_KEY = "montCodigoMontaje"
export const MON_COLOR_KEY = "montColorMontaje"
/** Filas de material usado en montaje (sticky back, código, color, cantidad/canguro). */
export const MON_MATERIALES_MONTAJE_KEY = "montMaterialesMontaje"
/** @deprecated Solo migración desde registros antiguos. */
export const MON_MATERIALES_KEY = "montMaterialesUsados"

export type MontajeFilaMontaje = {
  numCliche: string
  numCilindro: string
}

export type MontajeMaterialFila = {
  stickyBack: string
  codigo: string
  color: string
  /** Cantidad usada (p. ej. canguro / sticky back). */
  cantidad: string
}

type MontajeMaterialTipo = "sticky_back" | "codigo" | "color"

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function normalizeMaterialTipo(v: unknown): MontajeMaterialTipo {
  const s = readString(v).toLowerCase().trim().replace(/\s+/g, "_")
  if (s === "sticky_back" || s === "stickyback" || s === "sticky_bank" || s === "stickybank") {
    return "sticky_back"
  }
  if (s === "codigo" || s === "código" || s === "code") return "codigo"
  return "color"
}

function readStringListState(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => (typeof v === "string" || typeof v === "number" ? String(v) : ""))
}

export function emptyMontajeFila(): MontajeFilaMontaje {
  return { numCliche: "", numCilindro: "" }
}

export function emptyMontajeMaterialFila(): MontajeMaterialFila {
  return { stickyBack: "", codigo: "", color: "", cantidad: "" }
}

function filaFromRecord(o: Record<string, unknown>): MontajeFilaMontaje {
  return {
    numCliche: readString(o.numCliche ?? o.cliche),
    numCilindro: readString(o.numCilindro ?? o.cilindro),
  }
}

/** Conserva filas vacías mientras el operador edita. */
export function readMontajeFilasExtraState(
  rawFilas: unknown,
  rawClichesLegacy?: unknown,
  rawCilindrosLegacy?: unknown,
): MontajeFilaMontaje[] {
  if (Array.isArray(rawFilas)) {
    return rawFilas
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null
        return filaFromRecord(item as Record<string, unknown>)
      })
      .filter((r): r is MontajeFilaMontaje => r !== null)
  }

  const cliches = readStringListState(rawClichesLegacy)
  const cilindros = readStringListState(rawCilindrosLegacy)
  const n = Math.max(cliches.length, cilindros.length)
  if (n === 0) return []

  return Array.from({ length: n }, (_, i) => ({
    numCliche: cliches[i] ?? "",
    numCilindro: cilindros[i] ?? "",
  }))
}

export function montajeFilasExtraForSave(rows: MontajeFilaMontaje[]): MontajeFilaMontaje[] {
  return rows
    .map((r) => ({
      numCliche: r.numCliche.trim(),
      numCilindro: r.numCilindro.trim(),
    }))
    .filter((r) => r.numCliche.length > 0 || r.numCilindro.length > 0)
}

function firstMaterialValor(rawMateriales: unknown, tipo: MontajeMaterialTipo): string {
  if (!Array.isArray(rawMateriales)) return ""
  for (const item of rawMateriales) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    if (normalizeMaterialTipo(o.tipo) !== tipo) continue
    const v = readString(o.descripcion).trim()
    if (v) return v
  }
  return ""
}

export function resolveMontStickyBack(rawStickyBack: unknown, rawMateriales: unknown): string {
  const direct = readString(rawStickyBack).trim()
  if (direct) return direct
  return firstMaterialValor(rawMateriales, "sticky_back")
}

export function resolveMontCodigo(rawCodigo: unknown, rawMateriales: unknown): string {
  const direct = readString(rawCodigo).trim()
  if (direct) return direct
  return firstMaterialValor(rawMateriales, "codigo")
}

export function resolveMontColor(rawColor: unknown, rawMateriales: unknown): string {
  const direct = readString(rawColor).trim()
  if (direct) return direct
  return firstMaterialValor(rawMateriales, "color")
}

function materialFilaFromRecord(o: Record<string, unknown>): MontajeMaterialFila {
  return {
    stickyBack: readString(o.stickyBack ?? o.sticky_back),
    codigo: readString(o.codigo ?? o.code),
    color: readString(o.color),
    cantidad: readString(o.cantidad ?? o.quantity),
  }
}

function legacyMaterialLists(rawMateriales: unknown): {
  stickies: string[]
  codigos: string[]
  colors: string[]
} {
  const stickies: string[] = []
  const codigos: string[] = []
  const colors: string[] = []
  if (!Array.isArray(rawMateriales)) return { stickies, codigos, colors }
  for (const item of rawMateriales) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const v = readString(o.descripcion)
    const tipo = normalizeMaterialTipo(o.tipo)
    if (tipo === "sticky_back") stickies.push(v)
    else if (tipo === "codigo") codigos.push(v)
    else colors.push(v)
  }
  return { stickies, codigos, colors }
}

/** Conserva filas vacías mientras el operador edita. */
export function readMontajeMaterialesState(
  rawMaterialesMontaje: unknown,
  rawStickyBack?: unknown,
  rawCodigo?: unknown,
  rawColor?: unknown,
  rawMaterialesLegacy?: unknown,
): MontajeMaterialFila[] {
  if (Array.isArray(rawMaterialesMontaje)) {
    return rawMaterialesMontaje
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null
        return materialFilaFromRecord(item as Record<string, unknown>)
      })
      .filter((r): r is MontajeMaterialFila => r !== null)
  }

  const sticky = readString(rawStickyBack)
  const codigo = readString(rawCodigo)
  const color = readString(rawColor)
  if (sticky.trim() || codigo.trim() || color.trim()) {
    return [{ stickyBack: sticky, codigo, color, cantidad: "" }]
  }

  const { stickies, codigos, colors } = legacyMaterialLists(rawMaterialesLegacy)
  const n = Math.max(stickies.length, codigos.length, colors.length)
  if (n === 0) return []

  return Array.from({ length: n }, (_, i) => ({
    stickyBack: stickies[i] ?? "",
    codigo: codigos[i] ?? "",
    color: colors[i] ?? "",
    cantidad: "",
  }))
}

export function montajeMaterialesForSave(rows: MontajeMaterialFila[]): MontajeMaterialFila[] {
  return rows
    .map((r) => ({
      stickyBack: r.stickyBack.trim(),
      codigo: r.codigo.trim(),
      color: r.color.trim(),
      cantidad: r.cantidad.trim().replace(",", "."),
    }))
    .filter(
      (r) =>
        r.stickyBack.length > 0 ||
        r.codigo.length > 0 ||
        r.color.length > 0 ||
        r.cantidad.length > 0,
    )
}

export function clearMontajeClicheMaterialKeys(): Record<string, unknown> {
  return {
    [MON_CLICHE_KEY]: "",
    [MON_CILINDRO_KEY]: "",
    [MON_FILAS_EXTRA_KEY]: [],
    [MON_CLICHES_EXTRA_KEY]: [],
    [MON_CILINDROS_EXTRA_KEY]: [],
    [MON_CILINDROS_LEGACY_KEY]: [],
    [MON_MATERIALES_MONTAJE_KEY]: [],
    [MON_STICKY_BACK_KEY]: "",
    [MON_CODIGO_KEY]: "",
    [MON_COLOR_KEY]: "",
    [MON_MATERIALES_KEY]: [],
  }
}

/** Limpia captura del turno (cliché, material, observaciones) para un turno nuevo. */
export function clearMontajeTurnCaptureFormKeys(): Record<string, unknown> {
  return {
    ...clearMontajeClicheMaterialKeys(),
    montObservaciones: "",
  }
}
