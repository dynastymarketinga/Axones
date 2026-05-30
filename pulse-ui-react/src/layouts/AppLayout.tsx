import { Outlet } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import { NotificationDropdown } from "@/components/notification-dropdown"
import { OperationalAlertsStreamProvider } from "@/providers/operational-alerts-stream-provider"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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

export default function AppLayout() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(true)

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


  return (
    <OperationalAlertsStreamProvider>
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />

      <SidebarInset>
        {/* HEADER */}
        <header
          className={cn(
            "sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 transition-all duration-200 border-b",
            scrolled
              ? "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md"
              : "bg-transparent"
          )}
        >
          <div className="flex items-center gap-2 px-6">
            <SidebarTrigger
              size="icon"
              className="rounded-full h-9 w-9 [&_svg]:size-5"
            />

            <Separator orientation="vertical" className="h-4" />

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Panel</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Resumen</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="ml-auto px-6">
            <div className="flex items-center gap-1">
              <PwaInstallPrompt />
              <GlobalSearch />
              <div className="relative">
                <NotificationDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>

        <Footer />
      </SidebarInset>
    </SidebarProvider>
    </OperationalAlertsStreamProvider>
  )
}
