"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useUIThemeStore } from "@/store/ui-theme.store"   // ✅ ADD THIS

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { setTheme: setCustomTheme } = useUIThemeStore()   // ✅ ADD THIS

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full opacity-0">
        <Sun />
      </Button>
    )
  }

  const isDark = theme === "dark"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full [&_svg]:size-5"
            onClick={() => {
              setCustomTheme("")              // ✅ REMOVE custom theme
              setTheme(isDark ? "light" : "dark") // ✅ APPLY system theme
            }}
            aria-label="Toggle theme"
          >
            <Sun
              className={`transition-all ${
                isDark ? "rotate-90 scale-0" : "rotate-0 scale-100"
              }`}
            />
            <Moon
              className={`absolute transition-all ${
                isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0"
              }`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isDark ? "Switch to light mode" : "Switch to dark mode"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}