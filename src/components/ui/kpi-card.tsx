import * as React from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string | number
  trend?: {
    value: string
    direction: "up" | "down" | "neutral"
  }
  icon?: React.ReactNode
  iconColor?: "blue" | "green" | "orange" | "red"
  className?: string
}

const iconColorMap = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  orange: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
}

export function KpiCard({ title, value, trend, icon, iconColor = "blue", className }: KpiCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-5 flex justify-between items-start",
      className
    )}>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
        <div className="text-sm text-muted-foreground mt-1.5">{title}</div>
        {trend && (
          <div className={cn(
            "text-xs font-medium mt-2 flex items-center gap-1",
            trend.direction === "up" && "text-emerald-600",
            trend.direction === "down" && "text-red-500",
            trend.direction === "neutral" && "text-muted-foreground"
          )}>
            {trend.direction === "up" && <TrendingUp className="h-3 w-3" />}
            {trend.direction === "down" && <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
      </div>
      {icon && (
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
          iconColorMap[iconColor]
        )}>
          {icon}
        </div>
      )}
    </div>
  )
}