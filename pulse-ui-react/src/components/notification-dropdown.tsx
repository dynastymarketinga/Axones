import { Bell } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
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
import { markAlertToastOnce } from "@/lib/alert-toast-once"
import { apiFetch, ApiError } from "@/lib/api"
import { shouldPlayOperationalToast } from "@/lib/operational-alert-toast-policy"
import type { StreamAlertPayload } from "@/lib/operational-alerts-stream"
import { getStoredUser } from "@/lib/auth-storage"
import { useOperationalAlertStreamSubscription } from "@/providers/use-operational-alert-stream-subscription"
import { cn } from "@/lib/utils"

type Notification = {
  id: number
  alertType: string
  title: string
  description: string
  time: string
  createdAtIso: string
  unread?: boolean
  avatar?: string
  color?: string
  workOrderId?: number
  targetArea?: string | null
  hiddenCount?: number
}

type AlertApiRow = {
  id: number
  alert_type: string
  severity: string
  message: string
  created_at: string
  acknowledged_at: string | null
  metadata?: Record<string, unknown>
  work_order?: { id?: number; code?: string }
}

type AlertPage = {
  data: AlertApiRow[]
}

function streamPayloadToRow(row: StreamAlertPayload): AlertApiRow {
  return {
    id: row.id,
    alert_type: row.alert_type,
    severity: row.severity,
    message: row.message,
    created_at: row.created_at,
    acknowledged_at: row.acknowledged_at,
    metadata: row.metadata,
    work_order: row.work_order,
  }
}

const ALERT_TITLE_ES: Record<string, string> = {
  work_order_saved_broadcast: "Orden de trabajo guardada",
  work_order_created: "Orden de trabajo creada",
  work_order_area_assignment: "OT asignada a área",
  production_handoff: "Producción actualizada entre áreas",
  production_saved: "Producción guardada",
  ot_material_shortage: "Falta de material",
  scrap_threshold_exceeded: "Merma por encima del umbral",
  mount_time_exceeded: "Tiempo de montaje excedido",
  password_reset_requested: "Solicitud de restablecimiento de clave",
}

function alertTitleInSpanish(alertType: string): string {
  const key = alertType.toLowerCase().trim()
  return ALERT_TITLE_ES[key] ?? key.replaceAll("_", " ")
}

function routeForAreaTarget(targetArea?: string | null): string | null {
  const a = (targetArea ?? "").toLowerCase().trim()
  if (a === "impresion") return "/impresion"
  if (a === "laminacion") return "/laminacion"
  if (a === "corte") return "/corte"
  if (a === "tintas") return "/tintas"
  return null
}

