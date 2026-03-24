import * as React from "react"
import { cn } from "@/lib/utils"
import { Home } from "lucide-react"

interface PropertyThumbnailProps {
  src?: string | null
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: "h-8 w-8 rounded-md text-xs",
  md: "h-11 w-11 rounded-lg text-sm",
  lg: "h-14 w-14 rounded-lg text-base",
}

const gradients = [
  "from-blue-100 to-blue-200",
  "from-amber-100 to-amber-200",
  "from-indigo-100 to-indigo-200",
  "from-emerald-100 to-emerald-200",
  "from-rose-100 to-rose-200",
  "from-violet-100 to-violet-200",
  "from-cyan-100 to-cyan-200",
  "from-orange-100 to-orange-200",
]

function getGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

export function PropertyThumbnail({ src, name, size = "md", className }: PropertyThumbnailProps) {
  const [imgError, setImgError] = React.useState(false)

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={cn("object-cover flex-shrink-0", sizeMap[size], className)}
      />
    )
  }

  return (
    <div className={cn(
      "flex items-center justify-center flex-shrink-0 bg-gradient-to-br",
      sizeMap[size],
      getGradient(name),
      className
    )}>
      <Home className="h-4 w-4 text-slate-500" />
    </div>
  )
}