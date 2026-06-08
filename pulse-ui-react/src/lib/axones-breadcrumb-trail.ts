import { AXONES_MENU_TREE, AXONES_ACCOUNT_BREADCRUMB_LEAVES } from "@/lib/axones-menu"
import type { AxonesMenuNode } from "@/lib/axones-roles"

export type AxonesBreadcrumbCrumb = {
  label: string
  href?: string
}

function isBranch(
  node: AxonesMenuNode,
): node is { title: string; url: string; items: AxonesMenuNode[] } {
  return "items" in node && Array.isArray(node.items)
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "")
  return trimmed === "" ? "resumen" : trimmed
}

function pathMatchesUrl(path: string, url: string): boolean {
  return path === url || path.startsWith(`${url}/`)
}

type MenuMatch = {
  ancestors: { title: string; url: string }[]
  leaf: { title: string; url: string }
  remainder: string
}

function findMenuMatch(
  nodes: AxonesMenuNode[],
  path: string,
  ancestors: { title: string; url: string }[] = [],
): MenuMatch | null {
  for (const node of nodes) {
    if (isBranch(node)) {
      const branchAncestors = [...ancestors, { title: node.title, url: node.url }]

      for (const child of node.items) {
        if (isBranch(child)) {
          const nested = findMenuMatch([child], path, branchAncestors)
          if (nested) return nested
          continue
        }

        if (pathMatchesUrl(path, child.url)) {
          return {
            ancestors: branchAncestors,
            leaf: { title: child.title, url: child.url },
            remainder: path === child.url ? "" : path.slice(child.url.length + 1),
          }
        }
      }

      if (node.url !== "#" && pathMatchesUrl(path, node.url)) {
        return {
          ancestors,
          leaf: { title: node.title, url: node.url },
          remainder: path === node.url ? "" : path.slice(node.url.length + 1),
        }
      }
    } else if (pathMatchesUrl(path, node.url)) {
      return {
        ancestors,
        leaf: { title: node.title, url: node.url },
        remainder: path === node.url ? "" : path.slice(node.url.length + 1),
      }
    }
  }

  return null
}

function resolveFormCrumb(remainder: string, search: string): string | null {
  const segments = remainder.split("/").filter(Boolean)
  if (segments.length === 0) return null

  const [head, ...tail] = segments

  if (head === "form") {
    const params = new URLSearchParams(search)
    return params.get("id") ? "Editar" : "Nuevo"
  }

  if (head === "nueva" || head === "nuevo") return "Nuevo"

  if (tail.includes("editar")) return "Editar"

  return null
}

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function findAccountMatch(path: string): MenuMatch | null {
  for (const leaf of AXONES_ACCOUNT_BREADCRUMB_LEAVES) {
    if (pathMatchesUrl(path, leaf.url)) {
      return {
        ancestors: [{ title: "Cuenta", url: "#" }],
        leaf: { title: leaf.title, url: leaf.url },
        remainder: path === leaf.url ? "" : path.slice(leaf.url.length + 1),
      }
    }
  }
  return null
}

/** Construye la ruta de migas según pathname y query del menú Axones. */
export function buildAxonesBreadcrumbTrail(
  pathname: string,
  search = "",
): AxonesBreadcrumbCrumb[] {
  const path = normalizePath(pathname)
  const crumbs: AxonesBreadcrumbCrumb[] = [{ label: "Axones", href: "/resumen" }]

  const match = findMenuMatch(AXONES_MENU_TREE, path) ?? findAccountMatch(path)

  if (match) {
    for (const ancestor of match.ancestors) {
      if (ancestor.url === "#") {
        crumbs.push({ label: ancestor.title })
      } else {
        crumbs.push({ label: ancestor.title, href: `/${ancestor.url}` })
      }
    }

    const isExactLeaf = match.remainder === ""
    crumbs.push({
      label: match.leaf.title,
      href: isExactLeaf ? undefined : `/${match.leaf.url}`,
    })

    const formCrumb = resolveFormCrumb(match.remainder, search)
    if (formCrumb) {
      crumbs.push({ label: formCrumb })
    } else if (match.remainder && !isExactLeaf) {
      const tail = match.remainder.split("/").filter(Boolean).at(-1)
      if (tail && !/^\d+$/.test(tail)) {
        crumbs.push({ label: humanizeSegment(tail) })
      }
    }

    return crumbs
  }

  if (path === "resumen") {
    crumbs.push({ label: "Resumen" })
    return crumbs
  }

  crumbs.push({ label: humanizeSegment(path.split("/").at(-1) ?? path) })
  return crumbs
}

const AUTH_DOCUMENT_TITLES: Record<string, string> = {
  "auth/basic/login": "Iniciar sesión",
  "auth/basic/request-reset": "Solicitar contraseña",
}

/** Título de pestaña del navegador, p. ej. «Axones - Cuenta - Perfil». */
export function buildAxonesDocumentTitle(pathname: string, search = ""): string {
  const path = normalizePath(pathname)
  const authTitle = AUTH_DOCUMENT_TITLES[path]
  if (authTitle) return `Axones - ${authTitle}`

  const crumbs = buildAxonesBreadcrumbTrail(pathname, search)
  return crumbs.map((crumb) => crumb.label).join(" - ")
}
