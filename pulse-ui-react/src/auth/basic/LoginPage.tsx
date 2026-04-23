import { Factory } from "lucide-react"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-svh w-full bg-gradient-to-b from-muted/80 to-background flex items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl shadow-sm">
            <Factory className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Axones</h1>
          <p className="text-sm text-muted-foreground">Sistema operativo de planta</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