function routeForAlertType(
  alertType: string,
  workOrderId?: number,
  targetArea?: string | null,
): string {
  const areaRoute = routeForAreaTarget(targetArea)
  if (areaRoute) return areaRoute
  const key = alertType.toLowerCase().trim()
  if (
    [
      "work_order_saved_broadcast",
      "work_order_created",
      "work_order_area_assignment",
      "production_handoff",
      "production_saved",
      "ot_material_shortage",
      "scrap_threshold_exceeded",
      "mount_time_exceeded",
    ].includes(key)
  ) {
    return Number.isFinite(workOrderId) && Number(workOrderId) > 0
      ? `/ordenes-trabajo/${workOrderId}`
      : "/ordenes-trabajo?tab=lista"
  }
  if (key === "password_reset_requested") {
    return "/account/password-reset-requests"
  }
  return "/alertas"
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
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener("alerts:refresh", onRefresh)
    return () => window.removeEventListener("alerts:refresh", onRefresh)
  }, [])

  const onStreamRow = useCallback((row: StreamAlertPayload) => {
    setRows((prev) => {
      if (prev.some((x) => x.id === row.id)) return prev
      return [streamPayloadToRow(row), ...prev].slice(0, 24)
    })
    const session = getStoredUser()
    if (
      shouldPlayOperationalToast(session?.role, row.metadata) &&
      markAlertToastOnce(row.id)
    ) {
      toast.info(row.message)
    }
  }, [])

  useOperationalAlertStreamSubscription(onStreamRow)

  async function acknowledgeOne(id: number) {
    try {
      await apiFetch(`alerts/${id}/acknowledge`, { method: "PATCH" })
      // En campana solo queremos pendientes; al reconocer, desaparece.
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo reconocer la alerta.")
      throw e
    }
  }

  async function acknowledgeAllAndOpenAlerts() {
    try {
      const res = await apiFetch<{ updated_count: number }>("alerts/acknowledge-all", {
        method: "POST",
      })
      // Campana queda vacía tras marcar todas como leídas.
      setRows([])
      if ((res.updated_count ?? 0) > 0) {
        toast.success(`Se marcaron ${res.updated_count} alerta(s) como leídas.`)
      }
      setOpen(false)
      navigate("/alertas")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron marcar todas las alertas.")
    }
  }

  async function handleNotificationClick(item: Notification) {
    try {
      if (item.unread) {
        const woId = Number(item.workOrderId ?? 0)
        const ta = (item.targetArea ?? "").toLowerCase().trim()
        if (woId > 0 && ta) {
          await apiFetch<{ updated_count: number }>("alerts/acknowledge-work-order-area", {
            method: "POST",
            body: JSON.stringify({ work_order_id: woId, target_area: ta }),
          })
          setRows((prev) =>
            prev.filter((r) => {
              const rid = Number(r.work_order?.id ?? 0)
              const rta = ((r.metadata?.target_area as string | undefined) ?? "").toLowerCase().trim()
              return !(rid === woId && rta === ta)
            }),
          )
        } else {
          await acknowledgeOne(item.id)
        }
      }
      setOpen(false)
      navigate(routeForAlertType(item.alertType, item.workOrderId, item.targetArea))
    } catch {
      // errores manejados en acknowledgeOne
    }
  }

  const notifications = useMemo<Notification[]>(
    () => {
      const byKey = new Map<
        string,
        { row: AlertApiRow; hidden: number }
      >()

      for (const r of rows) {
        const woId = Number(r.work_order?.id ?? 0) || 0
        const ta = ((r.metadata?.target_area as string | undefined) ?? "").toLowerCase().trim()
        const key = woId > 0 && ta ? `${woId}:${ta}` : `id:${r.id}`

        const existing = byKey.get(key)
        if (!existing) {
          byKey.set(key, { row: r, hidden: 0 })
          continue
        }

        existing.hidden += 1
        // quedarnos con la alerta más reciente (por created_at)
        if (new Date(r.created_at).getTime() > new Date(existing.row.created_at).getTime()) {
          existing.row = r
        }
      }

      const grouped = Array.from(byKey.values()).map(({ row, hidden }) => {
        const hiddenText = hidden > 0 ? ` (+${hidden})` : ""
        return {
          id: row.id,
          alertType: row.alert_type,
          title: `${alertTitleInSpanish(row.alert_type)}${hiddenText}`,
          description: row.message,
          time: new Date(row.created_at).toLocaleString("es-VE"),
          createdAtIso: row.created_at,
          unread: !row.acknowledged_at,
          color: severityColor(row.severity),
          workOrderId: Number(row.work_order?.id ?? 0) || undefined,
          targetArea: (row.metadata?.target_area as string | undefined) ?? null,
          hiddenCount: hidden,
        } satisfies Notification
      })

      // Ordenar por más reciente
      grouped.sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime())
      return grouped
    },
    [rows],
  )

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => n.unread),
    [notifications],
  )
  const unreadCount = unreadNotifications.length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full [&_svg]:size-5"
          >
            <Bell />
          </Button>

          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-5 min-w-5 rounded-full
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
            {unreadNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No tienes alertas pendientes.
              </div>
            ) : unreadNotifications.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex w-full gap-3 px-4 py-3 text-left cursor-pointer transition-colors",
                  item.unread
                    ? "bg-muted/50 hover:bg-muted"
                    : "hover:bg-muted/50"
                )}
                onClick={() => void handleNotificationClick(item)}
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
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => void acknowledgeAllAndOpenAlerts()}
          >
            Ver todas las alertas
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
