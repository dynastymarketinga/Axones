import { useRouteError } from "react-router-dom"

export default function ErrorPage() {
  const error = useRouteError() as any

  return (
    <div className="flex h-screen flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        {error?.statusText || error?.message || "Unexpected error"}
      </p>
    </div>
  )
}
