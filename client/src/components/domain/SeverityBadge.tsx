import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
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
