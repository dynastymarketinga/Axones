"use client"

import { Fragment } from "react"
import { Link, useLocation } from "react-router-dom"

import { buildAxonesBreadcrumbTrail } from "@/lib/axones-breadcrumb-trail"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function AxonesAppBreadcrumb() {
  const { pathname, search } = useLocation()
  const crumbs = buildAxonesBreadcrumbTrail(pathname, search)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator className="hidden md:block" /> : null}
              <BreadcrumbItem className={index === 0 ? "hidden md:block" : undefined}>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
