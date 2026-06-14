"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Barcode, Check, ChevronsUpDown } from "lucide-react"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { catalogSelectTriggerClass } from "@/components/axones/catalog-list-classes"
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
import { cn } from "@/lib/utils"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"

export type ReportWorkOrderOption = {
  work_order_id: number
  work_order_code: string
  client_name?: string | null
  product_name?: string | null
}

type ReportWorkOrderPickerProps = {
  value: string
  onValueChange: (workOrderId: string) => void
  options?: ReportWorkOrderOption[]
  mode?: "static" | "search"
  disabled?: boolean
  placeholder?: string
  label?: string
  className?: string
  highlighted?: boolean
}

function optionLabel(opt: ReportWorkOrderOption): string {
  const parts = [opt.work_order_code]
  if (opt.client_name) parts.push(opt.client_name)
  if (opt.product_name) parts.push(opt.product_name)
  return parts.join(" · ")
}

function optionSearchValue(opt: ReportWorkOrderOption): string {
  return [opt.work_order_code, opt.client_name, opt.product_name].filter(Boolean).join(" ")
}

export function ReportWorkOrderPicker({
  value,
  onValueChange,
  options = [],
  mode = "static",
  disabled = false,
  placeholder = "Buscar por código OT…",
  label = "Orden de trabajo",
  className,
  highlighted = false,
}: ReportWorkOrderPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchRows, setSearchRows] = useState<WorkOrderListRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const staticOptions = useMemo(() => options, [options])

  const loadSearch = useCallback(async (q: string) => {
    if (mode !== "search") return
    setSearchLoading(true)
    try {
      const res = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
        query: { per_page: 50, page: 1, q: q.trim() || undefined },
      })
      setSearchRows(res.data)
    } catch {
      setSearchRows([])
    } finally {
      setSearchLoading(false)
    }
  }, [mode])

  useEffect(() => {
    if (mode === "search" && open) {
      void loadSearch("")
    }
  }, [mode, open, loadSearch])

  const resolvedOptions: ReportWorkOrderOption[] = useMemo(() => {
    if (mode === "static") return staticOptions
    return searchRows.map((r) => ({
      work_order_id: r.id,
      work_order_code: r.code,
      client_name: r.client?.name ?? null,
      product_name: r.product?.name ?? null,
    }))
  }, [mode, staticOptions, searchRows])

  const selectedLabel = useMemo(() => {
    if (!value.trim()) return placeholder
    const found = resolvedOptions.find((o) => String(o.work_order_id) === value.trim())
    if (found) return optionLabel(found)
    const fromStatic = staticOptions.find((o) => String(o.work_order_id) === value.trim())
    if (fromStatic) return optionLabel(fromStatic)
    return `OT #${value.trim()}`
  }, [value, resolvedOptions, staticOptions, placeholder])

  return (
    <CatalogLabeledField label={label} icon={Barcode} className={cn("min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="min-w-0 w-full">
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                "h-11 w-full min-w-0 justify-between overflow-hidden px-3 font-normal",
                catalogSelectTriggerClass,
                highlighted && value.trim() && "border-amber-500/50 bg-amber-500/[0.06]",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,24rem)] p-0"
          align="start"
          side="bottom"
        >
          <Command shouldFilter={mode === "static"}>
            <CommandInput
              placeholder={placeholder}
              onValueChange={(q) => {
                if (mode === "search") void loadSearch(q)
              }}
            />
            <CommandList>
              <CommandEmpty>
                {searchLoading ? "Buscando…" : "Ninguna orden coincide."}
              </CommandEmpty>
              <CommandGroup>
                {mode === "static" ? (
                  <CommandItem
                    value="ninguna"
                    onSelect={() => {
                      onValueChange("")
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", !value.trim() ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    Sin selección
                  </CommandItem>
                ) : null}
                {resolvedOptions.map((opt) => (
                  <CommandItem
                    key={opt.work_order_id}
                    value={optionSearchValue(opt)}
                    onSelect={() => {
                      onValueChange(String(opt.work_order_id))
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === String(opt.work_order_id) ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{optionLabel(opt)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </CatalogLabeledField>
  )
}
