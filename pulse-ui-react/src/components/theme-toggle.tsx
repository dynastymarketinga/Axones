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

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

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
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
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
          {isDark ? "Modo claro" : "Modo oscuro"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
