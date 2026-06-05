import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"

import UIThemeProvider from "@/providers/ui-theme-provider"

import { registerSW } from "virtual:pwa-register"

import { router } from "@/routes"
import "@/index.css"

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true)
  },
})

if (typeof document !== "undefined") {
  document.title = "Axones"
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      
      <UIThemeProvider>
        <RouterProvider router={router} />
      </UIThemeProvider>
    </ThemeProvider>
    <Toaster position="top-right" richColors closeButton offset={{ top: "72px", right: "16px" }} />
  </React.StrictMode>
)
