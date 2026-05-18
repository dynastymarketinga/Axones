"use client"

import { Check, ChevronsUpDown, Package, Users } from "lucide-react"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
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
import { cn } from "@/lib/utils"
import type { ClientRecord, ProductRecord } from "@/types/api"

type ReportEntityFiltersProps = {
  clientFilter: string
  onClientFilterChange: (v: string) => void
  productFilter: string
  onProductFilterChange: (v: string) => void
  clients: ClientRecord[]
  products: ProductRecord[]
  clientComboOpen: boolean
  onClientComboOpenChange: (open: boolean) => void
  productComboOpen: boolean
  onProductComboOpenChange: (open: boolean) => void
  selectedClientLabel: string
  selectedProductLabel: string
  className?: string
}

export function ReportEntityFilters({
  clientFilter,
  onClientFilterChange,
  productFilter,
  onProductFilterChange,
  clients,
  products,
  clientComboOpen,
  onClientComboOpenChange,
  productComboOpen,
  onProductComboOpenChange,
  selectedClientLabel,
  selectedProductLabel,
  className,
}: ReportEntityFiltersProps) {
  const hasClient = clientFilter !== "all"
  const hasProduct = productFilter !== "all"

  return (
    <ReportFilterSection
      title="Cliente y producto"
      accentClass="text-violet-700 dark:text-violet-300"
      dotClass="bg-violet-500"
      borderClass="border-violet-500/25 from-violet-500/[0.06]"
      className={className}
    >
      <CatalogFilterGrid>
        <CatalogLabeledField label="Cliente" icon={Users} className="min-w-0 md:col-span-6">
          <Popover open={clientComboOpen} onOpenChange={onClientComboOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={clientComboOpen}
                className={cn(
                  "h-11 w-full justify-between px-3 font-normal",
                  catalogSelectTriggerClass,
                  hasClient && "border-violet-500/40 bg-violet-500/[0.06]",
                )}
              >
                <span className="truncate text-left">{selectedClientLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] max-w-[100vw] p-0"
              align="start"
              side="bottom"
            >
              <Command shouldFilter>
                <CommandInput placeholder="Buscar por nombre o RIF…" />
                <CommandList>
                  <CommandEmpty>Ningún cliente coincide.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="todos"
                      onSelect={() => {
                        onClientFilterChange("all")
                        onClientComboOpenChange(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          clientFilter === "all" ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      Todos los clientes
                    </CommandItem>
                    {clients.map((c) => {
                      const line = c.rif ? `${c.name} ${c.rif}` : c.name
                      return (
                        <CommandItem
                          key={c.id}
                          value={line}
                          onSelect={() => {
                            onClientFilterChange(String(c.id))
                            onClientComboOpenChange(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clientFilter === String(c.id) ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          {c.rif ? `${c.name} · ${c.rif}` : c.name}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CatalogLabeledField>

        <CatalogLabeledField label="Producto" icon={Package} className="min-w-0 md:col-span-6">
          <Popover open={productComboOpen} onOpenChange={onProductComboOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={productComboOpen}
                className={cn(
                  "h-11 w-full justify-between px-3 font-normal",
                  catalogSelectTriggerClass,
                  hasProduct && "border-violet-500/40 bg-violet-500/[0.06]",
                )}
              >
                <span className="truncate text-left">{selectedProductLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] max-w-[100vw] p-0"
              align="start"
              side="bottom"
            >
              <Command shouldFilter>
                <CommandInput placeholder="Buscar por nombre o CPE…" />
                <CommandList>
                  <CommandEmpty>Ningún producto coincide.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="todos"
                      onSelect={() => {
                        onProductFilterChange("all")
                        onProductComboOpenChange(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          productFilter === "all" ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      Todos los productos
                    </CommandItem>
                    {products.map((p) => {
                      const line = p.cpe ? `${p.name} ${p.cpe}` : p.name
                      return (
                        <CommandItem
                          key={p.id}
                          value={line}
                          onSelect={() => {
                            onProductFilterChange(String(p.id))
                            onProductComboOpenChange(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              productFilter === String(p.id) ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          {p.cpe ? `${p.name} · ${p.cpe}` : p.name}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CatalogLabeledField>
      </CatalogFilterGrid>
    </ReportFilterSection>
  )
}
