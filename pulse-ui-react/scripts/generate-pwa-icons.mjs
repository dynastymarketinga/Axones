import sharp from "sharp"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const brandDir = path.resolve(__dirname, "../public/brand")
const source = path.join(brandDir, "logo-axones-var-01.png")

const sizes = [
  { name: "pwa-192.png", size: 192 },
  { name: "pwa-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
]

const background = { r: 255, g: 255, b: 255, alpha: 1 }

for (const { name, size } of sizes) {
  const logoSize = Math.round(size * 0.72)
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: "contain", background })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(brandDir, name))

  console.log(`Wrote ${name}`)
}
