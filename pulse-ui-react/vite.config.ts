import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const laravelTarget =
    env.LARAVEL_DEV_URL || env.VITE_LARAVEL_DEV_URL || "http://127.0.0.1:8000"

  return {
  base: "/axones/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["brand/*.png"],
      manifest: {
        name: "Axones",
        short_name: "Axones",
        description: "Sistema de producción e inventario Axones",
        theme_color: "#6d28d9",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/axones/",
        scope: "/axones/",
        lang: "es",
        icons: [
          {
            src: "brand/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "brand/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "brand/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/axones/index.html",
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
    {
      name: "redirect-root-to-base",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || "/"
          if (url === "/" || url === "/index.html") {
            res.statusCode = 302
            res.setHeader("Location", "/axones/")
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Sufijo con punto: acepta cualquier subdominio de trycloudflare.com (cambia al reiniciar el túnel).
    allowedHosts: [".trycloudflare.com"],
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Un solo túnel (este dev server). El front llama a /api en el MISMO origen; Vite reenvía a Laravel local.
    // Deja VITE_API_BASE_URL vacío en .env (ver .env.example). Evita CORS y URLs trycloudflare del API al reiniciar cloudflared.
    // Si `php artisan serve` no está en 8000, define LARAVEL_DEV_URL (ej. http://127.0.0.1:8001) y reinicia Vite.
    proxy: {
      "/api": {
        target: laravelTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
}
})
