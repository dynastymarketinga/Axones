"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

// ✅ Type added
type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export default function ComingSoon() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // ✅ typed state
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  const [email, setEmail] = useState("")

  useEffect(() => {
    setMounted(true)

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 5)

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const distance = targetDate.getTime() - now

      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      )
      const minutes = Math.floor(
        (distance % (1000 * 60 * 60)) / (1000 * 60)
      )
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleNotify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email) return
    alert(`Thanks! We'll notify you at: ${email}`)
    setEmail("")
  }

  if (!mounted) return null

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-blue-500/20 transition-colors duration-300">

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="bg-background/60 border-border supports-[backdrop-filter]:backdrop-blur-md"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Glow */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary/20 dark:bg-primary/10 blur-[140px] rounded-full -z-10" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-muted/40 dark:bg-muted/20 blur-[140px] rounded-full -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl w-full"
      >
        <div className="relative rounded-3xl p-12 bg-background/60 dark:bg-background/40 border border-border/60 shadow-lg backdrop-blur-xl">

          <h1 className="text-4xl md:text-5xl font-semibold">
            Coming Soon
          </h1>

          <p className="mt-4 text-muted-foreground">
            We’re building something exceptional. Stay tuned.
          </p>

          {/* Countdown */}
          <div className="mt-10 grid grid-cols-4 gap-6 text-center">
            {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
              <div key={unit}>
                <div className="text-3xl font-semibold">
                  {timeLeft[unit]}
                </div>
                <div className="text-xs uppercase text-muted-foreground mt-1">
                  {unit}
                </div>
              </div>
            ))}
          </div>

          {/* Email */}
          <form
            onSubmit={handleNotify}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button type="submit">Notify Me</Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}