// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  METRIC_INPUT_MM_1_T1,
  METRIC_INPUT_MM_2_T1,
  METRIC_INPUT_MM_3_T1,
  METRIC_INPUT_MM_4_T1,
  METRIC_INPUT_MM_4_T2,
  METRIC_INPUT_PLAIN,
  METRIC_INPUT_RANGE,
  METRIC_INPUT_UNLIMITED_PLUS_MINUS,
  METRIC_INPUT_UNLIMITED_RANGE,
  formatMetricPlusMinusOnBlur,
  metricOptionsFromPlaceholder,
  parseMetricPlaceholderTolerance,
  sanitizeMetricPlusMinusInput,
} from "@/lib/metric-plus-minus-input"

describe("sanitizeMetricPlusMinusInput", () => {
  it("convierte + a ±", () => {
    expect(sanitizeMetricPlusMinusInput("250+", METRIC_INPUT_MM_3_T1)).toBe("250±")
    expect(sanitizeMetricPlusMinusInput("250+2", METRIC_INPUT_MM_3_T1)).toBe("250±2")
    expect(sanitizeMetricPlusMinusInput("250+-2", METRIC_INPUT_MM_3_T1)).toBe("250±2")
    expect(sanitizeMetricPlusMinusInput("250+/-2", METRIC_INPUT_MM_3_T1)).toBe("250±2")
  })

  it("tras 3 dígitos nominales el siguiente va a tolerancia (mm 3±1)", () => {
    expect(sanitizeMetricPlusMinusInput("250", METRIC_INPUT_MM_3_T1)).toBe("250")
    expect(sanitizeMetricPlusMinusInput("2502", METRIC_INPUT_MM_3_T1)).toBe("250±2")
    expect(sanitizeMetricPlusMinusInput("25023", METRIC_INPUT_MM_3_T1)).toBe("250±2")
  })

  it("permite 4 dígitos nominales antes de ± (ancho montaje)", () => {
    expect(sanitizeMetricPlusMinusInput("1040", METRIC_INPUT_MM_4_T1)).toBe("1040")
    expect(sanitizeMetricPlusMinusInput("10402", METRIC_INPUT_MM_4_T1)).toBe("1040±2")
  })

  it("metros/bobina: 4 dígitos y tolerancia de 2", () => {
    expect(sanitizeMetricPlusMinusInput("1020 20", METRIC_INPUT_MM_4_T2)).toBe("1020±20")
    expect(sanitizeMetricPlusMinusInput("102020", METRIC_INPUT_MM_4_T2)).toBe("1020±20")
  })

  it("distancias cortas (1±1, 20±1)", () => {
    expect(sanitizeMetricPlusMinusInput("11", METRIC_INPUT_MM_1_T1)).toBe("1±1")
    expect(sanitizeMetricPlusMinusInput("201", METRIC_INPUT_MM_2_T1)).toBe("20±1")
  })

  it("rango con guion (peso bobina)", () => {
    expect(sanitizeMetricPlusMinusInput("19-20", METRIC_INPUT_RANGE)).toBe("19-20")
    expect(sanitizeMetricPlusMinusInput("19-", METRIC_INPUT_RANGE)).toBe("19-")
  })

  it("campo sin tolerancia (solo dígitos)", () => {
    expect(sanitizeMetricPlusMinusInput("6", METRIC_INPUT_PLAIN)).toBe("6")
    expect(sanitizeMetricPlusMinusInput("6+2", METRIC_INPUT_PLAIN)).toBe("62")
  })
})

describe("formatMetricPlusMinusOnBlur", () => {
  it("añade ± del placeholder si solo hay nominal", () => {
    expect(formatMetricPlusMinusOnBlur("25", metricOptionsFromPlaceholder(METRIC_INPUT_MM_3_T1, "250±1"))).toBe(
      "25±1",
    )
    expect(formatMetricPlusMinusOnBlur("1", metricOptionsFromPlaceholder(METRIC_INPUT_MM_3_T1, "250±2"))).toBe("1±2")
    expect(formatMetricPlusMinusOnBlur("250", metricOptionsFromPlaceholder(METRIC_INPUT_MM_3_T1, "250±2"))).toBe(
      "250±2",
    )
  })

  it("completa tolerancia del placeholder si termina en ±", () => {
    expect(formatMetricPlusMinusOnBlur("25±", metricOptionsFromPlaceholder(METRIC_INPUT_MM_3_T1, "250±1"))).toBe(
      "25±1",
    )
    expect(formatMetricPlusMinusOnBlur("1±", metricOptionsFromPlaceholder(METRIC_INPUT_MM_1_T1, "1±1"))).toBe("1±1")
  })

  it("conserva valor ± completo", () => {
    expect(formatMetricPlusMinusOnBlur("25±1", METRIC_INPUT_MM_3_T1)).toBe("25±1")
    expect(formatMetricPlusMinusOnBlur("250±2", METRIC_INPUT_MM_3_T1)).toBe("250±2")
  })
})

