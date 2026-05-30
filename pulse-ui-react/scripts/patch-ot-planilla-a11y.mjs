/**
 * Añade id/name a inputs y htmlFor/id a labels en WorkOrderPlanillaPage.tsx
 * Run: node scripts/patch-ot-planilla-a11y.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, "../src/pages/axones/WorkOrderPlanillaPage.tsx")
let src = fs.readFileSync(file, "utf8")

function fieldId(field) {
  return `ot-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}
function labelId(field) {
  return `ot-label-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

function injectInputA11y(tag) {
  const m = tag.match(/\bdata-field="([^"]+)"/)
  if (!m) return tag
  const field = m[1]
  if (/\bid=\{/.test(tag) || /\bid="/.test(tag)) return tag
  const id = fieldId(field)
  const insert = ` id="${id}" name="${field}"`
  return tag.replace(/\bdata-field="[^"]+"/, `$&${insert}`)
}

function injectButtonA11y(tag) {
  const m = tag.match(/\bdata-field="([^"]+)"/)
  if (!m) return tag
  const field = m[1]
  if (/\bid=\{/.test(tag) || /\bid="/.test(tag)) return tag
  const id = fieldId(field)
  const labelled = labelId(field)
  const insert = ` id="${id}" aria-labelledby="${labelled}"`
  return tag.replace(/\bdata-field="[^"]+"/, `$&${insert}`)
}

// Multiline opening tags for input/textarea with data-field
src = src.replace(/<input(\s[^>]*?\bdata-field="[^"]+"[^>]*?)(\/?>)/gs, (_, attrs, close) => {
  return `<input${injectInputA11y(`<input${attrs}${close}`).slice(6)}`
})

src = src.replace(/<textarea(\s[^>]*?\bdata-field="[^"]+"[^>]*?)(\/?>)/gs, (_, attrs, close) => {
  const full = `<textarea${attrs}${close}`
  const m = full.match(/\bdata-field="([^"]+)"/)
  if (!m || /\bid=\{/.test(full) || /\bid="/.test(full)) return full
  const field = m[1]
  const insert = ` id="${fieldId(field)}" name="${field}"`
  return full.replace(/\bdata-field="[^"]+"/, `$&${insert}`)
})

// Button combobox triggers (multiline)
src = src.replace(
  /<Button(\s[^>]*?\bdata-field="[^"]+"[^>]*?)(\/?>)/gs,
  (_, attrs, close) => `<Button${injectButtonA11y(`<Button${attrs}${close}`).slice(7)}`,
)

// Associate labels inside ot-field blocks with following data-field
src = src.replace(
  /(<div className="ot-field[^"]*">[\s\S]*?)(<label className="ot-label[^"]*">)([\s\S]*?<\/label>)([\s\S]*?)(<\/div>)/g,
  (block, before, labelOpen, labelInner, middle, closeDiv) => {
    const fieldMatch = middle.match(/\bdata-field="([^"]+)"/)
    if (!fieldMatch) return block
    const field = fieldMatch[1]
    const fid = fieldId(field)
    const lid = labelId(field)
    if (labelOpen.includes("htmlFor=") || labelOpen.includes(" id=")) return block

    const isCombobox = /<Button[^>]*data-field=/.test(middle)
    if (isCombobox) {
      const newLabelOpen = `<label id="${lid}" className="ot-label`
      return `${before}${newLabelOpen}${labelOpen.slice(`<label className="ot-label`.length)}${labelInner}${middle}${closeDiv}`
    }

    const newLabelOpen = `<label htmlFor="${fid}" className="ot-label`
    return `${before}${newLabelOpen}${labelOpen.slice(`<label className="ot-label`.length)}${labelInner}${middle}${closeDiv}`
  },
)

// Label component !font-black variant
src = src.replace(
  /(<div className="ot-field[^"]*">[\s\S]*?)(<label className="[^"]*ot-label[^"]*">)([\s\S]*?<\/label>)([\s\S]*?)(<\/div>)/g,
  (block, before, labelOpen, labelInner, middle, closeDiv) => {
    if (labelOpen.includes("htmlFor=") || labelOpen.includes(' id="')) return block
    const fieldMatch = middle.match(/\bdata-field="([^"]+)"/)
    if (!fieldMatch) return block
    const field = fieldMatch[1]
    const fid = fieldId(field)
    const lid = labelId(field)
    const isCombobox = /<Button[^>]*data-field=/.test(middle)
    if (isCombobox) {
      return `${before}<label id="${lid}" ${labelOpen.slice(7)}${labelInner}${middle}${closeDiv}`
    }
    return `${before}<label htmlFor="${fid}" ${labelOpen.slice(7)}${labelInner}${middle}${closeDiv}`
  },
)

// ot-label-row figura: associate label with winding input via htmlFor
src = src.replace(
  /(<label className="ot-label required">Figura del embobinado impresión<\/label>)/g,
  `<label htmlFor="${fieldId("figuraEmbobinadoMontaje")}" className="ot-label required">Figura del embobinado impresión</label>`,
)

fs.writeFileSync(file, src)
console.log("Patched", file)
