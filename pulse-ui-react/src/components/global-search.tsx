import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Search } from "lucide-react"

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()

  // Keyboard shortcut: Ctrl + K / Cmd + K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full [&_svg]:size-5"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Dashboard">
            <CommandItem onSelect={() => navigate("/")}>
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => navigate("/analytics")}>
              Analytics
            </CommandItem>
            <CommandItem onSelect={() => navigate("/crm")}>
              CRM
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => alert("Profile")}>
              Profile
            </CommandItem>
            <CommandItem onSelect={() => alert("Billing")}>
              Billing
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