describe("parseMetricPlaceholderTolerance", () => {
  it("lee tolerancia del placeholder", () => {
    expect(parseMetricPlaceholderTolerance("250±2")).toBe("2")
    expect(parseMetricPlaceholderTolerance("1020 ± 20")).toBe("20")
    expect(parseMetricPlaceholderTolerance("320±0")).toBe("0")
  })
})

describe("sanitize con tolerancia del placeholder", () => {
  it("formatea 1±2 al escribir 12 con placeholder 250±2", () => {
    const opts = metricOptionsFromPlaceholder(METRIC_INPUT_MM_3_T1, "250±2")
    expect(sanitizeMetricPlusMinusInput("12", opts)).toBe("1±2")
    expect(sanitizeMetricPlusMinusInput("2502", opts)).toBe("250±2")
  })

  it("formatea 1±1 al escribir 11 con placeholder 1±1", () => {
    const opts = metricOptionsFromPlaceholder(METRIC_INPUT_MM_1_T1, "1±1")
    expect(sanitizeMetricPlusMinusInput("11", opts)).toBe("1±1")
  })
})

describe("sanitizeMetricPlusMinusInput unlimited", () => {
  it("no trunca dígitos nominales ni tolerancia", () => {
    expect(sanitizeMetricPlusMinusInput("4535353453±32423432", METRIC_INPUT_UNLIMITED_PLUS_MINUS)).toBe(
      "4535353453±32423432",
    )
    expect(sanitizeMetricPlusMinusInput("34435±4543543543", METRIC_INPUT_UNLIMITED_PLUS_MINUS)).toBe(
      "34435±4543543543",
    )
  })

  it("convierte + a ± sin partir dígitos extra", () => {
    expect(sanitizeMetricPlusMinusInput("4355353345+32423432", METRIC_INPUT_UNLIMITED_PLUS_MINUS)).toBe(
      "4355353345±32423432",
    )
    expect(sanitizeMetricPlusMinusInput("4535353453", METRIC_INPUT_UNLIMITED_PLUS_MINUS)).toBe("4535353453")
  })

  it("conserva espacio opcional antes de ±", () => {
    expect(sanitizeMetricPlusMinusInput("352355 ±345435435", METRIC_INPUT_UNLIMITED_PLUS_MINUS)).toBe(
      "352355 ±345435435",
    )
    expect(sanitizeMetricPlusMinusInput("1020 ± 20", METRIC_INPUT_UNLIMITED_PLUS_MINUS)).toBe("1020 ±20")
  })

  it("peso bobina: rango largo sin ±", () => {
    expect(sanitizeMetricPlusMinusInput("4535353453-4535353454", METRIC_INPUT_UNLIMITED_RANGE)).toBe(
      "4535353453-4535353454",
    )
    expect(sanitizeMetricPlusMinusInput("19±20", METRIC_INPUT_UNLIMITED_RANGE)).toBe("19")
  })
})

describe("formatMetricPlusMinusOnBlur unlimited", () => {
  it("añade tolerancia del placeholder si solo hay nominal", () => {
    const opts = metricOptionsFromPlaceholder(METRIC_INPUT_UNLIMITED_PLUS_MINUS, "250±2")
    expect(formatMetricPlusMinusOnBlur("4535353453", opts)).toBe("4535353453±2")
  })

  it("conserva valor ± completo sin truncar", () => {
    expect(formatMetricPlusMinusOnBlur("34435±4543543543", METRIC_INPUT_UNLIMITED_PLUS_MINUS)).toBe(
      "34435±4543543543",
    )
  })
})
