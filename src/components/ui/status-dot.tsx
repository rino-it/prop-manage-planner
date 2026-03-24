import * as React from "react"
import { cn } from "@/lib/utils"

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral"

interface StatusDotProps {
  variant: StatusVariant
  label: string
  className?: string
}

const dotColors: Record<StatusVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
}

const textColors: Record<StatusVariant, string> = {
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-red-700",
  info: "text-blue-700",
  neutral: "text-slate-500",
}

export function StatusDot({ variant, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", textColors[variant], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotColors[variant])} />
      {label}
    </span>
  )
}