"use client"

import type { LucideIcon } from "lucide-react"
import { forwardRef } from "react"

import {
  catalogMasterFormFieldIconClass,
  catalogMasterFormInputClass,
} from "@/components/axones/catalog-list-classes"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type CatalogMasterIconInputProps = React.ComponentPropsWithoutRef<typeof Input> & {
  icon: LucideIcon
  invalid?: boolean
}

export const CatalogMasterIconInput = forwardRef<HTMLInputElement, CatalogMasterIconInputProps>(
  function CatalogMasterIconInput({ icon: Icon, invalid, className, ...props }, ref) {
    return (
      <div className="group/field relative">
        <Icon
          className={cn(catalogMasterFormFieldIconClass, invalid && "text-destructive")}
          aria-hidden
        />
        <Input
          ref={ref}
          className={cn(
            catalogMasterFormInputClass,
            invalid && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
