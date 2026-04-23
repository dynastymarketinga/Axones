import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">
        Oops! The page you’re looking for doesn’t exist.
      </p>

      <Button className="mt-6" onClick={() => navigate("/")}>
        Go to Dashboard
      </Button>
    </div>
  )
}
