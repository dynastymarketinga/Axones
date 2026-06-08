import { Outlet } from "react-router-dom"

import { AxonesDocumentTitle } from "@/components/axones/AxonesDocumentTitle"

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <AxonesDocumentTitle />
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  )
}
