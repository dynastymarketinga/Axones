export type TintaDisplayColorKind = "known" | "generic"

export type TintaDisplayColor = {
  backgroundColor: string
  borderColor?: string
  kind: TintaDisplayColorKind
}

type ColorRule = {
  keywords: string[]
  backgroundColor: string
  needsBorder?: boolean
}

/**
 * Palabras clave en nombre de tinta → color de pantalla (decorativo, no Pantone real).
 * Orden: reglas más específicas primero; dentro de cada regla se prueba la keyword más larga.
 *
 * Nota: no usar PROCESO en magenta (AMARILLO PROCESO debe ser amarillo).
 * Nota: no usar BASE suelta en extensor (NEGRO BASE debe ser negro).
 */
const COLOR_RULES: ColorRule[] = [
  // --- Básicos y neutros ---
  { keywords: ["BLANCO", "NEUTRO", "CLEAR"], backgroundColor: "#FFFFFF", needsBorder: true },
  { keywords: ["NEGRO", "BLACK", "OSCURO"], backgroundColor: "#1A1A1A" },
  { keywords: ["GRIS", "GREY", "GRAY", "PLOMO", "PIZARRA", "CENIZA"], backgroundColor: "#9CA3AF" },

  // --- Cálidos ---
  { keywords: ["ROJO", "RED", "BERMELLON", "ESCARLATA", "CARMESI", "CARMIN"], backgroundColor: "#DC2626" },
  { keywords: ["AMARILLO", "YELLOW", "CANARIO", "LIMON"], backgroundColor: "#FACC15" },
  { keywords: ["NARANJA", "ANARANJADO", "ORANGE"], backgroundColor: "#EA580C" },
  { keywords: ["DAMASCO", "ALBARICOQUE", "MELOCOTON", "PEACH"], backgroundColor: "#FB923C" },
  { keywords: ["OCRE", "SIENA", "MOSTAZA"], backgroundColor: "#D97706" },
  { keywords: ["CORAL", "SALMON"], backgroundColor: "#FA8072" },
  { keywords: ["LADRILLO", "TERRACOTA", "TEJA"], backgroundColor: "#B45309" },

  // --- Fríos ---
  {
    keywords: ["AZUL", "BLUE", "REY", "ROYAL", "COBALTO", "MARINO", "NAVY"],
    backgroundColor: "#2563EB",
  },
  { keywords: ["CELESTE", "SKY", "CIELO"], backgroundColor: "#38BDF8" },
  {
    keywords: ["TURQUESA", "TURQUOISE", "AQUAMARINE", "AGUAMARINA"],
    backgroundColor: "#14B8A6",
  },
  { keywords: ["CYAN"], backgroundColor: "#06B6D4" },
  {
    keywords: ["VERDE", "GREEN", "MILITAR", "OLIVA", "PICEA", "BOSQUE"],
    backgroundColor: "#16A34A",
  },
  { keywords: ["LIMA", "MANZANA", "PISTACHO"], backgroundColor: "#84CC16" },
  { keywords: ["MENTA", "MENTHE"], backgroundColor: "#A7F3D0", needsBorder: true },

  // --- Morados, rosas ---
  {
    keywords: ["BERENJENA", "UVA", "WINE", "BURDEOS", "BORGONA", "GUINDA"],
    backgroundColor: "#581C87",
  },
  { keywords: ["MORADO", "PURPURA", "LILA", "PURPLE", "OBISPO"], backgroundColor: "#9333EA" },
  { keywords: ["VIOLETA", "VIOLET", "AMATISTA"], backgroundColor: "#7C3AED" },
  { keywords: ["MAGENTA"], backgroundColor: "#DB2777" },
  { keywords: ["FUCSIA", "FUCHSIA", "NEON", "FLUOR"], backgroundColor: "#D946EF" },
  { keywords: ["ROSA PALO", "PASTEL", "BLUSH"], backgroundColor: "#FBCFE8", needsBorder: true },
  { keywords: ["ROSA", "ROSADO", "PINK", "CHICLE"], backgroundColor: "#F472B6" },

  // --- Tierras y cremas ---
  { keywords: ["MARRON", "CAFE", "CHOCOLATE", "BROWN", "CASTAÑO", "CASTANO"], backgroundColor: "#92400E" },
  { keywords: ["CREMA", "IVORY", "MARFIL"], backgroundColor: "#FFF8E7", needsBorder: true },
  { keywords: ["BEIGE", "ARENA", "SAND", "CAQUI", "KHAKI"], backgroundColor: "#F5F5DC", needsBorder: true },
  { keywords: ["GAMUZA", "CORCHO", "CANELA"], backgroundColor: "#D97706" },

  // --- Metales ---
  { keywords: ["DORADO", "ORO", "GOLD"], backgroundColor: "#CA8A04" },
  {
    keywords: ["PLATA", "PLATEADO", "PLATIN", "SILVER", "ALUMINIO"],
    backgroundColor: "#CBD5E1",
    needsBorder: true,
  },
  { keywords: ["BRONCE", "COBRE", "COPPER", "BRONZE"], backgroundColor: "#B45309" },

  // --- Insumos, aditivos, acabados ---
  { keywords: ["REFLEX", "REFLECTIVO", "REFLECTANTE"], backgroundColor: "#64748B", needsBorder: true },
  { keywords: ["COMPUESTO DE CERA", "CERA", "WAX"], backgroundColor: "#FEF3C7", needsBorder: true },
  { keywords: ["BARNIZ", "VARNISH", "LACA", "BRILLO"], backgroundColor: "#E5E7EB", needsBorder: true },
  { keywords: ["EXTENDER", "EXTENSOR"], backgroundColor: "#D1D5DB", needsBorder: true },
  { keywords: ["MATE", "MATIZANTE", "OPACADOR"], backgroundColor: "#F3F4F6", needsBorder: true },
  { keywords: ["SECANTE", "ACTIVADOR", "CATALIZADOR"], backgroundColor: "#E0E7FF", needsBorder: true },
  { keywords: ["SOLVENTE", "DILUYENTE", "THINNER", "REDUCTOR"], backgroundColor: "#F1F5F9", needsBorder: true },
  { keywords: ["PASTA", "LIQUIDO"], backgroundColor: "#F8FAFC", needsBorder: true },
]

const GENERIC_SWATCH: TintaDisplayColor = {
  backgroundColor: "#EDE9FE",
  borderColor: "#C4B5FD",
  kind: "generic",
}

const DEFAULT_BORDER = "#94A3B8"

function normalizeInkName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
}

function ruleMatches(normalized: string, rule: ColorRule): boolean {
  const keywords = [...rule.keywords].sort(
    (a, b) => normalizeInkName(b).length - normalizeInkName(a).length,
  )
  return keywords.some((kw) => normalized.includes(normalizeInkName(kw)))
}

/**
 * Infiera un color de pantalla a partir del nombre del material (sin hex en BD).
 * Decorativo: no representa Pantone real de impresión.
 */
export function inferTintaDisplayColor(name: string): TintaDisplayColor {
  const normalized = normalizeInkName(name)
  if (!normalized) return GENERIC_SWATCH

  for (const rule of COLOR_RULES) {
    if (ruleMatches(normalized, rule)) {
      return {
        backgroundColor: rule.backgroundColor,
        borderColor: rule.needsBorder ? DEFAULT_BORDER : rule.backgroundColor,
        kind: "known",
      }
    }
  }

  return GENERIC_SWATCH
}

/** Lista de palabras clave soportadas (útil para documentación / tests). */
export function listTintaDisplayColorKeywords(): string[] {
  return COLOR_RULES.flatMap((r) => r.keywords)
}
