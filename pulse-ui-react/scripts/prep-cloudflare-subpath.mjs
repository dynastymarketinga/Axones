/**
 * Vite con `base: "/axones/"` emite index.html y assets en la raíz de `dist/`,
 * pero las rutas de recursos son /axones/assets/... — en hosting estático plano
 * hace falta la carpeta física `dist/axones/`. Este script mueve el build ahí
 * y deja en la raíz de `dist` solo lo que debe quedar (p. ej. `_redirects`).
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, "..", "dist")
const nested = path.join(dist, "axones")
const keepAtRoot = new Set(["_redirects", "_headers", "_routes.json"])

const index = path.join(dist, "index.html")
if (!fs.existsSync(index)) {
  console.error(
    "prep-cloudflare-subpath: falta dist/index.html. Ejecuta antes: npm run build",
  )
  process.exit(1)
}

if (fs.existsSync(nested)) {
  fs.rmSync(nested, { recursive: true, force: true })
}
fs.mkdirSync(nested, { recursive: true })

for (const name of fs.readdirSync(dist)) {
  if (name === "axones" || keepAtRoot.has(name)) continue
  fs.renameSync(path.join(dist, name), path.join(nested, name))
}

console.log("prep-cloudflare-subpath: listo → dist/axones/")
