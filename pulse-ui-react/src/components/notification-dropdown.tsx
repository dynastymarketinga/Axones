import { Bell } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { apiFetch, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

type Notification = {
  id: number
  title: string
  description: string
  time: string
  unread?: boolean
  avatar?: string
  color?: string
}

type AlertApiRow = {
  id: number
  alert_type: string
  severity: string
  message: string
  created_at: string
  acknowledged_at: string | null
}

type AlertPage = {
  data: AlertApiRow[]
}

function severityColor(severity?: string): string {
  const s = (severity ?? "").toLowerCase().trim()
  if (s === "critical") return "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
  if (s === "warning") return "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
  return "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400"
}

export function NotificationDropdown() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AlertApiRow[]>([])

  async function load() {
    try {
      const res = await apiFetch<AlertPage>("alerts", {
        query: { page: 1, per_page: 8 },
      })
      setRows(res.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open])

  const notifications = useMemo<Notification[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        title: r.alert_type.replaceAll("_", " "),
        description: r.message,
        time: new Date(r.created_at).toLocaleString("es-VE"),
        unread: !r.acknowledged_at,
        color: severityColor(r.severity),
      })),
    [rows],
  )

  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full [&_svg]:size-5"
          >
            <Bell />
          </Button>

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full
              bg-destructive px-1 text-[10px] font-medium
              text-destructive-foreground flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 p-0 rounded-xl border shadow-xl"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span>Alertas</span>
          <span className="text-xs text-muted-foreground">
            {unreadCount} sin leer
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="h-80 overflow-y-auto">
          <div className="flex flex-col">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex gap-3 px-4 py-3 cursor-pointer transition-colors",
                  item.unread
                    ? "bg-muted/50 hover:bg-muted"
                    : "hover:bg-muted/50"
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={item.avatar} />
                  <AvatarFallback
                    className={cn(
                      "font-medium text-sm flex items-center justify-center",
                      item.color
                    )}
                  >
                    {item.title.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium leading-none">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-2 border-t">
          <Button variant="ghost" className="w-full text-sm" onClick={() => navigate("/alertas")}>
            Ver todas las alertas
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
