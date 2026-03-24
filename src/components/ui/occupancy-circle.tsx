import * as React from "react"
import { cn } from "@/lib/utils"

interface OccupancyCircleProps {
  value: number
  size?: number
  className?: string
}

export function OccupancyCircle({ value, size = 32, className }: OccupancyCircleProps) {
  const radius = (size / 2) - 3
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const clampedValue = Math.max(0, Math.min(100, value))

  let strokeColor = "stroke-emerald-500"
  if (clampedValue === 0) strokeColor = "stroke-slate-300"
  else if (clampedValue < 40) strokeColor = "stroke-amber-500"
  else if (clampedValue < 70) strokeColor = "stroke-blue-500"

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          className="stroke-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-500", strokeColor)}
        />
      </svg>
      <span className="text-sm font-medium text-foreground">{clampedValue}%</span>
    </div>
  )
}