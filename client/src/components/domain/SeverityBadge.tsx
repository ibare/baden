import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  low: "bg-slate-100 text-slate-600 border-slate-300",
}

interface SeverityBadgeProps {
  severity: string
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded text-xs",
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low,
        className,
      )}
    >
      {severity}
    </Badge>
  )
}
