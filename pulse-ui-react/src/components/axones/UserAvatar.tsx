import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getUserInitials } from "@/lib/axones-role-labels"
import { cn } from "@/lib/utils"

function resolveAvatarSrc(avatarUrl?: string | null): string | undefined {
  const trimmed = avatarUrl?.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).pathname
    } catch {
      return undefined
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

type UserAvatarProps = {
  name: string
  avatarUrl?: string | null
  className?: string
  fallbackClassName?: string
  imageClassName?: string
}

export function UserAvatar({
  name,
  avatarUrl,
  className,
  fallbackClassName,
  imageClassName,
}: UserAvatarProps) {
  const initial = getUserInitials(name)
  const src = resolveAvatarSrc(avatarUrl)

  return (
    <Avatar className={cn("shrink-0", className)}>
      {src ? (
        <AvatarImage src={src} alt={name} className={cn("object-cover", imageClassName)} />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{initial}</AvatarFallback>
    </Avatar>
  )
}
