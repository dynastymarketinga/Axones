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
import { getStoredUser } from "@/lib/auth-storage"
import { AXONES_MENU_TREE, getAccountLeaves } from "@/lib/axones-menu"
import {
  filterAxonesMenuTree,
  isAxonesUrlAllowed,
  type AxonesMenuNode,
} from "@/lib/axones-roles"

function toHref(url: string) {
  if (!url || url === "#") return url
  return url.startsWith("/") ? url : `/${url}`
}

function flattenAxonesMenu(
  nodes: AxonesMenuNode[],
  ancestors: string[] = [],
): { title: string; pathLabel: string; href: string }[] {
  const out: { title: string; pathLabel: string; href: string }[] = []
  for (const node of nodes) {
    if ("items" in node && node.items && node.items.length > 0) {
      out.push(...flattenAxonesMenu(node.items, [...ancestors, node.title]))
    } else if ("url" in node && node.url && node.url !== "#") {
      out.push({
        title: node.title,
        pathLabel: [...ancestors, node.title].join(" › "),
        href: toHref(node.url),
      })
    }
  }
  return out
}

/** Atajos con ruta propia; visibles si el rol puede la ruta o el módulo base. */
function shortcutAllowed(
  url: string,
  role?: string | null,
  userId?: number | null,
  user?: ReturnType<typeof getStoredUser>,
) {
  if (isAxonesUrlAllowed(url, role, userId, user)) return true
  const base = url.split("/")[0]
  if (base) return isAxonesUrlAllowed(base, role, userId, user)
  return false
}

const MENU_SHORTCUTS: { title: string; url: string }[] = [
  { title: "Nuevo cliente", url: "clientes/form" },
  { title: "Nueva orden de compra", url: "ordenes-compra/nueva" },
]

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()
  const session = getStoredUser()

  const menuEntries = React.useMemo(() => {
    const filtered = filterAxonesMenuTree(AXONES_MENU_TREE, session?.role, session?.id, session)
    const fromMenu = flattenAxonesMenu(filtered)
    const cuenta = getAccountLeaves(session).map((l) => ({
      title: l.title,
      pathLabel: `Cuenta › ${l.title}`,
      href: toHref(l.url),
    }))
    return [...fromMenu, ...cuenta]
  }, [session])

  const directShortcuts = React.useMemo(
    () =>
      MENU_SHORTCUTS.filter((s) => shortcutAllowed(s.url, session?.role, session?.id, session)).map(
        (s) => ({
          title: s.title,
          pathLabel: "Acceso directo",
          href: toHref(s.url),
        }),
      ),
    [session?.id, session?.role],
  )

  // Ctrl + K / Cmd + K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const run = (href: string) => {
    setOpen(false)
    navigate(href)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full [&_svg]:size-5"
        onClick={() => setOpen(true)}
        type="button"
        title="Buscar en el menú (Ctrl+K)"
      >
        <Search />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar sección, página o cuenta…"
        />
        <CommandList>
          <CommandEmpty>No hay resultados.</CommandEmpty>

          <CommandGroup heading="Menú">
            {menuEntries.map((item) => (
              <CommandItem
                key={`${item.href}-${item.pathLabel}`}
                value={`${item.pathLabel} ${item.title}`}
                onSelect={() => run(item.href)}
              >
                <div className="flex flex-col gap-0.5 min-w-0 text-left">
                  <span className="font-medium leading-tight">{item.title}</span>
                  <span className="text-muted-foreground text-xs leading-tight truncate">
                    {item.pathLabel}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>

          {directShortcuts.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Accesos directos">
                {directShortcuts.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.pathLabel} ${item.title}`}
                    onSelect={() => run(item.href)}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 text-left">
                      <span className="font-medium leading-tight">
                        {item.title}
                      </span>
                      <span className="text-muted-foreground text-xs leading-tight truncate">
                        {item.pathLabel}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
