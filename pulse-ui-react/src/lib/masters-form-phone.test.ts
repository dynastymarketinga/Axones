import { describe, expect, it } from "vitest"

import {
  masterFormPhoneError,
  MASTER_FORM_PHONE_MAX_CHARS,
  sanitizePhoneInput,
} from "@/lib/masters-form-phone"

describe("masters-form-phone", () => {
  it("sanitizePhoneInput elimina letras y respeta max chars", () => {
    expect(sanitizePhoneInput("abc+58 412")).toBe("+58 412")
    expect(sanitizePhoneInput("x".repeat(30)).length).toBe(0)
    expect(sanitizePhoneInput("4".repeat(30)).length).toBe(MASTER_FORM_PHONE_MAX_CHARS)
  })

  it("masterFormPhoneError acepta teléfono válido y rechaza vacíos opcionales", () => {
    expect(masterFormPhoneError("")).toBeUndefined()
    expect(masterFormPhoneError("+58 412 0000000")).toBeUndefined()
    expect(masterFormPhoneError("123")).toMatch(/7 dígitos/)
  })
})
