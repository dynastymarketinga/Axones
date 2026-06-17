"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/axones/UserAvatar"
import { Button } from "@/components/ui/button"
import { deleteUserAvatar, uploadUserAvatar, ApiError } from "@/lib/api"
import {
  getStoredToken,
  setAuthSession,
  type AuthUser,
} from "@/lib/auth-storage"
import { cn } from "@/lib/utils"

type ProfileAvatarEditorProps = {
  name: string
  avatarUrl?: string | null
  size?: "md" | "lg"
  className?: string
  onAvatarChange?: (user: AuthUser) => void
}

export function ProfileAvatarEditor({
  name,
  avatarUrl,
  size = "lg",
  className,
  onAvatarChange,
}: ProfileAvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [localUrl, setLocalUrl] = useState<string | null>(avatarUrl ?? null)

  useEffect(() => {
    setLocalUrl(avatarUrl ?? null)
  }, [avatarUrl])

  const avatarClass = size === "lg" ? "h-20 w-20 rounded-2xl" : "h-16 w-16 rounded-xl"
  const fallbackClass =
    size === "lg"
      ? "rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/15 text-lg font-semibold text-primary"
      : "rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/15 text-base font-semibold text-primary"

  const syncSession = useCallback(
    (user: AuthUser) => {
      setLocalUrl(user.avatar_url ?? null)
      const token = getStoredToken()
      if (token) {
        setAuthSession(token, user)
      }
      onAvatarChange?.(user)
    },
    [onAvatarChange],
  )

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setUploading(true)
      try {
        const res = await uploadUserAvatar(file)
        syncSession(res.user)
        toast.success(res.message)
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo subir la foto.")
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [syncSession],
  )

  const handleRemove = useCallback(async () => {
    setRemoving(true)
    try {
      const res = await deleteUserAvatar()
      syncSession(res.user)
      toast.success(res.message)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo quitar la foto.")
    } finally {
      setRemoving(false)
    }
  }, [syncSession])

  const busy = uploading || removing
  const hasPhoto = Boolean(localUrl)

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <UserAvatar
          name={name}
          avatarUrl={localUrl}
          className={cn(avatarClass, "ring-2 ring-primary/15 shadow-sm")}
          fallbackClassName={fallbackClass}
          imageClassName={size === "lg" ? "rounded-2xl" : "rounded-xl"}
        />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
          disabled={busy}
          title="Cambiar foto"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(ev) => void handleFile(ev.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" aria-hidden />
          {uploading ? "Subiendo…" : "Cambiar foto"}
        </Button>
        {hasPhoto ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {removing ? "Quitando…" : "Quitar foto"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
