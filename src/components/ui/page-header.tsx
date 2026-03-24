import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  count?: number
  countLabel?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ title, count, countLabel, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        {count !== undefined && (
          <span className="text-sm text-muted-foreground font-normal">
            {countLabel || "Totale"} {count}
          </span>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}