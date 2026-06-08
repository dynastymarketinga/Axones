import { AuthPageShell } from "@/components/auth/AuthPageShell"
import { LoginForm } from "@/components/login-form"
import { PwaInstallGuide } from "@/components/pwa-install-guide"

export default function LoginPage() {
  return (
    <AuthPageShell footer={<PwaInstallGuide />}>
      <LoginForm />
    </AuthPageShell>
  )
}
