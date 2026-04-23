import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"

import UIThemeProvider from "@/providers/ui-theme-provider"

import { router } from "@/routes"
import "@/index.css"

if (typeof document !== "undefined") {
  document.title = "Axones"
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      
      <UIThemeProvider>
        <RouterProvider router={router} />
      </UIThemeProvider>
    </ThemeProvider>
    <Toaster position="top-right" richColors closeButton />
  </React.StrictMode>
)
