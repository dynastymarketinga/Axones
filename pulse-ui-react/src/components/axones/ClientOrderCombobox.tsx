"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2 } from "lucide-react"

import {
  catalogComboboxPopoverClass,
  catalogComboboxScrollClass,
  catalogSelectTriggerClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { apiFetch } from "@/lib/api"
import { CLIENT_ORDER_LIST_SEARCH_PLACEHOLDER } from "@/pages/axones/client-order-i18n"
import { cn } from "@/lib/utils"
import type { ClientOrderRow, LaravelPaginated } from "@/types/api"

const SEARCH_DEBOUNCE_MS = 320
const PER_PAGE = 15

type PaginationMeta = Pick<
  LaravelPaginated<ClientOrderRow>,
  "current_page" | "last_page" | "total" | "from" | "to" | "per_page"
>

export function clientOrderComboboxLabel(c: ClientOrderRow): string {
  const parts = [c.code, c.client?.name, c.first_line_with_product?.product?.name]
    .map((p) => (typeof p === "string" && p.trim() ? p.trim() : null))
    .filter((p): p is string => Boolean(p))
  return parts.length ? parts.join(" — ") : c.code
}

function clientOrderSearchValue(c: ClientOrderRow): string {
  return [c.code, c.client?.name, c.first_line_with_product?.product?.name].filter(Boolean).join(" ")
}

function ClientOrderComboboxRowDetails({ row }: { row: ClientOrderRow }) {
  const client = row.client?.name?.trim() || "—"
  const product = row.first_line_with_product?.product?.name?.trim() || "—"

  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium leading-snug">{row.code}</p>
      <p className="truncate text-xs text-muted-foreground">
        {client} · {product}
      </p>
    </div>
  )
}

type ClientOrderComboboxProps = {
  value: string
  onValueChange: (clientOrderId: string) => void
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  id?: string
}

export function ClientOrderCombobox({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Seleccione…",
  searchPlaceholder = CLIENT_ORDER_LIST_SEARCH_PLACEHOLDER,
  className,
  id,
}: ClientOrderComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [searchRows, setSearchRows] = useState<ClientOrderRow[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<ClientOrderRow | null>(null)
  const debounceRef = useRef<number | null>(null)
  const requestSeqRef = useRef(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined)

  const loadPage = useCallback(async (q: string, pageNum: number) => {
    const seq = ++requestSeqRef.current
    setSearchLoading(true)
    try {
      const res = await apiFetch<LaravelPaginated<ClientOrderRow>>("client-orders", {
        query: {
          per_page: PER_PAGE,
          page: pageNum,
          sort: "asc",
          status: "open",
          q: q.trim() || undefined,
        },
      })
      if (seq !== requestSeqRef.current) return
      setSearchRows(res.data ?? [])
      setPagination({
        current_page: res.current_page,
        last_page: res.last_page,
        total: res.total,
        from: res.from,
        to: res.to,
        per_page: res.per_page,
      })
    } catch {
      if (seq !== requestSeqRef.current) return
      setSearchRows([])
      setPagination(null)
    } finally {
      if (seq === requestSeqRef.current) setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadPage(searchQuery, page)
  }, [open, searchQuery, page, loadPage])

  useEffect(() => {
    const idNum = value.trim()
    if (!idNum || !/^\d+$/.test(idNum)) {
      setSelectedRow(null)
      return
    }
    const fromRows = searchRows.find((r) => String(r.id) === idNum)
    if (fromRows) {
      setSelectedRow(fromRows)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const row = await apiFetch<ClientOrderRow>(`client-orders/${idNum}`)
        if (!cancelled) setSelectedRow(row)
      } catch {
        if (!cancelled) setSelectedRow(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [value, searchRows])

  const selectedLabel = useMemo(() => {
    if (!value.trim()) return placeholder
    if (selectedRow && String(selectedRow.id) === value.trim()) {
      return clientOrderComboboxLabel(selectedRow)
    }
    const fromSearch = searchRows.find((r) => String(r.id) === value.trim())
    if (fromSearch) return clientOrderComboboxLabel(fromSearch)
    return `OC #${value.trim()}`
  }, [value, selectedRow, searchRows, placeholder])

  const handleOpenChange = (next: boolean) => {
    if (next && triggerRef.current) {
      setPopoverWidth(triggerRef.current.getBoundingClientRect().width)
    }
    setOpen(next)
    if (next) {
      setSearchInput("")
      setSearchQuery("")
      setPage(1)
    }
  }

  const handleSearchInputChange = (q: string) => {
    setSearchInput(q)
    setPage(1)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setSearchQuery(q)
    }, SEARCH_DEBOUNCE_MS)
  }

  const showPagination = pagination != null && pagination.total > 0
  const showPageNav = pagination != null && pagination.last_page > 1

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          id={id}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-11 w-full min-w-0 justify-between overflow-hidden px-3 font-normal",
            catalogSelectTriggerClass,
            open && "border-primary/40 ring-2 ring-primary/15",
            !value.trim() && "text-muted-foreground",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          catalogComboboxPopoverClass,
          "!w-[var(--radix-popover-trigger-width)] max-w-none",
        )}
        style={
          popoverWidth != null
            ? { width: popoverWidth, maxWidth: popoverWidth }
            : undefined
        }
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchInput}
            onValueChange={handleSearchInputChange}
          />
          {showPagination ? (
            <div className="border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
              {searchLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Buscando pedidos abiertos…
                </span>
              ) : (
                <>
                  <span className="font-medium text-foreground">{pagination.total}</span>{" "}
                  {pagination.total === 1 ? "pedido abierto" : "pedidos abiertos"}
                  {searchQuery.trim() ? " que coinciden" : ""}
                  {showPageNav ? (
                    <>
                      {" "}
                      · pág. {pagination.current_page}/{pagination.last_page}
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
          <CommandList
            className={cn(
              catalogComboboxScrollClass,
              "max-h-[min(50vh,320px)] overflow-y-auto overflow-x-hidden",
            )}
          >
            {!searchLoading && searchRows.length === 0 ? (
              <CommandEmpty>Ningún pedido cliente (OC) coincide.</CommandEmpty>
            ) : null}
            <CommandGroup>
              {searchLoading && searchRows.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Cargando listado…
                </div>
              ) : null}
              {searchRows.map((row) => (
                <CommandItem
                  key={row.id}
                  value={clientOrderSearchValue(row)}
                  className="items-start py-2"
                  onSelect={() => {
                    setSelectedRow(row)
                    onValueChange(String(row.id))
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 mt-0.5 h-4 w-4 shrink-0",
                      value === String(row.id) ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <ClientOrderComboboxRowDetails row={row} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {showPagination ? (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-2 py-2">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {pagination.from != null && pagination.to != null ? (
                <>
                  <span className="font-medium text-foreground">{pagination.from}</span>
                  {"–"}
                  <span className="font-medium text-foreground">{pagination.to}</span>
                  {" de "}
                  <span className="font-medium text-foreground">{pagination.total}</span>
                </>
              ) : (
                <>Total: {pagination.total}</>
              )}
            </p>
            {showPageNav ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={searchLoading || pagination.current_page <= 1}
                  aria-label="Página anterior"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums">
                  {pagination.current_page}/{pagination.last_page}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={searchLoading || pagination.current_page >= pagination.last_page}
                  aria-label="Página siguiente"
                  onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
