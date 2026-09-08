import { Outlet } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import { NotificationDropdown } from "@/components/notification-dropdown"
import { OperationalAlertsStreamProvider } from "@/providers/operational-alerts-stream-provider"

import { AxonesAppBreadcrumb } from "@/components/axones/AxonesAppBreadcrumb"
import { AxonesDocumentTitle } from "@/components/axones/AxonesDocumentTitle"
import { AssistantPanel } from "@/components/axones/assistant/AssistantPanel"
import { AssistantTrigger } from "@/components/axones/assistant/AssistantTrigger"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { GlobalSearch } from "@/components/global-search"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"

import Footer from "@/layouts/Footer"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useAssistantStatus } from "@/hooks/useAssistantStatus"
import { getStoredUser } from "@/lib/auth-storage"
import { canUseAxonesAssistant } from "@/lib/axones-roles"

export default function AppLayout() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(true)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const assistantStatus = useAssistantStatus()
  const storedUser = getStoredUser()
  const assistantAvailable =
    (assistantStatus.status?.enabled ?? false) &&
    (assistantStatus.status?.allowed ?? false) &&
    canUseAxonesAssistant(storedUser?.role)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setOpen(window.innerWidth >= 1024)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (!assistantAvailable) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setAssistantOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [assistantAvailable])


  return (
    <OperationalAlertsStreamProvider>
    <AxonesDocumentTitle />
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />

      {/* FIX: Se agregó min-w-0, overflow-hidden y w-full para evitar que se desborde */}
      <SidebarInset className="min-w-0 flex flex-col w-full overflow-hidden">
        
        {/* HEADER */}
        <header
          className={cn(
            "sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 transition-all duration-200 border-b",
            scrolled
              ? "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md"
              : "bg-transparent"
          )}
        >
          <div className="flex items-center gap-2 px-4 md:px-6">
            <SidebarTrigger
              size="icon"
              className="rounded-full h-9 w-9 [&_svg]:size-5"
            />

            <Separator orientation="vertical" className="h-4" />

            {/* Ocultamos las migas de pan en móviles muy pequeños si estorban */}
            <div className="hidden sm:block">
              <AxonesAppBreadcrumb />
            </div>
          </div>

          <div className="ml-auto px-4 md:px-6">
            <div className="flex items-center gap-1">
              <PwaInstallPrompt />
              <GlobalSearch />
              {assistantAvailable ? (
                <AssistantTrigger onClick={() => setAssistantOpen(true)} />
              ) : null}
              <div className="relative">
                <NotificationDropdown />
              </div>
            </div>
          </div>
        </header>

        {assistantAvailable ? (
          <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
        ) : null}

        {/* PAGE CONTENT */}
        {/* FIX: Se agregó min-w-0 y overflow-x-hidden para frenar tablas gigantes */}
        <main className="flex-1 p-4 md:p-6 min-w-0 w-full overflow-x-hidden">
          <Outlet />
        </main>

        <Footer />
      </SidebarInset>
    </SidebarProvider>
    </OperationalAlertsStreamProvider>
  )
}