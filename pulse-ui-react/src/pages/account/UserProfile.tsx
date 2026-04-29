import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User } from "lucide-react"

import { getStoredUser } from "@/lib/auth-storage"

export default function UserProfile() {
  const session = getStoredUser()

    return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <User className="size-5" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {session ? (
            <>
              <div>
                <p className="text-muted-foreground">Nombre</p>
                <p className="font-medium">{session.name}</p>
                            </div>
                            <div>
                <p className="text-muted-foreground">Correo</p>
                <p className="font-medium">{session.email}</p>
                                </div>
              {session.username ? (
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium">{session.username}</p>
                </div>
              ) : null}
              <div>
                <p className="text-muted-foreground mb-1">Rol</p>
                <Badge variant="secondary">{session.role ?? "general"}</Badge>
                                </div>
            </>
          ) : (
            <p className="text-muted-foreground">No hay sesión cargada.</p>
          )}
                            </CardContent>
                        </Card>
        </div>
    )
}
